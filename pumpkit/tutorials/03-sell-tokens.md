# Tutorial 3: Sell Tokens Back to the Bonding Curve

> Convert your tokens back to SOL through the bonding curve.

> **Breaking change — 2026-04-28:** The on-chain program now requires a new trailing fee-recipient account on every sell. If you use `@nirholas/pump-sdk@^1.32.0`, this is handled automatically. See **[Tutorial 45: Breaking Fee Recipient Upgrade](./45-breaking-fee-recipient-upgrade.md)** for the full details and manual-builder patterns.

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

## Preview Price Impact Before Selling

Before committing to a sell, you can simulate how much the trade will move the price. This is especially useful for large positions.

```typescript
import { calculateSellPriceImpact } from "@nirholas/pump-sdk";

const [sellState, global, feeConfig] = await Promise.all([
  onlineSdk.fetchSellState(mint, seller.publicKey),
  onlineSdk.fetchGlobal(),
  onlineSdk.fetchFeeConfig(),
]);

const tokensToSell = new BN("5000000000000"); // 5 million tokens

const impact = calculateSellPriceImpact({
  global,
  feeConfig,
  mintSupply: sellState.bondingCurve.tokenTotalSupply,
  bondingCurve: sellState.bondingCurve,
  tokenAmount: tokensToSell,
});

console.log("Price before:", impact.priceBefore.toString(), "lamports/token");
console.log("Price after: ", impact.priceAfter.toString(), "lamports/token");
console.log("Price impact:", impact.impactBps / 100, "%");
console.log("SOL received:", impact.outputAmount.toNumber() / 1e9, "SOL");

// Gate on acceptable impact
if (impact.impactBps > 500) { // 5%
  console.warn("High price impact — consider selling in smaller chunks.");
}
```

`impactBps` is in basis points (100 bps = 1%). Values above ~300 bps indicate a large position relative to the curve's reserves.

## Check Graduation Progress Before Selling

If the token is close to graduating, your sell will push it further from the AMM launch. You may want to know where it stands first.

```typescript
import { getGraduationProgress } from "@nirholas/pump-sdk";

const [global, sellState] = await Promise.all([
  onlineSdk.fetchGlobal(),
  onlineSdk.fetchSellState(mint, seller.publicKey),
]);

const progress = getGraduationProgress({
  global,
  bondingCurve: sellState.bondingCurve,
});

console.log("Graduation progress:", progress.progressBps / 100, "%");
console.log("Tokens remaining on curve:", progress.tokensRemaining.toString());
console.log("SOL accumulated:", progress.solAccumulated.toNumber() / 1e9, "SOL");
console.log("Already graduated:", progress.isGraduated);
```

`progressBps` goes from 0 to 10,000 (100%). When it hits 10,000 the curve completes and the token migrates to a PumpAMM pool — after which you cannot sell through the bonding curve.

## Sell Large Positions in Chunks

The bonding curve uses u64 arithmetic on-chain. For very large token amounts the multiplication `amount × virtualSolReserves` can overflow. `sellChunked` handles this automatically: it calculates the maximum safe chunk size, submits each chunk, and re-fetches reserves between chunks so the math stays current.

```typescript
import { OnlinePumpSdk } from "@nirholas/pump-sdk";
import { sendAndConfirmTransaction, Transaction } from "@solana/web3.js";

const onlineSdk = new OnlinePumpSdk(connection);
const hugeSell = new BN("100000000000000"); // very large amount

const signatures = await onlineSdk.sellChunked({
  mint,
  user: seller.publicKey,
  totalAmount: hugeSell,
  slippage: 0.05,
  sendTx: async (ixs) => {
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const message = new TransactionMessage({
      payerKey: seller.publicKey,
      recentBlockhash: blockhash,
      instructions: ixs,
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([seller]);
    return connection.sendTransaction(tx);
  },
});

console.log(`Sold in ${signatures.length} chunk(s):`, signatures);
```

`sellChunked` returns an array of transaction signatures — one per chunk. The `sendTx` callback is yours to implement, so you keep full control over priority fees, confirmation strategy, and retry logic.

> **When to use `sellChunked` vs `sellInstructions`:** Use `sellInstructions` for normal sells. Use `sellChunked` when you hold a very large position (typically millions of tokens) or when `validateSellAmount` throws a `SellOverflowError`.

## Enable Cashback Rewards

Selling with `cashback: true` includes your `UserVolumeAccumulator` account in the transaction. The protocol tracks your sell volume and may reward you with token incentives.

```typescript
const sellIxs = await onlineSdk.sellInstructions({
  ...sellState,
  mint,
  user: seller.publicKey,
  amount: tokensToSell,
  solAmount: solOut,
  slippage: 0.05,
  cashback: true, // opt in to volume tracking & rewards
});
```

The `UserVolumeAccumulator` PDA is derived from your wallet address. It is created automatically the first time you trade with cashback enabled. See [Tutorial 11: Trading Bot](./11-trading-bot.md) for a pattern that combines cashback with repeated sells.

## Token2022 Support

Some tokens on Pump use the Token2022 program instead of the classic SPL token program. `fetchSellState` auto-detects which program the mint uses, so you usually don't need to specify it:

```typescript
// Auto-detects TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID
const sellState = await onlineSdk.fetchSellState(mint, seller.publicKey);
```

If you already know the program (e.g., from a previous fetch), you can pass it explicitly to skip the extra RPC call:

```typescript
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

const sellState = await onlineSdk.fetchSellState(
  mint,
  seller.publicKey,
  TOKEN_2022_PROGRAM_ID,
);
```

The detected `tokenProgram` is included in the `sellState` object, so spreading `...sellState` into `sellInstructions` always passes the right program automatically.

## What's Next?

- [Tutorial 4: Create and Buy in One Transaction](./04-create-and-buy.md)
- [Tutorial 6: Token Migration to PumpAMM](./06-migration.md)
- [Tutorial 24: Cross-Program Trading](./24-cross-program-trading.md) — Sell graduated tokens on AMM

