---
name: pump-claims-readonly
description: "Read-only query methods for PumpFun claims — unclaimed token rewards, creator vault balances, volume accumulators, distributable fees, and current-day token previews across Pump and PumpAMM programs."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
    requires:
      env:
        - SOLANA_RPC_URL
---

# PumpFun Claims — Read-Only Queries

Query unclaimed rewards, creator vault balances, volume accumulators, and distributable fee status without submitting any transactions. All methods are read-only RPC calls on the `OnlinePumpSdk` class.

## Overview

The Pump protocol has two claim domains:

| Domain | What is claimed | Who claims |
|--------|----------------|------------|
| **Token Incentives** | PUMP governance tokens earned from trading volume | Any trader |
| **Creator Fees** | SOL accumulated in creator vaults from coin creation fees | Coin creators |

Both domains span **two on-chain programs** — Pump (bonding curve) and PumpAMM (graduated pools). The `BothPrograms` variants aggregate across both.

## Setup

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";

const connection = new Connection(process.env.SOLANA_RPC_URL!);
const sdk = new OnlinePumpSdk(connection);
const user = new PublicKey("...");
```

## Token Incentive Queries

### Unclaimed Token Rewards

Get the total unclaimed PUMP tokens for a user. This includes all finalized day epochs but **excludes** the current day's rewards.

```typescript
// Single program (Pump bonding curve only)
const unclaimed: BN = await sdk.getTotalUnclaimedTokens(user);

// Both programs (Pump + PumpAMM) — recommended
const unclaimedTotal: BN = await sdk.getTotalUnclaimedTokensBothPrograms(user);
```

**How it works:** Fetches `GlobalVolumeAccumulator` and `UserVolumeAccumulator` accounts, then computes rewards using the pure function `totalUnclaimedTokens()` from `tokenIncentives.ts`.

### Current Day Token Preview

Preview how many PUMP tokens the user would earn from the current (in-progress) day. This is a projection — the day hasn't finalized yet.

```typescript
// Single program
const todayTokens: BN = await sdk.getCurrentDayTokens(user);

// Both programs — recommended
const todayTokensTotal: BN = await sdk.getCurrentDayTokensBothPrograms(user);
```

**Important:** Returns `BN(0)` if the user hasn't synced during the current day. Call `syncUserVolumeAccumulator` first for an accurate preview.

### Volume Accumulator Stats

Fetch aggregate stats showing claimed, unclaimed, and current volume across both programs.

```typescript
const stats: UserVolumeAccumulatorTotalStats =
  await sdk.fetchUserVolumeAccumulatorTotalStats(user);

// stats.totalUnclaimedTokens — BN, finalized unclaimed PUMP tokens
// stats.totalClaimedTokens   — BN, lifetime claimed PUMP tokens
// stats.currentSolVolume     — BN, SOL volume in current epoch
```

**Return type:**

```typescript
interface UserVolumeAccumulatorTotalStats {
  totalUnclaimedTokens: BN;
  totalClaimedTokens: BN;
  currentSolVolume: BN;
}
```

### Raw Volume Accumulators

For lower-level access, fetch the on-chain accounts directly:

```typescript
// Global config (start/end times, daily supply, daily volumes)
const global: GlobalVolumeAccumulator =
  await sdk.fetchGlobalVolumeAccumulator();

// Per-user accumulator (returns null if account doesn't exist)
const userAcc: UserVolumeAccumulator | null =
  await sdk.fetchUserVolumeAccumulator(user);
```

**Account structures:**

```typescript
interface GlobalVolumeAccumulator {
  startTime: BN;
  endTime: BN;
  secondsInADay: BN;        // typically 86400
  mint: PublicKey;           // PUMP token mint
  totalTokenSupply: BN[];   // tokens available per day
  solVolumes: BN[];         // total SOL volume per day
}

interface UserVolumeAccumulator {
  user: PublicKey;
  needsClaim: boolean;
  totalUnclaimedTokens: BN;
  totalClaimedTokens: BN;
  currentSolVolume: BN;
  lastUpdateTimestamp: BN;
}
```

### Pure Computation Functions

If you already hold the account data, compute rewards offline without RPC:

```typescript
import { totalUnclaimedTokens, currentDayTokens } from "@pump-fun/pump-sdk";

