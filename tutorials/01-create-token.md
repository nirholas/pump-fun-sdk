# Tutorial 1: Create Your First Token on Pump

> Launch a token on the Pump bonding curve in under 50 lines of code.

## Prerequisites

- Node.js 18+
- A funded Solana wallet (devnet or mainnet)
- `@pump-fun/pump-sdk` installed

```bash
npm install @pump-fun/pump-sdk @solana/web3.js bn.js
```

## Step 1: Set Up the Connection

```typescript
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { PUMP_SDK, OnlinePumpSdk } from "@pump-fun/pump-sdk";

// Connect to Solana devnet (use mainnet-beta for production)
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);

// Load your wallet keypair
const creator = Keypair.generate(); // Replace with your funded keypair
```

## Step 2: Generate a Mint Keypair

Every Pump token needs a unique mint address. Generate one:

```typescript
const mint = Keypair.generate();
console.log("Token mint address:", mint.publicKey.toBase58());
```

## Step 3: Build the Create Instruction

Use `createV2Instruction` (the v1 `createInstruction` is deprecated):

```typescript
const createIx = await PUMP_SDK.createV2Instruction({
  mint: mint.publicKey,
  name: "My First Token",
  symbol: "MFT",
  uri: "https://example.com/metadata.json", // Your token metadata URI
  creator: creator.publicKey,
  user: creator.publicKey,
  mayhemMode: false,
  cashback: false,
});
```

### What's happening here?

- `mint` — The new token's mint address (you must sign with this keypair)
- `name` / `symbol` / `uri` — Standard SPL token metadata
- `creator` — The address that receives creator fees from trading
- `user` — The wallet paying for the transaction
- `mayhemMode` — When `true`, enables special Mayhem mode mechanics
- `cashback` — When `true`, enables cashback rewards on this token

## Step 4: Send the Transaction

```typescript
import {
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

const { blockhash } = await connection.getLatestBlockhash("confirmed");

const message = new TransactionMessage({
  payerKey: creator.publicKey,
  recentBlockhash: blockhash,
  instructions: [createIx],
}).compileToV0Message();

const tx = new VersionedTransaction(message);
tx.sign([creator, mint]); // Both creator AND mint must sign

const signature = await connection.sendTransaction(tx);
console.log("Token created! Tx:", signature);
```

> **Important:** The mint keypair must sign the transaction — this proves you own the mint address.

## Step 5: Verify Your Token

```typescript
const bondingCurve = await onlineSdk.fetchBondingCurve(mint.publicKey);
console.log("Token total supply:", bondingCurve.tokenTotalSupply.toString());
console.log("Bonding curve complete:", bondingCurve.complete);
console.log("Creator:", bondingCurve.creator.toBase58());
```

## Full Example

```typescript
import { Connection, Keypair, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { PUMP_SDK, OnlinePumpSdk } from "@pump-fun/pump-sdk";

async function createToken() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const creator = Keypair.generate(); // Use your funded keypair
  const mint = Keypair.generate();

  // Build the instruction
  const createIx = await PUMP_SDK.createV2Instruction({
    mint: mint.publicKey,
    name: "My First Token",
    symbol: "MFT",
    uri: "https://example.com/metadata.json",
    creator: creator.publicKey,
    user: creator.publicKey,
    mayhemMode: false,
    cashback: false,
  });

  // Send transaction
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: creator.publicKey,
    recentBlockhash: blockhash,
    instructions: [createIx],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([creator, mint]);

  const signature = await connection.sendTransaction(tx);
  console.log("Token created!", signature);
}

createToken();
```

## What's Next?

- [Tutorial 2: Buy Tokens from the Bonding Curve](./02-buy-tokens.md)
- [Tutorial 4: Create and Buy in One Transaction](./04-create-and-buy.md)
- [Tutorial 7: Set Up Fee Sharing](./07-fee-sharing.md)
