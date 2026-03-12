# Agent Task 28: Create Pump Client Integration with pump-fun-sdk

## Context

We're building **PumpKit** (`/workspaces/pump-fun-sdk/pumpkit/`). PumpKit bots should be able to leverage the existing `@pump-fun/pump-sdk` for on-chain operations.

The pump-fun-sdk lives at `/workspaces/pump-fun-sdk/src/` and provides:
- `PumpSdk` (offline) — instruction builders
- `OnlinePumpSdk` — RPC fetchers
- Bonding curve math
- PDAs, state types, events, analytics

## Source Files to Read

- `/workspaces/pump-fun-sdk/src/index.ts` — SDK exports
- `/workspaces/pump-fun-sdk/src/sdk.ts` — PumpSdk class
- `/workspaces/pump-fun-sdk/src/onlineSdk.ts` — OnlinePumpSdk class
- `/workspaces/pump-fun-sdk/src/math.ts` — Bonding curve math
- `/workspaces/pump-fun-sdk/src/analytics.ts` — Price impact, graduation progress

## Task

Create `/workspaces/pump-fun-sdk/pumpkit/packages/core/src/solana/sdk-bridge.ts`:

A bridge module that provides PumpKit-friendly wrappers around pump-fun-sdk features:

### 1. Token Price Queries
```typescript
export async function getTokenPrice(connection: Connection, mint: PublicKey): Promise<{ price: number; mcap: number; }>;
```

### 2. Graduation Progress
```typescript
export async function getGraduationProgress(connection: Connection, mint: PublicKey): Promise<{ percent: number; complete: boolean; }>;
```

### 3. Buy/Sell Quotes
```typescript
export async function getBuyQuote(connection: Connection, mint: PublicKey, solAmount: BN): Promise<{ tokens: BN; priceImpact: number; }>;
export async function getSellQuote(connection: Connection, mint: PublicKey, tokenAmount: BN): Promise<{ sol: BN; priceImpact: number; }>;
```

### 4. Bonding Curve State
```typescript
export async function getBondingCurveState(connection: Connection, mint: PublicKey): Promise<BondingCurveInfo | null>;
```

Also create a doc at `/workspaces/pump-fun-sdk/pumpkit/docs/sdk-integration.md` explaining how PumpKit integrates with pump-fun-sdk.

## Requirements

- Import from `@pump-fun/pump-sdk` (as a peer dependency)
- The bridge should make it easy for bot developers to get price/state info
- ES module syntax
- Handle errors gracefully (return null for missing accounts)
- These are convenience wrappers — not duplicating SDK logic

## Do NOT

- Don't modify the pump-fun-sdk source code
- Don't copy SDK code — import and wrap it
- Don't add @pump-fun/pump-sdk as a direct dependency (it's a peerDependency)
