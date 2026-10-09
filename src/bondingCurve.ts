import { NATIVE_MINT_2022 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import {
  CurveDepthExceededError,
  QuoteBondingCurveNotEligibleError,
  QuoteCurveAwaitingMigrationError,
  QuoteReservesOutOfRangeError,
  SellOverflowError,
  UnsupportedQuoteMintError,
} from "./errors";
import { computeFeesBps, getFee, ONE_BILLION_SUPPLY } from "./fees";
import { isLegacyQuoteMint } from "./pda";
import type { BondingCurve, FeeConfig, Global, QuoteControl } from "./state";

/**
 * u64::MAX = 2^64 - 1 = 18_446_744_073_709_551_615
 *
 * The deployed pump program widens to u128 before multiplying
 * `amount * virtualSolReserves` in the sell formula, so the intermediate
 * product overflows only past u128::MAX. Token amounts are themselves u64
 * on-chain, which is the binding constraint in every realistic case: at
 * mainnet reserve sizes the u128 product limit sits many orders of magnitude
 * above u64::MAX.
 *
 * This bound was previously derived from u64::MAX, which rejected the great
 * majority of real sells: sampling live mainnet trade events, 344 of 417
 * landed sells (83%) exceeded the old limit, some by more than 2000x. Any
 * caller reaching `sellInstructions` for an ordinary position size got a
 * `SellOverflowError` for a transaction the chain would have accepted.
 */
const U64_MAX = new BN("18446744073709551615");
const U128_MAX = new BN("340282366920938463463374607431768211455");
const SELL_SAFETY_MARGIN = U128_MAX.muln(9).divn(10);

/**
 * Maximum token amount that is safe to sell in a single sell instruction for
 * the given reserves.
 *
 * The limit is the smaller of u64::MAX (the on-chain width of a token amount)
 * and `floor(0.9 * u128::MAX / virtualSolReserves)` (the intermediate product
 * bound, with a 10% margin absorbing reserve drift between quote and
 * execution). A migrated curve has zero reserves and cannot be sold on at
 * all, so the product can never overflow and the limit is u64::MAX.
 */
export function maxSafeSellAmount(virtualSolReserves: BN): BN {
  if (virtualSolReserves.isZero()) return U64_MAX;
  return BN.min(U64_MAX, SELL_SAFETY_MARGIN.div(virtualSolReserves));
}

/**
 * Throws `SellOverflowError` if the sell amount would overflow the on-chain
 * arithmetic. Use this as a pre-flight check before building sell
 * instructions.
 */
export function validateSellAmount(
  amount: BN,
  bondingCurve: BondingCurve,
): void {
  const max = maxSafeSellAmount(bondingCurve.virtualQuoteReserves);
  if (amount.gt(max)) {
    throw new SellOverflowError(amount, bondingCurve.virtualQuoteReserves, max);
  }
}

/**
 * The virtual quote reserves a curve quoted in `quoteMint` starts from, the
 * way `create_v2` seeds it:
 *
 * - SOL (WSOL or the zero key): `Global.initialVirtualSolReserves`.
 * - A mint in `Global.whitelistedQuoteMints`: `Global.initialVirtualQuoteReserves`
 *   (even when `QuoteControl` lists it too).
 * - A mint listed in `QuoteControl`: that entry's starting reserves.
 * - A pump coin listed nowhere (pass `pumpQuote`): derived from the coin's
 *   own curve or pool (`pumpQuoteReserves`).
 *
 * Anything else throws `UnsupportedQuoteMintError`, because quoting a mint the
 * program rejects would put a curve on a starting price the chain will never
 * agree with. The Token-2022 native mint always throws: `create_v2` rejects
 * it before consulting either list.
 *
 * @param quoteControl - The decoded `QuoteControl` PDA, or `null` when it
 *   does not exist. When omitted, the one fetched with `pumpQuote` is used.
 * @param pumpQuote - When `quoteMint` is a pump coin: its curve, and its pool
 *   once migrated.
 */
export function initialVirtualQuoteReservesFor(
  global: Global,
  quoteMint: PublicKey,
  quoteControl?: QuoteControl | null,
  pumpQuote?: PumpQuoteCurve,
): BN {
  if (isLegacyQuoteMint(quoteMint)) {
    return global.initialVirtualSolReserves;
  }
  if (quoteMint.equals(NATIVE_MINT_2022)) {
    throw new UnsupportedQuoteMintError(quoteMint);
  }
  if (global.whitelistedQuoteMints.some((mint) => mint.equals(quoteMint))) {
    return global.initialVirtualQuoteReserves;
  }
  const list =
    quoteControl !== undefined ? quoteControl : pumpQuote?.quoteControl;
  const entry = list?.mints.find((candidate) =>
    candidate.mint.equals(quoteMint),
  );
  if (entry) {
    return entry.initialVirtualQuoteReserves;
  }
  if (pumpQuote) {
    if (!pumpQuote.mint.equals(quoteMint)) {
      throw new Error(
        `pumpQuote is for ${pumpQuote.mint.toBase58()}, not the quote mint ${quoteMint.toBase58()}`,
      );
    }
    return pumpQuoteReserves(global, pumpQuote, list ?? null)
      .virtualQuoteReserves;
  }
  throw new UnsupportedQuoteMintError(quoteMint);
}

/**
 * A pump coin Q offered as a `create_v2` quote mint (listed neither on
 * `Global` nor in `QuoteControl`): what the program reads to admit it and to
 * seed the new curve.
 */
export interface PumpQuoteCurve {
  /** Q's mint. */
  mint: PublicKey;
  /** Q's decoded bonding curve. */
  bondingCurve: BondingCurve;
  /**
   * Once Q's curve has migrated: its canonical pool's base vault balance,
   * quote vault balance and signed `Pool.virtualQuoteReserves`.
   */
  pool?: { baseReserves: BN; quoteReserves: BN; virtualQuoteReserves: BN };
  /**
   * The `QuoteControl` PDA as fetched with Q (`null` when it does not exist).
   * A depth-0 Q quoted in a QuoteControl mint seeds from its entry.
   */
  quoteControl?: QuoteControl | null;
}

/** pump `BondingCurve::is_migrated`: every reserve zeroed by the migration. */
export function isBondingCurveMigrated(bondingCurve: BondingCurve): boolean {
  return (
    bondingCurve.realQuoteReserves.isZero() &&
    bondingCurve.virtualQuoteReserves.isZero() &&
    bondingCurve.realTokenReserves.isZero() &&
    bondingCurve.virtualTokenReserves.isZero()
  );
}

/**
 * The reference seed a coin quoted in Q is priced against: what a fresh curve
 * in Q's own quote would start from (depth-0 Q), or Q's own starting reserves
 * (deeper Q).
 */
function pumpQuoteTarget(
  global: Global,
  quote: Pick<PumpQuoteCurve, "mint" | "bondingCurve">,
  quoteControl: QuoteControl | null,
): BN {
  const curve = quote.bondingCurve;
  if (curve.depth > 0) {
    return curve.initialVirtualQuoteReserves;
  }
  if (curve.quoteMint.equals(PublicKey.default)) {
    return global.initialVirtualSolReserves;
  }
  if (global.whitelistedQuoteMints.some((m) => m.equals(curve.quoteMint))) {
    return global.initialVirtualQuoteReserves;
  }
  const entry = quoteControl?.mints.find((candidate) =>
    candidate.mint.equals(curve.quoteMint),
  );
  if (!entry) {
    throw new QuoteBondingCurveNotEligibleError(quote.mint);
  }
  return entry.initialVirtualQuoteReserves;
}

/**
 * The checks `create_v2` runs on pump coin Q before it reads any price, in
 * the program's order: the depth gate (`CurveDepthExceededError`), then
 * eligibility (`QuoteBondingCurveNotEligibleError`: mayhem mode, or a depth-0
 * Q whose own quote no list admits). Returns the new coin's depth and the
 * reference seed. Needs only Q's curve, so it can run before Q's pool is
 * fetched.
 */
export function pumpQuoteAdmission(
  global: Global,
  quote: Pick<PumpQuoteCurve, "mint" | "bondingCurve" | "quoteControl">,
  quoteControl?: QuoteControl | null,
): { depth: number; target: BN } {
  const curve = quote.bondingCurve;
  const depth = curve.depth + 1;
  if (depth > global.maxCurveDepth) {
    throw new CurveDepthExceededError(depth, global.maxCurveDepth);
  }
  if (curve.isMayhemMode) {
    throw new QuoteBondingCurveNotEligibleError(quote.mint);
  }
  const target = pumpQuoteTarget(
    global,
    quote,
    quoteControl !== undefined ? quoteControl : (quote.quoteControl ?? null),
  );
  return { depth, target };
}

/**
 * The `virtualQuoteReserves` and `depth` `create_v2` gives a coin quoted in
 * pump coin Q. The reference seed's graduation raise is bought on Q's
 * constant product (`base * raise / (quote + raise)`) and scaled back by the
 * raise ratio. Q's price comes from its pool once migrated (with the pool's
 * signed virtual quote reserves added) and from its curve before.
 *
 * Throws the typed error the program's refusal maps to:
 * `CurveDepthExceededError` (6105), `QuoteBondingCurveNotEligibleError`
 * (6100), `QuoteCurveAwaitingMigrationError` (6107) and
 * `QuoteReservesOutOfRangeError` (6104).
 */
export function pumpQuoteReserves(
  global: Global,
  quote: PumpQuoteCurve,
  quoteControl?: QuoteControl | null,
): { virtualQuoteReserves: BN; depth: number } {
  const curve = quote.bondingCurve;
  const { depth, target } = pumpQuoteAdmission(global, quote, quoteControl);

  let base: BN;
  let quoteSide: BN;
  if (isBondingCurveMigrated(curve)) {
    if (!quote.pool) {
      throw new Error(
        `Pump coin ${quote.mint.toBase58()} has migrated: its pool reserves are required`,
      );
    }
    base = quote.pool.baseReserves;
    quoteSide = quote.pool.quoteReserves.add(quote.pool.virtualQuoteReserves);
  } else {
    if (curve.complete) {
      throw new QuoteCurveAwaitingMigrationError(quote.mint);
    }
    base = curve.virtualTokenReserves;
    quoteSide = curve.virtualQuoteReserves;
  }
  // The program refuses these with Overflow / DivisionByZero.
  if (quoteSide.isNeg()) {
    throw new Error(
      `Pump coin ${quote.mint.toBase58()}: negative effective pool quote reserves (Overflow)`,
    );
  }
  if (quoteSide.isZero()) {
    throw new Error(
      `Pump coin ${quote.mint.toBase58()}: zero quote reserves (DivisionByZero)`,
    );
  }

  const tradable = global.initialVirtualTokenReserves.sub(
    global.initialRealTokenReserves,
  );
  const raise = getBuyTokenAmountFromSolAmountQuote({
    inputAmount: target.mul(global.initialRealTokenReserves).div(tradable),
    virtualTokenReserves: base,
    virtualSolReserves: quoteSide,
  });
  const derived = raise.mul(tradable).div(global.initialRealTokenReserves);
  if (derived.ltn(1)) {
    throw new QuoteReservesOutOfRangeError(quote.mint, derived);
  }
  return { virtualQuoteReserves: derived, depth };
}

/**
 * Create a new bonding curve state the way `create_v2` would initialize it.
 * Used when simulating a buy on a token that hasn't been created yet.
 *
 * @param global         - The program's `Global` account.
 * @param quoteMint      - The mint the curve is quoted in. Defaults to SOL,
 *                         which the program stores as the zero key.
 * @param quoteControl   - See `initialVirtualQuoteReservesFor`; required for
 *                         a QuoteControl mint.
 * @param creatorFeeBps  - The `creator_fee_bps` the create is sent with
 *                         (omitted or zero: the schedule rate).
 * @param isHolderReward - Whether the create is sent with `holderReward`.
 * @param pumpQuote      - When `quoteMint` is a pump coin listed nowhere; sets
 *                         the derived seed and `depth`.
 */
export function newBondingCurve(
  global: Global,
  quoteMint: PublicKey = PublicKey.default,
  quoteControl?: QuoteControl | null,
  creatorFeeBps?: BN,
  isHolderReward = false,
  pumpQuote?: PumpQuoteCurve,
): BondingCurve {
  const virtualQuoteReserves = initialVirtualQuoteReservesFor(
    global,
    quoteMint,
    quoteControl,
    pumpQuote,
  );
  // A listed quote wins over the pump-quote path, as in `create_v2`.
  const listedIn =
    quoteControl !== undefined ? quoteControl : pumpQuote?.quoteControl;
  const isPumpQuoted =
    pumpQuote != null &&
    !isLegacyQuoteMint(quoteMint) &&
    !global.whitelistedQuoteMints.some((mint) => mint.equals(quoteMint)) &&
    !listedIn?.mints.some((entry) => entry.mint.equals(quoteMint));

  return {
    virtualTokenReserves: global.initialVirtualTokenReserves,
    virtualQuoteReserves,
    realTokenReserves: global.initialRealTokenReserves,
    realQuoteReserves: new BN(0),
    tokenTotalSupply: global.tokenTotalSupply,
    complete: false,
    creator: PublicKey.default,
    isMayhemMode: global.mayhemModeEnabled,
    isCashbackCoin: false,
    // Stored the way the program stores it: the zero key on a SOL curve.
    quoteMint: isLegacyQuoteMint(quoteMint) ? PublicKey.default : quoteMint,
    creatorFeeBps: creatorFeeBps ?? new BN(0),
    canEditCreatorFee: false,
    isHolderReward,
    creatorFee: new BN(0),
    protocolFees: new BN(0),
    depth: isPumpQuoted ? pumpQuote.bondingCurve.depth + 1 : 0,
    initialVirtualQuoteReserves: virtualQuoteReserves,
    postCompleteBaseOut: new BN(0),
    postCompleteQuoteIn: new BN(0),
  };
}

function getBuySolAmountFromTokenAmountQuote({
  minAmount,
  virtualTokenReserves,
  virtualSolReserves,
}: {
  minAmount: BN;
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
}): BN {
  return minAmount
    .mul(virtualSolReserves)
    .div(virtualTokenReserves.sub(minAmount))
    .add(new BN(1));
}

function getBuyTokenAmountFromSolAmountQuote({
  inputAmount,
  virtualTokenReserves,
  virtualSolReserves,
}: {
  inputAmount: BN;
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
}): BN {
  return inputAmount
    .mul(virtualTokenReserves)
    .div(virtualSolReserves.add(inputAmount));
}

function getSellSolAmountFromTokenAmountQuote({
  inputAmount,
  virtualTokenReserves,
  virtualSolReserves,
}: {
  inputAmount: BN;
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
}): BN {
  return inputAmount
    .mul(virtualSolReserves)
    .div(virtualTokenReserves.add(inputAmount));
}

/**
 * Calculate how many tokens you receive for a given SOL amount (buy quote).
 * Accounts for protocol and creator fees.
 *
 * @param global - Global program state
 * @param feeConfig - Fee tier config (null uses defaults)
 * @param mintSupply - Current token supply (null for new tokens)
 * @param bondingCurve - Current bonding curve state (null for new tokens)
 * @param amount - SOL amount in lamports
 * @returns Token amount receivable
 */
export function getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount,
  quoteMint,
  quoteControl,
  creatorFeeBps,
  pumpQuote,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN | null;
  bondingCurve: BondingCurve | null;
  amount: BN;
  /** Quote mint of a curve about to be created (`bondingCurve` null). Defaults to SOL. */
  quoteMint?: PublicKey;
  /** `QuoteControl` PDA, needed to seed a new curve in a QuoteControl mint. */
  quoteControl?: QuoteControl | null;
  /** `creator_fee_bps` the create is sent with, for a curve about to be created. */
  creatorFeeBps?: BN;
  /** The pump coin a new curve is quoted in, when it is listed nowhere. */
  pumpQuote?: PumpQuoteCurve;
}): BN {
  if (amount.eq(new BN(0))) {
    return new BN(0);
  }

  let isNewBondingCurve = false;

  if (bondingCurve === null || mintSupply === null) {
    bondingCurve = newBondingCurve(
      global,
      quoteMint,
      quoteControl,
      creatorFeeBps,
      false,
      pumpQuote,
    );
    mintSupply = global.tokenTotalSupply;
    isNewBondingCurve = true;
  }

  // migrated bonding curve
  if (bondingCurve.virtualTokenReserves.eq(new BN(0))) {
    return new BN(0);
  }

  const { virtualQuoteReserves, virtualTokenReserves } = bondingCurve;
  const { protocolFeeBps, creatorFeeBps: chargedCreatorFeeBps } =
    computeFeesBps({
      global,
      feeConfig,
      mintSupply,
      virtualQuoteReserves,
      virtualTokenReserves,
      quoteMint: bondingCurve.quoteMint,
      creatorFeeBps: bondingCurve.creatorFeeBps,
    });

  const totalFeeBasisPoints = protocolFeeBps.add(
    isNewBondingCurve || !PublicKey.default.equals(bondingCurve.creator)
      ? chargedCreatorFeeBps
      : new BN(0),
  );

  const inputAmount = amount
    .subn(1)
    .muln(10_000)
    .div(totalFeeBasisPoints.addn(10_000));

  const tokensReceived = getBuyTokenAmountFromSolAmountQuote({
    inputAmount,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
    virtualSolReserves: bondingCurve.virtualQuoteReserves,
  });

  return BN.min(tokensReceived, bondingCurve.realTokenReserves);
}

