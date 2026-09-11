/**
 * Offline tests for the fee and account examples (17-24).
 *
 * Nothing here mocks the SDK: the fee helpers run against the real tier
 * math, the instruction examples build real instructions and validate
 * their real account lists, the PDA table is checked against direct
 * findProgramAddressSync derivations, and the decoders decode bytes that
 * were encoded to the on-chain layout.
 */
import {
  BREAKING_FEE_RECIPIENTS,
  MAYHEM_PROGRAM_ID,
  ONE_BILLION_SUPPLY,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
  PUMP_PROGRAM_ID,
  PUMP_SDK,
  getStaticRandomFeeRecipient,
  isBreakingFeeRecipient,
  pickBreakingFeeRecipient,
  validateAmmInstruction,
  validateBcInstruction,
} from "@nirholas/pump-sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import {
  makeBondingCurve,
  makeFeeConfig,
  makeGlobal,
  makeGraduatedBondingCurve,
  makeMigratedBondingCurve,
} from "../../src/__tests__/fixtures";
import {
  buildTierTable,
  curveFeeLadder,
  feeSupplyBasis,
  feesAtMarketCap,
  feesForCurve,
  tradeFee,
} from "../17-fee-tiers";
import {
  breakingRecipientIndex,
  breakingRecipientWsolAta,
  distinctDraws,
  protocolRecipientPools,
} from "../18-fee-recipients";
import {
  buildAmmBuyInstruction,
  buildBcBuyInstruction,
  dropTrailingAccounts,
  repairAmmInstruction,
  repairBcInstruction,
} from "../19-breaking-fee-validation";
import {
  buildImpactLadder,
  measureImpact,
  priceImpactBps,
  spotPriceLamports,
} from "../20-price-impact-offline";
import { buildPdaTable, exampleInputs, pdasInGroup } from "../21-derive-pdas";
import { interpretGlobal } from "../22-decode-global";
import {
  BONDING_CURVE_DATA_LEN,
  curveAccountInfo,
  curveReport,
  curveStatus,
  encodeBondingCurveAccount,
} from "../23-decode-bonding-curve";
import { interpretFeeConfig } from "../24-decode-fee-config";

const SOL = (whole: number) => new BN(whole).mul(new BN(1_000_000_000));

