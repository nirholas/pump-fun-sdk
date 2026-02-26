# Bonding Curve — Pricing & Quoting Engine

## Skill Description

Implement and maintain the constant-product AMM bonding curve math that powers Pump token pricing — including buy/sell quoting, fee-aware calculations, market cap computation, reserve management, and edge-case handling for new, active, and migrated curves.

## Context

Pump tokens are priced using a constant-product bonding curve ($x \times y = k$) where $x$ = virtual SOL reserves and $y$ = virtual token reserves. The bonding curve determines token prices during the pre-graduation phase. Once market cap reaches a threshold, the token "graduates" and migrates to a PumpAMM pool. The math must handle virtual reserves (which inflate initial liquidity), fee deduction before quoting, and the transition to zero reserves on migration.

## Key Files

- `src/bondingCurve.ts` — all bonding curve math functions (buy/sell quoting, market cap)
- `src/fees.ts` — fee computation (basis points, tiered fees, ceiling division)
- `src/state.ts` — `BondingCurve`, `Global`, `FeeConfig`, `FeeTier` interfaces

## Key Functions

### Quoting (Public API)

| Function | Signature | Description |
|----------|-----------|-------------|
| `getBuyTokenAmountFromSolAmount` | `({global, feeConfig, mintSupply, bondingCurve, amount}) → BN` | Given SOL input, computes tokens received (after fees) |
| `getBuySolAmountFromTokenAmount` | `({global, feeConfig, mintSupply, bondingCurve, amount}) → BN` | Inverse: given desired tokens, computes SOL cost (including fees) |
| `getSellSolAmountFromTokenAmount` | `({global, feeConfig, mintSupply, bondingCurve, amount}) → BN` | Given tokens sold, computes SOL received (after fees deducted) |

### Curve Management

| Function | Signature | Description |
|----------|-----------|-------------|
| `newBondingCurve(global)` | `Global → BondingCurve` | Create fresh curve state from global config defaults |
| `bondingCurveMarketCap` | `({mintSupply, virtualSolReserves, virtualTokenReserves}) → BN` | Compute market cap |
| `getStaticRandomFeeRecipient()` | `→ PublicKey` | Pick random fee recipient from 8 hardcoded addresses |

### Internal Quote Functions (Not Exported)

| Function | Formula | Usage |
|----------|---------|-------|
| `getBuyTokenAmountFromSolAmountQuote` | $\frac{dx \times Y}{X + dx}$ | Raw constant-product buy |
| `getBuySolAmountFromTokenAmountQuote` | $\frac{dy \times X}{Y - dy} + 1$ | Raw constant-product inverse buy |
| `getSellSolAmountFromTokenAmountQuote` | $\frac{dy \times X}{Y + dy}$ | Raw constant-product sell |

## Key Concepts

### Constant-Product Formula

$$x \times y = k$$

**Buy (tokens out for SOL in):**
$$\text{tokensOut} = \frac{dx \times Y}{X + dx}$$

Where $dx$ = SOL input (after fees), $X$ = virtual SOL reserves, $Y$ = virtual token reserves.

**Sell (SOL out for tokens in):**
$$\text{solOut} = \frac{dy \times X}{Y + dy}$$

Where $dy$ = tokens sold, $X$ = virtual SOL reserves, $Y$ = virtual token reserves.

### Fee Stripping

Fees are deducted from the SOL amount **before** applying the bonding curve formula:

```typescript
// Strip fees from input SOL
const totalFeeBps = protocolFeeBps + creatorFeeBps;
const inputAmount = (amount.sub(new BN(1))).mul(new BN(10000)).div(new BN(totalFeeBps + 10000));
```

The `- 1` before fee stripping is intentional to handle rounding edge cases.

### Fee-Aware Quoting

All quote functions accept optional `feeConfig` and `mintSupply` for tiered fee support:
- Without `feeConfig`: uses legacy flat fees from `global.feeBasisPoints` + `global.creatorFeeBasisPoints`
- With `feeConfig`: uses market-cap-based tiered fees via `computeFeesBps()`, looking up the appropriate tier

### Market Cap Calculation

$$\text{marketCap} = \frac{\text{virtualSolReserves} \times \text{mintSupply}}{\text{virtualTokenReserves}}$$

Where `mintSupply` defaults to `ONE_BILLION_SUPPLY` ($1 \times 10^{15}$ — 1B tokens with 6 decimals) for standard tokens. Mayhem-mode tokens may have different supply values.

### Fee Tiers

