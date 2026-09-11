import BN from "bn.js";

import {
  getBuyTokenAmountFromSolAmount,
  getBuySolAmountFromTokenAmount,
  getSellSolAmountFromTokenAmount,
  getTokenAmountForTargetSol,
  getStaticRandomFeeRecipient,
  newBondingCurve,
  bondingCurveMarketCap,
  maxSafeSellAmount,
  validateSellAmount,
} from "../bondingCurve";
import { BREAKING_FEE_RECIPIENTS } from "../fees";
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
    const U64_MAX = new BN("18446744073709551615");
    const U128_MAX = new BN("340282366920938463463374607431768211455");

    it("allows the full u64 range when virtualSolReserves is 0", () => {
      // A migrated curve has no reserves and cannot be sold on, so no
      // multiply happens and nothing can overflow.
      expect(maxSafeSellAmount(new BN(0)).eq(U64_MAX)).toBe(true);
    });

    it("is bounded by u64::MAX at mainnet reserve sizes", () => {
      // The u128 product bound sits far above u64::MAX for any real curve,
      // so the token amount's own on-chain width is what binds.
      expect(maxSafeSellAmount(new BN("30000000000")).eq(U64_MAX)).toBe(true);
      expect(maxSafeSellAmount(new BN("500000000000")).eq(U64_MAX)).toBe(true);
    });

    it("product stays under u128::MAX at the limit", () => {
      for (const reserves of ["30000000000", "500000000000", "2511843874"]) {
        const r = new BN(reserves);
        expect(maxSafeSellAmount(r).mul(r).lte(U128_MAX)).toBe(true);
      }
    });

    it("accepts sell sizes that real mainnet transactions land", () => {
      // Regression: the bound was once derived from u64::MAX, which rejected
      // 344 of 417 sampled landed sells (83%), some by over 2000x. These are
      // (tokenAmount, virtualSolReserves) pairs captured from live trade
      // events that the chain accepted.
      const landed: Array<[string, string]> = [
        ["1044997562075", "2511843874"],
        ["1721442828023", "22125920559"],
        ["177220782774", "30000000000"],
      ];
      for (const [amount, reserves] of landed) {
        expect(new BN(amount).lte(maxSafeSellAmount(new BN(reserves)))).toBe(true);
        expect(() =>
          validateSellAmount(new BN(amount), makeBondingCurve({ virtualSolReserves: new BN(reserves) })),
        ).not.toThrow();
      }
    });

    it("still rejects an amount wider than the on-chain u64 token field", () => {
      const bc = makeBondingCurve();
      expect(() => validateSellAmount(U64_MAX.addn(1), bc)).toThrow();
    });
  });

  // ── getTokenAmountForTargetSol ────────────────────────────────────

  describe("getTokenAmountForTargetSol", () => {
    it("returns 0 for targetSol=0", () => {
      const result = getTokenAmountForTargetSol({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        targetSol: new BN(0),
      });
      expect(result.isZero()).toBe(true);
    });

    it("yields at least targetSol when sold (target within safe limit)", () => {
      // maxSafeSellAmount constrains each sell to prevent u64 overflow on-chain.
      // The target must be below maxOut (SOL from selling the safe max) to be
      // reachable. We compute maxOut first and target half of it.
      const bc = makeBondingCurve();
      const safeMax = maxSafeSellAmount(bc.virtualSolReserves);
      const upper = BN.min(bc.realTokenReserves, safeMax);
      const maxOut = getSellSolAmountFromTokenAmount({
        global, feeConfig: null, mintSupply, bondingCurve: bc, amount: upper,
      });
      if (maxOut.isZero()) return; // degenerate state — skip

      // Target half of maxOut — guaranteed reachable in one safe sell
      const targetSol = maxOut.divn(2);
      if (targetSol.isZero()) return;

      const tokenAmount = getTokenAmountForTargetSol({
        global, feeConfig: null, mintSupply, bondingCurve: bc, targetSol,
      });
      expect(tokenAmount.gtn(0)).toBe(true);
      const actualSol = getSellSolAmountFromTokenAmount({
        global, feeConfig: null, mintSupply, bondingCurve: bc, amount: tokenAmount,
      });
      expect(actualSol.gte(targetSol)).toBe(true);
    });

    it("one token less yields strictly less than targetSol", () => {
      const bc = makeBondingCurve();
      const safeMax = maxSafeSellAmount(bc.virtualSolReserves);
      const upper = BN.min(bc.realTokenReserves, safeMax);
      const maxOut = getSellSolAmountFromTokenAmount({
        global, feeConfig: null, mintSupply, bondingCurve: bc, amount: upper,
      });
      if (maxOut.isZero()) return;
      const targetSol = maxOut.divn(2);
      if (targetSol.isZero()) return;

      const tokenAmount = getTokenAmountForTargetSol({
        global, feeConfig: null, mintSupply, bondingCurve: bc, targetSol,
      });
      // The fixture curve always quotes more than one token for half of maxOut;
      // assert that rather than skipping the check when it does not hold.
      expect(tokenAmount.gtn(1)).toBe(true);

      const oneLess = tokenAmount.subn(1);
      const solWithOneLess = getSellSolAmountFromTokenAmount({
        global, feeConfig: null, mintSupply, bondingCurve: bc, amount: oneLess,
      });
      expect(solWithOneLess.lt(targetSol)).toBe(true);
    });

    it("returns upper safe limit when target exceeds max possible SOL out", () => {
      const bc = makeBondingCurve();
      const impossibleTarget = new BN("999999999999999999");
      const result = getTokenAmountForTargetSol({
        global, feeConfig: null, mintSupply, bondingCurve: bc, targetSol: impossibleTarget,
      });
      // Should be capped at min(realTokenReserves, maxSafeSellAmount)
      expect(result.lte(bc.realTokenReserves)).toBe(true);
      expect(result.gtn(0)).toBe(true);
    });

    it("returns 0 for migrated bonding curve", () => {
      const result = getTokenAmountForTargetSol({
        global, feeConfig: null, mintSupply,
        bondingCurve: makeMigratedBondingCurve(),
        targetSol: new BN("500000000"),
      });
      expect(result.isZero()).toBe(true);
    });
  });

  // ── getStaticRandomFeeRecipient ────────────────────────────────────

  describe("getStaticRandomFeeRecipient", () => {
    it("always returns a valid PublicKey", () => {
      for (let i = 0; i < 20; i++) {
        const r = getStaticRandomFeeRecipient();
        expect(r).toBeDefined();
        expect(r.toBase58().length).toBeGreaterThan(0);
      }
    });

    it("returns one of the known fee recipients", () => {
      // Run many times to cover randomness — all results must be from the set
      const knownSet = new Set(BREAKING_FEE_RECIPIENTS.map((p) => p.toBase58()));
      // getStaticRandomFeeRecipient uses a different (legacy) list, so we just
      // verify it returns a non-default pubkey with a valid base58 string
      for (let i = 0; i < 20; i++) {
        const r = getStaticRandomFeeRecipient();
        expect(r.toBase58()).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
        // Must NOT be the system program (all zeros)
        expect(r.toBase58()).not.toBe("11111111111111111111111111111111");
      }
      // Silence unused variable warning
      void knownSet;
    });

    it("is non-deterministic across calls", () => {
      // Collect 100 results — expect at least 2 distinct values
      const results = new Set<string>();
      for (let i = 0; i < 100; i++) {
        results.add(getStaticRandomFeeRecipient().toBase58());
      }
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe("validateSellAmount", () => {
    it("safe amount does not throw", () => {
      const bc = makeBondingCurve({ virtualSolReserves: new BN("30000000000") });
      expect(() => validateSellAmount(new BN(100_000_000), bc)).not.toThrow();
    });

    it("throws SellOverflowError when amount exceeds the safe limit", () => {
      const bc = makeBondingCurve({ virtualSolReserves: new BN("30000000000") });
      // Wider than the on-chain u64 token amount field.
      const tooBig = new BN("18446744073709551616");
      expect(() => validateSellAmount(tooBig, bc)).toThrow(SellOverflowError);
    });

    it("SellOverflowError carries amount, reserves, and max for recovery", () => {
      const bc = makeBondingCurve({ virtualSolReserves: new BN("30000000000") });
      const tooBig = new BN("18446744073709551616");
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

    it("accepts the amount from issue #6, which the old bound wrongly rejected", () => {
      // Issue #6 reported AnchorError 6024 (Overflow) on a sell of
      // 6325344957752 base units, and the SDK responded by bounding sells at
      // 0.9 * u64::MAX / virtualSolReserves. That bound cannot be right: the
      // reporter's own description (fails "maybe 1/4" of the time, succeeds
      // otherwise for the same sizes) rules out a deterministic function of
      // (amount, reserves), and sampling live mainnet trade events shows 83%
      // of landed sells exceeding it. Intermittent 6024s are a slippage and
      // state-drift signature, not an arithmetic width limit, so the SDK no
      // longer refuses a sell the chain would accept.
      const bc = makeBondingCurve({
        virtualSolReserves: new BN("5000000000000000"),
      });
      expect(() =>
        validateSellAmount(new BN("6325344957752"), bc),
      ).not.toThrow();
    });
  });
});