describe("example 17: fee tiers", () => {
  const feeConfig = makeFeeConfig();
  const global = makeGlobal();

  it("returns the first tier for a cap below every threshold", () => {
    const fees = feesAtMarketCap(feeConfig, new BN(0));
    expect(fees.protocolFeeBps.eq(feeConfig.feeTiers[0]!.fees.protocolFeeBps)).toBe(
      true,
    );
  });

  it("steps down to a cheaper tier as the cap crosses a threshold", () => {
    const below = feesAtMarketCap(feeConfig, new BN("99999999999"));
    const at = feesAtMarketCap(feeConfig, new BN("100000000000"));
    expect(at.protocolFeeBps.lt(below.protocolFeeBps)).toBe(true);
  });

  it("builds a table whose all-in rate never rises with the cap", () => {
    const table = buildTierTable(feeConfig, [
      { label: "zero", marketCap: new BN(0) },
      { label: "100 SOL", marketCap: new BN("100000000000") },
      { label: "1000 SOL", marketCap: new BN("1000000000000") },
    ]);
    expect(table.length).toBe(3);
    for (let i = 1; i < table.length; i += 1) {
      expect(table[i]!.totalBps.lte(table[i - 1]!.totalBps)).toBe(true);
    }
  });

  it("prices a standard curve against the fixed 1B supply", () => {
    const curve = makeBondingCurve();
    const reported = new BN("10000000000000000"); // 10B tokens
    expect(feeSupplyBasis(curve, reported).eq(ONE_BILLION_SUPPLY)).toBe(true);
  });

  it("prices a mayhem curve against its real supply, which can shift the tier", () => {
    const reported = new BN("10000000000000000");
    const standard = makeBondingCurve();
    const mayhem = makeBondingCurve({ isMayhemMode: true });
    expect(feeSupplyBasis(mayhem, reported).eq(reported)).toBe(true);
    expect(
      feesForCurve(global, feeConfig, mayhem, reported).protocolFeeBps.lt(
        feesForCurve(global, feeConfig, standard, reported).protocolFeeBps,
      ),
    ).toBe(true);
  });

  it("falls back to the global flat rates when there is no fee config", () => {
    const fees = feesForCurve(global, null, makeBondingCurve(), ONE_BILLION_SUPPLY);
    expect(fees.protocolFeeBps.eq(global.feeBasisPoints)).toBe(true);
    expect(fees.creatorFeeBps.eq(global.creatorFeeBasisPoints)).toBe(true);
  });

  it("charges a creator-owned curve more than the same curve without one", () => {
    const curve = makeBondingCurve({
      creator: new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
    });
    const withCreator = tradeFee({
      global,
      feeConfig,
      bondingCurve: curve,
      mintSupply: global.tokenTotalSupply,
      amount: SOL(1),
    });
    const creatorless = tradeFee({
      global,
      feeConfig,
      bondingCurve: { ...curve, creator: PublicKey.default },
      mintSupply: global.tokenTotalSupply,
      amount: SOL(1),
    });
    expect(withCreator.gt(creatorless)).toBe(true);
  });

  it("walks a curve from the entry tier into a cheaper one", () => {
    const ladder = curveFeeLadder(global, feeConfig, [
      global.initialVirtualSolReserves,
      new BN("90000000000"),
    ]);
    expect(ladder.length).toBe(2);
    expect(ladder[1]!.marketCap.gt(ladder[0]!.marketCap)).toBe(true);
    expect(
      ladder[1]!.fees.protocolFeeBps.lt(ladder[0]!.fees.protocolFeeBps),
    ).toBe(true);
  });
});

describe("example 18: fee recipients", () => {
  const global = makeGlobal();

  it("rebuilds both protocol pools from Global", () => {
    const pools = protocolRecipientPools(global);
    expect(pools.standard[0]!.equals(global.feeRecipient)).toBe(true);
    expect(pools.standard.length).toBe(1 + global.feeRecipients.length);
    expect(pools.mayhem[0]!.equals(global.reservedFeeRecipient)).toBe(true);
    expect(pools.mayhem.length).toBe(1 + global.reservedFeeRecipients.length);
  });

  it("draws the whole static recipient list and nothing outside it", () => {
    const draws = distinctDraws(getStaticRandomFeeRecipient, 400);
    expect(draws.length).toBe(8);
    for (const key of draws) {
      expect(isBreakingFeeRecipient(key)).toBe(false);
    }
  });

  it("draws all 8 breaking recipients and only those", () => {
    const draws = distinctDraws(pickBreakingFeeRecipient, 400);
    expect(draws.length).toBe(BREAKING_FEE_RECIPIENTS.length);
    for (const key of draws) {
      expect(isBreakingFeeRecipient(key)).toBe(true);
      expect(breakingRecipientIndex(key)).toBeGreaterThanOrEqual(0);
    }
  });

  it("reports -1 for an address outside the breaking list", () => {
    expect(breakingRecipientIndex(global.feeRecipient)).toBe(-1);
  });

  it("has a distinct WSOL ATA for every breaking recipient", () => {
    const atas = new Set(
      BREAKING_FEE_RECIPIENTS.map((r) => breakingRecipientWsolAta(r).toBase58()),
    );
    expect(atas.size).toBe(BREAKING_FEE_RECIPIENTS.length);
  });

  it("refuses to produce an ATA for a non-breaking recipient", () => {
    expect(() => breakingRecipientWsolAta(global.feeRecipient)).toThrow(
      /breaking fee recipient/,
    );
  });
});

