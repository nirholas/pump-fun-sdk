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
import { OnlinePumpSdk } from "@nirholas/pump-sdk";

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
import { totalUnclaimedTokens, currentDayTokens } from "@nirholas/pump-sdk";

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

## Step 5: Initialize Your Volume Accumulator

Before you can earn rewards, your user volume accumulator account must exist on-chain. If it doesn't, the claim will fail:

```typescript
import { PUMP_SDK, userVolumeAccumulatorPda } from "@nirholas/pump-sdk";

// Check if accumulator already exists
const accPda = userVolumeAccumulatorPda(userKeypair.publicKey);
const accInfo = await connection.getAccountInfo(accPda);

if (!accInfo) {
  // First time — initialize volume tracking
  const initIx = await PUMP_SDK.initUserVolumeAccumulator({
    payer: userKeypair.publicKey,
    user: userKeypair.publicKey,
  });

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: userKeypair.publicKey,
    recentBlockhash: blockhash,
    instructions: [initIx],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([userKeypair]);
  await connection.sendTransaction(tx);
  console.log("Volume accumulator initialized!");
}
```

### Close the Accumulator (Reclaim Rent)

When you're done tracking volume, close the account to reclaim rent:

```typescript
const closeIx = await PUMP_SDK.closeUserVolumeAccumulator(userKeypair.publicKey);
```

> **Warning:** Closing the accumulator forfeits any unclaimed tokens. Always claim first.

## Fetching Volume Statistics

```typescript
const stats = await onlineSdk.fetchUserVolumeAccumulatorTotalStats(user);
console.log("Total unclaimed:", stats.totalUnclaimedTokens.toString());
console.log("Total claimed:", stats.totalClaimedTokens.toString());
console.log("Current SOL volume:", stats.currentSolVolume.toString());
```

## Edge Cases & Troubleshooting

### No Accumulator Account

If `fetchUserVolumeAccumulator` or `claimTokenIncentives` fails with an account-not-found error, the user hasn't initialized their volume accumulator yet. See Step 5 above.

### Nothing to Claim

If `getTotalUnclaimedTokens` returns zero, either:
- The user hasn't traded since their last claim
- The daily allocation hasn't been updated yet (try syncing first)
- All tokens for the day have already been distributed

Always check the unclaimed amount before building a claim transaction:

```typescript
const unclaimed = await onlineSdk.getTotalUnclaimedTokensBothPrograms(user);
if (unclaimed.gtn(0)) {
  const claimIxs = await onlineSdk.claimTokenIncentivesBothPrograms(user);
  // ... send transaction
} else {
  console.log("Nothing to claim yet — keep trading!");
}
```

### Stale Volume Data

If your rewards seem lower than expected, your accumulator may be out of date. Sync it to pull in the latest global state:

```typescript
const syncIxs = await onlineSdk.syncUserVolumeAccumulatorBothPrograms(
  userKeypair.publicKey
);
// Send sync transaction, then check unclaimed again
```

### AMM vs Bonding Curve Volume

Volume from bonding curve trades and AMM pool trades are tracked separately. Use the `BothPrograms` methods to see combined totals. If you only check one program, you may be missing rewards from the other.

## What's Next?

- [Tutorial 9: Understanding the Fee System](./09-fee-system.md)
- [Tutorial 11: Building a Trading Bot](./11-trading-bot.md)

