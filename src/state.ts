import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

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

