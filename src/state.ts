import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";

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
  isCashbackEnabled: boolean;
  buybackFeeRecipients: PublicKey[];
  buybackBasisPoints: BN;
  /**
   * Virtual quote reserves a curve starts from when it is quoted in a
   * whitelisted non-SOL mint. SOL-quoted curves use
   * {@link Global.initialVirtualSolReserves} instead.
   */
  initialVirtualQuoteReserves: BN;
  /** Non-SOL mints `create_v2` accepts as a curve's quote token. */
  whitelistedQuoteMints: PublicKey[];
  creatorFeeConfigurable: boolean;
  maxConfigurableCreatorFeeBps: BN;
  /** Authority that signs scheduled holder-reward distributions. */
  holderRewardClaimAuthority: PublicKey;
  /** Global gate for holder-reward launches and CTO conversions. */
  isHolderRewardEnabled: boolean;
  /**
   * Deepest pump-coin quote chain `create_v2` admits. A coin quoted in pump
   * coin Q sits at depth `Q.depth + 1`; 0 disables pump-coin quotes. Reads 0
   * on a Global decoded from an account written before the field existed.
   */
  maxCurveDepth: number;
}

export interface BondingCurve {
  virtualTokenReserves: BN;
  /**
   * Virtual reserves of the curve's quote token. Named `virtualSolReserves`
   * until pump generalized curves beyond SOL: the byte layout is unchanged,
   * but the balance is denominated in {@link BondingCurve.quoteMint}, which is
   * only wrapped SOL for a SOL-quoted coin.
   */
  virtualQuoteReserves: BN;
  realTokenReserves: BN;
  /** Real reserves of the curve's quote token. See {@link BondingCurve.virtualQuoteReserves}. */
  realQuoteReserves: BN;
  tokenTotalSupply: BN;
  complete: boolean;
  creator: PublicKey;
  isMayhemMode: boolean;
  isCashbackCoin: boolean;
  /**
   * The mint the curve is quoted in. Curves created before pump accepted
   * non-SOL quote tokens store `PublicKey.default`, so normalize this through
   * `normalizeQuoteMint` before deriving a PDA or an ATA from it.
   */
  quoteMint: PublicKey;
  /** Per-coin creator fee selected at launch or through the CTO flow. */
  creatorFeeBps: BN;
  canEditCreatorFee: boolean;
  /** True when creator fees are distributed to holders by Pump.fun. */
  isHolderReward: boolean;
  /**
   * Creator fees the v3 trades accrued in the curve's quote token account and
   * have not swept to the creator vault yet (`sweep_creator_fee`).
   */
  creatorFee: BN;
  /**
   * Protocol fees the v3 trades accrued in the curve's quote token account and
   * have not swept yet (`sweep_protocol_fee`).
   */
  protocolFees: BN;
  /**
   * Position in a pump-coin quote chain: 0 for a coin quoted in SOL or a listed
   * mint, `Q.depth + 1` for a coin quoted in pump coin Q.
   */
  depth: number;
  /**
   * The virtual quote reserves the curve was created with. Synthetic
   * migration quotes the pool-to-be from it once the curve completes.
   */
  initialVirtualQuoteReserves: BN;
  /** Base tokens bought through the synthetic pool after the curve completed. */
  postCompleteBaseOut: BN;
  /** Quote paid into the synthetic pool after the curve completed. */
  postCompleteQuoteIn: BN;
}

/** A mint `QuoteControl` admits as a curve quote, with its starting reserves. */
export interface QuoteControlMint {
  mint: PublicKey;
  initialVirtualQuoteReserves: BN;
}

/**
 * The pump `QuoteControl` account (PDA `["quote-control"]`): the list of
 * quote mints admitted beyond `Global.whitelistedQuoteMints`, each with the
 * virtual quote reserves its curves start from.
 */
