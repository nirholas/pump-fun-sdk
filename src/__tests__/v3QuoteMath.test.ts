/**
 * Quote math the October 2026 upgrade added: `buy_v3` pricing (including the
 * post-completion leg bought from the pool the migration will create),
 * pump-coin quote seeding for `create_v2`, and the per-quote-mint fee
 * schedule.
 */
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import {
  getBuySolAmountFromTokenAmount,
  getBuyV3QuoteAmountFromTokenAmount,
  getBuyV3TokenAmountFromQuoteAmount,
  isBondingCurveMigrated,
  newBondingCurve,
  pumpQuoteAdmission,
  pumpQuoteReserves,
} from "../bondingCurve";
import type { PumpQuoteCurve } from "../bondingCurve";
import {
  CurveDepthExceededError,
  QuoteBondingCurveNotEligibleError,
  QuoteCurveAwaitingMigrationError,
  QuoteReservesOutOfRangeError,
  UnsupportedQuoteMintError,
} from "../errors";
import {
  STABLE_QUOTE_MINTS,
  isExoticQuoteMint,
  isSolLikeQuoteMint,
  isStableQuoteMint,
  selectCurveFeeSchedule,
} from "../fees";
import type { FeeConfig, Fees } from "../state";
import {
  TEST_CREATOR,
  makeBondingCurve,
  makeFeeConfig,
  makeGlobal,
  makeMigratedBondingCurve,
} from "./fixtures";

const SUPPLY = new BN("1000000000000000");
const EXOTIC_MINT = new PublicKey(
  "So11111111111111111111111111111111111111113",
);
const QUOTE_COIN = new PublicKey("BPFLoader2111111111111111111111111111111111");
const USDC = STABLE_QUOTE_MINTS[0] as PublicKey;

function fees(protocol: number, creator: number): Fees {
  return {
    lpFeeBps: new BN(0),
    protocolFeeBps: new BN(protocol),
    creatorFeeBps: new BN(creator),
  };
}

/** A curve this close to completion, with `remaining` tokens left on it. */
function nearlyCompleteCurve(remaining: BN, overrides = {}) {
  const global = makeGlobal();
  const sold = global.initialRealTokenReserves.sub(remaining);
  const virtualTokenReserves = global.initialVirtualTokenReserves.sub(sold);
  const k = global.initialVirtualTokenReserves.mul(
    global.initialVirtualSolReserves,
  );
  const virtualQuoteReserves = k.div(virtualTokenReserves);
  return makeBondingCurve({
    creator: TEST_CREATOR,
    virtualTokenReserves,
    virtualQuoteReserves,
    realTokenReserves: remaining,
    realQuoteReserves: virtualQuoteReserves.sub(
      global.initialVirtualSolReserves,
    ),
    ...overrides,
  });
}

