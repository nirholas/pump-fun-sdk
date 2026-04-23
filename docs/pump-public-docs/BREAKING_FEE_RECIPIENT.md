# Breaking Fee Recipient Upgrade — 2026-04-28

> Mirror of [pump-fun/pump-public-docs/docs/BREAKING_FEE_RECIPIENT.md](https://github.com/pump-fun/pump-public-docs/blob/main/docs/BREAKING_FEE_RECIPIENT.md).
>
> **Upgrade date:** 2026-04-28, 16:00 UTC.
> **Programs affected:** Pump bonding curve + PumpSwap AMM.
> **Reference SDK versions:** [`@pump-fun/pump-sdk@1.33.0`](https://www.npmjs.com/package/@pump-fun/pump-sdk), [`@pump-fun/pump-swap-sdk@1.15.0`](https://www.npmjs.com/package/@pump-fun/pump-swap-sdk).
> **This repo’s SDK version supporting the upgrade:** `@nirholas/pump-sdk@1.32.0`.

## Summary

A breaking program upgrade adds new trailing accounts to every `buy` and `sell` instruction on both the bonding curve and PumpSwap AMM programs. One of **8 new shared fee recipient pubkeys** must be passed with each trade. On AMM, the recipient's quote-mint ATA must also be passed as the final account.

All accounts up to and including `bonding-curve-v2` (bonding curve) and `pool-v2` (AMM) remain the same — the change is strictly a *trailing-account append*.

## The 8 new fee recipients (shared across both programs)

```
5YxQFdt3Tr9zJLvkFccqXVUwhdTWJQc1fFg2YPbxvxeD
9M4giFFMxmFGXtc3feFzRai56WbBqehoSeRE5GK7gf7
GXPFM2caqTtQYC2cJ5yJRi9VDkpsYZXzYdwYpGnLmtDL
3BpXnfJaUTiwXnJNe7Ej1rcbzqTTQUvLShZaWazebsVR
5cjcW9wExnJJiqgLjq7DEG75Pm6JBgE1hNv4B2vHXUW6
EHAAiTxcdDwQ3U4bU6YcMsQGaekdzLS3B5SmYo46kJtL
5eHhjP8JaYkz83CWwvGU2uMUXefd3AazWGx4gpcuEEYD
A7hAgCzFw14fejgCp387JUJRMNyz4j89JKnhtKU8piqW
```

Pick any one per transaction — they are interchangeable. In `@nirholas/pump-sdk` they are exported as `BREAKING_FEE_RECIPIENTS` and `pickBreakingFeeRecipient()`.

## Bonding curve (Pump program)

Append **one** new account at the very end of both `buy` and `sell`:

| Position | Account | Writable | Signer |
|----------|---------|----------|--------|
| last | one of the 8 breaking fee recipients | **yes** | no |

Position it **after `bonding-curve-v2`** in the remaining-accounts list. Final account counts:

| Instruction | Total accounts | Notes |
|-------------|----------------|-------|
| `buy` | **18** | always includes `user_volume_accumulator` in the IDL |
| `sell` (non-cashback) | **16** | |
| `sell` (cashback) | **17** | adds `user_volume_accumulator` as a remaining account before `bonding-curve-v2` |

## PumpSwap AMM

Append **two** new accounts at the very end of `buy`, `buy_exact_quote_in`, and `sell`:

| Position | Account | Writable | Signer |
|----------|---------|----------|--------|
| second-to-last | one of the 8 breaking fee recipients | no | no |
| last | recipient's ATA for the pool's **quote mint** (WSOL in the common case) under `TOKEN_PROGRAM_ID` | **yes** | no |

Position both **after `pool-v2`** in the remaining-accounts list. These two accounts are required for **every** AMM buy/sell — including pools that were not graduated from a bonding curve. Final account counts:

| Instruction | Non-cashback | Cashback |
|-------------|--------------|----------|
| `buy` / `buy_exact_quote_in` | **26** | **27** |
| `sell` | **24** | **26** |

## Devnet verification (pre-2026-04-28)

The devnet programs already accept the new accounts. Example transactions linked in the upstream doc include bonding curve buys/sells and AMM buys/sells — re-verify your integration against devnet before mainnet cutover.

Devnet programs at the same IDs as mainnet:
- Pump: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P?cluster=devnet`
- PumpAMM: `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA?cluster=devnet`

## SDK migration

If you use `@nirholas/pump-sdk@1.32.0`+, upgrade and rebuild — the instruction builders (`buyInstructions`, `sellInstructions`, `buyExactSolInInstruction`, `ammBuyInstruction`, `ammBuyExactQuoteInInstruction`, `ammSellInstruction`, and their `Raw` variants) automatically append the new accounts. No call-site changes are required.

If you build instructions manually, use the helpers:

```typescript
import {
  BREAKING_FEE_RECIPIENTS,
  pickBreakingFeeRecipient,
  buildAmmBreakingFeeRecipientAccounts,
  bondingCurveV2Pda,
  poolV2Pda,
} from "@nirholas/pump-sdk";

// Bonding curve trailing accounts:
const bcTrailing = [
  { pubkey: bondingCurveV2Pda(mint), isWritable: false, isSigner: false },
  { pubkey: pickBreakingFeeRecipient(), isWritable: true, isSigner: false },
];

// AMM trailing accounts:
const ammTrailing = [
  { pubkey: poolV2Pda(mint), isWritable: false, isSigner: false },
  ...buildAmmBreakingFeeRecipientAccounts(),
];
```

## What did **not** change

- Account order up to `bonding-curve-v2` / `pool-v2`.
- `Global::fee_recipient` and `Global::fee_recipients` (the pre-existing 8-way protocol fee recipient) — still required, still in the same slot.
- Fee math (bps, tiers, cashback split).
- Creator fee vaults and sharing config PDAs.
