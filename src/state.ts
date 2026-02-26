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