/**
 * Calculate how much SOL is required to buy a given token amount (buy cost).
 * Accounts for protocol and creator fees.
 *
 * @param global - Global program state
 * @param feeConfig - Fee tier config (null uses defaults)
 * @param mintSupply - Current token supply (null for new tokens)
 * @param bondingCurve - Current bonding curve state (null for new tokens)
 * @param amount - Token amount to buy
 * @returns SOL cost in lamports (including fees)
 */
export function getBuySolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount,
  quoteMint,
  quoteControl,
  creatorFeeBps,
  pumpQuote,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN | null;
  bondingCurve: BondingCurve | null;
  amount: BN;
  /** Quote mint of a curve about to be created (`bondingCurve` null). Defaults to SOL. */
  quoteMint?: PublicKey;
  /** `QuoteControl` PDA, needed to seed a new curve in a QuoteControl mint. */
  quoteControl?: QuoteControl | null;
  /** `creator_fee_bps` the create is sent with, for a curve about to be created. */
  creatorFeeBps?: BN;
  /** The pump coin a new curve is quoted in, when it is listed nowhere. */
  pumpQuote?: PumpQuoteCurve;
}): BN {
  if (amount.eq(new BN(0))) {
    return new BN(0);
  }

  let isNewBondingCurve = false;

  if (bondingCurve === null || mintSupply === null) {
    bondingCurve = newBondingCurve(
      global,
      quoteMint,
      quoteControl,
      creatorFeeBps,
      false,
      pumpQuote,
    );
    mintSupply = global.tokenTotalSupply;
    isNewBondingCurve = true;
  }

  // migrated bonding curve
  if (bondingCurve.virtualTokenReserves.eq(new BN(0))) {
    return new BN(0);
  }

  const minAmount = BN.min(amount, bondingCurve.realTokenReserves);

  const solCost = getBuySolAmountFromTokenAmountQuote({
    minAmount,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
    virtualSolReserves: bondingCurve.virtualQuoteReserves,
  });

  return solCost.add(
    getFee({
      global,
      feeConfig,
      mintSupply,
      bondingCurve,
      amount: solCost,
      isNewBondingCurve,
    }),
  );
}

