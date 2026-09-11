/**
 * Offline tests for the Accounts & Events and Live Data examples (25-32).
 *
 * Every network call in these examples lives inside `main()`, so everything
 * exported is exercised here without a connection. Event tests do not mock
 * the decoders: they encode real anchor event buffers with the SDK's own
 * program coders and IDL discriminators, the same bytes the chain logs, and
 * decode them back through the example's public functions.
 */
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  MAX_SHAREHOLDERS,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
  PUMP_PROGRAM_ID,
  PUMP_SDK,
  PumpAmmIdl,
  PumpFeesIdl,
  PumpIdl,
  PumpSdk,
  Platform,
  canonicalPumpPoolPda,
  currentDayTokens,
  feeSharingConfigPda,
  getBondingCurveSummary,
  parsePumpEventsFromLogs,
  type AmmGlobalConfig,
  type BondingCurveSummary,
  type GlobalVolumeAccumulator,
  type Pool,
  type PumpEvent,
  type SharingConfig,
  type Shareholder,
  type UserVolumeAccumulator,
} from "@nirholas/pump-sdk";
import { NATIVE_MINT } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import {
  makeBondingCurve,
  makeFeeConfig,
  makeGlobal,
  makeGraduatedBondingCurve,
  makeMigratedBondingCurve,
  TEST_CREATOR,
  TEST_PUBKEY,
} from "../../src/__tests__/fixtures";
import { interpretPool, isRateLimited } from "../25-decode-pool";
import {
  programFamilyOf,
  summarizeEvents,
} from "../26-parse-transaction-events";
import {
  decodeCurveEvent,
  programDataBuffers,
  pumpEventDiscriminator,
  splitProgramData,
} from "../27-decode-trade-events";
import {
  currentDayShare,
  dayWindowAt,
  isIncentiveProgramConfigured,
  totalStatsOf,
} from "../28-volume-accumulators";
import {
  describeSharingConfig,
  resolveShareholders,
  TOTAL_SHARE_BPS,
  validateShareholders,
} from "../29-sharing-config";
import {
  decodeAny,
  decodersFor,
  discriminatorOf,
  EVENT_DECODERS,
  sharedEventNames,
} from "../30-event-catalog";
import { compareToDefaults, describeFeeTiers } from "../31-fetch-global-state";
import { summarizeCurve } from "../32-curve-summary";

// ── Real event encoding ────────────────────────────────────────────────
//
// Offline Program instances built exactly the way PumpSdk builds them, so
// the encoder here and the decoder under test share one coder and one IDL.

type ProgramKind = "pump" | "amm" | "fees";

const IDL_JSON: Record<ProgramKind, unknown> = {
  pump: PumpIdl,
  amm: PumpAmmIdl,
  fees: PumpFeesIdl,
};

const programCache: Partial<Record<ProgramKind, Program>> = {};

function programFor(kind: ProgramKind): Program {
  let program = programCache[kind];
  if (!program) {
    const provider = new AnchorProvider(
      null as never,
      null as never,
      {},
    );
    program = new Program(IDL_JSON[kind] as never, provider);
    programCache[kind] = program;
  }
  return program;
}

interface IdlLike {
  types: Array<{ name: string; type: { kind: string; fields?: Array<{ name: string; type: unknown }>; variants?: Array<{ name: string }> } }>;
  events: Array<{ name: string; discriminator: number[] }>;
}

/**
 * Encode an event the way the chain logs it: the 8-byte discriminator from
 * the IDL followed by the borsh payload. Field values default to a typed
 * placeholder unless overridden, so a test only names the fields it asserts.
 */
