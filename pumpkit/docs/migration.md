# Migration Guide

> How to upgrade between versions of `@nirholas/pump-sdk`. Each section covers breaking changes, new features, and the steps to migrate.

---

## Upgrading to v1.32.0 (Latest)

> Released: 2026-04-23 — covers on-chain cutover on **2026-04-28, 16:00 UTC**.

### Breaking Changes — on-chain program upgrade

On **2026-04-28, 16:00 UTC** the Pump bonding curve and PumpSwap AMM programs are being upgraded to require one of **8 new shared fee recipient pubkeys** as a trailing account on every `buy` and `sell`. On AMM, the recipient's quote-mint ATA must also be passed as the final account.

See [docs/pump-public-docs/BREAKING_FEE_RECIPIENT.md](../../docs/pump-public-docs/BREAKING_FEE_RECIPIENT.md) for the full protocol spec.

### New account totals

| Instruction | Before | After |
|-------------|--------|-------|
| Bonding curve `buy` / `buy_exact_sol_in` | 17 | **18** |
| Bonding curve `sell` (non-cashback) | 15 | **16** |
| Bonding curve `sell` (cashback) | 16 | **17** |
| PumpAMM `buy` / `buy_exact_quote_in` (non-cashback) | 24 | **26** |
| PumpAMM `buy` / `buy_exact_quote_in` (cashback) | 25 | **27** |
| PumpAMM `sell` (non-cashback) | 22 | **24** |
| PumpAMM `sell` (cashback) | 24 | **26** |

### What the SDK does for you

`@nirholas/pump-sdk@1.32.0` appends the new accounts automatically in every instruction builder — `buyInstructions`, `sellInstructions`, `buyExactSolInInstruction`, `getBuyInstructionRaw`, `getSellInstructionRaw`, `ammBuyInstruction`, `ammBuyExactQuoteInInstruction`, `ammSellInstruction`, `createV2AndBuyInstructions`, and the `OnlinePumpSdk` wrappers.

```bash
npm install @nirholas/pump-sdk@^1.32.0
```

### New public API

```typescript
import {
  BREAKING_FEE_RECIPIENTS,              // PublicKey[] — the 8 new recipients
  pickBreakingFeeRecipient,             // () => PublicKey — random selector
  buildAmmBreakingFeeRecipientAccounts, // (recipient?) => AccountMeta[2]
} from "@nirholas/pump-sdk";
```

### Migration steps

1. `npm install @nirholas/pump-sdk@^1.32.0` before 2026-04-28.
2. Rebuild — no code changes if you use the SDK's instruction builders.
3. Verify on devnet before the mainnet cutover.

