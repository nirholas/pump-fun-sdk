# Fee System — Tiered Fees, Creator Fees & Fee Sharing

## Skill Description

Implement and extend the Pump protocol's fee system: tiered protocol fees based on market cap, creator fee collection across two programs, and fee sharing configuration that distributes creator fees to multiple shareholders.

## Context

The Pump protocol charges fees on every buy/sell transaction. Fees flow to protocol fee recipients and token creators. Creators can optionally set up fee sharing to split their earnings among up to 10 shareholders. The fee system spans three programs and must handle tokens in both bonding curve and graduated (AMM) states.

## Key Files

- `src/fees.ts` — fee computation logic (basis points, tiered fees, ceiling division)
- `src/sdk.ts` — fee sharing instruction builders (`createFeeSharingConfig`, `updateFeeShares`, `distributeCreatorFees`)
- `src/onlineSdk.ts` — online fee queries (`getMinimumDistributableFee`, `buildDistributeCreatorFeesInstructions`)
- `src/errors.ts` — fee-related error classes
- `src/state.ts` — `FeeConfig`, `FeeTier`, `Fees`, `Shareholder`, `SharingConfig` interfaces
- `src/bondingCurve.ts` — fee-aware buy/sell quoting

## Key Concepts

### Fee Types

| Fee | Recipient | When Charged |
|-----|-----------|-------------|
| Protocol fee | `feeRecipients[]` in `Global` | Every buy/sell |
| Creator fee | Token creator's vault PDA | Every buy/sell (if creator is set) |
| LP fee | Liquidity providers (AMM only) | Post-graduation trades |

### Tiered Fee Calculation

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

Each `FeeTier` contains:
- `marketCapLamportsThreshold: BN` — minimum market cap for this tier
- `fees: { lpFeeBps, protocolFeeBps, creatorFeeBps }` — fee rates in basis points

### Fee Computation

```typescript
function getFee({ global, feeConfig, mintSupply, bondingCurve, amount, isNewBondingCurve }): BN {
  const { protocolFeeBps, creatorFeeBps } = computeFeesBps(...);
  const protocolFee = ceilDiv(amount * protocolFeeBps, 10000);
  const creatorFee = hasCreator ? ceilDiv(amount * creatorFeeBps, 10000) : 0;
  return protocolFee + creatorFee;
}
```

### Fee Sharing Configuration

Creators can split their fees among shareholders:

**Rules:**
- Maximum 10 shareholders (`MAX_SHAREHOLDERS`)
- Share amounts are in basis points (10,000 = 100%)
- Total shares must equal exactly 10,000 bps
- No duplicate addresses allowed
- No zero-share shareholders allowed
- Admin can be revoked (making config immutable)

**Detection:** `isCreatorUsingSharingConfig({ mint, creator })` checks if the bonding curve's creator PDA matches the fee sharing config PDA — indicating the creator has migrated to shared fees.

### Fee Distribution Flow

For **non-graduated** tokens:
1. `distributeCreatorFees` — distributes from Pump creator vault

For **graduated** tokens:
1. `transferCreatorFeesToPump` — consolidates AMM vault → Pump vault
2. `distributeCreatorFees` — distributes from Pump creator vault

The `OnlinePumpSdk.buildDistributeCreatorFeesInstructions()` automatically detects graduation and includes the transfer step.

### Minimum Distributable Fee

Before distribution, `getMinimumDistributableFee(mint)` uses transaction simulation to check:
- `minimumRequired: BN` — minimum balance needed for distribution
- `distributableFees: BN` — current available fees
- `canDistribute: boolean` — whether distribution is possible

### Creator Vault Balance

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
| `ShareCalculationOverflowError` | Arithmetic overflow in share math |
| `InvalidShareTotalError` | Shares don't sum to 10,000 bps |
| `DuplicateShareholderError` | Duplicate addresses |
| `PoolRequiredForGraduatedError` | AMM pool missing for graduated token |

## Patterns to Follow

- Use ceiling division (`ceilDiv`) for all fee calculations to prevent dust loss
- Always check both creator vaults (Pump + AMM) when querying balances
- Validate shareholder arrays thoroughly before building update instructions
- Use transaction simulation (`simulateTransaction`) for read-only fee queries
- The `getFeeRecipient` function uses random selection — test accordingly
- Creator fee is only charged when `bondingCurve.creator != PublicKey.default` or it's a new curve

## Common Pitfalls

- Fee tiers must be iterated in reverse — the first match from the end is used
- `computeFeesBps` returns different results depending on whether `feeConfig` is null (legacy vs tiered)
- Creator fees are zero for tokens without a set creator, even if `creatorFeeBps > 0` in the config
- `getMinimumDistributableFee` requires transaction simulation — it cannot be computed offline
- The `transferCreatorFeesToPump` instruction is only needed for graduated tokens — including it for non-graduated tokens will fail


