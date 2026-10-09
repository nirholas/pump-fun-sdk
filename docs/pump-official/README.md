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
| [ANNOUNCEMENTS.md](ANNOUNCEMENTS.md) | Upstream front page: the October 2026 upgrade, negative virtual quote reserves, holder rewards, launch timeline | Start here for what changed and when |
| [HOLDER_REWARDS_README.md](HOLDER_REWARDS_README.md) | Holder rewards coins, `holder_rewards_pda`, end of cashback launches | Creating holder rewards coins, converting existing coins |
| [docs/instructions/TRADE_V3.md](docs/instructions/TRADE_V3.md) | `buy_v3`, `sell_v3`, `buy_exact_quote_in_v3`: smaller trades, partial fills, quote-mint aware accounts | Building curve trades after the October 2026 upgrade |
| [docs/instructions/PUMP_SWAP_TRADE_V2.md](docs/instructions/PUMP_SWAP_TRADE_V2.md) | PumpSwap `buy_v2`, `sell_v2`, `buy_exact_quote_in_v2` | Trading graduated coins with the v2 account list |
| [docs/instructions/MULTI_HOP_SWAP.md](docs/instructions/MULTI_HOP_SWAP.md) | `multi_hop_swap` routes across PumpSwap pools | Routing a coin through its pump-coin quote in one transaction |
| [docs/instructions/CREATE_WITH_PUMP_COIN_QUOTE.md](docs/instructions/CREATE_WITH_PUMP_COIN_QUOTE.md) | `create_v2` with a pump coin as the quote mint | Launching a coin paired with another pump coin |
| [docs/instructions/SWEEP_FEES.md](docs/instructions/SWEEP_FEES.md) | Fees kept on the curve and pool, `sweep_bonding_curve_fee`, `sweep_pool_fee` | Collecting or distributing fees after the upgrade |
| [docs/instructions/COIN_CREATION.md](docs/instructions/COIN_CREATION.md), [BUY.md](docs/instructions/BUY.md), [SELL.md](docs/instructions/SELL.md) | Account lists for `create_v2`, `buy_v2`, `sell_v2` | Exact account order for curve instructions |
| [docs/instructions/COLLECT_CREATOR_FEE.md](docs/instructions/COLLECT_CREATOR_FEE.md), [CREATOR_FEE_SHARING.md](docs/instructions/CREATOR_FEE_SHARING.md), [CLAIM_CASHBACK.md](docs/instructions/CLAIM_CASHBACK.md) | Creator fee collection, fee sharing, cashback claims | Fee and reward account lists |
| [docs/SYNTHETIC_MIGRATION.md](docs/SYNTHETIC_MIGRATION.md) | The last curve buy has no max size; the excess fills against the pool-to-be | Quoting buys that complete a curve |
| [docs/NEGATIVE_VIRTUAL_QUOTE_RESERVES.md](docs/NEGATIVE_VIRTUAL_QUOTE_RESERVES.md) | Signed `Pool.virtual_quote_reserves` | Pool price math, decoding pools |
| [docs/VIRTUAL_QUOTE_RESERVES_FEE_ADJUSTMENT.md](docs/VIRTUAL_QUOTE_RESERVES_FEE_ADJUSTMENT.md) | Virtual quote reserves and fees kept in the pool | Pool fee accounting |
| [docs/FEE_RECIPIENTS.md](docs/FEE_RECIPIENTS.md), [docs/BREAKING_FEE_RECIPIENT.md](docs/BREAKING_FEE_RECIPIENT.md) | Protocol fee recipients and the fee recipient upgrade | Picking a fee recipient account |
| [docs/CPI_README.md](docs/CPI_README.md) | CPI into pump from an Anchor program | On-chain integrations |

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
| Trade on the curve after the October 2026 upgrade | docs/instructions/TRADE_V3.md, docs/SYNTHETIC_MIGRATION.md |
| Trade on PumpSwap with v2 instructions | docs/instructions/PUMP_SWAP_TRADE_V2.md, docs/NEGATIVE_VIRTUAL_QUOTE_RESERVES.md |
| Swap across two pools in one instruction | docs/instructions/MULTI_HOP_SWAP.md |
| Launch a coin quoted in a pump coin | docs/instructions/CREATE_WITH_PUMP_COIN_QUOTE.md |
| Sweep fees kept on the curve or pool | docs/instructions/SWEEP_FEES.md |

## IDL Files

The idl/ subdirectory contains the official Anchor IDL files (refreshed for the October 2026 upgrade) (JSON + TypeScript) for all three programs:
- pump.json / pump.ts — Pump bonding curve program (6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P)
- pump_amm.json / pump_amm.ts — PumpSwap AMM program (pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA)
- pump_fees.json / pump_fees.ts — Pump fees program (pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ)

> Note: The SDK's working IDLs in src/idl/ are generated from these files by `node scripts/sync-idl.mjs`; `node scripts/sync-idl.mjs --check --dir docs/pump-official/idl` confirms they match.
