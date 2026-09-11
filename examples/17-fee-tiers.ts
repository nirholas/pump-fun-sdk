/**
 * Example 17: Fee Tiers by Market Cap
 *
 * Category: Curve Math & Fees
 *
 * Walks calculateFeeTier and computeFeesBps across market caps, rendering
 * the tier table the fee program actually applies. Covers the two rules
 * that surprise integrators: a below-first-threshold cap still selects the
 * first tier, and getFee prices the cap against a fixed 1B supply unless
 * the curve is in mayhem mode.
 *
 * Run: npm run example 17
 */
import {
  ONE_BILLION_SUPPLY,
  bondingCurveMarketCap,
  calculateFeeTier,
  computeFeesBps,
  getFee,
} from "@nirholas/pump-sdk";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import type {
  BondingCurve,
  CalculatedFeesBps,
  FeeConfig,
  Fees,
  Global,
} from "@nirholas/pump-sdk";

import {
  curveAtVirtualSol,
  graduationVirtualSol,
  launchBondingCurve,
  mainnetFeeConfig,
  mainnetGlobal,
} from "./_lib/curveState";
import { formatSol, heading, row } from "./_lib/format";

/** One row of the rendered tier table. */
export interface FeeTierRow {
  label: string;
  /** Market cap in lamports the tier was selected with. */
  marketCap: BN;
  protocolFeeBps: BN;
  creatorFeeBps: BN;
  lpFeeBps: BN;
  /** protocol + creator + lp, the all-in rate a trader pays. */
  totalBps: BN;
}

/** One rung of the fee ladder as a curve fills up. */
export interface CurveFeePoint {
  virtualSolReserves: BN;
  marketCap: BN;
  fees: CalculatedFeesBps;
}

/** The tier the fee program selects for a given market cap. */
export function feesAtMarketCap(feeConfig: FeeConfig, marketCap: BN): Fees {
  return calculateFeeTier({ feeTiers: feeConfig.feeTiers, marketCap });
}

/** Render a set of market caps as tier rows. */
export function buildTierTable(
  feeConfig: FeeConfig,
  points: ReadonlyArray<{ label: string; marketCap: BN }>,
): FeeTierRow[] {
  return points.map(({ label, marketCap }) => {
    const fees = feesAtMarketCap(feeConfig, marketCap);
    return {
      label,
      marketCap,
      protocolFeeBps: fees.protocolFeeBps,
      creatorFeeBps: fees.creatorFeeBps,
      lpFeeBps: fees.lpFeeBps,
      totalBps: fees.protocolFeeBps
        .add(fees.creatorFeeBps)
        .add(fees.lpFeeBps),
    };
  });
}

/**
 * The supply `getFee` prices the market cap against.
 *
 * A tier lookup needs a market cap, and a market cap needs a supply. The
 * program does NOT use the mint's own supply for a normal coin: it uses a
 * fixed 1,000,000,000-token constant, so every standard launch walks the
 * same cap thresholds regardless of what its mint reports. Only a mayhem
 * mode curve, whose supply is deliberately non-standard, is priced against
 * its real supply. Mirroring that here is the difference between a quote
 * that matches the chain and one that is a tier off.
 */
export function feeSupplyBasis(bondingCurve: BondingCurve, mintSupply: BN): BN {
  return bondingCurve.isMayhemMode ? mintSupply : ONE_BILLION_SUPPLY;
}

/** The bps pair `getFee` will use for this curve, without computing a fee. */
export function feesForCurve(
  global: Global,
  feeConfig: FeeConfig | null,
  bondingCurve: BondingCurve,
  mintSupply: BN,
): CalculatedFeesBps {
  return computeFeesBps({
    global,
    feeConfig,
    mintSupply: feeSupplyBasis(bondingCurve, mintSupply),
    virtualQuoteReserves: bondingCurve.virtualQuoteReserves,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
  });
}

/** The lamport fee on a trade of `amount` lamports against this curve. */
export function tradeFee({
  global,
  feeConfig,
  bondingCurve,
  mintSupply,
  amount,
  isNewBondingCurve = false,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  bondingCurve: BondingCurve;
  mintSupply: BN;
  amount: BN;
  isNewBondingCurve?: boolean;
}): BN {
  return getFee({
    global,
    feeConfig,
    mintSupply,
    bondingCurve,
    amount,
    isNewBondingCurve,
  });
}

/** Fee rates at a series of virtual SOL levels along one curve's life. */
export function curveFeeLadder(
  global: Global,
  feeConfig: FeeConfig,
  virtualSolLevels: ReadonlyArray<BN>,
): CurveFeePoint[] {
  return virtualSolLevels.map((virtualSolReserves) => {
    const curve = curveAtVirtualSol(global, virtualSolReserves);
    return {
      virtualSolReserves,
      marketCap: bondingCurveMarketCap({
        mintSupply: ONE_BILLION_SUPPLY,
        virtualQuoteReserves: curve.virtualQuoteReserves,
        virtualTokenReserves: curve.virtualTokenReserves,
      }),
      fees: feesForCurve(global, feeConfig, curve, global.tokenTotalSupply),
    };
  });
}

