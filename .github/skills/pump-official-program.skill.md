---
applyTo: "**"
---
# Pump Official Program Documentation

## Skill Description

Reference the official Pump program documentation when working on bonding curve instructions, buy/sell logic, account structures, fee calculations, and migration. This is the canonical source from pump-fun/pump-public-docs.

## When to Use

- Implementing or modifying buy/sell instruction builders
- Working with BondingCurve or Global account state
- Implementing fee logic (protocol fees, creator fees, tiered fees)
- Implementing token creation (`create` / `create_v2`)
- Working on migration from bonding curve to AMM
- Extending account sizes

## Official Documentation Files

Read these files for authoritative protocol details:

| File | Content |
|------|---------|
| `docs/pump-official/PUMP_PROGRAM_README.md` | Pump program architecture: Global state, BondingCurve state, all instructions (create, buy, sell, migrate, extend_account) |
| `docs/pump-official/PUMP_CREATOR_FEE_README.md` | Creator fee system: BondingCurve.creator field, creator_vault PDA, fee calculation, extendAccount requirement |
| `docs/pump-official/FEE_PROGRAM_README.md` | Dynamic fee tiers based on market cap, computeFeesBps logic, fee_config account, calculateFeeTier algorithm |
| `docs/pump-official/PUMP_CASHBACK_README.md` | Cashback rewards: UserVolumeAccumulator PDA, claim_cashback instruction, remaining accounts for buy/sell |
| `docs/pump-official/FAQ.md` | CU optimization for buy/sell, PDA bump seed effects on compute |
| `docs/pump-official/README.md` | Breaking changes: create_v2 with Token2022, mayhem mode, fee recipient changes, social fee PDAs |

## Official IDL Files

| File | Program |
|------|---------|
| `docs/pump-official/idl/pump.json` | Pump program (bonding curve) IDL |
| `docs/pump-official/idl/pump.ts` | Pump program TypeScript types |
| `docs/pump-official/idl/pump_fees.json` | PumpFees program IDL |
| `docs/pump-official/idl/pump_fees.ts` | PumpFees program TypeScript types |

## Key Constants

| Constant | Value |
|----------|-------|
| Pump Program ID | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` |
| Global Account | `4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf` (PDA: `["global"]`) |
| BondingCurve PDA | `["bonding-curve", mint]` |
| Creator Vault PDA | `["creator-vault", bonding_curve.creator]` |
| BondingCurve min size | 82 bytes (was 81, added `is_mayhem_mode`) |
| Mayhem Program ID | `MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e` |

## Critical Rules

1. `create` is deprecated — use `create_v2` with Token2022
2. Check `is_mayhem_mode` on BondingCurve to determine which fee recipient to use
3. `extendAccount` must be prepended if `bondingCurveAccountInfo.dataLen < 150`
4. CU limit: use static `100_000` rather than simulating (simulation slows buy/sell)
5. Creator vault PDA derives from `bonding_curve.creator`, NOT the `user`
