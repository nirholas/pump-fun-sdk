/**
 * Offline tests for the Live Data examples (33-40).
 *
 * Every example in this batch reads mainnet, so the network half lives in
 * main() and the logic half is exported. These tests cover the exported
 * halves only: the percentage and price math against the SDK fixtures, the
 * basket aggregations against hand-built maps, the routing rule against
 * curve states, and the trade decoder against real anchor-encoded log lines
 * built with the SDK's own IDL coder.
 */
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import {
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  bondingCurvePda,
  canonicalPumpPoolPda,
  getBuyTokenAmountFromSolAmount,
  getTokenPrice,
} from "../../src/index";
import pumpIdlJson from "../../src/idl/pump.json";
import {
  makeBondingCurve,
  makeFeeConfig,
  makeGlobal,
  makeGraduatedBondingCurve,
  TEST_CREATOR,
  TEST_PUBKEY,
} from "../../src/__tests__/fixtures";

import { bpsToPercent, progressBar } from "../33-graduation-progress";
import { priceFromReserves, spreadBps } from "../34-token-price";
import { classifyImpact, MODERATE_MAX_BPS, NEGLIGIBLE_MAX_BPS } from "../35-price-impact";
import { compareBuyQuotes, offlineBuyQuote, quoteSeller } from "../36-live-quotes";
import { aggregateCurves } from "../37-batch-curves";
import { aggregatePools, tokenAccountAmount } from "../38-batch-pools";
import { routeFor, sellerFor, summariseInstructions } from "../39-routed-trading";
import { extractTrades, summariseFeed } from "../40-websocket-trades";

import type { BondingCurve } from "../../src/state";
import { TransactionInstruction } from "@solana/web3.js";

const SOL = (n: number) => new BN(n).mul(new BN(1_000_000_000));
const MINT = new PublicKey("So11111111111111111111111111111111111111112");

/** An SPL token account buffer with the given owner and balance. */
function tokenAccountData(owner: PublicKey, amount: BN): Buffer {
  const data = Buffer.alloc(165);
  MINT.toBuffer().copy(data, 0);
  owner.toBuffer().copy(data, 32);
  amount.toArrayLike(Buffer, "le", 8).copy(data, 64);
  return data;
}

describe("example 33: graduation progress", () => {
  it("renders a half-full bar at half the target", () => {
    const bar = progressBar(new BN(500), new BN(1000), 10);
    expect(bar.bps.toString()).toBe("5000");
    expect(bar.filled).toBe(5);
    expect(bar.bar).toBe("#####.....");
  });

  it("is empty at zero and full at the target", () => {
    expect(progressBar(new BN(0), new BN(1000), 8).bar).toBe("........");
    expect(progressBar(new BN(1000), new BN(1000), 8).bar).toBe("########");
  });

  it("clamps values outside the range instead of overflowing the bar", () => {
    const over = progressBar(new BN(4000), new BN(1000), 10);
    expect(over.bps.toString()).toBe("10000");
    expect(over.bar.length).toBe(10);
    const under = progressBar(new BN(-50), new BN(1000), 10);
    expect(under.bps.isZero()).toBe(true);
  });

  it("rejects a non-positive target", () => {
    expect(() => progressBar(new BN(1), new BN(0))).toThrow(/positive/);
  });

  it("renders basis points as a two-decimal percentage", () => {
    expect(bpsToPercent(new BN(1234))).toBe("12.34%");
    expect(bpsToPercent(new BN(10_000))).toBe("100.00%");
  });

  it("tracks the fixture curve's own sold-versus-total ratio", () => {
    const global = makeGlobal();
    const curve = makeBondingCurve({
      realTokenReserves: global.initialRealTokenReserves.divn(4),
    });
    const sold = global.initialRealTokenReserves.sub(curve.realTokenReserves);
    expect(progressBar(sold, global.initialRealTokenReserves).bps.toString()).toBe("7500");
  });
});

