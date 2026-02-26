# Solana Program Architecture — PDAs, Accounts & Multi-Program Coordination

## Skill Description

Design, derive, and manage Program Derived Addresses (PDAs) and account layouts across the Pump ecosystem's four Solana programs: Pump (bonding curve), PumpAMM (liquidity pools), PumpFees (fee sharing), and Mayhem (special mode). Understand cross-program invocation patterns and account lifecycle management.

## Context

The Pump protocol spans multiple on-chain programs that coordinate through shared PDAs and cross-program account references. Tokens progress through a lifecycle from creation on the bonding curve to graduation into an AMM pool. The SDK must derive the correct PDA for every operation and handle accounts that may or may not exist yet.

## Key Files

- `src/pda.ts` — all PDA derivation functions (30+ PDAs across 4 programs)
- `src/sdk.ts` — instruction builders that reference PDAs as account inputs
- `src/state.ts` — on-chain account data structures
- `src/idl/pump.ts` — Pump program IDL (Anchor)
- `src/idl/pump_amm.ts` — PumpAMM program IDL
- `src/idl/pump_fees.ts` — PumpFees program IDL

## Key Concepts

### Program IDs

| Program | ID | Purpose |
|---------|-----|---------|
| Pump | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve (token create/buy/sell) |
| PumpAMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Liquidity pool (post-graduation) |
| PumpFees | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing configuration |
| Mayhem | `MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e` | Special mode token operations |

### PDA Categories

**Global singletons** (no dynamic seeds):
- `GLOBAL_PDA` — `["global"]` on Pump
- `AMM_GLOBAL_PDA` — `["amm_global"]` on PumpAMM
- `PUMP_FEE_CONFIG_PDA` — `["fee_config", PUMP_PROGRAM_ID]` on PumpFees
- `GLOBAL_VOLUME_ACCUMULATOR_PDA` — `["global_volume_accumulator"]` on Pump
- Event authority PDAs — `["__event_authority"]` on each program

**Per-token PDAs** (mint as seed):
- `bondingCurvePda(mint)` — `["bonding-curve", mint]`
- `canonicalPumpPoolPda(mint)` — AMM pool derived via `@pump-fun/pump-swap-sdk`
- `pumpPoolAuthorityPda(mint)` — `["pool-authority", mint]`
- `feeSharingConfigPda(mint)` — `["sharing-config", mint]`
- `getMayhemStatePda(mint)` — `["mayhem-state", mint]`

**Per-user PDAs** (user pubkey as seed):
- `creatorVaultPda(creator)` — `["creator-vault", creator]`
- `ammCreatorVaultPda(creator)` — `["creator_vault", creator]` (note: underscore vs hyphen)
- `userVolumeAccumulatorPda(user)` — `["user_volume_accumulator", user]`

**Mayhem-specific PDAs**:
- `getGlobalParamsPda()` — `["global-params"]`
- `getSolVaultPda()` — `["sol-vault"]`
- `getTokenVaultPda(mint)` — ATA of sol vault for mint (Token-2022)

### Account State Interfaces

| Account | Key Fields | Program |
|---------|-----------|---------|
| `Global` | `authority`, fee config, virtual reserves defaults, `feeRecipients[]` | Pump |
| `BondingCurve` | `virtualTokenReserves`, `virtualSolReserves`, `realTokenReserves`, `complete`, `creator`, `isMayhemMode` | Pump |
| `FeeConfig` | `admin`, `flatFees`, `feeTiers[]` | PumpFees |
| `SharingConfig` | `mint`, `admin`, `adminRevoked`, `shareholders[]` | PumpFees |
| `GlobalVolumeAccumulator` | `startTime`, `endTime`, `solVolumes[]`, `totalTokenSupply[]` | Pump |
| `UserVolumeAccumulator` | `user`, `needsClaim`, `totalUnclaimedTokens`, `currentSolVolume` | Pump |

### Token Lifecycle & Cross-Program Flow

```
1. CREATE (Pump)          → BondingCurve account created
2. BUY/SELL (Pump)        → BondingCurve reserves updated
3. GRADUATE (Pump)        → BondingCurve.complete = true
4. MIGRATE (Pump→PumpAMM) → AMM pool created, BondingCurve frozen
5. TRADE (PumpAMM)        → AMM pool reserves used
6. FEE COLLECT (Both)     → Creator vault balance across both programs
```

### The "BothPrograms" Pattern

Many operations need data from both the bonding curve and AMM programs. The `OnlinePumpSdk` provides `*BothPrograms` variants:
- `getCreatorVaultBalanceBothPrograms(creator)` — sums lamports from both creator vaults
- `fetchUserVolumeAccumulatorTotalStats(user)` — aggregates volume across programs
- `collectCoinCreatorFeeInstructions(creator)` — collects from both vaults
- `claimTokenIncentivesBothPrograms(user)` — claims rewards from both programs

### Account Extension

Bonding curve accounts may need to be extended to `BONDING_CURVE_NEW_SIZE = 151` bytes before certain operations (e.g., setting creator). The `extendAccountInstruction` handles this via the system program's `allocate` equivalent.

## Patterns to Follow

- Use `PublicKey.findProgramAddressSync` for PDA derivation — always synchronous
- Pass `Buffer` for seed segments: `mint.toBuffer()`, `Buffer.from("seed-string")`
- Use the `pumpPda`, `pumpAmmPda`, `pumpFeePda` helpers from `@pump-fun/pump-swap-sdk` when available
- Always check if an account exists before operations that require it (e.g., ATA for buy)
- Handle the graduated state (`complete === true`) — redirect operations to AMM program
- Use `getMultipleAccountsInfo` to batch account fetches

## Common Pitfalls

- Creator vault PDA seeds differ between programs: `"creator-vault"` (Pump) vs `"creator_vault"` (PumpAMM) — note hyphen vs underscore
- `canonicalPumpPoolPda` depends on the `@pump-fun/pump-swap-sdk` library's `poolPda` function with specific argument ordering
- Token-2022 ATAs use `getAssociatedTokenAddressSync` with the Token-2022 program ID, not the default SPL Token program
- Event authority PDAs use `"__event_authority"` (double underscore prefix) — this is an Anchor convention
- `getMayhemStatePda` uses the Mayhem program ID, not the Pump program ID
