---
name: pump-fee-system
description: "Complete Pump protocol fee system — tiered protocol fees based on market cap, creator fee collection across two programs, basis point arithmetic, and ceiling division for dust-safe calculations."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
---

# Fee System — Tiered Fees, Creator Fees & Protocol Fees

Implement and extend the Pump protocol's fee system: tiered protocol fees based on market cap, creator fee collection across two programs, and fee computation with ceiling division.

## Context

The Pump protocol charges fees on every buy/sell transaction. Fees flow to protocol fee recipients and token creators. The fee system spans three programs and must handle tokens in both bonding curve and graduated (AMM) states.

## Fee Types

| Fee | Recipient | When Charged |
|-----|-----------|-------------|
| Protocol fee | `feeRecipients[]` in `Global` | Every buy/sell |
| Creator fee | Token creator's vault PDA | Every buy/sell (if creator is set) |
| LP fee | Liquidity providers (AMM only) | Post-graduation trades |

## Tiered Fee Calculation

When a `FeeConfig` exists, fees are market-cap-dependent:

```typescript
function calculateFeeTier({ feeTiers, marketCap }): Fees {
  // Iterate tiers in REVERSE order
  for (let i = feeTiers.length - 1; i >= 0; i--) {
    if (marketCap >= feeTiers[i].marketCapLamportsThreshold) {
      return feeTiers[i].fees;
    }
  }
  return feeTiers[0].fees; // fallback to lowest tier
}
```

## Fee Computation

```typescript
function getFee({ global, feeConfig, mintSupply, bondingCurve, amount }): BN {
  const { protocolFeeBps, creatorFeeBps } = computeFeesBps(...);
  const protocolFee = ceilDiv(amount * protocolFeeBps, 10000);
  const creatorFee = hasCreator ? ceilDiv(amount * creatorFeeBps, 10000) : 0;
  return protocolFee + creatorFee;
}
```

## Creator Vault Balance

Creator fees accumulate in PDAs:
- `creatorVaultPda(creator)` — Pump program vault
- `ammCreatorVaultPda(creator)` — PumpAMM program vault

Balance = total lamports - rent exemption minimum.

## Error Classes

| Error | Condition |
|-------|-----------|
| `NoShareholdersError` | Empty shareholders array |
| `TooManyShareholdersError` | More than 10 shareholders |
| `ZeroShareError` | Shareholder has `shareBps <= 0` |
| `InvalidShareTotalError` | Shares don't sum to 10,000 bps |
| `DuplicateShareholderError` | Duplicate addresses |

## Patterns to Follow

- Use ceiling division (`ceilDiv`) for all fee calculations to prevent dust loss
- Always check both creator vaults (Pump + AMM) when querying balances
- Use transaction simulation (`simulateTransaction`) for read-only fee queries
- Creator fee is only charged when `bondingCurve.creator != PublicKey.default` or it's a new curve

## Common Pitfalls

- Fee tiers must be iterated in reverse — the first match from the end is used
- `computeFeesBps` returns different results depending on whether `feeConfig` is null (legacy vs tiered)
- Creator fees are zero for tokens without a set creator
- `getMinimumDistributableFee` requires transaction simulation — it cannot be computed offline
- `transferCreatorFeesToPump` is only for graduated tokens — non-graduated tokens will fail