describe("example 19: breaking fee validation", () => {
  it("builds a bonding curve buy that already carries the trailing account", async () => {
    const ix = await buildBcBuyInstruction();
    expect(ix.programId.equals(PUMP_PROGRAM_ID)).toBe(true);
    expect(ix.keys.length).toBe(18);
    const tail = ix.keys[ix.keys.length - 1]!;
    expect(isBreakingFeeRecipient(tail.pubkey)).toBe(true);
    expect(tail.isWritable).toBe(true);
    expect(tail.isSigner).toBe(false);
    expect(validateBcInstruction(ix, "buy").valid).toBe(true);
  });

  it("flags and repairs a pre-upgrade bonding curve buy", async () => {
    const ix = await buildBcBuyInstruction();
    const stale = dropTrailingAccounts(ix, 1);
    const repair = repairBcInstruction(stale, "buy");
    expect(repair.before.valid).toBe(false);
    expect(repair.before.errors.length).toBeGreaterThan(0);
    expect(repair.accountsBefore).toBe(17);
    expect(repair.accountsAfter).toBe(18);
    expect(repair.after.valid).toBe(true);
    // The patch is not in place: the stale instruction is unchanged.
    expect(stale.keys.length).toBe(17);
  });

  it("leaves an already-valid bonding curve instruction alone", async () => {
    const ix = await buildBcBuyInstruction();
    const repair = repairBcInstruction(ix, "buy");
    expect(repair.alreadyValid).toBe(true);
    expect(repair.patched).toBe(ix);
  });

  it("builds an AMM buy with the recipient and its ATA", async () => {
    const ix = await buildAmmBuyInstruction();
    expect(ix.programId.equals(PUMP_AMM_PROGRAM_ID)).toBe(true);
    expect(ix.keys.length).toBe(26);
    const recipient = ix.keys[ix.keys.length - 2]!;
    const ata = ix.keys[ix.keys.length - 1]!;
    expect(isBreakingFeeRecipient(recipient.pubkey)).toBe(true);
    expect(recipient.isWritable).toBe(false);
    expect(ata.isWritable).toBe(true);
    expect(
      ata.pubkey.equals(breakingRecipientWsolAta(recipient.pubkey)),
    ).toBe(true);
    expect(validateAmmInstruction(ix, "buy").valid).toBe(true);
  });

  it("flags and repairs a pre-upgrade AMM buy", async () => {
    const ix = await buildAmmBuyInstruction();
    const repair = repairAmmInstruction(dropTrailingAccounts(ix, 2), "buy");
    expect(repair.before.valid).toBe(false);
    expect(repair.accountsBefore).toBe(24);
    expect(repair.accountsAfter).toBe(26);
    expect(repair.after.valid).toBe(true);
  });

  it("leaves an already-valid AMM instruction alone", async () => {
    const ix = await buildAmmBuyInstruction();
    expect(repairAmmInstruction(ix, "buy").alreadyValid).toBe(true);
  });
});

describe("example 20: price impact", () => {
  const global = makeGlobal();
  const feeConfig = makeFeeConfig();
  const curve = makeBondingCurve();

  it("quotes a positive spot price on a fresh curve", () => {
    expect(spotPriceLamports(curve).gtn(0)).toBe(true);
  });

  it("grows monotonically with buy size", () => {
    const ladder = buildImpactLadder(global, feeConfig, curve, [
      new BN(100_000_000),
      SOL(1),
      SOL(5),
      SOL(10),
    ]);
    expect(ladder.length).toBe(4);
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i]!.impactBps.gt(ladder[i - 1]!.impactBps)).toBe(true);
      expect(ladder[i]!.tokensOut.gt(ladder[i - 1]!.tokensOut)).toBe(true);
    }
  });

  it("agrees with calculateBuyPriceImpact to within a basis point", () => {
    for (const solAmount of [new BN(100_000_000), SOL(1), SOL(10)]) {
      const measured = measureImpact({ global, feeConfig, bondingCurve: curve, solAmount });
      const drift = measured.impactBps.subn(measured.sdkImpactBps).abs();
      expect(drift.lten(1)).toBe(true);
    }
  });

  it("charges an effective price above spot", () => {
    const measured = measureImpact({
      global,
      feeConfig,
      bondingCurve: curve,
      solAmount: SOL(1),
    });
    expect(measured.effectivePriceLamports.gte(measured.spotPriceLamports)).toBe(
      true,
    );
    expect(measured.premiumOverSpotBps.gtn(0)).toBe(true);
  });

  it("moves the same order less on deeper reserves", () => {
    const deep = makeBondingCurve({
      virtualQuoteReserves: SOL(90),
      virtualTokenReserves: new BN("357666666666666"),
    });
    const shallow = measureImpact({
      global,
      feeConfig,
      bondingCurve: curve,
      solAmount: SOL(5),
    });
    const deeper = measureImpact({
      global,
      feeConfig,
      bondingCurve: deep,
      solAmount: SOL(5),
    });
    expect(deeper.impactBps.lt(shallow.impactBps)).toBe(true);
  });

  it("refuses a buy that would consume the whole curve", () => {
    expect(() =>
      priceImpactBps(curve, SOL(1), curve.virtualTokenReserves),
    ).toThrow(/unbounded/);
  });
});

