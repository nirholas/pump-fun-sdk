import { AnchorProvider, Program } from "@coral-xyz/anchor";
import type { BorshInstructionCoder } from "@coral-xyz/anchor";
import {
  coinCreatorVaultAtaPda,
  coinCreatorVaultAuthorityPda,
} from "@pump-fun/pump-swap-sdk";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type {
  AccountInfo,
  AccountMeta,
  Connection,
  TransactionInstruction} from "@solana/web3.js";
import {
  PublicKey,
  SystemProgram
} from "@solana/web3.js";
import BN from "bn.js";

import { getStaticRandomFeeRecipient, validateSellAmount } from "./bondingCurve";
import {
  CashbackCoinNotSupportedError,
  MultiHopDiscontinuousPathError,
  NoShareholdersError,
  TooManyShareholdersError,
  ZeroShareError,
  InvalidShareTotalError,
  DuplicateShareholderError,
  CashbackDeprecatedError,
  HolderRewardDisabledError,
} from "./errors";
import {
  buildAmmBreakingFeeRecipientAccounts,
  getBuybackFeeRecipientForTokenQuote,
  getFeeRecipient,
  getStaticRandomFeeRecipientForBuyback,
  pickBreakingFeeRecipient,
} from "./fees";
import type { Pump } from "./idl/pump";
import pumpIdl from "./idl/pump.json";
import type { PumpAmm } from "./idl/pump_amm";
import PumpAmmIdl from "./idl/pump_amm.json";
import type { PumpFees } from "./idl/pump_fees";
import PumpFeesIdl from "./idl/pump_fees.json";
import { OFFLINE_PUMP_PROGRAM } from "./onlineSdk";
import {
  AMM_FEE_CONFIG_PDA,
  AMM_GLOBAL_CONFIG_PDA,
  AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA,
  ammCreatorVaultPda,
  bondingCurvePda,
  canonicalPumpPoolPda,
  canonicalPumpPoolPdaWithQuote,
  creatorVaultPda,
  GLOBAL_PDA,
  isLegacyQuoteMint,
  normalizeQuoteMint,
  PUMP_EVENT_AUTHORITY_PDA,
  PUMP_FEE_CONFIG_PDA,
  QUOTE_CONTROL_PDA,
  quoteAta,
  holderRewardsPda,
  getGlobalParamsPda,
  getMayhemStatePda,
  getSolVaultPda,
  getTokenVaultPda,
  pumpPoolAuthorityPda,
  PUMP_AMM_EVENT_AUTHORITY_PDA,
  feeSharingConfigPda,
  userVolumeAccumulatorPda,
  ammUserVolumeAccumulatorPda,
  socialFeePda as socialFeePdaHelper,
  bondingCurveV2Pda,
  poolV2Pda,
} from "./pda";
import type {
  BondingCurve,
  FeeConfig,
  Global,
  GlobalVolumeAccumulator,
  UserVolumeAccumulator,
  Shareholder,
  SharingConfig,
  Pool,
  AmmGlobalConfig,
  FeeProgramGlobal,
  SocialFeePda as SocialFeePdaAccount,
  DistributeCreatorFeesEvent,
  MinimumDistributableFeeEvent,
  TradeEvent,
  CreateEvent,
  CompleteEvent,
  CompletePumpAmmMigrationEvent,
  SetCreatorEvent,
  CollectCreatorFeeEvent,
  ClaimTokenIncentivesEvent,
  ClaimCashbackEvent,
  ExtendAccountEvent,
  InitUserVolumeAccumulatorEvent,
  SyncUserVolumeAccumulatorEvent,
  CloseUserVolumeAccumulatorEvent,
  AdminCtoEvent,
  DistributeFeeToHoldersEvent,
  MigrateBondingCurveCreatorEvent,
  AmmBuyEvent,
  AmmSellEvent,
  DepositEvent,
  WithdrawEvent,
  CreatePoolEvent,
  CreateFeeSharingConfigEvent,
  UpdateFeeSharesEvent,
  ResetFeeSharingConfigEvent,
  SocialFeePdaCreatedEvent,
  SocialFeePdaClaimedEvent,
  PostCompleteBuyEvent,
  QuoteControl,
  SweepBondingCurveFeeEvent,
  SweepPoolFeeEvent,
  AmmAdminUpdateTokenIncentivesEvent,
  AmmClaimCashbackEvent,
  AmmClaimTokenIncentivesEvent,
  AmmCloseUserVolumeAccumulatorEvent,
  AmmCollectCoinCreatorFeeEvent,
  AmmCreateConfigEvent,
  AmmDisableEvent,
  AmmExtendAccountEvent,
  AmmInitUserVolumeAccumulatorEvent,
  AmmMigratePoolCoinCreatorEvent,
  AmmReservedFeeRecipientsEvent,
  AmmSetBondingCurveCoinCreatorEvent,
  AmmSetMetaplexCoinCreatorEvent,
  AmmSyncUserVolumeAccumulatorEvent,
  AmmUpdateAdminEvent,
  AmmUpdateFeeConfigEvent,
  FeesInitializeFeeConfigEvent,
  FeesInitializeFeeProgramGlobalEvent,
  FeesSetAuthorityEvent,
  FeesSetClaimRateLimitEvent,
  FeesSetDisableFlagsEvent,
  FeesSetSocialClaimAuthorityEvent,
  FeesUpdateAdminEvent,
  FeesUpdateFeeConfigEvent,
  FeesUpsertFeeTiersEvent,
  Platform} from "./state";
import {
  SUPPORTED_SOCIAL_PLATFORMS,
  platformToString,
} from "./state";

/** Create an Anchor Program instance for the Pump bonding curve program. */
export function getPumpProgram(connection: Connection): Program<Pump> {
  return new Program(
    pumpIdl as Pump,
    new AnchorProvider(connection, null as any, {}),
  );
}

import {
  MAYHEM_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
  PUMP_PROGRAM_ID,
} from "./programIds";
export { MAYHEM_PROGRAM_ID, PUMP_AMM_PROGRAM_ID, PUMP_FEE_PROGRAM_ID, PUMP_PROGRAM_ID };

/** Create an Anchor Program instance for the PumpAMM graduated pool program. */
export function getPumpAmmProgram(connection: Connection): Program<PumpAmm> {
  return new Program(
    PumpAmmIdl as PumpAmm,
    new AnchorProvider(connection, null as any, {}),
  );
}

/** Create an Anchor Program instance for the PumpFees fee-sharing program. */
export function getPumpFeeProgram(connection: Connection): Program<PumpFees> {
  return new Program(
    PumpFeesIdl as PumpFees,
    new AnchorProvider(connection, null as any, {}),
  );
}

/**
 * pump `BondingCurve::NEW_SIZE`: what `extend_account` grows a curve to. Since
 * the October 2026 upgrade every trade and sweep grows a shorter curve on its
 * own, so the builders no longer prepend `extend_account`.
 */
export const BONDING_CURVE_NEW_SIZE = 166;

/** PUMP token mint address used for token incentive rewards. */
export const PUMP_TOKEN_MINT = new PublicKey(
  "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
);

/** Maximum number of shareholders allowed in a fee-sharing config. */
export const MAX_SHAREHOLDERS = 10;

/** pump-amm `Pool` serialized length with every field the bundled IDL declares. */
export const POOL_SIZE = 287;

/** pump-amm `GlobalConfig` serialized length with every field the bundled IDL declares. */
export const AMM_GLOBAL_CONFIG_SIZE = 949;

/**
 * pump `BondingCurve::SIZE`: the full serialized length, discriminator
 * included. Every older layout is a prefix of this one and the program reads
 * the fields a shorter curve lacks at their defaults (zero, `false`, the zero
 * key), which is exactly what zero-padding to this length yields.
 */
export const BONDING_CURVE_SIZE = 166;

/**
 * The shortest `BondingCurve` layout the program ever wrote
 * (`BondingCurve::INITIALIZE_SIZE`); its reader rejects anything shorter.
 */
export const BONDING_CURVE_INITIALIZE_SIZE = 49;

/**
 * pump `Global::SIZE` with every field the bundled IDL declares. A live
 * account written before `max_curve_depth` existed is shorter; zero-padding
 * it reads the missing fields at the program's defaults.
 */
export const GLOBAL_SIZE = 1088;

/**
 * `FeeConfig` account lengths (pump-fees `FeeConfig::{INITIALIZE_SIZE,
 * POST_STABLE_SIZE, CURRENT_SIZE}`). The program selects the layout version
 * from the account length: each version is a prefix of the next and the
 * fields a version lacks read as their defaults.
 */
export const FEE_CONFIG_INITIALIZE_SIZE = 2512;
export const FEE_CONFIG_POST_STABLE_SIZE = 4073;
export const FEE_CONFIG_CURRENT_SIZE = 4097;

// `FeeConfig` borsh layout: discriminator (8) + bump (1) + admin (32) +
// flat_fees (24), then `fee_tiers` and `stable_fee_tiers` (u32 length prefix
// plus 40-byte tiers each), then `exotic_flat_fees` (24).
const FEE_CONFIG_FEE_TIERS_OFFSET = 8 + 1 + 32 + 24;
const FEE_TIER_LEN = 16 + 24;
const FEES_LEN = 24;
const VEC_LEN_PREFIX = 4;
// pump-fees `MAX_FEE_TIERS_SUPPORTED`: no upsert ever writes a longer vector.
const MAX_FEE_TIERS_SUPPORTED = 50;

// `QuoteControl` borsh layout: discriminator (8) + admin (32) +
// reserves_admin (32) + _reserved (32) + the `mints` length prefix (4), then
// 40-byte entries (mint + u64 initial_virtual_quote_reserves).
const QUOTE_CONTROL_HEADER_LEN = 8 + 32 + 32 + 32 + VEC_LEN_PREFIX;
const QUOTE_CONTROL_LEN_OFFSET = QUOTE_CONTROL_HEADER_LEN - VEC_LEN_PREFIX;
const QUOTE_CONTROL_ENTRY_LEN = 32 + 8;

// How many zero bytes make an older event layout decode under the bundled
// one, tried shortest first. Events only ever gain trailing fields, each
// defaulting to zero or `false`.
//
// pump `TradeEvent`: none; 8 (no `creator_fee_unclaimed`); 24 (no
// `holder_rewards_bps` / `holder_rewards` either); 80 (no quote fields
// either: quote_mint, quote_amount, virtual and real quote reserves); 100 (no
// buyback fields or `shareholders` either); 116 (no cashback fields either).
const TRADE_EVENT_LAYOUT_PADDINGS: readonly number[] = [0, 8, 24, 80, 100, 116];
// pump-amm `BuyEvent` / `SellEvent`: none; 8 (no `creator_fee_unclaimed`);
// 24 (no holder-reward fields); 32 (no `base_supply`); 33 (no `can_boost`);
// 49 (no signed `virtual_quote_reserves` either, every pre-v2 event).
const AMM_TRADE_EVENT_LAYOUT_PADDINGS: readonly number[] = [
  0, 8, 24, 32, 33, 49,
];
// pump `CreateEvent`: none; 1 (no `depth`); 2 (no `is_holder_reward`); 10
// (no `creator_fee_bps` either).
const CREATE_EVENT_LAYOUT_PADDINGS: readonly number[] = [0, 1, 2, 10];
// pump-amm `CreatePoolEvent`: none; 1 (no `is_holder_reward`); 10 (no
// `creator_fee_bps` / `can_edit_creator_fee` either).
const CREATE_POOL_EVENT_LAYOUT_PADDINGS: readonly number[] = [0, 1, 10];

/** `data` zero-padded to `size` bytes, or `data` itself when long enough. */
function zeroPadded(data: Buffer, size: number): Buffer {
  return data.length >= size
    ? data
    : Buffer.concat([data, Buffer.alloc(size - data.length)]);
}

// Checked by name rather than `instanceof`: the error is raised in the
// buffer's realm, which is not ours under jest or a vm context.
function isRangeError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "RangeError"
  );
}

/**
 * Decodes an event whose layout has only ever gained trailing fields: tries
 * `decode` with each of `paddings` zero bytes appended, shortest first,
 * until the borsh coder stops running out of bytes. Anything but a
 * RangeError is rethrown at once; when every padding runs out the event is
 * truncated inside a field and the last RangeError is thrown.
 */
function decodeWithTrailingDefaults<T>(
  data: Buffer,
  paddings: readonly number[],
  decode: (bytes: Buffer) => T,
): T {
  let rangeError: unknown;
  for (const padding of paddings) {
    try {
      return decode(
        padding === 0 ? data : Buffer.concat([data, Buffer.alloc(padding)]),
      );
    } catch (error) {
      if (!isRangeError(error)) {
        throw error;
      }
      rangeError = error;
    }
  }
  throw rangeError;
}

/**
 * End offset of the `Vec<FeeTier>` whose length prefix sits at `offset`.
 * Rejects a vector the program could not have written (longer than
 * `MAX_FEE_TIERS_SUPPORTED` or running past the data), which would otherwise
 * make the borsh coder allocate until the process dies.
 */
function feeTierVecEnd(data: Buffer, offset: number): number {
  const count = data.readUInt32LE(offset);
  const end = offset + VEC_LEN_PREFIX + count * FEE_TIER_LEN;
  if (count > MAX_FEE_TIERS_SUPPORTED || end > data.length) {
    throw new Error(
      `Invalid FeeConfig account: ${count} fee tiers declared at offset ${offset} in ${data.length} bytes`,
    );
  }
  return end;
}

/**
 * The extra `create_v2` accounts that admit a pump coin Q as the quote mint
 * when Q is listed neither on `Global` nor in `QuoteControl`: Q's bonding
 * curve is always sent, and once Q's curve has migrated its canonical
 * PumpAMM pool and the pool's two vaults price it.
 * `OnlinePumpSdk.fetchPumpQuote` resolves them.
 */
export interface PumpQuoteAccounts {
  pool?: { pool: PublicKey; baseVault: PublicKey; quoteVault: PublicKey };
}

/**
 * The `create_v2` remaining accounts that select a non-SOL quote, in the
 * program's positional order: the quote mint, the bonding curve's quote ATA
 * (the program creates it), the quote token program and the `QuoteControl`
 * PDA, then the pump-coin quote accounts when `pumpQuote` is set.
 */
export function createV2QuoteRemainingAccounts({
  mint,
  quoteMint,
  quoteTokenProgram = TOKEN_PROGRAM_ID,
  pumpQuote,
}: {
  mint: PublicKey;
  quoteMint: PublicKey;
  quoteTokenProgram?: PublicKey;
  pumpQuote?: PumpQuoteAccounts;
}): AccountMeta[] {
  const readonly = (pubkey: PublicKey): AccountMeta => ({
    pubkey,
    isWritable: false,
    isSigner: false,
  });
  const pumpQuoteAccounts = pumpQuote
    ? [
        readonly(bondingCurvePda(quoteMint)),
        ...(pumpQuote.pool
          ? [
              readonly(pumpQuote.pool.pool),
              readonly(pumpQuote.pool.baseVault),
              readonly(pumpQuote.pool.quoteVault),
            ]
          : []),
      ]
    : [];
  return [
    readonly(quoteMint),
    {
      pubkey: quoteAta(bondingCurvePda(mint), quoteMint, quoteTokenProgram),
      isWritable: true,
      isSigner: false,
    },
    readonly(quoteTokenProgram),
    readonly(QUOTE_CONTROL_PDA),
    ...pumpQuoteAccounts,
  ];
}

/**
 * The named accounts `buy_v3`, `buy_exact_quote_in_v3` and `sell_v3` share;
 * Anchor resolves the rest (`global`, `bonding_curve`, `fee_config`,
 * `user_volume_accumulator`, ...). `quoteMint` may be the curve's stored
 * quote (the zero key is SOL).
 *
 * `buyback_fee_recipient` takes the buyback slice in the trade: on a SOL
 * curve a listed `Global.buybackFeeRecipients` wallet itself (random by
 * default), on a token quote that wallet's `quoteMint` ATA (the first listed
 * wallet by default). The program refuses anything else and never creates
 * the ATA.
 */
export function tradeV3Accounts({
  user,
  mint,
  tokenProgram = TOKEN_2022_PROGRAM_ID,
  quoteMint = NATIVE_MINT,
  quoteTokenProgram = TOKEN_PROGRAM_ID,
  buybackFeeRecipient,
}: {
  user: PublicKey;
  mint: PublicKey;
  tokenProgram?: PublicKey;
  quoteMint?: PublicKey;
  quoteTokenProgram?: PublicKey;
  buybackFeeRecipient?: PublicKey;
}) {
  const quote = normalizeQuoteMint(quoteMint);
  const bondingCurve = bondingCurvePda(mint);
  return {
    baseMint: mint,
    quoteMint: quote,
    baseTokenProgram: tokenProgram,
    quoteTokenProgram,
    associatedBaseBondingCurve: getAssociatedTokenAddressSync(
      mint,
      bondingCurve,
      true,
      tokenProgram,
    ),
    associatedQuoteBondingCurve: quoteAta(
      bondingCurve,
      quote,
      quoteTokenProgram,
    ),
    user,
    associatedBaseUser: getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      tokenProgram,
    ),
    associatedQuoteUser: quoteAta(user, quote, quoteTokenProgram),
    buybackFeeRecipient: isLegacyQuoteMint(quote)
      ? (buybackFeeRecipient ?? getStaticRandomFeeRecipientForBuyback())
      : quoteAta(
          buybackFeeRecipient ?? getBuybackFeeRecipientForTokenQuote(),
          quote,
          quoteTokenProgram,
        ),
  };
}

/**
 * The named accounts `buy_v2`, `buy_exact_quote_in_v2` and `sell_v2` share;
 * Anchor resolves the rest (`global`, `bonding_curve`, `sharing_config`,
 * `user_volume_accumulator`, `fee_config`, ...). `quoteMint` may be the
 * curve's stored quote (the zero key is SOL).
 *
 * Unlike v3, a v2 trade pays the protocol and creator fees out in the trade,
 * so it names the fee recipient, the creator vault (from the curve's
 * `creator`) and their quote ATAs. The program creates the fee recipient's,
 * the creator vault's and the volume accumulator's ATAs when missing, but
 * never the buyback recipient's.
 *
 * @param params.feeRecipient - One of `Global.feeRecipients` (random by
 *   default); a mayhem coin needs one of `Global.reservedFeeRecipients`
 *   (`getFeeRecipient(global, true)`).
 * @param params.buybackFeeRecipient - A listed `Global.buybackFeeRecipients`
 *   wallet: random by default on a SOL curve, the first listed wallet on a
 *   token quote (whose ATA must exist).
 */
export function tradeV2Accounts({
  user,
  mint,
  creator,
  tokenProgram = TOKEN_2022_PROGRAM_ID,
  quoteMint = NATIVE_MINT,
  quoteTokenProgram = TOKEN_PROGRAM_ID,
  feeRecipient = getStaticRandomFeeRecipient(),
  buybackFeeRecipient,
}: {
  user: PublicKey;
  mint: PublicKey;
  creator: PublicKey;
  tokenProgram?: PublicKey;
  quoteMint?: PublicKey;
  quoteTokenProgram?: PublicKey;
  feeRecipient?: PublicKey;
  buybackFeeRecipient?: PublicKey;
}) {
  const quote = normalizeQuoteMint(quoteMint);
  const bondingCurve = bondingCurvePda(mint);
  const creatorVault = creatorVaultPda(creator);
  const buyback =
    buybackFeeRecipient ??
    (isLegacyQuoteMint(quote)
      ? getStaticRandomFeeRecipientForBuyback()
      : getBuybackFeeRecipientForTokenQuote());
  return {
    baseMint: mint,
    quoteMint: quote,
    baseTokenProgram: tokenProgram,
    quoteTokenProgram,
    feeRecipient,
    associatedQuoteFeeRecipient: quoteAta(
      feeRecipient,
      quote,
      quoteTokenProgram,
    ),
    buybackFeeRecipient: buyback,
    associatedQuoteBuybackFeeRecipient: quoteAta(
      buyback,
      quote,
      quoteTokenProgram,
    ),
    associatedBaseBondingCurve: getAssociatedTokenAddressSync(
      mint,
      bondingCurve,
      true,
      tokenProgram,
    ),
    associatedQuoteBondingCurve: quoteAta(
      bondingCurve,
      quote,
      quoteTokenProgram,
    ),
    user,
    associatedBaseUser: getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      tokenProgram,
    ),
    associatedQuoteUser: quoteAta(user, quote, quoteTokenProgram),
    creatorVault,
    associatedCreatorVault: quoteAta(creatorVault, quote, quoteTokenProgram),
    associatedUserVolumeAccumulator: quoteAta(
      userVolumeAccumulatorPda(user),
      quote,
      quoteTokenProgram,
    ),
  };
}

