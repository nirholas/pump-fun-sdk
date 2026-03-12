# Tutorial 7: Set Up Creator Fee Sharing

> Split creator fees among multiple shareholders — teams, DAOs, or communities.

## Overview

When tokens trade on Pump, creator fees are generated on every buy and sell. By default, all creator fees go to a single creator address. **Fee sharing** lets you split these fees among up to 10 shareholders with precise basis-point allocations.

## Prerequisites

```bash
npm install @nirholas/pump-sdk @solana/web3.js
```

## Step 1: Create a Fee Sharing Config

First, the token creator must create a sharing config:

```typescript
import { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { PUMP_SDK } from "@nirholas/pump-sdk";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const creator = Keypair.generate(); // The token creator
const mint = new PublicKey("YOUR_TOKEN_MINT_ADDRESS");

const createConfigIx = await PUMP_SDK.createFeeSharingConfig({
  creator: creator.publicKey,
  mint,
  pool: null, // null for ungraduated coins, pool address for graduated
});

const { blockhash } = await connection.getLatestBlockhash("confirmed");
const message = new TransactionMessage({
  payerKey: creator.publicKey,
  recentBlockhash: blockhash,
  instructions: [createConfigIx],
}).compileToV0Message();

const tx = new VersionedTransaction(message);
tx.sign([creator]);
await connection.sendTransaction(tx);
console.log("Fee sharing config created!");
```

## Step 2: Set Up Shareholders

Define how fees are split. Shares are in **basis points** (BPS) where 10,000 BPS = 100%:

```typescript
import { Shareholder } from "@nirholas/pump-sdk";

const shareholders: Shareholder[] = [
  { address: new PublicKey("Wallet1..."), shareBps: 5000 }, // 50%
  { address: new PublicKey("Wallet2..."), shareBps: 3000 }, // 30%
  { address: new PublicKey("Wallet3..."), shareBps: 2000 }, // 20%
];

// Total MUST equal exactly 10,000 BPS (100%)
const total = shareholders.reduce((sum, s) => sum + s.shareBps, 0);
console.log("Total:", total, "BPS"); // Must be 10000
```

## Step 3: Update Fee Shares

```typescript
const updateIx = await PUMP_SDK.updateFeeShares({
  authority: creator.publicKey,
  mint,
  currentShareholders: [],  // Empty on first setup
  newShareholders: shareholders,
});

const { blockhash: bh2 } = await connection.getLatestBlockhash("confirmed");
const msg2 = new TransactionMessage({
  payerKey: creator.publicKey,
  recentBlockhash: bh2,
  instructions: [updateIx],
}).compileToV0Message();

const tx2 = new VersionedTransaction(msg2);
tx2.sign([creator]);
await connection.sendTransaction(tx2);
console.log("Fee shares updated!");
```

## Step 4: Distribute Accumulated Fees

Fees accumulate in a vault. Anyone can trigger distribution:

```typescript
import { feeSharingConfigPda } from "@nirholas/pump-sdk";

const sharingConfigAddress = feeSharingConfigPda(mint);

// You need the current sharing config state
// In a real app, fetch this from the chain
const sharingConfig = {
  version: 1,
  mint,
  admin: creator.publicKey,
  adminRevoked: false,
  shareholders,
};

const distributeIx = await PUMP_SDK.distributeCreatorFees({
  mint,
  sharingConfig,
  sharingConfigAddress,
});

// Send the instruction...
```

## Validation Rules

The SDK enforces these rules and throws descriptive errors:

| Rule | Error |
|------|-------|
| At least 1 shareholder | `NoShareholdersError` |
| Maximum 10 shareholders | `TooManyShareholdersError` |
| Each share > 0 BPS | `ZeroShareError` |
| Total = exactly 10,000 BPS | `InvalidShareTotalError` |
| No duplicate addresses | `DuplicateShareholderError` |

```typescript
import {
  NoShareholdersError,
  TooManyShareholdersError,
  ZeroShareError,
  InvalidShareTotalError,
  DuplicateShareholderError,
} from "@nirholas/pump-sdk";

try {
  await PUMP_SDK.updateFeeShares({
    authority: creator.publicKey,
    mint,
    currentShareholders: [],
    newShareholders: [
      { address: wallet1, shareBps: 6000 },
      { address: wallet2, shareBps: 3000 },
      // Missing 1000 BPS! Total = 9000
    ],
  });
} catch (error) {
  if (error instanceof InvalidShareTotalError) {
    console.log("Shares must total 10,000 BPS. Got:", error.message);
  }
}
```

## Checking if a Token Uses Fee Sharing

```typescript
import { isCreatorUsingSharingConfig } from "@nirholas/pump-sdk";

const bondingCurve = await onlineSdk.fetchBondingCurve(mint);

const usesFeeSharing = isCreatorUsingSharingConfig({
  mint,
  creator: bondingCurve.creator,
});

console.log("Uses fee sharing:", usesFeeSharing);
```

## Authority Management

The creator (authority) of a fee sharing config can transfer control, reset the config, or permanently revoke their authority.

### Transfer Authority

Hand admin control to a new address (e.g., a multisig or DAO):

```typescript
const transferIx = await PUMP_SDK.transferFeeSharingAuthorityInstruction({
  authority: creator.publicKey,
  mint,
  newAdmin: new PublicKey("NEW_ADMIN_ADDRESS"),
});
```

### Reset Fee Sharing Config

Wipe the existing shareholders and reassign admin. Useful when restructuring a team:

```typescript
const resetIx = await PUMP_SDK.resetFeeSharingConfigInstruction({
  authority: creator.publicKey,
  mint,
  newAdmin: new PublicKey("NEW_ADMIN_ADDRESS"),
});
// After reset, set up new shareholders with updateFeeShares
```

### Revoke Authority (Irreversible)

Permanently lock the fee sharing config so no one can change shareholders again:

```typescript
const revokeIx = await PUMP_SDK.revokeFeeSharingAuthorityInstruction({
  authority: creator.publicKey,
  mint,
});
```

> **Warning:** Revoking authority is permanent. The shareholder split becomes immutable. Do this only when you're confident the config is final.

## Updating Existing Shareholders

When updating an existing config, pass the current shareholders so the SDK can compute the correct account diffs:

```typescript
const currentShareholders = [
  new PublicKey("Wallet1..."),
  new PublicKey("Wallet2..."),
  new PublicKey("Wallet3..."),
];

const updateIx = await PUMP_SDK.updateFeeShares({
  authority: creator.publicKey,
  mint,
  currentShareholders,  // Pass existing addresses
  newShareholders: [
    { address: new PublicKey("Wallet1..."), shareBps: 3000 }, // Changed from 50% to 30%
    { address: new PublicKey("Wallet4..."), shareBps: 7000 }, // New shareholder
  ],
});
```

## Graduated Tokens

For tokens that have graduated to the AMM, pass the pool address when creating the config:

```typescript
import { canonicalPumpPoolPda } from "@nirholas/pump-sdk";

const pool = canonicalPumpPoolPda(mint);

const configIx = await PUMP_SDK.createFeeSharingConfig({
  creator: creator.publicKey,
  mint,
  pool, // Required for graduated tokens
});
```

## What's Next?

- [Tutorial 8: Token Incentives and Rewards](./08-token-incentives.md)
- [Tutorial 9: Understanding the Fee System](./09-fee-system.md)

