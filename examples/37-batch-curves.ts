/**
 * Example 37: Batched Bonding Curve Reads
 *
 * Category: Live Data
 *
 * Collects a basket of mints off the live Pump log stream and reads every
 * bonding curve in a single fetchMultipleBondingCurves call, then aggregates
 * the basket: how many are still trading, how many completed, and how much
 * SOL the curves hold between them.
 *
 * Run: npm run example 37
 */
import { OnlinePumpSdk, type BondingCurve } from "@nirholas/pump-sdk";
import BN from "bn.js";

import { getConnection } from "./_lib/connection";
import { collectStreamMints } from "./_lib/discovery";
import { formatSol, formatTokens, heading, row } from "./_lib/format";

/** Portfolio-level view of a basket of curves. */
export interface CurveBasketSummary {
  /** Mints asked for. */
  total: number;
  /** Curves that exist and are still trading. */
  active: number;
  /** Curves flagged complete, meaning they graduated to PumpAMM. */
  complete: number;
  /** Mints with no bonding curve account on-chain. */
  missing: number;
  /** SOL held across every curve in the basket, in lamports. */
  solLocked: BN;
  /** Unsold real tokens left across the active curves. */
  tokensRemaining: BN;
  /** Largest single curve by real SOL reserves, if any curve exists. */
  largest: { mint: string; solLocked: BN } | null;
}

/**
 * Aggregate the map fetchMultipleBondingCurves returns.
 *
 * The map holds one entry per requested mint, with `null` where no curve
 * account exists, so the three counts always add up to the number of mints
 * requested. Every SOL figure stays in lamports as BN.
 */
export function aggregateCurves(
  curves: Map<string, BondingCurve | null>,
): CurveBasketSummary {
  let active = 0;
  let complete = 0;
  let missing = 0;
  let solLocked = new BN(0);
  let tokensRemaining = new BN(0);
  let largest: { mint: string; solLocked: BN } | null = null;

  for (const [mint, curve] of curves) {
    if (!curve) {
      missing += 1;
      continue;
    }
    if (curve.complete) {
      complete += 1;
    } else {
      active += 1;
      tokensRemaining = tokensRemaining.add(curve.realTokenReserves);
    }
    solLocked = solLocked.add(curve.realQuoteReserves);
    if (!largest || curve.realQuoteReserves.gt(largest.solLocked)) {
      largest = { mint, solLocked: curve.realQuoteReserves };
    }
  }

  return {
    total: curves.size,
    active,
    complete,
    missing,
    solLocked,
    tokensRemaining,
    largest,
  };
}

export async function main(): Promise<void> {
  const connection = getConnection();
  const online = new OnlinePumpSdk(connection);

  heading("Collecting a basket off the live stream");
  const streamed = await collectStreamMints(connection, ["trade", "create"], 10);
  const mints = streamed.map((entry) => entry.mint);
  row("Mints collected", mints.length);
  for (const entry of streamed) {
    row(`  ${entry.eventType}`, entry.mint.toBase58());
  }

  heading("One call: fetchMultipleBondingCurves");
  const started = Date.now();
  const curves = await online.fetchMultipleBondingCurves(mints);
  row("Curves returned", curves.size);
  row("Elapsed", `${Date.now() - started} ms`);
  console.log(
    "The method derives each bonding curve PDA and issues a single",
  );
  console.log(
    "connection.getMultipleAccountsInfo, which is one getMultipleAccounts",
  );
  console.log(
    "JSON-RPC request for the whole basket (up to 100 accounts per call).",
  );
  console.log(
    `Fetching them one at a time would be ${mints.length} getAccountInfo round trips:`,
  );
  console.log(
    `the same bytes for ${mints.length} times the latency, and ${mints.length} times the rate-limit`,
  );
  console.log("budget on a public endpoint.");

  heading("Per mint");
  for (const [mint, curve] of curves) {
    if (!curve) {
      row(mint.slice(0, 8), "no bonding curve account");
      continue;
    }
    row(
      mint.slice(0, 8),
      `${curve.complete ? "complete" : "trading"}, ${formatSol(curve.realQuoteReserves)} locked`,
    );
  }

  heading("Basket aggregate");
  const summary = aggregateCurves(curves);
  row("Total mints", summary.total);
  row("Still trading", summary.active);
  row("Completed", summary.complete);
  row("No curve account", summary.missing);
  row("SOL locked in curves", formatSol(summary.solLocked));
  row("Unsold tokens", formatTokens(summary.tokensRemaining, 0));
  if (summary.largest) {
    row(
      "Largest curve",
      `${summary.largest.mint.slice(0, 8)} at ${formatSol(summary.largest.solLocked)}`,
    );
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
