---
name: pump-bonding-curve
description: "Constant-product AMM bonding curve math for Pump token pricing — buy/sell quoting, fee-aware calculations, market cap computation, tiered fees, ceiling division, virtual vs real reserves, and edge-case handling."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
---

# Bonding Curve — Pricing, Quoting & AMM Mathematics

Implement and maintain the constant-product AMM bonding curve math that powers Pump token pricing — including buy/sell quoting, fee-aware calculations, market cap computation, reserve management, and edge-case handling for new, active, and migrated curves.

## Context

Pump tokens are priced using a constant-product bonding curve ($x \times y = k$) where $x$ = virtual SOL reserves and $y$ = virtual token reserves. The bonding curve determines token prices during the pre-graduation phase. Once market cap reaches a threshold, the token "graduates" and migrates to a PumpAMM pool.

## Key Files

- `src/bondingCurve.ts` — all bonding curve math functions (buy/sell quoting, market cap)
- `src/fees.ts` — fee computation (basis points, tiered fees, ceiling division)
- `src/state.ts` — `BondingCurve`, `Global`, `FeeConfig`, `FeeTier` interfaces

## Constant-Product Formula

$$x \times y = k$$

**Buy (tokens out for SOL in):**
$$\text{tokensOut} = \frac{dx \times Y}{X + dx}$$

Where $dx$ = SOL input (after fees), $X$ = virtual SOL reserves, $Y$ = virtual token reserves.

**Sell (SOL out for tokens in):**
$$\text{solOut} = \frac{dy \times X}{Y + dy}$$

Where $dy$ = tokens sold, $X$ = virtual SOL reserves, $Y$ = virtual token reserves.

## Fee Stripping

Fees are deducted from the SOL amount **before** applying the bonding curve formula:

```typescript
inputAmount = (amount - 1) * 10000 / (totalFeeBps + 10000)
```

The `- 1` before fee stripping is intentional to handle rounding edge cases.

## Market Cap Calculation

$$\text{marketCap} = \frac{\text{virtualSolReserves} \times \text{mintSupply}}{\text{virtualTokenReserves}}$$

Where `mintSupply` defaults to `ONE_BILLION_SUPPLY` ($1 \times 10^{15}$ — 1B tokens with 6 decimals).

## Fee Tiers

When a `FeeConfig` exists, fees are market-cap-dependent. Fee tiers are iterated in **reverse** order — the first tier from the end whose `marketCapLamportsThreshold ≤ currentMarketCap` is selected.

```typescript
interface FeeTier {
    marketCapLamportsThreshold: BN;
    fees: { lpFeeBps: BN; protocolFeeBps: BN; creatorFeeBps: BN };
}
```

## Ceiling Division

$$\text{ceilDiv}(a, b) = \frac{a + b - 1}{b}$$

```typescript
function ceilDiv(a: BN, b: BN): BN {
    return a.add(b).sub(new BN(1)).div(b);
}
```

## Virtual vs Real Reserves

| Reserve Type | Includes | Used For |
|-------------|----------|----------|
| `virtualSolReserves` | Real SOL + protocol-added virtual offset | AMM formula calculation |
| `virtualTokenReserves` | Real tokens + virtual offset | AMM formula calculation |
| `realTokenReserves` | Actual tokens available | Buy output cap |
| `realSolReserves` | Actual SOL deposited | Withdrawal limit |

## Edge Cases

| Case | Behavior |
|------|----------|
| Zero amount | Returns `BN(0)` |
| Migrated curve (`complete === true`, zero reserves) | Returns `BN(0)` |
| Null bonding curve | Creates a fresh curve via `newBondingCurve(global)` |
| Tokens exceed real reserves | Caps at `realTokenReserves` |
| Creator fee | Only charged if `bondingCurve.creator != PublicKey.default` or it's a new curve |

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

## Common Pitfalls

- Confusing virtual reserves (includes virtual offset) with real reserves (actual amounts)
- Not accounting for fees when quoting — raw quote functions give different results than fee-aware ones
- Trying to trade on a graduated curve (`complete === true`) will fail on-chain
- Fee tiers iterate in **reverse** order — not forward
- Market cap calculation uses `mintSupply` not `tokenTotalSupply`
- The fee stripping formula subtracts 1 from the amount first — this is intentional
- `getBuySolAmountFromTokenAmountQuote` adds `+ 1` to the result to ensure sufficient SOL