describe("buy_v3 quote math", () => {
  const global = makeGlobal();
  const feeConfig = makeFeeConfig();

  it("charges what `buy` charges when the buy stays on the curve", () => {
    const bondingCurve = makeBondingCurve({ creator: TEST_CREATOR });
    const amount = new BN("10000000000000");
    const v3 = getBuyV3QuoteAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply: SUPPLY,
      bondingCurve,
      amount,
      curveBaseTokenBalance: SUPPLY,
    });
    const v1 = getBuySolAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply: SUPPLY,
      bondingCurve,
      amount,
    });
    expect(v3.gt(new BN(0))).toBe(true);
    // Same curve price and fee rates; the two round fees independently.
    expect(v3.sub(v1).abs().lte(new BN(2))).toBe(true);
  });

  it("returns zero for an empty amount, a complete curve or a migrated one", () => {
    const base = {
      global,
      feeConfig,
      mintSupply: SUPPLY,
      curveBaseTokenBalance: SUPPLY,
    };
    expect(
      getBuyV3QuoteAmountFromTokenAmount({
        ...base,
        bondingCurve: makeBondingCurve(),
        amount: new BN(0),
      }).isZero(),
    ).toBe(true);
    expect(
      getBuyV3QuoteAmountFromTokenAmount({
        ...base,
        bondingCurve: makeBondingCurve({ complete: true }),
        amount: new BN(1000),
      }).isZero(),
    ).toBe(true);
    expect(
      getBuyV3TokenAmountFromQuoteAmount({
        ...base,
        bondingCurve: makeMigratedBondingCurve(),
        amount: new BN(1000),
      }).isZero(),
    ).toBe(true);
  });

  it("prices a buy past the remaining supply against the pool-to-be", () => {
    const remaining = new BN("1000000000000");
    const bondingCurve = nearlyCompleteCurve(remaining);
    // What the curve's base ATA holds at that point: the remaining supply
    // plus the tokens reserved for the migration's pool.
    const curveBaseTokenBalance = remaining.add(
      global.tokenTotalSupply.sub(global.initialRealTokenReserves),
    );
    const params = {
      global,
      feeConfig,
      mintSupply: SUPPLY,
      bondingCurve,
      curveBaseTokenBalance,
    };
    const curveOnly = getBuyV3QuoteAmountFromTokenAmount({
      ...params,
      amount: remaining,
    });
    const crossing = getBuyV3QuoteAmountFromTokenAmount({
      ...params,
      amount: remaining.muln(3),
    });
    expect(crossing.gt(curveOnly)).toBe(true);

    // The inverse lands back on (at most) the same token amount.
    const tokens = getBuyV3TokenAmountFromQuoteAmount({
      ...params,
      amount: crossing,
    });
    expect(tokens.gt(remaining)).toBe(true);
    expect(tokens.lte(remaining.muln(3))).toBe(true);
    // The pool leg rounds in whole quote units, each worth a few thousand
    // raw tokens at this price: the round trip stays within a millionth.
    expect(remaining.muln(3).sub(tokens).muln(1_000_000).lt(tokens)).toBe(true);
    expect(
      getBuyV3QuoteAmountFromTokenAmount({ ...params, amount: tokens }).lte(
        crossing,
      ),
    ).toBe(true);
  });

  it("stops at the remaining supply on a mayhem curve", () => {
    const remaining = new BN("1000000000000");
    const bondingCurve = nearlyCompleteCurve(remaining, { isMayhemMode: true });
    const params = {
      global,
      feeConfig,
      mintSupply: SUPPLY,
      bondingCurve,
      curveBaseTokenBalance: SUPPLY,
    };
    expect(
      getBuyV3QuoteAmountFromTokenAmount({
        ...params,
        amount: remaining.muln(5),
      }).eq(
        getBuyV3QuoteAmountFromTokenAmount({ ...params, amount: remaining }),
      ),
    ).toBe(true);
    expect(
      getBuyV3TokenAmountFromQuoteAmount({
        ...params,
        amount: new BN("1000000000000"),
      }).eq(remaining),
    ).toBe(true);
  });

  it("refuses a buy that would take the whole pool-to-be", () => {
    const remaining = new BN("1000000000000");
    const bondingCurve = nearlyCompleteCurve(remaining);
    const curveBaseTokenBalance = remaining.add(new BN(1000));
    expect(() =>
      getBuyV3QuoteAmountFromTokenAmount({
        global,
        feeConfig,
        mintSupply: SUPPLY,
        bondingCurve,
        amount: remaining.add(new BN(1000)),
        curveBaseTokenBalance,
      }),
    ).toThrow(/NotEnoughTokensToBuy/);
    // A balance read under the wrong token program leaves no pool-to-be.
    expect(() =>
      getBuyV3QuoteAmountFromTokenAmount({
        global,
        feeConfig,
        mintSupply: SUPPLY,
        bondingCurve,
        amount: remaining.muln(2),
        curveBaseTokenBalance: remaining,
      }),
    ).toThrow(/Empty pool-to-be/);
  });

  it("never spends more than the budget on an exact-quote-in buy", () => {
    const bondingCurve = makeBondingCurve({ creator: TEST_CREATOR });
    const budget = new BN("2000000000");
    const params = {
      global,
      feeConfig,
      mintSupply: SUPPLY,
      bondingCurve,
      curveBaseTokenBalance: SUPPLY,
    };
    const tokens = getBuyV3TokenAmountFromQuoteAmount({
      ...params,
      amount: budget,
    });
    expect(tokens.gt(new BN(0))).toBe(true);
    expect(
      getBuyV3QuoteAmountFromTokenAmount({ ...params, amount: tokens }).lte(
        budget,
      ),
    ).toBe(true);
  });
});

