/**
 * Shared test fixtures for the Pump SDK unit tests.
 */
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { BondingCurve, FeeConfig, FeeTier, Global } from "../state";

/** A deterministic keypair for tests (not a real wallet). */
export const TEST_PUBKEY = new PublicKey(
  "11111111111111111111111111111111",
);

export const TEST_CREATOR = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);

/** Typical Pump global state used on mainnet. */
export function makeGlobal(overrides: Partial<Global> = {}): Global {
  return {
    initialized: true,
    authority: TEST_PUBKEY,
    feeRecipient: TEST_PUBKEY,
    initialVirtualTokenReserves: new BN("1073000000000000"), // ~1.073B tokens
    initialVirtualSolReserves: new BN("30000000000"), // 30 SOL
    initialRealTokenReserves: new BN("793100000000000"), // ~793.1M tokens
    tokenTotalSupply: new BN("1000000000000000"), // 1B tokens (6 decimals)
    feeBasisPoints: new BN(100), // 1% protocol fee
    withdrawAuthority: TEST_PUBKEY,
    enableMigrate: true,
    poolMigrationFee: new BN(0),
    creatorFeeBasisPoints: new BN(50), // 0.5% creator fee
    feeRecipients: [TEST_PUBKEY],
    setCreatorAuthority: TEST_PUBKEY,
    adminSetCreatorAuthority: TEST_PUBKEY,
    createV2Enabled: true,
    whitelistPda: TEST_PUBKEY,
    reservedFeeRecipient: TEST_PUBKEY,
    mayhemModeEnabled: false,
    reservedFeeRecipients: [TEST_PUBKEY],
    ...overrides,
  };
}

/** Fresh bonding curve (no trades yet). */
export function makeBondingCurve(
  overrides: Partial<BondingCurve> = {},
): BondingCurve {
  return {
    virtualTokenReserves: new BN("1073000000000000"),
    virtualSolReserves: new BN("30000000000"),
    realTokenReserves: new BN("793100000000000"),
    realSolReserves: new BN(0),
    tokenTotalSupply: new BN("1000000000000000"),
    complete: false,
    creator: PublicKey.default,
    isMayhemMode: false,
    isCashbackCoin: false,
    ...overrides,
  };
}

/** A graduated (complete) bonding curve. */
export function makeGraduatedBondingCurve(): BondingCurve {
  return makeBondingCurve({
    realTokenReserves: new BN(0),
    realSolReserves: new BN("85000000000"), // ~85 SOL
    complete: true,
  });
}

/** A migrated bonding curve (virtualTokenReserves = 0). */
export function makeMigratedBondingCurve(): BondingCurve {
  return makeBondingCurve({
    virtualTokenReserves: new BN(0),
    virtualSolReserves: new BN(0),
    realTokenReserves: new BN(0),
    realSolReserves: new BN(0),
    complete: true,
  });
}

/** A bonding curve with a creator set. */
export function makeBondingCurveWithCreator(): BondingCurve {
  return makeBondingCurve({
    creator: TEST_CREATOR,
  });
}

/** Sample fee tiers config. */
export function makeFeeConfig(): FeeConfig {
  const feeTiers: FeeTier[] = [
    {
      marketCapLamportsThreshold: new BN(0),
      fees: {
        lpFeeBps: new BN(0),
        protocolFeeBps: new BN(200), // 2%
        creatorFeeBps: new BN(100), // 1%
      },
    },
    {
      marketCapLamportsThreshold: new BN("100000000000"), // 100 SOL
      fees: {
        lpFeeBps: new BN(0),
        protocolFeeBps: new BN(100), // 1%
        creatorFeeBps: new BN(50), // 0.5%
      },
    },
    {
      marketCapLamportsThreshold: new BN("1000000000000"), // 1000 SOL
      fees: {
        lpFeeBps: new BN(0),
        protocolFeeBps: new BN(50), // 0.5%
        creatorFeeBps: new BN(25), // 0.25%
      },
    },
  ];

  return {
    admin: TEST_PUBKEY,
    flatFees: {
      lpFeeBps: new BN(0),
      protocolFeeBps: new BN(100),
      creatorFeeBps: new BN(50),
    },
    feeTiers,
  };
}