export interface QuoteControl {
  admin: PublicKey;
  /** Authority allowed to retune a listed mint's starting reserves. */
  reservesAdmin: PublicKey;
  reserved: number[];
  mints: QuoteControlMint[];
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
  /** Flat schedule for non-pump pools, and exotic quotes while `exoticFlatFees` is unset. */
  flatFees: Fees;
  /** Market-cap tiers SOL-like quotes pay. */
  feeTiers: FeeTier[];
  /**
   * Market-cap tiers listed stable quotes (mainnet USDC) pay. Empty or absent
   * on a FeeConfig written before stable tiers existed, in which case stable
   * quotes fall back to `feeTiers`.
   */
  stableFeeTiers?: FeeTier[];
  /**
   * Flat schedule every other quote (pump coins, QuoteControl mints) pays. An
   * all-zero or absent value means unset, and `flatFees` applies.
   */
  exoticFlatFees?: Fees;
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
  bondingCurve: PublicKey;
  quoteMint: PublicKey;
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
  /** True when the coin's creator fees go to its holders. */
  isHolderReward: boolean;
  /**
   * Signed virtual quote reserves (i128 on chain) added to the pool's real
   * quote balance when pricing: `effective = quote_vault.amount +
   * virtualQuoteReserves`. Zero for every pool but a synthetic migration's,
   * where it is negative when the curve's raise ran short of the target.
   */
  virtualQuoteReserves: BN;
  /** Per-pool creator fee rate (bps); 0 means the fee schedule rate applies. */
  creatorFeeBps: BN;
  canEditCreatorFee: boolean;
  /** Protocol fees v2 trades accrued in the pool vault, swept by `sweep_protocol_fee`. */
  protocolFees: BN;
  /** Creator fees v2 trades accrued in the pool vault, swept by `sweep_creator_fee`. */
  creatorFees: BN;
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
  buybackFeeRecipients: PublicKey[];
  buybackBasisPoints: BN;
  boostAuthority: PublicKey;
  boostEnabled: boolean;
  creatorFeeConfigurable: boolean;
  maxConfigurableCreatorFeeBps: BN;
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
  buybackFeeBasisPoints: BN;
  buybackFee: BN;
  shareholders: Shareholder[];
  /** Quote mint of the curve (`PublicKey.default` for legacy SOL curves). */
  quoteMint: PublicKey;
  /** Quote amount of the trade, in the quote mint's base units. */
  quoteAmount: BN;
  virtualQuoteReserves: BN;
  realQuoteReserves: BN;
  holderRewardsBps: BN;
  holderRewards: BN;
  /**
   * Creator fees left in the curve after this trade, waiting for
   * `sweep_creator_fee`. Zero on events emitted before the v3 trades.
   */
  creatorFeeUnclaimed: BN;
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
  quoteMint: PublicKey;
  virtualQuoteReserves: BN;
  creatorFeeBps: BN;
  isHolderReward: boolean;
  /** Pump-coin quote depth (0 unless the coin is quoted in a pump coin). */
  depth: number;
}

export interface CompleteEvent {
  user: PublicKey;
  mint: PublicKey;
  bondingCurve: PublicKey;
  timestamp: BN;
  quoteMint: PublicKey;
}

/**
 * Emitted by a v3 buy on a curve that completed but has not migrated: the
 * buy fills against the synthetic pool-to-be instead of the curve.
 */
export interface PostCompleteBuyEvent {
  user: PublicKey;
  mint: PublicKey;
  bondingCurve: PublicKey;
  quoteMint: PublicKey;
  timestamp: BN;
  baseOut: BN;
  quoteIn: BN;
  feeBasisPoints: BN;
  fee: BN;
  creatorFeeBasisPoints: BN;
  creatorFee: BN;
  buybackFee: BN;
  poolBaseReservesBefore: BN;
  poolQuoteReservesBefore: BN;
  poolBaseReservesAfter: BN;
  poolQuoteReservesAfter: BN;
}

/** Bucket a fee sweep drained: protocol fees or creator fees. */
export enum SweepFeeBucket {
  Protocol = 0,
  Creator = 1,
}

/** Emitted by pump `sweep_protocol_fee` / `sweep_creator_fee`. */
export interface SweepBondingCurveFeeEvent {
  timestamp: BN;
  mint: PublicKey;
  bondingCurve: PublicKey;
  quoteMint: PublicKey;
  recipient: PublicKey;
  amount: BN;
  bucket: number;
}

/** Emitted by pump-amm `sweep_protocol_fee` / `sweep_creator_fee`. */
export interface SweepPoolFeeEvent {
  timestamp: BN;
  pool: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  recipient: PublicKey;
  payer: PublicKey;
  amount: BN;
  bucket: number;
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
  quoteMint: PublicKey;
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
  quoteMint: PublicKey;
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

export interface AdminCtoEvent {
  timestamp: BN;
  authority: PublicKey;
  mint: PublicKey;
  bondingCurve: PublicKey;
  oldCreator: PublicKey;
  newCreator: PublicKey;
  isHolderReward: boolean;
  isCashbackCoin: boolean;
  oldCreatorFeeBps: BN;
  newCreatorFeeBps: BN;
  sharingConfigReset: boolean;
  sweptToHolderVault: BN;
  poolUpdated: boolean;
}

export interface DistributeFeeToHoldersEvent {
  timestamp: BN;
  mint: PublicKey;
  quoteMint: PublicKey;
  recipients: BN;
  total: BN;
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
  buybackFeeBasisPoints: BN;
  buybackFee: BN;
  /** Pool's signed virtual quote reserves at the time of the trade. */
  virtualQuoteReserves: BN;
  canBoost: boolean;
  baseSupply: BN;
  holderRewardsBps: BN;
  holderRewards: BN;
  /** Creator fees left in the pool after this trade, waiting for a sweep. */
  creatorFeeUnclaimed: BN;
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
  buybackFeeBasisPoints: BN;
  buybackFee: BN;
  /** Pool's signed virtual quote reserves at the time of the trade. */
  virtualQuoteReserves: BN;
  canBoost: boolean;
  baseSupply: BN;
  holderRewardsBps: BN;
  holderRewards: BN;
  /** Creator fees left in the pool after this trade, waiting for a sweep. */
  creatorFeeUnclaimed: BN;
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
  creatorFeeBps: BN;
  canEditCreatorFee: boolean;
  isHolderReward: boolean;
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
