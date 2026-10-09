# Bonding Curve Math

> How the Pump protocol prices tokens with a constant-product bonding curve, and the SDK functions that mirror the on-chain math exactly.

## Overview

The Pump bonding curve uses a **constant-product AMM formula** (similar to Uniswap) to determine token prices. When a token is created, it starts with virtual reserves that define the initial price. As users buy tokens, the price increases along the curve. When the curve is "complete," the token graduates to a full AMM pool.

## Key Concepts

### Virtual vs Real Reserves

The bonding curve tracks two sets of reserves:

| Reserve | Purpose |
|---------|---------|
| `virtualTokenReserves` | Token side of the constant-product formula; includes both real and virtual liquidity |
| `virtualQuoteReserves` | Quote side of the constant-product formula; includes both real and virtual liquidity |
| `realTokenReserves` | Actual tokens available for purchase; decreases as users buy |
| `realQuoteReserves` | Actual quote deposited by buyers; increases as users buy |

The "virtual" reserves are larger than the "real" reserves. This virtual liquidity ensures the price starts at a reasonable level instead of zero.

The quote side is denominated in `bondingCurve.quoteMint`. For most coins that is SOL (stored as `PublicKey.default`, amounts in lamports), but a curve can also be quoted in a whitelisted mint, a `QuoteControl`-listed mint, or another pump coin. These fields were called `virtualSolReserves` / `realSolReserves` before pump generalized curves beyond SOL; the byte layout is unchanged. The formulas below say "SOL" for readability; read it as "the curve's quote token".

### Initial State

When a new token is created, its bonding curve is initialized from the `Global` config:

```typescript
import { newBondingCurve } from "@nirholas/pump-sdk";

const curve = newBondingCurve(global);
// {
//   virtualTokenReserves: global.initialVirtualTokenReserves,
//   virtualQuoteReserves: global.initialVirtualSolReserves,
//   realTokenReserves: global.initialRealTokenReserves,
//   realQuoteReserves: BN(0),
//   tokenTotalSupply: global.tokenTotalSupply,
//   complete: false,
//   creator: PublicKey.default,
//   isMayhemMode: global.mayhemModeEnabled,
//   isCashbackCoin: false,
//   quoteMint: PublicKey.default,        // SOL
//   depth: 0,
//   creatorFee: BN(0), protocolFees: BN(0),
//   ...
// }
```

The starting quote reserves depend on the quote mint: `Global.initialVirtualSolReserves` for SOL, `Global.initialVirtualQuoteReserves` for a whitelisted mint, the mint's `QuoteControl` entry for a listed mint, and a derived seed for a pump coin (see [Pump-coin quotes](#pump-coin-quotes)):

```typescript
// newBondingCurve(global, quoteMint?, quoteControl?, creatorFeeBps?, isHolderReward?, pumpQuote?)
const quoteControl = await onlineSdk.fetchQuoteControl();
const usdcCurve = newBondingCurve(global, usdcMint, quoteControl);
```

### The Constant Product

The core invariant is:

$$k = virtualTokenReserves \times virtualSolReserves$$

This product $k$ stays approximately constant across trades. When a user buys tokens with SOL:
- `virtualSolReserves` increases (more SOL in the pool)
- `virtualTokenReserves` decreases (tokens leave the pool)
- The ratio changes → price goes up

## Buy Math

### How many tokens do I get for X SOL?

The SDK provides `getBuyTokenAmountFromSolAmount`:

```typescript
import { getBuyTokenAmountFromSolAmount } from "@nirholas/pump-sdk";

const tokensOut = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply, // or null for new tokens
  bondingCurve,                               // or null for new tokens
  amount: solAmount,                          // SOL in lamports
});
```

**Under the hood**, the calculation works in three steps:

1. **Deduct fees** from the input SOL amount:

$$inputAmount = \frac{(solAmount - 1) \times 10000}{(protocolFeeBps + creatorFeeBps) + 10000}$$

2. **Apply constant-product formula**:

$$tokensOut = \frac{inputAmount \times virtualTokenReserves}{virtualSolReserves + inputAmount}$$

3. **Cap at real reserves**: you can never buy more than `realTokenReserves`:

