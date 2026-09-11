/**
 * Example 20: Price Impact in Basis Points
 *
 * Category: Curve Math & Fees
 *
 * Measures what a buy does to the price it pays, across sizes, entirely
 * offline. Separates the two costs a trader actually pays: fees, which are
 * a flat rate, and price impact, which grows with size. Every number is
 * derived with BN integer math and only formatted at the end.
 *
 * Run: npm run example 20
 */
import {
  calculateBuyPriceImpact,
  getBuyTokenAmountFromSolAmount,
} from "@nirholas/pump-sdk";
import BN from "bn.js";

import type { BondingCurve, FeeConfig, Global } from "@nirholas/pump-sdk";

import {
  curveAtVirtualSol,
  launchBondingCurve,
  mainnetFeeConfig,
  mainnetGlobal,
} from "./_lib/curveState";
import { formatSol, formatTokens, heading, row } from "./_lib/format";

const BPS = new BN(10_000);
/** 1 whole Pump token = 1e6 base units (6 decimals). */
const TOKEN_UNITS = new BN(1_000_000);

export interface ImpactRow {
  solAmount: BN;
  tokensOut: BN;
  /** Impact in bps, computed here with pure BN arithmetic. */
  impactBps: BN;
  /** The SDK's own figure, for cross-checking. */
  sdkImpactBps: number;
  /** Lamports per whole token this fill actually paid. */
  effectivePriceLamports: BN;
  /** Lamports per whole token quoted before the trade. */
  spotPriceLamports: BN;
  /** Effective price above spot, in bps: fees plus impact together. */
  premiumOverSpotBps: BN;
}

/**
 * Spot price in lamports per whole token: vSol / vTok, scaled by the token
 * unit so the integer division keeps its precision. On a fresh curve this
 * is roughly 28 lamports per token, small enough that dividing without the
 * scale would round to zero.
 */
export function spotPriceLamports(bondingCurve: BondingCurve): BN {
  if (bondingCurve.virtualTokenReserves.isZero()) return new BN(0);
  return bondingCurve.virtualQuoteReserves
    .mul(TOKEN_UNITS)
    .div(bondingCurve.virtualTokenReserves);
}

/**
 * Price impact in basis points, from reserves alone.
 *
 * impact = (priceAfter / priceBefore - 1) * 10000, where the two prices are
 * vSol/vTok before and after the buy. Dividing each price out first would
 * throw away most of the precision, so the ratio is evaluated as a single
 * cross-multiplied fraction:
 *
 *   (vSol + in) * vTok * 10000 / ((vTok - out) * vSol) - 10000
 */
export function priceImpactBps(
  bondingCurve: BondingCurve,
  solAmount: BN,
  tokensOut: BN,
): BN {
  const newVirtualSol = bondingCurve.virtualQuoteReserves.add(solAmount);
  const newVirtualTokens = bondingCurve.virtualTokenReserves.sub(tokensOut);
  if (newVirtualTokens.lten(0) || bondingCurve.virtualQuoteReserves.isZero()) {
    throw new Error("Buy consumes the entire curve; impact is unbounded");
  }
  const numerator = newVirtualSol
    .mul(bondingCurve.virtualTokenReserves)
    .mul(BPS);
  const denominator = newVirtualTokens.mul(bondingCurve.virtualQuoteReserves);
  return numerator.div(denominator).sub(BPS);
}

/** Everything a trader wants to know about one buy size. */
export function measureImpact({
  global,
  feeConfig,
  bondingCurve,
  solAmount,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  bondingCurve: BondingCurve;
  solAmount: BN;
}): ImpactRow {
  const tokensOut = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    amount: solAmount,
  });
  if (tokensOut.isZero()) {
    throw new Error("Buy is too small to receive a single token base unit");
  }

  const spot = spotPriceLamports(bondingCurve);
  const effective = solAmount.mul(TOKEN_UNITS).div(tokensOut);
  // Compare effective against spot by cross-multiplication for the same
  // reason as above: both prices are small integers.
  const premiumOverSpotBps = solAmount
    .mul(bondingCurve.virtualTokenReserves)
    .mul(BPS)
    .div(tokensOut.mul(bondingCurve.virtualQuoteReserves))
    .sub(BPS);

  return {
    solAmount,
    tokensOut,
    impactBps: priceImpactBps(bondingCurve, solAmount, tokensOut),
    sdkImpactBps: calculateBuyPriceImpact({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
      solAmount,
    }).impactBps,
    effectivePriceLamports: effective,
    spotPriceLamports: spot,
    premiumOverSpotBps,
  };
}