describe("example 34: token price", () => {
  const global = makeGlobal();
  const feeConfig = makeFeeConfig();

  it("brackets the SDK's buy and sell prices with the fee-free spot price", () => {
    const bondingCurve = makeBondingCurve({ creator: TEST_CREATOR });
    const sdkPrice = getTokenPrice({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
    });
    const spot = priceFromReserves(bondingCurve);

    expect(spot.gtn(0)).toBe(true);
    expect(sdkPrice.sellPricePerToken.lte(spot)).toBe(true);
    expect(spot.lte(sdkPrice.buyPricePerToken)).toBe(true);
  });

  it("moves with the reserves the same way the SDK price does", () => {
    const cheap = makeBondingCurve();
    const rich = makeBondingCurve({
      virtualQuoteReserves: SOL(90),
      virtualTokenReserves: new BN("357666666666666"),
    });
    expect(priceFromReserves(rich).gt(priceFromReserves(cheap))).toBe(true);

    const priceOf = (bondingCurve: BondingCurve) =>
      getTokenPrice({
        global,
        feeConfig,
        mintSupply: bondingCurve.tokenTotalSupply,
        bondingCurve,
      }).buyPricePerToken;
    expect(priceOf(rich).gt(priceOf(cheap))).toBe(true);
  });

  it("reports no price for a migrated curve, exactly as the SDK does", () => {
    const migrated = makeBondingCurve({
      virtualQuoteReserves: new BN(0),
      virtualTokenReserves: new BN(0),
      complete: true,
    });
    expect(priceFromReserves(migrated).isZero()).toBe(true);
    expect(
      getTokenPrice({
        global,
        feeConfig,
        mintSupply: migrated.tokenTotalSupply,
        bondingCurve: migrated,
      }).buyPricePerToken.isZero(),
    ).toBe(true);
  });

  it("measures the spread between two prices in basis points", () => {
    expect(spreadBps(new BN(100), new BN(101)).toString()).toBe("100");
    expect(spreadBps(new BN(0), new BN(5)).isZero()).toBe(true);
  });
});

describe("example 35: price impact classifier", () => {
  it("calls anything under 50 bps negligible", () => {
    expect(classifyImpact(new BN(0)).level).toBe("negligible");
    expect(classifyImpact(NEGLIGIBLE_MAX_BPS.subn(1)).level).toBe("negligible");
  });

  it("calls 50 to 299 bps moderate", () => {
    expect(classifyImpact(NEGLIGIBLE_MAX_BPS).level).toBe("moderate");
    expect(classifyImpact(MODERATE_MAX_BPS.subn(1)).level).toBe("moderate");
  });

  it("calls 300 bps and beyond severe", () => {
    expect(classifyImpact(MODERATE_MAX_BPS).level).toBe("severe");
    expect(classifyImpact(new BN(9_999)).level).toBe("severe");
  });

  it("classifies a downward move on its magnitude", () => {
    expect(classifyImpact(new BN(-1_200)).level).toBe("severe");
    expect(classifyImpact(new BN(-10)).level).toBe("negligible");
  });

  it("returns advice with every verdict", () => {
    for (const bps of [new BN(1), new BN(100), new BN(5_000)]) {
      expect(classifyImpact(bps).advice.length).toBeGreaterThan(0);
    }
  });
});

describe("example 36: live quotes beside offline math", () => {
  const global = makeGlobal();
  const feeConfig = makeFeeConfig();
  const bondingCurve = makeBondingCurve({ creator: TEST_CREATOR });

  it("reproduces the SDK curve math exactly", () => {
    const mine = offlineBuyQuote({ global, feeConfig, bondingCurve, solAmount: SOL(1) });
    const sdk = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
      amount: SOL(1),
    });
    expect(mine.eq(sdk)).toBe(true);
  });

  it("reports zero drift when both sides saw the same state", () => {
    const tokens = offlineBuyQuote({ global, feeConfig, bondingCurve, solAmount: SOL(1) });
    const comparison = compareBuyQuotes(tokens, tokens);
    expect(comparison.driftBps.isZero()).toBe(true);
    expect(comparison.agree).toBe(true);
  });

  it("measures drift in basis points and fails a wide gap", () => {
    const comparison = compareBuyQuotes(new BN(10_000), new BN(9_000));
    expect(comparison.driftBps.toString()).toBe("1000");
    expect(comparison.agree).toBe(false);
  });

  it("rejects a zero online quote instead of dividing by it", () => {
    expect(() => compareBuyQuotes(new BN(0), new BN(1))).toThrow(/zero/);
  });

  it("quotes the sell against the curve's own vault owner", () => {
    expect(quoteSeller(MINT).equals(bondingCurvePda(MINT))).toBe(true);
  });
});

describe("example 37: batched curve aggregation", () => {
  it("counts active, complete, and missing curves and sums their SOL", () => {
    const active = makeBondingCurve({ realQuoteReserves: SOL(12) });
    const alsoActive = makeBondingCurve({ realQuoteReserves: SOL(3) });
    const done = makeGraduatedBondingCurve();
    const curves = new Map<string, BondingCurve | null>([
      ["mintA", active],
      ["mintB", alsoActive],
      ["mintC", done],
      ["mintD", null],
    ]);

    const summary = aggregateCurves(curves);
    expect(summary.total).toBe(4);
    expect(summary.active).toBe(2);
    expect(summary.complete).toBe(1);
    expect(summary.missing).toBe(1);
    expect(summary.active + summary.complete + summary.missing).toBe(summary.total);
    expect(
      summary.solLocked.eq(
        active.realQuoteReserves
          .add(alsoActive.realQuoteReserves)
          .add(done.realQuoteReserves),
      ),
    ).toBe(true);
    expect(
      summary.tokensRemaining.eq(
        active.realTokenReserves.add(alsoActive.realTokenReserves),
      ),
    ).toBe(true);
    expect(summary.largest?.mint).toBe("mintC");
  });

  it("handles an empty basket without inventing a leader", () => {
    const summary = aggregateCurves(new Map());
    expect(summary.total).toBe(0);
    expect(summary.solLocked.isZero()).toBe(true);
    expect(summary.largest).toBeNull();
  });
});