/**
 * Calculate how much SOL you receive for selling a given token amount (sell quote).
 * Accounts for protocol and creator fees.
 *
 * @param global - Global program state
 * @param feeConfig - Fee tier config (null uses defaults)
 * @param mintSupply - Current token supply
 * @param bondingCurve - Current bonding curve state
 * @param amount - Token amount to sell
 * @returns SOL receivable in lamports (after fees)
 */
export function getSellSolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
  amount: BN;
}): BN {
  if (amount.eq(new BN(0))) {
    return new BN(0);
  }

  // migrated bonding curve
  if (bondingCurve.virtualTokenReserves.eq(new BN(0))) {
    return new BN(0);
  }

  const solCost = getSellSolAmountFromTokenAmountQuote({
    inputAmount: amount,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
    virtualSolReserves: bondingCurve.virtualQuoteReserves,
  });

  const netSol = solCost.sub(
    getFee({
      global,
      feeConfig,
      mintSupply,
      bondingCurve,
      amount: solCost,
      isNewBondingCurve: false,
    }),
  );

  // ceilDiv fee rounding can exceed gross SOL for dust amounts; clamp to 0.
  return BN.max(new BN(0), netSol);
}

/**
 * Binary-search the token amount to sell that yields approximately `targetSol`
 * lamports (after all protocol and creator fees).
 *
 * Bounded by the smaller of `realTokenReserves` and `maxSafeSellAmount` so the
 * returned amount is always safe for a single sell instruction. If selling the
 * entire safe limit still doesn't reach `targetSol`, the limit is returned so
 * callers can decide whether to fall back to `sellChunked`.
 *
 * @param global - Global program state
 * @param feeConfig - Fee tier config (null uses defaults)
 * @param mintSupply - Current token supply
 * @param bondingCurve - Current bonding curve state
 * @param targetSol - Desired SOL out in lamports
 * @returns Token amount to sell, clamped to the safe single-tx limit
 */
