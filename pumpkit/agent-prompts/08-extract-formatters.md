# Agent Task 08: Extract Formatters + Link Helpers

## Context

We're building **PumpKit** (`/workspaces/pump-fun-sdk/pumpkit/`). Read `pumpkit/docs/core-api.md` for the formatter API.

All bots have `formatters.ts` files with HTML message builders for Telegram. Extract the shared patterns.

## Source Files to Read

- `/workspaces/pump-fun-sdk/telegram-bot/src/formatters.ts`
- `/workspaces/pump-fun-sdk/channel-bot/src/formatters.ts`
- `/workspaces/pump-fun-sdk/claim-bot/src/formatters.ts`
- `/workspaces/pump-fun-sdk/outsiders-bot/src/formatters.ts`

## Task

Create these files under `/workspaces/pump-fun-sdk/pumpkit/packages/core/src/formatter/`:

### 1. `links.ts`
Common link generators used across all formatters:
```typescript
export function link(label: string, url: string): string  // <a href="url">label</a>
export function solscanTx(signature: string): string       // Solscan TX link
export function solscanAccount(address: string): string    // Solscan account link
export function pumpFunToken(mint: string): string         // pump.fun token page
export function dexScreenerToken(mint: string, chain?: string): string
export function bold(text: string): string                 // <b>text</b>
export function code(text: string): string                 // <code>text</code>
export function italic(text: string): string               // <i>text</i>
export function shortenAddress(address: string, chars?: number): string  // 4xBn...7zQ2
export function formatSol(lamports: BN): string            // "2.50 SOL"
export function formatNumber(n: number): string            // "1,234,567"
```

### 2. `templates.ts`
Pre-built notification templates:
```typescript
export function formatClaim(event: ClaimEvent): string
export function formatLaunch(event: LaunchEvent): string
export function formatGraduation(event: GraduationEvent): string
export function formatWhaleTrade(event: WhaleTradeEvent): string
export function formatCTO(event: CTOEvent): string
export function formatFeeDistribution(event: FeeDistEvent): string
```

Each should produce rich HTML messages with bold titles, amounts, links — matching the existing formatters. Read the source files to replicate the visual style.

### 3. `index.ts`
Barrel export for all formatter modules.

## Requirements

- All output is Telegram HTML (not Markdown)
- Import event types from `../types/events.ts` (assume they exist per task 07)
- Import BN type from bn.js
- ES module syntax
- Match the visual style of the existing bot messages

## Do NOT

- Don't modify existing bot code
- Don't add grammy as a dependency to formatter (these are pure string functions)
