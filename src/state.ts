import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/**
 * Platform identifiers for social handle mappings.
 */
export enum Platform {
  Pump = 0,
  X = 1,
  GitHub = 2,
}

export const SUPPORTED_SOCIAL_PLATFORMS = [Platform.GitHub];

export const stringToPlatform = (value: string): Platform => {
  const normalized = value.trim().toUpperCase();
  const entry = Object.entries(Platform).find(
    ([key, val]) => typeof val === "number" && key.toUpperCase() === normalized,
  );
  if (entry) {
    return entry[1] as Platform;
  }
  const validNames = Object.entries(Platform)
    .filter(([, val]) => typeof val === "number")
    .map(([key]) => key.toUpperCase())
    .join(", ");
  throw new Error(
    `Unknown platform "${value}". Expected one of: ${validNames}`,
  );
};

export const platformToString = (platform: Platform): string => {
  const name = Platform[platform];
  if (name !== undefined) {
    return name;
  }
  throw new Error(`Unknown platform value: ${platform}`);
};

export interface Global {
  // unused
  initialized: boolean;
  authority: PublicKey;
  feeRecipient: PublicKey;
  initialVirtualTokenReserves: BN;
  initialVirtualSolReserves: BN;
  initialRealTokenReserves: BN;
  tokenTotalSupply: BN;
  feeBasisPoints: BN;
  withdrawAuthority: PublicKey;
  // Unused
  enableMigrate: boolean;
  poolMigrationFee: BN;
  creatorFeeBasisPoints: BN;
  feeRecipients: PublicKey[];
  setCreatorAuthority: PublicKey;
  adminSetCreatorAuthority: PublicKey;
  createV2Enabled: boolean;
  whitelistPda: PublicKey;
  reservedFeeRecipient: PublicKey;
  mayhemModeEnabled: boolean;
  reservedFeeRecipients: PublicKey[];
}

export interface BondingCurve {
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
  realTokenReserves: BN;
  realSolReserves: BN;
  tokenTotalSupply: BN;
  complete: boolean;
  creator: PublicKey;
  isMayhemMode: boolean;
  isCashbackCoin: boolean;
}

export interface GlobalVolumeAccumulator {
  startTime: BN;
  endTime: BN;
  secondsInADay: BN;
  mint: PublicKey;
  totalTokenSupply: BN[];
  solVolumes: BN[];
}

export interface UserVolumeAccumulator {
  user: PublicKey;
  needsClaim: boolean;
  totalUnclaimedTokens: BN;
  totalClaimedTokens: BN;
  currentSolVolume: BN;
  lastUpdateTimestamp: BN;
}

export interface UserVolumeAccumulatorTotalStats {
  totalUnclaimedTokens: BN;
  totalClaimedTokens: BN;
  currentSolVolume: BN;
}

export interface FeeConfig {
  admin: PublicKey;
  flatFees: Fees;
  feeTiers: FeeTier[];
}

export interface FeeTier {
  marketCapLamportsThreshold: BN;
  fees: Fees;
}

export interface Fees {
  lpFeeBps: BN;
  protocolFeeBps: BN;
  creatorFeeBps: BN;
}

export interface Shareholder {
  address: PublicKey;
  shareBps: number;
}

export interface SharingConfig {
  version: number;
  mint: PublicKey;
  admin: PublicKey;
  adminRevoked: boolean;
  shareholders: Shareholder[];
}

export interface DistributeCreatorFeesEvent {
  timestamp: BN;
  mint: PublicKey;
  sharingConfig: PublicKey;
  admin: PublicKey;
  shareholders: Shareholder[];
  distributed: BN;
}

export interface MinimumDistributableFeeEvent {
  minimumRequired: BN;
  distributableFees: BN;
  canDistribute: boolean;
}

// ─── AMM Account Types ─────────────────────────────────────────────────────

export interface Pool {
  poolBump: number;
  index: number;
  creator: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  lpMint: PublicKey;
  poolBaseTokenAccount: PublicKey;
  poolQuoteTokenAccount: PublicKey;
  lpSupply: BN;
  coinCreator: PublicKey;
  isMayhemMode: boolean;
  isCashbackCoin: boolean;
}