describe("example 21: PDA table", () => {
  const inputs = exampleInputs();
  const table = buildPdaTable(inputs);

  it("covers every group", () => {
    for (const group of ["curve", "amm", "fees", "mayhem", "volume"] as const) {
      expect(pdasInGroup(table, group).length).toBeGreaterThan(0);
    }
  });

  it("derives distinct addresses for distinct helpers", () => {
    const addresses = new Set(table.map((entry) => entry.address.toBase58()));
    expect(addresses.size).toBe(table.length);
  });

  it("matches direct findProgramAddressSync derivations", () => {
    const expected: Array<[string, PublicKey]> = [
      [
        "GLOBAL_PDA",
        PublicKey.findProgramAddressSync(
          [Buffer.from("global")],
          PUMP_PROGRAM_ID,
        )[0],
      ],
      [
        "bondingCurvePda(mint)",
        PublicKey.findProgramAddressSync(
          [Buffer.from("bonding-curve"), inputs.mint.toBuffer()],
          PUMP_PROGRAM_ID,
        )[0],
      ],
      [
        "bondingCurveV2Pda(mint)",
        PublicKey.findProgramAddressSync(
          [Buffer.from("bonding-curve-v2"), inputs.mint.toBuffer()],
          PUMP_PROGRAM_ID,
        )[0],
      ],
      [
        "creatorVaultPda(creator)",
        PublicKey.findProgramAddressSync(
          [Buffer.from("creator-vault"), inputs.creator.toBuffer()],
          PUMP_PROGRAM_ID,
        )[0],
      ],
      [
        "userVolumeAccumulatorPda(user)",
        PublicKey.findProgramAddressSync(
          [Buffer.from("user_volume_accumulator"), inputs.user.toBuffer()],
          PUMP_PROGRAM_ID,
        )[0],
      ],
      [
        "poolV2Pda(mint)",
        PublicKey.findProgramAddressSync(
          [Buffer.from("pool-v2"), inputs.mint.toBuffer()],
          PUMP_AMM_PROGRAM_ID,
        )[0],
      ],
      [
        "ammCreatorVaultPda(creator)",
        PublicKey.findProgramAddressSync(
          [Buffer.from("creator_vault"), inputs.creator.toBuffer()],
          PUMP_AMM_PROGRAM_ID,
        )[0],
      ],
      [
        "feeSharingConfigPda(mint)",
        PublicKey.findProgramAddressSync(
          [Buffer.from("sharing-config"), inputs.mint.toBuffer()],
          PUMP_FEE_PROGRAM_ID,
        )[0],
      ],
      [
        "getMayhemStatePda(mint)",
        PublicKey.findProgramAddressSync(
          [Buffer.from("mayhem-state"), inputs.mint.toBuffer()],
          MAYHEM_PROGRAM_ID,
        )[0],
      ],
    ];

    expect(expected.length).toBeGreaterThanOrEqual(5);
    for (const [name, address] of expected) {
      const entry = table.find((candidate) => candidate.name === name);
      expect(entry).toBeDefined();
      expect(entry!.address.toBase58()).toBe(address.toBase58());
    }
  });

  it("derives a different event authority per program", () => {
    const authorities = table
      .filter((entry) => entry.seeds[0] === "__event_authority")
      .map((entry) => entry.address.toBase58());
    expect(authorities.length).toBe(3);
    expect(new Set(authorities).size).toBe(3);
  });
});