$$result = \min(tokensOut, realTokenReserves)$$

### How much SOL to buy X tokens?

The inverse: `getBuySolAmountFromTokenAmount`:

```typescript
import { getBuySolAmountFromTokenAmount } from "@nirholas/pump-sdk";

const solNeeded = getBuySolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply,
  bondingCurve,
  amount: tokenAmount,
});
```

**Formula:**

$$solCost = \frac{\min(amount, realTokenReserves) \times virtualSolReserves}{virtualTokenReserves - \min(amount, realTokenReserves)} + 1$$

Then fees are added on top:

$$totalCost = solCost + fees(solCost)$$

## Sell Math

### How much SOL do I get for X tokens?

The SDK provides `getSellSolAmountFromTokenAmount`:

```typescript
import { getSellSolAmountFromTokenAmount } from "@nirholas/pump-sdk";

const solOut = getSellSolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply,
  bondingCurve,
  amount: tokenAmount,
});
```

**Formula:**

$$solOut_{raw} = \frac{tokenAmount \times virtualSolReserves}{virtualTokenReserves + tokenAmount}$$

Then fees are subtracted:

$$solOut = solOut_{raw} - fees(solOut_{raw})$$

The result is clamped to 0: for dust amounts, ceiling-rounded fees can exceed the gross SOL.

### The sell amount limit

The sell multiply `amount * virtualSolReserves` is widened to u128 on-chain, which leaves the product enormous headroom: at mainnet reserve sizes the product bound sits over 100 million times wider than `u64::MAX`. The binding limit is therefore the token amount's own u64 field width. Sampling live mainnet trade events, 83% of landed sells exceeded a `u64::MAX`-derived bound, some by more than 2000x, so that bound refused transactions the chain accepts. The SDK mirrors the real bound offline:

```typescript
import { maxSafeSellAmount, validateSellAmount, getTokenAmountForTargetSol } from "@nirholas/pump-sdk";

// Largest amount sellable in one instruction (with a 10% safety margin)
const max = maxSafeSellAmount(bondingCurve.virtualQuoteReserves);

// Throws SellOverflowError if amount is too large; sellInstructions calls this for you
validateSellAmount(amount, bondingCurve);
```

For oversized positions, split the sell with `OnlinePumpSdk.sellChunked()`. To sell "enough tokens to get X SOL", `getTokenAmountForTargetSol({ global, feeConfig, mintSupply, bondingCurve, targetSol })` binary-searches the amount and stays inside the safe limit.

## Market Cap

The bonding curve market cap is computed as:

$$marketCap = \frac{virtualSolReserves \times mintSupply}{virtualTokenReserves}$$

```typescript
import { bondingCurveMarketCap } from "@nirholas/pump-sdk";

const mcap = bondingCurveMarketCap({
  mintSupply: bondingCurve.tokenTotalSupply,
  virtualQuoteReserves: bondingCurve.virtualQuoteReserves,
  virtualTokenReserves: bondingCurve.virtualTokenReserves,
});
// Returns BN in the quote mint's base units (lamports for SOL)
```

The market cap is used by the [fee tier system](./fee-tiers.md) to determine which fee rates apply.

### Which fee schedule applies

Since the October 2026 upgrade the fee schedule follows the curve's quote mint, mirroring `FeeConfig::fees_for_quote_mint`:

| Quote mint | Schedule |
|------------|----------|
| SOL-like (`SOL_LIKE_QUOTE_MINTS`, including the zero key) | `feeConfig.feeTiers`, by market cap in lamports |
| A listed stable (`STABLE_QUOTE_MINTS`) | `feeConfig.stableFeeTiers`, by market cap in the stable's base units |
| Anything else, pump coins included | `feeConfig.exoticFlatFees` (or `flatFees` while unset) |

```typescript
import { selectCurveFeeSchedule } from "@nirholas/pump-sdk";

const fees = selectCurveFeeSchedule({ feeConfig, quoteMint: bondingCurve.quoteMint, marketCap: mcap });
// { lpFeeBps, protocolFeeBps, creatorFeeBps }
```

Every quote function on this page takes the quote mint from `bondingCurve.quoteMint`, so it picks the right schedule without extra arguments.

