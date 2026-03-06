# Tutorial 5: Bonding Curve Math Deep Dive

> Understand how Pump's constant-product bonding curve prices tokens and how to calculate trades off-chain.

## The Bonding Curve Formula

Pump uses a **constant-product** bonding curve, similar to Uniswap's `x * y = k`:

$$k = \text{virtualSolReserves} \times \text{virtualTokenReserves}$$

The price at any point is:

$$\text{price} = \frac{\text{virtualSolReserves}}{\text{virtualTokenReserves}}$$

As tokens are bought, `virtualTokenReserves` decreases and `virtualSolReserves` increases, pushing the price up.

## Key State Variables

```typescript
import { BondingCurve } from "@pump-fun/pump-sdk";

// These are the fields on every BondingCurve account:
interface BondingCurve {
  virtualTokenReserves: BN;  // Virtual token pool (determines price)
  virtualSolReserves: BN;    // Virtual SOL pool (determines price)
  realTokenReserves: BN;     // Real tokens remaining for sale
  realSolReserves: BN;       // Real SOL collected
  tokenTotalSupply: BN;      // Total supply of the token
  complete: boolean;         // True = graduated to AMM
  creator: PublicKey;        // Token creator address
  isMayhemMode: boolean;     // Whether Mayhem mode is active
}
```

## Calculating Buy Amounts

Given a SOL amount, how many tokens will you receive?

```typescript
import { getBuyTokenAmountFromSolAmount, OnlinePumpSdk } from "@pump-fun/pump-sdk";
import BN from "bn.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);
const mint = new PublicKey("YOUR_MINT");

const global = await onlineSdk.fetchGlobal();
const feeConfig = await onlineSdk.fetchFeeConfig();
const bondingCurve = await onlineSdk.fetchBondingCurve(mint);

// How many tokens for 1 SOL?
const solAmount = new BN(1_000_000_000); // 1 SOL in lamports
const tokensOut = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply,
  bondingCurve,
  amount: solAmount,
});

console.log(`1 SOL buys ${tokensOut.toString()} tokens`);
```

## Calculating Sell Amounts

Given a token amount, how much SOL will you receive?

```typescript
import { getSellSolAmountFromTokenAmount } from "@pump-fun/pump-sdk";

const tokenAmount = new BN("1000000000"); // Tokens to sell
const solOut = getSellSolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply,
  bondingCurve,
  amount: tokenAmount,
});

console.log(`Selling tokens → ${solOut.toNumber() / 1e9} SOL`);
```

## Reverse Calculation: SOL Cost for a Token Amount

How much SOL to buy a specific number of tokens?

```typescript
import { getBuySolAmountFromTokenAmount } from "@pump-fun/pump-sdk";

const wantTokens = new BN("5000000000"); // Want this many tokens
const solCost = getBuySolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply,
  bondingCurve,
  amount: wantTokens,
});

console.log(`Cost to buy tokens: ${solCost.toNumber() / 1e9} SOL`);
```

## Market Cap Calculation

```typescript
import { bondingCurveMarketCap } from "@pump-fun/pump-sdk";

const marketCap = bondingCurveMarketCap({
  mintSupply: bondingCurve.tokenTotalSupply,
  virtualSolReserves: bondingCurve.virtualSolReserves,
  virtualTokenReserves: bondingCurve.virtualTokenReserves,
});

console.log("Market cap:", marketCap.toString(), "lamports");
console.log("Market cap:", marketCap.toNumber() / 1e9, "SOL");
```

## Building a Price Chart

Generate price points across the bonding curve to plot a chart:

```typescript
import { newBondingCurve, getBuyTokenAmountFromSolAmount } from "@pump-fun/pump-sdk";

function generatePriceCurve(global: Global, feeConfig: FeeConfig, steps: number = 20) {
  const curve = newBondingCurve(global);
  const totalRealTokens = curve.realTokenReserves;
  const stepSize = totalRealTokens.divn(steps);

  const points: { tokensBought: string; price: string; marketCap: string }[] = [];

  for (let i = 0; i <= steps; i++) {
    const tokensIn = stepSize.muln(i);
    // Simulate the curve state after buying `tokensIn` tokens
    const virtualTokens = curve.virtualTokenReserves.sub(tokensIn);
    const virtualSol = curve.virtualSolReserves
      .mul(curve.virtualTokenReserves)
      .div(virtualTokens);

    const price = virtualSol.toNumber() / virtualTokens.toNumber();

    points.push({
      tokensBought: tokensIn.toString(),
      price: price.toFixed(12),
      marketCap: (price * curve.tokenTotalSupply.toNumber()).toFixed(0),
    });
  }

  return points;
}

const pricePoints = generatePriceCurve(global, feeConfig);
console.table(pricePoints);
```

## Important Rules

1. **All amounts use `BN` (bn.js)** — never JavaScript `number` for financial math
2. **SOL amounts are in lamports** — 1 SOL = 1,000,000,000 lamports
3. **`complete === true`** means the token graduated to PumpAMM — bonding curve is closed
4. **`virtualTokenReserves === 0`** means fully migrated
5. Fees are subtracted from the SOL amount before the swap calculation

## What's Next?

- [Tutorial 9: Understanding the Fee System](./09-fee-system.md)
- [Tutorial 6: Token Migration to PumpAMM](./06-migration.md)
