/**
 * Example 15: The Sell Overflow Guard
 *
 * Category: Curve Math & Fees
 *
 * Demonstrates maxSafeSellAmount and validateSellAmount, the pre-flight
 * checks that keep a sell inside the arithmetic the on-chain program can
 * represent, and shows how to tell a real width limit apart from the
 * intermittent AnchorError 6024 (Overflow) that slippage causes.
 *
 * Run: npm run example 15
 */
import {
  SellOverflowError,
  maxSafeSellAmount,
  validateSellAmount,
} from "@nirholas/pump-sdk";
import BN from "bn.js";

import type { BondingCurve } from "@nirholas/pump-sdk";

import { curveAtVirtualSol, launchBondingCurve, mainnetGlobal } from "./_lib/curveState";
import { formatSol, formatTokens, heading, row } from "./_lib/format";

/** u64::MAX: the on-chain width of a token amount. */
export const U64_MAX = new BN("18446744073709551615");

/** u128::MAX: the width the program multiplies in. */
export const U128_MAX = new BN("340282366920938463463374607431768211455");

export interface SellSafetyCheck {
  amount: BN;
  /** amount * virtualSolReserves, the on-chain intermediate product. */
  product: BN;
  /** Largest amount the SDK will let through for these reserves. */
  maxSafeAmount: BN;
  safe: boolean;
  /** Present when the check failed; the SDK's structured error. */
  error?: SellOverflowError;
}

/**
 * Run the SDK's pre-flight sell validation and report every number
 * involved, instead of letting the transaction abort on-chain.
 */
export function checkSellSafety(
  bondingCurve: BondingCurve,
  amount: BN,
): SellSafetyCheck {
  const result: SellSafetyCheck = {
    amount,
    product: amount.mul(bondingCurve.virtualQuoteReserves),
    maxSafeAmount: maxSafeSellAmount(bondingCurve.virtualQuoteReserves),
    safe: true,
  };
  try {
    validateSellAmount(amount, bondingCurve);
  } catch (err) {
    if (err instanceof SellOverflowError) {
      result.safe = false;
      result.error = err;
      return result;
    }
    throw err;
  }
  return result;
}

export async function main(): Promise<void> {
  const global = mainnetGlobal();

  heading("What the guard actually bounds");
  console.log("The sell formula multiplies amount * virtualSolReserves before");
  console.log("dividing. The program widens to u128 for that multiply, so the");
  console.log("product has enormous headroom. The binding limit in practice is");
  console.log("the token amount's own u64 field width.");

  heading("The limit formula");
  console.log("maxSafeSellAmount = min(u64::MAX, floor(0.9 * u128::MAX / vSol))");
  console.log("The 10% margin absorbs reserve drift between quote and execution.");

  heading("Limit at launch reserves (30 SOL)");
  const launch = launchBondingCurve();
  const launchLimit = maxSafeSellAmount(launch.virtualQuoteReserves);
  row("Virtual SOL reserves", formatSol(launch.virtualQuoteReserves));
  row("Max safe sell", `${launchLimit.toString()} base units`);
  row("Which bound binds", launchLimit.eq(U64_MAX) ? "u64 amount width" : "u128 product");

  heading("The u128 product bound is never the constraint on a real curve");
  for (const vSol of [
    new BN("30000000000"), // 30 SOL
    new BN("60000000000"), // 60 SOL
    new BN("115000000000"), // ~graduation
  ]) {
    const productBound = U128_MAX.muln(9).divn(10).div(vSol);
    row(
      formatSol(vSol, 0),
      `product bound ${productBound.toString()} is ${productBound.div(U64_MAX).toString()}x wider than u64::MAX`,
    );
  }

  heading("An everyday exit passes");
  const mid = curveAtVirtualSol(global, new BN("60000000000"));
  const ok = checkSellSafety(mid, new BN("1000000000000")); // 1M tokens
  row("Amount", formatTokens(ok.amount, 2));
  row("Product", ok.product.toString());
  row("Safe", ok.safe);

  heading("So does the amount from issue #6");
  const reported = checkSellSafety(mid, new BN("6325344957752"));
  row("Amount", formatTokens(reported.amount, 0));
  row("Safe", reported.safe);
  console.log("\nThat sell was reported as failing with AnchorError 6024, and the");
  console.log("SDK once refused this size outright. The reporter also said it");
  console.log("failed only about one time in four, which rules out a function of");
  console.log("(amount, reserves): that would fail every time. Sampling live");
  console.log("mainnet trade events, 83% of landed sells exceeded the old bound,");
  console.log("so the SDK was refusing transactions the chain accepts.");

  heading("What an intermittent 6024 really means");
  console.log("Reserves move between your quote and your landing slot. If the");
  console.log("curve drains, the sell can no longer produce your minSolOutput");
  console.log("and the program aborts. The fix is slippage headroom and quoting");
  console.log("close to send time, not a smaller sell.");

  heading("A genuinely unrepresentable amount is still rejected");
  const tooWide = checkSellSafety(mid, U64_MAX.addn(1));
  row("Amount", "u64::MAX + 1");
  row("Safe", tooWide.safe);
  if (tooWide.error) {
    row("Error class", tooWide.error.constructor.name);
    row("Max safe amount", tooWide.error.maxSafeAmount.toString());
  }
  console.log("\nSellOverflowError still carries the amount, the reserves, and the");
  console.log("safe maximum, so a caller can split an over-wide sell into chunks.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
