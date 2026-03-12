# Tutorial 28: Advanced Analytics & Price Quotes

> Master every quote function in the SDK — calculate buy/sell prices, measure price impact, track graduation progress, and build real-time price feeds.

## Prerequisites

- Node.js 18+
- `@nirholas/pump-sdk` installed
- Understanding of [Tutorial 05](./05-bonding-curve-math.md) (bonding curve basics)

```bash
npm install @nirholas/pump-sdk @solana/web3.js bn.js
```

## The Quote Function Family

The SDK provides several quote functions, each answering a different pricing question:

| Function | Question It Answers |
|----------|-------------------|
| `getBuyTokenAmountFromSolAmount` | "How many tokens do I get for X SOL?" |
| `getBuySolAmountFromTokenAmount` | "How much SOL to buy X tokens?" |
| `getSellSolAmountFromTokenAmount` | "How much SOL do I get for selling X tokens?" |
| `calculateBuyPriceImpact` | "How much does my buy move the price?" |
| `calculateSellPriceImpact` | "How much does my sell move the price?" |
| `getTokenPrice` | "What's the current buy/sell price per token?" |
| `bondingCurveMarketCap` | "What's the total market cap?" |
| `getGraduationProgress` | "How close is the token to graduating?" |
| `getBondingCurveSummary` | "Give me everything at once" |

## Step 1: Set Up State Fetching

All analytics functions need on-chain state. Fetch it once and reuse:

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk } from "@nirholas/pump-sdk";
import BN from "bn.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);

const mint = new PublicKey("YOUR_TOKEN_MINT");

// Fetch all state needed for analytics
const [global, bondingCurve, feeConfig] = await Promise.all([
  onlineSdk.fetchGlobal(),
  onlineSdk.fetchBondingCurve(mint),
  onlineSdk.fetchFeeConfig(),
]);

const mintSupply = bondingCurve.tokenTotalSupply;
```

## Step 2: Buy Quotes (SOL → Tokens)

```typescript
import { getBuyTokenAmountFromSolAmount } from "@nirholas/pump-sdk";

// "I want to spend 0.1 SOL — how many tokens will I get?"
const solToSpend = new BN(100_000_000); // 0.1 SOL in lamports

const tokensOut = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount: solToSpend,
});

console.log(`Spending 0.1 SOL → ${tokensOut.toString()} tokens`);
```

## Step 3: Reverse Buy Quote (Tokens → SOL Cost)

```typescript
import { getBuySolAmountFromTokenAmount } from "@nirholas/pump-sdk";

// "I want exactly 1,000,000 tokens — how much SOL will that cost (including fees)?"
const tokensWanted = new BN("1000000");

const solCost = getBuySolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount: tokensWanted,
});

console.log(`Buying 1,000,000 tokens costs ${solCost.toNumber() / 1e9} SOL`);
```

## Step 4: Sell Quotes (Tokens → SOL)

```typescript
import { getSellSolAmountFromTokenAmount } from "@nirholas/pump-sdk";

// "If I sell 500,000 tokens, how much SOL do I get (after fees)?"
const tokensToSell = new BN("500000");

const solReceived = getSellSolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount: tokensToSell,
});

console.log(`Selling 500,000 tokens → ${solReceived.toNumber() / 1e9} SOL`);
```

## Step 5: Price Impact Analysis

Understand how much your trade moves the market:

```typescript
import {
  calculateBuyPriceImpact,
  calculateSellPriceImpact,
} from "@nirholas/pump-sdk";

// Buy impact for 1 SOL
const buyImpact = calculateBuyPriceImpact({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  solAmount: new BN(1_000_000_000), // 1 SOL
});

console.log("=== Buy 1 SOL Impact ===");
console.log(`Price before: ${buyImpact.priceBefore.toString()} lamports/token`);
console.log(`Price after:  ${buyImpact.priceAfter.toString()} lamports/token`);
console.log(`Impact:       ${buyImpact.impactBps / 100}%`);
console.log(`Tokens out:   ${buyImpact.outputAmount.toString()}`);

// Sell impact for 1,000,000 tokens
const sellImpact = calculateSellPriceImpact({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  tokenAmount: new BN("1000000"),
});

console.log("\n=== Sell 1M Tokens Impact ===");
console.log(`Price before: ${sellImpact.priceBefore.toString()} lamports/token`);
console.log(`Price after:  ${sellImpact.priceAfter.toString()} lamports/token`);
console.log(`Impact:       ${sellImpact.impactBps / 100}%`);
console.log(`SOL out:      ${sellImpact.outputAmount.toString()}`);
```

## Step 6: Token Price Info

Get the current buy and sell price in a single call:

```typescript
import { getTokenPrice } from "@nirholas/pump-sdk";

const priceInfo = getTokenPrice({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
});

console.log("=== Token Price ===");
console.log(`Buy price:  ${priceInfo.buyPricePerToken.toNumber() / 1e9} SOL per token`);
console.log(`Sell price: ${priceInfo.sellPricePerToken.toNumber() / 1e9} SOL per token`);
console.log(`Spread:     ${((priceInfo.buyPricePerToken.toNumber() - priceInfo.sellPricePerToken.toNumber()) / priceInfo.buyPricePerToken.toNumber() * 100).toFixed(2)}%`);
console.log(`Market cap: ${priceInfo.marketCap.toNumber() / 1e9} SOL`);
console.log(`Graduated:  ${priceInfo.isGraduated}`);
```

## Step 7: Graduation Progress

```typescript
import { getGraduationProgress } from "@nirholas/pump-sdk";