/** Impact across a ladder of buy sizes against one curve state. */
export function buildImpactLadder(
  global: Global,
  feeConfig: FeeConfig | null,
  bondingCurve: BondingCurve,
  solAmounts: ReadonlyArray<BN>,
): ImpactRow[] {
  return solAmounts.map((solAmount) =>
    measureImpact({ global, feeConfig, bondingCurve, solAmount }),
  );
}

const SOL = (whole: number): BN => new BN(whole).mul(new BN(1_000_000_000));

export async function main(): Promise<void> {
  const global = mainnetGlobal();
  const feeConfig = mainnetFeeConfig();
  const sizes = [
    new BN(100_000_000), // 0.1 SOL
    SOL(1),
    SOL(5),
    SOL(10),
    SOL(25),
  ];

  heading("What price impact is");
  console.log("A constant product curve reprices as it fills. The tokens in your");
  console.log("own order are bought at a rising price, so the fill lands above the");
  console.log("spot quote you saw. That gap is price impact, and unlike fees it is");
  console.log("a function of your size relative to the reserves.");

  heading("At launch reserves (30 SOL virtual)");
  const launch = launchBondingCurve();
  row("Spot price", `${spotPriceLamports(launch).toString()} lamports/token`);
  for (const entry of buildImpactLadder(global, feeConfig, launch, sizes)) {
    row(formatSol(entry.solAmount, 1), formatTokens(entry.tokensOut, 0));
    row("  impact", `${entry.impactBps.toString()} bps`);
    row("  effective price", `${entry.effectivePriceLamports.toString()} lamports/token`);
    row("  premium over spot", `${entry.premiumOverSpotBps.toString()} bps (fees + impact)`);
  }

  heading("The same sizes deeper into the curve (90 SOL virtual)");
  const deep = curveAtVirtualSol(global, new BN("90000000000"));
  row("Spot price", `${spotPriceLamports(deep).toString()} lamports/token`);
  for (const entry of buildImpactLadder(global, feeConfig, deep, sizes)) {
    row(formatSol(entry.solAmount, 1), `${entry.impactBps.toString()} bps impact`);
  }
  console.log("\nDeeper reserves absorb the same order with less movement, which is");
  console.log("why a late buy is cheaper per token in impact terms even though the");
  console.log("token itself costs more.");

  heading("Fees versus impact");
  const oneSol = measureImpact({
    global,
    feeConfig,
    bondingCurve: launch,
    solAmount: SOL(1),
  });
  row("Premium over spot", `${oneSol.premiumOverSpotBps.toString()} bps`);
  row("Curve impact of the buy", `${oneSol.impactBps.toString()} bps`);
  console.log("\nThe premium is well below the impact, and that is expected: impact");
  console.log("measures where the price ends up, while the fill averages every");
  console.log("price along the way. The premium also already carries the fee rate,");
  console.log("300 bps on this tier, so the averaging cost is what remains.");

  heading("Cross-check against the SDK");
  for (const entry of buildImpactLadder(global, feeConfig, launch, sizes)) {
    row(
      formatSol(entry.solAmount, 1),
      `local ${entry.impactBps.toString()} bps, calculateBuyPriceImpact ${entry.sdkImpactBps} bps`,
    );
  }
  console.log("\ncalculateBuyPriceImpact divides the two spot prices after scaling");
  console.log("each by 1e9, so it truncates twice where the cross-multiplied form");
  console.log("truncates once. The two agree to within a basis point.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
