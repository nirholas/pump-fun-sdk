import BN from "bn.js";

import {
  getBuyTokenAmountFromSolAmount,
  getBuySolAmountFromTokenAmount,
  getSellSolAmountFromTokenAmount,
  newBondingCurve,
  bondingCurveMarketCap,
  maxSafeSellAmount,
  validateSellAmount,
} from "../bondingCurve";
import { SellOverflowError } from "../errors";

import {
  makeGlobal,
  makeBondingCurve,
  makeMigratedBondingCurve,
  makeBondingCurveWithCreator,
} from "./fixtures";

const global = makeGlobal();
const mintSupply = global.tokenTotalSupply;

describe("bondingCurve", () => {
  // ── newBondingCurve ────────────────────────────────────────────────

  describe("newBondingCurve", () => {
    it("creates a bonding curve from global config", () => {
      const bc = newBondingCurve(global);
      expect(bc.virtualTokenReserves.eq(global.initialVirtualTokenReserves)).toBe(true);
      expect(bc.virtualSolReserves.eq(global.initialVirtualSolReserves)).toBe(true);
      expect(bc.realTokenReserves.eq(global.initialRealTokenReserves)).toBe(true);
      expect(bc.realSolReserves.eq(new BN(0))).toBe(true);
      expect(bc.complete).toBe(false);
    });
  });

  // ── getBuyTokenAmountFromSolAmount ─────────────────────────────────

  describe("getBuyTokenAmountFromSolAmount", () => {
    it("returns 0 for 0 SOL", () => {
      const result = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        amount: new BN(0),
      });
      expect(result.eq(new BN(0))).toBe(true);
    });

    it("returns tokens for a small buy (1 SOL)", () => {
      const oneSol = new BN("1000000000");
      const result = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        amount: oneSol,
      });
      expect(result.gt(new BN(0))).toBe(true);
      // Rough sanity: buying 1 SOL should give roughly ~34M tokens at initial price
      expect(result.gt(new BN("30000000000000"))).toBe(true);
      expect(result.lt(new BN("40000000000000"))).toBe(true);
    });

    it("handles null bondingCurve (new token)", () => {
      const oneSol = new BN("1000000000");
      const result = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig: null,
        mintSupply: null,
        bondingCurve: null,
        amount: oneSol,
      });
      expect(result.gt(new BN(0))).toBe(true);
    });

    it("returns 0 for migrated bonding curve", () => {
      const result = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeMigratedBondingCurve(),
        amount: new BN("1000000000"),
      });
      expect(result.eq(new BN(0))).toBe(true);
    });

    it("caps output at realTokenReserves", () => {
      // Try to buy with an enormous SOL amount that would exceed real reserves
      const hugeSol = new BN("999999999999999");
      const bc = makeBondingCurve();
      const result = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
        amount: hugeSol,
      });
      expect(result.lte(bc.realTokenReserves)).toBe(true);
    });

    it("applies higher fees with a creator set", () => {
      const oneSol = new BN("1000000000");
      const bcNoCreator = makeBondingCurve();
      const bcWithCreator = makeBondingCurveWithCreator();

      const tokensNoCreator = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bcNoCreator,
        amount: oneSol,
      });
      const tokensWithCreator = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bcWithCreator,
        amount: oneSol,
      });
      // Creator fee means fewer tokens
      expect(tokensWithCreator.lt(tokensNoCreator)).toBe(true);
    });
  });

  // ── getBuySolAmountFromTokenAmount ─────────────────────────────────

  describe("getBuySolAmountFromTokenAmount", () => {
    it("returns 0 for 0 tokens", () => {
      const result = getBuySolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        amount: new BN(0),
      });
      expect(result.eq(new BN(0))).toBe(true);
    });

    it("returns SOL cost for a token amount", () => {
      const tokenAmount = new BN("1000000"); // 1 whole token
      const result = getBuySolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        amount: tokenAmount,
      });
      expect(result.gt(new BN(0))).toBe(true);
    });

    it("handles null bondingCurve (new token)", () => {
      const result = getBuySolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply: null,
        bondingCurve: null,
        amount: new BN("1000000"),
      });
      expect(result.gt(new BN(0))).toBe(true);
    });

    it("returns 0 for migrated bonding curve", () => {
      const result = getBuySolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeMigratedBondingCurve(),
        amount: new BN("1000000"),
      });
      expect(result.eq(new BN(0))).toBe(true);
    });
  });

  // ── getSellSolAmountFromTokenAmount ────────────────────────────────

  describe("getSellSolAmountFromTokenAmount", () => {
    it("returns 0 for 0 tokens", () => {
      const result = getSellSolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        amount: new BN(0),
      });
      expect(result.eq(new BN(0))).toBe(true);
    });

    it("returns SOL for selling tokens", () => {
      const tokenAmount = new BN("1000000"); // 1 whole token
      const result = getSellSolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        amount: tokenAmount,
      });
      expect(result.gt(new BN(0))).toBe(true);
    });

    it("returns 0 for migrated bonding curve", () => {
      const result = getSellSolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeMigratedBondingCurve(),
        amount: new BN("1000000"),
      });
      expect(result.eq(new BN(0))).toBe(true);
    });

    it("returns 0 (not negative) for dust amounts where fee exceeds gross SOL", () => {
      // When gross_sol is tiny, ceilDiv fee rounding can exceed gross_sol.
      // A negative BN encoded as u64 wraps to ~u64::MAX, causing on-chain overflow.
      const dustAmount = new BN("35766"); // ~1 lamport gross SOL at initial reserves
      const result = getSellSolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        amount: dustAmount,
      });
      expect(result.gten(0)).toBe(true);
    });

    it("sell price < buy price (spread)", () => {
      const oneToken = new BN("1000000");
      const bc = makeBondingCurve();
      const buyCost = getBuySolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
        amount: oneToken,
      });
      const sellRevenue = getSellSolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
        amount: oneToken,
      });
      expect(sellRevenue.lt(buyCost)).toBe(true);
    });
  });

  // ── bondingCurveMarketCap ──────────────────────────────────────────

  describe("bondingCurveMarketCap", () => {
    it("calculates market cap correctly", () => {
      const bc = makeBondingCurve();
      const marketCap = bondingCurveMarketCap({
        mintSupply,
        virtualSolReserves: bc.virtualSolReserves,
        virtualTokenReserves: bc.virtualTokenReserves,
      });
      expect(marketCap.gt(new BN(0))).toBe(true);
      // At initial state: 30 SOL * 1B / 1.073B ≈ ~27.96 SOL
      const expectedApprox = new BN("27959925000"); // ~27.96 SOL
      // Within 10%
      expect(marketCap.gt(expectedApprox.muln(9).divn(10))).toBe(true);
      expect(marketCap.lt(expectedApprox.muln(11).divn(10))).toBe(true);
    });

    it("throws on zero virtual token reserves", () => {
      expect(() =>
        bondingCurveMarketCap({
          mintSupply,
          virtualSolReserves: new BN("30000000000"),
          virtualTokenReserves: new BN(0),
        }),
      ).toThrow("Division by zero");
    });
  });

  // ── maxSafeSellAmount / validateSellAmount ─────────────────────────

  describe("maxSafeSellAmount", () => {
    it("returns 0 when virtualSolReserves is 0", () => {
      expect(maxSafeSellAmount(new BN(0)).isZero()).toBe(true);
    });

    it("returns ~553M for 30 SOL reserves (90% of u64::MAX / 30e9)", () => {
      const limit = maxSafeSellAmount(new BN("30000000000"));
      expect(limit.gt(new BN(500_000_000))).toBe(true);
      expect(limit.lt(new BN(700_000_000))).toBe(true);
    });

    it("product stays under u64::MAX at the limit", () => {
      const reserves = new BN("30000000000");
      const limit = maxSafeSellAmount(reserves);
      const product = limit.mul(reserves);
      const U64_MAX = new BN("18446744073709551615");
      expect(product.lte(U64_MAX)).toBe(true);
    });
  });

  describe("validateSellAmount", () => {
    it("safe amount does not throw", () => {
      const bc = makeBondingCurve({ virtualSolReserves: new BN("30000000000") });
      expect(() => validateSellAmount(new BN(100_000_000), bc)).not.toThrow();
    });

    it("throws SellOverflowError when amount exceeds the safe limit", () => {
      const bc = makeBondingCurve({ virtualSolReserves: new BN("30000000000") });
      expect(() => validateSellAmount(new BN("9999999999999999"), bc)).toThrow(
        SellOverflowError,
      );
    });

    it("SellOverflowError carries amount, reserves, and max for recovery", () => {
      const bc = makeBondingCurve({ virtualSolReserves: new BN("30000000000") });
      const tooBig = new BN("9999999999999999");
      let caught: SellOverflowError | undefined;
      try {
        validateSellAmount(tooBig, bc);
      } catch (e) {
        caught = e as SellOverflowError;
      }
      expect(caught).toBeInstanceOf(SellOverflowError);
      expect(caught!.amount.eq(tooBig)).toBe(true);
      expect(caught!.virtualSolReserves.eq(bc.virtualSolReserves)).toBe(true);
      expect(caught!.maxSafeAmount.gtn(0)).toBe(true);
    });

    it("reproduces the scenario from issue #6 (amount=6325344957752 against large reserves)", () => {
      // Realistic popular-token reserves — virtualSolReserves large enough that
      // 6.3e12 * reserves overflows u64 (1.84e19).
      const bc = makeBondingCurve({
        virtualSolReserves: new BN("5000000000000000"), // 5e15
      });
      expect(() =>
        validateSellAmount(new BN("6325344957752"), bc),
      ).toThrow(SellOverflowError);
    });
  });
});
