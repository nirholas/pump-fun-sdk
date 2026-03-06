# OpenClaw Fee Management — Creator Fee Collection & Distribution

## Skill Description

Collect accumulated creator fees from trading activity, configure fee sharing among multiple shareholders, and distribute earnings proportionally — across both the Pump bonding curve and PumpAMM graduated pool programs.

## Context

Every trade on Pumpfun generates creator fees. These fees accumulate in on-chain vaults and must be explicitly claimed. The SDK supports collecting fees from both Pump (bonding curve) and PumpAMM (graduated pool) programs simultaneously, and optionally distributing collected fees among up to 10 shareholders via the PumpFees program with BPS-based (basis points) share allocation.

## Key Files

- [src/onlineSdk.ts](src/onlineSdk.ts) — `collectCoinCreatorFeeInstructions()`, `distributeCreatorFees()`, `updateFeeShares()`, `createFeeSharingConfig()`
- [src/sdk.ts](src/sdk.ts) — `PumpSdk` with offline `claimCashbackInstruction()`, `isCreatorUsingSharingConfig()`
- [src/fees.ts](src/fees.ts) — Fee calculation, tiered BPS, `computeFeesBps()`
- [src/state.ts](src/state.ts) — `Shareholder`, `SharingConfig`, `FeeConfig`, `FeeTier` interfaces
- [src/pda.ts](src/pda.ts) — `creatorVaultPda()`, `feeSharingConfigPda()` derivations
- [src/errors.ts](src/errors.ts) — Validation error classes for shareholder configuration

## Fee Collection

### Collect Creator Fees (Both Programs)

Claim accumulated fees from bonding curve and AMM vaults in one call:

```typescript
const onlineSdk = new OnlinePumpSdk(connection);

const instructions = await onlineSdk.collectCoinCreatorFeeInstructions(
  creatorPublicKey,   // Creator address
  feePayerPublicKey,  // Optional: separate fee payer
);
// Returns TransactionInstruction[] covering both Pump and PumpAMM
```

### Check Creator Vault Balance

```typescript
// Single program
const balance = await onlineSdk.getCreatorVaultBalance(creatorPublicKey);

// Both programs combined
const totalBalance = await onlineSdk.getCreatorVaultBalanceBothPrograms(creatorPublicKey);
// Returns BN in lamports (balance minus rent exemption)
```

## Fee Sharing Configuration

### Create Fee Sharing Config

Set up fee distribution for a token's creator fees:

```typescript
const ix = await PUMP_SDK.createFeeSharingConfig({
  creator: creatorPublicKey,  // Token creator
  mint: mintPublicKey,        // Token mint
  pool: poolPublicKey,        // AMM pool (null for ungraduated)
});
```

### Update Fee Shares

Configure how creator fees are split among shareholders:

```typescript
const ix = await PUMP_SDK.updateFeeShares({
  authority: authorityPublicKey,  // Current config authority
  mint: mintPublicKey,
  currentShareholders: [wallet1, wallet2],  // Existing shareholder pubkeys
  newShareholders: [
    { address: wallet1, shareBps: 5000 },   // 50%
    { address: wallet2, shareBps: 3000 },   // 30%
    { address: wallet3, shareBps: 2000 },   // 20%
  ],
});
```

**Validation rules enforced by the SDK:**
- At least 1 shareholder required
- Maximum 10 shareholders
- Every shareholder must have `shareBps > 0`
- Total shares must equal exactly `10,000` BPS (100%)
- No duplicate addresses

### Distribute Creator Fees

Distribute accumulated fees to all configured shareholders:

```typescript
const ix = await onlineSdk.distributeCreatorFees({
  mint: mintPublicKey,
  sharingConfig,                // Fetched SharingConfig account
  sharingConfigAddress,         // PDA address of the config
});
```

### Check Minimum Distributable Fee

Verify enough fees have accumulated before distributing:

```typescript
const ix = await onlineSdk.getMinimumDistributableFee({
  mint: mintPublicKey,
  sharingConfig,
  sharingConfigAddress,
});
// Simulate this instruction to read the MinimumDistributableFeeEvent
```

## Fee Sharing Config Detection

Check if a creator has upgraded to fee sharing:

```typescript
import { isCreatorUsingSharingConfig } from "@pump-fun/pump-sdk";

const upgraded = isCreatorUsingSharingConfig({
  mint: mintPublicKey,
  creator: bondingCurve.creator,  // or pool.coinCreator for graduated
});

if (upgraded) {
  // Fees go to sharing config → distributed to shareholders
} else {
  // Fees go directly to creator address
}
```

## Fee Tiers

Protocol fees are tiered based on market cap:

```typescript
interface FeeTier {
  marketCapLamportsThreshold: BN;  // Market cap threshold in lamports 
  fees: {
    lpFeeBps: BN;
    protocolFeeBps: BN;
    creatorFeeBps: BN;
  };
}
```

The SDK selects the appropriate tier using `calculateFeeTier()`:

```typescript
const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
  global,
  feeConfig,
  mintSupply,
  virtualSolReserves,
  virtualTokenReserves,
});
```

## State Interfaces

```typescript
interface Shareholder {
  address: PublicKey;
  shareBps: number;      // Basis points (1 BPS = 0.01%, 10000 = 100%)
}

interface SharingConfig {
  version: number;
  mint: PublicKey;
  admin: PublicKey;
  adminRevoked: boolean;
  shareholders: Shareholder[];
}
```

## Patterns to Follow

- Always collect from both programs using `collectCoinCreatorFeeInstructions` for complete collection
- Validate shareholder arrays before submitting — SDK throws typed errors for invalid configurations
- Check `getCreatorVaultBalanceBothPrograms` before claiming to verify fees exist
- Use `getMinimumDistributableFee` before distributing to avoid failed transactions
- Shares must total exactly 10,000 BPS — partial distributions are not supported
- Use `isCreatorUsingSharingConfig` to detect whether fee sharing is active

## Common Pitfalls

- Forgetting to collect from both Pump and PumpAMM — fees accumulate independently
- Shares not totaling 10,000 BPS — throws `InvalidShareTotalError`
- Duplicate shareholder addresses — throws `DuplicateShareholderError`
- Zero or negative share values — throws `ZeroShareError`
- More than 10 shareholders — throws `TooManyShareholdersError`
- Trying to distribute when fees are below minimum threshold
- Not passing `currentShareholders` when updating — needed for remaining accounts