function encodeEvent(
  kind: ProgramKind,
  typeName: string,
  overrides: Record<string, unknown> = {},
): Buffer {
  const program = programFor(kind);
  const idl = program.idl as unknown as IdlLike;
  const typeDef = idl.types.find((t) => t.name === typeName);
  const event = idl.events.find((e) => e.name === typeName);
  if (!typeDef || !event) throw new Error(`No IDL event ${typeName} on ${kind}`);

  const defaultFor = (type: unknown): unknown => {
    if (typeof type === "string") {
      if (type === "pubkey") return PublicKey.default;
      if (type === "bool") return false;
      if (type === "string") return "x";
      if (["u64", "i64", "u128", "i128"].includes(type)) return new BN(1);
      return 1;
    }
    const t = type as {
      array?: [unknown, number];
      vec?: unknown;
      option?: unknown;
      defined?: string | { name: string };
    };
    if (t.array) {
      return Array.from({ length: t.array[1] }, () => defaultFor(t.array![0]));
    }
    if (t.vec) return [];
    if (t.option !== undefined) return null;
    if (t.defined) {
      const name = typeof t.defined === "string" ? t.defined : t.defined.name;
      const def = idl.types.find((x) => x.name === name);
      if (!def) throw new Error(`Unknown defined type ${name}`);
      if (def.type.kind === "enum") {
        const variant = def.type.variants?.[0]?.name ?? "";
        return { [variant.charAt(0).toLowerCase() + variant.slice(1)]: {} };
      }
      const nested: Record<string, unknown> = {};
      for (const field of def.type.fields ?? []) {
        nested[field.name] = defaultFor(field.type);
      }
      return nested;
    }
    throw new Error(`Unhandled IDL type ${JSON.stringify(type)}`);
  };

  const value: Record<string, unknown> = {};
  for (const field of typeDef.type.fields ?? []) {
    value[field.name] =
      field.name in overrides ? overrides[field.name] : defaultFor(field.type);
  }

  const payload = program.coder.types.encode(typeName, value) as Buffer;
  return Buffer.concat([Buffer.from(event.discriminator), payload]);
}

/** The `Program data:` log line carrying an encoded event. */
function eventLogLine(buffer: Buffer): string {
  return `Program data: ${buffer.toString("base64")}`;
}

const MINT = new PublicKey("So11111111111111111111111111111111111111112");
const USER = TEST_CREATOR;

// ── Example 25 ─────────────────────────────────────────────────────────

function makePool(overrides: Partial<Pool> = {}): Pool {
  return {
    poolBump: 254,
    index: 0,
    creator: TEST_CREATOR,
    baseMint: MINT,
    quoteMint: NATIVE_MINT,
    lpMint: TEST_PUBKEY,
    poolBaseTokenAccount: TEST_PUBKEY,
    poolQuoteTokenAccount: TEST_PUBKEY,
    lpSupply: new BN("1000000000"),
    coinCreator: TEST_CREATOR,
    isMayhemMode: false,
    isCashbackCoin: false,
    ...overrides,
  };
}

function makeAmmGlobalConfig(
  overrides: Partial<AmmGlobalConfig> = {},
): AmmGlobalConfig {
  return {
    admin: TEST_PUBKEY,
    lpFeeBasisPoints: new BN(20),
    protocolFeeBasisPoints: new BN(5),
    disableFlags: 0,
    protocolFeeRecipients: [TEST_PUBKEY],
    coinCreatorFeeBasisPoints: new BN(5),
    adminSetCoinCreatorAuthority: TEST_PUBKEY,
    whitelistPda: TEST_PUBKEY,
    reservedFeeRecipient: TEST_PUBKEY,
    mayhemModeEnabled: false,
    reservedFeeRecipients: [TEST_PUBKEY],
    isCashbackEnabled: true,
    ...overrides,
  };
}

describe("example 25: pool interpretation", () => {
  it("recognises the canonical pool and totals the fee legs", () => {
    const pool = makePool();
    const view = interpretPool({
      pool,
      poolAddress: canonicalPumpPoolPda(pool.baseMint),
      globalConfig: makeAmmGlobalConfig(),
    });
    expect(view.isCanonical).toBe(true);
    expect(view.quoteIsWrappedSol).toBe(true);
    expect(view.hasLiquidity).toBe(true);
    expect(view.hasCoinCreator).toBe(true);
    expect(view.creatorFeesShared).toBe(false);
    expect(view.totalFeeBps.eq(new BN(30))).toBe(true);
    expect(view.allInstructionsEnabled).toBe(true);
  });

  it("flags a non-canonical address, an empty pool and disabled flags", () => {
    const pool = makePool({ lpSupply: new BN(0), coinCreator: PublicKey.default });
    const view = interpretPool({
      pool,
      poolAddress: TEST_PUBKEY,
      globalConfig: makeAmmGlobalConfig({ disableFlags: 4 }),
    });
    expect(view.isCanonical).toBe(false);
    expect(view.hasLiquidity).toBe(false);
    expect(view.hasCoinCreator).toBe(false);
    expect(view.allInstructionsEnabled).toBe(false);
  });

  it("detects a coin creator that is the mint's fee sharing config", () => {
    const pool = makePool({ coinCreator: feeSharingConfigPda(MINT) });
    const view = interpretPool({
      pool,
      poolAddress: canonicalPumpPoolPda(MINT),
      globalConfig: makeAmmGlobalConfig(),
    });
    expect(view.creatorFeesShared).toBe(true);
  });

  it("identifies a rate-limit error and only a rate-limit error", () => {
    expect(isRateLimited(new Error("429 Too Many Requests"))).toBe(true);
    expect(isRateLimited(new Error("Server responded with 429"))).toBe(true);
    expect(isRateLimited(new Error("failed to get account info"))).toBe(false);
  });
});