/**
 * An idempotent create of the buyback recipient's quote ATA that a
 * token-quoted v3 trade or a multi-hop route pays its buyback slice into (the
 * programs refuse a missing one and never create it). None for a v3 trade on
 * a SOL curve, which pays the wallet itself; a route always pays an ATA (WSOL
 * for SOL), so `route` keeps it.
 */
function buybackAtaInstructions(
  payer: PublicKey,
  quoteMint: PublicKey,
  quoteTokenProgram: PublicKey,
  buybackFeeRecipient?: PublicKey,
  route = false,
): TransactionInstruction[] {
  const quote = normalizeQuoteMint(quoteMint);
  if (isLegacyQuoteMint(quote) && !route) {
    return [];
  }
  const recipient =
    buybackFeeRecipient ?? getBuybackFeeRecipientForTokenQuote();
  return [
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      quoteAta(recipient, quote, quoteTokenProgram),
      recipient,
      quote,
      quoteTokenProgram,
    ),
  ];
}

/**
 * `amount` raised by `slippage` percent, in the 0.1% steps the v3 builders
 * use (a buy's maximum cost).
 */
function plusSlippage(amount: BN, slippage: number): BN {
  return amount.add(
    amount.mul(new BN(Math.floor(slippage * 10))).div(new BN(1000)),
  );
}

/**
 * `amount` lowered by `slippage` percent, never below `floor` (a buy's
 * `min_tokens_out` must be at least 1, a sell's minimum may be 0).
 */
function lessSlippage(amount: BN, slippage: number, floor = 0): BN {
  return BN.max(
    amount.sub(amount.mul(new BN(Math.floor(slippage * 10))).div(new BN(1000))),
    new BN(floor),
  );
}

/**
 * The accounts pump `sweep_protocol_fee` and `sweep_creator_fee` share.
 * `quoteMint` may be the curve's stored quote (the zero key is SOL).
 */
function sweepBondingCurveFeeAccounts({
  payer,
  mint,
  recipient,
  quoteMint,
  quoteTokenProgram,
}: {
  payer: PublicKey;
  mint: PublicKey;
  recipient: PublicKey;
  quoteMint: PublicKey;
  quoteTokenProgram: PublicKey;
}) {
  const quote = normalizeQuoteMint(quoteMint);
  return {
    payer,
    baseMint: mint,
    quoteMint: quote,
    quoteTokenProgram,
    associatedQuoteBondingCurve: quoteAta(
      bondingCurvePda(mint),
      quote,
      quoteTokenProgram,
    ),
    recipient,
    associatedQuoteRecipient: quoteAta(recipient, quote, quoteTokenProgram),
    eventAuthority: PUMP_EVENT_AUTHORITY_PDA,
    program: PUMP_PROGRAM_ID,
  };
}

/**
 * One hop of a PumpAMM `multi_hop_swap` route: a coin (`baseMint`) traded
 * against its quote (`quoteMint`) on its canonical PumpAMM pool or on its
 * pump bonding curve. SOL is WSOL in a route (the zero key a SOL curve stores
 * is read as WSOL under SPL Token).
 */
export interface MultiHopHop {
  venue: "pool" | "curve";
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseTokenProgram: PublicKey;
  quoteTokenProgram: PublicKey;
}

/**
 * A route's direction: `buy` walks a quote chain up (each hop buys a coin
 * quoted in the previous hop's coin), `sell` walks it down. Every hop of a
 * route trades the same way.
 */
export type MultiHopSide = "buy" | "sell";

/**
 * A pump `multi_hop_curve_swap` read by `decodeMultiHopCurveSwapInstruction`:
 * the curve leg PumpSwap's `multi_hop_swap` runs by CPI.
 */
export interface MultiHopCurveSwapCall {
  amountIn: BN;
  /** The program's opaque per-hop fee plan. */
  hopFees: Buffer;
  user: PublicKey;
  sourceAuthority: PublicKey;
  source: PublicKey;
  destination: PublicKey;
  buybackFeeRecipient: PublicKey;
  /** The route accounts PumpSwap passes after the 13 named ones. */
  remainingAccounts: AccountMeta[];
}

/** A mint and the token program that owns it. */
export interface MintWithProgram {
  mint: PublicKey;
  tokenProgram: PublicKey;
}

function normalizeHopSide(
  mint: PublicKey,
  tokenProgram: PublicKey,
): MintWithProgram {
  return isLegacyQuoteMint(mint)
    ? { mint: NATIVE_MINT, tokenProgram: TOKEN_PROGRAM_ID }
    : { mint, tokenProgram };
}

function normalizeHop(hop: MultiHopHop): MultiHopHop {
  const base = normalizeHopSide(hop.baseMint, hop.baseTokenProgram);
  const quote = normalizeHopSide(hop.quoteMint, hop.quoteTokenProgram);
  return {
    venue: hop.venue,
    baseMint: base.mint,
    baseTokenProgram: base.tokenProgram,
    quoteMint: quote.mint,
    quoteTokenProgram: quote.tokenProgram,
  };
}

/**
 * The mints a route starts and ends in, after checking that the hops chain
 * (pump-amm 6084 `MultiHopDiscontinuousPath` otherwise). SOL may be given as
 * WSOL or as the zero key; it comes back as WSOL. `currency` is the side the
 * protocol leg trades (first hop of a buy, last of a sell): the user's
 * currency, whose ATA of the buyback recipient takes the buyback slice.
 *
 * @throws {MultiHopDiscontinuousPathError} when a hop does not continue from
 *   the one before it.
 */
export function multiHopRouteEnds(
  rawHops: readonly MultiHopHop[],
  side: MultiHopSide,
): {
  input: MintWithProgram;
  output: MintWithProgram;
  currency: MintWithProgram;
} {
  const hops = rawHops.map(normalizeHop);
  const first = hops[0];
  const last = hops[hops.length - 1];
  if (!first || !last) {
    throw new Error("multi_hop_swap: a route needs at least one hop");
  }
  const isBuy = side === "buy";
  hops.forEach((hop, index) => {
    const next = hops[index + 1];
    if (!next) {
      return;
    }
    const expected = isBuy ? hop.baseMint : hop.quoteMint;
    const actual = isBuy ? next.quoteMint : next.baseMint;
    if (!actual.equals(expected)) {
      throw new MultiHopDiscontinuousPathError(index + 1, expected, actual);
    }
  });
  const input = isBuy
    ? { mint: first.quoteMint, tokenProgram: first.quoteTokenProgram }
    : { mint: first.baseMint, tokenProgram: first.baseTokenProgram };
  const output = isBuy
    ? { mint: last.baseMint, tokenProgram: last.baseTokenProgram }
    : { mint: last.quoteMint, tokenProgram: last.quoteTokenProgram };
  return { input, output, currency: isBuy ? input : output };
}

/**
 * One hop's 5-account group, in program order: base mint, quote mint, venue
 * (pool or bonding curve), base vault, quote vault. Canonical pools and
 * curves hold their vaults at their ATAs.
 */
export function multiHopHopAccounts(rawHop: MultiHopHop): AccountMeta[] {
  const hop = normalizeHop(rawHop);
  const venue =
    hop.venue === "pool"
      ? canonicalPumpPoolPdaWithQuote(hop.baseMint, hop.quoteMint)
      : bondingCurvePda(hop.baseMint);
  const writable = (pubkey: PublicKey): AccountMeta => ({
    pubkey,
    isWritable: true,
    isSigner: false,
  });
  return [
    { pubkey: hop.baseMint, isWritable: false, isSigner: false },
    { pubkey: hop.quoteMint, isWritable: false, isSigner: false },
    writable(venue),
    writable(quoteAta(venue, hop.baseMint, hop.baseTokenProgram)),
    writable(quoteAta(venue, hop.quoteMint, hop.quoteTokenProgram)),
  ];
}

/**
 * The accounts pump-amm `sweep_protocol_fee` and `sweep_creator_fee` share,
 * for `mint`'s canonical pool quoted in `quoteMint`.
 */
function sweepPoolFeeAccounts({
  payer,
  mint,
  recipient,
  quoteMint,
  quoteTokenProgram,
}: {
  payer: PublicKey;
  mint: PublicKey;
  recipient: PublicKey;
  quoteMint: PublicKey;
  quoteTokenProgram: PublicKey;
}) {
  const quote = normalizeQuoteMint(quoteMint);
  const pool = canonicalPumpPoolPdaWithQuote(mint, quote);
  return {
    payer,
    globalConfig: AMM_GLOBAL_CONFIG_PDA,
    pool,
    quoteMint: quote,
    quoteTokenProgram,
    poolQuoteTokenAccount: quoteAta(pool, quote, quoteTokenProgram),
    recipient,
    recipientTokenAccount: quoteAta(recipient, quote, quoteTokenProgram),
    eventAuthority: PUMP_AMM_EVENT_AUTHORITY_PDA,
    program: PUMP_AMM_PROGRAM_ID,
  };
}

/**
 * The 17 accounts PumpSwap `buy_v2`, `sell_v2` and `buy_exact_quote_in_v2`
 * share. Unlike v1 there is no protocol fee recipient, creator vault or
 * remaining accounts: the protocol and creator fees stay in the pool
 * (`Pool.protocolFees` / `creatorFees`) until `ammSweepProtocolFeeInstruction`
 * / `ammSweepCreatorFeeInstruction` pay them out, and only the buyback slice
 * leaves in the trade, into `buyback_fee_recipient`: the `quoteMint` ATA of a
 * listed `GlobalConfig.buybackFeeRecipients` wallet (random by default).
 */
export function ammTradeV2Accounts({
  user,
  pool,
  mint,
  quoteMint = NATIVE_MINT,
  baseTokenProgram = TOKEN_2022_PROGRAM_ID,
  quoteTokenProgram = TOKEN_PROGRAM_ID,
  buybackFeeRecipient,
}: {
  user: PublicKey;
  pool: PublicKey;
  mint: PublicKey;
  quoteMint?: PublicKey;
  baseTokenProgram?: PublicKey;
  quoteTokenProgram?: PublicKey;
  buybackFeeRecipient?: PublicKey;
}) {
  const quote = normalizeQuoteMint(quoteMint);
  return {
    pool,
    user,
    globalConfig: AMM_GLOBAL_CONFIG_PDA,
    baseMint: mint,
    quoteMint: quote,
    userBaseTokenAccount: getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      baseTokenProgram,
    ),
    userQuoteTokenAccount: quoteAta(user, quote, quoteTokenProgram),
    poolBaseTokenAccount: getAssociatedTokenAddressSync(
      mint,
      pool,
      true,
      baseTokenProgram,
    ),
    poolQuoteTokenAccount: quoteAta(pool, quote, quoteTokenProgram),
    baseTokenProgram,
    quoteTokenProgram,
    userVolumeAccumulator: ammUserVolumeAccumulatorPda(user),
    feeConfig: AMM_FEE_CONFIG_PDA,
    buybackFeeRecipient: quoteAta(
      buybackFeeRecipient ?? pickBreakingFeeRecipient(),
      quote,
      quoteTokenProgram,
    ),
    eventAuthority: PUMP_AMM_EVENT_AUTHORITY_PDA,
    program: PUMP_AMM_PROGRAM_ID,
  };
}

/**
 * Offline-first SDK for building Pump protocol transaction instructions.
 *
 * All methods return `TransactionInstruction[]` and require no RPC connection.
 * Use the pre-built singleton {@link PUMP_SDK} instead of constructing directly.
 */
export class PumpSdk {
  private lazyOfflinePumpProgram?: Program<Pump>;
  private readonly offlinePumpFeeProgram: Program<PumpFees>;
  private readonly offlinePumpAmmProgram: Program<PumpAmm>;

  constructor() {
    // Create offline programs for fee and AMM
    this.offlinePumpFeeProgram = new Program(
      PumpFeesIdl as PumpFees,
      new AnchorProvider(null as any, null as any, {}),
    );
    this.offlinePumpAmmProgram = new Program(
      PumpAmmIdl as PumpAmm,
      new AnchorProvider(null as any, null as any, {}),
    );
  }

  /**
   * The shared offline Pump program, read lazily. sdk.ts and onlineSdk.ts
   * form an import cycle, so OFFLINE_PUMP_PROGRAM (defined in onlineSdk.ts)
   * is still undefined while this module initializes under some import
   * orders. Capturing it in the constructor therefore broke every
   * pump-program decode and instruction builder for consumers that
   * imported sdk before onlineSdk; reading it on first use is always safe
   * because module initialization has finished by then.
   */
  private get offlinePumpProgram(): Program<Pump> {
    if (!this.lazyOfflinePumpProgram) {
      this.lazyOfflinePumpProgram =
        OFFLINE_PUMP_PROGRAM ??
        new Program(pumpIdl as Pump, new AnchorProvider(null as any, null as any, {}));
    }
    return this.lazyOfflinePumpProgram;
  }

  /**
   * Decodes the pump `Global` account. A live account written before the
   * newest trailing fields (`max_curve_depth`, the creator-fee gate) is
   * shorter than `GLOBAL_SIZE`; it is zero-padded so those fields read as
   * the program's defaults.
   */
  decodeGlobal(accountInfo: AccountInfo<Buffer>): Global {
    return this.offlinePumpProgram.coder.accounts.decode<Global>(
      "global",
      zeroPadded(accountInfo.data, GLOBAL_SIZE),
    );
  }

  /**
   * Decodes a pump-fees `FeeConfig` the way the program does
   * (`FeeConfig::deserialize_versioned`): the account length selects the
   * layout version and the bytes after that version's last field are never
   * read. `stableFeeTiers` is empty below `FEE_CONFIG_POST_STABLE_SIZE` and
   * `exoticFlatFees` is all-zero (unset) below `FEE_CONFIG_CURRENT_SIZE`.
   * Throws on data shorter than `FEE_CONFIG_INITIALIZE_SIZE` or a tier
   * vector the program could not have written.
   */
  decodeFeeConfig(accountInfo: AccountInfo<Buffer>): FeeConfig {
    const { data } = accountInfo;
    if (data.length < FEE_CONFIG_INITIALIZE_SIZE) {
      throw new Error(
        `Invalid FeeConfig account: ${data.length} bytes, expected at least ${FEE_CONFIG_INITIALIZE_SIZE}`,
      );
    }
    const feeTiersEnd = feeTierVecEnd(data, FEE_CONFIG_FEE_TIERS_OFFSET);
    let readEnd = feeTiersEnd;
    if (data.length >= FEE_CONFIG_POST_STABLE_SIZE) {
      const stableFeeTiersEnd = feeTierVecEnd(data, feeTiersEnd);
      readEnd =
        data.length < FEE_CONFIG_CURRENT_SIZE
          ? stableFeeTiersEnd
          : stableFeeTiersEnd + FEES_LEN;
    }
    // Exactly the bytes the program reads, then zeros: a missing
    // `stable_fee_tiers` decodes as an empty vector and a missing
    // `exotic_flat_fees` as all-zero, the program's defaults.
    return this.offlinePumpProgram.coder.accounts.decode<FeeConfig>(
      "feeConfig",
      Buffer.concat([
        data.subarray(0, readEnd),
        Buffer.alloc(VEC_LEN_PREFIX + FEES_LEN),
      ]),
    );
  }

  /**
   * Decodes a `BondingCurve` of every length the program has written (49,
   * 81, 82, 83, 115, 124, 125, 141, the extended 151 and the current 166
   * bytes): every layout is a prefix of the next and the fields a shorter
   * curve lacks read as their defaults, so the data is zero-padded to
   * `BONDING_CURVE_SIZE`. Throws below the 49-byte initial layout, as the
   * program does.
   */
  decodeBondingCurve(accountInfo: AccountInfo<Buffer>): BondingCurve {
    const { data } = accountInfo;
    if (data.length < BONDING_CURVE_INITIALIZE_SIZE) {
      throw new Error(
        `Invalid BondingCurve account: ${data.length} bytes, expected at least ${BONDING_CURVE_INITIALIZE_SIZE}`,
      );
    }
    return this.offlinePumpProgram.coder.accounts.decode<BondingCurve>(
      "bondingCurve",
      zeroPadded(data, BONDING_CURVE_SIZE),
    );
  }

  decodeBondingCurveNullable(
    accountInfo: AccountInfo<Buffer>,
  ): BondingCurve | null {
    try {
      return this.decodeBondingCurve(accountInfo);
    } catch (error) {
      console.warn("Failed to decode bonding curve", error);
      return null;
    }
  }

  /**
   * Decodes the pump `QuoteControl` PDA (`QUOTE_CONTROL_PDA`): the mints
   * `create_v2` admits as quotes beyond those `Global` lists, each with the
   * virtual quote reserves a new curve quoted in it starts from. Like the
   * program's reader (6075 `InvalidQuoteControl`), the declared `mints`
   * length must fit in the data; the pre-allocated tail past it is ignored.
   */
  decodeQuoteControl(accountInfo: AccountInfo<Buffer>): QuoteControl {
    const { data } = accountInfo;
    if (data.length < QUOTE_CONTROL_HEADER_LEN) {
      throw new Error(
        `Invalid QuoteControl account: ${data.length} bytes, expected at least ${QUOTE_CONTROL_HEADER_LEN}`,
      );
    }
    const count = data.readUInt32LE(QUOTE_CONTROL_LEN_OFFSET);
    if (
      QUOTE_CONTROL_HEADER_LEN + count * QUOTE_CONTROL_ENTRY_LEN >
      data.length
    ) {
      throw new Error(
        `Invalid QuoteControl account: ${count} entries declared in ${data.length} bytes`,
      );
    }
    return this.offlinePumpProgram.coder.accounts.decode<QuoteControl>(
      "quoteControl",
      data,
    );
  }

  /**
   * `null` when the account is missing (the PDA is not initialized, which
   * the program treats as an empty list) or does not decode as a
   * `QuoteControl` (logged with `console.warn`).
   */
  decodeQuoteControlNullable(
    accountInfo: AccountInfo<Buffer> | null,
  ): QuoteControl | null {
    if (!accountInfo) {
      return null;
    }
    try {
      return this.decodeQuoteControl(accountInfo);
    } catch (error) {
      console.warn("Failed to decode quote control", error);
      return null;
    }
  }

  decodeGlobalVolumeAccumulator(
    accountInfo: AccountInfo<Buffer>,
  ): GlobalVolumeAccumulator {
    return this.offlinePumpProgram.coder.accounts.decode<GlobalVolumeAccumulator>(
      "globalVolumeAccumulator",
      accountInfo.data,
    );
  }

  decodeUserVolumeAccumulator(
    accountInfo: AccountInfo<Buffer>,
  ): UserVolumeAccumulator {
    return this.offlinePumpProgram.coder.accounts.decode<UserVolumeAccumulator>(
      "userVolumeAccumulator",
      accountInfo.data,
    );
  }

