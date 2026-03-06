# Tutorial 15: Decoding On-Chain Accounts

> Read and decode every account type in the Pump protocol directly from the chain.

## Overview

The Pump SDK can decode all on-chain account types offline using `PUMP_SDK`'s decoder methods. This is useful for building explorers, dashboards, or analytics tools.

## Setup

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import {
  PUMP_SDK,
  OnlinePumpSdk,
  bondingCurvePda,
  feeSharingConfigPda,
  userVolumeAccumulatorPda,
  GLOBAL_PDA,
  PUMP_FEE_CONFIG_PDA,
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
} from "@pump-fun/pump-sdk";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
```

## Decoding Global State

The `Global` account stores protocol-wide configuration:

```typescript
const globalAccountInfo = await connection.getAccountInfo(GLOBAL_PDA);
if (globalAccountInfo) {
  const global = PUMP_SDK.decodeGlobal(globalAccountInfo);

  console.log("=== Global State ===");
  console.log("Authority:", global.authority.toBase58());
  console.log("Fee recipient:", global.feeRecipient.toBase58());
  console.log("Initial virtual token reserves:", global.initialVirtualTokenReserves.toString());
  console.log("Initial virtual SOL reserves:", global.initialVirtualSolReserves.toString());
  console.log("Token total supply:", global.tokenTotalSupply.toString());
  console.log("Fee basis points:", global.feeBasisPoints.toString());
  console.log("Creator fee BPS:", global.creatorFeeBasisPoints.toString());
  console.log("Create V2 enabled:", global.createV2Enabled);
  console.log("Mayhem mode enabled:", global.mayhemModeEnabled);
}
```

## Decoding Fee Config

```typescript
const feeConfigInfo = await connection.getAccountInfo(PUMP_FEE_CONFIG_PDA);
if (feeConfigInfo) {
  const feeConfig = PUMP_SDK.decodeFeeConfig(feeConfigInfo);

  console.log("=== Fee Config ===");
  console.log("Admin:", feeConfig.admin.toBase58());
  console.log("Flat fees:");
  console.log("  Protocol:", feeConfig.flatFees.protocolFeeBps.toString(), "BPS");
  console.log("  Creator:", feeConfig.flatFees.creatorFeeBps.toString(), "BPS");
  console.log("  LP:", feeConfig.flatFees.lpFeeBps.toString(), "BPS");

  console.log("Fee tiers:");
  for (const tier of feeConfig.feeTiers) {
    console.log(`  Market cap >= ${tier.marketCapLamportsThreshold.toString()} lamports:`);
    console.log(`    Protocol: ${tier.fees.protocolFeeBps.toString()} BPS`);
    console.log(`    Creator: ${tier.fees.creatorFeeBps.toString()} BPS`);
  }
}
```

## Decoding Bonding Curves

```typescript
const mint = new PublicKey("YOUR_TOKEN_MINT");
const bcPda = bondingCurvePda(mint);
const bcInfo = await connection.getAccountInfo(bcPda);

if (bcInfo) {
  const bc = PUMP_SDK.decodeBondingCurve(bcInfo);

  console.log("=== Bonding Curve ===");
  console.log("Virtual token reserves:", bc.virtualTokenReserves.toString());
  console.log("Virtual SOL reserves:", bc.virtualSolReserves.toString());
  console.log("Real token reserves:", bc.realTokenReserves.toString());
  console.log("Real SOL reserves:", bc.realSolReserves.toString());
  console.log("Token total supply:", bc.tokenTotalSupply.toString());
  console.log("Complete (graduated):", bc.complete);
  console.log("Creator:", bc.creator.toBase58());
  console.log("Mayhem mode:", bc.isMayhemMode);
}
```

### Safe Decoding with Nullable

For accounts that might have unusual sizes or formats:

```typescript
const bcSafe = PUMP_SDK.decodeBondingCurveNullable(bcInfo);
if (bcSafe) {
  console.log("Decoded successfully");
} else {
  console.log("Failed to decode — account may be corrupted or wrong format");
}
```

## Decoding Volume Accumulators

### Global Volume

```typescript
const globalVolInfo = await connection.getAccountInfo(GLOBAL_VOLUME_ACCUMULATOR_PDA);
if (globalVolInfo) {
  const globalVol = PUMP_SDK.decodeGlobalVolumeAccumulator(globalVolInfo);

  console.log("=== Global Volume Accumulator ===");
  console.log("Start time:", new Date(globalVol.startTime.toNumber() * 1000).toISOString());
  console.log("End time:", new Date(globalVol.endTime.toNumber() * 1000).toISOString());
  console.log("Seconds in a day:", globalVol.secondsInADay.toString());
  console.log("PUMP token mint:", globalVol.mint.toBase58());
  console.log("Days tracked:", globalVol.solVolumes.length);
}
```

### User Volume

```typescript
const user = new PublicKey("USER_WALLET");
const userVolPda = userVolumeAccumulatorPda(user);
const userVolInfo = await connection.getAccountInfo(userVolPda);

