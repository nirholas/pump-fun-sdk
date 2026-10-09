# Pump Official Public Documentation

> Mirror of [pump-fun/pump-public-docs](https://github.com/pump-fun/pump-public-docs) — the official Pump protocol documentation.

## Documentation Index

| Document | Description |
|----------|-------------|
| [PUMP_PROGRAM_README.md](PUMP_PROGRAM_README.md) | Pump bonding curve program — state, instructions, fee recipients |
| [PUMP_SWAP_README.md](PUMP_SWAP_README.md) | PumpSwap (Pump AMM) program — constant-product AMM pools |
| [PUMP_SWAP_SDK_README.md](PUMP_SWAP_SDK_README.md) | PumpSwap SDK — create pool, deposit, swap, withdraw |
| [PUMP_CREATOR_FEE_README.md](PUMP_CREATOR_FEE_README.md) | Pump program creator fee update — creator vault, fee calculation |
| [PUMP_SWAP_CREATOR_FEE_README.md](PUMP_SWAP_CREATOR_FEE_README.md) | PumpSwap creator fee update — coin creator vault, fee calculation |
| [FEE_PROGRAM_README.md](FEE_PROGRAM_README.md) | Fee program — tiered fees, fee config, fee sharing |
| [PUMP_CASHBACK_README.md](PUMP_CASHBACK_README.md) | Cashback rewards — user volume accumulator, claim instructions |
| [FAQ.md](FAQ.md) | Frequently asked questions — CU optimization, fee calculations |
| [BREAKING_FEE_RECIPIENT.md](BREAKING_FEE_RECIPIENT.md) | **2026-04-28 breaking upgrade** — new trailing fee-recipient accounts on every buy/sell |
| [HOLDER_REWARDS_README.md](HOLDER_REWARDS_README.md) | Holder rewards coins: creator fees paid to holders, and the end of cashback launches |
| [FEE_RECIPIENTS.md](FEE_RECIPIENTS.md) | Protocol, buyback and mayhem fee recipient sets |
| [CPI_README.md](CPI_README.md) | Calling the pump programs from your own Anchor program |
| [SYNTHETIC_MIGRATION.md](SYNTHETIC_MIGRATION.md) | **October 2026:** the last curve buy has no max size; the excess fills against the pool-to-be |
| [NEGATIVE_VIRTUAL_QUOTE_RESERVES.md](NEGATIVE_VIRTUAL_QUOTE_RESERVES.md) | Signed `Pool.virtual_quote_reserves` and how pool prices use it |
| [VIRTUAL_QUOTE_RESERVES_FEE_ADJUSTMENT.md](VIRTUAL_QUOTE_RESERVES_FEE_ADJUSTMENT.md) | Virtual quote reserves and fees kept in the pool |

### Instruction references

| Document | Description |
|----------|-------------|
| [instructions/TRADE_V3.md](instructions/TRADE_V3.md) | **October 2026:** `buy_v3`, `sell_v3`, `buy_exact_quote_in_v3`: smaller trades, partial fills, any quote mint |
| [instructions/PUMP_SWAP_TRADE_V2.md](instructions/PUMP_SWAP_TRADE_V2.md) | **October 2026:** PumpSwap `buy_v2`, `sell_v2`, `buy_exact_quote_in_v2` |
| [instructions/MULTI_HOP_SWAP.md](instructions/MULTI_HOP_SWAP.md) | **October 2026:** `multi_hop_swap` across PumpSwap pools |
| [instructions/CREATE_WITH_PUMP_COIN_QUOTE.md](instructions/CREATE_WITH_PUMP_COIN_QUOTE.md) | **October 2026:** `create_v2` with a pump coin as the quote mint |
| [instructions/SWEEP_FEES.md](instructions/SWEEP_FEES.md) | **October 2026:** fees kept on the curve and pool, and the sweep instructions |
| [instructions/COIN_CREATION.md](instructions/COIN_CREATION.md) | `create_v2` accounts |
| [instructions/BUY.md](instructions/BUY.md), [instructions/SELL.md](instructions/SELL.md) | Curve `buy_v2` / `sell_v2` accounts |
| [instructions/COLLECT_CREATOR_FEE.md](instructions/COLLECT_CREATOR_FEE.md) | Collecting creator fees |
| [instructions/CREATOR_FEE_SHARING.md](instructions/CREATOR_FEE_SHARING.md) | Creator fee sharing accounts |
| [instructions/CLAIM_CASHBACK.md](instructions/CLAIM_CASHBACK.md) | Claiming cashback on existing cashback coins |

## Programs

| Program | ID | Purpose |
|---------|-----|---------|
| Pump | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve create/buy/sell/migrate |
| PumpAMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Post-graduation AMM pools |
| PumpFees | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing/distribution |

## Social Fee PDA Requirements

If you are adding a **GitHub recipient** as a fee recipient in sharing config, make sure to initialize the social fee PDA before adding it as a recipient:

```ts
import { Platform, PUMP_SDK } from "@pump-fun/pump-sdk";

// 1) Update an existing sharing config
await PUMP_SDK.updateSharingConfigWithSocialRecipients({
  authority,
  mint,
  currentShareholders,
  newShareholders: [
    { address: authority, shareBps: 7000 },
    { userId: "1234567", platform: Platform.GitHub, shareBps: 3000 },
  ],
});

// 2) Create sharing config + set social recipients in one flow
await PUMP_SDK.createSharingConfigWithSocialRecipients({
  creator,
  mint,
  pool,
  newShareholders: [
    { address: creator, shareBps: 7000 },
    { userId: "1234567", platform: Platform.GitHub, shareBps: 3000 },
  ],
});
```

### Checklist

- [ ] The GitHub user must be able to log in to claim fees. **GitHub organizations are not supported** for social fee recipients.
- [ ] Only `Platform.GitHub` is supported.
- [ ] Fees in a GitHub vault can only be claimed by the linked GitHub user through Pump.fun (web or mobile).
- [ ] You have initialized the social fee recipient PDA by using one of the above helpers or `createSocialFeePda`.

---

## Mayhem Mode

### Mayhem program ID:
`MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e`

### Mayhem fee recipients (use any one randomly):
- `GesfTA3X2arioaHp8bbKdjG9vJtskViWACZoYyxp4twS`
- `4budycTjhs9fD6xw62VBducVTNgMgJJ5BgtKq7mAZwn6`
- `8SBKzEQU4nLSzcwF4a74F2iaUDQyTfjGndn6qUWBnrpR`
- `4UQeTP1T39KZ9Sfxzo3WR5skgsaP6NZa87BAkuazLEKH`
- `8sNeir4QsLsJdYpc9RZacohhK1Y5FLU3nC5LXgYB4aa6`
- `Fh9HmeLNUMVCvejxCtCL2DbYaRyBFVJ5xrWkLnMH6fdk`
- `463MEnMeGyJekNZFQSTUABBEbLnvMTALbT6ZmsxAbAdq`
- `6AUH3WEHucYZyC61hqpqYUWVto5qA5hjHuNQ32GNnNxA`

### Changes Summary

1. **BondingCurve and Pool struct size increase** — `bondingCurve` account needs at least **82 bytes** (was 81), `pool` needs **244 bytes** (was 243). New `is_mayhem_mode` boolean field.
2. **New `create_v2` instruction** — Uses Token2022 program for token creation and metadata.
3. **New fee recipient requirement** — For `is_mayhem_mode = true` coins, pass a Mayhem fee recipient.

### Action Items

| Change | Action Required |
|--------|----------------|
| Introduction of `create_v2` | Update creation flow to use `create_v2` instruction with Token2022 program |
| Fee recipient for mayhem mode | Pass Mayhem fee recipient at specified account indexes (Pump Swap: 10, Bonding Curve: 2) |

### Checklist
- [ ] Migrate to `create_v2` for new tokens
- [ ] For mints owned by Token2022, ensure you're passing the right associated bonding curve, user token account and token program
- [ ] Handle `is_mayhem_mode = true` by setting the correct fee recipient
- [ ] Confirm fee recipient WSOL token account configuration