describe("example 38: pool aggregation", () => {
  it("prices each pool from its reserves and finds the deepest", () => {
    const summary = aggregatePools([
      {
        mint: "mintA",
        pool: "poolA",
        baseReserve: new BN("200000000000000"), // 200M tokens
        quoteReserve: SOL(60),
        lpSupply: new BN(1),
      },
      {
        mint: "mintB",
        pool: "poolB",
        baseReserve: new BN("100000000000000"), // 100M tokens
        quoteReserve: SOL(30),
        lpSupply: new BN(1),
      },
    ]);

    expect(summary.priced).toHaveLength(2);
    // 60 SOL over 200M tokens = 300 lamports per whole token.
    expect(summary.priced[0]!.priceLamportsPerToken.toString()).toBe("300");
    expect(summary.priced[1]!.priceLamportsPerToken.toString()).toBe("300");
    expect(summary.totalQuoteLiquidity.eq(SOL(90))).toBe(true);
    expect(summary.deepest?.mint).toBe("mintA");
    expect(summary.unpriced).toBe(0);
  });

  it("reads a balance out of an SPL token account", () => {
    const data = tokenAccountData(TEST_CREATOR, new BN("123456789"));
    expect(tokenAccountAmount(data).toString()).toBe("123456789");
    expect(() => tokenAccountAmount(Buffer.alloc(8))).toThrow(/token account/);
  });

  it("skips a pool with an empty vault rather than dividing by zero", () => {
    const summary = aggregatePools([
      {
        mint: "mintA",
        pool: "poolA",
        baseReserve: new BN(0),
        quoteReserve: SOL(1),
        lpSupply: new BN(0),
      },
    ]);
    expect(summary.priced).toHaveLength(0);
    expect(summary.unpriced).toBe(1);
    expect(summary.deepest).toBeNull();
    expect(summary.totalQuoteLiquidity.eq(SOL(1))).toBe(true);
  });
});

describe("example 39: routing rule", () => {
  it("routes an unfinished curve to the Pump program", () => {
    const route = routeFor(makeBondingCurve());
    expect(route.venue).toBe("bonding-curve");
    expect(route.programId?.equals(PUMP_PROGRAM_ID)).toBe(true);
  });

  it("routes a completed curve to PumpAMM", () => {
    const route = routeFor(makeGraduatedBondingCurve());
    expect(route.venue).toBe("amm");
    expect(route.programId?.equals(PUMP_AMM_PROGRAM_ID)).toBe(true);
  });

  it("routes nowhere when the mint has no curve account", () => {
    const route = routeFor(null);
    expect(route.venue).toBe("none");
    expect(route.programId).toBeNull();
    expect(route.reason).toMatch(/never launched/);
  });

  it("picks a seller that exists on each venue and none off-venue", () => {
    expect(sellerFor(MINT, "bonding-curve")!.equals(bondingCurvePda(MINT))).toBe(true);
    expect(sellerFor(MINT, "amm")!.equals(canonicalPumpPoolPda(MINT))).toBe(true);
    expect(sellerFor(MINT, "none")).toBeNull();
  });

  it("names the program behind each instruction", () => {
    const ix = (programId: PublicKey) =>
      new TransactionInstruction({
        programId,
        keys: [{ pubkey: TEST_PUBKEY, isSigner: false, isWritable: false }],
        data: Buffer.alloc(3),
      });
    const lines = summariseInstructions([ix(PUMP_PROGRAM_ID), ix(PUMP_AMM_PROGRAM_ID)]);
    expect(lines[0]).toContain("pump keys=1 data=3B");
    expect(lines[1]).toContain("pump-amm");
  });
});