  decodeUserVolumeAccumulatorNullable(
    accountInfo: AccountInfo<Buffer>,
  ): UserVolumeAccumulator | null {
    try {
      return this.decodeUserVolumeAccumulator(accountInfo);
    } catch (error) {
      console.warn("Failed to decode user volume accumulator", error);
      return null;
    }
  }

  decodeSharingConfig(accountInfo: AccountInfo<Buffer>): SharingConfig {
    return this.offlinePumpFeeProgram.coder.accounts.decode<SharingConfig>(
      "sharingConfig",
      accountInfo.data,
    );
  }

  /**
   * Decodes a pump-amm `Pool`. Pools created before the v2 fee buckets and
   * configurable creator fees are shorter than `POOL_SIZE`; they are
   * zero-padded so the missing trailing fields (`virtualQuoteReserves`,
   * `creatorFeeBps`, `protocolFees`, `creatorFees`, ...) read as the
   * program's defaults.
   */
  decodePool(accountInfo: AccountInfo<Buffer>): Pool {
    return this.offlinePumpAmmProgram.coder.accounts.decode<Pool>(
      "pool",
      zeroPadded(accountInfo.data, POOL_SIZE),
    );
  }

  /**
   * Decodes the pump-amm `GlobalConfig`, zero-padded to
   * `AMM_GLOBAL_CONFIG_SIZE` so an account written before the boost and
   * creator-fee fields reads them at their defaults.
   */
  decodeAmmGlobalConfig(accountInfo: AccountInfo<Buffer>): AmmGlobalConfig {
    return this.offlinePumpAmmProgram.coder.accounts.decode<AmmGlobalConfig>(
      "globalConfig",
      zeroPadded(accountInfo.data, AMM_GLOBAL_CONFIG_SIZE),
    );
  }

  decodeFeeProgramGlobal(accountInfo: AccountInfo<Buffer>): FeeProgramGlobal {
    return this.offlinePumpFeeProgram.coder.accounts.decode<FeeProgramGlobal>(
      "feeProgramGlobal",
      accountInfo.data,
    );
  }

  decodeSocialFeePdaAccount(
    accountInfo: AccountInfo<Buffer>,
  ): SocialFeePdaAccount {
    return this.offlinePumpFeeProgram.coder.accounts.decode<SocialFeePdaAccount>(
      "socialFeePda",
      accountInfo.data,
    );
  }

