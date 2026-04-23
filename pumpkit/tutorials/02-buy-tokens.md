# Tutorial 2: Buy Tokens from the Bonding Curve

> Purchase tokens using SOL through the Pump bonding curve.

> **Breaking change — 2026-04-28:** The on-chain program now requires a new trailing fee-recipient account on every buy. If you use `@nirholas/pump-sdk@^1.32.0`, this is handled automatically. See **[Tutorial 45: Breaking Fee Recipient Upgrade](./45-breaking-fee-recipient-upgrade.md)** for the full details and manual-builder patterns.

## Prerequisites

- Completed [Tutorial 1](./01-create-token.md) or have a known token mint address
- A funded Solana wallet

```bash
npm install @nirholas/pump-sdk @solana/web3.js bn.js
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
import { OnlinePumpSdk, PUMP_SDK, getBuyTokenAmountFromSolAmount } from "@nirholas/pump-sdk";
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

// Fetch global + feeConfig alongside buyState for the math
const [global, feeConfig] = await Promise.all([
  onlineSdk.fetchGlobal(),
  onlineSdk.fetchFeeConfig(),
]);

const tokensYouGet = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,
  mintSupply: buyState.bondingCurve.tokenTotalSupply,
  bondingCurve: buyState.bondingCurve,
  amount: solToSpend,
});

console.log("Tokens you'll receive:", tokensYouGet.toString());
```

## Step 2b: Preview Price Impact Before Buying

Before sending any SOL, check how much your trade will move the price. Large buys on small curves can have significant impact.

```typescript
import { calculateBuyPriceImpact } from "@nirholas/pump-sdk";

const impact = calculateBuyPriceImpact({
  global,
  feeConfig,
  mintSupply: buyState.bondingCurve.tokenTotalSupply,
  bondingCurve: buyState.bondingCurve,
  solAmount: solToSpend,
});

console.log("Price before:", impact.priceBefore.toString(), "lamports/token");
console.log("Price after: ", impact.priceAfter.toString(), "lamports/token");
console.log("Impact:      ", impact.impactBps / 100, "%");
console.log("Tokens out:  ", impact.outputAmount.toString());

// Bail if impact is too high
if (impact.impactBps > 500) {
  throw new Error(`Price impact too high: ${impact.impactBps / 100}%`);
}
```

`impactBps` is in basis points — 100 = 1%. A 500 bps (5%) threshold is a reasonable guard for most strategies.

## Step 2c: Buy Exact Token Count (Reverse Math)

If you want a specific number of tokens rather than spending a fixed SOL amount, use the reverse calculation:

```typescript
import { getBuySolAmountFromTokenAmount } from "@nirholas/pump-sdk";

const targetTokens = new BN(1_000_000_000_000); // 1M tokens (6 decimals)

// How much SOL does that cost?
const solRequired = getBuySolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply: buyState.bondingCurve.tokenTotalSupply,
  bondingCurve: buyState.bondingCurve,
  amount: targetTokens,
});

console.log("SOL required:", solRequired.toString(), "lamports");

// Then build instructions with the computed solAmount
const buyIxs = await onlineSdk.buyInstructions({
  ...buyState,
  mint,
  user: buyer.publicKey,
  amount: targetTokens,
  solAmount: solRequired,
  slippage: 0.02, // tighter slippage since you know the exact amount
});
```

## Step 3: Build the Buy Instructions

`OnlinePumpSdk.buyInstructions()` fetches `global` internally, so you only need to spread the `buyState`:

```typescript
const buyIxs = await onlineSdk.buyInstructions({
  ...buyState,
  mint,
  user: buyer.publicKey,
  amount: tokensYouGet,  // Min tokens you want
  solAmount: solToSpend, // SOL you're spending
  slippage: 0.05,        // 5% slippage tolerance
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

This example adds pre-trade checks (graduation guard, price impact) and post-trade verification (confirmation + balance).

```typescript
import {
  Connection, Keypair, PublicKey,
  TransactionMessage, VersionedTransaction,
} from "@solana/web3.js";
import {
  OnlinePumpSdk, PUMP_SDK,
  getBuyTokenAmountFromSolAmount,
  calculateBuyPriceImpact,
  getGraduationProgress,
  getFee,
} from "@nirholas/pump-sdk";
import BN from "bn.js";

