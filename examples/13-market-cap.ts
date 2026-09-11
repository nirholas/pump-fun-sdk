/**
 * Example 13: Market Cap Along the Curve
 *
 * Category: Curve Math & Fees
 *
 * Computes a token's SOL-denominated market cap at launch, mid-curve, and
 * on the edge of graduation, entirely offline. Shows how the constant
 * product invariant pins every market cap to a point on the curve, from
 * ~28 SOL at launch to ~411 SOL at graduation.
 *
 * Run: npm run example 13
 */
import { bondingCurveMarketCap } from "@nirholas/pump-sdk";
import BN from "bn.js";

import type { BondingCurve, Global } from "@nirholas/pump-sdk";

import {
  curveAtVirtualSol,
  graduationVirtualSol,
  launchBondingCurve,
  mainnetGlobal,
} from "./_lib/curveState";
import { formatSol, formatTokens, heading, row } from "./_lib/format";

export interface MarketCapPoint {
  label: string;
  bondingCurve: BondingCurve;
  /** Market cap in lamports: vSol * supply / vTok. */
  marketCap: BN;
  /** SOL actually raised into the curve so far. */
  solRaised: BN;
}

/** Market cap of one curve state, using the SDK's exact formula. */
export function marketCapOf(global: Global, bondingCurve: BondingCurve): BN {
  return bondingCurveMarketCap({
    mintSupply: global.tokenTotalSupply,
    virtualQuoteReserves: bondingCurve.virtualQuoteReserves,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
  });
}

/**
 * Three checkpoints on the curve's life: launch, mid-curve, and one step
 * before graduation. Mid and near-graduation states are derived by sliding
 * along the invariant k = vSol * vTok, exactly what a sequence of buys does.
 */
export function buildMarketCapTable(global: Global): MarketCapPoint[] {
  const launch = launchBondingCurve();
  const mid = curveAtVirtualSol(global, new BN("60000000000")); // 60 SOL
  const gradSol = graduationVirtualSol(global);
  const nearGraduation = curveAtVirtualSol(global, gradSol);

  return [
    { label: "Launch", bondingCurve: launch },
    { label: "Mid-curve (60 SOL virtual)", bondingCurve: mid },
    { label: "Graduation edge", bondingCurve: nearGraduation },
  ].map(({ label, bondingCurve }) => ({
    label,
    bondingCurve,
    marketCap: marketCapOf(global, bondingCurve),
    solRaised: bondingCurve.realQuoteReserves,
  }));
}

export async function main(): Promise<void> {
  const global = mainnetGlobal();

  heading("The formula");
  console.log("marketCap = virtualSolReserves * mintSupply / virtualTokenReserves");
  console.log("Every value is a BN in base units; no floats touch the math.");

  heading("Market cap checkpoints (SOL-denominated)");
  for (const point of buildMarketCapTable(global)) {
    row(point.label, formatSol(point.marketCap, 2));
    row("  virtual SOL", formatSol(point.bondingCurve.virtualQuoteReserves, 2));
    row("  virtual tokens", formatTokens(point.bondingCurve.virtualTokenReserves, 0));
    row("  real tokens left", formatTokens(point.bondingCurve.realTokenReserves, 0));
    row("  SOL raised so far", formatSol(point.solRaised, 2));
  }

  heading("Graduation");
  const gradSol = graduationVirtualSol(global);
  row("Virtual SOL at graduation", formatSol(gradSol, 2));
  row("SOL raised at graduation", formatSol(gradSol.sub(global.initialVirtualSolReserves), 2));
  console.log(
    "\nWhen the 793.1M real tokens are sold out, the curve completes and the",
  );
  console.log(
    "token migrates to the PumpSwap AMM. The market cap at that moment is",
  );
  console.log(
    "fixed by the launch parameters: every Pump token graduates at the same",
  );
  console.log("SOL-denominated cap, near 411 SOL.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