  /**
   * @deprecated Use `createInstructionV2` instead.
   */
  async createInstruction({
    mint,
    name,
    symbol,
    uri,
    creator,
    user,
  }: {
    mint: PublicKey;
    name: string;
    symbol: string;
    uri: string;
    creator: PublicKey;
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .create(name, symbol, uri, creator)
      .accountsPartial({
        mint,
        user,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  /**
   * `create_v2`: launches a Token-2022 coin on a new bonding curve.
   *
   * @param params.quoteMint - The quote the curve trades in. Omitted, WSOL or
   *   the zero key launch a SOL curve. Any other mint appends the quote
   *   remaining accounts (`createV2QuoteRemainingAccounts`): it must be
   *   whitelisted on `Global`, listed in `QuoteControl`, or be a pump coin
   *   passed with `pumpQuote` (6063 `UnsupportedQuoteMint` otherwise).
   * @param params.quoteTokenProgram - The token program that owns
   *   `quoteMint` (`OnlinePumpSdk.fetchQuoteTokenProgram`). Ignored for SOL.
   * @param params.pumpQuote - Set when `quoteMint` is a pump coin listed
   *   nowhere (`OnlinePumpSdk.fetchPumpQuote`): appends its bonding curve
   *   and, once it migrated, its pool and vaults. The new curve seeds its
   *   reserves from the quote coin's live price, stores
   *   `depth = Q.depth + 1` (at most `Global.maxCurveDepth`, 6105
   *   `CurveDepthExceeded`) and cannot be mayhem mode.
   */
  async createV2Instruction({
    mint,
    name,
    symbol,
    uri,
    creator,
    user,
    mayhemMode,
    cashback = false,
    creatorFeeBps = new BN(0),
    holderReward = false,
    quoteMint,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
    pumpQuote,
  }: {
    mint: PublicKey;
    name: string;
    symbol: string;
    uri: string;
    creator: PublicKey;
    user: PublicKey;
    mayhemMode: boolean;
    cashback?: boolean;
    creatorFeeBps?: BN;
    holderReward?: boolean;
    quoteMint?: PublicKey;
    quoteTokenProgram?: PublicKey;
    pumpQuote?: PumpQuoteAccounts;
  }): Promise<TransactionInstruction> {
    if (cashback) throw new CashbackDeprecatedError();
    const remainingAccounts =
      quoteMint && !isLegacyQuoteMint(quoteMint)
        ? createV2QuoteRemainingAccounts({
            mint,
            quoteMint,
            quoteTokenProgram,
            pumpQuote,
          })
        : [];
    return await this.offlinePumpProgram.methods
      .createV2(
        name,
        symbol,
        uri,
        creator,
        mayhemMode,
        [false],
        [creatorFeeBps],
        [holderReward],
      )
      .accountsPartial({
        mint,
        user,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        mayhemProgramId: MAYHEM_PROGRAM_ID,
        globalParams: getGlobalParamsPda(),
        solVault: getSolVaultPda(),
        mayhemState: getMayhemStatePda(mint),
        mayhemTokenVault: getTokenVaultPda(mint),
      })
      .remainingAccounts(remainingAccounts)
      .instruction();
  }

  async buyInstructions({
    global,
    bondingCurve,
    associatedUserAccountInfo,
    mint,
    user,
    amount,
    solAmount,
    slippage,
    tokenProgram = TOKEN_PROGRAM_ID,
  }: {
    global: Global;
    /**
     * Kept for API compatibility. Since the October 2026 upgrade the program
     * grows an older curve account on its first new-style trade, so no
     * `extend_account` instruction is prepended any more.
     */
    bondingCurveAccountInfo: AccountInfo<Buffer>;
    bondingCurve: BondingCurve;
    associatedUserAccountInfo: AccountInfo<Buffer> | null;
    mint: PublicKey;
    user: PublicKey;
    amount: BN;
    solAmount: BN;
    slippage: number;
    tokenProgram: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    const associatedUser = getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      tokenProgram,
    );

    if (!associatedUserAccountInfo) {
      instructions.push(
        createAssociatedTokenAccountIdempotentInstruction(
          user,
          associatedUser,
          user,
          mint,
          tokenProgram,
        ),
      );
    }

    instructions.push(
      await this.buyInstruction({
        global,
        mint,
        creator: bondingCurve.creator,
        user,
        associatedUser,
        amount,
        solAmount,
        slippage,
        tokenProgram,
        mayhemMode: bondingCurve.isMayhemMode,
      }),
    );

    return instructions;
  }

  async createV2AndBuyInstructions({
    global,
    mint,
    name,
    symbol,
    uri,
    creator,
    user,
    amount,
    solAmount,
    mayhemMode,
    cashback = false,
    creatorFeeBps = new BN(0),
    holderReward = false,
    quoteMint,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
    pumpQuote,
  }: {
    global: Global;
    mint: PublicKey;
    name: string;
    symbol: string;
    uri: string;
    creator: PublicKey;
    user: PublicKey;
    amount: BN;
    solAmount: BN;
    mayhemMode: boolean;
    cashback?: boolean;
    creatorFeeBps?: BN;
    holderReward?: boolean;
    quoteMint?: PublicKey;
    quoteTokenProgram?: PublicKey;
    pumpQuote?: PumpQuoteAccounts;
  }): Promise<TransactionInstruction[]> {
    if (cashback) throw new CashbackDeprecatedError();
    if (holderReward && !global.isHolderRewardEnabled) {
      throw new HolderRewardDisabledError();
    }
    const launchCreator = holderReward ? holderRewardsPda(mint) : creator;
    const associatedUser = getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      TOKEN_2022_PROGRAM_ID,
    );
    const create = await this.createV2Instruction({
      mint,
      name,
      symbol,
      uri,
      creator,
      user,
      mayhemMode,
      cashback,
      creatorFeeBps,
      holderReward,
      quoteMint,
      quoteTokenProgram,
      pumpQuote,
    });

    // A token-quoted curve trades only through the v3 instructions: the
    // first buy spends `solAmount` of the quote token plus 1% slippage.
    if (quoteMint && !isLegacyQuoteMint(quoteMint)) {
      return [
        create,
        createAssociatedTokenAccountIdempotentInstruction(
          user,
          associatedUser,
          user,
          mint,
          TOKEN_2022_PROGRAM_ID,
        ),
        ...buybackAtaInstructions(user, quoteMint, quoteTokenProgram),
        await this.getBuyV3InstructionRaw({
          user,
          mint,
          amount,
          quoteAmount: plusSlippage(solAmount, 1),
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          quoteMint,
          quoteTokenProgram,
        }),
      ];
    }

    return [
      create,
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        associatedUser,
        user,
        mint,
        TOKEN_2022_PROGRAM_ID,
      ),
      await this.buyInstruction({
        global,
        mint,
        creator: launchCreator,
        user,
        associatedUser,
        amount,
        solAmount,
        slippage: 1,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        mayhemMode,
      }),
    ];
  }

  /**
   * @deprecated Use `createV2AndBuyInstructions` instead.
   */
  async createAndBuyInstructions({
    global,
    mint,
    name,
    symbol,
    uri,
    creator,
    user,
    amount,
    solAmount,
  }: {
    global: Global;
    mint: PublicKey;
    name: string;
    symbol: string;
    uri: string;
    creator: PublicKey;
    user: PublicKey;
    amount: BN;
    solAmount: BN;
  }): Promise<TransactionInstruction[]> {
    const associatedUser = getAssociatedTokenAddressSync(mint, user, true);
    return [
      await this.createInstruction({ mint, name, symbol, uri, creator, user }),
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        associatedUser,
        user,
        mint,
      ),
      await this.buyInstruction({
        global,
        mint,
        creator,
        user,
        associatedUser,
        amount,
        solAmount,
        slippage: 1,
        tokenProgram: TOKEN_PROGRAM_ID,
        mayhemMode: false,
      }),
    ];
  }

  private async buyInstruction({
    global,
    mint,
    creator,
    user,
    associatedUser,
    amount,
    solAmount,
    slippage,
    tokenProgram = TOKEN_PROGRAM_ID,
    mayhemMode = false,
  }: {
    global: Global;
    mint: PublicKey;
    creator: PublicKey;
    user: PublicKey;
    associatedUser: PublicKey;
    amount: BN;
    solAmount: BN;
    slippage: number;
    tokenProgram: PublicKey;
    mayhemMode: boolean;
  }) {
    return await this.getBuyInstructionInternal({
      user,
      associatedUser,
      mint,
      creator,
      feeRecipient: getFeeRecipient(global, mayhemMode),
      amount,
      solAmount: solAmount.add(
        solAmount.mul(new BN(Math.round(slippage * 100))).div(new BN(10000)),
      ),
      tokenProgram,
    });
  }

  async sellInstructions({
    global,
    bondingCurve,
    mint,
    user,
    amount,
    solAmount,
    slippage,
    tokenProgram = TOKEN_PROGRAM_ID,
    cashback = false,
  }: {
    global: Global;
    /**
     * Kept for API compatibility. Since the October 2026 upgrade the program
     * grows an older curve account on its first new-style trade, so no
     * `extend_account` instruction is prepended any more.
     */
    bondingCurveAccountInfo: AccountInfo<Buffer>;
    bondingCurve: BondingCurve;
    mint: PublicKey;
    user: PublicKey;
    amount: BN;
    solAmount: BN;
    slippage: number;
    tokenProgram: PublicKey;
    cashback?: boolean;
  }): Promise<TransactionInstruction[]> {
    // Pre-flight: fail fast (with a descriptive error) when the amount would
    // overflow the on-chain u64 multiply. Prevents broadcasting a sell that
    // moves tokens via TransferChecked before the bonding-curve math aborts.
    validateSellAmount(amount, bondingCurve);

    const instructions: TransactionInstruction[] = [];

    instructions.push(
      await this.getSellInstructionInternal({
        user,
        mint,
        creator: bondingCurve.creator,
        feeRecipient: getFeeRecipient(global, bondingCurve.isMayhemMode),
        amount,
        solAmount: BN.max(
          new BN(0),
          solAmount.sub(
            solAmount.mul(new BN(Math.round(slippage * 100))).div(new BN(10000)),
          ),
        ),
        tokenProgram,
        cashback,
      }),
    );

    return instructions;
  }

  async extendAccountInstruction({
    account,
    user,
  }: {
    account: PublicKey;
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return this.offlinePumpProgram.methods
      .extendAccount()
      .accountsPartial({
        account,
        user,
      })
      .instruction();
  }

  async migrateInstruction({
    withdrawAuthority,
    mint,
    user,
    tokenProgram = TOKEN_PROGRAM_ID,
  }: {
    withdrawAuthority: PublicKey;
    mint: PublicKey;
    user: PublicKey;
    tokenProgram: PublicKey;
  }): Promise<TransactionInstruction> {
    const bondingCurve = bondingCurvePda(mint);
    const associatedBondingCurve = getAssociatedTokenAddressSync(
      mint,
      bondingCurve,
      true,
      tokenProgram,
    );

    const poolAuthority = pumpPoolAuthorityPda(mint);
    const poolAuthorityMintAccount = getAssociatedTokenAddressSync(
      mint,
      poolAuthority,
      true,
      tokenProgram,
    );

    const pool = canonicalPumpPoolPda(mint);
    const poolBaseTokenAccount = getAssociatedTokenAddressSync(
      mint,
      pool,
      true,
      tokenProgram,
    );
    return this.offlinePumpProgram.methods
      .migrate()
      .accountsPartial({
        mint,
        user,
        withdrawAuthority,
        associatedBondingCurve,
        poolAuthorityMintAccount,
        poolBaseTokenAccount,
      })
      .instruction();
  }

  async syncUserVolumeAccumulator(
    user: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .syncUserVolumeAccumulator()
      .accountsPartial({ user })
      .instruction();
  }

  async setCreator({
    mint,
    setCreatorAuthority,
    creator,
  }: {
    mint: PublicKey;
    setCreatorAuthority: PublicKey;
    creator: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .setCreator(creator)
      .accountsPartial({
        mint,
        setCreatorAuthority,
      })
      .instruction();
  }

  async initUserVolumeAccumulator({
    payer,
    user,
  }: {
    payer: PublicKey;
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .initUserVolumeAccumulator()
      .accountsPartial({ payer, user })
      .instruction();
  }

  async closeUserVolumeAccumulator(
    user: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .closeUserVolumeAccumulator()
      .accountsPartial({ user })
      .instruction();
  }

  async collectCreatorFeeInstruction({
    creator,
  }: {
    creator: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .collectCreatorFee()
      .accountsPartial({ creator })
      .instruction();
  }

  async claimTokenIncentivesInstruction({
    user,
    payer,
    mint = PUMP_TOKEN_MINT,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
  }: {
    user: PublicKey;
    payer: PublicKey;
    mint?: PublicKey;
    tokenProgram?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .claimTokenIncentives()
      .accountsPartial({ user, payer, mint, tokenProgram })
      .instruction();
  }

  async adminSetCreatorInstruction({
    authority,
    mint,
    creator,
  }: {
    authority: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
  }): Promise<TransactionInstruction> {
    void authority;
    void mint;
    void creator;
    throw new Error(
      "admin_set_creator was retired; use adminCtoInstruction with current creator and quote accounts",
    );
  }

  /** Build the protocol's unified community-takeover instruction. */
  async adminCtoInstruction({
    adminSetCreatorAuthority,
    mint,
    currentCreator,
    quoteMint = NATIVE_MINT,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
    isHolderReward,
    creatorFeeBps,
    newCreator,
  }: {
    adminSetCreatorAuthority: PublicKey;
    mint: PublicKey;
    currentCreator: PublicKey;
    quoteMint?: PublicKey;
    quoteTokenProgram?: PublicKey;
    isHolderReward?: boolean;
    creatorFeeBps?: BN;
    newCreator?: PublicKey;
  }): Promise<TransactionInstruction> {
    const creatorVault = creatorVaultPda(currentCreator);
    const holderCreatorVault = creatorVaultPda(holderRewardsPda(mint));
    const coinCreatorVaultAuthority = coinCreatorVaultAuthorityPda(currentCreator);
    const ata = (owner: PublicKey) =>
      getAssociatedTokenAddressSync(quoteMint, owner, true, quoteTokenProgram);

    const instruction = await this.offlinePumpProgram.methods
      .adminCto(
        isHolderReward ?? null,
        creatorFeeBps ?? null,
        newCreator ?? null,
      )
      .accountsPartial({
        adminSetCreatorAuthority,
        mint,
        quoteMint,
        quoteTokenProgram,
        currentCreator,
        currentCreatorQuoteTokenAccount: ata(currentCreator),
        creatorVault,
        creatorVaultQuoteTokenAccount: ata(creatorVault),
        holderCreatorVault,
        holderCreatorVaultQuoteTokenAccount: ata(holderCreatorVault),
        coinCreatorVaultAuthority,
        coinCreatorVaultAta: ata(coinCreatorVaultAuthority),
        sharingConfig: feeSharingConfigPda(mint),
      })
      .instruction();

    if (!currentCreator.equals(PublicKey.default)) {
      const currentCreatorMeta = instruction.keys.find(({ pubkey }) =>
        pubkey.equals(currentCreator),
      );
      if (currentCreatorMeta) currentCreatorMeta.isWritable = true;
    }
    return instruction;
  }

  /** Build a signed Pump.fun payout from a holder-reward PDA to holders. */
  async distributeFeeToHoldersInstruction({
    holderRewardClaimAuthority,
    mint,
    quoteMint = NATIVE_MINT,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
    recipients,
    holderRewardsTokenAccount,
  }: {
    holderRewardClaimAuthority: PublicKey;
    mint: PublicKey;
    quoteMint?: PublicKey;
    quoteTokenProgram?: PublicKey;
    recipients: readonly { owner: PublicKey; amount: BN }[];
    holderRewardsTokenAccount?: PublicKey;
  }): Promise<TransactionInstruction> {
    const isNative = quoteMint.equals(NATIVE_MINT);
    const remainingAccounts: AccountMeta[] = recipients.flatMap(({ owner }) => [
      { pubkey: owner, isSigner: false, isWritable: isNative },
      {
        pubkey: getAssociatedTokenAddressSync(
          quoteMint,
          owner,
          true,
          quoteTokenProgram,
        ),
        isSigner: false,
        isWritable: !isNative,
      },
    ]);

    return await this.offlinePumpProgram.methods
      .distributeFeeToHolders(recipients.map(({ amount }) => amount))
      .accountsPartial({
        holderRewardClaimAuthority,
        mint,
        holderRewards: holderRewardsPda(mint),
        holderRewardsTokenAccount: holderRewardsTokenAccount ?? null,
        quoteMint,
        quoteTokenProgram,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();
  }

  async adminUpdateTokenIncentivesInstruction({
    authority,
    mint = PUMP_TOKEN_MINT,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
    startTime,
    endTime,
    secondsInADay = new BN(86_400),
    dayNumber,
    pumpTokenSupplyPerDay,
  }: {
    authority: PublicKey;
    mint?: PublicKey;
    tokenProgram?: PublicKey;
    startTime: BN;
    endTime: BN;
    secondsInADay?: BN;
    dayNumber: BN;
    pumpTokenSupplyPerDay: BN;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .adminUpdateTokenIncentives(
        startTime,
        endTime,
        secondsInADay,
        dayNumber,
        pumpTokenSupplyPerDay,
      )
      .accountsPartial({ authority, mint, tokenProgram })
      .instruction();
  }

  async getBuyInstructionRaw({
    user,
    mint,
    creator,
    amount,
    solAmount,
    feeRecipient = getStaticRandomFeeRecipient(),
    tokenProgram = TOKEN_PROGRAM_ID,
  }: {
    user: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
    amount: BN;
    solAmount: BN;
    feeRecipient: PublicKey;
    tokenProgram?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.getBuyInstructionInternal({
      user,
      associatedUser: getAssociatedTokenAddressSync(
        mint,
        user,
        true,
        tokenProgram,
      ),
      mint,
      creator,
      feeRecipient,
      amount,
      solAmount,
      tokenProgram,
    });
  }

  private async getBuyInstructionInternal({
    user,
    associatedUser,
    mint,
    creator,
    feeRecipient,
    amount,
    solAmount,
    tokenProgram = TOKEN_PROGRAM_ID,
  }: {
    user: PublicKey;
    associatedUser: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
    feeRecipient: PublicKey;
    amount: BN;
    solAmount: BN;
    tokenProgram?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .buy(amount, solAmount, { 0: true }, { 0: false })
      .accountsPartial({
        feeRecipient,
        mint,
        associatedUser,
        user,
        creatorVault: creatorVaultPda(creator),
        tokenProgram,
      })
      .remainingAccounts([
        {
          pubkey: bondingCurveV2Pda(mint),
          isWritable: false,
          isSigner: false,
        },
        // 2026-04-28 upgrade: one of 8 breaking fee recipients, mutable, last.
        {
          pubkey: pickBreakingFeeRecipient(),
          isWritable: true,
          isSigner: false,
        },
      ])
      .instruction();
  }

  async getSellInstructionRaw({
    user,
    mint,
    creator,
    amount,
    solAmount,
    feeRecipient = getStaticRandomFeeRecipient(),
    tokenProgram = TOKEN_PROGRAM_ID,
    cashback = false,
  }: {
    user: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
    amount: BN;
    solAmount: BN;
    feeRecipient: PublicKey;
    tokenProgram?: PublicKey;
    cashback?: boolean;
  }): Promise<TransactionInstruction> {
    return await this.getSellInstructionInternal({
      user,
      mint,
      creator,
      feeRecipient,
      amount,
      solAmount,
      tokenProgram,
      cashback,
    });
  }

  private async getSellInstructionInternal({
    user,
    mint,
    creator,
    feeRecipient,
    amount,
    solAmount,
    tokenProgram,
    cashback = false,
  }: {
    user: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
    feeRecipient: PublicKey;
    amount: BN;
    solAmount: BN;
    tokenProgram: PublicKey;
    cashback?: boolean;
  }): Promise<TransactionInstruction> {
    const userVolumeAccumulator = userVolumeAccumulatorPda(user);
    // 2026-04-28 upgrade: one of 8 breaking fee recipients, mutable, last.
    const breakingFeeRecipient = {
      pubkey: pickBreakingFeeRecipient(),
      isWritable: true,
      isSigner: false,
    };
    const remainingAccounts = cashback
      ? [
          {
            pubkey: userVolumeAccumulator,
            isWritable: true,
            isSigner: false,
          },
          {
            pubkey: bondingCurveV2Pda(mint),
            isWritable: false,
            isSigner: false,
          },
          breakingFeeRecipient,
        ]
      : [
          {
            pubkey: bondingCurveV2Pda(mint),
            isWritable: false,
            isSigner: false,
          },
          breakingFeeRecipient,
        ];
    return await this.offlinePumpProgram.methods
      .sell(amount, solAmount)
      .accountsPartial({
        feeRecipient,
        mint,
        associatedUser: getAssociatedTokenAddressSync(
          mint,
          user,
          true,
          tokenProgram,
        ),
        user,
        creatorVault: creatorVaultPda(creator),
        tokenProgram,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();
  }

  /**
   * Creates a fee sharing configuration for a token.
   *
   * @param params - Parameters for creating a fee sharing configuration
   * @param params.creator - The creator of the token
   * @param params.mint - The mint address of the token
   * @param params.pool - The pool address of the token (null for ungraduated coins)
   */
  async createFeeSharingConfig({
    creator,
    mint,
    pool,
  }: {
    creator: PublicKey;
    mint: PublicKey;
    pool: PublicKey | null;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .createFeeSharingConfig()
      .accountsPartial({
        payer: creator,
        mint,
        pool,
      })
      .instruction();
  }

  /**
   * Updates the fee shares for a token's creator fee distribution.
   *
   * @param params - Parameters for updating fee shares
   * @param params.authority - The current authority that can modify the fee sharing config
   * @param params.mint - The mint address of the token
   * @param params.curShareholders - Array of current shareholders
   * @param params.newShareholders - Array of new shareholders and their share percentages
   * @requirements for newShareholders:
   * - Must contain at least 1 shareholder (cannot be empty)
   * - Maximum of 10 shareholders allowed
   * - Each shareholder must have a positive share (shareBps > 0)
   * - Total shares must equal exactly 10,000 basis points (100%)
   * - No duplicate addresses allowed
   * - shareBps is in basis points where 1 bps = 0.01% (e.g., 1500 = 15%)
   * @throws {NoShareholdersError} If shareholders array is empty
   * @throws {TooManyShareholdersError} If more than 10 shareholders
   * @throws {ZeroShareError} If any shareholder has zero or negative shares
   * @throws {InvalidShareTotalError} If total shares don't equal 10,000 basis points
   * @throws {DuplicateShareholderError} If duplicate addresses are found
   * @example
   * ```typescript
   * const instruction = await PUMP_SDK.updateFeeShares({
   *   authority: authorityPublicKey,
   *   mint: mintPublicKey,
   *   curShareholders: [wallet1, wallet2, wallet3],
   *   newShareholders: [
   *     { address: wallet1, shareBps: 5000 }, // 50%
   *     { address: wallet2, shareBps: 3000 }, // 30%
   *     { address: wallet3, shareBps: 2000 }, // 20%
   *   ]
   * });
   * ```
   */
  async updateFeeShares({
    authority,
    mint,
    currentShareholders,
    newShareholders,
  }: {
    authority: PublicKey;
    mint: PublicKey;
    currentShareholders: PublicKey[];
    newShareholders: Shareholder[];
  }): Promise<TransactionInstruction> {
    if (newShareholders.length === 0) {
      throw new NoShareholdersError();
    }

    if (newShareholders.length > MAX_SHAREHOLDERS) {
      throw new TooManyShareholdersError(
        newShareholders.length,
        MAX_SHAREHOLDERS,
      );
    }

    let totalShares = 0;
    const addresses = new Set<string>();

    for (const shareholder of newShareholders) {
      if (shareholder.shareBps <= 0) {
        throw new ZeroShareError(shareholder.address.toString());
      }

      totalShares += shareholder.shareBps;
      addresses.add(shareholder.address.toString());
    }

    if (totalShares !== 10_000) {
      throw new InvalidShareTotalError(totalShares);
    }

    if (addresses.size !== newShareholders.length) {
      throw new DuplicateShareholderError();
    }

    const sharingConfigPda = feeSharingConfigPda(mint);
    const coinCreatorVaultAuthority =
      coinCreatorVaultAuthorityPda(sharingConfigPda);

    return await this.offlinePumpFeeProgram.methods
      .updateFeeShares(
        newShareholders.map((sh) => ({
          address: sh.address,
          shareBps: sh.shareBps,
        })),
      )
      .accountsPartial({
        authority,
        mint,
        coinCreatorVaultAta: coinCreatorVaultAtaPda(
          coinCreatorVaultAuthority,
          NATIVE_MINT,
          TOKEN_PROGRAM_ID,
        ),
      })
      .remainingAccounts(
        currentShareholders.map((pubkey) => ({
          pubkey,
          isWritable: true,
          isSigner: false,
        })),
      )
      .instruction();
  }

  decodeDistributeCreatorFeesEvent(data: Buffer): DistributeCreatorFeesEvent {
    return this.offlinePumpProgram.coder.types.decode<DistributeCreatorFeesEvent>(
      "distributeCreatorFeesEvent",
      data,
    );
  }

  async distributeCreatorFees({
    mint,
    sharingConfig,
    sharingConfigAddress,
  }: {
    mint: PublicKey;
    sharingConfig: SharingConfig;
    sharingConfigAddress: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .distributeCreatorFees()
      .accountsPartial({
        mint,
        creatorVault: creatorVaultPda(sharingConfigAddress),
      })
      .remainingAccounts(
        sharingConfig.shareholders.map((shareholder) => ({
          pubkey: shareholder.address,
          isWritable: true,
          isSigner: false,
        })),
      )
      .instruction();
  }

  decodeMinimumDistributableFee(data: Buffer): MinimumDistributableFeeEvent {
    return this.offlinePumpProgram.coder.types.decode<MinimumDistributableFeeEvent>(
      "minimumDistributableFeeEvent",
      data,
    );
  }

  // ─── Pump Program Event Decoders ──────────────────────────────────

  /**
   * Decodes a pump `TradeEvent` emitted under any deployment's layout: the
   * event only ever gains trailing fields (the quote fields, holder rewards,
   * `creator_fee_unclaimed`), and an older, shorter event decodes with the
   * fields it lacks at zero.
   */
  decodeTradeEvent(data: Buffer): TradeEvent {
    return decodeWithTrailingDefaults(data, TRADE_EVENT_LAYOUT_PADDINGS, (bytes) =>
      this.offlinePumpProgram.coder.types.decode<TradeEvent>("tradeEvent", bytes),
    );
  }

  /**
   * Decodes a pump `CreateEvent` under any deployment's layout: an event
   * without the trailing `creator_fee_bps`, `is_holder_reward` or `depth`
   * decodes with them at zero / `false`.
   */
  decodeCreateEvent(data: Buffer): CreateEvent {
    return decodeWithTrailingDefaults(data, CREATE_EVENT_LAYOUT_PADDINGS, (bytes) =>
      this.offlinePumpProgram.coder.types.decode<CreateEvent>("createEvent", bytes),
    );
  }

  decodeCompleteEvent(data: Buffer): CompleteEvent {
    return this.offlinePumpProgram.coder.types.decode<CompleteEvent>(
      "completeEvent",
      data,
    );
  }

  /**
   * Decodes a pump `PostCompleteBuyEvent`: the leg of a v3 buy that ran past
   * the remaining supply and filled against the pool the migration will
   * create. It follows the `CompleteEvent` in the same transaction.
   */
  decodePostCompleteBuyEvent(data: Buffer): PostCompleteBuyEvent {
    return this.offlinePumpProgram.coder.types.decode<PostCompleteBuyEvent>(
      "postCompleteBuyEvent",
      data,
    );
  }

  /**
   * Decodes a pump `SweepBondingCurveFeeEvent` (`sweep_protocol_fee` /
   * `sweep_creator_fee`); `bucket` is a `SweepFeeBucket`.
   */
  decodeSweepBondingCurveFeeEvent(data: Buffer): SweepBondingCurveFeeEvent {
    return this.offlinePumpProgram.coder.types.decode<SweepBondingCurveFeeEvent>(
      "sweepBondingCurveFeeEvent",
      data,
    );
  }

  decodeCompletePumpAmmMigrationEvent(
    data: Buffer,
  ): CompletePumpAmmMigrationEvent {
    return this.offlinePumpProgram.coder.types.decode<CompletePumpAmmMigrationEvent>(
      "completePumpAmmMigrationEvent",
      data,
    );
  }

  decodeSetCreatorEvent(data: Buffer): SetCreatorEvent {
    return this.offlinePumpProgram.coder.types.decode<SetCreatorEvent>(
      "setCreatorEvent",
      data,
    );
  }

  decodeCollectCreatorFeeEvent(data: Buffer): CollectCreatorFeeEvent {
    return this.offlinePumpProgram.coder.types.decode<CollectCreatorFeeEvent>(
      "collectCreatorFeeEvent",
      data,
    );
  }

  decodeClaimTokenIncentivesEvent(data: Buffer): ClaimTokenIncentivesEvent {
    return this.offlinePumpProgram.coder.types.decode<ClaimTokenIncentivesEvent>(
      "claimTokenIncentivesEvent",
      data,
    );
  }

  decodeClaimCashbackEvent(data: Buffer): ClaimCashbackEvent {
    return this.offlinePumpProgram.coder.types.decode<ClaimCashbackEvent>(
      "claimCashbackEvent",
      data,
    );
  }

  decodeExtendAccountEvent(data: Buffer): ExtendAccountEvent {
    return this.offlinePumpProgram.coder.types.decode<ExtendAccountEvent>(
      "extendAccountEvent",
      data,
    );
  }

  decodeInitUserVolumeAccumulatorEvent(
    data: Buffer,
  ): InitUserVolumeAccumulatorEvent {
    return this.offlinePumpProgram.coder.types.decode<InitUserVolumeAccumulatorEvent>(
      "initUserVolumeAccumulatorEvent",
      data,
    );
  }

  decodeSyncUserVolumeAccumulatorEvent(
    data: Buffer,
  ): SyncUserVolumeAccumulatorEvent {
    return this.offlinePumpProgram.coder.types.decode<SyncUserVolumeAccumulatorEvent>(
      "syncUserVolumeAccumulatorEvent",
      data,
    );
  }

  decodeCloseUserVolumeAccumulatorEvent(
    data: Buffer,
  ): CloseUserVolumeAccumulatorEvent {
    return this.offlinePumpProgram.coder.types.decode<CloseUserVolumeAccumulatorEvent>(
      "closeUserVolumeAccumulatorEvent",
      data,
    );
  }

  decodeAdminCtoEvent(data: Buffer): AdminCtoEvent {
    return this.offlinePumpProgram.coder.types.decode<AdminCtoEvent>(
      "adminCtoEvent",
      data,
    );
  }

  decodeDistributeFeeToHoldersEvent(
    data: Buffer,
  ): DistributeFeeToHoldersEvent {
    return this.offlinePumpProgram.coder.types.decode<DistributeFeeToHoldersEvent>(
      "distributeFeeToHoldersEvent",
      data,
    );
  }

  decodeMigrateBondingCurveCreatorEvent(
    data: Buffer,
  ): MigrateBondingCurveCreatorEvent {
    return this.offlinePumpProgram.coder.types.decode<MigrateBondingCurveCreatorEvent>(
      "migrateBondingCurveCreatorEvent",
      data,
    );
  }

  // ─── PumpAMM Event Decoders ───────────────────────────────────────

  /**
   * Decodes a PumpSwap `BuyEvent` under any deployment's layout: an event
   * emitted before the signed `virtual_quote_reserves`, `can_boost`,
   * `base_supply`, holder-reward or `creator_fee_unclaimed` fields decodes
   * with them at zero / `false`.
   */
  decodeAmmBuyEvent(data: Buffer): AmmBuyEvent {
    return decodeWithTrailingDefaults(data, AMM_TRADE_EVENT_LAYOUT_PADDINGS, (bytes) =>
      this.offlinePumpAmmProgram.coder.types.decode<AmmBuyEvent>("buyEvent", bytes),
    );
  }

  /** Like `decodeAmmBuyEvent`, for `SellEvent`. */
  decodeAmmSellEvent(data: Buffer): AmmSellEvent {
    return decodeWithTrailingDefaults(data, AMM_TRADE_EVENT_LAYOUT_PADDINGS, (bytes) =>
      this.offlinePumpAmmProgram.coder.types.decode<AmmSellEvent>("sellEvent", bytes),
    );
  }

  /**
   * Decodes a PumpSwap `SweepPoolFeeEvent` (pump-amm `sweep_protocol_fee` /
   * `sweep_creator_fee`); `bucket` is a `SweepFeeBucket`.
   */
  decodeSweepPoolFeeEvent(data: Buffer): SweepPoolFeeEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<SweepPoolFeeEvent>(
      "sweepPoolFeeEvent",
      data,
    );
  }

  decodeDepositEvent(data: Buffer): DepositEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<DepositEvent>(
      "depositEvent",
      data,
    );
  }

  decodeWithdrawEvent(data: Buffer): WithdrawEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<WithdrawEvent>(
      "withdrawEvent",
      data,
    );
  }

  /**
   * Decodes a PumpSwap `CreatePoolEvent` under any deployment's layout: an
   * event without `creator_fee_bps` / `can_edit_creator_fee` /
   * `is_holder_reward` decodes with them at zero / `false`.
   */
  decodeCreatePoolEvent(data: Buffer): CreatePoolEvent {
    return decodeWithTrailingDefaults(data, CREATE_POOL_EVENT_LAYOUT_PADDINGS, (bytes) =>
      this.offlinePumpAmmProgram.coder.types.decode<CreatePoolEvent>("createPoolEvent", bytes),
    );
  }

  // ─── PumpFees Event Decoders ──────────────────────────────────────

  decodeCreateFeeSharingConfigEvent(
    data: Buffer,
  ): CreateFeeSharingConfigEvent {
    return this.offlinePumpFeeProgram.coder.types.decode<CreateFeeSharingConfigEvent>(
      "createFeeSharingConfigEvent",
      data,
    );
  }

  decodeUpdateFeeSharesEvent(data: Buffer): UpdateFeeSharesEvent {
    return this.offlinePumpFeeProgram.coder.types.decode<UpdateFeeSharesEvent>(
      "updateFeeSharesEvent",
      data,
    );
  }

  decodeResetFeeSharingConfigEvent(
    data: Buffer,
  ): ResetFeeSharingConfigEvent {
    return this.offlinePumpFeeProgram.coder.types.decode<ResetFeeSharingConfigEvent>(
      "resetFeeSharingConfigEvent",
      data,
    );
  }

  decodeSocialFeePdaCreatedEvent(data: Buffer): SocialFeePdaCreatedEvent {
    return this.offlinePumpFeeProgram.coder.types.decode<SocialFeePdaCreatedEvent>(
      "socialFeePdaCreated",
      data,
    );
  }

  decodeSocialFeePdaClaimedEvent(data: Buffer): SocialFeePdaClaimedEvent {
    return this.offlinePumpFeeProgram.coder.types.decode<SocialFeePdaClaimedEvent>(
      "socialFeePdaClaimed",
      data,
    );
  }

  // ─── PumpAMM Extra Event Decoders ─────────────────────────────────────────

  decodeAmmAdminUpdateTokenIncentivesEvent(data: Buffer): AmmAdminUpdateTokenIncentivesEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmAdminUpdateTokenIncentivesEvent>(
      "adminUpdateTokenIncentivesEvent", data,
    );
  }

  decodeAmmClaimCashbackEvent(data: Buffer): AmmClaimCashbackEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmClaimCashbackEvent>(
      "claimCashbackEvent", data,
    );
  }

  decodeAmmClaimTokenIncentivesEvent(data: Buffer): AmmClaimTokenIncentivesEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmClaimTokenIncentivesEvent>(
      "claimTokenIncentivesEvent", data,
    );
  }

  decodeAmmCloseUserVolumeAccumulatorEvent(data: Buffer): AmmCloseUserVolumeAccumulatorEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmCloseUserVolumeAccumulatorEvent>(
      "closeUserVolumeAccumulatorEvent", data,
    );
  }

  decodeAmmCollectCoinCreatorFeeEvent(data: Buffer): AmmCollectCoinCreatorFeeEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmCollectCoinCreatorFeeEvent>(
      "collectCoinCreatorFeeEvent", data,
    );
  }

  decodeAmmCreateConfigEvent(data: Buffer): AmmCreateConfigEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmCreateConfigEvent>(
      "createConfigEvent", data,
    );
  }

  decodeAmmDisableEvent(data: Buffer): AmmDisableEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmDisableEvent>(
      "disableEvent", data,
    );
  }

  decodeAmmExtendAccountEvent(data: Buffer): AmmExtendAccountEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmExtendAccountEvent>(
      "extendAccountEvent", data,
    );
  }

  decodeAmmInitUserVolumeAccumulatorEvent(data: Buffer): AmmInitUserVolumeAccumulatorEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmInitUserVolumeAccumulatorEvent>(
      "initUserVolumeAccumulatorEvent", data,
    );
  }

  decodeAmmMigratePoolCoinCreatorEvent(data: Buffer): AmmMigratePoolCoinCreatorEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmMigratePoolCoinCreatorEvent>(
      "migratePoolCoinCreatorEvent", data,
    );
  }

  decodeAmmReservedFeeRecipientsEvent(data: Buffer): AmmReservedFeeRecipientsEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmReservedFeeRecipientsEvent>(
      "reservedFeeRecipientsEvent", data,
    );
  }

  decodeAmmSetBondingCurveCoinCreatorEvent(data: Buffer): AmmSetBondingCurveCoinCreatorEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmSetBondingCurveCoinCreatorEvent>(
      "setBondingCurveCoinCreatorEvent", data,
    );
  }

