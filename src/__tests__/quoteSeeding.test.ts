/**
 * How `create_v2` seeds a new curve's virtual quote reserves for each kind of
 * quote mint, which pump coins it admits as a quote, and the edges of the
 * `buy_exact_quote_in_v3` budget split. Each case mirrors a branch of the
 * program's admission order, so a regression shows up as a wrong starting
 * price rather than as a failed transaction.
 */
import { NATIVE_MINT, NATIVE_MINT_2022 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import {
  getBuyV3QuoteAmountFromTokenAmount,
  getBuyV3TokenAmountFromQuoteAmount,
  initialVirtualQuoteReservesFor,
  pumpQuoteAdmission,
  pumpQuoteReserves,
} from "../bondingCurve";
import type { PumpQuoteCurve } from "../bondingCurve";
import {
  QuoteBondingCurveNotEligibleError,
  QuotePoolNotFoundError,
  UnsupportedQuoteMintError,
} from "../errors";
import type { QuoteControl } from "../state";
import {
  TEST_CREATOR,
  TEST_PUBKEY,
  makeBondingCurve,
  makeFeeConfig,
  makeGlobal,
  makeMigratedBondingCurve,
} from "./fixtures";

const WHITELISTED = new PublicKey("Stake11111111111111111111111111111111111111");
const CONTROLLED = new PublicKey("Vote111111111111111111111111111111111111111");
const UNLISTED = new PublicKey("Config1111111111111111111111111111111111111");
const QUOTE_COIN = new PublicKey("BPFLoader2111111111111111111111111111111111");

const SOL_SEED = new BN("30000000000");
const WHITELIST_SEED = new BN("12000000000");
const CONTROL_SEED = new BN("777000000");

const global = makeGlobal({
  initialVirtualSolReserves: SOL_SEED,
  initialVirtualQuoteReserves: WHITELIST_SEED,
  whitelistedQuoteMints: [WHITELISTED],
  maxCurveDepth: 3,
});

const quoteControl: QuoteControl = {
  admin: TEST_PUBKEY,
  reservesAdmin: TEST_PUBKEY,
  reserved: [],
  mints: [{ mint: CONTROLLED, initialVirtualQuoteReserves: CONTROL_SEED }],
};

describe("initialVirtualQuoteReservesFor", () => {
  it.each([
    ["the zero key", PublicKey.default],
    ["WSOL", NATIVE_MINT],
  ])("seeds a SOL curve (%s) from initialVirtualSolReserves", (_, mint) => {
    expect(initialVirtualQuoteReservesFor(global, mint).eq(SOL_SEED)).toBe(true);
  });

  it("refuses the Token-2022 native mint before consulting any list", () => {
    const listed = makeGlobal({ whitelistedQuoteMints: [NATIVE_MINT_2022] });
    expect(() =>
      initialVirtualQuoteReservesFor(listed, NATIVE_MINT_2022),
    ).toThrow(UnsupportedQuoteMintError);
  });

  it("seeds a whitelisted mint from initialVirtualQuoteReserves, even when QuoteControl lists it", () => {
    const both: QuoteControl = {
      ...quoteControl,
      mints: [{ mint: WHITELISTED, initialVirtualQuoteReserves: CONTROL_SEED }],
    };
    expect(
      initialVirtualQuoteReservesFor(global, WHITELISTED, both).eq(
        WHITELIST_SEED,
      ),
    ).toBe(true);
  });

  it("seeds a QuoteControl mint from its entry", () => {
    expect(
      initialVirtualQuoteReservesFor(global, CONTROLLED, quoteControl).eq(
        CONTROL_SEED,
      ),
    ).toBe(true);
  });

  it("refuses a mint no list admits", () => {
    expect(() =>
      initialVirtualQuoteReservesFor(global, UNLISTED, quoteControl),
    ).toThrow(UnsupportedQuoteMintError);
  });

  it("refuses a pumpQuote that describes a different mint", () => {
    const pumpQuote: PumpQuoteCurve = {
      mint: QUOTE_COIN,
      bondingCurve: makeBondingCurve(),
      quoteControl: null,
    };
    expect(() =>
      initialVirtualQuoteReservesFor(global, UNLISTED, null, pumpQuote),
    ).toThrow(/not the quote mint/);
  });

  it("derives a pump-coin seed when the coin is listed nowhere", () => {
    const pumpQuote: PumpQuoteCurve = {
      mint: QUOTE_COIN,
      bondingCurve: makeBondingCurve(),
      quoteControl: null,
    };
    const seed = initialVirtualQuoteReservesFor(
      global,
      QUOTE_COIN,
      undefined,
      pumpQuote,
    );
    expect(seed.eq(pumpQuoteReserves(global, pumpQuote).virtualQuoteReserves)).toBe(
      true,
    );
  });
});

describe("pumpQuoteAdmission", () => {
  const coin = (overrides = {}, control: QuoteControl | null = null) => ({
    mint: QUOTE_COIN,
    bondingCurve: makeBondingCurve(overrides),
    quoteControl: control,
  });

  it("prices a depth-0 SOL-quoted coin against a fresh SOL curve", () => {
    const { depth, target } = pumpQuoteAdmission(global, coin());
    expect(depth).toBe(1);
    expect(target.eq(SOL_SEED)).toBe(true);
  });

  it("prices a depth-0 coin quoted in a whitelisted mint against the whitelist seed", () => {
    const { target } = pumpQuoteAdmission(
      global,
      coin({ quoteMint: WHITELISTED }),
    );
    expect(target.eq(WHITELIST_SEED)).toBe(true);
  });

  it("prices a depth-0 coin quoted in a QuoteControl mint against its entry", () => {
    const { target } = pumpQuoteAdmission(
      global,
      coin({ quoteMint: CONTROLLED }, quoteControl),
    );
    expect(target.eq(CONTROL_SEED)).toBe(true);
  });

  it("lets an explicit quoteControl argument override the one fetched with the coin", () => {
    const { target } = pumpQuoteAdmission(
      global,
      coin({ quoteMint: CONTROLLED }, null),
      quoteControl,
    );
    expect(target.eq(CONTROL_SEED)).toBe(true);
  });

  it("refuses a depth-0 coin whose own quote no list admits", () => {
    expect(() =>
      pumpQuoteAdmission(global, coin({ quoteMint: UNLISTED }, quoteControl)),
    ).toThrow(QuoteBondingCurveNotEligibleError);
  });

  it("refuses a mayhem-mode coin", () => {
    expect(() =>
      pumpQuoteAdmission(global, coin({ isMayhemMode: true })),
    ).toThrow(QuoteBondingCurveNotEligibleError);
  });

  it("prices a deeper coin against its own stored starting reserves", () => {
    const stored = new BN("5555555555");
    const { depth, target } = pumpQuoteAdmission(
      global,
      coin({ depth: 1, initialVirtualQuoteReserves: stored }),
    );
    expect(depth).toBe(2);
    expect(target.eq(stored)).toBe(true);
  });
});

describe("pumpQuoteReserves on a migrated coin", () => {
  const migrated = (pool: PumpQuoteCurve["pool"]): PumpQuoteCurve => ({
    mint: QUOTE_COIN,
    bondingCurve: makeMigratedBondingCurve(),
    quoteControl: null,
    pool,
  });

  it("refuses negative effective pool quote reserves", () => {
    expect(() =>
      pumpQuoteReserves(
        global,
        migrated({
          baseReserves: new BN("200000000000000"),
          quoteReserves: new BN(1_000),
          virtualQuoteReserves: new BN(-2_000),
        }),
      ),
    ).toThrow(/negative effective pool quote reserves/);
  });

  it("refuses zero effective pool quote reserves", () => {
    expect(() =>
      pumpQuoteReserves(
        global,
        migrated({
          baseReserves: new BN("200000000000000"),
          quoteReserves: new BN(1_000),
          virtualQuoteReserves: new BN(-1_000),
        }),
      ),
    ).toThrow(/zero quote reserves/);
  });
});

describe("QuotePoolNotFoundError", () => {
  it("names the quote mint and the missing pool", () => {
    const pool = new PublicKey("Sysvar1111111111111111111111111111111111111");
    const err = new QuotePoolNotFoundError(QUOTE_COIN, pool);
    expect(err.name).toBe("QuotePoolNotFoundError");
    expect(err).toBeInstanceOf(Error);
    expect(err.quoteMint.equals(QUOTE_COIN)).toBe(true);
    expect(err.pool.equals(pool)).toBe(true);
    expect(err.message).toContain(QUOTE_COIN.toBase58());
    expect(err.message).toContain(pool.toBase58());
  });
});

describe("buy_exact_quote_in_v3 budget edges", () => {
  const feeConfig = makeFeeConfig();
  const supply = new BN("1000000000000000");

  it("buys nothing with a budget that fees reduce to at most one unit", () => {
    const tokens = getBuyV3TokenAmountFromQuoteAmount({
      global,
      feeConfig,
      mintSupply: supply,
      bondingCurve: makeBondingCurve({ creator: TEST_CREATOR }),
      amount: new BN(1),
      curveBaseTokenBalance: supply,
    });
    expect(tokens.isZero()).toBe(true);
  });

  it("is monotonic and affordable for budgets straddling the curve's completion cost", () => {
    // A curve 1,000 tokens from completion, on the curve's own constant product.
    const remaining = new BN(1_000_000_000);
    const sold = global.initialRealTokenReserves.sub(remaining);
    const virtualTokenReserves = global.initialVirtualTokenReserves.sub(sold);
    const k = global.initialVirtualTokenReserves.mul(SOL_SEED);
    const virtualQuoteReserves = k.div(virtualTokenReserves);
    const curve = makeBondingCurve({
      creator: TEST_CREATOR,
      virtualTokenReserves,
      virtualQuoteReserves,
      realTokenReserves: remaining,
      realQuoteReserves: virtualQuoteReserves.sub(SOL_SEED),
    });
    const base = {
      global,
      feeConfig,
      mintSupply: supply,
      bondingCurve: curve,
      curveBaseTokenBalance: remaining.add(new BN("206900000000000")),
    };
    const cost = getBuyV3QuoteAmountFromTokenAmount({ ...base, amount: remaining });

    let previous = new BN(0);
    for (let delta = -40; delta <= 40; delta++) {
      const budget = cost.addn(delta);
      const tokens = getBuyV3TokenAmountFromQuoteAmount({ ...base, amount: budget });
      expect(tokens.gte(previous)).toBe(true);
      expect(
        getBuyV3QuoteAmountFromTokenAmount({ ...base, amount: tokens }).lte(budget),
      ).toBe(true);
      previous = tokens;
    }
    // Comfortably past the completion cost, the pool leg adds tokens.
    expect(
      getBuyV3TokenAmountFromQuoteAmount({
        ...base,
        amount: cost.muln(2),
      }).gt(remaining),
    ).toBe(true);
  });
});
