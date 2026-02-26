# Bonding Curve Mathematics — Constant-Product AMM Pricing

## Skill Description

Implement and maintain the constant-product bonding curve math that prices token buy/sell operations, including fee-aware quoting, market cap calculation, and edge-case handling for new, active, and migrated curves.

## Context

The Pump protocol uses a constant-product AMM formula ($x \times y = k$) for its bonding curve. Tokens start on the bonding curve and "graduate" to a full AMM pool after reaching a certain market cap threshold. The math must handle virtual reserves (which inflate initial liquidity), fee deduction before quoting, and the transition to zero reserves on migration.

## Key Files

- `src/bondingCurve.ts` — all AMM math functions (buy/sell quoting, market cap)
- `src/fees.ts` — fee computation (basis points, tiered fees, creator fees)
- `src/state.ts` — `BondingCurve`, `Global`, `FeeConfig`, `FeeTier` interfaces

## Key Concepts

### Constant-Product Formula

The core pricing uses the standard AMM formula:

**Buy (tokens out for SOL in):**
$$\text{tokensOut} = \frac{dx \times Y}{X + dx}$$

Where $dx$ = SOL input (after fees), $X$ = virtual SOL reserves, $Y$ = virtual token reserves.

**Sell (SOL out for tokens in):**
$$\text{solOut} = \frac{dy \times X}{Y + dy}$$

Where $dy$ = tokens sold, $X$ = virtual SOL reserves, $Y$ = virtual token reserves.

### Fee Stripping

Fees are deducted from the SOL amount **before** applying the bonding curve formula:

```typescript
inputAmount = (amount - 1) * 10000 / (totalFeeBps + 10000)
```

Where `totalFeeBps = protocolFeeBps + creatorFeeBps`.

### Fee Computation (Two Paths)

1. **New path** (`feeConfig != null`): Market-cap-based tiered fees via `FeeConfig.feeTiers[]`. The `calculateFeeTier()` function iterates tiers in reverse to find the highest tier where market cap exceeds the threshold.
2. **Legacy path**: Flat fees from `Global.feeBasisPoints` and `Global.creatorFeeBasisPoints`.

### Market Cap

$$\text{marketCap} = \frac{\text{virtualSolReserves} \times \text{mintSupply}}{\text{virtualTokenReserves}}$$

Where `mintSupply` defaults to `ONE_BILLION_SUPPLY` (1B tokens with 6 decimals = `1_000_000_000_000_000`).

### Ceiling Division

Fee calculations use ceiling division to prevent rounding down to zero:

$$\text{ceilDiv}(a, b) = \frac{a + b - 1}{b}$$

### Virtual vs Real Reserves

- **Virtual reserves**: Include protocol-added liquidity to provide initial depth. Used in AMM formula.
- **Real reserves**: Actual tokens/SOL in the bonding curve account. Caps buy output — you can never buy more tokens than `realTokenReserves`.

### Edge Cases

| Case | Behavior |
|------|----------|
| Zero amount | Returns `BN(0)` |
| Migrated curve (zero reserves) | Returns `BN(0)` |
| Null bonding curve | Creates a fresh curve via `newBondingCurve(global)` |
| Tokens exceed real reserves | Caps at `realTokenReserves` |
| Creator fee | Only charged if `bondingCurve.creator != PublicKey.default` or it's a new curve |

## Patterns to Follow

- All math uses `BN` (bn.js) for arbitrary-precision integer arithmetic — never use JavaScript `number` for token/SOL amounts
- Fee amounts are in **basis points** (1 bps = 0.01%, 10000 bps = 100%)
- Always deduct fees **before** applying the AMM formula, not after
- Use ceiling division for fee computation to ensure the protocol never loses dust
- Handle the `mintSupply` parameter — for Mayhem-mode tokens the actual supply may differ from `ONE_BILLION_SUPPLY`
- Quote functions are internal (not exported) — only the fee-aware wrappers are public

## Common Pitfalls

- Confusing virtual and real reserves — the AMM formula uses virtual, but output is capped by real
- Forgetting that `getBuySolAmountFromTokenAmountQuote` adds `+ 1` to the result (ensures sufficient SOL)
- The fee stripping formula `(amount - 1) * 10000 / (totalFeeBps + 10000)` subtracts 1 from the amount first — this is intentional to handle rounding
- `bondingCurveMarketCap` takes an object parameter, not positional args
- Tiered fees iterate in **reverse** order — the last tier whose threshold is met wins

## Testing

- Test buy/sell roundtrip: buying N tokens and selling N tokens should return approximately the original SOL (minus fees)
- Test edge cases: zero amount, zero reserves, null bonding curve, maximum token purchase
- Verify fee calculations match the on-chain Rust implementation (`pump-fees-math::calculate_fee_tier()`)
- Test tiered fee transitions at boundary market caps
