# Tutorial 2: Buy Tokens from the Bonding Curve

> Purchase tokens using SOL through the Pump bonding curve.

## Prerequisites

- Completed [Tutorial 1](./01-create-token.md) or have a known token mint address
- A funded Solana wallet

```bash
npm install @pump-fun/pump-sdk @solana/web3.js bn.js
```

## How Buying Works

When you buy tokens on Pump, the bonding curve determines the price:

```
Price = virtualSolReserves / virtualTokenReserves
```

As more tokens are bought, the price increases along the curve. The SDK handles all the math for you.

## Step 1: Fetch the Current State

Before buying, you need the current bonding curve state:

```typescript
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk, PUMP_SDK, getBuyTokenAmountFromSolAmount } from "@pump-fun/pump-sdk";
import BN from "bn.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);

const mint = new PublicKey("YOUR_TOKEN_MINT_ADDRESS");
const buyer = Keypair.generate(); // Use your funded keypair

// Fetch all state needed for buying
const buyState = await onlineSdk.fetchBuyState(mint, buyer.publicKey);
```

## Step 2: Calculate How Many Tokens You'll Get

Use the bonding curve math to preview your purchase:

```typescript
const solToSpend = new BN(100_000_000); // 0.1 SOL (in lamports)

const tokensYouGet = getBuyTokenAmountFromSolAmount({
  global: buyState.global,
  feeConfig: buyState.feeConfig,
  mintSupply: buyState.mintSupply,
  bondingCurve: buyState.bondingCurve,
  amount: solToSpend,
});

console.log("Tokens you'll receive:", tokensYouGet.toString());
```

## Step 3: Build the Buy Instructions

```typescript
const buyIxs = await PUMP_SDK.buyInstructions({
  global: buyState.global,
  bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
  bondingCurve: buyState.bondingCurve,
  associatedUserAccountInfo: buyState.associatedUserAccountInfo,
  mint,
  user: buyer.publicKey,
  amount: tokensYouGet,         // Min tokens you want
  solAmount: solToSpend,        // SOL you're spending
  slippage: 0.05,               // 5% slippage tolerance
  tokenProgram: buyState.tokenProgram,
});
```

### Understanding the Parameters

- `amount` — The minimum number of tokens you want to receive
- `solAmount` — The SOL amount you're willing to spend
- `slippage` — Acceptable price deviation (0.05 = 5%)
- The SDK automatically creates associated token accounts if needed

## Step 4: Send the Transaction

```typescript
import { TransactionMessage, VersionedTransaction } from "@solana/web3.js";

const { blockhash } = await connection.getLatestBlockhash("confirmed");

const message = new TransactionMessage({
  payerKey: buyer.publicKey,
  recentBlockhash: blockhash,
  instructions: buyIxs,
}).compileToV0Message();

const tx = new VersionedTransaction(message);
tx.sign([buyer]);

const signature = await connection.sendTransaction(tx);
console.log("Buy successful! Tx:", signature);
```

## Full Example

```typescript
import { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { OnlinePumpSdk, PUMP_SDK, getBuyTokenAmountFromSolAmount } from "@pump-fun/pump-sdk";
import BN from "bn.js";

async function buyTokens() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const onlineSdk = new OnlinePumpSdk(connection);
  const buyer = Keypair.generate(); // Use your funded keypair
  const mint = new PublicKey("YOUR_TOKEN_MINT_ADDRESS");

  // Fetch state
  const buyState = await onlineSdk.fetchBuyState(mint, buyer.publicKey);

  // Calculate tokens
  const solToSpend = new BN(100_000_000); // 0.1 SOL
  const tokensOut = getBuyTokenAmountFromSolAmount({
    global: buyState.global,
    feeConfig: buyState.feeConfig,
    mintSupply: buyState.mintSupply,
    bondingCurve: buyState.bondingCurve,
    amount: solToSpend,
  });
  console.log(`Spending 0.1 SOL → ${tokensOut.toString()} tokens`);

  // Build buy instructions
  const buyIxs = await PUMP_SDK.buyInstructions({
    global: buyState.global,
    bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
    bondingCurve: buyState.bondingCurve,
    associatedUserAccountInfo: buyState.associatedUserAccountInfo,
    mint,
    user: buyer.publicKey,
    amount: tokensOut,
    solAmount: solToSpend,
    slippage: 0.05,
    tokenProgram: buyState.tokenProgram,
  });

  // Send
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: buyer.publicKey,
    recentBlockhash: blockhash,
    instructions: buyIxs,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([buyer]);
  const sig = await connection.sendTransaction(tx);
  console.log("Bought tokens!", sig);
}

buyTokens();
```

## Understanding Fees

Every buy incurs fees that are split between:
- **Protocol fees** — go to Pump
- **Creator fees** — go to the token creator

The fee tier depends on the bonding curve's market cap. See [Tutorial 9: Understanding the Fee System](./09-fee-system.md).

## What's Next?

- [Tutorial 3: Sell Tokens Back to the Curve](./03-sell-tokens.md)
- [Tutorial 5: Bonding Curve Math Deep Dive](./05-bonding-curve-math.md)