if (userVolInfo) {
  const userVol = PUMP_SDK.decodeUserVolumeAccumulator(userVolInfo);

  console.log("=== User Volume Accumulator ===");
  console.log("User:", userVol.user.toBase58());
  console.log("Needs claim:", userVol.needsClaim);
  console.log("Unclaimed tokens:", userVol.totalUnclaimedTokens.toString());
  console.log("Claimed tokens:", userVol.totalClaimedTokens.toString());
  console.log("Current SOL volume:", userVol.currentSolVolume.toString());
  console.log("Last update:", new Date(userVol.lastUpdateTimestamp.toNumber() * 1000).toISOString());
}
```

## Decoding Fee Sharing Config

```typescript
const sharingPda = feeSharingConfigPda(mint);
const sharingInfo = await connection.getAccountInfo(sharingPda);

if (sharingInfo) {
  const sharing = PUMP_SDK.decodeSharingConfig(sharingInfo);

  console.log("=== Fee Sharing Config ===");
  console.log("Version:", sharing.version);
  console.log("Mint:", sharing.mint.toBase58());
  console.log("Admin:", sharing.admin.toBase58());
  console.log("Admin revoked:", sharing.adminRevoked);
  console.log("Shareholders:");
  for (const sh of sharing.shareholders) {
    const pct = (sh.shareBps / 100).toFixed(2);
    console.log(`  ${sh.address.toBase58()}: ${sh.shareBps} BPS (${pct}%)`);
  }
}
```

## Batch Decoding: Build a Token Dashboard

```typescript
async function tokenDashboard(mints: PublicKey[]) {
  // Batch fetch all bonding curves
  const pdas = mints.map(m => bondingCurvePda(m));
  const accounts = await connection.getMultipleAccountsInfo(pdas);

  const results = mints.map((mint, i) => {
    const info = accounts[i];
    if (!info) return { mint: mint.toBase58(), status: "NOT_FOUND" };

    const bc = PUMP_SDK.decodeBondingCurveNullable(info);
    if (!bc) return { mint: mint.toBase58(), status: "DECODE_ERROR" };

    const price = bc.virtualTokenReserves.isZero()
      ? 0
      : bc.virtualSolReserves.toNumber() / bc.virtualTokenReserves.toNumber();

    return {
      mint: mint.toBase58().slice(0, 12) + "...",
      status: bc.complete ? "GRADUATED" : "ACTIVE",
      priceLamports: price.toFixed(6),
      realSolReserves: (bc.realSolReserves.toNumber() / 1e9).toFixed(4) + " SOL",
      creator: bc.creator.toBase58().slice(0, 12) + "...",
      mayhem: bc.isMayhemMode ? "YES" : "NO",
    };
  });

  console.table(results);
}

// Usage:
tokenDashboard([
  new PublicKey("MINT_1"),
  new PublicKey("MINT_2"),
  new PublicKey("MINT_3"),
]);
```

## Decoding Events

The SDK can also decode event data from transaction logs:

```typescript
// Decode a DistributeCreatorFees event
const eventData = Buffer.from(/* event data from logs */);
const event = PUMP_SDK.decodeDistributeCreatorFeesEvent(eventData);
console.log("Distribution event:");
console.log("  Mint:", event.mint.toBase58());
console.log("  Amount distributed:", event.distributed.toString());
console.log("  Shareholders:", event.shareholders.length);

// Decode a MinimumDistributableFee event
const feeEvent = PUMP_SDK.decodeMinimumDistributableFee(eventData);
```

## Complete Account Explorer

```typescript
async function fullExplorer(mint: PublicKey) {
  const pdas = [
    { name: "Global", pda: GLOBAL_PDA },
    { name: "Fee Config", pda: PUMP_FEE_CONFIG_PDA },
    { name: "Bonding Curve", pda: bondingCurvePda(mint) },
    { name: "Fee Sharing", pda: feeSharingConfigPda(mint) },
    { name: "Global Volume", pda: GLOBAL_VOLUME_ACCUMULATOR_PDA },
  ];

  const infos = await connection.getMultipleAccountsInfo(pdas.map(p => p.pda));

  for (let i = 0; i < pdas.length; i++) {
    const { name, pda } = pdas[i];
    const info = infos[i];
    console.log(`\n${name}: ${pda.toBase58()}`);

    if (!info) {
      console.log("  → Account does not exist");
      continue;
    }

    console.log(`  → ${info.data.length} bytes, ${info.lamports} lamports`);
    console.log(`  → Owner: ${info.owner.toBase58()}`);
  }
}

fullExplorer(new PublicKey("YOUR_MINT"));
```

## What's Next?

Go back to [Tutorial Index](./README.md) to explore more tutorials, or dive into the [SDK source code](../src/) to learn the internals.