## v3 Trades and Synthetic Migration

`buy_v3`, `buy_exact_quote_in_v3` and `sell_v3` use the same curve formula as `buy` / `sell`, with two differences that matter for quoting:

1. **The fee schedule always comes from `FeeConfig`**, and a curve without a creator pays no creator fee.
2. **A buy may cross the end of the curve.** When it asks for more than `realTokenReserves`, the program sells the remaining supply at the curve's price, completes the curve, and buys the rest from the pool the migration will create (a *synthetic migration*). The transaction logs `CompleteEvent` followed by `PostCompleteBuyEvent`. Mayhem curves stop at the remaining supply instead (send `partialFill` to accept a partial fill).

The pool-to-be holds what the migration would deposit:

$$poolBase = curveBaseTokenBalance - curveTokens$$
$$poolQuote = realQuoteReserves + curveNet - poolMigrationFee$$

(`poolMigrationFee` only applies to SOL curves.) The post-curve leg is priced like a PumpSwap `buy`:

$$legCost = \left\lceil \frac{poolQuote \times pastCurve}{poolBase - pastCurve} \right\rceil$$

and fees are added to the curve leg and the post-curve leg separately. Asking for the whole pool-to-be fails on chain with 6021 `NotEnoughTokensToBuy`; the SDK throws before you send.

```typescript
import { getBuyV3QuoteAmountFromTokenAmount, getBuyV3TokenAmountFromQuoteAmount } from "@nirholas/pump-sdk";

const state = await onlineSdk.fetchBuyState(mint, user);  // includes curveBaseTokenBalance

// Cost of `amount` tokens, fees included (send as max_quote_cost before slippage)
const cost = getBuyV3QuoteAmountFromTokenAmount({
  global, feeConfig,
  mintSupply: state.bondingCurve.tokenTotalSupply,
  bondingCurve: state.bondingCurve,
  amount,
  curveBaseTokenBalance: state.curveBaseTokenBalance,
});

// Tokens a quote budget buys (apply slippage for min_tokens_out)
const tokens = getBuyV3TokenAmountFromQuoteAmount({
  global, feeConfig,
  mintSupply: state.bondingCurve.tokenTotalSupply,
  bondingCurve: state.bondingCurve,
  amount: budget,
  curveBaseTokenBalance: state.curveBaseTokenBalance,
});
```

Both return zero on a complete or migrated curve. A v3 sell cannot cross, so `getSellSolAmountFromTokenAmount` (with `feeConfig` passed) quotes `sell_v3` too. See [TRADE_V3.md](./pump-official/docs/instructions/TRADE_V3.md) and [SYNTHETIC_MIGRATION.md](./pump-official/docs/SYNTHETIC_MIGRATION.md).

## Pump-coin Quotes

`create_v2` can quote a new coin X in another pump coin Q. X does not start from a fixed seed: its `virtualQuoteReserves` is derived so that X's graduation raise is worth about what a fresh coin in Q's own quote would raise. The program:

