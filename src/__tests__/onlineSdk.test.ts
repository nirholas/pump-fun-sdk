/**
 * Unit tests for the new OnlinePumpSdk methods:
 *   quoteBuy, buyBySolAmount, routedBuyInstructions, routedSellInstructions,
 *   fetchMultipleBondingCurves, parseTransactionEvents
 *
 * These tests mock the RPC connection and underlying SDK calls so no network
 * access is required.
 */
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import type { AccountInfo} from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import type { BuyQuote } from "../onlineSdk";
import { OnlinePumpSdk } from "../onlineSdk";
import { PUMP_SDK, PUMP_PROGRAM_ID, PUMP_AMM_PROGRAM_ID } from "../sdk";
import { bondingCurvePda } from "../pda";
import pumpIdlJson from "../idl/pump.json";
import pumpAmmIdlJson from "../idl/pump_amm.json";
import pumpFeesIdlJson from "../idl/pump_fees.json";
import {
  makeGlobal,
  makeBondingCurve,
  makeGraduatedBondingCurve,
  makeFeeConfig,
  TEST_PUBKEY,
  TEST_CREATOR,
} from "./fixtures";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MINT = new PublicKey("So11111111111111111111111111111111111111112");
const USER = TEST_PUBKEY;

function makeBcAccountInfo(bc = makeBondingCurve()): AccountInfo<Buffer> {
  const encoded = (PUMP_SDK as any).encodeBondingCurve
    ? (PUMP_SDK as any).encodeBondingCurve(bc)
    : Buffer.alloc(300); // fallback: raw buffer (decode will be mocked)
  return {
    data: encoded,
    executable: false,
    lamports: 1_000_000,
    owner: new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"),
    rentEpoch: 0,
  };
}

function makeSdk(connectionOverrides: Record<string, jest.Mock> = {}): OnlinePumpSdk {
  const connection = {
    getAccountInfo: jest.fn(),
    getMultipleAccountsInfo: jest.fn(),
    getTransaction: jest.fn(),
    ...connectionOverrides,
  } as any;
  return new OnlinePumpSdk(connection);
}

// ─── quoteBuy ────────────────────────────────────────────────────────────────

describe("OnlinePumpSdk.quoteBuy", () => {
  it("returns tokensOut, feesLamports, and impact for a normal buy", async () => {
    const global = makeGlobal();
    const feeConfig = makeFeeConfig();
    const bc = makeBondingCurve();

    const sdk = makeSdk();
    jest.spyOn(sdk, "fetchBuyState").mockResolvedValue({
      bondingCurveAccountInfo: makeBcAccountInfo(bc),
      bondingCurve: bc,
      associatedUserAccountInfo: null,
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });
    jest.spyOn(sdk, "fetchGlobal").mockResolvedValue(global);
    jest.spyOn(sdk, "fetchFeeConfig").mockResolvedValue(feeConfig);

    const result: BuyQuote = await sdk.quoteBuy({
      mint: MINT,
      user: USER,
      solAmount: new BN(100_000_000), // 0.1 SOL
    });

    expect(result.tokensOut.gtn(0)).toBe(true);
    expect(result.feesLamports.gten(0)).toBe(true);
    expect(result.priceImpactBps).toBeGreaterThanOrEqual(0);
    expect(result.priceBefore.gtn(0)).toBe(true);
    expect(result.priceAfter.gtn(0)).toBe(true);
    // Buying pushes price up
    expect(result.priceAfter.gte(result.priceBefore)).toBe(true);
  });

  it("returns zero tokensOut when solAmount is zero", async () => {
    const sdk = makeSdk();
    const bc = makeBondingCurve();
    jest.spyOn(sdk, "fetchBuyState").mockResolvedValue({
      bondingCurveAccountInfo: makeBcAccountInfo(bc),
      bondingCurve: bc,
      associatedUserAccountInfo: null,
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });
    jest.spyOn(sdk, "fetchGlobal").mockResolvedValue(makeGlobal());
    jest.spyOn(sdk, "fetchFeeConfig").mockResolvedValue(makeFeeConfig());

    const result = await sdk.quoteBuy({
      mint: MINT,
      user: USER,
      solAmount: new BN(0),
    });

    expect(result.tokensOut.isZero()).toBe(true);
    expect(result.priceImpactBps).toBe(0);
  });
});