export function getTokenAmountForTargetSol({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  targetSol,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
  targetSol: BN;
}): BN {
  if (targetSol.isZero()) return new BN(0);

  const safeMax = maxSafeSellAmount(bondingCurve.virtualQuoteReserves);
  const upper = BN.min(bondingCurve.realTokenReserves, safeMax);

  if (upper.isZero()) return new BN(0);

  const maxOut = getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply,
    bondingCurve,
    amount: upper,
  });

  // Target unreachable within a single safe sell — return the ceiling
  if (maxOut.lte(targetSol)) return upper;

  let lo = new BN(0);
  let hi = upper;

  while (hi.sub(lo).gtn(1)) {
    const mid = lo.add(hi).divn(2);
    const solOut = getSellSolAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply,
      bondingCurve,
      amount: mid,
    });
    if (solOut.gte(targetSol)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return hi;
}

/**
 * Pick a random fee recipient from the hardcoded list.
 * Used when building buy/sell instructions.
 */
export function getStaticRandomFeeRecipient(): PublicKey {
  const randomIndex = Math.floor(Math.random() * CURRENT_FEE_RECIPIENTS.length);
  const recipient = CURRENT_FEE_RECIPIENTS[randomIndex]!;
  return new PublicKey(recipient);
}

const CURRENT_FEE_RECIPIENTS = [
  "62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV",
  "7VtfL8fvgNfhz17qKRMjzQEXgbdpnHHHQRh54R9jP2RJ",
  "7hTckgnGnLQR6sdH7YkqFTAA7VwTfYFaZ6EhEsU3saCX",
  "9rPYyANsfQZw3DnDmKE3YCQF5E8oD89UXoHn9JFEhJUz",
  "AVmoTthdrX6tKt4nDjco2D775W2YK3sDhxPcMmzUAmTY",
  "CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM",
  "FWsW1xNtWscwNmKv6wVsU1iTzRN6wmmk3MjxRP5tT7hz",
  "G5UZAVbAf46s7cKWoyKu8kYTip9DGTpbLZ2qa9Aq69dP",
];