function bps(value: BN): string {
  return `${value.toString()} bps`;
}

export async function main(): Promise<void> {
  const global = mainnetGlobal();
  const feeConfig = mainnetFeeConfig();

  heading("How a tier is chosen");
  console.log("calculateFeeTier walks the tier list from the top down and takes");
  console.log("the first tier whose marketCapLamportsThreshold the cap reaches.");
  console.log("A cap below the lowest threshold does not fall through to zero");
  console.log("fees: the first tier is returned, so there is always a rate.");

  heading("Tier table");
  const table = buildTierTable(feeConfig, [
    { label: "Below first threshold", marketCap: new BN(0) },
    { label: "50 SOL cap", marketCap: new BN("50000000000") },
    { label: "100 SOL cap (tier 2 edge)", marketCap: new BN("100000000000") },
    { label: "999 SOL cap", marketCap: new BN("999000000000") },
    { label: "1000 SOL cap (tier 3 edge)", marketCap: new BN("1000000000000") },
    { label: "10000 SOL cap", marketCap: new BN("10000000000000") },
  ]);
  for (const entry of table) {
    row(entry.label, formatSol(entry.marketCap, 0));
    row(
      "  protocol / creator / lp",
      `${bps(entry.protocolFeeBps)} / ${bps(entry.creatorFeeBps)} / ${bps(entry.lpFeeBps)}`,
    );
    row("  all-in", bps(entry.totalBps));
  }

  heading("What a real curve reaches");
  const gradSol = graduationVirtualSol(global);
  const ladder = curveFeeLadder(global, feeConfig, [
    global.initialVirtualSolReserves,
    new BN("45000000000"),
    new BN("60000000000"),
    new BN("90000000000"),
    gradSol,
  ]);
  for (const point of ladder) {
    row(
      formatSol(point.virtualSolReserves, 0),
      `cap ${formatSol(point.marketCap, 2)}, protocol ${bps(point.fees.protocolFeeBps)}, creator ${bps(point.fees.creatorFeeBps)}`,
    );
  }
  console.log("\nA curve launches near 28 SOL of cap and graduates near 411 SOL,");
  console.log("so it crosses the 100 SOL threshold and never reaches 1000 SOL.");
  console.log("The top tier is an AMM-era rate, not a bonding curve one.");

  heading("The supply nuance inside getFee");
  const curve = launchBondingCurve();
  const mayhemCurve = launchBondingCurve({ isMayhemMode: true });
  const bigSupply = new BN("10000000000000000"); // 10B tokens
  const standard = feesForCurve(global, feeConfig, curve, bigSupply);
  const mayhem = feesForCurve(global, feeConfig, mayhemCurve, bigSupply);
  row("Reported mint supply", `${bigSupply.toString()} base units (10B tokens)`);
  row("Standard curve basis", `${feeSupplyBasis(curve, bigSupply).toString()} (fixed 1B)`);
  row("Standard curve rate", bps(standard.protocolFeeBps));
  row("Mayhem curve basis", `${feeSupplyBasis(mayhemCurve, bigSupply).toString()} (real supply)`);
  row("Mayhem curve rate", bps(mayhem.protocolFeeBps));
  console.log("\nSame reserves, same fee config, different tier: the mayhem curve");
  console.log("prices a 10x larger supply, so its cap clears the 100 SOL");
  console.log("threshold while the standard curve is still on the first tier.");

  heading("No fee config on chain");
  const flat = feesForCurve(global, null, curve, global.tokenTotalSupply);
  row("Protocol", bps(flat.protocolFeeBps));
  row("Creator", bps(flat.creatorFeeBps));
  console.log("With feeConfig null, computeFeesBps ignores tiers entirely and");
  console.log("returns Global.feeBasisPoints and Global.creatorFeeBasisPoints.");

  heading("Fee on an actual trade");
  const amount = new BN(1_000_000_000); // 1 SOL of trade value
  const midCurve = curveAtVirtualSol(global, new BN("60000000000"));
  const withCreator = tradeFee({
    global,
    feeConfig,
    bondingCurve: midCurve,
    mintSupply: global.tokenTotalSupply,
    amount,
  });
  const creatorless = tradeFee({
    global,
    feeConfig,
    bondingCurve: { ...midCurve, creator: PublicKey.default },
    mintSupply: global.tokenTotalSupply,
    amount,
  });
  row("Trade value", formatSol(amount));
  row("Curve", "60 SOL virtual, tier 2 (100 / 50 bps)");
  row("Fee, creator set", formatSol(withCreator, 6));
  row("Fee, no creator", formatSol(creatorless, 6));
  console.log("\ngetFee adds the creator component only when the curve carries a");
  console.log("creator or the curve is brand new, and rounds every component up.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
