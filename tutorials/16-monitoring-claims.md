# Tutorial 16: Monitoring Claims

> Build a monitoring dashboard that tracks token incentive claims, creator fee distributions, cashback, and creator vault balances in real time.

## Overview

The Pump protocol has four claimable reward streams:

| Stream | Who Claims | SDK Method | What's Claimed |
|--------|-----------|------------|----------------|
| **Token incentives** | Any trader | `claimTokenIncentives()` | PUMP tokens based on SOL volume |
| **Creator fees** | Token creators | `collectCoinCreatorFeeInstructions()` | SOL from trading fees |
| **Fee sharing** | Shareholders | `distributeCreatorFees()` | SOL split among shareholders |
| **Cashback** | Traders (v2 tokens) | `claimCashbackInstruction()` | SOL cashback on trades |

This tutorial shows how to monitor all of them.

---

## Setup

```typescript
import { Connection, PublicKey, TransactionMessage, VersionedTransaction, Keypair } from "@solana/web3.js";
import {
  OnlinePumpSdk,
  PUMP_SDK,
  totalUnclaimedTokens,
  currentDayTokens,
  userVolumeAccumulatorPda,
  feeSharingConfigPda,
  creatorVaultPda,
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
} from "@pump-fun/pump-sdk";
import BN from "bn.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);
```

---

## 1. Monitor Token Incentive Claims

### Check Unclaimed Tokens for a User

```typescript
async function checkUnclaimedTokens(user: PublicKey) {
  // Single program
  const unclaimed = await onlineSdk.getTotalUnclaimedTokens(user);
  
  // Both programs (Pump + PumpAMM)
  const unclaimedBoth = await onlineSdk.getTotalUnclaimedTokensBothPrograms(user);

  // Current day's projected tokens
  const todayTokens = await onlineSdk.getCurrentDayTokens(user);
  const todayBoth = await onlineSdk.getCurrentDayTokensBothPrograms(user);

  console.log("=== Token Incentives ===");
  console.log("Unclaimed (Pump):     ", unclaimed.toString());
  console.log("Unclaimed (both):     ", unclaimedBoth.toString());
  console.log("Today projected (Pump):", todayTokens.toString());
  console.log("Today projected (both):", todayBoth.toString());

  return { unclaimed: unclaimedBoth, today: todayBoth };
}
```

### Deep Dive: Volume Accumulator State

```typescript
async function inspectVolumeAccumulator(user: PublicKey) {
  const stats = await onlineSdk.fetchUserVolumeAccumulatorTotalStats(user);

  console.log("=== Volume Accumulator Stats (Both Programs) ===");
  console.log("Total unclaimed tokens:", stats.totalUnclaimedTokens.toString());
  console.log("Total claimed tokens:  ", stats.totalClaimedTokens.toString());
  console.log("Current SOL volume:    ", stats.currentSolVolume.toString(), "lamports");
  console.log("Current SOL volume:    ", (stats.currentSolVolume.toNumber() / 1e9).toFixed(4), "SOL");

  // Check raw accumulator for more detail
  const raw = await onlineSdk.fetchUserVolumeAccumulator(user);
  if (raw) {
    console.log("\n--- Raw Accumulator ---");
    console.log("Needs claim:", raw.needsClaim);
    console.log("Last update: ", new Date(raw.lastUpdateTimestamp.toNumber() * 1000).toISOString());
  } else {
    console.log("\nNo volume accumulator — user hasn't traded yet");
  }

  return stats;
}
```

### Calculate Unclaimed Tokens Offline

If you've already fetched the account data, use the pure math functions:

```typescript
async function calculateUnclaimedOffline(user: PublicKey) {
  const [globalAccInfo, userAccInfo] = await connection.getMultipleAccountsInfo([
    GLOBAL_VOLUME_ACCUMULATOR_PDA,
    userVolumeAccumulatorPda(user),
  ]);

  if (!globalAccInfo || !userAccInfo) {
    console.log("Accounts not found — no incentives available");
    return new BN(0);
  }

  const globalVol = PUMP_SDK.decodeGlobalVolumeAccumulator(globalAccInfo);
  const userVol = PUMP_SDK.decodeUserVolumeAccumulator(userAccInfo);

  // Pure functions — no RPC calls
  const unclaimed = totalUnclaimedTokens(globalVol, userVol);
  const today = currentDayTokens(globalVol, userVol);

  console.log("Unclaimed (offline calc):", unclaimed.toString());
  console.log("Today (offline calc):    ", today.toString());

  return unclaimed;
}
```

### Claim Token Incentives

