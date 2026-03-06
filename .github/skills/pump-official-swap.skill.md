---
applyTo: "**"
---
# PumpSwap (AMM) Official Documentation

## Skill Description

Reference the official PumpSwap (Pump AMM) documentation when working on post-graduation AMM pool instructions, swap logic, liquidity deposit/withdraw, pool state, and creator fee handling for AMM pools.

## When to Use

- Implementing or modifying AMM buy/sell/swap instructions
- Working with Pool or GlobalConfig account state
- Implementing liquidity deposit/withdraw
- Working with canonical Pump pools (graduated bonding curves)
- Implementing creator fees for AMM pools
- Working with PumpSwap SDK autocomplete helpers

## Official Documentation Files

Read these files for authoritative protocol details:

| File | Content |
|------|---------|
| `docs/pump-official/PUMP_SWAP_README.md` | PumpSwap program: GlobalConfig state, Pool state, all instructions (create_pool, buy, sell, deposit, withdraw), SDK method mapping, autocomplete UI helpers |
| `docs/pump-official/PUMP_SWAP_SDK_README.md` | PumpSwap SDK structure: PumpAmmSdk (high-level), PumpAmmInternalSdk (low-level), PumpAmmAdminSdk (admin), swap/deposit/withdraw flows |
| `docs/pump-official/PUMP_SWAP_CREATOR_FEE_README.md` | Creator fees on AMM: Pool.coin_creator field, coin_creator_vault_authority PDA, extendAccount for pools, collectCoinCreatorFee instruction |
| `docs/pump-official/FEE_PROGRAM_README.md` | Dynamic fee tiers for canonical pools, poolMarketCap calculation, isPumpPool check |

## Official IDL Files

| File | Program |
|------|---------|
| `docs/pump-official/idl/pump_amm.json` | PumpSwap (AMM) program IDL |
| `docs/pump-official/idl/pump_amm.ts` | PumpSwap (AMM) TypeScript types |

## Key Constants

| Constant | Value |
|----------|-------|
| PumpSwap Program ID | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` |
| GlobalConfig Account | `ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw` (PDA: `["global_config"]`) |
| Pool PDA | `["pool", index, creator, baseMint, quoteMint]` |
| LP Mint PDA | `["pool_lp_mint", pool_key]` |
| Canonical Pool Index | `0` (pools created by Pump `migrate` instruction) |
| Pool min size | 244 bytes (was 243, added `is_mayhem_mode`) |

## Canonical Pool Detection

A canonical Pump pool is one whose `pool.creator` matches:
```typescript
pumpPoolAuthorityPda(baseMint)[0] // derives ["pool-authority", baseMint] from Pump program
```
Only canonical pools receive creator fees.

## Critical Rules

1. `extendAccount(pool)` must be prepended if `pool.dataLen < 300`
2. AMM buy/sell need `coin_creator_vault_ata` and `coin_creator_vault_authority` accounts (indexes 17-18)
3. Creator vault authority PDA: `["creator_vault", pool.coin_creator]`
4. For mayhem mode pools, use mayhem fee recipient instead of normal fee recipient
5. LP fee (20 bps) + protocol fee (5 bps) on every swap; creator fee is additional
