# Agent Task 07: Extract Event Decoders + Types

## Context

We're building **PumpKit** (`/workspaces/pump-fun-sdk/pumpkit/`). Read `pumpkit/docs/core-api.md` for event type definitions.

The bots decode Pump program logs and transaction data. Extract the decoders and shared event types.

## Source Files to Read

- `/workspaces/pump-fun-sdk/telegram-bot/src/pump-event-monitor.ts` — Main event decoder
- `/workspaces/pump-fun-sdk/telegram-bot/src/types.ts` — Event types + discriminators
- `/workspaces/pump-fun-sdk/channel-bot/src/event-monitor.ts` — Similar decoder
- `/workspaces/pump-fun-sdk/channel-bot/src/types.ts` — Event types
- `/workspaces/pump-fun-sdk/claim-bot/src/types.ts` — Claim-specific types

## Task

Create these files under `/workspaces/pump-fun-sdk/pumpkit/packages/core/src/`:

### 1. `types/events.ts`
Define all shared event types:
```typescript
interface ClaimEvent { signature, wallet, mint, amount, tokenName?, tokenSymbol?, timestamp }
interface LaunchEvent { signature, mint, creator, name, symbol, uri, isMayhemMode, hasCashback, timestamp }
interface GraduationEvent { signature, mint, tokenName, tokenSymbol, poolAddress, finalMcap?, timestamp }
interface WhaleTradeEvent { signature, mint, trader, side, solAmount, tokenAmount, tokenSymbol?, progress?, timestamp }
interface CTOEvent { signature, mint, oldCreator, newCreator, timestamp }
interface FeeDistEvent { signature, mint, totalAmount, shareholders, timestamp }
type PumpEvent = ClaimEvent | LaunchEvent | GraduationEvent | WhaleTradeEvent | CTOEvent | FeeDistEvent
```

### 2. `types/programs.ts`
- Instruction discriminators (the byte arrays used to identify instruction types in logs)
- Account layout types for decoded accounts
- Pull these from the existing `types.ts` files in telegram-bot and channel-bot

### 3. `solana/decoders.ts`
- `decodePumpLogs(logs: string[]): PumpEvent[]` — Decode raw program log lines into typed events
- Use the discriminator-matching logic from `pump-event-monitor.ts` and `event-monitor.ts`
- Merge the best of both implementations

### 4. `types/index.ts`
- Barrel export for all type modules

## Requirements

- Read the actual decoder implementations carefully — they contain important discriminator bytes and parsing logic
- ES module syntax
- Use `@solana/web3.js` types where appropriate (PublicKey, etc.)
- Keep the decoder logic faithful to what's proven in production

## Do NOT

- Don't create monitor classes (that's a separate task)
- Don't modify existing bot code