export interface AmmGlobalConfig {
  admin: PublicKey;
  lpFeeBasisPoints: BN;
  protocolFeeBasisPoints: BN;
  disableFlags: number;
  protocolFeeRecipients: PublicKey[];
  coinCreatorFeeBasisPoints: BN;
  adminSetCoinCreatorAuthority: PublicKey;
  whitelistPda: PublicKey;
  reservedFeeRecipient: PublicKey;
  mayhemModeEnabled: boolean;
  reservedFeeRecipients: PublicKey[];
  isCashbackEnabled: boolean;
}

// ─── PumpFees Account Types ─────────────────────────────────────────────────

export interface FeeProgramGlobal {
  bump: number;
  authority: PublicKey;
  disableFlags: number;
  socialClaimAuthority: PublicKey;
  claimRateLimit: BN;
}

export interface SocialFeePda {
  bump: number;
  version: number;
  userId: string;
  platform: number;
  totalClaimed: BN;
  lastClaimed: BN;
}

// ─── Event Types ────────────────────────────────────────────────────────────

// Pump Program Events

export interface TradeEvent {
  mint: PublicKey;
  solAmount: BN;
  tokenAmount: BN;
  isBuy: boolean;
  user: PublicKey;
  timestamp: BN;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
  realSolReserves: BN;
  realTokenReserves: BN;
  feeRecipient: PublicKey;
  feeBasisPoints: BN;
  fee: BN;
  creator: PublicKey;
  creatorFeeBasisPoints: BN;
  creatorFee: BN;
  trackVolume: boolean;
  totalUnclaimedTokens: BN;
  totalClaimedTokens: BN;
  currentSolVolume: BN;
  lastUpdateTimestamp: BN;
  ixName: string;
  mayhemMode: boolean;
  cashbackFeeBasisPoints: BN;
  cashback: BN;
}

export interface CreateEvent {
  name: string;
  symbol: string;
  uri: string;
  mint: PublicKey;
  bondingCurve: PublicKey;
  user: PublicKey;
  creator: PublicKey;
  timestamp: BN;
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
  realTokenReserves: BN;
  tokenTotalSupply: BN;
  tokenProgram: PublicKey;
  isMayhemMode: boolean;
  isCashbackEnabled: boolean;
}

export interface CompleteEvent {
  user: PublicKey;
  mint: PublicKey;
  bondingCurve: PublicKey;
  timestamp: BN;
}

export interface CompletePumpAmmMigrationEvent {
  user: PublicKey;
  mint: PublicKey;
  mintAmount: BN;
  solAmount: BN;
  poolMigrationFee: BN;
  bondingCurve: PublicKey;
  timestamp: BN;
  pool: PublicKey;
}

export interface SetCreatorEvent {
  timestamp: BN;
  mint: PublicKey;
  bondingCurve: PublicKey;
  creator: PublicKey;
}

export interface CollectCreatorFeeEvent {
  timestamp: BN;
  creator: PublicKey;
  creatorFee: BN;
}

export interface ClaimTokenIncentivesEvent {
  user: PublicKey;
  mint: PublicKey;
  amount: BN;
  timestamp: BN;
  totalClaimedTokens: BN;
  currentSolVolume: BN;
}

export interface ClaimCashbackEvent {
  user: PublicKey;
  amount: BN;
  timestamp: BN;
  totalClaimed: BN;
  totalCashbackEarned: BN;
}

export interface ExtendAccountEvent {
  account: PublicKey;
  user: PublicKey;
  currentSize: BN;
  newSize: BN;
  timestamp: BN;
}

export interface InitUserVolumeAccumulatorEvent {
  payer: PublicKey;
  user: PublicKey;
  timestamp: BN;
}

export interface SyncUserVolumeAccumulatorEvent {
  user: PublicKey;
  totalClaimedTokensBefore: BN;
  totalClaimedTokensAfter: BN;
  timestamp: BN;
}

export interface CloseUserVolumeAccumulatorEvent {
  user: PublicKey;
  timestamp: BN;
  totalUnclaimedTokens: BN;
  totalClaimedTokens: BN;
  currentSolVolume: BN;
  lastUpdateTimestamp: BN;
}