describe("pump-coin quotes for create_v2", () => {
  const solQuotedCoin = (overrides = {}): PumpQuoteCurve => ({
    mint: QUOTE_COIN,
    bondingCurve: makeBondingCurve(overrides),
    quoteControl: null,
  });

  it("refuses a pump-coin quote while maxCurveDepth is 0", () => {
    expect(() =>
      pumpQuoteReserves(makeGlobal({ maxCurveDepth: 0 }), solQuotedCoin()),
    ).toThrow(CurveDepthExceededError);
  });

  it("refuses a mayhem-mode coin as a quote", () => {
    expect(() =>
      pumpQuoteAdmission(
        makeGlobal({ maxCurveDepth: 1 }),
        solQuotedCoin({ isMayhemMode: true }),
      ),
    ).toThrow(QuoteBondingCurveNotEligibleError);
  });

  it("refuses a depth-0 coin whose own quote no list admits", () => {
    expect(() =>
      pumpQuoteAdmission(
        makeGlobal({ maxCurveDepth: 1 }),
        solQuotedCoin({ quoteMint: EXOTIC_MINT }),
      ),
    ).toThrow(QuoteBondingCurveNotEligibleError);
  });

  it("refuses a complete curve that has not migrated yet", () => {
    expect(() =>
      pumpQuoteReserves(
        makeGlobal({ maxCurveDepth: 1 }),
        solQuotedCoin({ complete: true }),
      ),
    ).toThrow(QuoteCurveAwaitingMigrationError);
  });

  it("prices a fresh SOL-quoted coin at the SOL seed scaled by its price", () => {
    const global = makeGlobal({ maxCurveDepth: 1 });
    const { virtualQuoteReserves, depth } = pumpQuoteReserves(
      global,
      solQuotedCoin(),
    );
    expect(depth).toBe(1);
    // A fresh curve's price is the global seed's, so buying the graduation
    // raise on it and scaling back gives the documented constant product.
    const tradable = global.initialVirtualTokenReserves.sub(
      global.initialRealTokenReserves,
    );
    const input = global.initialVirtualSolReserves
      .mul(global.initialRealTokenReserves)
      .div(tradable);
    const raise = input
      .mul(global.initialVirtualTokenReserves)
      .div(global.initialVirtualSolReserves.add(input));
    expect(
      virtualQuoteReserves.eq(
        raise.mul(tradable).div(global.initialRealTokenReserves),
      ),
    ).toBe(true);
  });

  it("prices a migrated coin from its pool, signed virtual reserves included", () => {
    const global = makeGlobal({ maxCurveDepth: 1 });
    const pool = {
      baseReserves: new BN("200000000000000"),
      quoteReserves: new BN("90000000000"),
      virtualQuoteReserves: new BN(0),
    };
    const migrated: PumpQuoteCurve = {
      mint: QUOTE_COIN,
      bondingCurve: makeMigratedBondingCurve(),
      quoteControl: null,
      pool,
    };
    expect(isBondingCurveMigrated(migrated.bondingCurve)).toBe(true);
    const plain = pumpQuoteReserves(global, migrated).virtualQuoteReserves;
    // Negative virtual quote reserves lower Q's effective quote side, so Q
    // is cheaper and the same raise buys more of it.
    const synthetic = pumpQuoteReserves(global, {
      ...migrated,
      pool: { ...pool, virtualQuoteReserves: new BN("-30000000000") },
    }).virtualQuoteReserves;
    expect(synthetic.gt(plain)).toBe(true);

    expect(() =>
      pumpQuoteReserves(global, {
        ...migrated,
        pool: { ...pool, virtualQuoteReserves: new BN("-90000000001") },
      }),
    ).toThrow(/negative effective pool quote reserves/);
    expect(() =>
      pumpQuoteReserves(global, { ...migrated, pool: undefined }),
    ).toThrow(/pool reserves are required/);
  });

  it("refuses a seed that rounds below one", () => {
    const global = makeGlobal({ maxCurveDepth: 1 });
    expect(() =>
      pumpQuoteReserves(global, {
        mint: QUOTE_COIN,
        bondingCurve: makeMigratedBondingCurve(),
        quoteControl: null,
        pool: {
          baseReserves: new BN(1),
          quoteReserves: new BN("1000000000000000000"),
          virtualQuoteReserves: new BN(0),
        },
      }),
    ).toThrow(QuoteReservesOutOfRangeError);
  });

  it("seeds a pump-quoted curve one level deeper than its quote", () => {
    const global = makeGlobal({ maxCurveDepth: 2 });
    const quote = solQuotedCoin();
    const curve = newBondingCurve(
      global,
      QUOTE_COIN,
      null,
      new BN(25),
      true,
      quote,
    );
    expect(curve.depth).toBe(1);
    expect(curve.quoteMint.equals(QUOTE_COIN)).toBe(true);
    expect(curve.creatorFeeBps.eqn(25)).toBe(true);
    expect(curve.isHolderReward).toBe(true);
    expect(
      curve.virtualQuoteReserves.eq(
        pumpQuoteReserves(global, quote).virtualQuoteReserves,
      ),
    ).toBe(true);
    expect(
      curve.initialVirtualQuoteReserves.eq(curve.virtualQuoteReserves),
    ).toBe(true);
  });

  it("prefers a QuoteControl listing over the pump-quote path", () => {
    const global = makeGlobal({ maxCurveDepth: 2 });
    const quoteControl = {
      admin: PublicKey.default,
      reservesAdmin: PublicKey.default,
      reserved: new Array<number>(32).fill(0),
      mints: [
        { mint: QUOTE_COIN, initialVirtualQuoteReserves: new BN(777_000_000) },
      ],
    };
    const curve = newBondingCurve(
      global,
      QUOTE_COIN,
      quoteControl,
      undefined,
      false,
      solQuotedCoin(),
    );
    expect(curve.depth).toBe(0);
    expect(curve.virtualQuoteReserves.eq(new BN(777_000_000))).toBe(true);
  });

  it("refuses an unlisted quote mint that is not a pump coin", () => {
    expect(() => newBondingCurve(makeGlobal(), EXOTIC_MINT, null)).toThrow(
      UnsupportedQuoteMintError,
    );
  });
});