// ─── buyBySolAmount ───────────────────────────────────────────────────────────

describe("OnlinePumpSdk.buyBySolAmount", () => {
  it("returns a non-empty instruction array", async () => {
    const sdk = makeSdk();
    const bc = makeBondingCurve();
    const acctInfo = makeBcAccountInfo(bc);

    jest.spyOn(sdk, "fetchBuyState").mockResolvedValue({
      bondingCurveAccountInfo: acctInfo,
      bondingCurve: bc,
      associatedUserAccountInfo: null,
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });
    jest.spyOn(sdk, "fetchGlobal").mockResolvedValue(makeGlobal());
    jest.spyOn(sdk, "fetchFeeConfig").mockResolvedValue(makeFeeConfig());

    // PUMP_SDK.buyInstructions will be called internally; stub it
    const buyInstructionsSpy = jest
      .spyOn(PUMP_SDK, "buyInstructions")
      .mockResolvedValue([{ keys: [], programId: MINT, data: Buffer.alloc(0) } as any]);

    const ixs = await sdk.buyBySolAmount({
      mint: MINT,
      user: USER,
      solAmount: new BN(50_000_000),
      slippage: 0.01,
    });

    expect(ixs.length).toBeGreaterThan(0);
    expect(buyInstructionsSpy).toHaveBeenCalledTimes(1);

    buyInstructionsSpy.mockRestore();
  });

  it("passes computed tokensOut to buyInstructions, not the raw solAmount", async () => {
    const sdk = makeSdk();
    const bc = makeBondingCurve();
    const acctInfo = makeBcAccountInfo(bc);

    jest.spyOn(sdk, "fetchBuyState").mockResolvedValue({
      bondingCurveAccountInfo: acctInfo,
      bondingCurve: bc,
      associatedUserAccountInfo: null,
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });
    jest.spyOn(sdk, "fetchGlobal").mockResolvedValue(makeGlobal());
    jest.spyOn(sdk, "fetchFeeConfig").mockResolvedValue(makeFeeConfig());

    let capturedAmount: BN | undefined;
    const buyInstructionsSpy = jest
      .spyOn(PUMP_SDK, "buyInstructions")
      .mockImplementation(async (params) => {
        capturedAmount = params.amount;
        return [];
      });

    const solAmount = new BN(100_000_000);
    await sdk.buyBySolAmount({ mint: MINT, user: USER, solAmount, slippage: 0.01 });

    // amount should be tokens, not the same BN as solAmount
    expect(capturedAmount).toBeDefined();
    // 0.1 SOL buys significantly more than 0.1 raw units
    expect(capturedAmount!.gt(solAmount)).toBe(true);

    buyInstructionsSpy.mockRestore();
  });
});

// ─── routedBuyInstructions ────────────────────────────────────────────────────

describe("OnlinePumpSdk.routedBuyInstructions", () => {
  it("routes to bonding curve when complete=false", async () => {
    const sdk = makeSdk();
    const bc = makeBondingCurve({ complete: false });
    const acctInfo = makeBcAccountInfo(bc);

    jest.spyOn(sdk, "fetchBuyState").mockResolvedValue({
      bondingCurveAccountInfo: acctInfo,
      bondingCurve: bc,
      associatedUserAccountInfo: null,
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });
    jest.spyOn(sdk, "fetchGlobal").mockResolvedValue(makeGlobal());
    jest.spyOn(sdk, "fetchFeeConfig").mockResolvedValue(makeFeeConfig());

    const bcSpy = jest
      .spyOn(PUMP_SDK, "buyInstructions")
      .mockResolvedValue([]);

    await sdk.routedBuyInstructions({
      mint: MINT,
      user: USER,
      quoteAmountIn: new BN(100_000_000),
      slippage: 0.01,
    });

    expect(bcSpy).toHaveBeenCalledTimes(1);
    bcSpy.mockRestore();
  });

  it("does not call PUMP_SDK.buyInstructions when curve is complete", async () => {
    const sdk = makeSdk();
    const bc = makeGraduatedBondingCurve();
    const acctInfo = makeBcAccountInfo(bc);

    jest.spyOn(sdk, "fetchBuyState").mockResolvedValue({
      bondingCurveAccountInfo: acctInfo,
      bondingCurve: bc,
      associatedUserAccountInfo: null,
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });
    jest.spyOn(sdk, "fetchGlobal").mockResolvedValue(makeGlobal());
    jest.spyOn(sdk, "fetchFeeConfig").mockResolvedValue(makeFeeConfig());

    // If AMM path is taken, it calls pumpAmmSdk.swapSolanaState — mock it to throw
    // so we detect if the bonding curve path is incorrectly taken instead
    const bcSpy = jest.spyOn(PUMP_SDK, "buyInstructions");

    // swapSolanaState is on the private pumpAmmSdk — patch via prototype
    const { OnlinePumpAmmSdk } = await import("@pump-fun/pump-swap-sdk");
    const ammSpy = jest
      .spyOn(OnlinePumpAmmSdk.prototype, "swapSolanaState")
      .mockRejectedValue(new Error("should not reach AMM in this test — pool not found"));

    await expect(
      sdk.routedBuyInstructions({
        mint: MINT,
        user: USER,
        quoteAmountIn: new BN(100_000_000),
        slippage: 0.01,
      }),
    ).rejects.toThrow("should not reach AMM in this test — pool not found");

    expect(bcSpy).not.toHaveBeenCalled();

    bcSpy.mockRestore();
    ammSpy.mockRestore();
  });
});

