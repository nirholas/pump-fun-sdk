# Official PumpFun Protocol Documentation

> Source: [pump-fun/pump-public-docs](https://github.com/pump-fun/pump-public-docs)

These are the **canonical** protocol specifications from the PumpFun team. Always consult the relevant file before modifying on-chain interaction code.

## Document Index

| Document | Topic | When to Read |
|----------|-------|-------------|
| [OVERVIEW.md](OVERVIEW.md) | create_v2, Token2022, mayhem mode, social fees, breaking changes | Protocol-level changes, Token2022 migration, mayhem mode, social fee PDAs |
| [PUMP_PROGRAM_README.md](PUMP_PROGRAM_README.md) | Pump bonding curve program — Global/BondingCurve state, all instructions | Building/modifying buy, sell, create, migrate, extend_account instructions |
| [PUMP_SWAP_README.md](PUMP_SWAP_README.md) | PumpSwap AMM program — GlobalConfig/Pool state, swap/deposit/withdraw | Working with graduated tokens, AMM pools, LP operations |
| [PUMP_SWAP_SDK_README.md](PUMP_SWAP_SDK_README.md) | PumpSwap SDK method mapping to Anchor instructions + autocomplete helpers | SDK integration, UI autocomplete, understanding method naming |
| [FEE_PROGRAM_README.md](FEE_PROGRAM_README.md) | Dynamic fee tiers — market cap thresholds, computeFeesBps, calculateFeeTier | Fee calculation logic, tier breakpoints, slippage adjustments |
| [PUMP_CREATOR_FEE_README.md](PUMP_CREATOR_FEE_README.md) | Creator fees on bonding curve — creator_vault PDA, BondingCurve::creator | collect_creator_fee, set_creator, set_metaplex_creator |
| [PUMP_SWAP_CREATOR_FEE_README.md](PUMP_SWAP_CREATOR_FEE_README.md) | Creator fees on AMM pools — coin_creator_vault_authority, canonical pools | collect_coin_creator_fee, Pool::coin_creator, pool extension |
| [PUMP_CASHBACK_README.md](PUMP_CASHBACK_README.md) | Cashback rewards — UserVolumeAccumulator PDA, claim instructions | Cashback-enabled coins, claim_cashback, reading unclaimed amounts |
| [FAQ.md](FAQ.md) | CU optimization, PDA bump seed effects on compute | Performance tuning, compute unit limits, simulation tips |

## Quick Lookup by Task

| Task | Read |
|------|------|
| Create a new token | OVERVIEW.md (create_v2), PUMP_PROGRAM_README.md |
| Buy/sell on bonding curve | PUMP_PROGRAM_README.md, PUMP_CREATOR_FEE_README.md |
| Trade on AMM (graduated token) | PUMP_SWAP_README.md, PUMP_SWAP_CREATOR_FEE_README.md |
| Calculate fees | FEE_PROGRAM_README.md |
| Collect creator fees | PUMP_CREATOR_FEE_README.md, PUMP_SWAP_CREATOR_FEE_README.md |
| Set up fee sharing | OVERVIEW.md (social fees section) |
| Handle mayhem mode | OVERVIEW.md (mayhem section) |
| Cashback-enabled coins | PUMP_CASHBACK_README.md |
| Optimize compute units | FAQ.md |
| Migrate bonding curve to AMM | PUMP_PROGRAM_README.md (migrate instruction) |
| Add liquidity to AMM pool | PUMP_SWAP_README.md (deposit instruction) |

## IDL Files

The idl/ subdirectory contains the official Anchor IDL files (JSON + TypeScript) for all three programs:
- pump.json / pump.ts — Pump bonding curve program (6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P)
- pump_amm.json / pump_amm.ts — PumpSwap AMM program (pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA)
- pump_fees.json / pump_fees.ts — Pump fees program (pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ)

> Note: The SDK's working IDLs are in src/idl/ and may contain additional fields beyond the official ones.