describe("example 22: interpret Global", () => {
  const global = makeGlobal();

  it("derives the graduation point from the launch reserves", () => {
    const report = interpretGlobal(global);
    // k / (vTok0 - realTok0) with the mainnet parameters lands near 115 SOL.
    expect(report.graduationVirtualSol.gt(global.initialVirtualSolReserves)).toBe(
      true,
    );
    expect(
      report.solRaisedAtGraduation.eq(
        report.graduationVirtualSol.sub(global.initialVirtualSolReserves),
      ),
    ).toBe(true);
  });

  it("grows the market cap from launch to graduation", () => {
    const report = interpretGlobal(global);
    expect(report.launchMarketCap.gtn(0)).toBe(true);
    expect(report.graduationMarketCap.gt(report.launchMarketCap)).toBe(true);
  });

  it("splits supply into saleable and pool-reserved halves that add up", () => {
    const report = interpretGlobal(global);
    expect(
      report.saleableTokens.add(report.reservedForMigration).eq(
        global.tokenTotalSupply,
      ),
    ).toBe(true);
  });

  it("counts both recipient pools including their primary entry", () => {
    const report = interpretGlobal(global);
    expect(report.standardFeeRecipientCount).toBe(1 + global.feeRecipients.length);
    expect(report.mayhemFeeRecipientCount).toBe(
      1 + global.reservedFeeRecipients.length,
    );
  });

  it("sums the flat rates and mirrors the feature switches", () => {
    const report = interpretGlobal(
      makeGlobal({ mayhemModeEnabled: true, enableMigrate: false }),
    );
    expect(
      report.flatTotalFeeBps.eq(
        global.feeBasisPoints.add(global.creatorFeeBasisPoints),
      ),
    ).toBe(true);
    expect(report.mayhemModeEnabled).toBe(true);
    expect(report.migrationEnabled).toBe(false);
  });
});

describe("example 23: decode a bonding curve", () => {
  const initialReal = new BN("793100000000000");

  it("classifies a created-but-untraded curve as fresh", () => {
    expect(curveStatus(makeBondingCurve())).toBe("fresh");
  });

  it("classifies a traded curve as active", () => {
    expect(
      curveStatus(
        makeBondingCurve({
          realQuoteReserves: SOL(10),
          virtualQuoteReserves: SOL(40),
          realTokenReserves: new BN("500000000000000"),
        }),
      ),
    ).toBe("active");
  });

  it("classifies a graduated curve as complete", () => {
    expect(curveStatus(makeGraduatedBondingCurve())).toBe("complete");
  });

  it("classifies a migrated curve as complete even before reading the flag", () => {
    const migrated = { ...makeMigratedBondingCurve(), complete: false };
    expect(curveStatus(migrated)).toBe("complete");
  });

  it("reports progress in basis points of the saleable supply", () => {
    const fresh = curveReport(makeBondingCurve(), initialReal);
    expect(fresh.soldBps.isZero()).toBe(true);
    expect(fresh.hasCreator).toBe(false);

    const halfway = curveReport(
      makeBondingCurve({
        realQuoteReserves: SOL(20),
        realTokenReserves: initialReal.divn(2),
        creator: new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
      }),
      initialReal,
    );
    expect(halfway.soldBps.toNumber()).toBe(5000);
    expect(halfway.hasCreator).toBe(true);
    expect(halfway.spotPriceLamports.gtn(0)).toBe(true);
  });

  it("prices a migrated curve at zero instead of dividing by zero", () => {
    const report = curveReport(makeMigratedBondingCurve(), initialReal);
    expect(report.spotPriceLamports.isZero()).toBe(true);
    expect(report.status).toBe("complete");
  });

  it("round-trips through the on-chain byte layout", () => {
    const curve = makeBondingCurve({
      realQuoteReserves: SOL(7),
      creator: new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
      isMayhemMode: true,
    });
    const data = encodeBondingCurveAccount(curve);
    expect(data.length).toBe(BONDING_CURVE_DATA_LEN);

    const decoded = PUMP_SDK.decodeBondingCurve(
      curveAccountInfo(data, PUMP_PROGRAM_ID),
    );
    expect(decoded.virtualQuoteReserves.eq(curve.virtualQuoteReserves)).toBe(true);
    expect(decoded.virtualTokenReserves.eq(curve.virtualTokenReserves)).toBe(true);
    expect(decoded.realQuoteReserves.eq(curve.realQuoteReserves)).toBe(true);
    expect(decoded.creator.equals(curve.creator)).toBe(true);
    expect(decoded.isMayhemMode).toBe(true);
    expect(decoded.complete).toBe(false);
  });

  it("returns null rather than throwing on a truncated account", () => {
    const data = encodeBondingCurveAccount(makeBondingCurve());
    const truncated = curveAccountInfo(
      Buffer.from(data.subarray(0, 49)),
      PUMP_PROGRAM_ID,
    );
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(PUMP_SDK.decodeBondingCurveNullable(truncated)).toBeNull();
      expect(() => PUMP_SDK.decodeBondingCurve(truncated)).toThrow();
    } finally {
      warn.mockRestore();
    }
  });

  it("returns null for an account that is not a bonding curve at all", () => {
    const foreign = curveAccountInfo(
      Buffer.concat([
        Keypair.generate().publicKey.toBuffer(),
        Buffer.alloc(BONDING_CURVE_DATA_LEN),
      ]),
      PUMP_PROGRAM_ID,
    );
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(PUMP_SDK.decodeBondingCurveNullable(foreign)).toBeNull();
    } finally {
      warn.mockRestore();
    }
  });
});

