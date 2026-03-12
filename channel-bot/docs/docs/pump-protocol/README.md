# Pump Protocol Reference

> Official protocol documentation from [pump-fun/pump-public-docs](https://github.com/pump-fun/pump-public-docs). Read these before building on-chain interactions.

## Three On-Chain Programs

| Program | ID | Purpose |
|---------|-----|---------|
| **Pump** | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve — create, buy, sell tokens |
| **PumpAMM** | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Post-graduation AMM pools — swap, deposit, withdraw |
| **PumpFees** | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing and distribution |

## Documentation Index

### Core

| Doc | Description |
|-----|-------------|
| [OVERVIEW.md](OVERVIEW.md) | create_v2, Token2022, mayhem mode, social fees |
| [PUMP_PROGRAM_README.md](PUMP_PROGRAM_README.md) | Bonding curve state, instructions, account types |
| [PUMP_SWAP_README.md](PUMP_SWAP_README.md) | AMM pool state, swap/deposit/withdraw |
| [PUMP_SWAP_SDK_README.md](PUMP_SWAP_SDK_README.md) | PumpSwap SDK method reference |

### Fees

| Doc | Description |
|-----|-------------|
| [FEE_PROGRAM_README.md](FEE_PROGRAM_README.md) | Dynamic fee tiers based on market cap |
| [PUMP_CREATOR_FEE_README.md](PUMP_CREATOR_FEE_README.md) | Creator fees on bonding curve |
| [PUMP_SWAP_CREATOR_FEE_README.md](PUMP_SWAP_CREATOR_FEE_README.md) | Creator fees on AMM pools |
| [PUMP_CASHBACK_README.md](PUMP_CASHBACK_README.md) | Cashback rewards and UserVolumeAccumulator |

### Reference

| Doc | Description |
|-----|-------------|
| [FAQ.md](FAQ.md) | CU optimization tips, PDA bump effects |
| [idl/](idl/) | Official Anchor IDL files (pump.json, pump_amm.json, pump_fees.json) |