export interface AdminSetCreatorEvent {
  timestamp: BN;
  adminSetCreatorAuthority: PublicKey;
  mint: PublicKey;
  bondingCurve: PublicKey;
  oldCreator: PublicKey;
  newCreator: PublicKey;
}

export interface MigrateBondingCurveCreatorEvent {
  timestamp: BN;
  mint: PublicKey;
  bondingCurve: PublicKey;
  sharingConfig: PublicKey;
  oldCreator: PublicKey;
  newCreator: PublicKey;
}

// PumpAMM Events

export interface AmmBuyEvent {
  timestamp: BN;
  baseAmountOut: BN;
  maxQuoteAmountIn: BN;
  userBaseTokenReserves: BN;
  userQuoteTokenReserves: BN;
  poolBaseTokenReserves: BN;
  poolQuoteTokenReserves: BN;
  quoteAmountIn: BN;
  lpFeeBasisPoints: BN;
  lpFee: BN;
  protocolFeeBasisPoints: BN;
  protocolFee: BN;
  quoteAmountInWithLpFee: BN;
  userQuoteAmountIn: BN;
  pool: PublicKey;
  user: PublicKey;
  userBaseTokenAccount: PublicKey;
  userQuoteTokenAccount: PublicKey;
  protocolFeeRecipient: PublicKey;
  protocolFeeRecipientTokenAccount: PublicKey;
  coinCreator: PublicKey;
  coinCreatorFeeBasisPoints: BN;
  coinCreatorFee: BN;
  trackVolume: boolean;
  totalUnclaimedTokens: BN;
  totalClaimedTokens: BN;
  currentSolVolume: BN;
  lastUpdateTimestamp: BN;
  minBaseAmountOut: BN;
  ixName: string;
  cashbackFeeBasisPoints: BN;
  cashback: BN;
}

export interface AmmSellEvent {
  timestamp: BN;
  baseAmountIn: BN;
  minQuoteAmountOut: BN;
  userBaseTokenReserves: BN;
  userQuoteTokenReserves: BN;
  poolBaseTokenReserves: BN;
  poolQuoteTokenReserves: BN;
  quoteAmountOut: BN;
  lpFeeBasisPoints: BN;
  lpFee: BN;
  protocolFeeBasisPoints: BN;
  protocolFee: BN;
  quoteAmountOutWithoutLpFee: BN;
  userQuoteAmountOut: BN;
  pool: PublicKey;
  user: PublicKey;
  userBaseTokenAccount: PublicKey;
  userQuoteTokenAccount: PublicKey;
  protocolFeeRecipient: PublicKey;
  protocolFeeRecipientTokenAccount: PublicKey;
  coinCreator: PublicKey;
  coinCreatorFeeBasisPoints: BN;
  coinCreatorFee: BN;
  cashbackFeeBasisPoints: BN;
  cashback: BN;
}

export interface DepositEvent {
  timestamp: BN;
  lpTokenAmountOut: BN;
  maxBaseAmountIn: BN;
  maxQuoteAmountIn: BN;
  userBaseTokenReserves: BN;
  userQuoteTokenReserves: BN;
  poolBaseTokenReserves: BN;
  poolQuoteTokenReserves: BN;
  baseAmountIn: BN;
  quoteAmountIn: BN;
  lpMintSupply: BN;
  pool: PublicKey;
  user: PublicKey;
  userBaseTokenAccount: PublicKey;
  userQuoteTokenAccount: PublicKey;
  userPoolTokenAccount: PublicKey;
}

export interface WithdrawEvent {
  timestamp: BN;
  lpTokenAmountIn: BN;
  minBaseAmountOut: BN;
  minQuoteAmountOut: BN;
  userBaseTokenReserves: BN;
  userQuoteTokenReserves: BN;
  poolBaseTokenReserves: BN;
  poolQuoteTokenReserves: BN;
  baseAmountOut: BN;
  quoteAmountOut: BN;
  lpMintSupply: BN;
  pool: PublicKey;
  user: PublicKey;
  userBaseTokenAccount: PublicKey;
  userQuoteTokenAccount: PublicKey;
  userPoolTokenAccount: PublicKey;
}