// ─── routedSellInstructions ───────────────────────────────────────────────────

describe("OnlinePumpSdk.routedSellInstructions", () => {
  it("routes to bonding curve when complete=false", async () => {
    const sdk = makeSdk();
    const bc = makeBondingCurve({ complete: false });
    const acctInfo = makeBcAccountInfo(bc);

    jest.spyOn(sdk, "fetchSellState").mockResolvedValue({
      bondingCurveAccountInfo: acctInfo,
      bondingCurve: bc,
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });
    jest.spyOn(sdk, "fetchGlobal").mockResolvedValue(makeGlobal());
    jest.spyOn(sdk, "fetchFeeConfig").mockResolvedValue(makeFeeConfig());

    const bcSpy = jest
      .spyOn(PUMP_SDK, "sellInstructions")
      .mockResolvedValue([]);

    await sdk.routedSellInstructions({
      mint: MINT,
      user: USER,
      baseAmountIn: new BN(1_000_000_000),
      slippage: 0.01,
    });

    expect(bcSpy).toHaveBeenCalledTimes(1);
    bcSpy.mockRestore();
  });
});

// ─── fetchMultipleBondingCurves ───────────────────────────────────────────────

describe("OnlinePumpSdk.fetchMultipleBondingCurves", () => {
  it("returns null for mints with no on-chain account", async () => {
    const sdk = makeSdk({
      getMultipleAccountsInfo: jest.fn().mockResolvedValue([null, null]),
    });

    const mints = [MINT, TEST_CREATOR];
    const result = await sdk.fetchMultipleBondingCurves(mints);

    expect(result.size).toBe(2);
    expect(result.get(MINT.toBase58())).toBeNull();
    expect(result.get(TEST_CREATOR.toBase58())).toBeNull();
  });

  it("queries the correct PDAs derived from each mint", async () => {
    const getMultipleAccountsInfo = jest.fn().mockResolvedValue([null]);
    const sdk = makeSdk({ getMultipleAccountsInfo });

    await sdk.fetchMultipleBondingCurves([MINT]);

    const calledWith: PublicKey[] = getMultipleAccountsInfo.mock.calls[0][0];
    expect(calledWith[0]!.toBase58()).toBe(bondingCurvePda(MINT).toBase58());
  });

  it("decodes accounts that exist on-chain", async () => {
    const bc = makeBondingCurve({ realQuoteReserves: new BN(5_000_000_000) });
    const acctInfo = makeBcAccountInfo(bc);

    const getMultipleAccountsInfo = jest.fn().mockResolvedValue([acctInfo]);
    const sdk = makeSdk({ getMultipleAccountsInfo });

    // mock decodeBondingCurve to return our fixture
    const decodeSpy = jest
      .spyOn(PUMP_SDK, "decodeBondingCurve")
      .mockReturnValue(bc);

    const result = await sdk.fetchMultipleBondingCurves([MINT]);

    expect(result.get(MINT.toBase58())).not.toBeNull();
    expect(result.get(MINT.toBase58())!.realQuoteReserves.eq(new BN(5_000_000_000))).toBe(true);

    decodeSpy.mockRestore();
  });

  it("preserves ordering of the input array", async () => {
    const mints = [MINT, USER, TEST_CREATOR];
    const getMultipleAccountsInfo = jest.fn().mockResolvedValue([null, null, null]);
    const sdk = makeSdk({ getMultipleAccountsInfo });

    const result = await sdk.fetchMultipleBondingCurves(mints);
    const keys = [...result.keys()];

    expect(keys[0]).toBe(MINT.toBase58());
    expect(keys[1]).toBe(USER.toBase58());
    expect(keys[2]).toBe(TEST_CREATOR.toBase58());
  });

  it("makes exactly one RPC call regardless of array length", async () => {
    const getMultipleAccountsInfo = jest
      .fn()
      .mockResolvedValue([null, null, null, null, null]);
    const sdk = makeSdk({ getMultipleAccountsInfo });

    await sdk.fetchMultipleBondingCurves([MINT, USER, TEST_CREATOR, MINT, USER]);
    expect(getMultipleAccountsInfo).toHaveBeenCalledTimes(1);
  });
});