// ── Example 26 ─────────────────────────────────────────────────────────

/** Parse real encoded event buffers into the SDK's typed union. */
function eventsFrom(
  lines: Array<{ program: string; buffers: Buffer[] }>,
): PumpEvent[] {
  const logs: string[] = [];
  for (const entry of lines) {
    logs.push(`Program ${entry.program} invoke [1]`);
    for (const buffer of entry.buffers) logs.push(eventLogLine(buffer));
    logs.push(`Program ${entry.program} success`);
  }
  return parsePumpEventsFromLogs(logs);
}

describe("example 26: transaction event summary", () => {
  const events = eventsFrom([
    {
      program: PUMP_PROGRAM_ID.toBase58(),
      buffers: [
        encodeEvent("pump", "tradeEvent", {
          mint: MINT,
          user: USER,
          isBuy: true,
          solAmount: new BN(100_000_000),
          tokenAmount: new BN(3_000_000_000),
          fee: new BN(1_000_000),
          creatorFee: new BN(500_000),
        }),
        encodeEvent("pump", "tradeEvent", {
          mint: MINT,
          user: USER,
          isBuy: false,
          solAmount: new BN(40_000_000),
          tokenAmount: new BN(1_200_000_000),
          fee: new BN(400_000),
          creatorFee: new BN(200_000),
        }),
        encodeEvent("pump", "completeEvent", { mint: MINT, user: USER }),
      ],
    },
    {
      program: PUMP_AMM_PROGRAM_ID.toBase58(),
      buffers: [
        encodeEvent("amm", "buyEvent", {
          quoteAmountIn: new BN(50_000_000),
          baseAmountOut: new BN(900_000_000),
          lpFee: new BN(100_000),
          protocolFee: new BN(25_000),
          coinCreatorFee: new BN(25_000),
        }),
      ],
    },
    {
      program: PUMP_FEE_PROGRAM_ID.toBase58(),
      buffers: [
        encodeEvent("fees", "updateFeeSharesEvent", { mint: MINT }),
      ],
    },
  ]);

  it("decodes every encoded event back out of the logs", () => {
    expect(events.map((event) => event.type)).toEqual([
      "trade",
      "trade",
      "complete",
      "ammBuy",
      "updateFeeShares",
    ]);
  });

  it("routes each event type to its emitting program", () => {
    expect(programFamilyOf("trade")).toBe("pump");
    expect(programFamilyOf("claimCashback")).toBe("pump");
    expect(programFamilyOf("ammClaimCashback")).toBe("amm");
    expect(programFamilyOf("deposit")).toBe("amm");
    expect(programFamilyOf("createPool")).toBe("amm");
    expect(programFamilyOf("socialFeePdaClaimed")).toBe("fees");
    expect(programFamilyOf("feesUpsertFeeTiers")).toBe("fees");
    expect(programFamilyOf("updateFeeShares")).toBe("fees");
  });

  it("classifies every event type in the union", () => {
    for (const entry of EVENT_DECODERS) {
      expect(programFamilyOf(entry.eventType)).toBe(entry.program);
    }
  });

  it("totals curve trades and AMM swaps separately", () => {
    const summary = summarizeEvents(events);
    expect(summary.total).toBe(5);
    expect(summary.byProgram).toEqual({ pump: 3, amm: 1, fees: 1 });
    expect(summary.byType[0]).toEqual({ type: "trade", count: 2 });
    expect(summary.mints).toEqual([MINT.toBase58()]);
    expect(summary.curveTrades.buys).toBe(1);
    expect(summary.curveTrades.sells).toBe(1);
    expect(summary.curveTrades.solVolume.eq(new BN(140_000_000))).toBe(true);
    expect(summary.curveTrades.tokenVolume.eq(new BN(4_200_000_000))).toBe(true);
    expect(summary.curveTrades.feesPaid.eq(new BN(2_100_000))).toBe(true);
    expect(summary.ammSwaps.buys).toBe(1);
    expect(summary.ammSwaps.solVolume.eq(new BN(50_000_000))).toBe(true);
    expect(summary.ammSwaps.feesPaid.eq(new BN(150_000))).toBe(true);
  });

  it("summarises an empty event list without dividing by anything", () => {
    const summary = summarizeEvents([]);
    expect(summary.total).toBe(0);
    expect(summary.byType).toEqual([]);
    expect(summary.mints).toEqual([]);
    expect(summary.curveTrades.solVolume.isZero()).toBe(true);
  });
});