If you build instructions manually, see the parent [docs/MIGRATION.md](../../docs/MIGRATION.md#upgrading-to-v1320-latest) for the raw remaining-accounts pattern.

Upstream breaking release: `@pump-fun/pump-sdk@1.33.0`, `@pump-fun/pump-swap-sdk@1.15.0`.

---

## Upgrading to v1.29.0

> Released: 2026-03-06

### Breaking Changes

**All buy/sell instructions now require additional V2 PDAs.**

The on-chain Pump program was upgraded to require `bonding_curve_v2` and `pool_v2` accounts on all buy and sell instructions. The SDK handles this automatically — just upgrade and rebuild.

```bash
npm install @nirholas/pump-sdk@latest
```

If you're building instructions manually (not using the SDK), you must now include:

| Instruction | New Required Account | Derivation |
|------------|---------------------|-----------|
| Bonding curve `buy` | `bonding_curve_v2` (readonly) | `bondingCurveV2Pda(mint)` — seeds: `["bonding-curve-v2", mint]` |
| Bonding curve `buyExactSolIn` | `bonding_curve_v2` (readonly) | Same |
| Bonding curve `sell` | `bonding_curve_v2` (readonly) | Same (after optional `user_volume_accumulator`) |
| PumpAMM `buy` | `pool_v2` (readonly) | `poolV2Pda(baseMint)` — seeds: `["pool-v2", base_mint]` |
| PumpAMM `buyExactQuoteIn` | `pool_v2` (readonly) | Same |
| PumpAMM `sell` | `pool_v2` (readonly) | Same |

For cashback coins on PumpAMM, `user_volume_accumulator_wsol_ata` is also prepended as a mutable account.

### New Features

- `bondingCurveV2Pda(mint)` — derive the V2 bonding curve PDA
- `poolV2Pda(baseMint)` — derive the V2 pool PDA
- AMM buy/sell instructions now accept optional `cashback` parameter

### Migration Steps

1. Update the package:
   ```bash
   npm install @nirholas/pump-sdk@latest
   ```
2. Rebuild your project — no code changes needed if you use the SDK's instruction builders
3. If you construct instruction accounts manually, add the V2 PDA accounts listed above
4. Test on devnet before deploying to mainnet

---

## Upgrading to v1.28.0

> Released: 2026-02-26

### What's New

This was a massive feature release. No breaking changes to the core SDK API, but many new modules were added.

**Safe to upgrade:**

```bash
npm install @nirholas/pump-sdk@1.28.0
```

### New SDK Exports

| Export | Description |
|--------|-------------|
| `calculateBuyPriceImpact()` | Price impact analysis for buys |
| `calculateSellPriceImpact()` | Price impact analysis for sells |
| `getGraduationProgress()` | Bonding curve graduation progress (0-100%) |
| `getTokenPrice()` | Current buy/sell price and market cap |
| `getBondingCurveSummary()` | Full bonding curve snapshot |
| `createSocialFeePdaInstruction()` | Create a social fee PDA (platform-based fees) |
| `claimSocialFeePdaInstruction()` | Claim from a social fee PDA |
| `SocialFeePdaCreatedEvent` | Event type for social fee creation |
| `SocialFeePdaClaimedEvent` | Event type for social fee claims |
| `AmmBuyEvent` / `AmmSellEvent` | AMM trade event types |
| `DepositEvent` / `WithdrawEvent` | AMM LP event types |
| `CreatePoolEvent` | AMM pool creation event |
| Fee sharing events | `CreateFeeSharingConfigEvent`, `UpdateFeeSharesEvent`, etc. |

### New Ecosystem Components Added

- **19 tutorials** (`tutorials/`) — beginner to advanced
- **Analytics module** (`src/analytics.ts`) — price impact, graduation, pricing
- **WebSocket relay server** (`websocket-server/`) — real-time token launch broadcasting
- **Live dashboards** (`live/`) — browser-based monitoring UIs
- **x402 payment protocol** (`x402/`) — HTTP 402 micropayments
- **Telegram bot REST API** — full CRUD with auth, rate limiting, SSE, webhooks
- **Expanded Telegram bot** — graduation, whale, fee distribution alerts, CTO detection
- **Channel bot** (`channel-bot/`) — read-only Telegram channel feed
- **DeFi agents** (`packages/defi-agents/`) — 43 AI agent definitions
- **28 agent skill documents** (`skills/`)

---

## Upgrading from v1.0.0 to v1.27.x

### Breaking: `createInstruction` → `createV2Instruction`

`createInstruction` (v1) is deprecated. Use `createV2Instruction` instead:

```typescript
// Before (deprecated — will be removed in v2.0)
const ix = await PUMP_SDK.createInstruction({ mint, name, symbol, uri, creator, user });

// After
const ix = await PUMP_SDK.createV2Instruction({
  mint, name, symbol, uri, creator, user,
  mayhemMode: false,  // NEW — required parameter
  cashback: false,    // NEW — optional, defaults to false
});
```

### Breaking: Fee Calculation Signature Change

Fee functions now accept a `feeConfig` parameter for tiered fee support:

```typescript
// Before (v1.0.0)
const tokens = getBuyTokenAmountFromSolAmount(global, bondingCurve, solAmount);

// After (v1.27+)
const feeConfig = await sdk.fetchFeeConfig(); // Fetch once, reuse

const tokens = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,        // NEW — fetch with sdk.fetchFeeConfig()
  mintSupply,        // NEW — bondingCurve.tokenTotalSupply or null for new curves
  bondingCurve,
  amount: solAmount,
});
```

The same change applies to `getSellSolAmountFromTokenAmount` and `getBuySolAmountFromTokenAmount`.

### New Exports (v1.27+)

| Export | Description |
|--------|-------------|
| `isCreatorUsingSharingConfig()` | Check if a creator has fee sharing configured |
| `MinimumDistributableFeeResult` | Return type for fee distribution checks |
| `DistributeCreatorFeeResult` | Return type for fee distribution execution |
| `MAYHEM_PROGRAM_ID` | Mayhem program address |
| `computeFeesBps()` | Compute fees in basis points for a given tier |
| `calculateFeeTier()` | Determine the fee tier from token supply |
| `NoShareholdersError` | Error: no shareholders configured |
| `TooManyShareholdersError` | Error: exceeded max 10 shareholders |
| `ZeroShareError` | Error: shareholder has 0 BPS share |
| `InvalidShareTotalError` | Error: shares don't total 10,000 BPS |
| `DuplicateShareholderError` | Error: same address appears twice |

---

## Version Summary

| Version | Date | Type | Key Changes |
|---------|------|------|-------------|
| v1.32.0 | 2026-04-23 | **Breaking** | 8 new trailing fee-recipient accounts on all buy/sell (on-chain cutover 2026-04-28, SDK handles automatically) |
| v1.29.0 | 2026-03-06 | **Breaking** | V2 PDAs required on all buy/sell (SDK handles automatically) |
| v1.28.0 | 2026-02-26 | Feature | Analytics, tutorials, bots, dashboards, x402, social fees |
| v1.27.x | — | **Breaking** | `createInstruction` → `createV2Instruction`, fee config parameter |
| v1.0.0 | 2026-02-11 | Initial | Core SDK, bonding curve, fees, vanity generators, MCP server |

---

## General Upgrade Steps

1. **Read the [CHANGELOG](../CHANGELOG.md)** for the full list of changes
2. **Update the package:**
   ```bash
   npm install @nirholas/pump-sdk@<version>
   ```
3. **Run TypeScript compilation** to catch type errors:
   ```bash
   npx tsc --noEmit
   ```
4. **Run your tests** to verify behavior hasn't changed
5. **Test on devnet** before deploying to mainnet

---

## Getting Help

If you run into issues during migration:

1. Check [Troubleshooting](TROUBLESHOOTING.md)
2. Search [issues](https://github.com/nirholas/pump-fun-sdk/issues) for your error
3. Open a [new issue](https://github.com/nirholas/pump-fun-sdk/issues/new?template=bug_report.md) with your migration context
