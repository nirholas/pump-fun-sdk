# Fee Program

The fee program (`pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ`) manages dynamic fee tiers based on market cap and fee sharing between creators and shareholders.

## Fee Calculation

### Bonding Curve Fees

For bonding curve program, the fee bps for protocol and creator fees will be computed using the following logic:

```typescript
export function computeFeesBps({
  global,
  feeConfig,
  mintSupply,
  virtualSolReserves,
  virtualTokenReserves,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
}): CalculatedFeesBps {
  if (feeConfig != null) {
    const marketCap = bondingCurveMarketCap({
      mintSupply,
      virtualSolReserves,
      virtualTokenReserves,
    });

    return calculateFeeTier({
      feeTiers: feeConfig.feeTiers,
      marketCap,
    });
  }

  return {
    protocolFeeBps: global.feeBasisPoints,
    creatorFeeBps: global.creatorFeeBasisPoints,
  };
}
```

### AMM Pool Fees

For PumpSwap AMM pools:

```typescript
export function computeAmmFeesBps({
  globalConfig,
  feeConfig,
  baseMint,
  creator,
  marketCap,
  tradeSize,
}: {
  globalConfig: GlobalConfig;
  feeConfig: FeeConfig | null;
  baseMint: PublicKey;
  creator: PublicKey;
  marketCap: BN;
  tradeSize: BN;
}): CalculatedFeesBps {
  if (feeConfig != null) {
    return getFees({
      feeConfig,
      isPumpPool: isPumpPool(baseMint, creator),
      marketCap,
      tradeSize,
    });
  }

  return {
    lpFeeBps: globalConfig.lpFeeBasisPoints,
    protocolFeeBps: globalConfig.protocolFeeBasisPoints,
    creatorFeeBps: globalConfig.coinCreatorFeeBasisPoints,
  };
}
```

### Fee Tier Calculation

```typescript
/// rust reference: pump-fees::get_fees()
function getFees({
  feeConfig,
  isPumpPool,
  marketCap,
}: {
  feeConfig: FeeConfig;
  isPumpPool: boolean;
  marketCap: BN;
  tradeSize: BN;
}): Fees {
  if (isPumpPool) {
    return calculateFeeTier({
      feeTiers: feeConfig.feeTiers,
      marketCap,
    });
  } else {
    return feeConfig.flatFees;
  }
}

/// rust reference: pump-fees-math::calculate_fee_tier()
export function calculateFeeTier({
  feeTiers,
  marketCap,
}: {
  feeTiers: FeeTier[];
  marketCap: BN;
}): Fees {
  const firstTier = feeTiers[0];

  if (marketCap.lt(firstTier.marketCapLamportsThreshold)) {
    return firstTier.fees;
  }

  for (const tier of feeTiers.slice().reverse()) {
    if (marketCap.gte(tier.marketCapLamportsThreshold)) {
      return tier.fees;
    }
  }

  return firstTier.fees;
}
```

## Fee Config State

```typescript
interface FeeConfig {
  bump: number;
  admin: PublicKey;
  flatFees: Fees;    // flat fees for non-pump pools
  feeTiers: FeeTier[];  // tiered fees for pump pools
}

interface FeeTier {
  marketCapLamportsThreshold: BN; // u128
  fees: Fees;
}

interface Fees {
  lpFeeBps: BN;
  protocolFeeBps: BN;
  creatorFeeBps: BN;
}
```

## Fee Sharing

Fee sharing allows creators to distribute fees among multiple shareholders. The sharing config is a PDA derived from `["sharing-config", mint]`.

```typescript
interface SharingConfig {
  bump: number;
  version: number;
  status: ConfigStatus; // "paused" | "active"
  mint: PublicKey;
  admin: PublicKey;
  adminRevoked: boolean;
  shareholders: Shareholder[];
}

interface Shareholder {
  address: PublicKey;
  shareBps: number; // u16, all must sum to exactly 10,000
}
```

### Fee Sharing Instructions

- `createFeeSharingConfig` — Create a new fee sharing config for a mint
- `updateFeeShares` — Update fee shares (distribute all fees before calling this)
- `resetFeeSharingConfig` — Reset fee sharing config (distribute all fees before calling this)
- `revokeFeeSharingAuthority` — Revoke the admin's ability to update shares
- `transferFeeSharingAuthority` — Transfer admin authority to a new address
- `createSocialFeePda` — Create a social fee PDA for GitHub recipients

### Important Rules

- All shareholder `shareBps` must sum to exactly **10,000** basis points
- No duplicate shareholder addresses
- No shareholder can have zero share
- GitHub organizations are **not supported** as social fee recipients
- Only `Platform.GitHub` is supported for social fees

## Fee Program Events

- `createFeeSharingConfigEvent`
- `resetFeeSharingConfigEvent`
- `updateFeeSharesEvent`
- `revokeFeeSharingAuthorityEvent`
- `transferFeeSharingAuthorityEvent`
- `initializeFeeConfigEvent`
- `updateFeeConfigEvent`
- `upsertFeeTiersEvent`
- `socialFeePdaCreated`
