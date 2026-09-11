/**
 * Example 23: Decoding a Bonding Curve
 *
 * Category: Accounts & Events
 *
 * Reads a live curve account with decodeBondingCurve, contrasts it with
 * decodeBondingCurveNullable on a short account, and classifies the result
 * as fresh, active, or complete. The classifier is the part callers get
 * wrong: the complete flag alone does not tell you a curve is tradeable.
 *
 * Run: npm run example 23
 */
import { PUMP_SDK, bondingCurvePda, pumpIdl } from "@nirholas/pump-sdk";
import { AccountInfo, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import type { BondingCurve } from "@nirholas/pump-sdk";

import { getConnection } from "./_lib/connection";
import { findActiveCurveMint } from "./_lib/discovery";
import { formatSol, formatTokens, heading, row } from "./_lib/format";

/**
 * The serialised size of a current-layout BondingCurve account:
 * 8 discriminator + 5 u64 + 1 bool + 32 pubkey + 2 bool.
 */
export const BONDING_CURVE_DATA_LEN = 83;

/** Where a curve sits in its life. */
export type CurveStatus = "fresh" | "active" | "complete";

export interface CurveReport {
  status: CurveStatus;
  /** Fraction of the saleable supply sold, in basis points. */
  soldBps: BN;
  /** SOL currently held by the curve. */
  solRaised: BN;
  /** Spot price in lamports per whole token. */
  spotPriceLamports: BN;
  hasCreator: boolean;
  isMayhemMode: boolean;
  isCashbackCoin: boolean;
}

/**
 * Classify a decoded curve.
 *
 * Three states, and the order of the checks matters:
 *
 * - complete: the curve no longer trades. That is true when the program set
 *   `complete`, and also when migration zeroed the reserves, which can be
 *   observed in the same slot the flag is written. Checking the reserves as
 *   well is what stops a divide-by-zero further down the call chain.
 * - fresh: created, never traded. Real SOL reserves are still zero.
 * - active: everything else.
 */
export function curveStatus(bondingCurve: BondingCurve): CurveStatus {
  if (
    bondingCurve.complete ||
    bondingCurve.virtualTokenReserves.isZero() ||
    bondingCurve.virtualQuoteReserves.isZero()
  ) {
    return "complete";
  }
  return bondingCurve.realQuoteReserves.isZero() ? "fresh" : "active";
}

/** Curve state summarised, with no network access and no floats. */
export function curveReport(
  bondingCurve: BondingCurve,
  initialRealTokenReserves: BN,
): CurveReport {
  const sold = initialRealTokenReserves.sub(bondingCurve.realTokenReserves);
  return {
    status: curveStatus(bondingCurve),
    soldBps: initialRealTokenReserves.isZero()
      ? new BN(0)
      : BN.max(new BN(0), sold).muln(10_000).div(initialRealTokenReserves),
    solRaised: bondingCurve.realQuoteReserves,
    spotPriceLamports: bondingCurve.virtualTokenReserves.isZero()
      ? new BN(0)
      : bondingCurve.virtualQuoteReserves
          .muln(1_000_000)
          .div(bondingCurve.virtualTokenReserves),
    hasCreator: !bondingCurve.creator.equals(PublicKey.default),
    isMayhemMode: bondingCurve.isMayhemMode,
    isCashbackCoin: bondingCurve.isCashbackCoin,
  };
}

/**
 * The 8-byte Anchor discriminator every BondingCurve account starts with,
 * read from the IDL rather than pasted in, so an IDL update carries.
 */
export function bondingCurveDiscriminator(): Buffer {
  const account = pumpIdl.accounts.find((a) => a.name === "BondingCurve");
  if (!account) {
    throw new Error("The Pump IDL has no BondingCurve account");
  }
  return Buffer.from(account.discriminator);
}

/**
 * Serialise a curve into the exact bytes the program stores.
 *
 * Written out field by field because that layout is the thing this example
 * is about: it is what the decoder reads, and it is why a shorter account
 * fails to decode. Borsh here is little-endian u64s, a one-byte bool, and a
 * raw 32-byte pubkey, in declaration order.
 */
export function encodeBondingCurveAccount(bondingCurve: BondingCurve): Buffer {
  const u64 = (value: BN): Buffer => value.toArrayLike(Buffer, "le", 8);
  return Buffer.concat([
    bondingCurveDiscriminator(),
    u64(bondingCurve.virtualTokenReserves),
    u64(bondingCurve.virtualQuoteReserves),
    u64(bondingCurve.realTokenReserves),
    u64(bondingCurve.realQuoteReserves),
    u64(bondingCurve.tokenTotalSupply),
    Buffer.from([bondingCurve.complete ? 1 : 0]),
    bondingCurve.creator.toBuffer(),
    Buffer.from([bondingCurve.isMayhemMode ? 1 : 0]),
    Buffer.from([bondingCurve.isCashbackCoin ? 1 : 0]),
  ]);
}

/** Wrap raw account bytes in the AccountInfo shape the decoders take. */
export function curveAccountInfo(
  data: Buffer,
  owner: PublicKey,
): AccountInfo<Buffer> {
  return { data, executable: false, lamports: 0, owner };
}

export async function main(): Promise<void> {
  const connection = getConnection();

  heading("Finding a live curve");
  const { mint } = await findActiveCurveMint(connection);
  const curveAddress = bondingCurvePda(mint);
  row("Mint", mint.toBase58());
  row("Bonding curve PDA", curveAddress.toBase58());

  const accountInfo = await connection.getAccountInfo(curveAddress);
  if (!accountInfo) {
    throw new Error(
      `No bonding curve account at ${curveAddress.toBase58()}. Pass MINT=<address> to target a specific token.`,
    );
  }
  row("Owner", accountInfo.owner.toBase58());
  row("Data size", `${accountInfo.data.length} bytes`);
  console.log(
    `\nThe struct itself is ${BONDING_CURVE_DATA_LEN} bytes. Accounts are allocated larger so`,
  );
  console.log("later fields can be added without reallocating every curve; the");
  console.log("decoder reads the prefix it knows and ignores the rest.");

  heading("decodeBondingCurve");
  const bondingCurve = PUMP_SDK.decodeBondingCurve(accountInfo);
  row("Virtual SOL reserves", formatSol(bondingCurve.virtualQuoteReserves, 4));
  row("Virtual token reserves", formatTokens(bondingCurve.virtualTokenReserves, 0));
  row("Real SOL reserves", formatSol(bondingCurve.realQuoteReserves, 4));
  row("Real token reserves", formatTokens(bondingCurve.realTokenReserves, 0));
  row("Total supply", formatTokens(bondingCurve.tokenTotalSupply, 0));
  row("Complete", bondingCurve.complete);
  row("Creator", bondingCurve.creator.toBase58());
  row("Mayhem mode", bondingCurve.isMayhemMode);
  row("Cashback coin", bondingCurve.isCashbackCoin);

  heading("Classification");
  const report = curveReport(bondingCurve, new BN("793100000000000"));
  row("Status", report.status);
  row("Saleable supply sold", `${report.soldBps.toString()} bps`);
  row("SOL raised", formatSol(report.solRaised, 4));
  row("Spot price", `${report.spotPriceLamports.toString()} lamports/token`);
  row("Has creator", report.hasCreator);

  heading("decodeBondingCurveNullable");
  const nullable = PUMP_SDK.decodeBondingCurveNullable(accountInfo);
  row("Same account", nullable !== null);
  console.log("\nThe nullable variant exists for one reason: it never throws. Point");
  console.log("it at an address that is not a curve, or at an account written by an");
  console.log("older program version, and it logs a warning and returns null, so a");
  console.log("batch scan over thousands of addresses does not die on the first bad");
  console.log("one. It also pads a short buffer before decoding, a carry-over from");
  console.log("the pre-extension layout. That pad is 82 bytes and the current struct");
  console.log(
    `needs ${BONDING_CURVE_DATA_LEN}, so a genuinely truncated account now returns null rather`,
  );
  console.log("than a partly-zeroed struct. Null is the honest answer; treat it as");
  console.log("'unreadable', never as 'empty curve'.");

  heading("A truncated account, decoded both ways");
  const truncated = curveAccountInfo(
    Buffer.from(accountInfo.data.subarray(0, 49)),
    accountInfo.owner,
  );
  let strictError = "decoded without error";
  try {
    PUMP_SDK.decodeBondingCurve(truncated);
  } catch (error) {
    strictError = error instanceof Error ? error.message : String(error);
  }
  row("decodeBondingCurve", strictError.slice(0, 60));
  row("decodeBondingCurveNullable", PUMP_SDK.decodeBondingCurveNullable(truncated));

  heading("Round trip");
  const reencoded = encodeBondingCurveAccount(bondingCurve);
  const roundTripped = PUMP_SDK.decodeBondingCurve(
    curveAccountInfo(reencoded, accountInfo.owner),
  );
  row("Re-encoded size", `${reencoded.length} bytes`);
  row(
    "Matches the live account",
    roundTripped.virtualQuoteReserves.eq(bondingCurve.virtualQuoteReserves) &&
      roundTripped.virtualTokenReserves.eq(bondingCurve.virtualTokenReserves) &&
      roundTripped.creator.equals(bondingCurve.creator) &&
      roundTripped.complete === bondingCurve.complete,
  );
  console.log("\nEncoding the decoded struct back to bytes and decoding it again is");
  console.log("the cheapest proof that the layout above is the real one.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