// ─── parseTransactionEvents ───────────────────────────────────────────────────

describe("OnlinePumpSdk.parseTransactionEvents", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns empty array when transaction has no logs", async () => {
    const sdk = makeSdk({
      getTransaction: jest.fn().mockResolvedValue({
        meta: { logMessages: [] },
      }),
    });

    const events = await sdk.parseTransactionEvents("fakeSig");
    expect(events).toHaveLength(0);
  });

  it("returns empty array when transaction is null", async () => {
    const sdk = makeSdk({
      getTransaction: jest.fn().mockResolvedValue(null),
    });

    const events = await sdk.parseTransactionEvents("fakeSig");
    expect(events).toHaveLength(0);
  });

  it("skips non-event log lines", async () => {
    const sdk = makeSdk({
      getTransaction: jest.fn().mockResolvedValue({
        meta: {
          logMessages: [
            "Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P invoke [1]",
            "Program log: Instruction: Buy",
            "Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P success",
          ],
        },
      }),
    });

    const events = await sdk.parseTransactionEvents("fakeSig");
    expect(events).toHaveLength(0);
  });

  it("skips Program data lines too short to have a discriminator", async () => {
    const sdk = makeSdk({
      getTransaction: jest.fn().mockResolvedValue({
        meta: {
          logMessages: [
            // 4 bytes base64 = 3 bytes decoded — less than 8
            "Program data: AAAA",
          ],
        },
      }),
    });

    const events = await sdk.parseTransactionEvents("fakeSig");
    expect(events).toHaveLength(0);
  });

  // Offline Program instances (same construction as PumpSdk itself uses)
  // so the encoder and the SDK decoder share the exact coder and IDL.
  const eventProgramCache: Partial<Record<"pump" | "amm" | "fees", any>> = {};
  function eventProgramFor(kind: "pump" | "amm" | "fees"): any {
    if (!eventProgramCache[kind]) {
      const provider = new AnchorProvider(null as any, null as any, {});
      eventProgramCache[kind] =
        kind === "pump"
          ? new Program(pumpIdlJson as any, provider)
          : kind === "amm"
            ? new Program(pumpAmmIdlJson as any, provider)
            : new Program(pumpFeesIdlJson as any, provider);
    }
    return eventProgramCache[kind];
  }

  // Encode a real event the way the chain logs it: the 8-byte anchor
  // discriminator from the IDL followed by the borsh payload, base64 in a
  // "Program data:" line. Uses the SDK's own program coders.
  function encodeEventLog(
    program: "pump" | "amm" | "fees",
    typeName: string,
    overrides: Record<string, unknown> = {},
  ): string {
    const anyProgram = eventProgramFor(program);
    const idl = anyProgram.idl;
    const typeDef = idl.types.find((t: any) => t.name === typeName);
    const event = idl.events.find((e: any) => e.name === typeName);
    if (!typeDef || !event) throw new Error(`No IDL event ${typeName}`);

    const defaultFor = (t: any): unknown => {
      if (typeof t === "string") {
        if (t === "pubkey") return PublicKey.default;
        if (t === "bool") return false;
        if (t === "string") return "x";
        if (["u64", "i64", "u128", "i128"].includes(t)) return new BN(1);
        return 1;
      }
      if (t.array) return Array.from({ length: t.array[1] }, () => defaultFor(t.array[0]));
      if (t.vec) return [];
      if (t.option) return null;
      if (t.defined) {
        const name = typeof t.defined === "string" ? t.defined : t.defined.name;
        const def = idl.types.find((x: any) => x.name === name);
        if (!def) throw new Error(`Unknown defined type ${name}`);
        if (def.type.kind === "enum") {
          const variant = def.type.variants[0].name;
          return { [variant.charAt(0).toLowerCase() + variant.slice(1)]: {} };
        }
        const nested: Record<string, unknown> = {};
        for (const field of def.type.fields ?? []) nested[field.name] = defaultFor(field.type);
        return nested;
      }
      throw new Error(`Unhandled IDL type ${JSON.stringify(t)}`);
    };

    const value: Record<string, unknown> = {};
    for (const field of typeDef.type.fields) {
      value[field.name] = field.name in overrides ? overrides[field.name] : defaultFor(field.type);
    }
    const payload: Buffer = anyProgram.coder.types.encode(typeName, value);
    const data = Buffer.concat([Buffer.from(event.discriminator), payload]);
    return `Program data: ${data.toString("base64")}`;
  }

  it("returns a typed trade event when the discriminator matches", async () => {
    const sdk = makeSdk({
      getTransaction: jest.fn().mockResolvedValue({
        meta: {
          logMessages: [
            encodeEventLog("pump", "tradeEvent", {
              mint: MINT,
              user: USER,
              isBuy: true,
              solAmount: new BN(100_000_000),
            }),
          ],
        },
      }),
    });

    const events = await sdk.parseTransactionEvents("fakeSig");
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("trade");
    const trade = events[0] as { type: "trade"; data: { mint: PublicKey; isBuy: boolean; solAmount: BN } };
    expect(trade.data.mint.equals(MINT)).toBe(true);
    expect(trade.data.isBuy).toBe(true);
    expect(trade.data.solAmount.eq(new BN(100_000_000))).toBe(true);
  });

  it("routes shared event names by emitting program context", async () => {
    // ClaimCashbackEvent exists on both the Pump and PumpAMM programs with
    // the same discriminator. The invoke stack decides which decoder runs.
    const pumpLine = encodeEventLog("pump", "claimCashbackEvent", { user: USER });
    const sdk = makeSdk({
      getTransaction: jest.fn().mockResolvedValue({
        meta: {
          logMessages: [
            `Program ${PUMP_AMM_PROGRAM_ID.toBase58()} invoke [1]`,
            encodeEventLog("amm", "claimCashbackEvent", { user: USER }),
            `Program ${PUMP_AMM_PROGRAM_ID.toBase58()} success`,
            `Program ${PUMP_PROGRAM_ID.toBase58()} invoke [1]`,
            pumpLine,
            `Program ${PUMP_PROGRAM_ID.toBase58()} success`,
          ],
        },
      }),
    });

    const events = await sdk.parseTransactionEvents("fakeSig");
    expect(events.map((e) => e.type)).toEqual(["ammClaimCashback", "claimCashback"]);
  });

  it("returns empty for an unknown discriminator", async () => {
    const sdk = makeSdk({
      getTransaction: jest.fn().mockResolvedValue({
        meta: {
          logMessages: ["Program data: AAAAAAAAAAAAAAAA"],
        },
      }),
    });

    const events = await sdk.parseTransactionEvents("fakeSig");
    expect(events).toHaveLength(0);
  });

  it("decodes a deposit event by type", async () => {
    const sdk = makeSdk({
      getTransaction: jest.fn().mockResolvedValue({
        meta: {
          logMessages: [
            encodeEventLog("amm", "depositEvent", { lpTokenAmountOut: new BN(1000) }),
          ],
        },
      }),
    });

    const events = await sdk.parseTransactionEvents("fakeSig");
    expect(events[0]?.type).toBe("deposit");
    const deposit = events[0] as { type: "deposit"; data: { lpTokenAmountOut: BN } };
    expect(deposit.data.lpTokenAmountOut.eq(new BN(1000))).toBe(true);
  });

  it("decodes a createPool event by type", async () => {
    const sdk = makeSdk({
      getTransaction: jest.fn().mockResolvedValue({
        meta: {
          logMessages: [encodeEventLog("amm", "createPoolEvent", { pool: MINT })],
        },
      }),
    });

    const events = await sdk.parseTransactionEvents("fakeSig");
    expect(events[0]?.type).toBe("createPool");
    const created = events[0] as { type: "createPool"; data: { pool: PublicKey } };
    expect(created.data.pool.equals(MINT)).toBe(true);
  });

  it("decodes a createFeeSharingConfig event by type", async () => {
    const sdk = makeSdk({
      getTransaction: jest.fn().mockResolvedValue({
        meta: {
          logMessages: [
            encodeEventLog("fees", "createFeeSharingConfigEvent", { mint: MINT }),
          ],
        },
      }),
    });

    const events = await sdk.parseTransactionEvents("fakeSig");
    expect(events[0]?.type).toBe("createFeeSharingConfig");
  });
});