describe("example 24: interpret a fee config", () => {
  const feeConfig = makeFeeConfig();

  it("pairs every tier with the next threshold to form bands", () => {
    const report = interpretFeeConfig(feeConfig);
    expect(report.tierCount).toBe(feeConfig.feeTiers.length);
    expect(report.bands.length).toBe(feeConfig.feeTiers.length);
    for (let i = 0; i < report.bands.length - 1; i += 1) {
      expect(report.bands[i]!.toMarketCap).not.toBeNull();
      expect(
        report.bands[i]!.toMarketCap!.eq(report.bands[i + 1]!.fromMarketCap),
      ).toBe(true);
    }
    expect(report.bands[report.bands.length - 1]!.toMarketCap).toBeNull();
  });

  it("sums each band's components into its all-in rate", () => {
    for (const band of interpretFeeConfig(feeConfig).bands) {
      expect(
        band.protocolFeeBps
          .add(band.creatorFeeBps)
          .add(band.lpFeeBps)
          .eq(band.totalBps),
      ).toBe(true);
    }
  });

  it("detects a tiered config and its ordering", () => {
    const report = interpretFeeConfig(feeConfig);
    expect(report.flatInPractice).toBe(false);
    expect(report.thresholdsAscending).toBe(true);
    expect(report.entryFees.protocolFeeBps.gt(report.topFees.protocolFeeBps)).toBe(
      true,
    );
  });

  it("detects a single-tier config as flat in practice", () => {
    const single = interpretFeeConfig({
      ...feeConfig,
      feeTiers: [feeConfig.feeTiers[0]!],
    });
    expect(single.flatInPractice).toBe(true);
    expect(single.bands[0]!.toMarketCap).toBeNull();
  });

  it("flags an out-of-order tier list", () => {
    const reversed = interpretFeeConfig({
      ...feeConfig,
      feeTiers: [...feeConfig.feeTiers].reverse(),
    });
    expect(reversed.thresholdsAscending).toBe(false);
  });

  it("refuses a config with no tiers, which would break every quote", () => {
    expect(() => interpretFeeConfig({ ...feeConfig, feeTiers: [] })).toThrow(
      /no tiers/,
    );
  });
});