/**
 * Calculate the market cap of a token on its bonding curve.
 * Formula: `virtualSolReserves * mintSupply / virtualTokenReserves`
 *
 * @param mintSupply - Total token supply
 * @param virtualSolReserves - Virtual SOL reserves
 * @param virtualTokenReserves - Virtual token reserves
 * @returns Market cap in lamports
 * @throws If virtualTokenReserves is zero
 */
export function bondingCurveMarketCap({
  mintSupply,
  virtualQuoteReserves,
  virtualTokenReserves,
}: {
  mintSupply: BN;
  virtualQuoteReserves: BN;
  virtualTokenReserves: BN;
}): BN {
  if (virtualTokenReserves.isZero()) {
    throw new Error("Division by zero: virtual token reserves cannot be zero");
  }
  return virtualQuoteReserves.mul(mintSupply).div(virtualTokenReserves);
}

// ---- v3 buys: the post-completion leg (synthetic migration) ----
//
// A `buy_v3` / `buy_exact_quote_in_v3` past the remaining supply sells the
// remainder at the curve's price, completes the curve and buys the rest from
// the pool the migration will create (not on mayhem curves). These mirror the
// program's arithmetic, fees included. The v3 trades always charge the
// FeeConfig schedule, and charge no creator fee on a curve without a creator.

