import pumpAmmIdlJson from "./idl/pump_amm.json";
import pumpIdlJson from "./idl/pump.json";
import pumpFeesIdlJson from "./idl/pump_fees.json";

export type { Pump } from "./idl/pump";
export type { PumpFees } from "./idl/pump_fees";
export type { PumpAmm } from "./idl/pump_amm";

// The IDLs are re-exported through `const` bindings rather than
// `export { default } from "./idl/*.json"`: the declaration bundler cannot
// follow a re-export out of a JSON module, while a `const` makes `tsc` inline
// the JSON's type into the emitted `.d.ts`.

/** Raw Anchor IDL of the Pump bonding-curve program. */
export const pumpIdl = pumpIdlJson;
/** Alias of {@link pumpIdl}. */
export const PumpIdl = pumpIdlJson;
/** Raw Anchor IDL of the PumpAMM program. */
export const PumpAmmIdl = pumpAmmIdlJson;
/** Raw Anchor IDL of the PumpFees program. */
export const PumpFeesIdl = pumpFeesIdlJson;
export {
  getBuyTokenAmountFromSolAmount,
  getBuySolAmountFromTokenAmount,
  getSellSolAmountFromTokenAmount,
  getTokenAmountForTargetSol,
  newBondingCurve,
  initialVirtualQuoteReservesFor,
  bondingCurveMarketCap,
  getStaticRandomFeeRecipient,
  maxSafeSellAmount,
  validateSellAmount,
  getBuyV3QuoteAmountFromTokenAmount,
  getBuyV3TokenAmountFromQuoteAmount,
  isBondingCurveMigrated,
  pumpQuoteAdmission,
  pumpQuoteReserves,
} from "./bondingCurve";
export type { PumpQuoteCurve } from "./bondingCurve";
export * from "./pda";
export {
  getPumpProgram,
  getPumpAmmProgram,
  getPumpFeeProgram,
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
  MAYHEM_PROGRAM_ID,
  BONDING_CURVE_NEW_SIZE,
  BONDING_CURVE_SIZE,
  BONDING_CURVE_INITIALIZE_SIZE,
  GLOBAL_SIZE,
  FEE_CONFIG_INITIALIZE_SIZE,
  FEE_CONFIG_POST_STABLE_SIZE,
  FEE_CONFIG_CURRENT_SIZE,
  POOL_SIZE,
  AMM_GLOBAL_CONFIG_SIZE,
  createV2QuoteRemainingAccounts,
  tradeV2Accounts,
  tradeV3Accounts,
  ammTradeV2Accounts,
  multiHopRouteEnds,
  multiHopHopAccounts,
  PumpSdk,
  PUMP_SDK,
  isCreatorUsingSharingConfig,
  isSharingConfigEditable,
  normalizeSocialShareholders,
  PUMP_TOKEN_MINT,
  MAX_SHAREHOLDERS,
} from "./sdk";
export type {
  SocialShareholderInput,
  PumpQuoteAccounts,
  MultiHopHop,
  MultiHopSide,
  MultiHopCurveSwapCall,
  MintWithProgram,
} from "./sdk";
export {
  getFee,
  getFeeRecipient,
  computeFeesBps,
  calculateFeeTier,
  selectCurveFeeSchedule,
  SOL_LIKE_QUOTE_MINTS,
  STABLE_QUOTE_MINTS,
  isSolLikeQuoteMint,
  isStableQuoteMint,
  isExoticQuoteMint,
  getStaticRandomFeeRecipientForBuyback,
  getBuybackFeeRecipientForTokenQuote,
  ONE_BILLION_SUPPLY,
  BREAKING_FEE_RECIPIENTS,
  BREAKING_FEE_RECIPIENT_WSOL_ATAS,
  isBreakingFeeRecipient,
  pickBreakingFeeRecipient,
  buildAmmBreakingFeeRecipientAccounts,
  validateBcInstruction,
  validateAmmInstruction,
  patchBcInstruction,
  patchAmmInstruction,
} from "./fees";
export type { CalculatedFeesBps, BreakingFeeValidation } from "./fees";
export {
  OnlinePumpSdk,
  parsePumpEventsFromLogs,
  poolQuoteTerms,
  MinimumDistributableFeeResult,
  DistributeCreatorFeeResult,
} from "./onlineSdk";
export type {
  AmmBuyQuote,
  AmmSellQuote,
  BuyQuote,
  PumpEvent,
  SellQuote,
  DepositBaseResult,
  DepositQuoteResult,
  WithdrawResult,
  WithdrawAutocompleteResult,
  DepositQuoteAndLpTokenFromBaseResult,
  DepositBaseAndLpTokenFromQuoteResult,
} from "./onlineSdk";
export {
  FeeConfig,
  Global,
  BondingCurve,
  GlobalVolumeAccumulator,
  UserVolumeAccumulator,
  UserVolumeAccumulatorTotalStats,
  Shareholder,
  SharingConfig,
  DistributeCreatorFeesEvent,
  MinimumDistributableFeeEvent,
  Pool,
  AmmGlobalConfig,
  FeeProgramGlobal,
  SocialFeePda,
  TradeEvent,
  CreateEvent,
  CompleteEvent,
  CompletePumpAmmMigrationEvent,
  SetCreatorEvent,
  CollectCreatorFeeEvent,
  ClaimTokenIncentivesEvent,
  ClaimCashbackEvent,
  ExtendAccountEvent,
  InitUserVolumeAccumulatorEvent,
  SyncUserVolumeAccumulatorEvent,
  CloseUserVolumeAccumulatorEvent,
  AdminSetCreatorEvent,
  AdminCtoEvent,
  DistributeFeeToHoldersEvent,
  MigrateBondingCurveCreatorEvent,
  AmmBuyEvent,
  AmmSellEvent,
  DepositEvent,
  WithdrawEvent,
  CreatePoolEvent,
  CreateFeeSharingConfigEvent,
  UpdateFeeSharesEvent,
  ResetFeeSharingConfigEvent,
  SocialFeePdaCreatedEvent,
  SocialFeePdaClaimedEvent,
  QuoteControl,
  QuoteControlMint,
  PostCompleteBuyEvent,
  SweepFeeBucket,
  SweepBondingCurveFeeEvent,
  SweepPoolFeeEvent,
  AmmAdminUpdateTokenIncentivesEvent,
  AmmClaimCashbackEvent,
  AmmClaimTokenIncentivesEvent,
  AmmCloseUserVolumeAccumulatorEvent,
  AmmCollectCoinCreatorFeeEvent,
  AmmCreateConfigEvent,
  AmmDisableEvent,
  AmmExtendAccountEvent,
  AmmInitUserVolumeAccumulatorEvent,
  AmmMigratePoolCoinCreatorEvent,
  AmmReservedFeeRecipientsEvent,
  AmmSetBondingCurveCoinCreatorEvent,
  AmmSetMetaplexCoinCreatorEvent,
  AmmSyncUserVolumeAccumulatorEvent,
  AmmUpdateAdminEvent,
  AmmUpdateFeeConfigEvent,
  FeesInitializeFeeConfigEvent,
  FeesInitializeFeeProgramGlobalEvent,
  FeesSetAuthorityEvent,
  FeesSetClaimRateLimitEvent,
  FeesSetDisableFlagsEvent,
  FeesSetSocialClaimAuthorityEvent,
  FeesUpdateAdminEvent,
  FeesUpdateFeeConfigEvent,
  FeesUpsertFeeTiersEvent,
  Platform,
  SUPPORTED_SOCIAL_PLATFORMS,
  platformToString,
  stringToPlatform,
} from "./state";
export type { Fees, FeeTier } from "./state";
export { totalUnclaimedTokens, currentDayTokens } from "./tokenIncentives";
export * from "./errors";
export {
  calculateBuyPriceImpact,
  calculateSellPriceImpact,
  getGraduationProgress,
  bondingCurveGraduationProgress,
  INITIAL_REAL_TOKEN_RESERVES,
  getTokenPrice,
  getBondingCurveSummary,
} from "./analytics";
export {
  generateVanityMint,
  estimateVanityMintAttempts,
  VanityError,
  VanityErrorType,
  VanityMintPatternError,
  VanityMintMaxAttemptsError,
  BASE58_ALPHABET,
  MAX_VANITY_PATTERN_LENGTH,
} from "./vanityMint";
export type {
  VanityMintOptions,
  VanityMintResult,
  VanityMintProgress,
} from "./vanityMint";
export type {
  PriceImpactResult,
  GraduationProgress,
  TokenPriceInfo,
  BondingCurveSummary,
} from "./analytics";
export {
  createFallbackConnection,
  fetchWithFallback,
  parseEndpoints,
} from "./fallback";
export type { FallbackConfig } from "./fallback";

