# OpenClaw Token Trading — Buy & Sell on Bonding Curves

## Skill Description

Buy and sell tokens on Pumpfun bonding curves with slippage protection, fee-aware quoting, and automatic ATA creation — constructed as offline `TransactionInstruction[]` arrays that support both Token (SPL) and Token-2022 programs.

## Context

Token trading on Pumpfun uses a constant-product AMM bonding curve. The SDK provides instruction builders for buying (SOL → tokens) and selling (tokens → SOL), each with built-in slippage calculation, automatic associated token account creation, and fee-recipient selection. All instructions are built offline and returned as arrays for transaction composition.

## Key Files

- [src/sdk.ts](src/sdk.ts) — `PumpSdk.buyInstructions()`, `sellInstructions()`
- [src/onlineSdk.ts](src/onlineSdk.ts) — `OnlinePumpSdk.fetchBuyState()`, `fetchSellState()`
- [src/bondingCurve.ts](src/bondingCurve.ts) — Quoting functions for buy/sell amounts
- [src/fees.ts](src/fees.ts) — Fee calculation with tiered BPS rates
- [src/state.ts](src/state.ts) — `BondingCurve`, `Global`, `FeeConfig` interfaces

## Buy Flow

```
1. Fetch buy state (bonding curve + user ATA)
2. Quote: SOL amount → token amount (fee-aware)
3. Build buyInstructions (ATA creation + buy)
4. Submit transaction
```

### buyInstructions

```typescript
const onlineSdk = new OnlinePumpSdk(connection);
const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } =
  await onlineSdk.fetchBuyState(mint, user, tokenProgram);

const instructions = await PUMP_SDK.buyInstructions({
  global,                          // Global account state
  bondingCurveAccountInfo,         // Raw bonding curve account
  bondingCurve,                    // Decoded bonding curve
  associatedUserAccountInfo,       // User's ATA (null if doesn't exist)
  mint,                            // Token mint address
  user,                            // Buyer public key
  amount: new BN(1_000_000),       // Token amount to receive
  solAmount: new BN(100_000_000),  // SOL to spend (lamports)
  slippage: 1,                     // Slippage tolerance (1 = 1%)
  tokenProgram: TOKEN_2022_PROGRAM_ID,
});
```

The returned instructions include (as needed):
1. `extendAccount` — If bonding curve account is undersized (< 151 bytes)
2. `createAssociatedTokenAccountIdempotent` — If user doesn't have an ATA
3. `buy` — The actual purchase instruction

### Slippage Calculation

```
maxSolCost = solAmount + (solAmount × slippage × 10 / 1000)
```

For a 1% slippage on 1 SOL: `maxSolCost = 1.0 + (1.0 × 1 × 10 / 1000) = 1.01 SOL`

## Sell Flow

```
1. Fetch sell state (bonding curve + verify user ATA exists)
2. Quote: token amount → SOL amount (fee-aware)
3. Build sellInstructions
4. Submit transaction
```

### sellInstructions

```typescript
const { bondingCurveAccountInfo, bondingCurve } =
  await onlineSdk.fetchSellState(mint, user, tokenProgram);

const instructions = await PUMP_SDK.sellInstructions({
  global,
  bondingCurveAccountInfo,
  bondingCurve,
  mint,
  user,
  amount: new BN(1_000_000),       // Token amount to sell
  solAmount: new BN(90_000_000),   // Expected SOL to receive (lamports)
  slippage: 1,                     // Slippage tolerance
  tokenProgram: TOKEN_2022_PROGRAM_ID,
  mayhemMode: bondingCurve.isMayhemMode,
  cashback: false,                 // Enable cashback tracking
});
```

### Sell Slippage Calculation

```
minSolReceived = solAmount - (solAmount × slippage × 10 / 1000)
```

## Quoting Functions

### Buy: SOL → Tokens

```typescript
import { getBuyTokenAmountFromSolAmount } from "@pump-fun/pump-sdk";

const tokensReceived = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,           // FeeConfig or null
  mintSupply,          // BN or null (null for new tokens)
  bondingCurve,        // BondingCurve or null (null for new tokens)
  amount: solAmount,   // SOL amount in lamports
});
```

### Buy: Tokens → SOL cost

```typescript
import { getBuySolAmountFromTokenAmount } from "@pump-fun/pump-sdk";

const solCost = getBuySolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount: tokenAmount,  // Token amount to buy
});
```

### Sell: Tokens → SOL received

```typescript
import { getSellSolAmountFromTokenAmount } from "@pump-fun/pump-sdk";

const solReceived = getSellSolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount: tokenAmount,  // Token amount to sell
});
```

## Fee-Aware Pricing

All quoting functions account for protocol and creator fees:

```typescript
const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
  global,
  feeConfig,
  mintSupply,
  virtualSolReserves,
  virtualTokenReserves,
});

// Total fee deducted from buy amount:
// fee = amount × feeBps / 10_000
```

Fees are tiered based on market cap — higher market cap tokens may have different fee rates. See `calculateFeeTier()` for the tier selection logic.

## Fee Recipient Selection

The buy/sell instructions include a `feeRecipient` parameter selected randomly from the protocol's list:

```typescript
// Normal mode: random from global.feeRecipients[]
// Mayhem mode: random from global.reservedFeeRecipients[]
const feeRecipient = getFeeRecipient(global, mayhemMode);
```

## Graduated Token Detection

Before trading, check if the token has graduated to AMM:

```typescript
if (bondingCurve.complete === true) {
  // Token has graduated — bonding curve is closed
  // Trade on PumpAMM instead
}

if (bondingCurve.virtualTokenReserves.eq(new BN(0))) {
  // Migrated — reserves zeroed out
  // Quoting functions return BN(0)
}
```

## Patterns to Follow

- Always fetch bonding curve state before building trade instructions
- Use `BN` for all amounts — never JavaScript `number`
- Check `bondingCurve.complete` before attempting bonding curve trades
- Bundle ATA creation with the buy instruction in the same transaction
- Set reasonable slippage (1-5%) to protect against front-running
- Use `tokenProgram` matching the token's program (Token vs Token-2022)

## Common Pitfalls

- Trading on a graduated token (`complete === true`) — the bonding curve is closed
- Using wrong `tokenProgram` — Token-2022 tokens fail with SPL Token program and vice versa
- Forgetting `extendAccount` for old bonding curves (< 151 bytes)
- Setting slippage to 0 — transactions will fail on any price movement
- Passing token amount where SOL amount is expected, or vice versa
- Not accounting for fees in quote calculations — net received differs from gross
