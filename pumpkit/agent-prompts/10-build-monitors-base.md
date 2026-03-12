# Agent Task 10: Build Monitor Classes (Base + Claim + Launch)

## Context

We're building **PumpKit** (`/workspaces/pump-fun-sdk/pumpkit/`). Read `pumpkit/docs/core-api.md` for the monitor API and `pumpkit/docs/monitor-bot.md` for the feature spec.

The monitors are the heart of the framework — they detect on-chain events and emit typed callbacks.

## Source Files to Read

- `/workspaces/pump-fun-sdk/telegram-bot/src/monitor.ts` — PumpFunMonitor (WebSocket + HTTP)
- `/workspaces/pump-fun-sdk/telegram-bot/src/pump-event-monitor.ts` — Event decoder
- `/workspaces/pump-fun-sdk/telegram-bot/src/token-launch-monitor.ts` — Launch detection
- `/workspaces/pump-fun-sdk/channel-bot/src/event-monitor.ts` — Similar event monitor
- `/workspaces/pump-fun-sdk/channel-bot/src/claim-monitor.ts` — Claim-specific monitor
- `/workspaces/pump-fun-sdk/channel-bot/src/claim-tracker.ts` — Deduplication
- `/workspaces/pump-fun-sdk/claim-bot/src/monitor.ts` — WebSocket relay-based monitor

## Task

Create these files under `/workspaces/pump-fun-sdk/pumpkit/packages/core/src/monitor/`:

### 1. `BaseMonitor.ts`
Abstract base class:
```typescript
export abstract class BaseMonitor {
  abstract start(): void;
  abstract stop(): void;
  status(): MonitorStatus;  // { running, lastEvent, eventsProcessed }
}

export interface MonitorStatus {
  running: boolean;
  lastEvent: number | null;   // timestamp
  eventsProcessed: number;
}
```

### 2. `ClaimMonitor.ts`
Detects fee claim events:
- Subscribes to PumpFees program via WebSocket (`connection.onLogs`)
- Falls back to HTTP polling (`getSignaturesForAddress`) if WebSocket drops
- Deduplicates events (claim tracker pattern from channel-bot)
- Calls `onClaim(event: ClaimEvent)` callback
- Auto-reconnects WebSocket with exponential backoff

### 3. `LaunchMonitor.ts`
Detects new token creations:
- Subscribes to Pump program logs for create events
- Decodes create instruction from logs
- Calls `onLaunch(event: LaunchEvent)` callback

### 4. `index.ts`
Barrel export.

## Requirements

- Use `@solana/web3.js` Connection for RPC/WebSocket
- Import types from `../types/events.ts` (assume they exist per task 07)
- Import program IDs from `../solana/programs.ts` (assume they exist per task 06)
- ES module syntax
- The monitors should be robust: auto-reconnect, log errors, don't crash
- Read the existing monitor implementations carefully — they have production-tested reconnection and dedup logic

## Do NOT

- Don't create the Graduation, Whale, CTO, FeeDist monitors (separate task)
- Don't modify existing bot code
