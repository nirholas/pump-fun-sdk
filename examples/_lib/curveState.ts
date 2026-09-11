/**
 * Mainnet-shaped curve state for the offline math examples (11-20).
 *
 * These builders mirror the real Pump program parameters that every new
 * token launches with, the same values the SDK unit-test fixtures use:
 *
 *   virtual token reserves   1,073,000,000 tokens  (1.073e15 base units)
 *   virtual SOL reserves     30 SOL                (3.0e10 lamports)
 *   real token reserves      793,100,000 tokens    (7.931e14 base units)
 *   token total supply       1,000,000,000 tokens  (1.0e15 base units)
 *   protocol fee             100 bps (1%)
 *   creator fee              50 bps (0.5%)
 *
 * With them, every quote function in the SDK runs with zero network access
 * and produces the same numbers a fresh mainnet launch would.
 */
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import type { BondingCurve, FeeConfig, Global } from "@nirholas/pump-sdk";

/**
 * The Pump protocol fee recipient set on mainnet (the pre-2026 pool that
 * lives in Global.fee_recipient / Global.fee_recipients).
 */
export const PROTOCOL_FEE_RECIPIENTS: PublicKey[] = [
  new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV"),
  new PublicKey("7VtfL8fvgNfhz17qKRMjzQEXgbdpnHHHQRh54R9jP2RJ"),
  new PublicKey("7hTckgnGnLQR6sdH7YkqFTAA7VwTfYFaZ6EhEsU3saCX"),
  new PublicKey("9rPYyANsfQZw3DnDmKE3YCQF5E8oD89UXoHn9JFEhJUz"),
  new PublicKey("AVmoTthdrX6tKt4nDjco2D775W2YK3sDhxPcMmzUAmTY"),
  new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM"),
  new PublicKey("FWsW1xNtWscwNmKv6wVsU1iTzRN6wmmk3MjxRP5tT7hz"),
  new PublicKey("G5UZAVbAf46s7cKWoyKu8kYTip9DGTpbLZ2qa9Aq69dP"),
];

/** A stand-in creator address for curves that need a creator set. */
export const EXAMPLE_CREATOR = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);

/** Real mainnet launch parameters as a Global account. */
export function mainnetGlobal(overrides: Partial<Global> = {}): Global {
  return {
    initialized: true,
    authority: PublicKey.default,
    feeRecipient: PROTOCOL_FEE_RECIPIENTS[0]!,
    initialVirtualTokenReserves: new BN("1073000000000000"),
    initialVirtualSolReserves: new BN("30000000000"),
    initialRealTokenReserves: new BN("793100000000000"),
    tokenTotalSupply: new BN("1000000000000000"),
    feeBasisPoints: new BN(100),
    withdrawAuthority: PublicKey.default,
    enableMigrate: true,
    poolMigrationFee: new BN(0),
    creatorFeeBasisPoints: new BN(50),
    feeRecipients: PROTOCOL_FEE_RECIPIENTS.slice(1),
    setCreatorAuthority: PublicKey.default,
    adminSetCreatorAuthority: PublicKey.default,
    createV2Enabled: true,
    whitelistPda: PublicKey.default,
    reservedFeeRecipient: PROTOCOL_FEE_RECIPIENTS[0]!,
    mayhemModeEnabled: false,
    reservedFeeRecipients: PROTOCOL_FEE_RECIPIENTS.slice(1),
    buybackFeeRecipients: PROTOCOL_FEE_RECIPIENTS.slice(1),
    buybackBasisPoints: new BN(0),
    initialVirtualQuoteReserves: new BN("30000000000"),
    // Mainnet whitelists no non-SOL quote mint yet: the program keeps the slot
    // zeroed, and a curve quoted in anything else is rejected on-chain.
    whitelistedQuoteMints: [PublicKey.default],
    ...overrides,
  };
}

/** A bonding curve exactly as it looks the moment a token launches. */
export function launchBondingCurve(
  overrides: Partial<BondingCurve> = {},
): BondingCurve {
  return {
    virtualTokenReserves: new BN("1073000000000000"),
    virtualQuoteReserves: new BN("30000000000"),
    realTokenReserves: new BN("793100000000000"),
    realQuoteReserves: new BN(0),
    tokenTotalSupply: new BN("1000000000000000"),
    complete: false,
    creator: PublicKey.default,
    isMayhemMode: false,
    isCashbackCoin: false,
    // The zero key is how the program stores a SOL-quoted curve.
    quoteMint: PublicKey.default,
    ...overrides,
  };
}

/**
 * Derive the bonding curve state at a chosen virtual SOL level by sliding
 * along the constant-product invariant k = vSol * vTok. Buys move vSol up
 * and vTok down while k stays (almost exactly) constant, so any point on
 * the curve is fully determined by one coordinate.
 */
export function curveAtVirtualSol(
  global: Global,
  virtualSolReserves: BN,
): BondingCurve {
  const k = global.initialVirtualSolReserves.mul(
    global.initialVirtualTokenReserves,
  );
  const virtualTokenReserves = k.div(virtualSolReserves);
  const tokensSold = global.initialVirtualTokenReserves.sub(
    virtualTokenReserves,
  );
  return launchBondingCurve({
    virtualQuoteReserves: virtualSolReserves,
    virtualTokenReserves,
    realQuoteReserves: virtualSolReserves.sub(global.initialVirtualSolReserves),
    realTokenReserves: BN.max(
      new BN(0),
      global.initialRealTokenReserves.sub(tokensSold),
    ),
    creator: EXAMPLE_CREATOR,
  });
}

/**
 * The virtual SOL level at which the curve runs out of real tokens and
 * graduates to the AMM: k / (vTok0 - realTok0), about 115 SOL for the
 * mainnet parameters.
 */
export function graduationVirtualSol(global: Global): BN {
  const k = global.initialVirtualSolReserves.mul(
    global.initialVirtualTokenReserves,
  );
  const finalVirtualTokenReserves = global.initialVirtualTokenReserves.sub(
    global.initialRealTokenReserves,
  );
  return k.div(finalVirtualTokenReserves);
}

/**
 * A realistic tiered FeeConfig, shaped like the on-chain fee program
 * account: fees step down as market cap grows. Thresholds and rates match
 * the SDK unit-test fixture.
 */
export function mainnetFeeConfig(): FeeConfig {
  return {
    admin: PublicKey.default,
    flatFees: {
      lpFeeBps: new BN(0),
      protocolFeeBps: new BN(100),
      creatorFeeBps: new BN(50),
    },
    feeTiers: [
      {
        marketCapLamportsThreshold: new BN(0),
        fees: {
          lpFeeBps: new BN(0),
          protocolFeeBps: new BN(200),
          creatorFeeBps: new BN(100),
        },
      },
      {
        marketCapLamportsThreshold: new BN("100000000000"),
        fees: {
          lpFeeBps: new BN(0),
          protocolFeeBps: new BN(100),
          creatorFeeBps: new BN(50),
        },
      },
      {
        marketCapLamportsThreshold: new BN("1000000000000"),
        fees: {
          lpFeeBps: new BN(0),
          protocolFeeBps: new BN(50),
          creatorFeeBps: new BN(25),
        },
      },
    ],
  };
}