describe("example 40: trade feed decoding", () => {
  // Encode events exactly as the chain logs them: the 8-byte anchor
  // discriminator from the IDL followed by the borsh payload, base64 in a
  // "Program data:" line, using the SDK's own coder.
  const provider = new AnchorProvider(null as never, null as never, {});
  const program = new Program(pumpIdlJson as never, provider) as never as {
    idl: {
      types: Array<{ name: string; type: { fields?: Array<{ name: string; type: unknown }> ; kind?: string; variants?: Array<{ name: string }> } }>;
      events: Array<{ name: string; discriminator: number[] }>;
    };
    coder: { types: { encode: (name: string, value: unknown) => Buffer } };
  };

  function encodeTradeLog(overrides: Record<string, unknown>): string {
    const idl = program.idl;
    const typeDef = idl.types.find((t) => t.name === "tradeEvent");
    const event = idl.events.find((e) => e.name === "tradeEvent");
    if (!typeDef || !event) throw new Error("No tradeEvent in the Pump IDL");

    const defaultFor = (type: unknown): unknown => {
      if (typeof type === "string") {
        if (type === "pubkey") return PublicKey.default;
        if (type === "bool") return false;
        if (type === "string") return "buy";
        if (["u64", "i64", "u128", "i128"].includes(type)) return new BN(1);
        return 1;
      }
      const shape = type as { array?: [unknown, number]; vec?: unknown; option?: unknown };
      if (shape.array) return Array.from({ length: shape.array[1] }, () => defaultFor(shape.array![0]));
      if (shape.vec) return [];
      if (shape.option) return null;
      throw new Error(`Unhandled IDL type ${JSON.stringify(type)}`);
    };

    const value: Record<string, unknown> = {};
    for (const field of typeDef.type.fields ?? []) {
      value[field.name] = field.name in overrides ? overrides[field.name] : defaultFor(field.type);
    }
    const payload = program.coder.types.encode("tradeEvent", value);
    const data = Buffer.concat([Buffer.from(event.discriminator), payload]);
    return `Program data: ${data.toString("base64")}`;
  }

  function tradeLogs(trades: Array<Record<string, unknown>>): string[] {
    return [
      `Program ${PUMP_PROGRAM_ID.toBase58()} invoke [1]`,
      ...trades.map((trade) => encodeTradeLog(trade)),
      `Program ${PUMP_PROGRAM_ID.toBase58()} success`,
    ];
  }

  it("decodes a buy out of real anchor-encoded log lines", () => {
    const trades = extractTrades(
      tradeLogs([
        {
          mint: MINT,
          user: TEST_CREATOR,
          isBuy: true,
          solAmount: new BN(100_000_000),
          tokenAmount: new BN("3000000000"),
          fee: new BN(1_000_000),
          creatorFee: new BN(500_000),
          virtualSolReserves: SOL(31),
        },
      ]),
    );

    expect(trades).toHaveLength(1);
    const trade = trades[0]!;
    expect(trade.mint).toBe(MINT.toBase58());
    expect(trade.user).toBe(TEST_CREATOR.toBase58());
    expect(trade.isBuy).toBe(true);
    expect(trade.solAmount.toString()).toBe("100000000");
    expect(trade.tokenAmount.toString()).toBe("3000000000");
    expect(trade.virtualSolReserves.eq(SOL(31))).toBe(true);
  });

  it("ignores log lines that are not trade events", () => {
    expect(
      extractTrades([
        `Program ${PUMP_PROGRAM_ID.toBase58()} invoke [1]`,
        "Program log: Instruction: Buy",
        "Program data: AAAA",
        `Program ${PUMP_PROGRAM_ID.toBase58()} success`,
      ]),
    ).toHaveLength(0);
    expect(extractTrades([])).toHaveLength(0);
  });

  it("summarises a window of trades", () => {
    const trades = extractTrades(
      tradeLogs([
        {
          mint: MINT,
          isBuy: true,
          solAmount: SOL(2),
          fee: new BN(20_000_000),
          creatorFee: new BN(10_000_000),
        },
        {
          mint: MINT,
          isBuy: false,
          solAmount: SOL(1),
          fee: new BN(10_000_000),
          creatorFee: new BN(5_000_000),
        },
        {
          mint: PUMP_PROGRAM_ID,
          isBuy: true,
          solAmount: SOL(3),
          fee: new BN(0),
          creatorFee: new BN(0),
        },
      ]),
    );

    const summary = summariseFeed(trades);
    expect(summary.trades).toBe(3);
    expect(summary.buys).toBe(2);
    expect(summary.sells).toBe(1);
    expect(summary.mints).toBe(2);
    expect(summary.volume.eq(SOL(6))).toBe(true);
    expect(summary.fees.eq(new BN(45_000_000))).toBe(true);
  });

  it("summarises an empty window to zeroes", () => {
    const summary = summariseFeed([]);
    expect(summary.trades).toBe(0);
    expect(summary.volume.isZero()).toBe(true);
    expect(summary.fees.isZero()).toBe(true);
    expect(summary.mints).toBe(0);
  });
});