async function buyTokens() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const onlineSdk = new OnlinePumpSdk(connection);
  const buyer = Keypair.generate(); // Use your funded keypair
  const mint = new PublicKey("YOUR_TOKEN_MINT_ADDRESS");

  // Fetch all state in parallel
  const [buyState, global, feeConfig] = await Promise.all([
    onlineSdk.fetchBuyState(mint, buyer.publicKey),
    onlineSdk.fetchGlobal(),
    onlineSdk.fetchFeeConfig(),
  ]);

  // Guard: don't buy on a graduated curve
  if (buyState.bondingCurve.complete) {
    throw new Error("Token graduated — use AMM buy instructions instead");
  }

  // Guard: warn if close to graduation (your buy may trigger it)
  const progress = getGraduationProgress(global, buyState.bondingCurve);
  if (progress.progressBps > 9000) {
    console.warn(`Token is ${progress.progressBps / 100}% to graduation`);
  }

  const solToSpend = new BN(100_000_000); // 0.1 SOL

  // Preview price impact
  const impact = calculateBuyPriceImpact({
    global,
    feeConfig,
    mintSupply: buyState.bondingCurve.tokenTotalSupply,
    bondingCurve: buyState.bondingCurve,
    solAmount: solToSpend,
  });

  if (impact.impactBps > 500) {
    throw new Error(`Price impact too high: ${impact.impactBps / 100}%`);
  }

  // Preview fees
  const fee = getFee({
    global,
    feeConfig,
    mintSupply: buyState.bondingCurve.tokenTotalSupply,
    bondingCurve: buyState.bondingCurve,
    amount: solToSpend,
    isNewBondingCurve: false,
  });

  // Calculate expected tokens
  const tokensOut = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: buyState.bondingCurve.tokenTotalSupply,
    bondingCurve: buyState.bondingCurve,
    amount: solToSpend,
  });

  console.log(`Spending:  0.1 SOL`);
  console.log(`Fee:       ${fee.toString()} lamports`);
  console.log(`Impact:    ${impact.impactBps / 100}%`);
  console.log(`Tokens:    ${tokensOut.toString()}`);

  // Build instructions
  const buyIxs = await onlineSdk.buyInstructions({
    ...buyState,
    mint,
    user: buyer.publicKey,
    amount: tokensOut,
    solAmount: solToSpend,
    slippage: 0.05,
  });

  // Send and confirm
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: buyer.publicKey,
    recentBlockhash: blockhash,
    instructions: buyIxs,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([buyer]);
  const sig = await connection.sendTransaction(tx);

  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  // Verify balance
  const balance = await onlineSdk.getTokenBalance(mint, buyer.publicKey);
  console.log("Confirmed! Tx:", sig);
  console.log("Token balance:", balance.toString());
}

buyTokens();
```

## Market Context Before Buying

Get a full picture of the token's current state in one call:

```typescript
import { getTokenPrice, getGraduationProgress, getBondingCurveSummary } from "@nirholas/pump-sdk";

// Current bid/ask prices and market cap
const price = getTokenPrice({
  global,
  feeConfig,
  mintSupply: buyState.bondingCurve.tokenTotalSupply,
  bondingCurve: buyState.bondingCurve,
});

console.log("Buy price: ", price.buyPricePerToken.toString(), "lamports/token");
console.log("Sell price:", price.sellPricePerToken.toString(), "lamports/token");
console.log("Market cap:", price.marketCap.toString(), "lamports");
console.log("Graduated: ", price.isGraduated);

// How close is this token to AMM graduation?
const progress = getGraduationProgress(global, buyState.bondingCurve);

console.log("Progress:", progress.progressBps / 100, "%");
console.log("Tokens remaining:", progress.tokensRemaining.toString());
console.log("SOL accumulated: ", progress.solAccumulated.toString());

if (progress.progressBps > 9500) {
  console.warn("Token is >95% to graduation — AMM migration may happen during your buy");
}

// Everything at once via summary
const summary = getBondingCurveSummary({
  global,
  feeConfig,
  mintSupply: buyState.bondingCurve.tokenTotalSupply,
  bondingCurve: buyState.bondingCurve,
});
console.log(summary);
```

## Understanding Fees

Every buy incurs fees that are split between:
- **Protocol fees** — go to Pump
- **Creator fees** — go to the token creator

The fee tier depends on the bonding curve's market cap. See [Tutorial 9: Understanding the Fee System](./09-fee-system.md).

### Calculating Exact Fees Before Sending

```typescript
import { getFee, computeFeesBps } from "@nirholas/pump-sdk";