// ── Example 27 ─────────────────────────────────────────────────────────

describe("example 27: bare payload decoding", () => {
  it("splits a Program data buffer into discriminator and payload", () => {
    const buffer = encodeEvent("pump", "completeEvent", { mint: MINT });
    const { discriminator, payload } = splitProgramData(buffer);
    expect(discriminator).toBe(pumpEventDiscriminator("CompleteEvent"));
    expect(payload.length).toBe(buffer.length - 8);
  });

  it("rejects a buffer too short to carry a discriminator", () => {
    expect(() => splitProgramData(Buffer.alloc(4))).toThrow(/at least 8/);
  });

  it("decodes all four lifecycle events from real buffers", () => {
    const trade = decodeCurveEvent(
      encodeEvent("pump", "tradeEvent", {
        mint: MINT,
        user: USER,
        isBuy: true,
        solAmount: new BN(250_000_000),
      }),
    );
    expect(trade?.name).toBe("TradeEvent");
    if (trade?.name !== "TradeEvent") throw new Error("expected a trade event");
    expect(trade.data.mint.equals(MINT)).toBe(true);
    expect(trade.data.isBuy).toBe(true);
    expect(trade.data.solAmount.eq(new BN(250_000_000))).toBe(true);

    const create = decodeCurveEvent(
      encodeEvent("pump", "createEvent", {
        mint: MINT,
        name: "Example Coin",
        symbol: "EXMPL",
        creator: USER,
      }),
    );
    if (create?.name !== "CreateEvent") throw new Error("expected a create event");
    expect(create.data.name).toBe("Example Coin");
    expect(create.data.symbol).toBe("EXMPL");

    const complete = decodeCurveEvent(
      encodeEvent("pump", "completeEvent", { mint: MINT, user: USER }),
    );
    if (complete?.name !== "CompleteEvent") {
      throw new Error("expected a complete event");
    }
    expect(complete.data.user.equals(USER)).toBe(true);

    const migration = decodeCurveEvent(
      encodeEvent("pump", "completePumpAmmMigrationEvent", {
        mint: MINT,
        solAmount: new BN(85_000_000_000),
      }),
    );
    if (migration?.name !== "CompletePumpAmmMigrationEvent") {
      throw new Error("expected a migration event");
    }
    expect(migration.data.solAmount.eq(new BN(85_000_000_000))).toBe(true);
  });

  it("returns null for an event outside the lifecycle set", () => {
    expect(
      decodeCurveEvent(encodeEvent("pump", "extendAccountEvent")),
    ).toBeNull();
  });

  it("misdecodes when the discriminator is not stripped", () => {
    // The whole point of the example: the decoders take bare payloads.
    const buffer = encodeEvent("pump", "completeEvent", {
      mint: MINT,
      user: USER,
    });
    const correct = PUMP_SDK.decodeCompleteEvent(buffer.subarray(8));
    expect(correct.mint.equals(MINT)).toBe(true);

    let sameMint = false;
    try {
      sameMint = PUMP_SDK.decodeCompleteEvent(buffer).mint.equals(MINT);
    } catch {
      sameMint = false;
    }
    expect(sameMint).toBe(false);
  });

  it("pulls only Program data lines out of a log", () => {
    const buffer = encodeEvent("pump", "completeEvent", { mint: MINT });
    const buffers = programDataBuffers([
      `Program ${PUMP_PROGRAM_ID.toBase58()} invoke [1]`,
      "Program log: Instruction: Buy",
      eventLogLine(buffer),
      `Program ${PUMP_PROGRAM_ID.toBase58()} success`,
    ]);
    expect(buffers).toHaveLength(1);
    expect(buffers[0]!.equals(buffer)).toBe(true);
  });
});

// ── Example 28 ─────────────────────────────────────────────────────────

const DAY = 86_400;
const START = 1_700_000_000;