export interface CreatePoolEvent {
  timestamp: BN;
  index: number;
  creator: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseMintDecimals: number;
  quoteMintDecimals: number;
  baseAmountIn: BN;
  quoteAmountIn: BN;
  poolBaseAmount: BN;
  poolQuoteAmount: BN;
  minimumLiquidity: BN;
  initialLiquidity: BN;
  lpTokenAmountOut: BN;
  poolBump: number;
  pool: PublicKey;
  lpMint: PublicKey;
  userBaseTokenAccount: PublicKey;
  userQuoteTokenAccount: PublicKey;
  coinCreator: PublicKey;
  isMayhemMode: boolean;
}

// PumpFees Events

export interface CreateFeeSharingConfigEvent {
  timestamp: BN;
  mint: PublicKey;
  bondingCurve: PublicKey;
  pool: PublicKey | null;
  sharingConfig: PublicKey;
  admin: PublicKey;
  initialShareholders: Shareholder[];
  status: number;
}

export interface UpdateFeeSharesEvent {
  timestamp: BN;
  mint: PublicKey;
  sharingConfig: PublicKey;
  admin: PublicKey;
  newShareholders: Shareholder[];
}

export interface ResetFeeSharingConfigEvent {
  timestamp: BN;
  mint: PublicKey;
  sharingConfig: PublicKey;
  oldAdmin: PublicKey;
  oldShareholders: Shareholder[];
  newAdmin: PublicKey;
  newShareholders: Shareholder[];
}

export interface RevokeFeeSharingAuthorityEvent {
  timestamp: BN;
  mint: PublicKey;
  sharingConfig: PublicKey;
  admin: PublicKey;
}

export interface TransferFeeSharingAuthorityEvent {
  timestamp: BN;
  mint: PublicKey;
  sharingConfig: PublicKey;
  oldAdmin: PublicKey;
  newAdmin: PublicKey;
}

export interface SocialFeePdaCreatedEvent {
  timestamp: BN;
  userId: string;
  platform: number;
  socialFeePda: PublicKey;
  createdBy: PublicKey;
}

export interface SocialFeePdaClaimedEvent {
  timestamp: BN;
  userId: string;
  platform: number;
  socialFeePda: PublicKey;
  recipient: PublicKey;
  socialClaimAuthority: PublicKey;
  amountClaimed: BN;
  claimableBefore: BN;
  lifetimeClaimed: BN;
  recipientBalanceBefore: BN;
  recipientBalanceAfter: BN;
}

// ─── PumpAMM Extra Events ─────────────────────────────────────────────────────

export interface AmmAdminSetCoinCreatorEvent {
  timestamp: BN;
  adminSetCoinCreatorAuthority: PublicKey;
  baseMint: PublicKey;
  pool: PublicKey;
  oldCoinCreator: PublicKey;
  newCoinCreator: PublicKey;
}

export interface AmmAdminUpdateTokenIncentivesEvent {
  startTime: BN;
  endTime: BN;
  dayNumber: BN;
  tokenSupplyPerDay: BN;
  mint: PublicKey;
  secondsInADay: BN;
  timestamp: BN;
}

export interface AmmClaimCashbackEvent {
  user: PublicKey;
  amount: BN;
  timestamp: BN;
  totalClaimed: BN;
  totalCashbackEarned: BN;
}

export interface AmmClaimTokenIncentivesEvent {
  user: PublicKey;
  mint: PublicKey;
  amount: BN;
  timestamp: BN;
  totalClaimedTokens: BN;
  currentSolVolume: BN;
}

export interface AmmCloseUserVolumeAccumulatorEvent {
  user: PublicKey;
  timestamp: BN;
  totalUnclaimedTokens: BN;
  totalClaimedTokens: BN;
  currentSolVolume: BN;
  lastUpdateTimestamp: BN;
}

export interface AmmCollectCoinCreatorFeeEvent {
  timestamp: BN;
  coinCreator: PublicKey;
  coinCreatorFee: BN;
  coinCreatorVaultAta: PublicKey;
  coinCreatorTokenAccount: PublicKey;
}