// ─── fetchBondingCurveSummary / fetchGraduationProgress / fetchTokenPrice ────

describe("OnlinePumpSdk analytics wrappers", () => {
  function makeAnalyticsSdk(bc = makeBondingCurve()) {
    const sdk = makeSdk();
    jest.spyOn(sdk, "fetchGlobal").mockResolvedValue(makeGlobal());
    jest.spyOn(sdk, "fetchFeeConfig").mockResolvedValue(makeFeeConfig());
    jest.spyOn(sdk, "fetchBondingCurve").mockResolvedValue(bc);
    return sdk;
  }

  it("fetchBondingCurveSummary returns correct fields", async () => {
    const bc = makeBondingCurve();
    const sdk = makeAnalyticsSdk(bc);
    const summary = await sdk.fetchBondingCurveSummary(MINT);

    expect(summary.marketCap.gtn(0)).toBe(true);
    expect(summary.progressBps).toBe(0);
    expect(summary.isGraduated).toBe(false);
    expect(summary.solNeededToGraduate.gtn(0)).toBe(true);
    expect(summary.buyPricePerToken.gtn(0)).toBe(true);
    expect(summary.sellPricePerToken.gtn(0)).toBe(true);
    expect(summary.realSolReserves.eq(bc.realQuoteReserves)).toBe(true);
    expect(summary.protocolFeeBps.gtn(0)).toBe(true);
    expect(summary.isMayhemMode).toBe(false);
  });

  it("fetchBondingCurveSummary reflects isMayhemMode=true", async () => {
    const sdk = makeAnalyticsSdk(makeBondingCurve({ isMayhemMode: true }));
    const summary = await sdk.fetchBondingCurveSummary(MINT);
    expect(summary.isMayhemMode).toBe(true);
  });

  it("fetchGraduationProgress returns 0 bps for fresh curve", async () => {
    const sdk = makeAnalyticsSdk();
    const progress = await sdk.fetchGraduationProgress(MINT);
    expect(progress.progressBps).toBe(0);
    expect(progress.isGraduated).toBe(false);
    expect(progress.solNeededToGraduate.gtn(0)).toBe(true);
  });

  it("fetchGraduationProgress returns 10000 bps for graduated curve", async () => {
    const sdk = makeAnalyticsSdk(makeBondingCurve({ complete: true, realTokenReserves: new BN(0), realQuoteReserves: new BN("85000000000") }));
    const progress = await sdk.fetchGraduationProgress(MINT);
    expect(progress.progressBps).toBe(10_000);
    expect(progress.isGraduated).toBe(true);
    expect(progress.solNeededToGraduate.isZero()).toBe(true);
  });

  it("fetchTokenPrice returns buy > sell and positive marketCap", async () => {
    const sdk = makeAnalyticsSdk();
    const price = await sdk.fetchTokenPrice(MINT);
    expect(price.buyPricePerToken.gtn(0)).toBe(true);
    expect(price.sellPricePerToken.gtn(0)).toBe(true);
    expect(price.marketCap.gtn(0)).toBe(true);
    expect(price.buyPricePerToken.gt(price.sellPricePerToken)).toBe(true);
    expect(price.isGraduated).toBe(false);
  });

  it("fetchBuyPriceImpact returns positive impactBps for a real buy", async () => {
    const sdk = makeAnalyticsSdk();
    const impact = await sdk.fetchBuyPriceImpact(MINT, new BN("1000000000"));
    expect(impact.impactBps).toBeGreaterThan(0);
    expect(impact.outputAmount.gtn(0)).toBe(true);
    expect(impact.priceAfter.gt(impact.priceBefore)).toBe(true);
  });

  it("fetchBuyPriceImpact returns 0 impactBps for zero sol", async () => {
    const sdk = makeAnalyticsSdk();
    const impact = await sdk.fetchBuyPriceImpact(MINT, new BN(0));
    expect(impact.impactBps).toBe(0);
    expect(impact.outputAmount.isZero()).toBe(true);
  });

  it("fetchSellPriceImpact returns positive impactBps for a real sell", async () => {
    const sdk = makeAnalyticsSdk();
    const impact = await sdk.fetchSellPriceImpact(MINT, new BN("1000000000000"));
    expect(impact.impactBps).toBeGreaterThan(0);
    expect(impact.outputAmount.gtn(0)).toBe(true);
    expect(impact.priceAfter.lt(impact.priceBefore)).toBe(true);
  });
});