function makeGlobalVolumeAccumulator(
  overrides: Partial<GlobalVolumeAccumulator> = {},
): GlobalVolumeAccumulator {
  return {
    startTime: new BN(START),
    endTime: new BN(START + DAY * 4),
    secondsInADay: new BN(DAY),
    mint: MINT,
    totalTokenSupply: [
      new BN("1000000000000"),
      new BN("2000000000000"),
      new BN("3000000000000"),
      new BN("4000000000000"),
      new BN("5000000000000"),
    ],
    solVolumes: [
      new BN("100000000000"),
      new BN("200000000000"),
      new BN("300000000000"),
      new BN("400000000000"),
      new BN("500000000000"),
    ],
    ...overrides,
  };
}

function makeUserVolumeAccumulator(
  overrides: Partial<UserVolumeAccumulator> = {},
): UserVolumeAccumulator {
  return {
    user: USER,
    needsClaim: false,
    totalUnclaimedTokens: new BN("7000000"),
    totalClaimedTokens: new BN("3000000"),
    currentSolVolume: new BN("10000000000"),
    lastUpdateTimestamp: new BN(START + DAY * 2 + 60),
    ...overrides,
  };
}

describe("example 28: volume accumulator day math", () => {
  const accumulator = makeGlobalVolumeAccumulator();

  it("locates a timestamp in the day grid", () => {
    const window = dayWindowAt(accumulator, new BN(START + DAY * 2 + 3_600));
    expect(window.dayIndex).toBe(2);
    expect(window.dayStart.eq(new BN(START + DAY * 2))).toBe(true);
    expect(window.dayEnd.eq(new BN(START + DAY * 3))).toBe(true);
    expect(window.secondsIntoDay.eq(new BN(3_600))).toBe(true);
    expect(window.withinProgram).toBe(true);
    expect(window.endDayIndex).toBe(4);
  });

  it("reports a timestamp before the program starts", () => {
    const window = dayWindowAt(accumulator, new BN(START - 10));
    expect(window.dayIndex).toBe(-1);
    expect(window.withinProgram).toBe(false);
  });

  it("reports a timestamp past the program end", () => {
    const window = dayWindowAt(accumulator, new BN(START + DAY * 9));
    expect(window.dayIndex).toBe(9);
    expect(window.withinProgram).toBe(false);
  });

  it("throws on an unconfigured accumulator instead of dividing by zero", () => {
    expect(() =>
      dayWindowAt(
        makeGlobalVolumeAccumulator({ secondsInADay: new BN(0) }),
        new BN(START),
      ),
    ).toThrow(/not configured/);
  });

  it("recognises the no-season state mainnet sits in between seasons", () => {
    const idle = makeGlobalVolumeAccumulator({
      startTime: new BN(0),
      endTime: new BN(0),
      secondsInADay: new BN(0),
    });
    expect(isIncentiveProgramConfigured(idle)).toBe(false);
    expect(isIncentiveProgramConfigured(accumulator)).toBe(true);

    const user = makeUserVolumeAccumulator();
    const share = currentDayShare(idle, user, new BN(START));
    expect(share.tokens.isZero()).toBe(true);
    expect(share.sameDay).toBe(false);
    expect(share.window.dayIndex).toBe(-1);
    // The SDK short-circuits the same way rather than throwing.
    expect(currentDayTokens(idle, user, START).isZero()).toBe(true);
  });

  it("agrees with the SDK's currentDayTokens", () => {
    const user = makeUserVolumeAccumulator();
    const now = START + DAY * 2 + 7_200;
    const share = currentDayShare(accumulator, user, new BN(now));
    expect(share.sameDay).toBe(true);
    // 10 SOL of 300 SOL for the day, against 3,000,000 tokens of supply.
    expect(share.tokens.eq(new BN("100000000000"))).toBe(true);
    expect(share.tokens.eq(currentDayTokens(accumulator, user, now))).toBe(true);
  });

  it("pays nothing when the user's accumulator is a day behind", () => {
    const user = makeUserVolumeAccumulator({
      lastUpdateTimestamp: new BN(START + DAY),
    });
    const now = START + DAY * 2 + 7_200;
    const share = currentDayShare(accumulator, user, new BN(now));
    expect(share.sameDay).toBe(false);
    expect(share.tokens.isZero()).toBe(true);
    expect(currentDayTokens(accumulator, user, now).isZero()).toBe(true);
  });

  it("pays nothing outside the program window", () => {
    const now = START + DAY * 6;
    const user = makeUserVolumeAccumulator({
      lastUpdateTimestamp: new BN(now),
    });
    const share = currentDayShare(accumulator, user, new BN(now));
    expect(share.tokens.isZero()).toBe(true);
    expect(currentDayTokens(accumulator, user, now).isZero()).toBe(true);
  });

  it("zeroes the total stats when the account does not exist", () => {
    const stats = totalStatsOf(null);
    expect(stats.totalUnclaimedTokens.isZero()).toBe(true);
    expect(stats.totalClaimedTokens.isZero()).toBe(true);
    expect(stats.currentSolVolume.isZero()).toBe(true);
  });

  it("carries the accumulator's totals through when it does exist", () => {
    const stats = totalStatsOf(makeUserVolumeAccumulator());
    expect(stats.totalUnclaimedTokens.eq(new BN("7000000"))).toBe(true);
    expect(stats.totalClaimedTokens.eq(new BN("3000000"))).toBe(true);
  });
});