```typescript
interface FeeTier {
    marketCapLamportsThreshold: BN;  // SOL threshold in lamports
    fees: Fees;                       // { lpFeeBps, protocolFeeBps, creatorFeeBps }
}
```

Fee tiers are iterated in **reverse** order — the first tier from the end whose `marketCapLamportsThreshold ≤ currentMarketCap` is selected. This finds the highest applicable tier.

### Slippage Calculation

```
maxSolCost = solAmount + (solAmount × slippage × 10 / 1000)
minSolReceived = solAmount - (solAmount × slippage × 10 / 1000)
```

Where `slippage` is in tenths of a percent (e.g., `slippage: 1` = 0.1%, `slippage: 10` = 1%).

### Ceiling Division

Fee calculations use ceiling division to prevent rounding down to zero:

$$\text{ceilDiv}(a, b) = \frac{a + b - 1}{b}$$

```typescript
function ceilDiv(a: BN, b: BN): BN {
    return a.add(b).sub(new BN(1)).div(b);
}
```

### Virtual vs Real Reserves

| Reserve Type | Includes | Used For |
|-------------|----------|----------|
| `virtualSolReserves` | Real SOL + protocol-added virtual offset | AMM formula calculation |
| `virtualTokenReserves` | Real tokens + virtual offset | AMM formula calculation |
| `realTokenReserves` | Actual tokens available | Buy output cap |
| `realSolReserves` | Actual SOL deposited | Withdrawal limit |

The virtual offset provides initial liquidity depth so that the first trades don't have extreme slippage.

### Edge Cases

| Case | Behavior |
|------|----------|
| Zero amount | Returns `BN(0)` |
| Migrated curve (`complete === true`, zero reserves) | Returns `BN(0)` |
| Null bonding curve | Creates a fresh curve via `newBondingCurve(global)` |
| Tokens exceed real reserves | Caps at `realTokenReserves` |
| Creator fee | Only charged if `bondingCurve.creator != PublicKey.default` or it's a new curve |
| `isMayhemMode === true` | Fee recipients pulled from reserved list |

## BondingCurve State

```typescript
interface BondingCurve {
    virtualTokenReserves: BN;
    virtualSolReserves: BN;
    realTokenReserves: BN;
    realSolReserves: BN;
    tokenTotalSupply: BN;
    complete: boolean;        // true = graduated to AMM
    creator: PublicKey;
    isMayhemMode: boolean;
}
```

## Patterns to Follow

- All amounts use `BN` (bn.js) for arbitrary-precision integer arithmetic — never use JavaScript `number`
- Fee amounts are in **basis points** (1 bps = 0.01%, 10,000 bps = 100%)
- Always deduct fees **before** applying the AMM formula, not after
- Use ceiling division (`ceilDiv`) for fee computation to ensure the protocol never loses dust
- Quote functions are pure — no network calls, no side effects, no mutable state
- Always check `bondingCurve.complete` before building trade instructions
- Handle the `mintSupply` parameter — for Mayhem-mode tokens the actual supply may differ from `ONE_BILLION_SUPPLY`
- Internal quote functions are not exported — only the fee-aware wrappers are public API

## Common Pitfalls

- Confusing virtual reserves (includes virtual offset) with real reserves (actual amounts)
- Not accounting for fees when quoting — raw quote functions give different results than fee-aware ones
- Trying to trade on a graduated curve (`complete === true`) will fail on-chain
- Fee recipient selection is random from `global.feeRecipients[]` — don't assume deterministic ordering
- Market cap calculation uses `mintSupply` not `tokenTotalSupply` — these differ when tokens are held in the curve
- The fee stripping formula subtracts 1 from the amount first: `(amount - 1) * 10000 / (totalFeeBps + 10000)` — this is intentional
- `getBuySolAmountFromTokenAmountQuote` adds `+ 1` to the result to ensure sufficient SOL
- Fee tiers iterate in **reverse** order — not forward
- `getStaticRandomFeeRecipient()` uses 8 hardcoded addresses — this is separate from `global.feeRecipients[]`

## Testing

- Test buy/sell roundtrip: buying N tokens and selling N tokens should return approximately the original SOL (minus fees)
- Test edge cases: zero amount, zero reserves, null bonding curve, maximum token purchase
- Verify fee calculations match the on-chain Rust implementation (`pump-fees-math::calculate_fee_tier()`)
- Test tiered fee transitions at boundary market caps
- Test both legacy (flat fees from Global) and new (tiered from FeeConfig) paths