// ─── quoteSell ───────────────────────────────────────────────────────────────

describe("OnlinePumpSdk.quoteSell", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns solOut, feesLamports, maxSafeAmount, willOverflow", async () => {
    const sdk = makeSdk();
    const bc = makeBondingCurve();

    jest.spyOn(sdk, "fetchSellState").mockResolvedValue({
      bondingCurveAccountInfo: makeBcAccountInfo(bc),
      bondingCurve: bc,
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });
    jest.spyOn(sdk, "fetchGlobal").mockResolvedValue(makeGlobal());
    jest.spyOn(sdk, "fetchFeeConfig").mockResolvedValue(makeFeeConfig());

    const result = await sdk.quoteSell({
      mint: MINT,
      user: USER,
      amount: new BN("100000000"), // 100 tokens (raw) — safely below overflow threshold
    });

    expect(result.solOut.gtn(0)).toBe(true);
    expect(result.feesLamports.gten(0)).toBe(true);
    expect(result.maxSafeAmount.gtn(0)).toBe(true);
    expect(result.willOverflow).toBe(false);
    expect(result.priceImpactBps).toBeGreaterThanOrEqual(0);
    expect(result.priceAfter.gtn(0)).toBe(true);
  });

  it("willOverflow is true when amount exceeds maxSafeAmount", async () => {
    const sdk = makeSdk();
    const bc = makeBondingCurve();

    jest.spyOn(sdk, "fetchSellState").mockResolvedValue({
      bondingCurveAccountInfo: makeBcAccountInfo(bc),
      bondingCurve: bc,
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });
    jest.spyOn(sdk, "fetchGlobal").mockResolvedValue(makeGlobal());
    jest.spyOn(sdk, "fetchFeeConfig").mockResolvedValue(makeFeeConfig());

    // Enormous amount that definitely overflows
    const result = await sdk.quoteSell({
      mint: MINT,
      user: USER,
      amount: new BN("999999999999999999999"),
    });

    expect(result.willOverflow).toBe(true);
  });
});

