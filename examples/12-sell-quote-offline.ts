/**
 * Example 12: Sell Quotes and Fee Impact
 *
 * Category: Curve Math & Fees
 *
 * Quotes bonding curve sells offline and splits every quote into gross
 * proceeds, fees taken, and net SOL received. Shows how the creator fee
 * changes what a seller actually keeps, which any PnL display or exit
 * calculator must account for.
 *
 * Run: npm run example 12
 */
import { getSellSolAmountFromTokenAmount } from "@nirholas/pump-sdk";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import type { BondingCurve, Global } from "@nirholas/pump-sdk";

import {
  EXAMPLE_CREATOR,
  launchBondingCurve,
  mainnetGlobal,
} from "./_lib/curveState";
import { formatSol, formatTokens, heading, row } from "./_lib/format";

export interface SellQuoteBreakdown {
  tokenAmount: BN;
  /** SOL the curve releases before any fee, in lamports. */
  grossSol: BN;
  /** Protocol fee plus creator fee (when a creator is set), in lamports. */
  feeSol: BN;
  /** What the seller actually receives, in lamports. */
  netSol: BN;
}

/**
 * Quote a sell and break it into gross, fee, and net.
 *
 * Gross proceeds come straight from the constant-product formula
 * (amount * vSol / (vTok + amount)); the SDK's sell quote then subtracts
 * protocol and creator fees, so fee = gross - net.
 */
export function quoteSellBreakdown(
  global: Global,
  bondingCurve: BondingCurve,
  tokenAmount: BN,
): SellQuoteBreakdown {
  const grossSol = tokenAmount
    .mul(bondingCurve.virtualQuoteReserves)
    .div(bondingCurve.virtualTokenReserves.add(tokenAmount));

  const netSol = getSellSolAmountFromTokenAmount({
    global,
    feeConfig: null,
    mintSupply: global.tokenTotalSupply,
    bondingCurve,
    amount: tokenAmount,
  });

  return { tokenAmount, grossSol, feeSol: grossSol.sub(netSol), netSol };
}

export interface FeeImpactComparison {
  tokenAmount: BN;
  /** Net proceeds when the curve has no creator set (protocol fee only). */
  netWithoutCreator: BN;
  /** Net proceeds when a creator collects their fee too. */
  netWithCreator: BN;
  /** Extra lamports the creator fee costs the seller. */
  creatorFeeCost: BN;
}

/** The same sell against two curves: one without a creator, one with. */
export function compareCreatorFeeImpact(
  global: Global,
  tokenAmount: BN,
): FeeImpactComparison {
  const withoutCreator = quoteSellBreakdown(
    global,
    launchBondingCurve({ creator: PublicKey.default }),
    tokenAmount,
  );
  const withCreator = quoteSellBreakdown(
    global,
    launchBondingCurve({ creator: EXAMPLE_CREATOR }),
    tokenAmount,
  );
  return {
    tokenAmount,
    netWithoutCreator: withoutCreator.netSol,
    netWithCreator: withCreator.netSol,
    creatorFeeCost: withoutCreator.netSol.sub(withCreator.netSol),
  };
}

export async function main(): Promise<void> {
  const global = mainnetGlobal();
  const curve = launchBondingCurve({ creator: EXAMPLE_CREATOR });

  heading("Curve state (fresh launch, creator set)");
  row("Virtual SOL reserves", formatSol(curve.virtualQuoteReserves));
  row("Virtual token reserves", formatTokens(curve.virtualTokenReserves));
  row("Protocol fee", `${global.feeBasisPoints.toString()} bps`);
  row("Creator fee", `${global.creatorFeeBasisPoints.toString()} bps`);

  heading("Sell quotes (gross / fee / net)");
  const sizes = [
    new BN("1000000000000"), // 1M tokens
    new BN("10000000000000"), // 10M tokens
    new BN("50000000000000"), // 50M tokens
    new BN("100000000000000"), // 100M tokens
  ];
  for (const amount of sizes) {
    const q = quoteSellBreakdown(global, curve, amount);
    row(
      formatTokens(q.tokenAmount, 0),
      `gross ${formatSol(q.grossSol, 6)}  fee ${formatSol(q.feeSol, 6)}  net ${formatSol(
        q.netSol,
        6,
      )}`,
    );
  }

  heading("Creator fee impact on 10M-token sell");
  const impact = compareCreatorFeeImpact(global, new BN("10000000000000"));
  row("Net, no creator (1% fee)", formatSol(impact.netWithoutCreator, 6));
  row("Net, creator set (1.5% fee)", formatSol(impact.netWithCreator, 6));
  row("Creator fee costs seller", formatSol(impact.creatorFeeCost, 6));

  heading("Why net can hit zero");
  const dust = quoteSellBreakdown(global, curve, new BN("35766"));
  row("Dust sell", formatTokens(dust.tokenAmount, 6));
  row("Gross", `${dust.grossSol.toString()} lamports`);
  row("Net (clamped)", `${dust.netSol.toString()} lamports`);
  console.log(
    "\nFees round up (ceiling division), so a dust sell whose gross proceeds",
  );
  console.log(
    "are ~1 lamport nets exactly 0. The SDK clamps instead of going negative,",
  );
  console.log(
    "because a negative amount encoded as u64 would wrap and abort on-chain.",
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
