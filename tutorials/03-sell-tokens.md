# Tutorial 3: Sell Tokens Back to the Bonding Curve

> Convert your tokens back to SOL through the bonding curve.

## Prerequisites

- Have tokens in your wallet from a Pump bonding curve
- A funded Solana wallet

```bash
npm install @pump-fun/pump-sdk @solana/web3.js bn.js
```

## How Selling Works

Selling is the reverse of buying. You send tokens back to the bonding curve, and it returns SOL minus fees. The price follows the same curve — selling pushes the price down.

## Step 1: Fetch Sell State

```typescript
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk, PUMP_SDK, getSellSolAmountFromTokenAmount } from "@pump-fun/pump-sdk";
import BN from "bn.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);

const mint = new PublicKey("YOUR_TOKEN_MINT_ADDRESS");
const seller = Keypair.generate(); // Use your funded keypair

const sellState = await onlineSdk.fetchSellState(mint, seller.publicKey);
```

## Step 2: Calculate SOL You'll Receive

```typescript
const tokensToSell = new BN("1000000000"); // Amount of tokens to sell

const solYouGet = getSellSolAmountFromTokenAmount({
  global: sellState.global,
  feeConfig: sellState.feeConfig,
  mintSupply: sellState.mintSupply,
  bondingCurve: sellState.bondingCurve,
  amount: tokensToSell,
});

console.log("SOL you'll receive:", solYouGet.toString(), "lamports");
console.log("SOL you'll receive:", solYouGet.toNumber() / 1e9, "SOL");
```

## Step 3: Build the Sell Instructions

```typescript
const sellIxs = await PUMP_SDK.sellInstructions({
  global: sellState.global,
  bondingCurveAccountInfo: sellState.bondingCurveAccountInfo,
  bondingCurve: sellState.bondingCurve,
  mint,
  user: seller.publicKey,
  amount: tokensToSell,
  slippage: 0.05,  // 5% slippage tolerance
  tokenProgram: sellState.tokenProgram,
});
```

## Step 4: Send the Transaction

```typescript
import { TransactionMessage, VersionedTransaction } from "@solana/web3.js";

const { blockhash } = await connection.getLatestBlockhash("confirmed");

const message = new TransactionMessage({
  payerKey: seller.publicKey,
  recentBlockhash: blockhash,
  instructions: sellIxs,
}).compileToV0Message();

const tx = new VersionedTransaction(message);
tx.sign([seller]);

const signature = await connection.sendTransaction(tx);
console.log("Sold tokens! Tx:", signature);
```

## Full Example

```typescript
import { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { OnlinePumpSdk, PUMP_SDK, getSellSolAmountFromTokenAmount } from "@pump-fun/pump-sdk";
import BN from "bn.js";

async function sellTokens() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const onlineSdk = new OnlinePumpSdk(connection);
  const seller = Keypair.generate(); // Use your funded keypair
  const mint = new PublicKey("YOUR_TOKEN_MINT_ADDRESS");

  // Fetch state
  const sellState = await onlineSdk.fetchSellState(mint, seller.publicKey);

  // Check if bonding curve is still active
  if (sellState.bondingCurve.complete) {
    console.log("Bonding curve is complete — token has graduated to AMM!");
    console.log("Use a DEX to sell instead.");
    return;
  }

  // Calculate SOL out
  const tokensToSell = new BN("1000000000");
  const solOut = getSellSolAmountFromTokenAmount({
    global: sellState.global,
    feeConfig: sellState.feeConfig,
    mintSupply: sellState.mintSupply,
    bondingCurve: sellState.bondingCurve,
    amount: tokensToSell,
  });
  console.log(`Selling tokens → ${solOut.toNumber() / 1e9} SOL`);

  // Build sell instructions
  const sellIxs = await PUMP_SDK.sellInstructions({
    global: sellState.global,
    bondingCurveAccountInfo: sellState.bondingCurveAccountInfo,
    bondingCurve: sellState.bondingCurve,
    mint,
    user: seller.publicKey,
    amount: tokensToSell,
    slippage: 0.05,
    tokenProgram: sellState.tokenProgram,
  });

  // Send
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: seller.publicKey,
    recentBlockhash: blockhash,
    instructions: sellIxs,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([seller]);
  const sig = await connection.sendTransaction(tx);
  console.log("Sold!", sig);
}

sellTokens();
```

## Edge Cases

### Bonding Curve Complete
If `bondingCurve.complete === true`, the token has graduated to a PumpAMM pool. You can no longer sell through the bonding curve — use the AMM pool instead.

### Zero Reserves
If `virtualTokenReserves` is zero, the bonding curve has been fully migrated and returns zero for all calculations.

## What's Next?

- [Tutorial 4: Create and Buy in One Transaction](./04-create-and-buy.md)
- [Tutorial 6: Token Migration to PumpAMM](./06-migration.md)