```typescript
async function claimIncentives(user: Keypair) {
  // Build claim instructions for both programs
  const claimIxs = await onlineSdk.claimTokenIncentivesBothPrograms(
    user.publicKey,
    user.publicKey, // payer
  );

  if (claimIxs.length === 0) {
    console.log("Nothing to claim (no PUMP mint configured or no accumulator)");
    return null;
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: user.publicKey,
    recentBlockhash: blockhash,
    instructions: claimIxs,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([user]);

  const sig = await connection.sendTransaction(tx);
  console.log("Claimed! Tx:", sig);
  return sig;
}
```

---

## 2. Monitor Creator Fee Vaults

### Check Creator Vault Balance

```typescript
async function checkCreatorVault(creator: PublicKey) {
  // Balance from Pump program
  const pumpBalance = await onlineSdk.getCreatorVaultBalance(creator);

  // Balance from both Pump + PumpAMM
  const totalBalance = await onlineSdk.getCreatorVaultBalanceBothPrograms(creator);

  const ammBalance = totalBalance.sub(pumpBalance);

  console.log("=== Creator Fee Vault ===");
  console.log("Creator:", creator.toBase58());
  console.log("Pump vault:    ", (pumpBalance.toNumber() / 1e9).toFixed(6), "SOL");
  console.log("PumpAMM vault: ", (ammBalance.toNumber() / 1e9).toFixed(6), "SOL");
  console.log("Total:         ", (totalBalance.toNumber() / 1e9).toFixed(6), "SOL");

  return { pumpBalance, ammBalance, totalBalance };
}
```

### Collect Creator Fees

```typescript
async function collectCreatorFees(creator: Keypair) {
  const collectIxs = await onlineSdk.collectCoinCreatorFeeInstructions(
    creator.publicKey,
    creator.publicKey, // feePayer
  );

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: creator.publicKey,
    recentBlockhash: blockhash,
    instructions: collectIxs,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([creator]);

  const sig = await connection.sendTransaction(tx);
  console.log("Collected creator fees! Tx:", sig);
  return sig;
}
```

---

## 3. Monitor Fee Sharing Distributions

### Check Fee Sharing Config for a Token

```typescript
async function checkFeeSharing(mint: PublicKey) {
  const sharingPda = feeSharingConfigPda(mint);
  const sharingInfo = await connection.getAccountInfo(sharingPda);

  if (!sharingInfo) {
    console.log("No fee sharing config for this token");
    return null;
  }

  const config = PUMP_SDK.decodeSharingConfig(sharingInfo);

  console.log("=== Fee Sharing Config ===");
  console.log("Mint: ", config.mint.toBase58());
  console.log("Admin:", config.admin.toBase58());
  console.log("Admin revoked:", config.adminRevoked);
  console.log("Shareholders:");

  for (const sh of config.shareholders) {
    const pct = (sh.shareBps / 100).toFixed(2);
    console.log(`  ${sh.address.toBase58()}: ${sh.shareBps} BPS (${pct}%)`);
  }

  // Check the vault balance for this sharing config
  const vaultPda = creatorVaultPda(sharingPda);
  const vaultInfo = await connection.getAccountInfo(vaultPda);
  if (vaultInfo) {
    const rent = await connection.getMinimumBalanceForRentExemption(vaultInfo.data.length);
    const distributable = Math.max(0, vaultInfo.lamports - rent);
    console.log(`\nDistributable: ${(distributable / 1e9).toFixed(6)} SOL`);
  }

  return config;
}
```

### Check Minimum Distributable Fee

Before distributing, check if the vault has enough:

```typescript
async function checkMinimumDistributable(mint: PublicKey) {
  const sharingPda = feeSharingConfigPda(mint);
  const sharingInfo = await connection.getAccountInfo(sharingPda);

  if (!sharingInfo) return null;

  const config = PUMP_SDK.decodeSharingConfig(sharingInfo);

  const ix = await PUMP_SDK.getMinimumDistributableFee({
    mint,
    sharingConfig: config,
    sharingConfigAddress: sharingPda,
  });

  // Simulate to get the event data
  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: config.admin,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();

  const result = await connection.simulateTransaction(new VersionedTransaction(message));

  // Parse logs for the MinimumDistributableFee event
  if (result.value.logs) {
    for (const log of result.value.logs) {
      if (log.includes("minimumDistributableFeeEvent")) {
        console.log("Event log:", log);
      }
    }
  }
}
```

### Distribute Creator Fees to Shareholders