// ─── isGraduated ─────────────────────────────────────────────────────────────

describe("OnlinePumpSdk.isGraduated", () => {
  it("returns false when pool account does not exist", async () => {
    const sdk = makeSdk({
      getAccountInfo: jest.fn().mockResolvedValue(null),
    });
    expect(await sdk.isGraduated(MINT)).toBe(false);
  });

  it("returns true when pool account exists", async () => {
    const sdk = makeSdk({
      getAccountInfo: jest.fn().mockResolvedValue({ data: Buffer.alloc(0), lamports: 1 }),
    });
    expect(await sdk.isGraduated(MINT)).toBe(true);
  });
});

// ─── getTokenBalance ─────────────────────────────────────────────────────────

describe("OnlinePumpSdk.getTokenBalance", () => {
  it("returns BN(0) when ATA does not exist", async () => {
    const sdk = makeSdk({
      getAccountInfo: jest.fn().mockResolvedValue(null),
    });
    const bal = await sdk.getTokenBalance(MINT, USER);
    expect(bal.isZero()).toBe(true);
  });

  it("parses token balance from raw account data bytes 64-72", async () => {
    // Token account layout: mint(32) + owner(32) + amount(8, le)
    const data = Buffer.alloc(165);
    const amount = BigInt(5_000_000_000);
    data.writeBigUInt64LE(amount, 64);

    const sdk = makeSdk({
      getAccountInfo: jest.fn().mockResolvedValue({ data }),
    });
    const bal = await sdk.getTokenBalance(MINT, USER);
    expect(bal.toString()).toBe("5000000000");
  });
});