// ── Example 29 ─────────────────────────────────────────────────────────

const WALLET_A = TEST_CREATOR;
const WALLET_B = PUMP_PROGRAM_ID;
const WALLET_C = PUMP_AMM_PROGRAM_ID;

function shareholders(
  ...entries: Array<[PublicKey, number]>
): Shareholder[] {
  return entries.map(([address, shareBps]) => ({ address, shareBps }));
}

/** The SDK's own enforcement: does updateFeeShares accept this split? */
async function sdkAccepts(list: Shareholder[]): Promise<boolean> {
  try {
    await PUMP_SDK.updateFeeShares({
      authority: WALLET_A,
      mint: MINT,
      currentShareholders: [],
      newShareholders: list,
    });
    return true;
  } catch {
    return false;
  }
}

describe("example 29: shareholder rules", () => {
  it("agrees with the SDK on a valid split", async () => {
    const list = shareholders([WALLET_A, 7_000], [WALLET_B, 3_000]);
    expect(validateShareholders(list).valid).toBe(true);
    expect(await sdkAccepts(list)).toBe(true);
  });

  it("rejects an empty list, as the SDK does", async () => {
    const result = validateShareholders([]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/NoShareholdersError/);
    expect(await sdkAccepts([])).toBe(false);
  });

  it("rejects more than MAX_SHAREHOLDERS, as the SDK does", async () => {
    expect(MAX_SHAREHOLDERS).toBe(10);
    // 11 distinct addresses summing to exactly 10,000 bps, so the only rule
    // broken is the ceiling.
    const list: Shareholder[] = Array.from({ length: 11 }, (_, i) => ({
      address: PublicKey.unique(),
      shareBps: i === 10 ? 10_000 - 10 * 909 : 909,
    }));
    const result = validateShareholders(list);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /TooManyShareholdersError/.test(e))).toBe(true);
    expect(result.totalBps).toBe(TOTAL_SHARE_BPS);
    expect(await sdkAccepts(list)).toBe(false);
  });

  it("accepts exactly MAX_SHAREHOLDERS", async () => {
    const list: Shareholder[] = Array.from({ length: 10 }, () => ({
      address: PublicKey.unique(),
      shareBps: 1_000,
    }));
    expect(validateShareholders(list).valid).toBe(true);
    expect(await sdkAccepts(list)).toBe(true);
  });

  it("rejects a zero or negative share, as the SDK does", async () => {
    const list = shareholders([WALLET_A, 10_000], [WALLET_B, 0]);
    const result = validateShareholders(list);
    expect(result.errors.some((e) => /ZeroShareError/.test(e))).toBe(true);
    expect(await sdkAccepts(list)).toBe(false);

    const negative = shareholders([WALLET_A, 11_000], [WALLET_B, -1_000]);
    expect(validateShareholders(negative).valid).toBe(false);
    expect(await sdkAccepts(negative)).toBe(false);
  });

  it("rejects a total that is not exactly 10,000 bps, as the SDK does", async () => {
    const under = shareholders([WALLET_A, 5_000], [WALLET_B, 4_999]);
    const over = shareholders([WALLET_A, 5_000], [WALLET_B, 5_001]);
    expect(validateShareholders(under).errors.some((e) => /InvalidShareTotalError/.test(e))).toBe(true);
    expect(validateShareholders(over).valid).toBe(false);
    expect(await sdkAccepts(under)).toBe(false);
    expect(await sdkAccepts(over)).toBe(false);
  });

  it("rejects duplicate addresses even when the total is right", async () => {
    const list = shareholders([WALLET_A, 5_000], [WALLET_A, 5_000]);
    const result = validateShareholders(list);
    expect(result.totalBps).toBe(TOTAL_SHARE_BPS);
    expect(result.errors.some((e) => /DuplicateShareholderError/.test(e))).toBe(true);
    expect(await sdkAccepts(list)).toBe(false);
  });

  it("collects every violation at once", () => {
    const list = shareholders([WALLET_A, 0], [WALLET_A, 4_000]);
    const result = validateShareholders(list);
    expect(result.errors).toHaveLength(3);
  });

  it("resolves a social handle to a PDA that must be created first", () => {
    const resolved = resolveShareholders([
      { address: WALLET_A, shareBps: 6_000 },
      { userId: "42", platform: Platform.GitHub, shareBps: 4_000 },
    ]);
    expect(resolved.shareholders).toHaveLength(2);
    expect(resolved.pdasToCreate).toHaveLength(1);
    expect(resolved.pdasToCreate[0]!.userId).toBe("42");
    expect(resolved.validation.valid).toBe(true);
  });

  it("refuses an unsupported social platform", () => {
    expect(() =>
      resolveShareholders([{ userId: "42", platform: Platform.X, shareBps: 10_000 }]),
    ).toThrow(/Unsupported platform/);
  });

  it("describes a config and reports whether it is editable", () => {
    const config: SharingConfig = {
      version: 2,
      mint: MINT,
      admin: WALLET_A,
      adminRevoked: false,
      shareholders: shareholders([WALLET_B, 3_000], [WALLET_C, 7_000]),
    };
    const view = describeSharingConfig(config);
    expect(view.editable).toBe(true);
    expect(view.totalBps).toBe(TOTAL_SHARE_BPS);
    expect(view.shares[0]!.percent).toBe("70.00%");
    expect(view.slotsRemaining).toBe(MAX_SHAREHOLDERS - 2);

    expect(
      describeSharingConfig({ ...config, adminRevoked: true }).editable,
    ).toBe(false);
    expect(describeSharingConfig({ ...config, version: 1 }).editable).toBe(false);
  });
});