```typescript
async function distributeFees(mint: PublicKey, admin: Keypair) {
  const sharingPda = feeSharingConfigPda(mint);
  const sharingInfo = await connection.getAccountInfo(sharingPda);

  if (!sharingInfo) {
    console.log("No fee sharing config");
    return null;
  }

  const config = PUMP_SDK.decodeSharingConfig(sharingInfo);

  const distributeIx = await PUMP_SDK.distributeCreatorFees({
    mint,
    sharingConfig: config,
    sharingConfigAddress: sharingPda,
  });

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: admin.publicKey,
    recentBlockhash: blockhash,
    instructions: [distributeIx],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([admin]);

  const sig = await connection.sendTransaction(tx);
  console.log("Distributed! Tx:", sig);
  return sig;
}
```

### Decode Distribution Events from Transaction Logs

```typescript
async function decodeDistributionEvent(txSignature: string) {
  const tx = await connection.getTransaction(txSignature, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx?.meta?.innerInstructions) return null;

  // Look for event data in inner instructions
  for (const inner of tx.meta.innerInstructions) {
    for (const ix of inner.instructions) {
      try {
        const data = Buffer.from(ix.data, "base64");
        const event = PUMP_SDK.decodeDistributeCreatorFeesEvent(data);
        console.log("=== Distribution Event ===");
        console.log("Timestamp:", new Date(event.timestamp.toNumber() * 1000).toISOString());
        console.log("Mint:", event.mint.toBase58());
        console.log("Amount distributed:", (event.distributed.toNumber() / 1e9).toFixed(6), "SOL");
        console.log("Shareholders:", event.shareholders.length);
        for (const sh of event.shareholders) {
          const pct = (sh.shareBps / 100).toFixed(2);
          console.log(`  ${sh.address.toBase58()}: ${pct}%`);
        }
        return event;
      } catch {
        // Not this event type, continue
      }
    }
  }
  return null;
}
```

---

## 4. Cashback Monitoring

### Claim Cashback

Tokens created with `cashback: true` in `createV2Instruction` accumulate cashback for traders:

```typescript
async function claimCashback(user: Keypair) {
  const ix = await PUMP_SDK.claimCashbackInstruction({
    user: user.publicKey,
  });

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: user.publicKey,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([user]);

  const sig = await connection.sendTransaction(tx);
  console.log("Cashback claimed! Tx:", sig);
  return sig;
}
```

---

## 5. Full Claims Dashboard

Monitor all claimable rewards in one shot:

```typescript
interface ClaimsDashboard {
  user: string;
  tokenIncentives: {
    unclaimed: string;
    todayProjected: string;
    totalClaimed: string;
    currentVolumeSol: string;
    needsSync: boolean;
  };
  creatorVault: {
    pumpBalanceSol: string;
    totalBalanceSol: string;
  };
  feeSharingTokens: {
    mint: string;
    distributableSol: string;
    shareholders: number;
  }[];
}

async function fullClaimsDashboard(
  user: PublicKey,
  createdTokens: PublicKey[] = [],
): Promise<ClaimsDashboard> {
  // 1. Token incentives
  const unclaimedBoth = await onlineSdk.getTotalUnclaimedTokensBothPrograms(user);
  const todayBoth = await onlineSdk.getCurrentDayTokensBothPrograms(user);
  const stats = await onlineSdk.fetchUserVolumeAccumulatorTotalStats(user);
  const rawAcc = await onlineSdk.fetchUserVolumeAccumulator(user);

  // 2. Creator vault balance
  const vaultBalance = await onlineSdk.getCreatorVaultBalanceBothPrograms(user);
  const pumpOnly = await onlineSdk.getCreatorVaultBalance(user);

  // 3. Fee sharing for created tokens
  const sharingResults = [];
  for (const mint of createdTokens) {
    const sharingPda = feeSharingConfigPda(mint);
    const sharingInfo = await connection.getAccountInfo(sharingPda);
    if (!sharingInfo) continue;

    const config = PUMP_SDK.decodeSharingConfig(sharingInfo);
    const vaultPda = creatorVaultPda(sharingPda);
    const vaultInfo = await connection.getAccountInfo(vaultPda);
    const rent = vaultInfo
      ? await connection.getMinimumBalanceForRentExemption(vaultInfo.data.length)
      : 0;
    const distributable = vaultInfo ? Math.max(0, vaultInfo.lamports - rent) : 0;

    sharingResults.push({
      mint: mint.toBase58(),
      distributableSol: (distributable / 1e9).toFixed(6),
      shareholders: config.shareholders.length,
    });
  }

  const dashboard: ClaimsDashboard = {
    user: user.toBase58(),
    tokenIncentives: {
      unclaimed: unclaimedBoth.toString(),
      todayProjected: todayBoth.toString(),
      totalClaimed: stats.totalClaimedTokens.toString(),
      currentVolumeSol: (stats.currentSolVolume.toNumber() / 1e9).toFixed(4),
      needsSync: rawAcc?.needsClaim ?? false,
    },
    creatorVault: {
      pumpBalanceSol: (pumpOnly.toNumber() / 1e9).toFixed(6),
      totalBalanceSol: (vaultBalance.toNumber() / 1e9).toFixed(6),
    },
    feeSharingTokens: sharingResults,
  };

  return dashboard;
}

// Usage
const user = new PublicKey("USER_WALLET");
const tokens = [new PublicKey("TOKEN_MINT_1"), new PublicKey("TOKEN_MINT_2")];

const dashboard = await fullClaimsDashboard(user, tokens);
console.log(JSON.stringify(dashboard, null, 2));
```

