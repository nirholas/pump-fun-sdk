---
applyTo: "src/**,mcp-server/**,telegram-bot/**,channel-bot/**,outsiders-bot/**,claim-bot/**,tests/**,tutorials/**"
---
# Pump Official Protocol Docs — Agent Reference

## Skill Description

Reference the official Pump protocol documentation when implementing or modifying on-chain interaction code. These docs are the canonical specs from [pump-fun/pump-public-docs](https://github.com/pump-fun/pump-public-docs) and must be consulted before making changes to bonding curve, AMM, fee, or creator fee logic.

## When to Read These Docs

**Always read the relevant doc before:**
- Modifying buy/sell/create instruction builders
- Changing fee calculation logic (protocol fees, creator fees, tiered fees)
- Working with bonding curve state or AMM pool state
- Implementing cashback or volume accumulator logic
- Adding or modifying fee sharing configurations
- Working with mayhem mode or Token2022 integration
- Building new bots that interact with Pump on-chain programs
- Creating MCP tools for Pump protocol operations

## Documentation Map

| Task | Read This File |
|------|---------------|
| Bonding curve buy/sell/create, Global/BondingCurve state | `docs/pump-official/PUMP_PROGRAM_README.md` |
| Creator fees on bonding curve, creator vault PDA | `docs/pump-official/PUMP_CREATOR_FEE_README.md` |
| AMM pool swap/deposit/withdraw, Pool/GlobalConfig state | `docs/pump-official/PUMP_SWAP_README.md` |
| PumpSwap SDK methods & autocomplete helpers | `docs/pump-official/PUMP_SWAP_SDK_README.md` |
| Creator fees on AMM pools, coin_creator_vault | `docs/pump-official/PUMP_SWAP_CREATOR_FEE_README.md` |
| Dynamic fee tiers, market-cap-based fee calculation | `docs/pump-official/FEE_PROGRAM_README.md` |
| Cashback rewards, UserVolumeAccumulator PDA | `docs/pump-official/PUMP_CASHBACK_README.md` |
| CU optimization, general FAQ | `docs/pump-official/FAQ.md` |
| Mayhem mode, create_v2, Token2022, social fees | `docs/pump-official/README.md` |

## On-Chain Programs

| Program | ID | Use |
|---------|-----|-----|
| Pump | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve create/buy/sell/migrate |
| PumpAMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Post-graduation AMM pools |
| PumpFees | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing/distribution |

## Key State Accounts

| Account | PDA Seeds | Program |
|---------|-----------|---------|
| Global | `["global"]` | Pump |
| BondingCurve | `["bonding-curve", mint]` | Pump |
| CreatorVault | `["creator-vault", creator]` | Pump |
| GlobalConfig | `["global_config"]` | PumpAMM |
| Pool | `["pool", index, creator, baseMint, quoteMint]` | PumpAMM |
| SharingConfig | `["sharing-config", mint]` | PumpFees |
| FeeConfig | `["fee_config", configProgramId]` | PumpFees |
| UserVolumeAccumulator | `["user_volume_accumulator", user]` | Pump/PumpAMM |

## Critical Rules

1. **BondingCurve accounts need extension** — prepend `extendAccount` if `dataLen < 150`
2. **Pool accounts need extension** — prepend `extendAccount` if `dataLen < 300`
3. **Fee sharing shares must sum to 10,000** — exactly 10,000 BPS total
4. **Check `complete` before trading** — graduated curves cannot be traded on bonding curve
5. **Mayhem mode needs different fee recipient** — use Mayhem fee recipients for `is_mayhem_mode == true`
6. **Use `create_v2` not `create`** — v1 is deprecated
7. **All amounts use BN** — never JavaScript `number` for financial math
