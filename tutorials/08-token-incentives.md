# Tutorial 8: Token Incentives and Volume Rewards

> Earn PUMP token rewards based on your trading volume.

## Overview

Pump's token incentive system distributes PUMP tokens to traders based on their SOL trading volume. The more you trade, the more PUMP tokens you earn — distributed daily based on a global schedule.

## How It Works

1. A **GlobalVolumeAccumulator** tracks total SOL volume per day across all traders
2. Each user has a **UserVolumeAccumulator** tracking their personal volume
3. PUMP tokens are allocated proportionally: `(your_volume / total_volume) × daily_allocation`
4. Users must **claim** their earned tokens explicitly

## Step 1: Check Your Unclaimed Rewards

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);

const user = new PublicKey("YOUR_WALLET_ADDRESS");

// Check unclaimed tokens
const unclaimed = await onlineSdk.getTotalUnclaimedTokens(user);
console.log("Unclaimed PUMP tokens:", unclaimed.toString());

// Check tokens earnable today based on current volume
const todayTokens = await onlineSdk.getCurrentDayTokens(user);
console.log("Tokens from today's trading:", todayTokens.toString());
```

## Step 2: Check Across Both Programs

Tokens might be claimable from both the original Pump program and PumpAMM. Use the `BothPrograms` methods:

```typescript
// Check unclaimed across both programs
const totalUnclaimed = await onlineSdk.getTotalUnclaimedTokensBothPrograms(user);
console.log("Total unclaimed (both programs):", totalUnclaimed.toString());

// Check today's earnings across both programs
const totalToday = await onlineSdk.getCurrentDayTokensBothPrograms(user);
console.log("Today's tokens (both programs):", totalToday.toString());
```

## Step 3: Claim Token Incentives

```typescript
import { Keypair, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

const userKeypair = Keypair.generate(); // Your funded keypair

// Claim from the original Pump program
const claimIxs = await onlineSdk.claimTokenIncentives(userKeypair.publicKey);

// Or claim from both programs at once
const claimBothIxs = await onlineSdk.claimTokenIncentivesBothPrograms(
  userKeypair.publicKey
);

const { blockhash } = await connection.getLatestBlockhash("confirmed");
const message = new TransactionMessage({
  payerKey: userKeypair.publicKey,
  recentBlockhash: blockhash,
  instructions: claimBothIxs,
}).compileToV0Message();

const tx = new VersionedTransaction(message);
tx.sign([userKeypair]);
await connection.sendTransaction(tx);
console.log("Tokens claimed!");
```

## Step 4: Sync Your Volume Accumulator

If your volume accumulator is out of date, you can sync it:

```typescript
// Sync on original program
const syncIx = await PUMP_SDK.syncUserVolumeAccumulator(userKeypair.publicKey);

// Sync across both programs
const syncBothIxs = await onlineSdk.syncUserVolumeAccumulatorBothPrograms(
  userKeypair.publicKey
);
```

## Understanding the Math

The SDK provides two utility functions for incentive calculations:

```typescript
import { totalUnclaimedTokens, currentDayTokens } from "@pump-fun/pump-sdk";

// Fetch the accumulators
const globalVol = await onlineSdk.fetchGlobalVolumeAccumulator();
const userVol = await onlineSdk.fetchUserVolumeAccumulator(user);

// Calculate unclaimed tokens
const unclaimed = totalUnclaimedTokens(globalVol, userVol);

// Calculate tokens earnable today
const today = currentDayTokens(globalVol, userVol);
```

### How Daily Allocation Works

```
Day 1: totalTokenSupply[0] = 1,000,000 PUMP
        totalSolVolume[0]   = 500 SOL
        Your volume          = 5 SOL
        Your share           = 5/500 × 1,000,000 = 10,000 PUMP

Day 2: totalTokenSupply[1] = 900,000 PUMP
        totalSolVolume[1]   = 300 SOL
        Your volume          = 15 SOL
        Your share           = 15/300 × 900,000 = 45,000 PUMP
```

## Fetching Volume Statistics

```typescript
const stats = await onlineSdk.fetchUserVolumeAccumulatorTotalStats(user);
console.log("Total unclaimed:", stats.totalUnclaimedTokens.toString());
console.log("Total claimed:", stats.totalClaimedTokens.toString());
console.log("Current SOL volume:", stats.currentSolVolume.toString());
```

## What's Next?

- [Tutorial 9: Understanding the Fee System](./09-fee-system.md)
- [Tutorial 11: Building a Trading Bot](./11-trading-bot.md)
