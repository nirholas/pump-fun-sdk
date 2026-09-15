/**
 * Example 10: Cashback Tokens
 *
 * Category: Token Lifecycle
 *
 * Launches a token with cashback enabled, derives the two UserVolumeAccumulator
 * PDAs that hold a trader's rebate (one per program), and decodes a
 * ClaimCashbackEvent. Cashback redirects the creator fee back to the traders,
 * so the accumulator is the account a cashback UI reads and claims from.
 *
 * Run: npm run example 10
 */
import {
  OnlinePumpSdk,
  PUMP_SDK,
  getPumpProgram,
  ammUserVolumeAccumulatorPda,
  userVolumeAccumulatorPda,
  type ClaimCashbackEvent,
} from "@nirholas/pump-sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { getConnection } from "./_lib/connection";
import { findActiveCurveMint } from "./_lib/discovery";
import { formatSol, heading, row } from "./_lib/format";
import { loadWallet } from "./_lib/wallet";

/**
 * The Pump program's own Anchor coder. Constructing a Program performs no
 * I/O, so this is usable offline; the connection is only consulted when a
 * method actually hits the network, which none of the coder calls do.
 */
const pumpCoder = getPumpProgram(getConnection()).coder;

/**
 * A trader's cashback accumulators. Both PDAs use the same
 * `user_volume_accumulator` seed; only the owning program differs, so a
 * trader who bought on the curve and sold on the AMM has a balance in each.
 */
export interface CashbackAccumulators {
  /** Bonding curve program accumulator; holds native lamports. */
  bondingCurve: PublicKey;
  /** AMM program accumulator; its wSOL ATA holds the rebate. */
  amm: PublicKey;
}

/** Derive both UserVolumeAccumulator PDAs for a trader. */
export function cashbackAccumulators(user: PublicKey): CashbackAccumulators {
  return {
    bondingCurve: userVolumeAccumulatorPda(user),
    amm: ammUserVolumeAccumulatorPda(user),
  };
}

/** What a claim history tells a trader about their rebate. */
export interface CashbackPosition {
  /** Lifetime cashback earned minus lifetime claimed, in lamports. */
  outstanding: BN;
  /** Share of lifetime earnings already claimed, in basis points. */
  claimedShareBps: BN;
}

/**
 * Read a ClaimCashbackEvent as a position rather than a receipt.
 *
 * `amount` is what this claim moved; `totalClaimed` and `totalCashbackEarned`
 * are lifetime running totals on the accumulator, so the difference is what
 * is still sitting in the accumulator waiting to be claimed.
 */
export function readCashbackPosition(
  event: ClaimCashbackEvent,
): CashbackPosition {
  const outstanding = BN.max(
    new BN(0),
    event.totalCashbackEarned.sub(event.totalClaimed),
  );
  const claimedShareBps = event.totalCashbackEarned.isZero()
    ? new BN(0)
    : event.totalClaimed.muln(10_000).div(event.totalCashbackEarned);
  return { outstanding, claimedShareBps };
}

/** Byte offsets where two equal-length instruction payloads differ. */
export function changedDataOffsets(a: Buffer, b: Buffer): number[] {
  const offsets: number[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) offsets.push(i);
  }
  return offsets;
}

/**
 * Encode a ClaimCashbackEvent with the Pump program's own IDL coder.
 *
 * The protocol emits these bytes inside transaction logs; encoding one here
 * exercises the exact same layout `decodeClaimCashbackEvent` parses, which
 * is what makes the decode below a real round trip rather than an assertion
 * about a hand-written buffer.
 */
export function encodeClaimCashbackEvent(event: ClaimCashbackEvent): Buffer {
  return pumpCoder.types.encode("claimCashbackEvent", event);
}

export async function main(): Promise<void> {
  const connection = getConnection();
  const wallet = loadWallet();
  const sdk = new OnlinePumpSdk(connection);
  const mint = Keypair.generate();

  heading("Cashback launch deprecation");
  row("Mint (new keypair)", mint.publicKey.toBase58());
  row("Creator / payer", wallet.publicKey.toBase58());

  const params = {
    mint: mint.publicKey,
    name: "Cashback Example",
    symbol: "CBEX",
    uri: "https://example.com/metadata.json",
    creator: wallet.publicKey,
    user: wallet.publicKey,
    mayhemMode: false,
  };
  await PUMP_SDK.createV2Instruction({ ...params, cashback: false });
  try {
    await PUMP_SDK.createV2Instruction({ ...params, cashback: true });
  } catch (error) {
    row("New cashback launch", error instanceof Error ? error.message : error);
  }
  console.log("\nExisting cashback coins keep trading and remain claimable.");
  console.log("For new launches, use holderReward: true instead.");

  heading("Where the rebate accrues");
  const accumulators = cashbackAccumulators(wallet.publicKey);
  row("Trader", wallet.publicKey.toBase58());
  row("Curve accumulator", accumulators.bondingCurve.toBase58());
  row("AMM accumulator", accumulators.amm.toBase58());
  const [curveInfo, ammInfo] = await connection.getMultipleAccountsInfo([
    accumulators.bondingCurve,
    accumulators.amm,
  ]);
  row("Curve accumulator exists", curveInfo !== null);
  row("AMM accumulator exists", ammInfo !== null);
  console.log(
    "\nA sell on the bonding curve must pass the curve accumulator as the 0th",
  );
  console.log(
    "remaining account, and an AMM swap must pass the AMM accumulator's wSOL",
  );
  console.log(
    "ATA. Omit them and the fee silently reverts to the creator. PUMP_SDK",
  );
  console.log("wires both for you.");

  heading("A live coin's cashback flag");
  const { mint: liveMint, bondingCurve } = await findActiveCurveMint(connection);
  row("Mint", liveMint.toBase58());
  row("isCashbackCoin", bondingCurve.isCashbackCoin);
  row("isMayhemMode", bondingCurve.isMayhemMode);
  row("Creator", bondingCurve.creator.toBase58());
  const stats = await sdk.fetchUserVolumeAccumulatorTotalStats(
    wallet.publicKey,
  );
  row("Trader unclaimed tokens", stats.totalUnclaimedTokens.toString());
  row("Trader claimed tokens", stats.totalClaimedTokens.toString());
  row("Trader current SOL volume", formatSol(stats.currentSolVolume, 6));

  heading("Decoding a ClaimCashbackEvent");
  const encoded = encodeClaimCashbackEvent({
    user: wallet.publicKey,
    amount: new BN(250_000),
    timestamp: new BN(Math.floor(Date.now() / 1000)),
    totalClaimed: new BN(1_750_000),
    totalCashbackEarned: new BN(2_000_000),
  });
  const decoded = PUMP_SDK.decodeClaimCashbackEvent(encoded);
  row("Event bytes", encoded.length);
  row("Claimed now", formatSol(decoded.amount, 6));
  row("Claimed lifetime", formatSol(decoded.totalClaimed, 6));
  row("Earned lifetime", formatSol(decoded.totalCashbackEarned, 6));
  const position = readCashbackPosition(decoded);
  row("Still claimable", formatSol(position.outstanding, 6));
  row("Claimed share", `${position.claimedShareBps.toString()} bps`);

  heading("Next step (not performed here)");
  console.log(
    "PUMP_SDK.claimCashbackInstruction({ user }) moves the curve rebate out",
  );
  console.log(
    "of the accumulator; OnlinePumpSdk.claimCashbackBothPrograms(user) covers",
  );
  console.log("the curve and the AMM in one instruction list.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
