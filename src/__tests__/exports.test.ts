/**
 * Smoke test: verifies that all expected public exports exist.
 * Prevents accidental removal of public API surface.
 */
import * as sdk from "../index";

describe("public API exports", () => {
  // ── IDL ────────────────────────────────────────────────────────────

  it("exports Pump IDL type and JSON", () => {
    // Pump is a type-only export (interface), only pumpIdl is a runtime value
    expect(sdk.pumpIdl).toBeDefined();
  });

  // ── Bonding curve functions ────────────────────────────────────────

  it("exports bonding curve functions", () => {
    expect(typeof sdk.getBuyTokenAmountFromSolAmount).toBe("function");
    expect(typeof sdk.getBuySolAmountFromTokenAmount).toBe("function");
    expect(typeof sdk.getSellSolAmountFromTokenAmount).toBe("function");
    expect(typeof sdk.newBondingCurve).toBe("function");
    expect(typeof sdk.bondingCurveMarketCap).toBe("function");
    expect(typeof sdk.getStaticRandomFeeRecipient).toBe("function");
  });

  // ── Fee functions ──────────────────────────────────────────────────

  it("exports fee functions", () => {
    expect(typeof sdk.getFee).toBe("function");
    expect(typeof sdk.computeFeesBps).toBe("function");
    expect(typeof sdk.calculateFeeTier).toBe("function");
    expect(sdk.ONE_BILLION_SUPPLY).toBeDefined();
  });

  // ── SDK classes & singletons ───────────────────────────────────────

  it("exports PumpSdk and PUMP_SDK", () => {
    expect(sdk.PumpSdk).toBeDefined();
    expect(sdk.PUMP_SDK).toBeDefined();
    expect(sdk.PUMP_SDK).toBeInstanceOf(sdk.PumpSdk);
  });

  it("exports OnlinePumpSdk", () => {
    expect(sdk.OnlinePumpSdk).toBeDefined();
  });

  // ── Program IDs ────────────────────────────────────────────────────

  it("exports program IDs", () => {
    expect(sdk.PUMP_PROGRAM_ID).toBeDefined();
    expect(sdk.PUMP_AMM_PROGRAM_ID).toBeDefined();
    expect(sdk.PUMP_FEE_PROGRAM_ID).toBeDefined();
    expect(sdk.MAYHEM_PROGRAM_ID).toBeDefined();
  });

  // ── Program factories ──────────────────────────────────────────────

  it("exports program factory functions", () => {
    expect(typeof sdk.getPumpProgram).toBe("function");
    expect(typeof sdk.getPumpAmmProgram).toBe("function");
    expect(typeof sdk.getPumpFeeProgram).toBe("function");
  });

  // ── SDK constants ──────────────────────────────────────────────────

  it("exports SDK constants", () => {
    expect(sdk.BONDING_CURVE_NEW_SIZE).toBeDefined();
    expect(sdk.PUMP_TOKEN_MINT).toBeDefined();
    expect(sdk.MAX_SHAREHOLDERS).toBeDefined();
  });

  // ── Utility functions ──────────────────────────────────────────────

  it("exports isCreatorUsingSharingConfig", () => {
    expect(typeof sdk.isCreatorUsingSharingConfig).toBe("function");
  });

  // ── PDA helpers ────────────────────────────────────────────────────

  it("exports all PDA helpers", () => {
    expect(typeof sdk.bondingCurvePda).toBe("function");
    expect(typeof sdk.bondingCurveV2Pda).toBe("function");
    expect(typeof sdk.creatorVaultPda).toBe("function");
    expect(typeof sdk.pumpPoolAuthorityPda).toBe("function");
    expect(typeof sdk.canonicalPumpPoolPda).toBe("function");
    expect(typeof sdk.userVolumeAccumulatorPda).toBe("function");
    expect(typeof sdk.feeSharingConfigPda).toBe("function");
    expect(typeof sdk.ammCreatorVaultPda).toBe("function");
    expect(typeof sdk.feeProgramGlobalPda).toBe("function");
    expect(typeof sdk.socialFeePda).toBe("function");
    expect(typeof sdk.ammUserVolumeAccumulatorPda).toBe("function");
    expect(typeof sdk.poolV2Pda).toBe("function");
    expect(typeof sdk.getEventAuthorityPda).toBe("function");
    expect(typeof sdk.getGlobalParamsPda).toBe("function");
    expect(typeof sdk.getMayhemStatePda).toBe("function");
    expect(typeof sdk.getSolVaultPda).toBe("function");
    expect(typeof sdk.getTokenVaultPda).toBe("function");
  });

  it("exports static PDA constants", () => {
    expect(sdk.GLOBAL_PDA).toBeDefined();
    expect(sdk.AMM_GLOBAL_PDA).toBeDefined();
    expect(sdk.PUMP_FEE_CONFIG_PDA).toBeDefined();
    expect(sdk.GLOBAL_VOLUME_ACCUMULATOR_PDA).toBeDefined();
    expect(sdk.AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA).toBeDefined();
    expect(sdk.PUMP_EVENT_AUTHORITY_PDA).toBeDefined();
    expect(sdk.PUMP_AMM_EVENT_AUTHORITY_PDA).toBeDefined();
    expect(sdk.PUMP_FEE_EVENT_AUTHORITY_PDA).toBeDefined();
    expect(sdk.AMM_FEE_CONFIG_PDA).toBeDefined();
    expect(sdk.AMM_GLOBAL_CONFIG_PDA).toBeDefined();
  });

  // ── Platform ───────────────────────────────────────────────────────

  it("exports Platform enum and helpers", () => {
    expect(sdk.Platform).toBeDefined();
    expect(sdk.Platform.GitHub).toBe(2);
    expect(sdk.SUPPORTED_SOCIAL_PLATFORMS).toBeDefined();
    expect(typeof sdk.platformToString).toBe("function");
    expect(typeof sdk.stringToPlatform).toBe("function");
  });

  // ── State types (runtime check for enum/const exports) ─────────────

  it("exports token incentive functions", () => {
    expect(typeof sdk.totalUnclaimedTokens).toBe("function");
    expect(typeof sdk.currentDayTokens).toBe("function");
  });

  // ── Analytics ──────────────────────────────────────────────────────

  it("exports analytics functions", () => {
    expect(typeof sdk.calculateBuyPriceImpact).toBe("function");
    expect(typeof sdk.calculateSellPriceImpact).toBe("function");
    expect(typeof sdk.getGraduationProgress).toBe("function");
    expect(typeof sdk.getTokenPrice).toBe("function");
    expect(typeof sdk.getBondingCurveSummary).toBe("function");
  });

  // ── Online SDK result types ────────────────────────────────────────

  it("exports online SDK class", () => {
    // MinimumDistributableFeeResult and DistributeCreatorFeeResult are type-only exports (interfaces)
    expect(sdk.OnlinePumpSdk).toBeDefined();
  });
});
