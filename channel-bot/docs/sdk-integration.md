# SDK Integration Guide

> How PumpKit integrates with `@nirholas/pump-sdk` for on-chain Solana operations.

## Overview

PumpKit wraps the [pump-fun-sdk](https://github.com/nirholas/pump-fun-sdk) to provide bot-friendly async functions for querying bonding curves, token prices, graduation progress, and buy/sell quotes.

The bridge lives in `@pumpkit/core` and is exported from the barrel:

```typescript
import {
  getTokenPrice,
  getGraduationProgress,
  getBuyQuote,
  getSellQuote,
  getBondingCurveState,
} from '@pumpkit/core';
```

## Setup

Install `@nirholas/pump-sdk` as a peer dependency of your bot:

```bash
npm install @nirholas/pump-sdk @solana/web3.js bn.js
```

## Functions

### `getTokenPrice(connection, mint)`

Returns the current buy/sell price per token and market cap.

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { getTokenPrice } from '@pumpkit/core';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const mint = new PublicKey('YourTokenMintAddress...');

const price = await getTokenPrice(connection, mint);
if (price) {
  console.log('Buy price:', price.buyPricePerToken.toString());
  console.log('Market cap:', price.marketCap.toString());
  console.log('Graduated:', price.isGraduated);
}
```

**Returns:** `TokenPriceInfo | null` — `null` if the bonding curve doesn't exist.

### `getGraduationProgress(connection, mint)`

Returns how close a token is to graduating from bonding curve to AMM.

```typescript
import { getGraduationProgress } from '@pumpkit/core';

const progress = await getGraduationProgress(connection, mint);
if (progress) {
  console.log(`${progress.progressBps / 100}% graduated`);
  console.log('Tokens remaining:', progress.tokensRemaining.toString());
  console.log('SOL accumulated:', progress.solAccumulated.toString());
}
```

**Returns:** `GraduationProgress | null`

### `getBuyQuote(connection, mint, solAmount)`

Calculates how many tokens you'd receive for a given SOL amount.

```typescript
import BN from 'bn.js';
import { getBuyQuote } from '@pumpkit/core';

const solAmount = new BN(1_000_000_000); // 1 SOL in lamports
const quote = await getBuyQuote(connection, mint, solAmount);
if (quote) {
  console.log('Tokens received:', quote.tokens.toString());
  console.log('Price impact:', quote.priceImpact, '%');
}
```

**Returns:** `{ tokens: BN, priceImpact: number } | null`

### `getSellQuote(connection, mint, tokenAmount)`

Calculates how much SOL you'd receive for selling a given token amount.

```typescript
import { getSellQuote } from '@pumpkit/core';

const tokenAmount = new BN('1000000000'); // token amount
const quote = await getSellQuote(connection, mint, tokenAmount);
if (quote) {
  console.log('SOL received:', quote.sol.toString(), 'lamports');
  console.log('Price impact:', quote.priceImpact, '%');
}
```

**Returns:** `{ sol: BN, priceImpact: number } | null`

### `getBondingCurveState(connection, mint)`

Fetches the raw bonding curve account state.

```typescript
import { getBondingCurveState } from '@pumpkit/core';

const state = await getBondingCurveState(connection, mint);
if (state) {
  console.log('Complete:', state.complete);
  console.log('Creator:', state.creator);
  console.log('Virtual SOL reserves:', state.virtualSolReserves);
  console.log('Mayhem mode:', state.isMayhemMode);
}
```

**Returns:** `BondingCurveInfo | null`

## Error Handling

All bridge functions return `null` when the bonding curve account doesn't exist (e.g., token hasn't been created yet, or account was closed). Network errors are caught internally and also return `null`.

```typescript
const price = await getTokenPrice(connection, mint);
if (!price) {
  console.log('Token not found or RPC error');
  return;
}
```

## Architecture

```
Your Bot
  ↓
@pumpkit/core (sdk-bridge.ts)
  ↓
@nirholas/pump-sdk (OnlinePumpSdk, analytics, bondingCurve)
  ↓
Solana RPC (getAccountInfo, etc.)
```

The bridge uses `OnlinePumpSdk` internally to fetch Global, FeeConfig, and BondingCurve state, then passes them to the SDK's pure math functions (`getTokenPrice`, `getBuyTokenAmountFromSolAmount`, etc.).

## When to Use the Bridge vs. SDK Directly

| Scenario | Use |
|----------|-----|
| Quick price check in a bot command | Bridge (`getTokenPrice`) |
| Building transaction instructions | SDK directly (`PUMP_SDK.buyInstructions()`) |
| Batch queries for many tokens | SDK directly (manual batching with `getMultipleAccountsInfo`) |
| One-off graduation check | Bridge (`getGraduationProgress`) |
| Complex trading logic | SDK directly for full control |

The bridge is for convenience. For advanced use cases, import from `@nirholas/pump-sdk` directly.
