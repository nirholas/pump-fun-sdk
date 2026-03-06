---
applyTo: "**"
---
# PumpSwap SDK — Official Documentation

## Skill Description

Reference the official PumpSwap SDK documentation when building AMM pool UI integrations, implementing swap/deposit/withdraw flows, or using autocomplete helpers for price calculation and input balancing.

## When to Use

- Building UI for AMM pool interactions (swap, deposit, withdraw)
- Using autocomplete helpers for input balancing
- Understanding the difference between `PumpAmmSdk`, `PumpAmmInternalSdk`, and `PumpAmmAdminSdk`
- Creating pools, swapping tokens, depositing/withdrawing liquidity
- Implementing swap direction toggling

## Official Documentation

Read `docs/pump-official/PUMP_SWAP_SDK_README.md` for the full specification.

## SDK Structure

| SDK Class | Purpose | Use Case |
|-----------|---------|----------|
| `PumpAmmSdk` | High-level SDK | UI integrations, autocomplete helpers |
| `PumpAmmInternalSdk` | Low-level SDK | Programmatic control, custom instructions |
| `PumpAmmAdminSdk` | Admin SDK | Admin-protected instructions |

## Key Operations

### Create Pool

```typescript
const createPoolIxs = await pumpAmmSdk.createPoolInstructions(
  index, creator, baseMint, quoteMint, baseIn, quoteIn
);

// UI autocomplete for initial price display
const initialPrice = pumpAmmSdk.createAutocompleteInitialPoolPrice(initialBase, initialQuote);
```

### Swap

Swap direction: `quoteToBase` (default, ⬇️) or `baseToQuote` (⬆️).

```typescript
// Autocomplete: when quote input changes
const base = await pumpAmmSdk.swapAutocompleteBaseFromQuote(pool, quote, slippage, swapDirection);

// Autocomplete: when base input changes
const quote = await pumpAmmSdk.swapAutocompleteQuoteFromBase(pool, base, slippage, swapDirection);

// Build swap instructions (either base or quote as fixed input)
const swapIxs = await pumpAmmSdk.swapBaseInstructions(pool, base, slippage, swapDirection, user);
// OR
const swapIxs = await pumpAmmSdk.swapQuoteInstructions(pool, quote, slippage, swapDirection, user);
```

### Deposit

```typescript
// Autocomplete: when base changes
const { quote, lpToken } = await pumpAmmSdk.depositAutocompleteQuoteAndLpTokenFromBase(pool, base, slippage);

// Autocomplete: when quote changes
const { base, lpToken } = await pumpAmmSdk.depositAutocompleteBaseAndLpTokenFromQuote(pool, quote, slippage);

// Build deposit instruction (lpToken is the fixed input)
const depositIxs = await pumpAmmSdk.depositInstructions(pool, lpToken, slippage, user);
```

### Withdraw

```typescript
// Autocomplete: preview amounts before withdrawal
const { base, quote } = pumpAmmSdk.withdrawAutocompleteBaseAndQuoteFromLpToken(pool, lpToken, slippage);

// Build withdraw instruction
const withdrawIxs = await pumpAmmSdk.withdrawInstructions(pool, lpToken, slippage, user);
```

## UI Pattern

Default pool display is `(quote, base)` with `⬇️` arrow (quoteToBase):

```
(USDC, SOL) pool:
┌──────────────┐
│ USDC (quote) │
│     ⬇️       │
│ SOL  (base)  │
└──────────────┘
```

Toggle arrow to `⬆️` for `baseToQuote` direction.

## Critical Rules

1. **`lpToken` is the only fixed input for deposit** — autocomplete the other values
2. **Swap direction must be explicit** — `quoteToBase` or `baseToQuote`
3. **Use autocomplete helpers for UIs** — they handle slippage calculations correctly
4. **`PumpAmmSdk` for UIs, `PumpAmmInternalSdk` for bots** — choose the right abstraction level
