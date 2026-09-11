/**
 * Regression tests for reading a token whose bonding curve has migrated.
 *
 * When a token graduates to PumpAMM the program zeroes every reserve field on
 * the bonding curve account. Before this was handled, every analytics helper
 * that divides by `virtualTokenReserves` threw "Division by zero" for the
 * entire population of graduated tokens, which is the majority of tokens anyone
 * looks up by the time they are worth looking up.
 */

import BN from "bn.js";

import { getBondingCurveSummary, getTokenPrice } from "../analytics";
import { computeFeesBps } from "../fees";
import {
  makeFeeConfig,
  makeGlobal,
  makeMigratedBondingCurve,
} from "./fixtures";

const global = makeGlobal();
const feeConfig = makeFeeConfig();
const migrated = makeMigratedBondingCurve();
const mintSupply = global.tokenTotalSupply;

describe("migrated bonding curves", () => {
  describe("getTokenPrice", () => {
    it("reports zeros instead of throwing on a zeroed curve", () => {
      const price = getTokenPrice({
        global,
        feeConfig,
        mintSupply,
        bondingCurve: migrated,
      });

      expect(price.isGraduated).toBe(true);
      expect(price.marketCap.isZero()).toBe(true);
      expect(price.buyPricePerToken.isZero()).toBe(true);
      expect(price.sellPricePerToken.isZero()).toBe(true);
    });

    it("works with a null fee config too", () => {
      expect(() =>
        getTokenPrice({
          global,
          feeConfig: null,
          mintSupply,
          bondingCurve: migrated,
        }),
      ).not.toThrow();
    });
  });

  describe("computeFeesBps", () => {
    it("falls back to the base tier rather than dividing by zero", () => {
      const fees = computeFeesBps({
        global,
        feeConfig,
        mintSupply,
        virtualQuoteReserves: migrated.virtualQuoteReserves,
        virtualTokenReserves: migrated.virtualTokenReserves,
      });

      expect(fees.protocolFeeBps).toBeInstanceOf(BN);
      expect(fees.protocolFeeBps.isNeg()).toBe(false);
      expect(fees.creatorFeeBps.isNeg()).toBe(false);
    });
  });

  describe("getBondingCurveSummary", () => {
    it("summarises a migrated curve as graduated at 100%", () => {
      const summary = getBondingCurveSummary({
        global,
        feeConfig,
        mintSupply,
        bondingCurve: migrated,
      });

      expect(summary.isGraduated).toBe(true);
      expect(summary.progressBps).toBe(10_000);
      expect(summary.solNeededToGraduate.isZero()).toBe(true);
      expect(summary.marketCap.isZero()).toBe(true);
    });

    it("still prices a live curve normally", () => {
      const summary = getBondingCurveSummary({
        global,
        feeConfig,
        mintSupply,
        bondingCurve: liveCurve(),
      });

      expect(summary.isGraduated).toBe(false);
      expect(summary.marketCap.gt(new BN(0))).toBe(true);
      expect(summary.buyPricePerToken.gt(new BN(0))).toBe(true);
    });
  });
});

/** A curve with live reserves, to prove the zero-guard did not swallow them. */
function liveCurve() {
  return {
    ...makeMigratedBondingCurve(),
    virtualTokenReserves: new BN("1073000000000000"),
    virtualQuoteReserves: new BN("30000000000"),
    realTokenReserves: new BN("793100000000000"),
    realQuoteReserves: new BN(0),
    complete: false,
  };
}