interface V3Rates {
  protocolFeeBps: BN;
  creatorFeeBps: BN;
}

function v3Rates(
  global: Global,
  feeConfig: FeeConfig,
  mintSupply: BN,
  bondingCurve: BondingCurve,
): V3Rates {
  const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
    global,
    feeConfig,
    mintSupply: bondingCurve.isMayhemMode ? mintSupply : ONE_BILLION_SUPPLY,
    virtualQuoteReserves: bondingCurve.virtualQuoteReserves,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
    quoteMint: bondingCurve.quoteMint,
    creatorFeeBps: bondingCurve.creatorFeeBps,
  });
  return {
    protocolFeeBps,
    creatorFeeBps: bondingCurve.creator.equals(PublicKey.default)
      ? new BN(0)
      : creatorFeeBps,
  };
}

function ceilFee(amount: BN, bps: BN): BN {
  return amount.mul(bps).addn(9_999).divn(10_000);
}

function v3Fees(amount: BN, rates: V3Rates): BN {
  return ceilFee(amount, rates.protocolFeeBps).add(
    ceilFee(amount, rates.creatorFeeBps),
  );
}

/** pump `exact_quote_in_fees`: the net quote a budget leaves after fees. */
function v3ExactQuoteInNet(budget: BN, rates: V3Rates): BN {
  const totalBps = rates.protocolFeeBps.add(rates.creatorFeeBps);
  let net = totalBps.isZero()
    ? budget
    : budget.muln(10_000).div(totalBps.addn(10_000));
  const cost = net.add(v3Fees(net, rates));
  if (cost.gt(budget)) {
    net = net.sub(cost.sub(budget));
  }
  return net;
}

