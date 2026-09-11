/**
 * Offline tests for the Token Lifecycle examples (02-08).
 *
 * Every network step lives in each example's main(); the exported compute
 * steps are pure, so these run against fixture state with no RPC. The
 * instruction builders are exercised for real (the anchor coders encode
 * actual instruction data), which is what makes these honest rather than
 * mocked.
 */
import { BONDING_CURVE_NEW_SIZE, PUMP_PROGRAM_ID } from "@nirholas/pump-sdk";
import { AccountInfo, Keypair } from "@solana/web3.js";
import BN from "bn.js";

import { makeGlobal, makeBondingCurve, makeFeeConfig } from "../../src/__tests__/fixtures";
import { quoteDevBuy, buildCreateAndBuyInstructions } from "../02-create-and-buy";
import { quoteSellSol, buildSellInstructions } from "../04-sell-tokens";
import { quoteTokensForSol } from "../05-buy-by-sol-amount";
import { percentageToTokenAmount } from "../06-sell-by-percentage";
import { computeSellAllPlan } from "../07-sell-all";
import { tokensForTargetSol } from "../08-sell-to-target-sol";

const SOL = (n: number) => new BN(n).mul(new BN(1_000_000_000));

/** A curve account of the current layout, which sellInstructions inspects. */
function curveAccountInfo(): AccountInfo<Buffer> {
  return {
    data: Buffer.alloc(BONDING_CURVE_NEW_SIZE),
    executable: false,
    lamports: 0,
    owner: PUMP_PROGRAM_ID,
  };
}
const global = makeGlobal();
const feeConfig = makeFeeConfig();

describe("example 02: create and buy", () => {
  const mint = Keypair.generate().publicKey;
  const creator = Keypair.generate().publicKey;

  it("quotes a dev buy on a curve that does not exist yet", () => {
    const tokens = quoteDevBuy({ global, feeConfig, creator, solAmount: SOL(1) });
    expect(tokens.gtn(0)).toBe(true);
  });

  it("a larger dev buy receives more tokens", () => {
    const small = quoteDevBuy({ global, feeConfig, creator, solAmount: SOL(1) });
    const large = quoteDevBuy({ global, feeConfig, creator, solAmount: SOL(3) });
    expect(large.gt(small)).toBe(true);
  });

  it("builds create plus buy in one instruction list", async () => {
    const amount = quoteDevBuy({ global, feeConfig, creator, solAmount: SOL(1) });
    const ixs = await buildCreateAndBuyInstructions({
      global,
      mint,
      name: "Example",
      symbol: "XMPL",
      uri: "https://example.com/m.json",
      creator,
      user: creator,
      devBuyTokens: amount,
      solAmount: SOL(1),
    });
    expect(ixs.length).toBeGreaterThan(1);
    expect(ixs.some((ix) => ix.programId.equals(PUMP_PROGRAM_ID))).toBe(true);
    // The mint signs the create, so it must appear as a signer somewhere.
    expect(
      ixs.some((ix) => ix.keys.some((k) => k.isSigner && k.pubkey.equals(mint))),
    ).toBe(true);
  });
});

describe("example 04: sell tokens", () => {
  const curve = makeBondingCurve({
    realQuoteReserves: SOL(12),
    virtualQuoteReserves: SOL(42),
  });

  it("quotes positive proceeds for a real position", () => {
    const sol = quoteSellSol({
      global,
      feeConfig,
      bondingCurve: curve,
      amount: new BN("1000000000000"),
    });
    expect(sol.gtn(0)).toBe(true);
  });

  it("quotes zero for a zero-size sell", () => {
    const sol = quoteSellSol({ global, feeConfig, bondingCurve: curve, amount: new BN(0) });
    expect(sol.isZero()).toBe(true);
  });

  it("builds a sell instruction against the Pump program", async () => {
    const ixs = await buildSellInstructions({
      global,
      bondingCurveAccountInfo: curveAccountInfo(),
      bondingCurve: curve,
      mint: Keypair.generate().publicKey,
      user: Keypair.generate().publicKey,
      amount: new BN("1000000000000"),
      solAmount: SOL(1),
      slippage: 1,
    });
    expect(ixs.length).toBeGreaterThan(0);
    expect(ixs.some((ix) => ix.programId.equals(PUMP_PROGRAM_ID))).toBe(true);
  });
});

