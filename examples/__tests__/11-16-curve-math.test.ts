/**
 * Offline tests for the Curve Math & Fees examples (11-16).
 *
 * Grouped in one suite because they share the same fixture-shaped curve
 * state and cross-check each other: quotes round-trip, market cap grows
 * with buys, target-SOL plans stay within safety bounds, and the launch
 * ladder's reserves stay consistent under the constant-product invariant.
 */
import BN from "bn.js";

import { makeGlobal, makeBondingCurve } from "../../src/__tests__/fixtures";
import { launchContext, quoteTokensForSol, quoteSolForTokens, roundTrip } from "../11-buy-quote-offline";
import { quoteSellBreakdown, compareCreatorFeeImpact } from "../12-sell-quote-offline";
import { marketCapOf, buildMarketCapTable } from "../13-market-cap";
import { planTargetSol, maxSingleSellExtraction, buildTargetSolTable } from "../14-target-sol";
import { U64_MAX, checkSellSafety } from "../15-max-safe-sell";
import { spotPriceLamportsPerMillionTokens, applyBuy, simulateBuySequence } from "../16-launch-price-ladder";

const SOL = (n: number) => new BN(n).mul(new BN(1_000_000_000));

describe("example 11: offline buy quotes", () => {
  const ctx = launchContext();

  it("quotes more tokens for more SOL, monotonically", () => {
    const small = quoteTokensForSol(ctx, SOL(1));
    const large = quoteTokensForSol(ctx, SOL(5));
    expect(small.gtn(0)).toBe(true);
    expect(large.gt(small)).toBe(true);
  });

  it("round-trips a quote back to nearly the same SOL", () => {
    const trip = roundTrip(ctx, SOL(1));
    expect(trip.driftBps.lten(5)).toBe(true);
  });

  it("reverse quote is consistent with the forward quote", () => {
    const tokens = quoteTokensForSol(ctx, SOL(2));
    const sol = quoteSolForTokens(ctx, tokens);
    expect(sol.gtn(0)).toBe(true);
    expect(sol.lte(SOL(2))).toBe(true);
  });
});

describe("example 12: offline sell quotes", () => {
  const activeCurve = makeBondingCurve({
    realQuoteReserves: SOL(10),
    virtualQuoteReserves: SOL(40),
  });

  it("breaks proceeds into net and fees that sum to gross", () => {
    const q = quoteSellBreakdown(makeGlobal(), activeCurve, new BN("50000000000000"));
    expect(q.netSol.gtn(0)).toBe(true);
    expect(q.netSol.add(q.feeSol).eq(q.grossSol)).toBe(true);
  });

  it("a creator-owned curve nets less than a creatorless one", () => {
    const cmp = compareCreatorFeeImpact(makeGlobal(), new BN("50000000000000"));
    expect(cmp.netWithCreator.lte(cmp.netWithoutCreator)).toBe(true);
    expect(cmp.creatorFeeCost.gten(0)).toBe(true);
  });
});

describe("example 13: market cap", () => {
  it("grows as the curve fills", () => {
    const table = buildMarketCapTable(makeGlobal());
    expect(table.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < table.length; i += 1) {
      expect(table[i]!.marketCap.gte(table[i - 1]!.marketCap)).toBe(true);
    }
  });

  it("is positive for fixture state", () => {
    expect(marketCapOf(makeGlobal(), makeBondingCurve()).gtn(0)).toBe(true);
  });
});

describe("example 14: target SOL extraction", () => {
  const global = makeGlobal();
  const curve = makeBondingCurve({
    realQuoteReserves: SOL(20),
    virtualQuoteReserves: SOL(50),
    virtualTokenReserves: new BN("500000000000000"),
    realTokenReserves: new BN("300000000000000"),
  });

  it("plans a sell that nets at least the target", () => {
    const plan = planTargetSol(global, curve, SOL(1));
    expect(plan.capped).toBe(false);
    expect(plan.tokenAmount.gtn(0)).toBe(true);
    expect(plan.actualSolOut.gte(SOL(1))).toBe(true);
  });

  it("caps an impossible target at the safe maximum", () => {
    const plan = planTargetSol(global, curve, SOL(1_000_000));
    expect(plan.capped).toBe(true);
    const max = maxSingleSellExtraction(global, curve);
    expect(plan.actualSolOut.lte(max.solOut)).toBe(true);
  });

  it("max single-sell extraction stays within the curve's reserves", () => {
    const max = maxSingleSellExtraction(global, curve);
    expect(max.tokenAmount.lte(curve.realTokenReserves)).toBe(true);
    expect(max.solOut.gtn(0)).toBe(true);
  });

  it("builds a table across targets", () => {
    expect(buildTargetSolTable(global, curve, [SOL(1), SOL(5)]).length).toBe(2);
  });
});

describe("example 15: max safe sell", () => {
  it("flags an amount wider than the on-chain u64 token field", () => {
    const check = checkSellSafety(makeBondingCurve(), U64_MAX.addn(1));
    expect(check.safe).toBe(false);
    expect(check.maxSafeAmount.lte(U64_MAX)).toBe(true);
    expect(check.error).toBeDefined();
  });

  it("accepts the issue #6 amount that the old u64-derived bound refused", () => {
    const curve = makeBondingCurve({ virtualQuoteReserves: new BN("60000000000") });
    expect(checkSellSafety(curve, new BN("6325344957752")).safe).toBe(true);
  });

  it("passes ordinary position sizes", () => {
    // 1M tokens (6 decimals) against a fresh curve: an everyday exit, and
    // the size class the old u64-derived bound used to refuse.
    const check = checkSellSafety(makeBondingCurve(), new BN("1000000000000"));
    expect(check.safe).toBe(true);
    expect(check.error).toBeUndefined();
  });
});

describe("example 16: launch price ladder", () => {
  const global = makeGlobal();

  it("each buy raises the spot price", () => {
    const steps = simulateBuySequence(global, [SOL(1), SOL(1), SOL(1)]);
    expect(steps.length).toBe(3);
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]!.spotPrice.gte(steps[i - 1]!.spotPrice)).toBe(true);
    }
  });

  it("applyBuy moves reserves the way the program does", () => {
    const before = makeBondingCurve();
    const spotBefore = spotPriceLamportsPerMillionTokens(before);
    const { curve: after, tokensOut, solIntoReserves } = applyBuy(global, before, SOL(5));
    expect(tokensOut.gtn(0)).toBe(true);
    expect(solIntoReserves.gtn(0)).toBe(true);
    expect(solIntoReserves.lte(SOL(5))).toBe(true);
    expect(after.virtualQuoteReserves.gt(before.virtualQuoteReserves)).toBe(true);
    expect(after.virtualTokenReserves.lt(before.virtualTokenReserves)).toBe(true);
    expect(spotPriceLamportsPerMillionTokens(after).gte(spotBefore)).toBe(true);
  });
});