export interface AmmCreateConfigEvent {
  timestamp: BN;
  admin: PublicKey;
  lpFeeBasisPoints: BN;
  protocolFeeBasisPoints: BN;
  protocolFeeRecipients: PublicKey[];
  coinCreatorFeeBasisPoints: BN;
  adminSetCoinCreatorAuthority: PublicKey;
}

export interface AmmDisableEvent {
  timestamp: BN;
  admin: PublicKey;
  disableCreatePool: boolean;
  disableDeposit: boolean;
  disableWithdraw: boolean;
  disableBuy: boolean;
  disableSell: boolean;
}

export interface AmmExtendAccountEvent {
  timestamp: BN;
  account: PublicKey;
  user: PublicKey;
  currentSize: BN;
  newSize: BN;
}

export interface AmmInitUserVolumeAccumulatorEvent {
  payer: PublicKey;
  user: PublicKey;
  timestamp: BN;
}

export interface AmmMigratePoolCoinCreatorEvent {
  timestamp: BN;
  baseMint: PublicKey;
  pool: PublicKey;
  sharingConfig: PublicKey;
  oldCoinCreator: PublicKey;
  newCoinCreator: PublicKey;
}

export interface AmmReservedFeeRecipientsEvent {
  timestamp: BN;
  reservedFeeRecipient: PublicKey;
  reservedFeeRecipients: PublicKey[];
}

export interface AmmSetBondingCurveCoinCreatorEvent {
  timestamp: BN;
  baseMint: PublicKey;
  pool: PublicKey;
  bondingCurve: PublicKey;
  coinCreator: PublicKey;
}

export interface AmmSetMetaplexCoinCreatorEvent {
  timestamp: BN;
  baseMint: PublicKey;
  pool: PublicKey;
  metadata: PublicKey;
  coinCreator: PublicKey;
}

export interface AmmSyncUserVolumeAccumulatorEvent {
  user: PublicKey;
  totalClaimedTokensBefore: BN;
  totalClaimedTokensAfter: BN;
  timestamp: BN;
}

export interface AmmUpdateAdminEvent {
  timestamp: BN;
  admin: PublicKey;
  newAdmin: PublicKey;
}

export interface AmmUpdateFeeConfigEvent {
  timestamp: BN;
  admin: PublicKey;
  lpFeeBasisPoints: BN;
  protocolFeeBasisPoints: BN;
  protocolFeeRecipients: PublicKey[];
  coinCreatorFeeBasisPoints: BN;
  adminSetCoinCreatorAuthority: PublicKey;
}

// ─── PumpFees Extra Events ────────────────────────────────────────────────────

export interface FeesInitializeFeeConfigEvent {
  timestamp: BN;
  admin: PublicKey;
  feeConfig: PublicKey;
}

export interface FeesInitializeFeeProgramGlobalEvent {
  timestamp: BN;
  authority: PublicKey;
  socialClaimAuthority: PublicKey;
  disableFlags: number;
  claimRateLimit: BN;
}

export interface FeesSetAuthorityEvent {
  timestamp: BN;
  oldAuthority: PublicKey;
  newAuthority: PublicKey;
}

export interface FeesSetClaimRateLimitEvent {
  timestamp: BN;
  claimRateLimit: BN;
}

export interface FeesSetDisableFlagsEvent {
  timestamp: BN;
  disableFlags: number;
}

export interface FeesSetSocialClaimAuthorityEvent {
  timestamp: BN;
  socialClaimAuthority: PublicKey;
}

export interface FeesUpdateAdminEvent {
  timestamp: BN;
  oldAdmin: PublicKey;
  newAdmin: PublicKey;
}

export interface FeesUpdateFeeConfigEvent {
  timestamp: BN;
  admin: PublicKey;
  feeConfig: PublicKey;
  feeTiers: FeeTier[];
  flatFees: Fees;
}

export interface FeesUpsertFeeTiersEvent {
  timestamp: BN;
  admin: PublicKey;
  feeConfig: PublicKey;
  feeTiers: FeeTier[];
  offset: number;
}
