# Migration Guide

> How to upgrade between versions of `@nirholas/pump-sdk`. Each section covers breaking changes, new features, and the steps to migrate.

---

## Upgrading to v1.29.0 (Latest)

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
