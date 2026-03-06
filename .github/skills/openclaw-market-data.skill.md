# OpenClaw Market Data — Bonding Curve Quoting & Analytics

## Skill Description

Query bonding curve state, compute buy/sell quotes with fee decomposition, calculate market cap, detect graduation status, and read token incentive accumulators — providing the read-only data layer that agents need for informed trading and portfolio decisions.

## Context

Before executing trades or making portfolio decisions, agents need accurate market data. The Pump SDK provides functions to fetch on-chain state, compute fee-aware price quotes, determine market capitalization, and check token lifecycle status (bonding curve vs graduated AMM). All calculations use `BN` (bn.js) for precision and match the on-chain program's arithmetic exactly.

## Key Files

- [src/bondingCurve.ts](src/bondingCurve.ts) — Quoting functions, market cap, fee recipients
- [src/fees.ts](src/fees.ts) — Fee tier calculation, BPS computation
- [src/onlineSdk.ts](src/onlineSdk.ts) — RPC fetchers for global state, bonding curves, accumulators
- [src/tokenIncentives.ts](src/tokenIncentives.ts) — Volume-based reward calculations
- [src/state.ts](src/state.ts) — `BondingCurve`, `Global`, `FeeConfig`, `UserVolumeAccumulator` interfaces
- [src/pda.ts](src/pda.ts) — PDA derivations for all queryable accounts

## Price Quoting

### How much token do I get for X SOL?

```typescript
import { getBuyTokenAmountFromSolAmount } from "@pump-fun/pump-sdk";

const tokensOut = getBuyTokenAmountFromSolAmount({
  global,        // Global state
  feeConfig,     // FeeConfig or null
  mintSupply,    // BN (or null for new tokens)
  bondingCurve,  // BondingCurve (or null for new tokens)
  amount: new BN(1_000_000_000),  // 1 SOL in lamports
});
```

### How much SOL does it cost to buy X tokens?

```typescript
import { getBuySolAmountFromTokenAmount } from "@pump-fun/pump-sdk";

const solCost = getBuySolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount: new BN(1_000_000),  // Token amount
});
```

### How much SOL do I receive for selling X tokens?

```typescript
import { getSellSolAmountFromTokenAmount } from "@pump-fun/pump-sdk";

const solOut = getSellSolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount: new BN(1_000_000),  // Token amount to sell
});
```

## Market Cap Calculation

```typescript
import { bondingCurveMarketCap } from "@pump-fun/pump-sdk";

const marketCap = bondingCurveMarketCap({
  mintSupply,           // Total token supply
  virtualSolReserves,   // From bonding curve
  virtualTokenReserves, // From bonding curve
});
// Returns BN in lamports
// Throws if virtualTokenReserves is zero (division by zero)
```

Formula: $\text{marketCap} = \frac{\text{virtualSolReserves} \times \text{mintSupply}}{\text{virtualTokenReserves}}$

## Fee Decomposition

Understand the fee breakdown for any trade:

```typescript
import { computeFeesBps } from "@pump-fun/pump-sdk";

const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
  global,
  feeConfig,
  mintSupply,
  virtualSolReserves,
  virtualTokenReserves,
});
// Both values are BN in basis points (1 BPS = 0.01%)
```

Fee tiers are selected based on market cap — higher market cap may have different fee rates.

## On-Chain State Fetching

### Global Protocol State

```typescript
const onlineSdk = new OnlinePumpSdk(connection);
const global = await onlineSdk.fetchGlobal();
const feeConfig = await onlineSdk.fetchFeeConfig();
```

### Bonding Curve State

```typescript
const bondingCurve = await onlineSdk.fetchBondingCurve(mint);

// Key fields:
// bondingCurve.virtualTokenReserves — Virtual token reserves (BN)
// bondingCurve.virtualSolReserves   — Virtual SOL reserves (BN)
// bondingCurve.realTokenReserves    — Real token reserves (BN)
// bondingCurve.realSolReserves      — Real SOL deposited (BN)
// bondingCurve.complete             — Graduated to AMM?
// bondingCurve.creator              — Creator public key
// bondingCurve.isMayhemMode         — Mayhem mode enabled?
```

### Creator Vault Balance

```typescript
// Single program
const balance = await onlineSdk.getCreatorVaultBalance(creator);

// Both programs combined
const total = await onlineSdk.getCreatorVaultBalanceBothPrograms(creator);
```

### Token Incentive Stats

```typescript
// Global incentive parameters
const accumulator = await onlineSdk.fetchGlobalVolumeAccumulator();

// User's unclaimed rewards
const totalUnclaimed = await onlineSdk.getTotalUnclaimedTokens(user);

// User's complete stats (both programs)
const stats = await onlineSdk.fetchUserVolumeAccumulatorTotalStats(user);
// stats.totalUnclaimedTokens — Unclaimed PUMP tokens
// stats.totalClaimedTokens   — Already claimed PUMP tokens
// stats.currentSolVolume     — User's current epoch volume
```

## Graduation Detection

```typescript
// Method 1: Check complete flag
if (bondingCurve.complete) {
  // Token graduated to PumpAMM — trade there instead
}

// Method 2: Check reserves
if (bondingCurve.virtualTokenReserves.eq(new BN(0))) {
  // Migrated — bonding curve zeroed out
}
```

## Bonding Curve State Interface

```typescript
interface BondingCurve {
  virtualTokenReserves: BN;  // Virtual token reserves (includes offset)
  virtualSolReserves: BN;    // Virtual SOL reserves (includes offset)
  realTokenReserves: BN;     // Actual token reserves available
  realSolReserves: BN;       // Actual SOL deposited
  tokenTotalSupply: BN;      // Total token supply
  complete: boolean;         // Graduated to AMM
  creator: PublicKey;        // Creator address (or sharing config PDA)
  isMayhemMode: boolean;     // Mayhem mode active
}
```

## Constant-Product Formula

The bonding curve uses $x \cdot y = k$ pricing:

- **Buy tokens:** $\text{tokensOut} = \frac{\text{solIn} \times \text{virtualTokenReserves}}{\text{virtualSolReserves} + \text{solIn}}$

- **Sell tokens:** $\text{solOut} = \frac{\text{tokensIn} \times \text{virtualSolReserves}}{\text{virtualTokenReserves} + \text{tokensIn}}$

- **Buy cost (inverse):** $\text{solCost} = \frac{\text{tokensWanted} \times \text{virtualSolReserves}}{\text{virtualTokenReserves} - \text{tokensWanted}} + 1$ (ceiling division)

## Patterns to Follow

- Always fetch `Global` and `FeeConfig` before quoting — fee rates affect output
- Pass `null` for `bondingCurve` and `mintSupply` when quoting for a token that hasn't been created yet
- Use `BN` comparison methods (`.eq()`, `.lt()`, `.gt()`) — never convert to JavaScript numbers
- Check for zero reserves before dividing — `bondingCurveMarketCap` throws on zero token reserves
- Combine data from both Pump and PumpAMM for complete portfolio views

## Common Pitfalls

- Converting `BN` lamports to JavaScript `number` — loses precision for values > 2^53
- Quoting on a graduated token — returns `BN(0)` silently, not an error
- Forgetting that `virtualReserves` include a virtual offset — they're larger than `realReserves`
- Not handling `null` `feeConfig` — falls back to flat fee rates from `Global`
- Assuming market cap is in SOL — it's in lamports (divide by 1e9 for SOL)
