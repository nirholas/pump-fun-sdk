# Tutorial 3: Sell Tokens Back to the Bonding Curve

> Convert your tokens back to SOL through the bonding curve.

## Prerequisites

- Have tokens in your wallet from a Pump bonding curve
- A funded Solana wallet

```bash
npm install @nirholas/pump-sdk @solana/web3.js bn.js
```

## How Selling Works

Selling is the reverse of buying. You send tokens back to the bonding curve, and it returns SOL minus fees. The price follows the same curve — selling pushes the price down.

## Step 1: Fetch Sell State

```typescript
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk, PUMP_SDK, getSellSolAmountFromTokenAmount } from "@nirholas/pump-sdk";
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

// Fetch global + feeConfig alongside sellState for the math
const [global, feeConfig] = await Promise.all([
  onlineSdk.fetchGlobal(),
  onlineSdk.fetchFeeConfig(),
]);

const solYouGet = getSellSolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply: sellState.bondingCurve.tokenTotalSupply,
  bondingCurve: sellState.bondingCurve,
  amount: tokensToSell,
});

console.log("SOL you'll receive:", solYouGet.toString(), "lamports");
console.log("SOL you'll receive:", solYouGet.toNumber() / 1e9, "SOL");
```

## Step 3: Build the Sell Instructions

`OnlinePumpSdk.sellInstructions()` fetches `global` internally, so you only need to spread the `sellState`:

```typescript
const sellIxs = await onlineSdk.sellInstructions({
  ...sellState,
  mint,
  user: seller.publicKey,
  amount: tokensToSell,
  solAmount: solYouGet,
  slippage: 0.05,  // 5% slippage tolerance
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
import { OnlinePumpSdk, getSellSolAmountFromTokenAmount } from "@nirholas/pump-sdk";
import BN from "bn.js";

async function sellTokens() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const onlineSdk = new OnlinePumpSdk(connection);
  const seller = Keypair.generate(); // Use your funded keypair
  const mint = new PublicKey("YOUR_TOKEN_MINT_ADDRESS");

  // Fetch state in parallel
  const [sellState, global, feeConfig] = await Promise.all([
    onlineSdk.fetchSellState(mint, seller.publicKey),
    onlineSdk.fetchGlobal(),
    onlineSdk.fetchFeeConfig(),
  ]);

  // Check if bonding curve is still active
  if (sellState.bondingCurve.complete) {
    console.log("Bonding curve is complete — token has graduated to AMM!");
    console.log("Use a DEX to sell instead.");
    return;
  }

  // Calculate SOL out
  const tokensToSell = new BN("1000000000");
  const solOut = getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply: sellState.bondingCurve.tokenTotalSupply,
    bondingCurve: sellState.bondingCurve,
    amount: tokensToSell,
  });
  console.log(`Selling tokens → ${solOut.toNumber() / 1e9} SOL`);

  // Build sell instructions (fetches global internally)
  const sellIxs = await onlineSdk.sellInstructions({
    ...sellState,
    mint,
    user: seller.publicKey,
    amount: tokensToSell,
    solAmount: solOut,
    slippage: 0.05,
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
If `bondingCurve.complete === true`, the token has graduated to a PumpAMM pool. You can no longer sell through the bonding curve — use the AMM pool instead. See [Tutorial 24: Cross-Program Trading](./24-cross-program-trading.md).

### Zero Reserves
If `virtualTokenReserves` is zero, the bonding curve has been fully migrated and returns zero for all calculations.

### Insufficient Balance
If you try to sell more tokens than you hold, the transaction will fail on-chain. Always check your balance first:

```typescript
const balance = await onlineSdk.getTokenBalance(mint, seller.publicKey);
console.log("Token balance:", balance.toString());
```

## Sell All Tokens

To sell your entire balance and reclaim the ATA rent in one step:

```typescript
const sellAllIxs = await onlineSdk.sellAllInstructions({
  mint,
  user: seller.publicKey,
  slippage: 1, // 1%
});

if (sellAllIxs.length > 0) {
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: seller.publicKey,
    recentBlockhash: blockhash,
    instructions: sellAllIxs,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([seller]);
  await connection.sendTransaction(tx);
  console.log("Sold all tokens and closed ATA!");
} else {
  console.log("No tokens to sell.");
}
```

> `sellAllInstructions` sells your full token balance and closes the associated token account, returning the ~0.002 SOL rent back to your wallet.

## What's Next?

- [Tutorial 4: Create and Buy in One Transaction](./04-create-and-buy.md)
- [Tutorial 6: Token Migration to PumpAMM](./06-migration.md)
- [Tutorial 24: Cross-Program Trading](./24-cross-program-trading.md) — Sell graduated tokens on AMM