const progress = getGraduationProgress(global, bondingCurve);

console.log("=== Graduation Progress ===");
console.log(`Progress:        ${progress.progressBps / 100}%`);
console.log(`Is graduated:    ${progress.isGraduated}`);
console.log(`Tokens remaining:${progress.tokensRemaining.toString()}`);
console.log(`Tokens total:    ${progress.tokensTotal.toString()}`);
console.log(`SOL accumulated: ${progress.solAccumulated.toNumber() / 1e9} SOL`);
```

## Step 8: Full Summary (Everything at Once)

```typescript
import { getBondingCurveSummary } from "@nirholas/pump-sdk";

const summary = getBondingCurveSummary({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
});

console.log("=== Full Bonding Curve Summary ===");
console.log(`Market Cap:      ${summary.marketCap.toNumber() / 1e9} SOL`);
console.log(`Progress:        ${summary.progressBps / 100}%`);
console.log(`Graduated:       ${summary.isGraduated}`);
console.log(`Buy Price:       ${summary.buyPricePerToken.toString()} lamports`);
console.log(`Sell Price:      ${summary.sellPricePerToken.toString()} lamports`);
console.log(`Real SOL:        ${summary.realSolReserves.toString()}`);
console.log(`Real Tokens:     ${summary.realTokenReserves.toString()}`);
console.log(`Virtual SOL:     ${summary.virtualSolReserves.toString()}`);
console.log(`Virtual Tokens:  ${summary.virtualTokenReserves.toString()}`);
```

## Step 9: Build a Real-Time Price Feed

Combine the analytics functions into a polling price feed:

```typescript
interface PriceSnapshot {
  timestamp: number;
  mintAddress: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  marketCapSol: number;
  graduationPercent: number;
  isGraduated: boolean;
}

async function pollPrice(
  mint: PublicKey,
  intervalMs: number = 2000
): Promise<void> {
  console.log(`Polling price for ${mint.toBase58()} every ${intervalMs}ms`);

  setInterval(async () => {
    try {
      const [global, bc, feeConfig] = await Promise.all([
        onlineSdk.fetchGlobal(),
        onlineSdk.fetchBondingCurve(mint),
        onlineSdk.fetchFeeConfig(),
      ]);

      if (bc.complete) {
        console.log("[GRADUATED] Token has moved to PumpAMM");
        return;
      }

      const summary = getBondingCurveSummary({
        global,
        feeConfig,
        mintSupply: bc.tokenTotalSupply,
        bondingCurve: bc,
      });

      const snapshot: PriceSnapshot = {
        timestamp: Date.now(),
        mintAddress: mint.toBase58(),
        buyPrice: summary.buyPricePerToken.toNumber() / 1e9,
        sellPrice: summary.sellPricePerToken.toNumber() / 1e9,
        spread:
          ((summary.buyPricePerToken.toNumber() -
            summary.sellPricePerToken.toNumber()) /
            summary.buyPricePerToken.toNumber()) *
          100,
        marketCapSol: summary.marketCap.toNumber() / 1e9,
        graduationPercent: summary.progressBps / 100,
        isGraduated: summary.isGraduated,
      };

      console.log(
        `[${new Date(snapshot.timestamp).toLocaleTimeString()}]`,
        `Buy: ${snapshot.buyPrice.toFixed(9)} SOL`,
        `| Sell: ${snapshot.sellPrice.toFixed(9)} SOL`,
        `| MCap: ${snapshot.marketCapSol.toFixed(4)} SOL`,
        `| Grad: ${snapshot.graduationPercent.toFixed(1)}%`
      );
    } catch (err) {
      console.error("Poll error:", err);
    }
  }, intervalMs);
}

pollPrice(mint);
```

## Step 10: Compare Buy Sizes for Slippage

```typescript
function slippageTable(
  global: any,
  feeConfig: any,
  mintSupply: BN,
  bondingCurve: any,
  solAmounts: number[]
) {
  console.log("\n=== Slippage Table ===");
  console.log("SOL Amount | Tokens Out | Price/Token | Impact");
  console.log("-----------|------------|-------------|-------");

  for (const sol of solAmounts) {
    const amount = new BN(sol * 1e9);
    const impact = calculateBuyPriceImpact({
      global,
      feeConfig,
      mintSupply,
      bondingCurve,
      solAmount: amount,
    });

    const pricePerToken = amount.toNumber() / impact.outputAmount.toNumber();
    console.log(
      `${sol.toString().padEnd(10)} | ${impact.outputAmount.toString().padEnd(10)} | ${pricePerToken.toFixed(9).padEnd(11)} | ${(impact.impactBps / 100).toFixed(2)}%`
    );
  }
}

slippageTable(global, feeConfig, mintSupply, bondingCurve, [
  0.01, 0.1, 0.5, 1.0, 5.0, 10.0,
]);
```

## Next Steps

- Use these analytics in [Tutorial 11](./11-trading-bot.md) for informed trading
- See [Tutorial 34](./34-amm-liquidity-operations.md) for AMM pricing after graduation
- See [Tutorial 20](./20-mcp-server-ai-agents.md) to expose analytics as AI tools