  decodeAmmSetMetaplexCoinCreatorEvent(data: Buffer): AmmSetMetaplexCoinCreatorEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmSetMetaplexCoinCreatorEvent>(
      "setMetaplexCoinCreatorEvent", data,
    );
  }

  decodeAmmSyncUserVolumeAccumulatorEvent(data: Buffer): AmmSyncUserVolumeAccumulatorEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmSyncUserVolumeAccumulatorEvent>(
      "syncUserVolumeAccumulatorEvent", data,
    );
  }

  decodeAmmUpdateAdminEvent(data: Buffer): AmmUpdateAdminEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmUpdateAdminEvent>(
      "updateAdminEvent", data,
    );
  }

  decodeAmmUpdateFeeConfigEvent(data: Buffer): AmmUpdateFeeConfigEvent {
    return this.offlinePumpAmmProgram.coder.types.decode<AmmUpdateFeeConfigEvent>(
      "updateFeeConfigEvent", data,
    );
  }

  // ─── PumpFees Extra Event Decoders ────────────────────────────────────────

  decodeFeesInitializeFeeConfigEvent(data: Buffer): FeesInitializeFeeConfigEvent {
    return this.offlinePumpFeeProgram.coder.types.decode<FeesInitializeFeeConfigEvent>(
      "initializeFeeConfigEvent", data,
    );
  }

  decodeFeesInitializeFeeProgramGlobalEvent(data: Buffer): FeesInitializeFeeProgramGlobalEvent {
    return this.offlinePumpFeeProgram.coder.types.decode<FeesInitializeFeeProgramGlobalEvent>(
      "initializeFeeProgramGlobalEvent", data,
    );
  }

  decodeFeesSetAuthorityEvent(data: Buffer): FeesSetAuthorityEvent {
    return this.offlinePumpFeeProgram.coder.types.decode<FeesSetAuthorityEvent>(
      "setAuthorityEvent", data,
    );
  }

  decodeFeesSetClaimRateLimitEvent(data: Buffer): FeesSetClaimRateLimitEvent {
    return this.offlinePumpFeeProgram.coder.types.decode<FeesSetClaimRateLimitEvent>(
      "setClaimRateLimitEvent", data,
    );
  }

  decodeFeesSetDisableFlagsEvent(data: Buffer): FeesSetDisableFlagsEvent {
    return this.offlinePumpFeeProgram.coder.types.decode<FeesSetDisableFlagsEvent>(
      "setDisableFlagsEvent", data,
    );
  }

  decodeFeesSetSocialClaimAuthorityEvent(data: Buffer): FeesSetSocialClaimAuthorityEvent {
    return this.offlinePumpFeeProgram.coder.types.decode<FeesSetSocialClaimAuthorityEvent>(
      "setSocialClaimAuthorityEvent", data,
    );
  }

  decodeFeesUpdateAdminEvent(data: Buffer): FeesUpdateAdminEvent {
    return this.offlinePumpFeeProgram.coder.types.decode<FeesUpdateAdminEvent>(
      "updateAdminEvent", data,
    );
  }

  decodeFeesUpdateFeeConfigEvent(data: Buffer): FeesUpdateFeeConfigEvent {
    return this.offlinePumpFeeProgram.coder.types.decode<FeesUpdateFeeConfigEvent>(
      "updateFeeConfigEvent", data,
    );
  }

  decodeFeesUpsertFeeTiersEvent(data: Buffer): FeesUpsertFeeTiersEvent {
    return this.offlinePumpFeeProgram.coder.types.decode<FeesUpsertFeeTiersEvent>(
      "upsertFeeTiersEvent", data,
    );
  }

  async getMinimumDistributableFee({
    mint,
    sharingConfig,
    sharingConfigAddress,
  }: {
    mint: PublicKey;
    sharingConfig: SharingConfig;
    sharingConfigAddress: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .getMinimumDistributableFee()
      .accountsPartial({
        mint,
        creatorVault: creatorVaultPda(sharingConfigAddress),
      })
      .remainingAccounts(
        sharingConfig.shareholders.map((shareholder) => ({
          pubkey: shareholder.address,
          isWritable: true,
          isSigner: false,
        })),
      )
      .instruction();
  }

  async claimCashbackInstruction({
    user,
  }: {
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .claimCashback()
      .accountsPartial({
        user,
      })
      .instruction();
  }

  // ─── Buy Exact SOL In ───────────────────────────────────────────────

  /**
   * Buy tokens by specifying the exact SOL amount to spend.
   * More intuitive for users who think in SOL terms.
   *
   * @param params.user - The buyer's public key
   * @param params.mint - The token mint address
   * @param params.creator - The token creator
   * @param params.feeRecipient - Fee recipient address
   * @param params.solAmount - Exact SOL amount to spend (lamports)
   * @param params.minTokenAmount - Minimum tokens to receive (slippage protection)
   * @param params.tokenProgram - Token program (TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID)
   */
  async buyExactSolInInstruction({
    user,
    mint,
    creator,
    feeRecipient,
    solAmount,
    minTokenAmount,
    tokenProgram = TOKEN_PROGRAM_ID,
  }: {
    user: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
    feeRecipient: PublicKey;
    solAmount: BN;
    minTokenAmount: BN;
    tokenProgram?: PublicKey;
  }): Promise<TransactionInstruction> {
    const associatedUser = getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      tokenProgram,
    );
    return await this.offlinePumpProgram.methods
      .buyExactSolIn(solAmount, minTokenAmount, { 0: true }, { 0: false })
      .accountsPartial({
        feeRecipient,
        mint,
        associatedUser,
        user,
        creatorVault: creatorVaultPda(creator),
        tokenProgram,
      })
      .remainingAccounts([
        {
          pubkey: bondingCurveV2Pda(mint),
          isWritable: false,
          isSigner: false,
        },
        // 2026-04-28 upgrade: one of 8 breaking fee recipients, mutable, last.
        {
          pubkey: pickBreakingFeeRecipient(),
          isWritable: true,
          isSigner: false,
        },
      ])
      .instruction();
  }

  // ─── Mayhem Mode ────────────────────────────────────────────────────

  /**
   * Set virtual parameters for mayhem mode on a bonding curve.
   * The solVaultAuthority PDA is the signer for this instruction.
   */
  async setMayhemVirtualParamsInstruction({
    mint,
  }: {
    mint: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .setMayhemVirtualParams()
      .accountsPartial({
        mint,
      })
      .instruction();
  }

  /**
   * Toggle mayhem mode on/off for the protocol.
   */
  async toggleMayhemModeInstruction({
    authority,
    enabled,
  }: {
    authority: PublicKey;
    enabled: boolean;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .toggleMayhemMode(enabled)
      .accountsPartial({
        authority,
      })
      .instruction();
  }

  /**
   * Toggle cashback feature on/off.
   */
  async toggleCashbackEnabledInstruction({
    authority,
    enabled,
  }: {
    authority: PublicKey;
    enabled: boolean;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .toggleCashbackEnabled(enabled)
      .accountsPartial({
        authority,
      })
      .instruction();
  }

  /**
   * Toggle the create_v2 instruction on/off.
   */
  async toggleCreateV2Instruction({
    authority,
    enabled,
  }: {
    authority: PublicKey;
    enabled: boolean;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .toggleCreateV2(enabled)
      .accountsPartial({
        authority,
      })
      .instruction();
  }

  /**
   * Transfer IDL authority to a new address.
   *
   * Updates the on-chain Anchor IDL account so a new pubkey can publish
   * future IDL upgrades. Requires the current global authority as signer.
   *
   * @param authority    - Current global authority (signer)
   * @param idlAccount   - The on-chain IDL account address for the Pump program
   * @param idlAuthority - New IDL authority pubkey
   */
  async adminSetIdlAuthorityInstruction({
    authority,
    idlAccount,
    idlAuthority,
  }: {
    authority: PublicKey;
    idlAccount: PublicKey;
    idlAuthority: PublicKey;
  }): Promise<TransactionInstruction> {
    const [programSigner] = PublicKey.findProgramAddressSync(
      [],
      this.offlinePumpProgram.programId,
    );
    return await this.offlinePumpProgram.methods
      .adminSetIdlAuthority(idlAuthority)
      .accountsPartial({
        authority,
        idlAccount,
        programSigner,
      })
      .instruction();
  }

  // ─── Creator Management ─────────────────────────────────────────────

  /**
   * Migrate bonding curve creator — updates creator based on fee sharing config.
   */
  async migrateBondingCurveCreatorInstruction({
    mint,
  }: {
    mint: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .migrateBondingCurveCreator()
      .accountsPartial({
        mint,
        sharingConfig: feeSharingConfigPda(mint),
      })
      .instruction();
  }

  /**
   * Set the Metaplex creator metadata for a token from bonding curve.
   */
  async setMetaplexCreatorInstruction({
    mint,
  }: {
    mint: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .setMetaplexCreator()
      .accountsPartial({
        mint,
      })
      .instruction();
  }

  /**
   * Set reserved fee recipients for the protocol.
   */
  async setReservedFeeRecipientsInstruction({
    authority,
    whitelistPda,
  }: {
    authority: PublicKey;
    whitelistPda: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .setReservedFeeRecipients(whitelistPda)
      .accountsPartial({
        authority,
      })
      .instruction();
  }

  /**
   * Update the global authority address.
   */
  async updateGlobalAuthorityInstruction({
    authority,
    newAuthority,
  }: {
    authority: PublicKey;
    newAuthority: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .updateGlobalAuthority()
      .accountsPartial({
        authority,
        newAuthority,
      })
      .instruction();
  }

  /**
   * Update all global parameters in one instruction. Requires the global authority.
   *
   * Covers bonding curve initial reserves, fee rates, migration settings, and
   * authority addresses. Use this to change protocol-wide fee tiers, enable/disable
   * migration, or rotate authority pubkeys.
   */
  async setParamsInstruction({
    authority,
    initialVirtualTokenReserves,
    initialVirtualSolReserves,
    initialRealTokenReserves,
    tokenTotalSupply,
    feeBasisPoints,
    withdrawAuthority,
    enableMigrate,
    poolMigrationFee,
    creatorFeeBasisPoints,
    setCreatorAuthority,
    adminSetCreatorAuthority,
  }: {
    authority: PublicKey;
    initialVirtualTokenReserves: BN;
    initialVirtualSolReserves: BN;
    initialRealTokenReserves: BN;
    tokenTotalSupply: BN;
    feeBasisPoints: BN;
    withdrawAuthority: PublicKey;
    enableMigrate: boolean;
    poolMigrationFee: BN;
    creatorFeeBasisPoints: BN;
    setCreatorAuthority: PublicKey;
    adminSetCreatorAuthority: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .setParams(
        initialVirtualTokenReserves,
        initialVirtualSolReserves,
        initialRealTokenReserves,
        tokenTotalSupply,
        feeBasisPoints,
        withdrawAuthority,
        enableMigrate,
        poolMigrationFee,
        creatorFeeBasisPoints,
        setCreatorAuthority,
        adminSetCreatorAuthority,
      )
      .accountsPartial({ authority })
      .instruction();
  }

  // Quote Control and Curve Depth (admin)

  /**
   * `set_max_curve_depth`: how deep a pump-coin quote chain `create_v2` may
   * build (`Global.maxCurveDepth`; 0 disables pump-coin quotes, 1 admits
   * coins quoted in depth-0 coins only). `authority` signs and must be
   * `Global.authority`.
   */
  async setMaxCurveDepthInstruction({
    authority,
    maxCurveDepth,
  }: {
    authority: PublicKey;
    maxCurveDepth: number;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .setMaxCurveDepth(maxCurveDepth)
      .accountsPartial({
        global: GLOBAL_PDA,
        authority,
        eventAuthority: PUMP_EVENT_AUTHORITY_PDA,
        program: PUMP_PROGRAM_ID,
      })
      .instruction();
  }

  /**
   * `initialize_quote_control`: creates the `QuoteControl` PDA with no admin
   * and an empty mint list. Permissionless and once only; `user` signs and
   * pays the rent.
   */
  async initializeQuoteControlInstruction({
    user,
  }: {
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .initializeQuoteControl()
      .accountsPartial({ quoteControl: QUOTE_CONTROL_PDA, user })
      .instruction();
  }

  /**
   * `set_quote_control_admin`: `authority` must sign and be
   * `Global.authority`. The zero key revokes the admin.
   */
  async setQuoteControlAdminInstruction({
    authority,
    newAdmin,
  }: {
    authority: PublicKey;
    newAdmin: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .setQuoteControlAdmin(newAdmin)
      .accountsPartial({
        authority,
        global: GLOBAL_PDA,
        quoteControl: QUOTE_CONTROL_PDA,
        eventAuthority: PUMP_EVENT_AUTHORITY_PDA,
        program: PUMP_PROGRAM_ID,
      })
      .instruction();
  }

  /**
   * `add_quote_control_mint`: lists `quoteMint` as a `create_v2` quote with
   * the virtual quote reserves (in the mint's base units) a new curve quoted
   * in it starts from. `authority` signs and must be `QuoteControl.admin` or
   * `Global.authority`.
   */
  async addQuoteControlMintInstruction({
    authority,
    quoteMint,
    initialVirtualQuoteReserves,
  }: {
    authority: PublicKey;
    quoteMint: PublicKey;
    initialVirtualQuoteReserves: BN;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .addQuoteControlMint(quoteMint, initialVirtualQuoteReserves)
      .accountsPartial({
        authority,
        global: GLOBAL_PDA,
        quoteControl: QUOTE_CONTROL_PDA,
        eventAuthority: PUMP_EVENT_AUTHORITY_PDA,
        program: PUMP_PROGRAM_ID,
      })
      .instruction();
  }

  /**
   * `remove_quote_control_mint`: de-lists `quoteMint`. Existing curves quoted
   * in it keep trading; only new `create_v2` calls are refused.
   */
  async removeQuoteControlMintInstruction({
    authority,
    quoteMint,
  }: {
    authority: PublicKey;
    quoteMint: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .removeQuoteControlMint(quoteMint)
      .accountsPartial({
        authority,
        global: GLOBAL_PDA,
        quoteControl: QUOTE_CONTROL_PDA,
        eventAuthority: PUMP_EVENT_AUTHORITY_PDA,
        program: PUMP_PROGRAM_ID,
      })
      .instruction();
  }

  /**
   * `set_quote_control_mint_reserves`: changes the starting virtual quote
   * reserves of a listed mint in place (curves created afterwards use the
   * new value). `authority` signs and must be `QuoteControl.reservesAdmin`,
   * `QuoteControl.admin` or `Global.authority`.
   */
  async setQuoteControlMintReservesInstruction({
    authority,
    quoteMint,
    initialVirtualQuoteReserves,
  }: {
    authority: PublicKey;
    quoteMint: PublicKey;
    initialVirtualQuoteReserves: BN;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .setQuoteControlMintReserves(quoteMint, initialVirtualQuoteReserves)
      .accountsPartial({
        authority,
        global: GLOBAL_PDA,
        quoteControl: QUOTE_CONTROL_PDA,
        eventAuthority: PUMP_EVENT_AUTHORITY_PDA,
        program: PUMP_PROGRAM_ID,
      })
      .instruction();
  }

  /**
   * `set_quote_control_reserves_admin`: assigns the key allowed to change
   * listed mints' starting reserves (`QuoteControl.reservesAdmin`). The zero
   * key revokes it.
   */
  async setQuoteControlReservesAdminInstruction({
    authority,
    newReservesAdmin,
  }: {
    authority: PublicKey;
    newReservesAdmin: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .setQuoteControlReservesAdmin(newReservesAdmin)
      .accountsPartial({
        authority,
        global: GLOBAL_PDA,
        quoteControl: QUOTE_CONTROL_PDA,
        eventAuthority: PUMP_EVENT_AUTHORITY_PDA,
        program: PUMP_PROGRAM_ID,
      })
      .instruction();
  }

  // Bonding Curve v3 Trades

  /**
   * `buy_v3`: buys `amount` tokens for at most `quoteAmount` plus `slippage`
   * percent. Prices and fees match `buy`, but only the buyback slice of the
   * protocol fee leaves in the trade: the rest of the protocol fee and the
   * creator fee stay on the curve (`BondingCurve.protocolFees` /
   * `creatorFee`) until `sweepProtocolFeeInstruction` /
   * `sweepCreatorFeeInstruction` pay them out. Works for SOL and token
   * quotes (`bondingCurve.quoteMint`). Creates the user's base ATA when
   * `associatedUserAccountInfo` is null and, on a token quote, the buyback
   * recipient's quote ATA (idempotent; the program never creates it).
   *
   * A buy past the remaining supply completes the curve and buys the rest
   * from the pool the migration will create (a `PostCompleteBuyEvent`
   * follows `CompleteEvent`); quote it with
   * `getBuyV3QuoteAmountFromTokenAmount`.
   *
   * @param params.partialFill - Matters only where there is no
   *   post-completion leg (a mayhem curve): set, a buy past the remaining
   *   supply stops there; unset, it fails with 6021 `NotEnoughTokensToBuy`.
   * @throws {CashbackCoinNotSupportedError} for a cashback coin (6094).
   */
  async buyV3Instructions({
    bondingCurve,
    associatedUserAccountInfo,
    mint,
    user,
    amount,
    quoteAmount,
    slippage,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
    partialFill = false,
    buybackFeeRecipient,
  }: {
    bondingCurve: BondingCurve;
    associatedUserAccountInfo: AccountInfo<Buffer> | null;
    mint: PublicKey;
    user: PublicKey;
    amount: BN;
    quoteAmount: BN;
    slippage: number;
    tokenProgram?: PublicKey;
    quoteTokenProgram?: PublicKey;
    partialFill?: boolean;
    buybackFeeRecipient?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    if (bondingCurve.isCashbackCoin) {
      throw new CashbackCoinNotSupportedError(mint);
    }
    return [
      ...this.baseAtaInstructions(
        associatedUserAccountInfo,
        mint,
        user,
        tokenProgram,
      ),
      ...buybackAtaInstructions(
        user,
        bondingCurve.quoteMint,
        quoteTokenProgram,
        buybackFeeRecipient,
      ),
      await this.getBuyV3InstructionRaw({
        user,
        mint,
        amount,
        quoteAmount: plusSlippage(quoteAmount, slippage),
        tokenProgram,
        quoteMint: bondingCurve.quoteMint,
        quoteTokenProgram,
        partialFill,
        buybackFeeRecipient,
      }),
    ];
  }

  /**
   * `buy_exact_quote_in_v3`: spends at most `quoteAmount` (fees included)
   * and requires at least `amount` tokens less `slippage` percent, `amount`
   * being the quote from `getBuyV3TokenAmountFromQuoteAmount`. Fees are kept
   * as in `buyV3Instructions`.
   *
   * @throws {CashbackCoinNotSupportedError} for a cashback coin (6094).
   */
  async buyExactQuoteInV3Instructions({
    bondingCurve,
    associatedUserAccountInfo,
    mint,
    user,
    amount,
    quoteAmount,
    slippage,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
    partialFill = false,
    buybackFeeRecipient,
  }: {
    bondingCurve: BondingCurve;
    associatedUserAccountInfo: AccountInfo<Buffer> | null;
    mint: PublicKey;
    user: PublicKey;
    amount: BN;
    quoteAmount: BN;
    slippage: number;
    tokenProgram?: PublicKey;
    quoteTokenProgram?: PublicKey;
    partialFill?: boolean;
    buybackFeeRecipient?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    if (bondingCurve.isCashbackCoin) {
      throw new CashbackCoinNotSupportedError(mint);
    }
    return [
      ...this.baseAtaInstructions(
        associatedUserAccountInfo,
        mint,
        user,
        tokenProgram,
      ),
      ...buybackAtaInstructions(
        user,
        bondingCurve.quoteMint,
        quoteTokenProgram,
        buybackFeeRecipient,
      ),
      await this.getBuyExactQuoteInV3InstructionRaw({
        user,
        mint,
        spendableQuoteIn: quoteAmount,
        minTokensOut: lessSlippage(amount, slippage, 1),
        tokenProgram,
        quoteMint: bondingCurve.quoteMint,
        quoteTokenProgram,
        partialFill,
        buybackFeeRecipient,
      }),
    ];
  }

  /**
   * `sell_v3`: sells `amount` tokens for at least `quoteAmount` less
   * `slippage` percent. Fees are kept as in `buyV3Instructions`. On a token
   * quote it first creates, when missing, the seller's quote ATA and the
   * buyback recipient's (idempotent).
   *
   * @throws {CashbackCoinNotSupportedError} for a cashback coin (6094).
   */
  async sellV3Instructions({
    bondingCurve,
    mint,
    user,
    amount,
    quoteAmount,
    slippage,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
    buybackFeeRecipient,
  }: {
    bondingCurve: BondingCurve;
    mint: PublicKey;
    user: PublicKey;
    amount: BN;
    quoteAmount: BN;
    slippage: number;
    tokenProgram?: PublicKey;
    quoteTokenProgram?: PublicKey;
    buybackFeeRecipient?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    if (bondingCurve.isCashbackCoin) {
      throw new CashbackCoinNotSupportedError(mint);
    }
    validateSellAmount(amount, bondingCurve);
    const quote = normalizeQuoteMint(bondingCurve.quoteMint);
    const sellerQuoteAta = isLegacyQuoteMint(quote)
      ? []
      : [
          createAssociatedTokenAccountIdempotentInstruction(
            user,
            quoteAta(user, quote, quoteTokenProgram),
            user,
            quote,
            quoteTokenProgram,
          ),
        ];
    return [
      ...sellerQuoteAta,
      ...buybackAtaInstructions(
        user,
        bondingCurve.quoteMint,
        quoteTokenProgram,
        buybackFeeRecipient,
      ),
      await this.getSellV3InstructionRaw({
        user,
        mint,
        amount,
        quoteAmount: lessSlippage(quoteAmount, slippage),
        tokenProgram,
        quoteMint: bondingCurve.quoteMint,
        quoteTokenProgram,
        buybackFeeRecipient,
      }),
    ];
  }

  /**
   * `buy_v3` with `quoteAmount` as the exact `max_sol_cost` (fees included).
   * The 17 accounts come from `tradeV3Accounts`.
   *
   * @param params.quoteMint - The curve's quote mint; `bondingCurve.quoteMint`
   *   can be passed as is (the zero key is SOL).
   * @param params.buybackFeeRecipient - A listed `Global.buybackFeeRecipients`
   *   wallet (see `tradeV3Accounts`).
   */
  async getBuyV3InstructionRaw({
    user,
    mint,
    amount,
    quoteAmount,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
    quoteMint = NATIVE_MINT,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
    buybackFeeRecipient,
    partialFill = false,
  }: {
    user: PublicKey;
    mint: PublicKey;
    amount: BN;
    quoteAmount: BN;
    tokenProgram?: PublicKey;
    quoteMint?: PublicKey;
    quoteTokenProgram?: PublicKey;
    buybackFeeRecipient?: PublicKey;
    partialFill?: boolean;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .buyV3(amount, quoteAmount, { 0: partialFill })
      .accountsPartial(
        tradeV3Accounts({
          user,
          mint,
          tokenProgram,
          quoteMint,
          quoteTokenProgram,
          buybackFeeRecipient,
        }),
      )
      .instruction();
  }

  /**
   * `buy_exact_quote_in_v3` with exact `spendable_quote_in` /
   * `min_tokens_out`. Accounts as in `getBuyV3InstructionRaw`.
   */
  async getBuyExactQuoteInV3InstructionRaw({
    user,
    mint,
    spendableQuoteIn,
    minTokensOut,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
    quoteMint = NATIVE_MINT,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
    buybackFeeRecipient,
    partialFill = false,
  }: {
    user: PublicKey;
    mint: PublicKey;
    spendableQuoteIn: BN;
    minTokensOut: BN;
    tokenProgram?: PublicKey;
    quoteMint?: PublicKey;
    quoteTokenProgram?: PublicKey;
    buybackFeeRecipient?: PublicKey;
    partialFill?: boolean;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .buyExactQuoteInV3(spendableQuoteIn, minTokensOut, { 0: partialFill })
      .accountsPartial(
        tradeV3Accounts({
          user,
          mint,
          tokenProgram,
          quoteMint,
          quoteTokenProgram,
          buybackFeeRecipient,
        }),
      )
      .instruction();
  }

  /**
   * `sell_v3` with `quoteAmount` as the exact `min_sol_output` (net of
   * fees). Accounts as in `getBuyV3InstructionRaw`.
   */
  async getSellV3InstructionRaw({
    user,
    mint,
    amount,
    quoteAmount,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
    quoteMint = NATIVE_MINT,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
    buybackFeeRecipient,
  }: {
    user: PublicKey;
    mint: PublicKey;
    amount: BN;
    quoteAmount: BN;
    tokenProgram?: PublicKey;
    quoteMint?: PublicKey;
    quoteTokenProgram?: PublicKey;
    buybackFeeRecipient?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .sellV3(amount, quoteAmount)
      .accountsPartial(
        tradeV3Accounts({
          user,
          mint,
          tokenProgram,
          quoteMint,
          quoteTokenProgram,
          buybackFeeRecipient,
        }),
      )
      .instruction();
  }

  /**
   * `buy_v2`: buys `amount` tokens for at most `quoteAmount` plus `slippage`
   * percent (0.1% steps). The fees are paid out in the trade (see
   * `tradeV2Accounts`); the fee recipient is `getFeeRecipient(global,
   * bondingCurve.isMayhemMode)`.
   *
   * The v2 trades are the lane for cashback coins, which the v3 trades
   * refuse (6094). Every other coin can use the smaller v3 trades.
   *
   * Prepends an idempotent create of the user's base ATA when it is missing
   * and, on a token quote, of the buyback recipient's quote ATA.
   *
   * @param params.partialFill - Set, a buy past the remaining supply stops
   *   there; unset, it fails with 6021 `NotEnoughTokensToBuy`.
   */
  async buyV2Instructions({
    global,
    bondingCurve,
    associatedUserAccountInfo,
    mint,
    user,
    amount,
    quoteAmount,
    slippage,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
    partialFill = false,
    buybackFeeRecipient,
  }: {
    global: Global;
    bondingCurve: BondingCurve;
    associatedUserAccountInfo: AccountInfo<Buffer> | null;
    mint: PublicKey;
    user: PublicKey;
    amount: BN;
    quoteAmount: BN;
    slippage: number;
    tokenProgram?: PublicKey;
    quoteTokenProgram?: PublicKey;
    partialFill?: boolean;
    buybackFeeRecipient?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    return [
      ...this.baseAtaInstructions(
        associatedUserAccountInfo,
        mint,
        user,
        tokenProgram,
      ),
      ...buybackAtaInstructions(
        user,
        bondingCurve.quoteMint,
        quoteTokenProgram,
        buybackFeeRecipient,
      ),
      await this.getBuyV2InstructionRaw({
        user,
        mint,
        creator: bondingCurve.creator,
        amount,
        quoteAmount: plusSlippage(quoteAmount, slippage),
        feeRecipient: getFeeRecipient(global, bondingCurve.isMayhemMode),
        buybackFeeRecipient,
        tokenProgram,
        quoteMint: bondingCurve.quoteMint,
        quoteTokenProgram,
        partialFill,
      }),
    ];
  }

  /**
   * `buy_exact_quote_in_v2`: spends at most `quoteAmount` (fees included)
   * and requires at least `amount` tokens less `slippage` percent. Same
   * accounts, fees and prepended ATAs as `buyV2Instructions`.
   */
  async buyExactQuoteInV2Instructions({
    global,
    bondingCurve,
    associatedUserAccountInfo,
    mint,
    user,
    amount,
    quoteAmount,
    slippage,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
    partialFill = false,
    buybackFeeRecipient,
  }: {
    global: Global;
    bondingCurve: BondingCurve;
    associatedUserAccountInfo: AccountInfo<Buffer> | null;
    mint: PublicKey;
    user: PublicKey;
    amount: BN;
    quoteAmount: BN;
    slippage: number;
    tokenProgram?: PublicKey;
    quoteTokenProgram?: PublicKey;
    partialFill?: boolean;
    buybackFeeRecipient?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    return [
      ...this.baseAtaInstructions(
        associatedUserAccountInfo,
        mint,
        user,
        tokenProgram,
      ),
      ...buybackAtaInstructions(
        user,
        bondingCurve.quoteMint,
        quoteTokenProgram,
        buybackFeeRecipient,
      ),
      await this.getBuyExactQuoteInV2InstructionRaw({
        user,
        mint,
        creator: bondingCurve.creator,
        spendableQuoteIn: quoteAmount,
        minTokensOut: lessSlippage(amount, slippage, 1),
        feeRecipient: getFeeRecipient(global, bondingCurve.isMayhemMode),
        buybackFeeRecipient,
        tokenProgram,
        quoteMint: bondingCurve.quoteMint,
        quoteTokenProgram,
        partialFill,
      }),
    ];
  }

  /**
   * `sell_v2`: sells `amount` tokens for at least `quoteAmount` less
   * `slippage` percent (net of fees). On a token quote it first creates,
   * when missing, the seller's quote ATA and the buyback recipient's
   * (idempotent).
   */
  async sellV2Instructions({
    global,
    bondingCurve,
    mint,
    user,
    amount,
    quoteAmount,
    slippage,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
    buybackFeeRecipient,
  }: {
    global: Global;
    bondingCurve: BondingCurve;
    mint: PublicKey;
    user: PublicKey;
    amount: BN;
    quoteAmount: BN;
    slippage: number;
    tokenProgram?: PublicKey;
    quoteTokenProgram?: PublicKey;
    buybackFeeRecipient?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    validateSellAmount(amount, bondingCurve);
    const quote = normalizeQuoteMint(bondingCurve.quoteMint);
    const sellerQuoteAta = isLegacyQuoteMint(quote)
      ? []
      : [
          createAssociatedTokenAccountIdempotentInstruction(
            user,
            quoteAta(user, quote, quoteTokenProgram),
            user,
            quote,
            quoteTokenProgram,
          ),
        ];
    return [
      ...sellerQuoteAta,
      ...buybackAtaInstructions(
        user,
        bondingCurve.quoteMint,
        quoteTokenProgram,
        buybackFeeRecipient,
      ),
      await this.getSellV2InstructionRaw({
        user,
        mint,
        creator: bondingCurve.creator,
        amount,
        quoteAmount: lessSlippage(quoteAmount, slippage),
        feeRecipient: getFeeRecipient(global, bondingCurve.isMayhemMode),
        buybackFeeRecipient,
        tokenProgram,
        quoteMint: bondingCurve.quoteMint,
        quoteTokenProgram,
      }),
    ];
  }

  /**
   * `buy_v2` with `quoteAmount` as the exact `max_sol_cost` (fees included).
   * The 27 accounts come from `tradeV2Accounts`; `creator` is the curve's
   * `creator` (it seeds the creator vault).
   */
  async getBuyV2InstructionRaw({
    user,
    mint,
    creator,
    amount,
    quoteAmount,
    feeRecipient,
    buybackFeeRecipient,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
    quoteMint = NATIVE_MINT,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
    partialFill = false,
  }: {
    user: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
    amount: BN;
    quoteAmount: BN;
    feeRecipient?: PublicKey;
    buybackFeeRecipient?: PublicKey;
    tokenProgram?: PublicKey;
    quoteMint?: PublicKey;
    quoteTokenProgram?: PublicKey;
    partialFill?: boolean;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .buyV2(amount, quoteAmount, { 0: partialFill })
      .accountsPartial(
        tradeV2Accounts({
          user,
          mint,
          creator,
          tokenProgram,
          quoteMint,
          quoteTokenProgram,
          feeRecipient,
          buybackFeeRecipient,
        }),
      )
      .instruction();
  }

  /**
   * `buy_exact_quote_in_v2` with exact `spendable_quote_in` /
   * `min_tokens_out`. Accounts as in `getBuyV2InstructionRaw`.
   */
  async getBuyExactQuoteInV2InstructionRaw({
    user,
    mint,
    creator,
    spendableQuoteIn,
    minTokensOut,
    feeRecipient,
    buybackFeeRecipient,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
    quoteMint = NATIVE_MINT,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
    partialFill = false,
  }: {
    user: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
    spendableQuoteIn: BN;
    minTokensOut: BN;
    feeRecipient?: PublicKey;
    buybackFeeRecipient?: PublicKey;
    tokenProgram?: PublicKey;
    quoteMint?: PublicKey;
    quoteTokenProgram?: PublicKey;
    partialFill?: boolean;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .buyExactQuoteInV2(spendableQuoteIn, minTokensOut, { 0: partialFill })
      .accountsPartial(
        tradeV2Accounts({
          user,
          mint,
          creator,
          tokenProgram,
          quoteMint,
          quoteTokenProgram,
          feeRecipient,
          buybackFeeRecipient,
        }),
      )
      .instruction();
  }

  /**
   * `sell_v2` with `quoteAmount` as the exact `min_sol_output` (net of
   * fees). Accounts as in `getBuyV2InstructionRaw`, less
   * `global_volume_accumulator` (26).
   */
  async getSellV2InstructionRaw({
    user,
    mint,
    creator,
    amount,
    quoteAmount,
    feeRecipient,
    buybackFeeRecipient,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
    quoteMint = NATIVE_MINT,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
  }: {
    user: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
    amount: BN;
    quoteAmount: BN;
    feeRecipient?: PublicKey;
    buybackFeeRecipient?: PublicKey;
    tokenProgram?: PublicKey;
    quoteMint?: PublicKey;
    quoteTokenProgram?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .sellV2(amount, quoteAmount)
      .accountsPartial(
        tradeV2Accounts({
          user,
          mint,
          creator,
          tokenProgram,
          quoteMint,
          quoteTokenProgram,
          feeRecipient,
          buybackFeeRecipient,
        }),
      )
      .instruction();
  }

  /**
   * Reads a pump `multi_hop_curve_swap` instruction, or returns `null` for
   * any other instruction.
   *
   * There is deliberately no builder for it: the program requires PumpSwap's
   * `global_config` PDA as a signer, so only PumpSwap's `multi_hop_swap` can
   * issue it, by CPI. A transaction that carries it directly always fails.
   * Build routes with `multiHopSwapInstructions`; this decoder is for
   * indexers reading the inner instructions such a route produces.
   * `hopFees` is the program's opaque per-hop fee plan, returned as bytes.
   */
  decodeMultiHopCurveSwapInstruction(
    ix: TransactionInstruction,
  ): MultiHopCurveSwapCall | null {
    if (!ix.programId.equals(PUMP_PROGRAM_ID)) return null;
    const decoded = (
      this.offlinePumpProgram.coder.instruction as BorshInstructionCoder
    ).decode(ix.data);
    if (decoded?.name !== "multiHopCurveSwap") return null;
    const data = decoded.data as { amountIn: BN; hopFees: Buffer };
    const key = (index: number): PublicKey => {
      const meta = ix.keys[index];
      if (!meta) {
        throw new Error(
          `multi_hop_curve_swap is missing account #${index + 1} (has ${ix.keys.length})`,
        );
      }
      return meta.pubkey;
    };
    return {
      amountIn: data.amountIn,
      hopFees: Buffer.from(data.hopFees),
      user: key(3),
      sourceAuthority: key(4),
      source: key(5),
      destination: key(6),
      buybackFeeRecipient: key(7),
      remainingAccounts: ix.keys.slice(13),
    };
  }

  // An idempotent create of the user's base ATA when it is missing.
  private baseAtaInstructions(
    associatedUserAccountInfo: AccountInfo<Buffer> | null,
    mint: PublicKey,
    user: PublicKey,
    tokenProgram: PublicKey,
  ): TransactionInstruction[] {
    return associatedUserAccountInfo
      ? []
      : [
          createAssociatedTokenAccountIdempotentInstruction(
            user,
            getAssociatedTokenAddressSync(mint, user, true, tokenProgram),
            user,
            mint,
            tokenProgram,
          ),
        ];
  }

  // Fee Sweeps

  /**
   * pump `sweep_protocol_fee`: pays the protocol fees v3 trades left on
   * `mint`'s curve (`BondingCurve.protocolFees`) to `recipient`, which must
   * be a `Global` fee recipient for the curve:
   * `getFeeRecipient(global, bondingCurve.isMayhemMode)`. Permissionless;
   * `payer` covers growing a pre-upgrade curve and, on a token quote, the
   * recipient's quote ATA. Nothing moves when the bucket is empty.
   *
   * @param params.quoteMint - The curve's quote mint; `bondingCurve.quoteMint`
   *   can be passed as is (the zero key is SOL).
   */
  async sweepProtocolFeeInstruction({
    payer,
    mint,
    recipient,
    quoteMint,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
  }: {
    payer: PublicKey;
    mint: PublicKey;
    recipient: PublicKey;
    quoteMint: PublicKey;
    quoteTokenProgram?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .sweepProtocolFee()
      .accountsPartial(
        sweepBondingCurveFeeAccounts({
          payer,
          mint,
          recipient,
          quoteMint,
          quoteTokenProgram,
        }),
      )
      .instruction();
  }

  /**
   * pump `sweep_creator_fee`: pays the creator fees v3 trades left on
   * `mint`'s curve (`BondingCurve.creatorFee`) into
   * `creatorVaultPda(creator)`, `creator` being the curve's current
   * `bondingCurve.creator` (a wallet, the sharing config or the
   * holder-rewards PDA). Permissionless.
   *
   * Put it first, in the same transaction, in front of
   * `distributeCreatorFees`, `adminCtoInstruction`, `createFeeSharingConfig`
   * and `updateFeeShares` on a coin with v3 trades: they fail with 6095
   * `CreatorFeesNotSwept` while the bucket is nonzero. In front of
   * `collectCreatorFeeInstruction` it makes the claim include those fees.
   * Harmless when the bucket is empty.
   */
  async sweepCreatorFeeInstruction({
    payer,
    mint,
    creator,
    quoteMint,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
  }: {
    payer: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
    quoteMint: PublicKey;
    quoteTokenProgram?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .sweepCreatorFee()
      .accountsPartial(
        sweepBondingCurveFeeAccounts({
          payer,
          mint,
          recipient: creatorVaultPda(creator),
          quoteMint,
          quoteTokenProgram,
        }),
      )
      .instruction();
  }

  /**
   * pump-amm `sweep_protocol_fee`: pays the protocol fees PumpSwap v2 trades
   * left in `mint`'s canonical pool (`Pool.protocolFees`) to `recipient`, a
   * listed `GlobalConfig.protocolFeeRecipients` wallet, creating its quote
   * ATA when missing (`payer` pays). Permissionless.
   */
  async ammSweepProtocolFeeInstruction({
    payer,
    mint,
    recipient,
    quoteMint = NATIVE_MINT,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
  }: {
    payer: PublicKey;
    mint: PublicKey;
    recipient: PublicKey;
    quoteMint?: PublicKey;
    quoteTokenProgram?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .sweepProtocolFee()
      .accountsPartial(
        sweepPoolFeeAccounts({
          payer,
          mint,
          recipient,
          quoteMint,
          quoteTokenProgram,
        }),
      )
      .instruction();
  }

  /**
   * pump-amm `sweep_creator_fee`: pays the creator fees PumpSwap v2 trades
   * left in `mint`'s canonical pool (`Pool.creatorFees`) into the coin
   * creator vault of `coinCreator` (the pool's own `coinCreator`, read it
   * with `decodePool`), creating the vault's quote ATA when missing.
   * Permissionless.
   *
   * Put it first, in the same transaction, in front of
   * `adminCtoInstruction` and `createFeeSharingConfig` on a graduated coin
   * (pump-amm 6081 `CreatorFeesNotSwept`), in front of `updateFeeShares`
   * (pump-fees 6033 `PoolCreatorFeesNotSwept`), and in front of
   * `ammTransferCreatorFeesToPumpInstruction` so a distribution includes
   * those fees.
   */
  async ammSweepCreatorFeeInstruction({
    payer,
    mint,
    coinCreator,
    quoteMint = NATIVE_MINT,
    quoteTokenProgram = TOKEN_PROGRAM_ID,
  }: {
    payer: PublicKey;
    mint: PublicKey;
    coinCreator: PublicKey;
    quoteMint?: PublicKey;
    quoteTokenProgram?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .sweepCreatorFee()
      .accountsPartial(
        sweepPoolFeeAccounts({
          payer,
          mint,
          recipient: ammCreatorVaultPda(coinCreator),
          quoteMint,
          quoteTokenProgram,
        }),
      )
      .instruction();
  }

  // Multi-hop Routes

  /**
   * pump-amm `multi_hop_swap`: routes `amountIn` of the route's input mint
   * through `hops` (canonical pump pools and token-quoted pump curves, all
   * buys or all sells) into the output mint, exact-in, refusing less than
   * `minAmountOut` at the end. The protocol fee is charged once, at the leg
   * trading the user's currency; the creator fee (and a pool's LP fee) once,
   * at the leg trading the coin at the far end; middle hops charge nothing.
   *
   * Both user token accounts must exist (`multiHopSwapInstructions` creates
   * them and wraps / unwraps SOL). 16 fixed accounts plus 5 per hop: routes
   * longer than three hops need a v0 transaction with a lookup table.
   *
   * @param params.buybackFeeRecipient - The listed buyback wallet whose ATA
   *   for the user's currency takes the buyback slice (the first listed one
   *   by default). The ATA must exist.
   * @throws {MultiHopDiscontinuousPathError} when the hops do not chain.
   */
  async multiHopSwapInstruction({
    user,
    hops,
    side,
    amountIn,
    minAmountOut,
    buybackFeeRecipient,
  }: {
    user: PublicKey;
    hops: readonly MultiHopHop[];
    side: MultiHopSide;
    amountIn: BN;
    minAmountOut: BN;
    buybackFeeRecipient?: PublicKey;
  }): Promise<TransactionInstruction> {
    const { input, output, currency } = multiHopRouteEnds(hops, side);
    return await this.offlinePumpAmmProgram.methods
      .multiHopSwap(amountIn, minAmountOut)
      .accountsPartial({
        user,
        userInTokenAccount: quoteAta(user, input.mint, input.tokenProgram),
        userOutTokenAccount: quoteAta(user, output.mint, output.tokenProgram),
        globalConfig: AMM_GLOBAL_CONFIG_PDA,
        feeConfig: AMM_FEE_CONFIG_PDA,
        userVolumeAccumulator: ammUserVolumeAccumulatorPda(user),
        buybackFeeRecipient: quoteAta(
          buybackFeeRecipient ?? getBuybackFeeRecipientForTokenQuote(),
          currency.mint,
          currency.tokenProgram,
        ),
        pumpGlobal: GLOBAL_PDA,
        pumpFeeConfig: PUMP_FEE_CONFIG_PDA,
        pumpEventAuthority: PUMP_EVENT_AUTHORITY_PDA,
      })
      .remainingAccounts(hops.flatMap(multiHopHopAccounts))
      .instruction();
  }

  /**
   * `multiHopSwapInstruction` with the user's accounts handled: idempotent
   * creates of the output token account, of the input one when it is SOL,
   * and of the buyback recipient's ATA for the user's currency; SOL wrapped
   * into the WSOL account first when the route starts at a WSOL pool; and
   * the WSOL account closed afterwards when the input or the output is SOL.
   * A token input must already hold `amountIn`. At a SOL-quoted curve end
   * the program moves SOL as lamports and reads the WSOL account only for
   * its mint, so it is created but not funded.
   */
  async multiHopSwapInstructions(params: {
    user: PublicKey;
    hops: readonly MultiHopHop[];
    side: MultiHopSide;
    amountIn: BN;
    minAmountOut: BN;
    buybackFeeRecipient?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const { user } = params;
    const { input, output, currency } = multiHopRouteEnds(
      params.hops,
      params.side,
    );
    const ata = (end: MintWithProgram) =>
      quoteAta(user, end.mint, end.tokenProgram);
    const createAta = (end: MintWithProgram) =>
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        ata(end),
        user,
        end.mint,
        end.tokenProgram,
      );
    const closeWsol = (end: MintWithProgram) =>
      end.mint.equals(NATIVE_MINT)
        ? [createCloseAccountInstruction(ata(end), user, user, [], end.tokenProgram)]
        : [];
    const solIn = input.mint.equals(NATIVE_MINT);
    const wrapsInput = solIn && params.hops[0]?.venue === "pool";
    const wrap = wrapsInput
      ? [
          SystemProgram.transfer({
            fromPubkey: user,
            toPubkey: ata(input),
            lamports: BigInt(params.amountIn.toString()),
          }),
          createSyncNativeInstruction(ata(input), input.tokenProgram),
        ]
      : [];
    return [
      ...(solIn ? [createAta(input)] : []),
      ...wrap,
      createAta(output),
      ...buybackAtaInstructions(
        user,
        currency.mint,
        currency.tokenProgram,
        params.buybackFeeRecipient,
        true,
      ),
      await this.multiHopSwapInstruction(params),
      ...closeWsol(input),
      ...closeWsol(output),
    ];
  }

  // ─── PumpAMM Instructions ──────────────────────────────────────────

  /**
   * Buy tokens on a graduated AMM pool.
   */
  async ammBuyInstruction({
    user,
    pool,
    mint,
    baseAmountOut,
    maxQuoteAmountIn,
    cashback = false,
    protocolFeeRecipient = SystemProgram.programId,
  }: {
    user: PublicKey;
    pool: PublicKey;
    mint: PublicKey;
    baseAmountOut: BN;
    maxQuoteAmountIn: BN;
    cashback?: boolean;
    /** Protocol fee recipient from AMM global config. Defaults to SystemProgram.programId for offline use; provide the real address for production. */
    protocolFeeRecipient?: PublicKey;
  }): Promise<TransactionInstruction> {
    const userBaseAta = getAssociatedTokenAddressSync(mint, user, true, TOKEN_2022_PROGRAM_ID);
    const userQuoteAta = getAssociatedTokenAddressSync(NATIVE_MINT, user, true, TOKEN_PROGRAM_ID);
    const poolBaseAta = getAssociatedTokenAddressSync(mint, pool, true, TOKEN_2022_PROGRAM_ID);
    const poolQuoteAta = getAssociatedTokenAddressSync(NATIVE_MINT, pool, true, TOKEN_PROGRAM_ID);
    const protocolFeeAta = getAssociatedTokenAddressSync(NATIVE_MINT, protocolFeeRecipient, true, TOKEN_PROGRAM_ID);
    const coinCreatorVaultAuthority = coinCreatorVaultAuthorityPda(feeSharingConfigPda(mint));
    const coinCreatorVaultAta = coinCreatorVaultAtaPda(coinCreatorVaultAuthority, NATIVE_MINT, TOKEN_PROGRAM_ID);
    const remainingAccounts = [
      ...(cashback
        ? [
            {
              pubkey: getAssociatedTokenAddressSync(NATIVE_MINT, ammUserVolumeAccumulatorPda(user), true, TOKEN_PROGRAM_ID),
              isWritable: true,
              isSigner: false,
            },
          ]
        : []),
      { pubkey: poolV2Pda(mint), isWritable: false, isSigner: false },
      ...buildAmmBreakingFeeRecipientAccounts(),
    ];
    return await this.offlinePumpAmmProgram.methods
      .buy(baseAmountOut, maxQuoteAmountIn, { 0: true })
      .accountsPartial({
        pool,
        user,
        globalConfig: AMM_GLOBAL_CONFIG_PDA,
        baseMint: mint,
        quoteMint: NATIVE_MINT,
        userBaseTokenAccount: userBaseAta,
        userQuoteTokenAccount: userQuoteAta,
        poolBaseTokenAccount: poolBaseAta,
        poolQuoteTokenAccount: poolQuoteAta,
        protocolFeeRecipient,
        protocolFeeRecipientTokenAccount: protocolFeeAta,
        baseTokenProgram: TOKEN_2022_PROGRAM_ID,
        quoteTokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        eventAuthority: PUMP_AMM_EVENT_AUTHORITY_PDA,
        program: PUMP_AMM_PROGRAM_ID,
        coinCreatorVaultAta,
        coinCreatorVaultAuthority,
        globalVolumeAccumulator: AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA,
        userVolumeAccumulator: ammUserVolumeAccumulatorPda(user),
        feeConfig: AMM_FEE_CONFIG_PDA,
        feeProgram: PUMP_FEE_PROGRAM_ID,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();
  }

  /**
   * Buy tokens on AMM by specifying exact SOL (quote) input.
   */
  async ammBuyExactQuoteInInstruction({
    user,
    pool,
    mint,
    quoteAmountIn,
    minBaseAmountOut,
    cashback = false,
  }: {
    user: PublicKey;
    pool: PublicKey;
    mint: PublicKey;
    quoteAmountIn: BN;
    minBaseAmountOut: BN;
    cashback?: boolean;
  }): Promise<TransactionInstruction> {
    const userBaseAta = getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      TOKEN_2022_PROGRAM_ID,
    );
    const userQuoteAta = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      user,
      true,
      TOKEN_PROGRAM_ID,
    );
    const remainingAccounts = [
      ...(cashback
        ? [
            {
              pubkey: getAssociatedTokenAddressSync(
                NATIVE_MINT,
                ammUserVolumeAccumulatorPda(user),
                true,
                TOKEN_PROGRAM_ID,
              ),
              isWritable: true,
              isSigner: false,
            },
          ]
        : []),
      {
        pubkey: poolV2Pda(mint),
        isWritable: false,
        isSigner: false,
      },
      ...buildAmmBreakingFeeRecipientAccounts(),
    ];
    return await this.offlinePumpAmmProgram.methods
      .buyExactQuoteIn(quoteAmountIn, minBaseAmountOut, { 0: true })
      .accountsPartial({
        user,
        pool,
        userBaseTokenAccount: userBaseAta,
        userQuoteTokenAccount: userQuoteAta,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();
  }

  /**
   * Sell tokens on a graduated AMM pool.
   */
  async ammSellInstruction({
    user,
    pool,
    mint,
    baseAmountIn,
    minQuoteAmountOut,
    cashback = false,
    protocolFeeRecipient = SystemProgram.programId,
  }: {
    user: PublicKey;
    pool: PublicKey;
    mint: PublicKey;
    baseAmountIn: BN;
    minQuoteAmountOut: BN;
    cashback?: boolean;
    /** Protocol fee recipient from AMM global config. Defaults to SystemProgram.programId for offline use; provide the real address for production. */
    protocolFeeRecipient?: PublicKey;
  }): Promise<TransactionInstruction> {
    const userBaseAta = getAssociatedTokenAddressSync(mint, user, true, TOKEN_2022_PROGRAM_ID);
    const userQuoteAta = getAssociatedTokenAddressSync(NATIVE_MINT, user, true, TOKEN_PROGRAM_ID);
    const poolBaseAta = getAssociatedTokenAddressSync(mint, pool, true, TOKEN_2022_PROGRAM_ID);
    const poolQuoteAta = getAssociatedTokenAddressSync(NATIVE_MINT, pool, true, TOKEN_PROGRAM_ID);
    const protocolFeeAta = getAssociatedTokenAddressSync(NATIVE_MINT, protocolFeeRecipient, true, TOKEN_PROGRAM_ID);
    const coinCreatorVaultAuthority = coinCreatorVaultAuthorityPda(feeSharingConfigPda(mint));
    const coinCreatorVaultAta = coinCreatorVaultAtaPda(coinCreatorVaultAuthority, NATIVE_MINT, TOKEN_PROGRAM_ID);
    const remainingAccounts = [
      ...(cashback
        ? [
            {
              pubkey: getAssociatedTokenAddressSync(NATIVE_MINT, ammUserVolumeAccumulatorPda(user), true, TOKEN_PROGRAM_ID),
              isWritable: true,
              isSigner: false,
            },
            { pubkey: ammUserVolumeAccumulatorPda(user), isWritable: true, isSigner: false },
          ]
        : []),
      { pubkey: poolV2Pda(mint), isWritable: false, isSigner: false },
      ...buildAmmBreakingFeeRecipientAccounts(),
    ];
    return await this.offlinePumpAmmProgram.methods
      .sell(baseAmountIn, minQuoteAmountOut)
      .accountsPartial({
        pool,
        user,
        globalConfig: AMM_GLOBAL_CONFIG_PDA,
        baseMint: mint,
        quoteMint: NATIVE_MINT,
        userBaseTokenAccount: userBaseAta,
        userQuoteTokenAccount: userQuoteAta,
        poolBaseTokenAccount: poolBaseAta,
        poolQuoteTokenAccount: poolQuoteAta,
        protocolFeeRecipient,
        protocolFeeRecipientTokenAccount: protocolFeeAta,
        baseTokenProgram: TOKEN_2022_PROGRAM_ID,
        quoteTokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        eventAuthority: PUMP_AMM_EVENT_AUTHORITY_PDA,
        program: PUMP_AMM_PROGRAM_ID,
        coinCreatorVaultAta,
        coinCreatorVaultAuthority,
        feeConfig: AMM_FEE_CONFIG_PDA,
        feeProgram: PUMP_FEE_PROGRAM_ID,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();
  }

  // PumpSwap v2 Trades

  /**
   * PumpSwap `buy_v2`: buys exactly `baseAmountOut` for at most
   * `maxQuoteAmountIn` (fees included). Same prices and fee rates as `buy`;
   * the protocol and creator fees stay in the pool for a later sweep (see
   * `ammTradeV2Accounts`). Works on any quote mint. Refused for cashback
   * coins (use `ammBuyInstruction`).
   */
  async ammBuyV2Instruction({
    user,
    pool,
    mint,
    baseAmountOut,
    maxQuoteAmountIn,
    quoteMint,
    baseTokenProgram,
    quoteTokenProgram,
    buybackFeeRecipient,
  }: {
    user: PublicKey;
    pool: PublicKey;
    mint: PublicKey;
    baseAmountOut: BN;
    maxQuoteAmountIn: BN;
    quoteMint?: PublicKey;
    baseTokenProgram?: PublicKey;
    quoteTokenProgram?: PublicKey;
    buybackFeeRecipient?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .buyV2(baseAmountOut, maxQuoteAmountIn)
      .accountsPartial(
        ammTradeV2Accounts({
          user,
          pool,
          mint,
          quoteMint,
          baseTokenProgram,
          quoteTokenProgram,
          buybackFeeRecipient,
        }),
      )
      .instruction();
  }

  /**
   * PumpSwap `buy_exact_quote_in_v2`: spends exactly `spendableQuoteIn`
   * (fees included) and requires at least `minBaseAmountOut`. Accounts as in
   * `ammBuyV2Instruction`.
   */
  async ammBuyExactQuoteInV2Instruction({
    user,
    pool,
    mint,
    spendableQuoteIn,
    minBaseAmountOut,
    quoteMint,
    baseTokenProgram,
    quoteTokenProgram,
    buybackFeeRecipient,
  }: {
    user: PublicKey;
    pool: PublicKey;
    mint: PublicKey;
    spendableQuoteIn: BN;
    minBaseAmountOut: BN;
    quoteMint?: PublicKey;
    baseTokenProgram?: PublicKey;
    quoteTokenProgram?: PublicKey;
    buybackFeeRecipient?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .buyExactQuoteInV2(spendableQuoteIn, minBaseAmountOut)
      .accountsPartial(
        ammTradeV2Accounts({
          user,
          pool,
          mint,
          quoteMint,
          baseTokenProgram,
          quoteTokenProgram,
          buybackFeeRecipient,
        }),
      )
      .instruction();
  }

  /**
   * PumpSwap `sell_v2`: sells exactly `baseAmountIn` for at least
   * `minQuoteAmountOut` (net of fees). Accounts as in `ammBuyV2Instruction`.
   */
  async ammSellV2Instruction({
    user,
    pool,
    mint,
    baseAmountIn,
    minQuoteAmountOut,
    quoteMint,
    baseTokenProgram,
    quoteTokenProgram,
    buybackFeeRecipient,
  }: {
    user: PublicKey;
    pool: PublicKey;
    mint: PublicKey;
    baseAmountIn: BN;
    minQuoteAmountOut: BN;
    quoteMint?: PublicKey;
    baseTokenProgram?: PublicKey;
    quoteTokenProgram?: PublicKey;
    buybackFeeRecipient?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .sellV2(baseAmountIn, minQuoteAmountOut)
      .accountsPartial(
        ammTradeV2Accounts({
          user,
          pool,
          mint,
          quoteMint,
          baseTokenProgram,
          quoteTokenProgram,
          buybackFeeRecipient,
        }),
      )
      .instruction();
  }

  /**
   * Deposit liquidity into an AMM pool (LP provision).
   */
  async ammDepositInstruction({
    user,
    pool,
    mint,
    maxBaseAmountIn,
    maxQuoteAmountIn,
    minLpTokenAmountOut,
  }: {
    user: PublicKey;
    pool: PublicKey;
    mint: PublicKey;
    maxBaseAmountIn: BN;
    maxQuoteAmountIn: BN;
    minLpTokenAmountOut: BN;
  }): Promise<TransactionInstruction> {
    const userBaseAta = getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      TOKEN_2022_PROGRAM_ID,
    );
    const userQuoteAta = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      user,
      true,
      TOKEN_PROGRAM_ID,
    );
    return await this.offlinePumpAmmProgram.methods
      .deposit(minLpTokenAmountOut, maxBaseAmountIn, maxQuoteAmountIn)
      .accountsPartial({
        user,
        pool,
        userBaseTokenAccount: userBaseAta,
        userQuoteTokenAccount: userQuoteAta,
      })
      .instruction();
  }

  /**
   * Withdraw liquidity from an AMM pool.
   */
  async ammWithdrawInstruction({
    user,
    pool,
    mint,
    lpTokenAmountIn,
    minBaseAmountOut,
    minQuoteAmountOut,
  }: {
    user: PublicKey;
    pool: PublicKey;
    mint: PublicKey;
    lpTokenAmountIn: BN;
    minBaseAmountOut: BN;
    minQuoteAmountOut: BN;
  }): Promise<TransactionInstruction> {
    const userBaseAta = getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      TOKEN_2022_PROGRAM_ID,
    );
    const userQuoteAta = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      user,
      true,
      TOKEN_PROGRAM_ID,
    );
    return await this.offlinePumpAmmProgram.methods
      .withdraw(lpTokenAmountIn, minBaseAmountOut, minQuoteAmountOut)
      .accountsPartial({
        user,
        pool,
        userBaseTokenAccount: userBaseAta,
        userQuoteTokenAccount: userQuoteAta,
      })
      .instruction();
  }

  /**
   * Migrate AMM pool coin creator — updates the pool's creator
   * based on the fee sharing config.
   */
  async ammMigratePoolCoinCreatorInstruction({
    pool,
    mint,
  }: {
    pool: PublicKey;
    mint: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .migratePoolCoinCreator()
      .accountsPartial({
        pool,
        sharingConfig: feeSharingConfigPda(mint),
      })
      .instruction();
  }

  /**
   * Transfer creator fees from AMM pool to the Pump program.
   */
  async ammTransferCreatorFeesToPumpInstruction({
    coinCreator,
  }: {
    coinCreator: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .transferCreatorFeesToPump()
      .accountsPartial({
        coinCreator,
        pumpCreatorVault: creatorVaultPda(coinCreator),
      })
      .instruction();
  }

  /**
   * Collect creator fees from an AMM pool.
   */
  async ammCollectCoinCreatorFeeInstruction({
    creator,
  }: {
    creator: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .collectCoinCreatorFee()
      .accountsPartial({
        coinCreator: creator,
      })
      .instruction();
  }

  /**
   * Set the coin creator for an AMM pool from bonding curve metadata.
   */
  async ammSetCoinCreatorInstruction({
    pool,
    mint,
  }: {
    pool: PublicKey;
    mint: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .setCoinCreator()
      .accountsPartial({
        pool,
        bondingCurve: bondingCurvePda(mint),
      })
      .instruction();
  }

  /**
   * Claim cashback from AMM trading.
   */
  async ammClaimCashbackInstruction({
    user,
  }: {
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .claimCashback()
      .accountsPartial({
        user,
      })
      .instruction();
  }

  /**
   * Sync user volume accumulator on the AMM program.
   */
  async ammSyncUserVolumeAccumulatorInstruction(
    user: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .syncUserVolumeAccumulator()
      .accountsPartial({ user })
      .instruction();
  }

  async ammInitUserVolumeAccumulatorInstruction({
    payer,
    user,
  }: {
    payer: PublicKey;
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .initUserVolumeAccumulator()
      .accountsPartial({ payer, user })
      .instruction();
  }

  async ammCloseUserVolumeAccumulatorInstruction(
    user: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .closeUserVolumeAccumulator()
      .accountsPartial({ user })
      .instruction();
  }

  async ammClaimTokenIncentivesInstruction({
    user,
    payer,
    mint = PUMP_TOKEN_MINT,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
  }: {
    user: PublicKey;
    payer: PublicKey;
    mint?: PublicKey;
    tokenProgram?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .claimTokenIncentives()
      .accountsPartial({ user, payer, mint, tokenProgram })
      .instruction();
  }

  async ammToggleCashbackEnabledInstruction({
    admin,
    enabled,
  }: {
    admin: PublicKey;
    enabled: boolean;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .toggleCashbackEnabled(enabled)
      .accountsPartial({ admin })
      .instruction();
  }

  async ammToggleMayhemModeInstruction({
    admin,
    enabled,
  }: {
    admin: PublicKey;
    enabled: boolean;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .toggleMayhemMode(enabled)
      .accountsPartial({ admin })
      .instruction();
  }

  async ammExtendAccountInstruction({
    account,
    user,
  }: {
    account: PublicKey;
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .extendAccount()
      .accountsPartial({ account, user })
      .instruction();
  }

  async ammSetReservedFeeRecipientsInstruction({
    admin,
    whitelistPda,
  }: {
    admin: PublicKey;
    whitelistPda: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .setReservedFeeRecipients(whitelistPda)
      .accountsPartial({ admin })
      .instruction();
  }

  async ammCreateConfigInstruction({
    admin,
    lpFeeBasisPoints,
    protocolFeeBasisPoints,
    protocolFeeRecipients,
    coinCreatorFeeBasisPoints,
    adminSetCoinCreatorAuthority,
  }: {
    admin: PublicKey;
    lpFeeBasisPoints: BN;
    protocolFeeBasisPoints: BN;
    protocolFeeRecipients: PublicKey[];
    coinCreatorFeeBasisPoints: BN;
    adminSetCoinCreatorAuthority: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .createConfig(
        lpFeeBasisPoints,
        protocolFeeBasisPoints,
        protocolFeeRecipients,
        coinCreatorFeeBasisPoints,
        adminSetCoinCreatorAuthority,
      )
      .accountsPartial({ admin })
      .instruction();
  }

  async ammUpdateAdminInstruction({
    admin,
    newAdmin,
  }: {
    admin: PublicKey;
    newAdmin: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .updateAdmin()
      .accountsPartial({ admin, newAdmin })
      .instruction();
  }

  async ammUpdateFeeConfigInstruction({
    admin,
    lpFeeBasisPoints,
    protocolFeeBasisPoints,
    protocolFeeRecipients,
    coinCreatorFeeBasisPoints,
    adminSetCoinCreatorAuthority,
  }: {
    admin: PublicKey;
    lpFeeBasisPoints: BN;
    protocolFeeBasisPoints: BN;
    protocolFeeRecipients: PublicKey[];
    coinCreatorFeeBasisPoints: BN;
    adminSetCoinCreatorAuthority: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .updateFeeConfig(
        lpFeeBasisPoints,
        protocolFeeBasisPoints,
        protocolFeeRecipients,
        coinCreatorFeeBasisPoints,
        adminSetCoinCreatorAuthority,
      )
      .accountsPartial({ admin })
      .instruction();
  }

  async ammDisableInstruction({
    admin,
    disableCreatePool,
    disableDeposit,
    disableWithdraw,
    disableBuy,
    disableSell,
  }: {
    admin: PublicKey;
    disableCreatePool: boolean;
    disableDeposit: boolean;
    disableWithdraw: boolean;
    disableBuy: boolean;
    disableSell: boolean;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .disable(
        disableCreatePool,
        disableDeposit,
        disableWithdraw,
        disableBuy,
        disableSell,
      )
      .accountsPartial({ admin })
      .instruction();
  }

  async ammAdminUpdateTokenIncentivesInstruction({
    admin,
    mint = PUMP_TOKEN_MINT,
    tokenProgram = TOKEN_2022_PROGRAM_ID,
    startTime,
    endTime,
    secondsInADay = new BN(86_400),
    dayNumber,
    tokenSupplyPerDay,
  }: {
    admin: PublicKey;
    mint?: PublicKey;
    tokenProgram?: PublicKey;
    startTime: BN;
    endTime: BN;
    secondsInADay?: BN;
    dayNumber: BN;
    tokenSupplyPerDay: BN;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .adminUpdateTokenIncentives(
        startTime,
        endTime,
        secondsInADay,
        dayNumber,
        tokenSupplyPerDay,
      )
      .accountsPartial({ admin, mint, tokenProgram })
      .instruction();
  }

  // ─── PumpFees Instructions ─────────────────────────────────────────

  /**
   * Create a social fee PDA for referral/social fee sharing.
   *
   * @param params.payer - Any signer account that pays for the transaction.
   * @param params.userId - Must be the GitHub user id returned by `https://api.github.com/users/<github-username>`.
   * @param params.platform - Only `github` is supported at the moment. Check `SUPPORTED_SOCIAL_PLATFORMS`.
   */
  async createSocialFeePdaInstruction({
    payer,
    userId,
    platform,
  }: {
    payer: PublicKey;
    userId: string;
    platform: Platform;
  }): Promise<TransactionInstruction> {
    if (!SUPPORTED_SOCIAL_PLATFORMS.includes(platform)) {
      const supportedPlatformNames = SUPPORTED_SOCIAL_PLATFORMS.map(
        (supportedPlatform) => platformToString(supportedPlatform),
      ).join(", ");
      throw new Error(
        `Unsupported platform "${platform}" for userId "${userId}". Supported platforms: ${supportedPlatformNames}.`,
      );
    }

    return await this.offlinePumpFeeProgram.methods
      .createSocialFeePda(userId, platform)
      .accountsPartial({
        payer,
        socialFeePda: socialFeePdaHelper(userId, platform),
      })
      .instruction();
  }

  /**
   * Claim accumulated social/referral fees.
   */
  async claimSocialFeePdaInstruction({
    recipient,
    socialClaimAuthority,
    userId,
    platform,
  }: {
    recipient: PublicKey;
    socialClaimAuthority: PublicKey;
    userId: string;
    platform: Platform;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .claimSocialFeePda(userId, platform)
      .accountsPartial({
        recipient,
        socialClaimAuthority,
      })
      .instruction();
  }

  normalizeSocialShareholders(params: Parameters<typeof normalizeSocialShareholders>[0]) {
    return normalizeSocialShareholders(params);
  }

  /**
   * Wrapper around `updateFeeShares` that resolves social recipients and
   * initializes any missing social recipient PDAs before updating fee shares.
   *
   * Warning:
   * - sharing config must exist for that mint
   * - `userId` must be the GitHub user id returned by `https://api.github.com/users/<github-username>`.
   * - Only `github` is supported at the moment. Check `SUPPORTED_SOCIAL_PLATFORMS`
   */
  async updateSharingConfigWithSocialRecipients({
    authority,
    mint,
    currentShareholders,
    newShareholders,
  }: {
    authority: PublicKey;
    mint: PublicKey;
    currentShareholders: PublicKey[];
    newShareholders: Array<{
      shareBps: number;
      address?: PublicKey;
      userId?: string;
      platform?: Platform;
    }>;
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];
    const { normalizedShareholders, socialRecipientsToCreate } =
      this.normalizeSocialShareholders({ newShareholders });

    for (const recipient of socialRecipientsToCreate.values()) {
      instructions.push(
        await this.createSocialFeePdaInstruction({
          payer: authority,
          userId: recipient.userId,
          platform: recipient.platform,
        }),
      );
    }

    instructions.push(
      await this.updateFeeShares({
        authority,
        mint,
        currentShareholders,
        newShareholders: normalizedShareholders,
      }),
    );

    return instructions;
  }

  /**
   * Wrapper around `createFeeSharingConfig` that resolves social recipients and
   * initializes any missing social recipient PDAs.
   *
   * Warning:
   * - `userId` must be the GitHub user id returned by `https://api.github.com/users/<github-username>`.
   * - Only `github` is supported at the moment. Check `SUPPORTED_SOCIAL_PLATFORMS`
   */
  async createSharingConfigWithSocialRecipients({
    creator,
    mint,
    pool,
    newShareholders,
  }: {
    creator: PublicKey;
    mint: PublicKey;
    pool: PublicKey | null;
    newShareholders: Array<{
      shareBps: number;
      address?: PublicKey;
      userId?: string;
      platform?: Platform;
    }>;
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    instructions.push(
      await this.createFeeSharingConfig({
        creator,
        mint,
        pool,
      }),
    );

    instructions.push(
      ...(await this.updateSharingConfigWithSocialRecipients({
        authority: creator,
        mint,
        currentShareholders: [creator],
        newShareholders,
      })),
    );

    return instructions;
  }

  /**
   * Transfer fee sharing authority to a new address.
   */
  async transferFeeSharingAuthorityInstruction({
    authority,
    mint,
    newAdmin,
  }: {
    authority: PublicKey;
    mint: PublicKey;
    newAdmin: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .transferFeeSharingAuthority()
      .accountsPartial({
        authority,
        mint,
        newAdmin,
        sharingConfig: feeSharingConfigPda(mint),
      })
      .instruction();
  }

  /**
   * Permanently revoke fee sharing authority.
   * After this, no one can modify the fee sharing configuration.
   */
  async revokeFeeSharingAuthorityInstruction({
    authority,
    mint,
  }: {
    authority: PublicKey;
    mint: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .revokeFeeSharingAuthority()
      .accountsPartial({
        authority,
        mint,
        sharingConfig: feeSharingConfigPda(mint),
      })
      .instruction();
  }

  /**
   * Set the claim rate limit for anti-abuse throttling.
   */
  async setClaimRateLimitInstruction({
    authority,
    claimRateLimit,
  }: {
    authority: PublicKey;
    claimRateLimit: BN;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .setClaimRateLimit(claimRateLimit)
      .accountsPartial({
        authority,
      })
      .instruction();
  }

  /**
   * Set the social claim authority.
   */
  async setSocialClaimAuthorityInstruction({
    authority,
    socialClaimAuthority,
  }: {
    authority: PublicKey;
    socialClaimAuthority: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .setSocialClaimAuthority(socialClaimAuthority)
      .accountsPartial({
        authority,
      })
      .instruction();
  }

  /**
   * Upsert (create or update) fee tiers for the protocol.
   */
  async upsertFeeTiersInstruction({
    admin,
    feeTiers,
    offset = 0,
  }: {
    admin: PublicKey;
    feeTiers: Array<{
      marketCapLamportsThreshold: BN;
      fees: { lpFeeBps: BN; protocolFeeBps: BN; creatorFeeBps: BN };
    }>;
    offset?: number;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .upsertFeeTiers(feeTiers, offset)
      .accountsPartial({
        admin,
      })
      .instruction();
  }

  async initializeFeeConfigInstruction({
    admin,
    configProgramId,
  }: {
    admin: PublicKey;
    configProgramId: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .initializeFeeConfig()
      .accountsPartial({ admin, configProgramId })
      .instruction();
  }

  async initializeFeeProgramGlobalInstruction({
    authority,
    socialClaimAuthority,
    disableFlags,
    claimRateLimit,
  }: {
    authority: PublicKey;
    socialClaimAuthority: PublicKey;
    disableFlags: number;
    claimRateLimit: BN;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .initializeFeeProgramGlobal(socialClaimAuthority, disableFlags, claimRateLimit)
      .accountsPartial({ authority })
      .instruction();
  }

  async setFeeAuthorityInstruction({
    authority,
    newAuthority,
  }: {
    authority: PublicKey;
    newAuthority: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .setAuthority(newAuthority)
      .accountsPartial({ authority })
      .instruction();
  }

  async setFeeDisableFlagsInstruction({
    authority,
    disableFlags,
  }: {
    authority: PublicKey;
    disableFlags: number;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .setDisableFlags(disableFlags)
      .accountsPartial({ authority })
      .instruction();
  }

  async feesUpdateAdminInstruction({
    admin,
    newAdmin,
    configProgramId,
  }: {
    admin: PublicKey;
    newAdmin: PublicKey;
    configProgramId: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .updateAdmin()
      .accountsPartial({ admin, newAdmin, configProgramId })
      .instruction();
  }

  async feesUpdateFeeConfigInstruction({
    admin,
    configProgramId,
    feeTiers,
    flatFees,
  }: {
    admin: PublicKey;
    configProgramId: PublicKey;
    feeTiers: Array<{
      marketCapLamportsThreshold: BN;
      fees: { lpFeeBps: BN; protocolFeeBps: BN; creatorFeeBps: BN };
    }>;
    flatFees: { lpFeeBps: BN; protocolFeeBps: BN; creatorFeeBps: BN };
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .updateFeeConfig(feeTiers, flatFees)
      .accountsPartial({ admin, configProgramId })
      .instruction();
  }

  /** Alias for {@link createSocialFeePdaInstruction} — matches `@pump-fun/pump-sdk` naming. */
  createSocialFeePda(
    params: Parameters<PumpSdk["createSocialFeePdaInstruction"]>[0],
  ): ReturnType<PumpSdk["createSocialFeePdaInstruction"]> {
    return this.createSocialFeePdaInstruction(params);
  }

  /** Not user-callable — social fee PDA claims are executed internally by the pump program. */
  claimSocialFeePda(): never {
    throw new Error(
      "claimSocialFeePda can only be called by the pump program and is not supported for external use",
    );
  }
}

/** Pre-built singleton instance of {@link PumpSdk}. Use this instead of `new PumpSdk()`. */
export const PUMP_SDK = new PumpSdk();

/**
 * Checks if a creator has upgraded to using a fee sharing configuration.
 *
 * When a creator sets up fee sharing, the creator address in the BondingCurve or Pool
 * is replaced with the fee sharing config PDA address. This function checks if that
 * upgrade has occurred.
 *
 * @param params - Parameters for checking upgrade status
 * @param params.mint - The mint address of the token
 * @param params.creator - The creator address to check
 *                         - For ungraduated coins: use BondingCurve.creator
 *                         - For graduated coins: use Pool.coinCreator (from AMM pool)
 * @returns true if the creator has migrated to fee sharing config, false otherwise
 * @example
 * ```typescript
 * import { isCreatorUsingSharingConfig } from "@pump-fun/sdk";
 *
 * // For an ungraduated coin
 * const bondingCurve = await program.account.bondingCurve.fetch(bondingCurvePda(mint));
 * const hasMigrated = isCreatorUsingSharingConfig({
 *   mint,
 *   creator: bondingCurve.creator
 * });
 *
 * // For a graduated coin
 * const pool = await ammProgram.account.pool.fetch(poolAddress);
 * const hasMigrated = isCreatorUsingSharingConfig({
 *   mint,
 *   creator: pool.coinCreator
 * });
 *
 * if (hasMigrated) {
 *   // Creator fees are distributed according to fee sharing config
 * } else {
 *   // Creator fees go directly to the creator address
 * }
 * ```
 */
export function isCreatorUsingSharingConfig({
  mint,
  creator,
}: {
  mint: PublicKey;
  creator: PublicKey;
}): boolean {
  return feeSharingConfigPda(mint).equals(creator);
}

/** Social shareholder input — either a wallet address or a social-platform user. */
export type SocialShareholderInput = {
  shareBps: number;
  address?: PublicKey;
  userId?: string;
  platform?: Platform;
};

/**
 * Resolve social handles to their on-chain PDAs and collect any PDAs that
 * still need to be created before a fee-sharing config can be submitted.
 */
export function normalizeSocialShareholders({
  newShareholders,
}: {
  newShareholders: SocialShareholderInput[];
}): {
  normalizedShareholders: Shareholder[];
  socialRecipientsToCreate: Map<string, { userId: string; platform: Platform }>;
} {
  const socialRecipientsToCreate = new Map<
    string,
    { userId: string; platform: Platform }
  >();
  const normalizedShareholders: Shareholder[] = newShareholders.map(
    (shareholder) => {
      if (shareholder.address) {
        return { address: shareholder.address, shareBps: shareholder.shareBps };
      }

      if (
        typeof shareholder.userId === "string" &&
        typeof shareholder.platform === "number"
      ) {
        if (!SUPPORTED_SOCIAL_PLATFORMS.includes(shareholder.platform)) {
          const supportedPlatformNames = SUPPORTED_SOCIAL_PLATFORMS.map(
            (platform) => platformToString(platform),
          ).join(", ");
          throw new Error(
            `Unsupported platform "${shareholder.platform}" for userId "${shareholder.userId}". Supported platforms: ${supportedPlatformNames}.`,
          );
        }

        const recipientPda = socialFeePdaHelper(
          shareholder.userId,
          shareholder.platform,
        );
        socialRecipientsToCreate.set(recipientPda.toBase58(), {
          userId: shareholder.userId,
          platform: shareholder.platform,
        });

        return { address: recipientPda, shareBps: shareholder.shareBps };
      }

      throw new Error(
        "Each new shareholder must provide either an address or both userId and platform.",
      );
    },
  );

  return { normalizedShareholders, socialRecipientsToCreate };
}

/**
 * Checks whether a fee sharing config's reward split is editable.
 *
 * NOT editable when:
 * - version === 1 (legacy, immutable)
 * - version === 2 and adminRevoked === true
 */
export function isSharingConfigEditable({
  sharingConfig,
}: {
  sharingConfig: SharingConfig;
}): boolean {
  if (sharingConfig.version === 1) return false;
  if (sharingConfig.version === 2 && sharingConfig.adminRevoked) return false;
  return true;
}
