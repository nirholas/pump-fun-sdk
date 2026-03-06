---
applyTo: "**"
---
# Pump Cashback Official Documentation

## Skill Description

Reference the official Pump cashback documentation when implementing cashback rewards, UserVolumeAccumulator PDAs, claim_cashback instructions, or cashback-related remaining accounts on buy/sell.

## When to Use

- Implementing cashback-enabled token creation (create_v2 with cashback flag)
- Adding remaining accounts for cashback on buy/sell instructions
- Implementing claim_cashback instructions for either Pump or PumpSwap
- Reading unclaimed cashback balances
- Working with UserVolumeAccumulator PDAs

## Official Documentation

Read `docs/pump-official/PUMP_CASHBACK_README.md` for the full specification.

## Key Concepts

### Cashback Flag
- `create_v2` accepts an `OptionBool` parameter for cashback: `[true]` to enable
- Stored as `is_cashback_coin: bool` on BondingCurve account
- If cashback is enabled, creator fee goes to users as cashback instead of creator

### Remaining Accounts for Trading Cashback Coins

| Instruction | Remaining Account Index | Account | Writable |
|-------------|------------------------|---------|----------|
| Bonding Curve Sell | 0 | `UserVolumeAccumulator` PDA (Pump program) | Yes |
| PumpSwap Buy | 0 | WSOL ATA of `UserVolumeAccumulator` (AMM program) | Yes |
| PumpSwap Sell | 0 | WSOL ATA of `UserVolumeAccumulator` (AMM program) | Yes |
| PumpSwap Sell | 1 | `UserVolumeAccumulator` (AMM program) | Yes |

Bonding Curve Buy requires **no** additional accounts for cashback.

### UserVolumeAccumulator PDA
- Seed: `["user_volume_accumulator", wallet]`
- Program: use `PUMP_PROGRAM_ID` for bonding curve, `PUMP_AMM_PROGRAM_ID` for AMM
- Same seed, different program ID

### Reading Unclaimed Cashback
- **Bonding curve**: Read lamports of `UserVolumeAccumulator` minus rent-exempt minimum
- **PumpSwap**: Read WSOL token balance of the WSOL ATA of `UserVolumeAccumulator` (AMM program)

### Claim Instructions
- `claim_cashback` on Pump program: transfers native lamports to user wallet
- `claim_cashback` on PumpSwap: transfers WSOL to user's WSOL ATA (must exist beforehand)