---

## 6. Polling Loop: Claim When Ready

```typescript
async function monitorAndClaim(user: Keypair, intervalMs = 60_000) {
  console.log("Starting claims monitor for", user.publicKey.toBase58());

  while (true) {
    try {
      // Check token incentives
      const unclaimed = await onlineSdk.getTotalUnclaimedTokensBothPrograms(user.publicKey);
      if (!unclaimed.isZero()) {
        console.log(`[${new Date().toISOString()}] Unclaimed tokens: ${unclaimed.toString()}`);

        // Sync volume accumulator first
        const syncIx = await PUMP_SDK.syncUserVolumeAccumulator(user.publicKey);
        const claimIxs = await onlineSdk.claimTokenIncentivesBothPrograms(
          user.publicKey,
          user.publicKey,
        );

        if (claimIxs.length > 0) {
          const { blockhash } = await connection.getLatestBlockhash("confirmed");
          const message = new TransactionMessage({
            payerKey: user.publicKey,
            recentBlockhash: blockhash,
            instructions: [syncIx, ...claimIxs],
          }).compileToV0Message();

          const tx = new VersionedTransaction(message);
          tx.sign([user]);
          const sig = await connection.sendTransaction(tx);
          console.log(`  → Claimed! Tx: ${sig}`);
        }
      }

      // Check creator vault
      const vaultBalance = await onlineSdk.getCreatorVaultBalanceBothPrograms(user.publicKey);
      if (vaultBalance.gt(new BN(10_000_000))) { // > 0.01 SOL threshold
        console.log(`[${new Date().toISOString()}] Creator vault: ${(vaultBalance.toNumber() / 1e9).toFixed(6)} SOL`);

        const collectIxs = await onlineSdk.collectCoinCreatorFeeInstructions(
          user.publicKey,
          user.publicKey,
        );

        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        const message = new TransactionMessage({
          payerKey: user.publicKey,
          recentBlockhash: blockhash,
          instructions: collectIxs,
        }).compileToV0Message();

        const tx = new VersionedTransaction(message);
        tx.sign([user]);
        const sig = await connection.sendTransaction(tx);
        console.log(`  → Collected! Tx: ${sig}`);
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error:`, err);
    }

    await new Promise(r => setTimeout(r, intervalMs));
  }
}
```

---

## Key SDK Methods Reference

| Method | Returns | Program |
|--------|---------|---------|
| `getTotalUnclaimedTokens(user)` | `BN` | Pump |
| `getTotalUnclaimedTokensBothPrograms(user)` | `BN` | Pump + AMM |
| `getCurrentDayTokens(user)` | `BN` | Pump |
| `getCurrentDayTokensBothPrograms(user)` | `BN` | Pump + AMM |
| `fetchUserVolumeAccumulatorTotalStats(user)` | Stats object | Pump + AMM |
| `claimTokenIncentives(user, payer)` | `Ix[]` | Pump |
| `claimTokenIncentivesBothPrograms(user, payer)` | `Ix[]` | Pump + AMM |
| `getCreatorVaultBalance(creator)` | `BN` | Pump |
| `getCreatorVaultBalanceBothPrograms(creator)` | `BN` | Pump + AMM |
| `collectCoinCreatorFeeInstructions(creator, payer)` | `Ix[]` | Pump + AMM |
| `distributeCreatorFees({...})` | `Ix` | Pump |
| `claimCashbackInstruction({user})` | `Ix` | Pump |
| `syncUserVolumeAccumulator(user)` | `Ix` | Pump |

## What's Next?

- [Tutorial 08: Token Incentives](./08-token-incentives.md) — deeper dive on the incentive math
- [Tutorial 07: Fee Sharing Setup](./07-fee-sharing.md) — configuring shareholders
- [Tutorial 11: Building a Trading Bot](./11-trading-bot.md) — automate trading
