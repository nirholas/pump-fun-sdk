# Agent Task 06: Extract Solana RPC + Program Constants

## Context

We're building **PumpKit** (`/workspaces/pump-fun-sdk/pumpkit/`). Read `pumpkit/docs/core-api.md` and `pumpkit/docs/architecture.md`.

All Solana-interacting bots share RPC connection setup, program IDs, and WebSocket derivation logic.

## Source Files to Read

- `/workspaces/pump-fun-sdk/telegram-bot/src/types.ts` (program IDs, discriminators)
- `/workspaces/pump-fun-sdk/telegram-bot/src/monitor.ts` (RPC + WebSocket setup)
- `/workspaces/pump-fun-sdk/channel-bot/src/types.ts`
- `/workspaces/pump-fun-sdk/channel-bot/src/rpc-fallback.ts` (fallback RPC rotation)
- `/workspaces/pump-fun-sdk/channel-bot/src/event-monitor.ts` (WebSocket subscription)
- `/workspaces/pump-fun-sdk/claim-bot/src/types.ts`

## Task

Create these files under `/workspaces/pump-fun-sdk/pumpkit/packages/core/src/solana/`:

### 1. `programs.ts`
- Export program ID constants as strings AND PublicKey objects:
  - `PUMP_PROGRAM_ID` = `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`
  - `PUMP_AMM_PROGRAM_ID` = `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`
  - `PUMP_FEE_PROGRAM_ID` = `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ`
  - `PUMPFUN_FEE_ACCOUNT` = `CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbCJ5GEFDM97zC`
- Export instruction discriminators from existing types.ts files

### 2. `rpc.ts`
- `createRpcConnection(options)` — Creates a Solana `Connection` with:
  - Primary URL
  - Fallback URL rotation (from channel-bot's rpc-fallback.ts pattern)
  - WebSocket URL auto-derivation (https→wss, http→ws)
  - Configurable commitment level
- `deriveWsUrl(httpUrl)` — Convert HTTP RPC URL to WebSocket

### 3. `index.ts`
- Barrel export for all solana/ modules

## Requirements

- Depends on `@solana/web3.js` and `bs58`
- ES module syntax
- The RPC fallback should rotate to next URL on connection error
- Keep the same logic as channel-bot's rpc-fallback.ts — don't over-engineer

## Do NOT

- Don't create event decoders (that's a separate task)
- Don't modify existing bot code
