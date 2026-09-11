/**
 * Example 14: Sell Enough Tokens to Extract N SOL
 *
 * Category: Curve Math & Fees
 *
 * Answers the exit-planning question "how many tokens must I sell to take
 * home N lamports after fees?" using the SDK's binary search over the sell
 * quote, offline. Also shows the hard ceiling every plan runs into: a
 * single sell cannot draw more than the curve's remaining inventory, so
 * larger exits must be split across several sells.
 *
 * Run: npm run example 14
 */
import {
  getSellSolAmountFromTokenAmount,
  getTokenAmountForTargetSol,
  maxSafeSellAmount,
} from "@nirholas/pump-sdk";
import BN from "bn.js";

import type { BondingCurve, Global } from "@nirholas/pump-sdk";

import { curveAtVirtualSol, mainnetGlobal } from "./_lib/curveState";
import { formatSol, formatTokens, heading, row } from "./_lib/format";

export interface TargetSolPlan {
  targetSol: BN;
  /** Tokens to sell, clamped to the single-instruction safe limit. */
  tokenAmount: BN;
  /** Net SOL those tokens actually yield after fees. */
  actualSolOut: BN;
  /** True when the target exceeds what one safe sell can extract. */
  capped: boolean;
}

/**
 * Plan a sell that nets at least `targetSol` lamports after fees.
 *
 * The SDK binary-searches the smallest token amount whose net proceeds
 * reach the target. When even the largest safe sell cannot reach it, the
 * safe ceiling comes back and `capped` is true.
 */
export function planTargetSol(
  global: Global,
  bondingCurve: BondingCurve,
  targetSol: BN,
): TargetSolPlan {
  const mintSupply = global.tokenTotalSupply;
  const tokenAmount = getTokenAmountForTargetSol({
    global,
    feeConfig: null,
    mintSupply,
    bondingCurve,
    targetSol,
  });
  const actualSolOut = getSellSolAmountFromTokenAmount({
    global,
    feeConfig: null,
    mintSupply,
    bondingCurve,
    amount: tokenAmount,
  });
  return {
    targetSol,
    tokenAmount,
    actualSolOut,
    capped: actualSolOut.lt(targetSol),
  };
}

/**
 * The most SOL a single safe sell instruction can extract from this curve,
 * and the token amount that extracts it.
 */
export function maxSingleSellExtraction(
  global: Global,
  bondingCurve: BondingCurve,
): { tokenAmount: BN; solOut: BN } {
  const tokenAmount = BN.min(
    bondingCurve.realTokenReserves,
    maxSafeSellAmount(bondingCurve.virtualQuoteReserves),
  );
  const solOut = getSellSolAmountFromTokenAmount({
    global,
    feeConfig: null,
    mintSupply: global.tokenTotalSupply,
    bondingCurve,
    amount: tokenAmount,
  });
  return { tokenAmount, solOut };
}

/** Plan a list of lamport targets against the same curve state. */
export function buildTargetSolTable(
  global: Global,
  bondingCurve: BondingCurve,
  targets: BN[],
): TargetSolPlan[] {
  return targets.map((targetSol) => planTargetSol(global, bondingCurve, targetSol));
}

export async function main(): Promise<void> {
  const global = mainnetGlobal();
  // Mid-curve state: 30 SOL already raised, so there is real SOL to extract.
  const curve = curveAtVirtualSol(global, new BN("60000000000"));

  heading("Curve state (mid-curve, 30 SOL raised)");
  row("Virtual SOL reserves", formatSol(curve.virtualQuoteReserves));
  row("Real SOL in the curve", formatSol(curve.realQuoteReserves));
  row("Real tokens left", formatTokens(curve.realTokenReserves, 0));

  heading("The single-sell ceiling");
  const ceiling = maxSingleSellExtraction(global, curve);
  row("Max safe token amount", formatTokens(ceiling.tokenAmount, 2));
  row("SOL that extracts", `${ceiling.solOut.toString()} lamports (${formatSol(ceiling.solOut, 9)})`);
  console.log(
    "\nEvery plan is bounded by the smaller of the curve's remaining token",
  );
  console.log(
    "inventory and maxSafeSellAmount. On any real curve inventory binds",
  );
  console.log(
    "first: the arithmetic limit sits far above it (example 15).",
  );

  heading("Binary-searched plans for reachable targets");
  const targets = [
    ceiling.solOut.divn(10), // 10% of the ceiling
    ceiling.solOut.divn(4), // 25%
    ceiling.solOut.divn(2), // 50%
    ceiling.solOut.muln(9).divn(10), // 90%
  ];
  for (const plan of buildTargetSolTable(global, curve, targets)) {
    row(
      `Target ${plan.targetSol.toString()} lamports`,
      `sell ${formatTokens(plan.tokenAmount, 2)}  nets ${plan.actualSolOut.toString()} lamports`,
    );
  }

  heading("A reachable target is met exactly");
  const oneSol = planTargetSol(global, curve, new BN("1000000000"));
  row("Target", formatSol(oneSol.targetSol));
  row("Tokens to sell", formatTokens(oneSol.tokenAmount, 2));
  row("Net proceeds", `${oneSol.actualSolOut.toString()} lamports`);
  row("Capped", oneSol.capped);

  heading("An unreachable target gets clamped");
  // Past the ceiling this curve can yield, so the plan reports the best it
  // can do rather than a token amount the curve cannot fill.
  const beyond = planTargetSol(global, curve, ceiling.solOut.muln(2));
  row("Target", formatSol(beyond.targetSol));
  row("Clamped token amount", formatTokens(beyond.tokenAmount, 2));
  row("Best possible net", `${beyond.actualSolOut.toString()} lamports`);
  row("Capped", beyond.capped);
  console.log(
    "\nWhen the target exceeds the ceiling, the SDK returns the ceiling",
  );
  console.log(
    "instead of a token amount the curve cannot fill. To extract more,",
  );
  console.log(
    "issue several sells: each one shifts the reserves, so re-plan against",
  );
  console.log("the updated curve state between chunks.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