// Total fee in lamports for this trade
const totalFee = getFee({
  global,
  feeConfig,
  mintSupply: buyState.bondingCurve.tokenTotalSupply,
  bondingCurve: buyState.bondingCurve,
  amount: solToSpend,
  isNewBondingCurve: false,
});

console.log("Fee you'll pay:", totalFee.toString(), "lamports");
console.log("Net SOL to curve:", solToSpend.sub(totalFee).toString(), "lamports");

// Individual protocol vs creator fee breakdown
const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
  global,
  feeConfig,
  mintSupply: buyState.bondingCurve.tokenTotalSupply,
  virtualSolReserves: buyState.bondingCurve.virtualSolReserves,
  virtualTokenReserves: buyState.bondingCurve.virtualTokenReserves,
});

console.log("Protocol fee:", protocolFeeBps.toString(), "bps");
console.log("Creator fee: ", creatorFeeBps.toString(), "bps");
```

## Confirming the Buy and Checking Your Balance

After sending, wait for confirmation then verify the token balance arrived:

```typescript
import { Connection, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

// Send with confirmation
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

const message = new TransactionMessage({
  payerKey: buyer.publicKey,
  recentBlockhash: blockhash,
  instructions: buyIxs,
}).compileToV0Message();

const tx = new VersionedTransaction(message);
tx.sign([buyer]);

const signature = await connection.sendTransaction(tx);

// Wait for finalized confirmation (not just processed)
await connection.confirmTransaction(
  { signature, blockhash, lastValidBlockHeight },
  "confirmed",
);

console.log("Confirmed:", signature);

// Now check actual balance received
const balance = await onlineSdk.getTokenBalance(mint, buyer.publicKey);
console.log("Token balance:", balance.toString());
```

## Parsing the Trade Event

Every buy emits a `TradeEvent` in the transaction logs. Decode it to verify the exact amounts settled on-chain:

```typescript
import { PUMP_SDK } from "@nirholas/pump-sdk";

// Fetch the confirmed transaction
const txResult = await connection.getTransaction(signature, {
  commitment: "confirmed",
  maxSupportedTransactionVersion: 0,
});

// Scan inner instructions for the trade event log
const logs = txResult?.meta?.logMessages ?? [];
for (const log of logs) {
  // Pump program emits base64-encoded event data after "Program data:"
  if (!log.startsWith("Program data:")) continue;
  const data = Buffer.from(log.slice("Program data: ".length), "base64");
  try {
    const event = PUMP_SDK.decodeTradeEvent(data);
    console.log("Mint:         ", event.mint.toBase58());
    console.log("SOL amount:   ", event.solAmount.toString());
    console.log("Token amount: ", event.tokenAmount.toString());
    console.log("Is buy:       ", event.isBuy);
    console.log("User:         ", event.user.toBase58());
    console.log("Timestamp:    ", event.timestamp.toString());
  } catch {
    // Not a TradeEvent — skip
  }
}
```

See [Tutorial 29: Event Parsing & Analytics](./29-event-parsing-analytics.md) for a full event pipeline.

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Bonding curve complete | Token graduated to AMM | Use AMM buy instructions — see [Tutorial 24](./24-cross-program-trading.md) |
| Insufficient SOL | Wallet doesn't have enough SOL for trade + fees + rent | Fund the wallet with more SOL |
| Slippage exceeded | Price moved between quote and execution | Increase slippage tolerance or retry |
| 0 tokens output | SOL amount too small after fees | Increase `solToSpend` amount |

```typescript
// Always check if the curve is still active before buying
const bc = await onlineSdk.fetchBondingCurve(mint);
if (bc.complete) {
  console.log("Token graduated — use AMM instructions instead");
  return;
}
```

## What's Next?

- [Tutorial 3: Sell Tokens Back to the Curve](./03-sell-tokens.md)
- [Tutorial 5: Bonding Curve Math Deep Dive](./05-bonding-curve-math.md)
- [Tutorial 9: Understanding the Fee System](./09-fee-system.md)
- [Tutorial 11: Building a Trading Bot](./11-trading-bot.md)
- [Tutorial 24: Cross-Program Trading (AMM)](./24-cross-program-trading.md)
- [Tutorial 28: Analytics & Price Quotes](./28-analytics-price-quotes.md)
- [Tutorial 29: Event Parsing & Analytics](./29-event-parsing-analytics.md)