1. Checks the depth: X gets `Q.depth + 1`, which must not exceed `Global.maxCurveDepth` (6105 `CurveDepthExceeded`).
2. Checks eligibility: Q must not be in mayhem mode, and a depth-0 Q's own quote must be SOL, whitelisted, or `QuoteControl`-listed (6100 `QuoteBondingCurveNotEligible`).
3. Takes the reference seed: Q's own `initialVirtualQuoteReserves` when Q is deeper than 0, otherwise the seed a fresh coin in Q's quote would get.
4. Buys the seed's graduation raise on Q's constant product (Q's pool once migrated, with the pool's signed `virtualQuoteReserves` added; Q's curve before) and scales it back by the raise ratio. A complete but not yet migrated Q is refused (6107 `QuoteCurveAwaitingMigration`), and a result below 1 with 6104 `QuoteReservesOutOfRange`.

```typescript
import { newBondingCurve, pumpQuoteReserves } from "@nirholas/pump-sdk";

const pumpQuote = await onlineSdk.fetchPumpQuote(q);   // Q's curve, pool and QuoteControl, or null
if (pumpQuote) {
  const { virtualQuoteReserves, depth } = pumpQuoteReserves(global, pumpQuote.curve);
  // Or the whole starting curve, to quote the create-and-buy:
  const curve = newBondingCurve(global, q, undefined, undefined, false, pumpQuote.curve);
}
```

Each step throws the typed error the program's refusal maps to (`CurveDepthExceededError`, `QuoteBondingCurveNotEligibleError`, `QuoteCurveAwaitingMigrationError`, `QuoteReservesOutOfRangeError`). `pumpQuoteAdmission(global, pumpQuote.curve)` runs only steps 1 to 3, before Q's pool is fetched. See [CREATE_WITH_PUMP_COIN_QUOTE.md](./pump-official/docs/instructions/CREATE_WITH_PUMP_COIN_QUOTE.md).

## Graduation

A bonding curve is "complete" when `realTokenReserves` reaches zero: all available tokens have been purchased. At that point:

1. `bondingCurve.complete` becomes `true`
2. The token is eligible for migration to a PumpAMM pool
3. No more buy/sell operations are possible on the bonding curve
4. Use `migrateInstruction()` to move the token to an AMM pool

```typescript
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

if (bondingCurve.complete) {
  // Token has graduated: migrate to AMM
  const ix = await PUMP_SDK.migrateInstruction({
    withdrawAuthority: global.withdrawAuthority,
    mint,
    user: wallet.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
  });
}
```

Track progress toward graduation without any extra math:

```typescript
import { getGraduationProgress } from "@nirholas/pump-sdk";

const progress = getGraduationProgress(global, bondingCurve, feeConfig);
// { progressBps, isGraduated, tokensRemaining, tokensTotal, solAccumulated, solNeededToGraduate }
```

## Migrated Curves

Once a bonding curve has been migrated, its reserves are set to zero (`isBondingCurveMigrated(bondingCurve)` checks all four). All SDK math functions return `BN(0)` when they detect this:

```typescript
// migrated bonding curve
if (bondingCurve.virtualTokenReserves.eq(new BN(0))) {
  return new BN(0); // No more bonding curve trading
}
```

## Worked Example

Starting with typical initial reserves:

| Parameter | Value |
|-----------|-------|
| `initialVirtualTokenReserves` | 1,073,000,000,000,000 |
| `initialVirtualSolReserves` | 30,000,000,000 (30 SOL) |
| `initialRealTokenReserves` | 793,100,000,000,000 |
| `tokenTotalSupply` | 1,000,000,000,000,000 (1B tokens) |

**Initial price per token:**

$$price = \frac{virtualSolReserves}{virtualTokenReserves} = \frac{30 \times 10^9}{1.073 \times 10^{15}} \approx 0.000028 \text{ SOL}$$

**Buying 0.1 SOL worth of tokens (ignoring fees):**

$$tokens = \frac{0.1 \times 10^9 \times 1.073 \times 10^{15}}{30 \times 10^9 + 0.1 \times 10^9} = 3,564,784,053,156$$

That is about 3.56M whole tokens (raw units at 6 decimals). After this trade, the new reserves would be:
- `virtualTokenReserves` = 1,069,435,215,946,844
- `virtualSolReserves` = 30,100,000,000

The price has increased slightly because the ratio changed.

## Price Impact

Larger trades cause more price impact (slippage). The constant-product formula naturally provides:

- **Small trades**: minimal price impact
- **Large trades**: significant price impact
- **Approaching graduation**: very high price impact (fewer `realTokenReserves` left)

Quantify it before trading with `calculateBuyPriceImpact` / `calculateSellPriceImpact` (offline) or `OnlinePumpSdk.quoteBuy` / `quoteSell` (fetches state for you). Use the `slippage` parameter in `buyInstructions()` / `sellInstructions()` to set the maximum acceptable slippage as a percentage.

## Runnable examples

Curve Math & Fees examples 11-20 exercise everything on this page: offline buy/sell quotes, market cap, target-SOL sells, and the max-safe-sell limit. Run them with `npm run example 11` through `npm run example 20`.

## Related

- [Fee Tiers](./fee-tiers.md): how fee rates are determined by market cap
- [API Reference](./api-reference.md): complete function signatures
- [Examples](./examples.md): the full example catalog