/** The reserves the migration would deposit once the curve leg completes it. */
function poolToBe(
  global: Global,
  bondingCurve: BondingCurve,
  curveBaseTokenBalance: BN,
  curveTokens: BN,
  curveNetQuote: BN,
): { base: BN; quote: BN } {
  const raised = bondingCurve.realQuoteReserves.add(curveNetQuote);
  const base = curveBaseTokenBalance.sub(curveTokens);
  const quote = isLegacyQuoteMint(bondingCurve.quoteMint)
    ? raised.sub(global.poolMigrationFee)
    : raised;
  // The program refuses an empty pool-to-be; here it almost always means a
  // wrong `curveBaseTokenBalance` (read under the other token program, say).
  if (base.lten(0) || quote.lten(0)) {
    throw new Error(
      `Empty pool-to-be (base ${base.toString()}, quote ${quote.toString()}): check curveBaseTokenBalance`,
    );
  }
  return { base, quote };
}

/**
 * What `buy_v3` charges for `amount` tokens, fees included: the cap to send
 * as `max_quote_cost` before slippage. Past the remaining supply the cost
 * includes the post-completion leg bought from the pool-to-be; on a mayhem
 * curve it stops at the remaining supply (send `partialFill` then). Zero on a
 * complete or migrated curve.
 *
 * @param params.feeConfig - Required: v3 always charges the FeeConfig schedule.
 * @param params.curveBaseTokenBalance - The curve's base ATA balance
 *   (`OnlinePumpSdk.fetchBuyState` returns it); prices the pool-to-be.
 * @throws When `amount` would take the whole pool-to-be (6021
 *   `NotEnoughTokensToBuy` on chain), or when the pool-to-be is empty.
 */