const unclaimed: BN = totalUnclaimedTokens(globalAcc, userAcc);
const today: BN = currentDayTokens(globalAcc, userAcc);

// Optional: pass a custom timestamp for testing
const unclaimed2 = totalUnclaimedTokens(globalAcc, userAcc, 1700000000);
```

## Creator Fee Queries

### Creator Vault Balance

Check how much SOL is sitting in a creator's fee vault, ready to be collected.

```typescript
// Single program (Pump bonding curve vault only)
const balance: BN = await sdk.getCreatorVaultBalance(creator);

// Both programs (Pump + PumpAMM vaults) — recommended
const totalBalance: BN = await sdk.getCreatorVaultBalanceBothPrograms(creator);
```

**Note:** `getCreatorVaultBalance` subtracts the rent-exemption minimum — it returns only the withdrawable amount.

### Minimum Distributable Fee

Check whether a token's fee-sharing configuration has enough accumulated fees to distribute, and the minimum threshold required.

```typescript
const result: MinimumDistributableFeeResult =
  await sdk.getMinimumDistributableFee(mint);

// result.minimumRequired    — BN, minimum SOL needed to distribute
// result.distributableFees  — BN, current accumulated fees
// result.canDistribute      — boolean, true if fees >= minimum
// result.isGraduated        — boolean, true if token migrated to AMM
```

**How it works:** Simulates a transaction to read the return data from the on-chain program. For graduated tokens, it also simulates consolidating AMM vault fees before checking the threshold.

**Return type:**

```typescript
interface MinimumDistributableFeeResult {
  minimumRequired: BN;
  distributableFees: BN;
  canDistribute: boolean;
  isGraduated: boolean;
}
```

## PDA Addresses

The relevant PDAs for claim-related accounts:

```typescript
import {
  userVolumeAccumulatorPda,
  creatorVaultPda,
  feeSharingConfigPda,
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
} from "@pump-fun/pump-sdk";

const userVolumePda = userVolumeAccumulatorPda(user);
const vaultPda = creatorVaultPda(creator);
const sharingPda = feeSharingConfigPda(mint);
```

## Quick Reference

| Method | Returns | Programs |
|--------|---------|----------|
| `getTotalUnclaimedTokens(user)` | `BN` | Pump only |
| `getTotalUnclaimedTokensBothPrograms(user)` | `BN` | Pump + AMM |
| `getCurrentDayTokens(user)` | `BN` | Pump only |
| `getCurrentDayTokensBothPrograms(user)` | `BN` | Pump + AMM |
| `fetchUserVolumeAccumulatorTotalStats(user)` | `UserVolumeAccumulatorTotalStats` | Pump + AMM |
| `fetchGlobalVolumeAccumulator()` | `GlobalVolumeAccumulator` | Pump |
| `fetchUserVolumeAccumulator(user)` | `UserVolumeAccumulator \| null` | Pump |
| `getCreatorVaultBalance(creator)` | `BN` | Pump only |
| `getCreatorVaultBalanceBothPrograms(creator)` | `BN` | Pump + AMM |
| `getMinimumDistributableFee(mint)` | `MinimumDistributableFeeResult` | Pump + AMM |

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User has no volume accumulator account | `fetchUserVolumeAccumulator` returns `null`; unclaimed methods return `BN(0)` |
| Creator vault doesn't exist | `getCreatorVaultBalance` returns `BN(0)` |
| Sharing config not found for mint | `getMinimumDistributableFee` throws `Error` |
| User hasn't synced current day | `getCurrentDayTokens` returns `BN(0)` |
| Global volume is zero for a day | No tokens distributed (division-by-zero guarded) |
| Token not yet graduated | `isGraduated` is `false`; only bonding curve vault checked |

## Patterns to Follow

- Always use `BothPrograms` variants unless you specifically need single-program data
- All return values are `BN` (bn.js) — never convert to JavaScript `number` for financial math
- `totalUnclaimedTokens` excludes current-day rewards — add `getCurrentDayTokens` for full picture
- Call `syncUserVolumeAccumulator` before reading `getCurrentDayTokens` for accuracy
- This skill covers **read-only queries only** — for claiming and collecting, see the `pump-token-incentives` and `pump-fee-sharing` skills