// ── Example 30 ─────────────────────────────────────────────────────────

describe("example 30: event catalog", () => {
  it("covers every decode*Event method on PumpSdk", () => {
    const methods = Object.getOwnPropertyNames(PumpSdk.prototype).filter(
      (name) => /^decode.+Event$/.test(name),
    );
    const catalogued = new Set(EVENT_DECODERS.map((entry) => entry.method));
    const missing = methods.filter((name) => !catalogued.has(name));
    expect(missing).toEqual([]);
    expect(catalogued.size).toBe(EVENT_DECODERS.length);
    expect(EVENT_DECODERS.length).toBe(methods.length);
  });

  it("names an IDL event that exists for every entry", () => {
    for (const entry of EVENT_DECODERS) {
      expect(discriminatorOf(entry)).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it("splits the catalog across the three programs", () => {
    expect(decodersFor("pump").length).toBeGreaterThan(0);
    expect(decodersFor("amm").length).toBeGreaterThan(0);
    expect(decodersFor("fees").length).toBeGreaterThan(0);
    expect(
      decodersFor("pump").length +
        decodersFor("amm").length +
        decodersFor("fees").length,
    ).toBe(EVENT_DECODERS.length);
  });

  it("finds the discriminators shared by more than one program", () => {
    const shared = sharedEventNames();
    expect(shared.length).toBeGreaterThan(0);
    const cashback = shared.find(({ entries }) =>
      entries.some((entry) => entry.idlEvent === "ClaimCashbackEvent"),
    );
    expect(cashback).toBeDefined();
    expect(cashback!.entries.length).toBeGreaterThan(1);
  });

  it("routes a real buffer to the right decoder", () => {
    const decoded = decodeAny(
      encodeEvent("pump", "tradeEvent", { mint: MINT, isBuy: true }),
    );
    expect(decoded?.entry.method).toBe("decodeTradeEvent");
    expect(decoded?.event.type).toBe("trade");
  });

  it("uses the program hint to break a name collision", () => {
    const buffer = encodeEvent("amm", "claimCashbackEvent", { user: USER });
    expect(decodeAny(buffer, "amm")?.entry.eventType).toBe("ammClaimCashback");
    expect(decodeAny(buffer, "pump")?.entry.eventType).toBe("claimCashback");
  });

  it("returns null for a buffer this protocol did not emit", () => {
    expect(decodeAny(Buffer.alloc(64))).toBeNull();
    expect(decodeAny(Buffer.alloc(4))).toBeNull();
  });

  it("decodes an event from every catalogued decoder", () => {
    for (const entry of EVENT_DECODERS) {
      const idlName =
        entry.idlEvent.charAt(0).toLowerCase() + entry.idlEvent.slice(1);
      const buffer = encodeEvent(entry.program, idlName);
      const decoded = decodeAny(buffer, entry.program);
      expect(decoded).not.toBeNull();
      expect(decoded!.entry.eventType).toBe(entry.eventType);
    }
  });
});

// ── Example 31 ─────────────────────────────────────────────────────────

describe("example 31: global state drift", () => {
  it("reports no drift for the documented launch parameters", () => {
    const drift = compareToDefaults(makeGlobal());
    expect(drift.length).toBeGreaterThan(0);
    expect(drift.filter((item) => !item.matches)).toEqual([]);
  });

  it("names the fields that moved", () => {
    const drift = compareToDefaults(
      makeGlobal({
        feeBasisPoints: new BN(250),
        initialVirtualSolReserves: new BN("42000000000"),
        mayhemModeEnabled: true,
      }),
    );
    const changed = drift.filter((item) => !item.matches).map((i) => i.field);
    expect(changed.sort()).toEqual([
      "feeBasisPoints",
      "initialVirtualSolReserves",
      "mayhemModeEnabled",
    ]);
    const fee = drift.find((item) => item.field === "feeBasisPoints")!;
    expect(fee.live).toBe("250 bps");
    expect(fee.documented).toBe("100 bps");
  });

  it("orders fee tiers by threshold", () => {
    const tiers = describeFeeTiers(makeFeeConfig());
    expect(tiers).toHaveLength(3);
    expect(tiers[0]!.protocolFeeBps).toBe("200");
    expect(tiers[2]!.protocolFeeBps).toBe("50");
  });
});

// ── Example 32 ─────────────────────────────────────────────────────────

function summaryFor(curve = makeBondingCurve()): BondingCurveSummary {
  return getBondingCurveSummary({
    global: makeGlobal(),
    feeConfig: makeFeeConfig(),
    mintSupply: curve.tokenTotalSupply,
    bondingCurve: curve,
  });
}

describe("example 32: curve reading", () => {
  it("reads a fresh curve", () => {
    const reading = summarizeCurve(summaryFor());
    expect(reading.status).toBe("trading");
    expect(reading.quotable).toBe(true);
    expect(reading.progressPercent).toBe("0.00");
    expect(reading.solRaised.isZero()).toBe(true);
    expect(reading.solToGraduate.gtn(0)).toBe(true);
    expect(reading.roundTripCost.gtn(0)).toBe(true);
    expect(reading.roundTripBps.gtn(0)).toBe(true);
    expect(reading.totalFeeBps.gtn(0)).toBe(true);
  });

  it("keeps the round trip at least as expensive as both fee legs", () => {
    const reading = summarizeCurve(summaryFor());
    expect(reading.roundTripBps.gte(reading.totalFeeBps)).toBe(true);
    expect(reading.curveSpreadBps.gten(0)).toBe(true);
  });

  it("tracks progress as the curve fills", () => {
    const half = makeBondingCurve({
      realTokenReserves: new BN("396550000000000"),
      realQuoteReserves: new BN("30000000000"),
      virtualQuoteReserves: new BN("60000000000"),
      virtualTokenReserves: new BN("536500000000000"),
    });
    const reading = summarizeCurve(summaryFor(half));
    expect(reading.progressPercent).toBe("50.00");
    expect(reading.solRaised.eq(new BN("30000000000"))).toBe(true);
    expect(reading.tokensRemaining.eq(new BN("396550000000000"))).toBe(true);
  });

  it("refuses to quote a round trip on a completed curve", () => {
    // The buy side is closed while the sell side still prices off the
    // virtual reserves, which would otherwise produce a negative spread.
    const reading = summarizeCurve(summaryFor(makeGraduatedBondingCurve()));
    expect(reading.status).toBe("graduated");
    expect(reading.quotable).toBe(false);
    expect(reading.progressPercent).toBe("100.00");
    expect(reading.solToGraduate.isZero()).toBe(true);
    expect(reading.roundTripCost.isZero()).toBe(true);
    expect(reading.roundTripBps.isZero()).toBe(true);
    expect(reading.curveSpreadBps.isZero()).toBe(true);
  });

  it("reports a migrated curve without dividing by zeroed reserves", () => {
    const reading = summarizeCurve(summaryFor(makeMigratedBondingCurve()));
    expect(reading.status).toBe("graduated");
    expect(reading.quotable).toBe(false);
    expect(reading.roundTripBps.isZero()).toBe(true);
  });
});
