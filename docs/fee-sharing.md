# Fee Sharing Guide

Set up and manage creator fee distribution among multiple shareholders.

<div align="center">
  <img src="assets/pump.svg" alt="Fee sharing flow — trades to creator vault to shareholders" width="720">
</div>

## Overview

Fee sharing allows token creators to split their accumulated trading fees among up to 10 shareholders. This is managed through the **PumpFees** program and works for both bonding curve tokens and graduated AMM tokens.

## Prerequisites

```typescript
import { Connection, PublicKey, Transaction, Keypair } from "@solana/web3.js";
import {
  PUMP_SDK,
  OnlinePumpSdk,
  isCreatorUsingSharingConfig,
  feeSharingConfigPda,
} from "@pump-fun/pump-sdk";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);
```

## Step 1: Create a Fee Sharing Config

After creating a token, set up fee sharing:

```typescript
const mint = new PublicKey("your-token-mint");
const creator = wallet.publicKey;

// For non-graduated tokens (still on bonding curve):
const ix = await PUMP_SDK.createFeeSharingConfig({
  creator,
  mint,
  pool: null,
});

// For graduated tokens (on AMM), you must provide the pool:
import { canonicalPumpPoolPda } from "@pump-fun/pump-sdk";
const pool = canonicalPumpPoolPda(mint);

const ix = await PUMP_SDK.createFeeSharingConfig({
  creator,
  mint,
  pool,
});
```

> **Note:** For graduated tokens (`bondingCurve.complete === true`), you must provide the pool address. For ungraduated tokens, pass `pool: null`.

## Step 2: Set Up Shareholders

Define how fees are split. Shares are in basis points (bps), where 10,000 bps = 100%.

```typescript
const shareholders = [
  { address: new PublicKey("wallet-A"), shareBps: 5000 }, // 50%
  { address: new PublicKey("wallet-B"), shareBps: 3000 }, // 30%
  { address: new PublicKey("wallet-C"), shareBps: 2000 }, // 20%
];

const ix = await PUMP_SDK.updateFeeShares({
  authority: creator,          // The config admin
  mint,
  currentShareholders: [],     // Empty on first setup
  newShareholders: shareholders,
});
```

### Validation Rules

The SDK validates shareholders before building the instruction:

| Rule | Error |
|------|-------|
| At least 1 shareholder | `NoShareholdersError` |
| Maximum 10 shareholders | `TooManyShareholdersError` |
| No zero shares | `ZeroShareError` |
| Shares sum to 10,000 bps | `InvalidShareTotalError` |
| No duplicate addresses | `DuplicateShareholderError` |

## Step 3: Check Distributable Fees

Before distributing, check if there are enough accumulated fees:

```typescript
const result = await onlineSdk.getMinimumDistributableFee(mint);

console.log("Minimum required:", result.minimumRequired.toString());
console.log("Available:", result.distributableFees.toString());
console.log("Can distribute:", result.canDistribute);
console.log("Token graduated:", result.isGraduated);
```

## Step 4: Distribute Fees

When fees are ready, build and send the distribution transaction:

```typescript
const { instructions, isGraduated } =
  await onlineSdk.buildDistributeCreatorFeesInstructions(mint);

const tx = new Transaction().add(...instructions);
const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
```

For graduated tokens, the method automatically includes a `transferCreatorFeesToPump` instruction to consolidate AMM vault fees before distributing.

## Checking Fee Sharing Status

Verify whether a creator has already set up fee sharing:

```typescript
const isSharing = isCreatorUsingSharingConfig({ mint, creator });

if (isSharing) {
  // Fee sharing is active
  const configAddress = feeSharingConfigPda(mint);
  // ... decode and inspect the config
}
```

## Updating Shareholders

To change the distribution, pass both current and new shareholders:

```typescript
const currentShareholders = [
  new PublicKey("wallet-A"),
  new PublicKey("wallet-B"),
  new PublicKey("wallet-C"),
];

const newShareholders = [
  { address: new PublicKey("wallet-A"), shareBps: 6000 },
  { address: new PublicKey("wallet-D"), shareBps: 4000 },
];

const ix = await PUMP_SDK.updateFeeShares({
  authority: creator,
  mint,
  currentShareholders,  // PublicKey[] of current shareholders
  newShareholders,
});
```

## Collecting Creator Fees (Without Sharing)

If fee sharing is not set up, creators can collect fees directly:

```typescript
// Collect from both Pump and AMM programs
const instructions = await onlineSdk.collectCoinCreatorFeeInstructions(creator);

// Check balance before collecting
const balance = await onlineSdk.getCreatorVaultBalanceBothPrograms(creator);
console.log("Uncollected fees:", balance.toString(), "lamports");
```

