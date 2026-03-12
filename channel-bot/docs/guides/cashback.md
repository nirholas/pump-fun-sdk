# Cashback System

Volume-based SOL cashback for traders on bonding curves and AMM pools.

> **Programs:** Pump (`6EF8r...`), PumpAMM (`pAMMB...`)

---

## Overview

Cashback rewards traders with a portion of their fees back as SOL. When enabled by the protocol and opted into per-trade, cashback accumulates in a user-specific account and can be claimed at any time.

### How It Works

```
Trade with cashback=true  →  Fees charged  →  Cashback portion accrues  →  Claim later
```

1. **Protocol enables cashback** — Admin calls `toggleCashbackEnabledInstruction`
2. **Trader opts in per-trade** — Pass `cashback: true` on buy/sell instructions
3. **Cashback accrues** — A percentage of the fee is set aside for the trader
4. **Trader claims** — Call `claimCashbackInstruction` to withdraw accumulated SOL

---

## Opting In

Cashback is **opt-in per transaction** via the `cashback` parameter. It's available on these instructions:

### Bonding Curve (Pre-Graduation)

```typescript
// Create token with initial buy + cashback
const ixs = await PUMP_SDK.createV2AndBuyInstructions({
  creator: wallet,
  mint: mintKeypair.publicKey,
  name: "My Token",
  symbol: "MTK",
  uri: metadataUri,
  buyAmountSol: new BN(100_000_000), // 0.1 SOL
  cashback: true,  // ← Enable cashback
});

// Sell with cashback
const ixs = await PUMP_SDK.sellInstructions({
  user: wallet,
  mint: tokenMint,
  bondingCurve: bondingCurveAddress,
  sellTokenAmount: new BN(1_000_000),
  minSolOutput: new BN(90_000),
  cashback: true,  // ← Enable cashback
});
```

### AMM (Post-Graduation)

```typescript
// AMM buy with cashback
const ix = await PUMP_SDK.ammBuyInstruction({
  user: wallet,
  pool: poolAddress,
  mint: tokenMint,
  baseAmountOut: new BN(1_000_000),
  maxQuoteAmountIn: new BN(100_000),
  cashback: true,  // ← Enable cashback
});

// AMM buy exact quote with cashback
const ix = await PUMP_SDK.ammBuyExactQuoteInInstruction({
  user: wallet,
  pool: poolAddress,
  mint: tokenMint,
  quoteAmountIn: new BN(100_000),
  minBaseAmountOut: new BN(900_000),
  cashback: true,
});

// AMM sell with cashback
const ix = await PUMP_SDK.ammSellInstruction({
  user: wallet,
  pool: poolAddress,
  mint: tokenMint,
  baseAmountIn: new BN(1_000_000),
  minQuoteAmountOut: new BN(90_000),
  cashback: true,
});
```

---

## Claiming Cashback

### From Bonding Curve Trades

```typescript
const ix = await PUMP_SDK.claimCashbackInstruction({
  user: walletPublicKey,
});
```

### From AMM Trades

```typescript
const ix = await PUMP_SDK.ammClaimCashbackInstruction({
  user: walletPublicKey,
});
```

---

## Events

### ClaimCashbackEvent

Emitted when cashback is claimed.

| Field | Type | Description |
|-------|------|-------------|
| `user` | `PublicKey` | Claimer |
| `amount` | `BN` | SOL claimed (lamports) |
| `timestamp` | `BN` | Unix timestamp |
| `totalClaimed` | `BN` | Cumulative claimed |
| `totalCashbackEarned` | `BN` | Total earned to date |

```typescript
const event = PUMP_SDK.decodeClaimCashbackEvent(data);
```

### Trade Event Fields

When cashback is active, trade events include:

| Field | Description |
|-------|-------------|
| `cashbackFeeBasisPoints` | Cashback rate (BPS) |
| `cashback` | Cashback amount (lamports) |

These appear on both `TradeEvent` (bonding curve) and `AmmBuyEvent`/`AmmSellEvent` (AMM).

---

## Checking Status

The `CreateEvent` includes:

```typescript
createEvent.isCashbackEnabled // Whether cashback was enabled at token creation
```

---

## Admin Control

The protocol admin can toggle cashback globally:

```typescript
const ix = await PUMP_SDK.toggleCashbackEnabledInstruction({
  authority: globalAuthority,
  enabled: true, // or false to disable
});
```

See [Admin Operations](./admin-operations.md).

---

## Related

- [AMM Trading](./amm-trading.md) — AMM trade instructions
- [Token Incentives](./token-incentives.md) — Volume-based token rewards
- [Events Reference](./events-reference.md) — Full event catalog
- [Admin Operations](./admin-operations.md) — Toggle cashback