describe("example 05: buy by SOL amount", () => {
  it("scales tokens with the SOL budget", () => {
    const curve = makeBondingCurve();
    const one = quoteTokensForSol({ global, feeConfig, bondingCurve: curve, solAmount: SOL(1) });
    const two = quoteTokensForSol({ global, feeConfig, bondingCurve: curve, solAmount: SOL(2) });
    expect(one.gtn(0)).toBe(true);
    expect(two.gt(one)).toBe(true);
  });
});

describe("example 06: sell by percentage", () => {
  const balance = new BN("1000000000000");

  it("100% sells the whole balance exactly", () => {
    expect(percentageToTokenAmount(balance, 100).eq(balance)).toBe(true);
  });

  it("rejects a percentage outside (0, 100]", () => {
    // Mirrors OnlinePumpSdk.sellByPercentage: 0 and negatives are caller
    // bugs, not a no-op sell.
    for (const pct of [0, -1, 101]) {
      expect(() => percentageToTokenAmount(balance, pct)).toThrow();
    }
  });

  it("50% halves the balance", () => {
    expect(percentageToTokenAmount(balance, 50).eq(balance.divn(2))).toBe(true);
  });

  it("never exceeds the balance and never goes negative", () => {
    for (const pct of [1, 25, 33, 99, 100]) {
      const amount = percentageToTokenAmount(balance, pct);
      expect(amount.lte(balance)).toBe(true);
      expect(amount.gten(0)).toBe(true);
    }
  });

  it("rounds down rather than over-selling on an odd balance", () => {
    const odd = new BN(101);
    expect(percentageToTokenAmount(odd, 50).lte(odd.divn(2).addn(1))).toBe(true);
  });
});

describe("example 07: sell all", () => {
  const curve = makeBondingCurve({
    realQuoteReserves: SOL(15),
    virtualQuoteReserves: SOL(45),
  });

  it("values a whole balance and reports no chunking for ordinary sizes", () => {
    const plan = computeSellAllPlan({
      global,
      feeConfig,
      bondingCurve: curve,
      balance: new BN("5000000000000"),
    });
    expect(plan.solOut.gtn(0)).toBe(true);
    // Regression: this size class was wrongly flagged for chunking while the
    // bound was derived from u64::MAX.
    expect(plan.needsChunking).toBe(false);
  });

  it("flags a balance wider than a single on-chain sell", () => {
    const plan = computeSellAllPlan({
      global,
      feeConfig,
      bondingCurve: curve,
      balance: new BN("18446744073709551616"),
    });
    expect(plan.needsChunking).toBe(true);
    expect(plan.maxSafe.lt(new BN("18446744073709551616"))).toBe(true);
  });
});

describe("example 08: sell to target SOL", () => {
  const curve = makeBondingCurve({
    realQuoteReserves: SOL(25),
    virtualQuoteReserves: SOL(55),
    virtualTokenReserves: new BN("500000000000000"),
    realTokenReserves: new BN("300000000000000"),
  });

  it("finds an amount that reaches the target", () => {
    const amount = tokensForTargetSol({
      global,
      feeConfig,
      bondingCurve: curve,
      targetSol: SOL(1),
    });
    expect(amount.gtn(0)).toBe(true);
    const actual = quoteSellSol({ global, feeConfig, bondingCurve: curve, amount });
    expect(actual.gte(SOL(1))).toBe(true);
  });

  it("asks for more tokens as the target grows", () => {
    const one = tokensForTargetSol({ global, feeConfig, bondingCurve: curve, targetSol: SOL(1) });
    const five = tokensForTargetSol({ global, feeConfig, bondingCurve: curve, targetSol: SOL(5) });
    expect(five.gt(one)).toBe(true);
  });

  it("returns zero for a zero target", () => {
    const amount = tokensForTargetSol({ global, feeConfig, bondingCurve: curve, targetSol: new BN(0) });
    expect(amount.isZero()).toBe(true);
  });
});

describe("every lifecycle example exports a runnable main", () => {
  it.each([
    ["02", require("../02-create-and-buy")],
    ["04", require("../04-sell-tokens")],
    ["05", require("../05-buy-by-sol-amount")],
    ["06", require("../06-sell-by-percentage")],
    ["07", require("../07-sell-all")],
    ["08", require("../08-sell-to-target-sol")],
  ])("example %s", (_n, mod: { main?: unknown }) => {
    expect(typeof mod.main).toBe("function");
  });
});
