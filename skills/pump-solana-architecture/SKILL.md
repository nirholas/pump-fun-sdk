---
name: Pump Solana Architecture
description: >
  Design and derive Program Derived Addresses (PDAs) and account layouts across the
  Pump ecosystem's four Solana programs — global singletons, per-token accounts,
  per-user accumulators, and cross-program coordination patterns.
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
---

# Solana Program Architecture — PDAs, Accounts & Multi-Program Coordination

Design, derive, and manage Program Derived Addresses (PDAs) and account layouts across the Pump ecosystem's four Solana programs with cross-program invocation patterns.

## On-Chain Programs

| Program | ID | Purpose |
|---------|-----|---------|
| Pump | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve operations |
| PumpAMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Graduated AMM pools |
| PumpFees | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing |
| Mayhem | `MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e` | Mayhem-mode tokens |

## PDA Categories

### Global Singletons
- `GLOBAL_PDA` — `["global"]` on Pump — protocol-wide config
- `FEE_CONFIG_PDA` — `["fee-config"]` on Pump — tiered fee settings
- `GLOBAL_VOLUME_ACCUMULATOR_PDA` — `["global_volume_accumulator"]` — protocol-wide volume

### Per-Token PDAs
- `bondingCurvePda(mint)` — `["bonding-curve", mint]` — token bonding curve state
- `bondingCurveTokenAccountPda(mint)` — `["bonding-curve-token-account", mint]`
- `feeSharingConfigPda(mint)` — `["sharing-config", mint]` on PumpFees
- `canonicalPumpPoolPda(mint)` — AMM pool for graduated token

### Per-User PDAs
- `creatorVaultPda(creator)` — `["creator-vault", creator]` on Pump
- `ammCreatorVaultPda(creator)` — `["creator_vault", creator]` on PumpAMM
- `userVolumeAccumulatorPda(user)` — `["user_volume_accumulator", user]`

### Mayhem PDAs
- `mayhemMetadataPda(mint)` — `["mayhem_metadata", mint]` on Mayhem
- `mayhemWsolPda()` — `["mayhem_wsol"]` on Mayhem

## BothPrograms Pattern

Many operations span both Pump and PumpAMM — the SDK provides aggregation:

| Method | Description |
|--------|-------------|
| `getCreatorVaultBalanceBothPrograms` | Sum balance from both vaults |
| `collectCoinCreatorFeeInstructions` | Collect from both programs |
| `fetchUserVolumeAccumulatorTotalStats` | Aggregate volume across programs |
| `claimTokenIncentivesBothPrograms` | Claim rewards from both |

## Token Lifecycle Cross-Program Flow

```
Pump Program                    PumpAMM Program
┌─────────────┐                 ┌──────────────────┐
│ create      │                 │                  │
│ buy / sell  │ ── migrate ──►  │ AMM trading      │
│ graduate    │                 │ fee collection   │
└─────────────┘                 └──────────────────┘
       │                                │
       └──── PumpFees Program ──────────┘
             (fee sharing)
```

## Account Extension

Bonding curve accounts may need extension to `BONDING_CURVE_NEW_SIZE` (151 bytes) before certain operations:

```typescript
const extendIx = await PUMP_SDK.extendAccountInstruction({
    bondingCurvePda: bondingCurvePda(mint),
    bondingCurveAccountInfo
});
```

## Patterns to Follow

- Use `findProgramAddressSync` for all PDA derivation — never manually compute bump seeds
- Group related account fetches into a single `getMultipleAccountsInfo` call
- Always check account existence before decoding — use nullable decoders
- Extend accounts before migration or setCreator operations

## Common Pitfalls

- Creator vault PDA seeds differ: `"creator-vault"` (Pump, hyphen) vs `"creator_vault"` (AMM, underscore)
- `canonicalPumpPoolPda` uses the external pump-swap-sdk, not the Pump program
- Mayhem PDAs are on a separate program (`MAyhSm...`)
- PDA derivation failures indicate an invalid bump — the address is off the Ed25519 curve