export function getBuyV3QuoteAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount,
  curveBaseTokenBalance,
}: {
  global: Global;
  feeConfig: FeeConfig;
  mintSupply: BN;
  bondingCurve: BondingCurve;
  amount: BN;
  curveBaseTokenBalance: BN;
}): BN {
  const remaining = bondingCurve.realTokenReserves;
  if (
    amount.isZero() ||
    bondingCurve.complete ||
    bondingCurve.virtualTokenReserves.isZero()
  ) {
    return new BN(0);
  }
  const rates = v3Rates(global, feeConfig, mintSupply, bondingCurve);
  const curveTokens = BN.min(amount, remaining);
  const curveNet = getBuySolAmountFromTokenAmountQuote({
    minAmount: curveTokens,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
    virtualSolReserves: bondingCurve.virtualQuoteReserves,
  });
  const curveTotal = curveNet.add(v3Fees(curveNet, rates));
  if (amount.lte(remaining) || bondingCurve.isMayhemMode) {
    return curveTotal;
  }

  const pastCurve = amount.sub(remaining);
  const pool = poolToBe(
    global,
    bondingCurve,
    curveBaseTokenBalance,
    remaining,
    curveNet,
  );
  if (pool.base.lte(pastCurve)) {
    throw new Error(
      `buy_v3 of ${amount.toString()} tokens takes the whole pool-to-be (NotEnoughTokensToBuy)`,
    );
  }
  // pump-amm `buy_quote`: ceil(Q * out / (B - out)).
  const legNet = pool.quote
    .mul(pastCurve)
    .add(pool.base.sub(pastCurve))
    .subn(1)
    .div(pool.base.sub(pastCurve));
  return curveTotal.add(legNet).add(v3Fees(legNet, rates));
}

/**
 * The tokens `buy_exact_quote_in_v3` buys for `amount` quote, fees included;
 * apply slippage to it for `min_tokens_out`. Past the remaining supply the
 * leftover budget buys from the pool-to-be; on a mayhem curve it stops at the
 * remaining supply (send `partialFill` then). Zero on a complete or migrated
 * curve.
 *
 * @param params.curveBaseTokenBalance - As in
 *   `getBuyV3QuoteAmountFromTokenAmount`.
 * @throws When a crossing budget meets an empty pool-to-be.
 */
export function getBuyV3TokenAmountFromQuoteAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount,
  curveBaseTokenBalance,
}: {
  global: Global;
  feeConfig: FeeConfig;
  mintSupply: BN;
  bondingCurve: BondingCurve;
  amount: BN;
  curveBaseTokenBalance: BN;
}): BN {
  if (
    amount.isZero() ||
    bondingCurve.complete ||
    bondingCurve.virtualTokenReserves.isZero()
  ) {
    return new BN(0);
  }
  const rates = v3Rates(global, feeConfig, mintSupply, bondingCurve);
  const net = v3ExactQuoteInNet(amount, rates);
  if (net.lten(1)) {
    return new BN(0);
  }
  const tokens = getBuyTokenAmountFromSolAmountQuote({
    inputAmount: net.subn(1),
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
    virtualSolReserves: bondingCurve.virtualQuoteReserves,
  });
  const remaining = bondingCurve.realTokenReserves;
  if (tokens.lte(remaining) || bondingCurve.isMayhemMode) {
    return BN.min(tokens, remaining);
  }

  const curveNet = getBuySolAmountFromTokenAmountQuote({
    minAmount: remaining,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
    virtualSolReserves: bondingCurve.virtualQuoteReserves,
  });
  const budgetLeft = amount.sub(curveNet.add(v3Fees(curveNet, rates)));
  if (budgetLeft.lten(0)) {
    return remaining;
  }
  const totalBps = rates.protocolFeeBps.add(rates.creatorFeeBps);
  const afterFees = totalBps.isZero()
    ? budgetLeft
    : budgetLeft.muln(10_000).div(totalBps.addn(10_000));
  if (afterFees.ltn(2)) {
    return remaining;
  }
  const legNet = v3ExactQuoteInNet(budgetLeft, rates);
  const pool = poolToBe(
    global,
    bondingCurve,
    curveBaseTokenBalance,
    remaining,
    curveNet,
  );
  // pump-amm `buy_exact_quote_in`: floor((in - 1) * B / (Q + in - 1)).
  const legTokens = legNet
    .subn(1)
    .mul(pool.base)
    .div(pool.quote.add(legNet.subn(1)));
  return remaining.add(legTokens);
}
