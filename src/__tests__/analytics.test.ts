import BN from "bn.js";

import {
  INITIAL_REAL_TOKEN_RESERVES,
  bondingCurveGraduationProgress,
  calculateBuyPriceImpact,
  calculateSellPriceImpact,
  getGraduationProgress,
  getTokenPrice,
  getBondingCurveSummary,
} from "../analytics";

import {
  makeGlobal,
  makeBondingCurve,
  makeGraduatedBondingCurve,
  makeMigratedBondingCurve,
} from "./fixtures";

const global = makeGlobal();
const mintSupply = global.tokenTotalSupply;

describe("analytics", () => {
  // ── calculateBuyPriceImpact ────────────────────────────────────────

  describe("calculateBuyPriceImpact", () => {
    it("returns positive price impact for a buy", () => {
      const result = calculateBuyPriceImpact({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        solAmount: new BN("1000000000"), // 1 SOL
      });
      expect(result.impactBps).toBeGreaterThan(0);
      expect(result.outputAmount.gt(new BN(0))).toBe(true);
      expect(result.priceBefore.gt(new BN(0))).toBe(true);
      expect(result.priceAfter.gt(result.priceBefore)).toBe(true);
    });

    it("larger buy → larger price impact", () => {
      const bc = makeBondingCurve();
      const small = calculateBuyPriceImpact({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
        solAmount: new BN("100000000"), // 0.1 SOL
      });
      const large = calculateBuyPriceImpact({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
        solAmount: new BN("10000000000"), // 10 SOL
      });
      expect(large.impactBps).toBeGreaterThan(small.impactBps);
    });
  });

  // ── calculateSellPriceImpact ───────────────────────────────────────

  describe("calculateSellPriceImpact", () => {
    it("returns positive price impact for a sell", () => {
      const result = calculateSellPriceImpact({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        tokenAmount: new BN("1000000000000"), // 1M tokens
      });
      expect(result.impactBps).toBeGreaterThan(0);
      expect(result.outputAmount.gt(new BN(0))).toBe(true);
    });
  });

  // ── getGraduationProgress ──────────────────────────────────────────

  describe("getGraduationProgress", () => {
    it("shows 0% progress for fresh curve", () => {
      const result = getGraduationProgress(global, makeBondingCurve());
      expect(result.progressBps).toBe(0);
      expect(result.isGraduated).toBe(false);
      expect(result.tokensRemaining.eq(global.initialRealTokenReserves)).toBe(true);
    });

    it("shows 100% for graduated curve", () => {
      const result = getGraduationProgress(global, makeGraduatedBondingCurve());
      expect(result.progressBps).toBe(10_000);
      expect(result.isGraduated).toBe(true);
      expect(result.tokensRemaining.eq(new BN(0))).toBe(true);
    });

    it("shows partial progress for partially sold curve", () => {
      // Sell half the real tokens
      const halfSold = makeBondingCurve({
        realTokenReserves: global.initialRealTokenReserves.divn(2),
        realQuoteReserves: new BN("40000000000"),
      });
      const result = getGraduationProgress(global, halfSold);
      expect(result.progressBps).toBeGreaterThan(4900);
      expect(result.progressBps).toBeLessThan(5100);
      expect(result.isGraduated).toBe(false);
    });

    it("handles zero initialRealTokenReserves", () => {
      const zeroGlobal = makeGlobal({ initialRealTokenReserves: new BN(0) });
      const result = getGraduationProgress(zeroGlobal, makeBondingCurve());
      expect(result.progressBps).toBe(0);
    });

    it("solNeededToGraduate is zero for graduated curve", () => {
      const result = getGraduationProgress(global, makeGraduatedBondingCurve());
      expect(result.solNeededToGraduate.isZero()).toBe(true);
    });

    it("solNeededToGraduate is positive for a fresh curve", () => {
      const result = getGraduationProgress(global, makeBondingCurve());
      expect(result.solNeededToGraduate.gtn(0)).toBe(true);
    });

    it("solNeededToGraduate is positive for fresh and partial-fill curves", () => {
      // The bonding curve is non-linear: buying remaining tokens mid-curve costs
      // MORE per token (steeper price), not less. Both states should have a
      // positive cost to graduate.
      const fresh = getGraduationProgress(global, makeBondingCurve());
      const halfSold = getGraduationProgress(
        global,
        makeBondingCurve({
          realTokenReserves: global.initialRealTokenReserves.divn(2),
          virtualQuoteReserves: new BN("30000000000").add(new BN("40000000000")),
          virtualTokenReserves: new BN("1073000000000000").sub(
            global.initialRealTokenReserves.divn(2),
          ),
        }),
      );
      expect(fresh.solNeededToGraduate.gtn(0)).toBe(true);
      expect(halfSold.solNeededToGraduate.gtn(0)).toBe(true);
    });

    it("solNeededToGraduate is zero when initialRealTokenReserves is zero", () => {
      const zeroGlobal = makeGlobal({ initialRealTokenReserves: new BN(0) });
      const result = getGraduationProgress(zeroGlobal, makeBondingCurve());
      expect(result.solNeededToGraduate.isZero()).toBe(true);
    });
  });

  // ── bondingCurveGraduationProgress ─────────────────────────────────

  describe("bondingCurveGraduationProgress", () => {
    const fresh = {
      realSolReserves: new BN(0),
      realTokenReserves: INITIAL_REAL_TOKEN_RESERVES,
    };

    it("returns 0 for a curve where nothing has been sold", () => {
      expect(bondingCurveGraduationProgress(fresh)).toBe(0);
    });

    it("returns 1 once real token reserves are exhausted", () => {
      expect(
        bondingCurveGraduationProgress({
          realSolReserves: new BN("85000000000"),
          realTokenReserves: new BN(0),
        }),
      ).toBe(1);
    });

    it("returns the sold fraction partway up the curve", () => {
      const half = INITIAL_REAL_TOKEN_RESERVES.divn(2);
      const progress = bondingCurveGraduationProgress({
        realSolReserves: new BN("30000000000"),
        realTokenReserves: half,
      });
      expect(progress).toBeGreaterThan(0.49);
      expect(progress).toBeLessThan(0.51);
    });

    it("honors a custom initial reserve for mayhem-mode curves", () => {
      const initialRealTokenReserves = new BN("400000000000000");
      const progress = bondingCurveGraduationProgress({
        realSolReserves: new BN("10000000000"),
        realTokenReserves: initialRealTokenReserves.divn(4),
        initialRealTokenReserves,
      });
      expect(progress).toBeGreaterThan(0.74);
      expect(progress).toBeLessThan(0.76);
    });

    it("returns 0 when the initial reserve is zero rather than dividing by it", () => {
      expect(
        bondingCurveGraduationProgress({
          realSolReserves: new BN(0),
          realTokenReserves: new BN("1000"),
          initialRealTokenReserves: new BN(0),
        }),
      ).toBe(0);
    });

    it("clamps to 0 when reserves exceed the stated initial reserve", () => {
      expect(
        bondingCurveGraduationProgress({
          realSolReserves: new BN(0),
          realTokenReserves: INITIAL_REAL_TOKEN_RESERVES.muln(2),
        }),
      ).toBe(0);
    });

    it("never reports progress outside [0, 1]", () => {
      for (const divisor of [1, 3, 7, 100, 10_000]) {
        const progress = bondingCurveGraduationProgress({
          realSolReserves: new BN(0),
          realTokenReserves: INITIAL_REAL_TOKEN_RESERVES.divn(divisor),
        });
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(1);
      }
    });

    it("agrees with getGraduationProgress, which reports the same curve in bps", () => {
      const bondingCurve = makeBondingCurve({
        realTokenReserves: INITIAL_REAL_TOKEN_RESERVES.divn(4),
      });
      const { progressBps } = getGraduationProgress(global, bondingCurve);
      const fraction = bondingCurveGraduationProgress({
        realSolReserves: bondingCurve.realQuoteReserves,
        realTokenReserves: bondingCurve.realTokenReserves,
      });
      expect(Math.round(fraction * 10_000)).toBe(progressBps);
    });
  });

  // ── getTokenPrice ──────────────────────────────────────────────────

  describe("getTokenPrice", () => {
    it("reports a migrated curve as graduated instead of dividing by zero", () => {
      // PumpAMM migration zeroes the virtual reserves. Every constant-product
      // formula over them is undefined, so the helper short-circuits.
      const result = getTokenPrice({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeMigratedBondingCurve(),
      });
      expect(result.isGraduated).toBe(true);
      expect(result.buyPricePerToken.isZero()).toBe(true);
      expect(result.sellPricePerToken.isZero()).toBe(true);
      expect(result.marketCap.isZero()).toBe(true);
    });

    it("returns buy and sell prices for 1 token", () => {
      const result = getTokenPrice({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
      });
      expect(result.buyPricePerToken.gt(new BN(0))).toBe(true);
      expect(result.sellPricePerToken.gt(new BN(0))).toBe(true);
      expect(result.marketCap.gt(new BN(0))).toBe(true);
      expect(result.isGraduated).toBe(false);
      // Buy price should be higher than sell price (spread)
      expect(result.buyPricePerToken.gt(result.sellPricePerToken)).toBe(true);
    });
  });

  // ── getBondingCurveSummary ─────────────────────────────────────────

  describe("getBondingCurveSummary", () => {
    it("returns a complete summary", () => {
      const bc = makeBondingCurve();
      const summary = getBondingCurveSummary({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
      });
      expect(summary.marketCap.gt(new BN(0))).toBe(true);
      expect(summary.progressBps).toBe(0);
      expect(summary.isGraduated).toBe(false);
      expect(summary.buyPricePerToken.gt(new BN(0))).toBe(true);
      expect(summary.sellPricePerToken.gt(new BN(0))).toBe(true);
      expect(summary.virtualSolReserves.eq(bc.virtualQuoteReserves)).toBe(true);
      expect(summary.virtualTokenReserves.eq(bc.virtualTokenReserves)).toBe(true);
    });

    it("includes solNeededToGraduate", () => {
      const summary = getBondingCurveSummary({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
      });
      expect(summary.solNeededToGraduate.gtn(0)).toBe(true);
    });

    it("solNeededToGraduate is zero for graduated curve", () => {
      const summary = getBondingCurveSummary({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeGraduatedBondingCurve(),
      });
      expect(summary.solNeededToGraduate.isZero()).toBe(true);
    });

    it("includes protocolFeeBps and creatorFeeBps from global defaults when feeConfig is null", () => {
      const summary = getBondingCurveSummary({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
      });
      expect(summary.protocolFeeBps.eq(global.feeBasisPoints)).toBe(true);
      expect(summary.creatorFeeBps.eq(global.creatorFeeBasisPoints)).toBe(true);
    });

    it("isMayhemMode reflects the bonding curve flag", () => {
      const standardSummary = getBondingCurveSummary({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve({ isMayhemMode: false }),
      });
      const mayhemSummary = getBondingCurveSummary({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve({ isMayhemMode: true }),
      });
      expect(standardSummary.isMayhemMode).toBe(false);
      expect(mayhemSummary.isMayhemMode).toBe(true);
    });
  });
});
