/**
 * Unit tests for the new OnlinePumpSdk methods:
 *   quoteBuy, buyBySolAmount, routedBuyInstructions, routedSellInstructions,
 *   fetchMultipleBondingCurves, parseTransactionEvents
 *
 * These tests mock the RPC connection and underlying SDK calls so no network
 * access is required.
 */
import { AccountInfo, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { OnlinePumpSdk, BuyQuote } from "../onlineSdk";
import { PUMP_SDK } from "../sdk";
import { bondingCurvePda } from "../pda";
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
    const bc = makeBondingCurve({ realSolReserves: new BN(5_000_000_000) });
    const acctInfo = makeBcAccountInfo(bc);

    const getMultipleAccountsInfo = jest.fn().mockResolvedValue([acctInfo]);
    const sdk = makeSdk({ getMultipleAccountsInfo });

    // mock decodeBondingCurve to return our fixture
    const decodeSpy = jest
      .spyOn(PUMP_SDK, "decodeBondingCurve")
      .mockReturnValue(bc);

    const result = await sdk.fetchMultipleBondingCurves([MINT]);

    expect(result.get(MINT.toBase58())).not.toBeNull();
    expect(result.get(MINT.toBase58())!.realSolReserves.eq(new BN(5_000_000_000))).toBe(true);

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

  it("returns a typed trade event when the discriminator matches", async () => {
    const fakeTradeEvent = {
      mint: MINT,
      solAmount: new BN(100_000_000),
      tokenAmount: new BN(1_000_000_000),
      isBuy: true,
      user: USER,
      timestamp: new BN(1_700_000_000),
      virtualSolReserves: new BN("30000000000"),
      virtualTokenReserves: new BN("1073000000000000"),
      realSolReserves: new BN("100000000"),
      realTokenReserves: new BN("793100000000000"),
    };

    // stub the decoder
    const decodeSpy = jest
      .spyOn(PUMP_SDK, "decodeTradeEvent")
      .mockReturnValue(fakeTradeEvent as any);

    const sdk = makeSdk({
      getTransaction: jest.fn().mockResolvedValue({
        meta: {
          logMessages: [
            // 12 bytes of base64 → 9 decoded bytes (>= 8 discriminator bytes)
            "Program data: AAAAAAAAAAAAAAAA",
          ],
        },
      }),
    });

    const events = await sdk.parseTransactionEvents("fakeSig");
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("trade");
    expect((events[0] as { type: "trade"; data: typeof fakeTradeEvent }).data.isBuy).toBe(true);

    decodeSpy.mockRestore();
  });

  it("returns empty when all decoders throw (unknown discriminator)", async () => {
    const throwErr = () => { throw new Error("bad discriminator"); };
    jest.spyOn(PUMP_SDK, "decodeTradeEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeCreateEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeCompleteEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeCompletePumpAmmMigrationEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeSetCreatorEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeCollectCreatorFeeEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeClaimCashbackEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeClaimTokenIncentivesEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeExtendAccountEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeInitUserVolumeAccumulatorEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeSyncUserVolumeAccumulatorEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeCloseUserVolumeAccumulatorEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeAdminSetCreatorEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeMigrateBondingCurveCreatorEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeDistributeCreatorFeesEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeAmmBuyEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeAmmSellEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeDepositEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeWithdrawEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeCreatePoolEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeCreateFeeSharingConfigEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeUpdateFeeSharesEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeResetFeeSharingConfigEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeRevokeFeeSharingAuthorityEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeTransferFeeSharingAuthorityEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeSocialFeePdaCreatedEvent").mockImplementation(throwErr);
    jest.spyOn(PUMP_SDK, "decodeSocialFeePdaClaimedEvent").mockImplementation(throwErr);

    const sdk = makeSdk({
      getTransaction: jest.fn().mockResolvedValue({
        meta: {
          logMessages: ["Program data: AAAAAAAAAAAAAAAA"],
        },
      }),
    });

    const events = await sdk.parseTransactionEvents("fakeSig");
    expect(events).toHaveLength(0);

    jest.restoreAllMocks();
  });

  it("decodes a deposit event by type", async () => {
    const fakeDepositEvent = { lpTokensIssued: new BN(1000) };
    // Prevent earlier type-based decoders (which don't check discriminators) from matching
    const retNull = () => null as any;
    jest.spyOn(PUMP_SDK, "decodeAmmBuyEvent").mockImplementation(retNull);
    jest.spyOn(PUMP_SDK, "decodeAmmSellEvent").mockImplementation(retNull);
    jest.spyOn(PUMP_SDK, "decodeDepositEvent").mockReturnValue(fakeDepositEvent as any);

    const sdk = makeSdk({
      getTransaction: jest.fn().mockResolvedValue({
        meta: { logMessages: ["Program data: AAAAAAAAAAAAAAAA"] },
      }),
    });

    const events = await sdk.parseTransactionEvents("fakeSig");
    expect(events[0]?.type).toBe("deposit");
    jest.restoreAllMocks();
  });

  it("decodes a createPool event by type", async () => {
    const fakeCreatePoolEvent = { pool: MINT };
    const retNull = () => null as any;
    jest.spyOn(PUMP_SDK, "decodeAmmBuyEvent").mockImplementation(retNull);
    jest.spyOn(PUMP_SDK, "decodeAmmSellEvent").mockImplementation(retNull);
    jest.spyOn(PUMP_SDK, "decodeDepositEvent").mockImplementation(retNull);
    jest.spyOn(PUMP_SDK, "decodeWithdrawEvent").mockImplementation(retNull);
    jest.spyOn(PUMP_SDK, "decodeCreatePoolEvent").mockReturnValue(fakeCreatePoolEvent as any);

    const sdk = makeSdk({
      getTransaction: jest.fn().mockResolvedValue({
        meta: { logMessages: ["Program data: AAAAAAAAAAAAAAAA"] },
      }),
    });

    const events = await sdk.parseTransactionEvents("fakeSig");
    expect(events[0]?.type).toBe("createPool");
    jest.restoreAllMocks();
  });

  it("decodes a createFeeSharingConfig event by type", async () => {
    const fakeEvent = { mint: MINT };
    const retNull = () => null as any;
    jest.spyOn(PUMP_SDK, "decodeAmmBuyEvent").mockImplementation(retNull);
    jest.spyOn(PUMP_SDK, "decodeAmmSellEvent").mockImplementation(retNull);
    jest.spyOn(PUMP_SDK, "decodeDepositEvent").mockImplementation(retNull);
    jest.spyOn(PUMP_SDK, "decodeWithdrawEvent").mockImplementation(retNull);
    jest.spyOn(PUMP_SDK, "decodeCreatePoolEvent").mockImplementation(retNull);
    jest.spyOn(PUMP_SDK, "decodeCreateFeeSharingConfigEvent").mockReturnValue(fakeEvent as any);

    const sdk = makeSdk({
      getTransaction: jest.fn().mockResolvedValue({
        meta: { logMessages: ["Program data: AAAAAAAAAAAAAAAA"] },
      }),
    });

    const events = await sdk.parseTransactionEvents("fakeSig");
    expect(events[0]?.type).toBe("createFeeSharingConfig");
    jest.restoreAllMocks();
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