describe("fee schedule by quote mint", () => {
  const feeConfig: FeeConfig = {
    ...makeFeeConfig(),
    stableFeeTiers: [
      { marketCapLamportsThreshold: new BN(0), fees: fees(70, 30) },
    ],
    exoticFlatFees: fees(150, 60),
  };

  it("classifies quote mints", () => {
    expect(isSolLikeQuoteMint(PublicKey.default)).toBe(true);
    expect(isStableQuoteMint(USDC)).toBe(true);
    expect(isExoticQuoteMint(EXOTIC_MINT)).toBe(true);
    expect(isExoticQuoteMint(USDC)).toBe(false);
  });

  it("charges SOL tiers on SOL, stable tiers on stables and the exotic flat rate elsewhere", () => {
    const marketCap = new BN(0);
    expect(
      selectCurveFeeSchedule({
        feeConfig,
        quoteMint: PublicKey.default,
        marketCap,
      }).protocolFeeBps.eqn(200),
    ).toBe(true);
    expect(
      selectCurveFeeSchedule({
        feeConfig,
        quoteMint: USDC,
        marketCap,
      }).protocolFeeBps.eqn(70),
    ).toBe(true);
    expect(
      selectCurveFeeSchedule({
        feeConfig,
        quoteMint: EXOTIC_MINT,
        marketCap,
      }).protocolFeeBps.eqn(150),
    ).toBe(true);
  });

  it("falls back the way an older FeeConfig layout reads", () => {
    const legacy = makeFeeConfig();
    const marketCap = new BN(0);
    // No stable tiers: the SOL tiers apply.
    expect(
      selectCurveFeeSchedule({
        feeConfig: legacy,
        quoteMint: USDC,
        marketCap,
      }).protocolFeeBps.eqn(200),
    ).toBe(true);
    // No exotic flat fees: the flat fees apply.
    expect(
      selectCurveFeeSchedule({
        feeConfig: { ...legacy, exoticFlatFees: fees(0, 0) },
        quoteMint: EXOTIC_MINT,
        marketCap,
      }).protocolFeeBps.eqn(100),
    ).toBe(true);
  });
});
