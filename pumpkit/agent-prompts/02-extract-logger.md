# Agent Task 02: Extract Shared Logger Module

## Context

We're building **PumpKit** (`/workspaces/pump-fun-sdk/pumpkit/`) — a framework for PumpFun Telegram bots. Read `pumpkit/README.md` and `pumpkit/docs/architecture.md` for context.

All 4 existing bots have an identical `logger.ts` module. Your job is to extract it into `@pumpkit/core`.

## Source Files to Read

Read these files first to understand the existing logger pattern:
- `/workspaces/pump-fun-sdk/telegram-bot/src/logger.ts`
- `/workspaces/pump-fun-sdk/channel-bot/src/logger.ts`
- `/workspaces/pump-fun-sdk/claim-bot/src/logger.ts`
- `/workspaces/pump-fun-sdk/outsiders-bot/src/logger.ts`

## Task

Create `/workspaces/pump-fun-sdk/pumpkit/packages/core/src/logger/index.ts`:

1. Read all 4 logger files and identify the common pattern
2. Consolidate into a single module that covers all use cases
3. The logger should:
   - Export a `log` object with `debug`, `info`, `warn`, `error` methods
   - Support `LOG_LEVEL` environment variable (debug|info|warn|error)
   - Default to `info` level
   - Include timestamps in output
   - Support the same API as all 4 existing loggers
4. Export from a barrel file at `packages/core/src/logger/index.ts`

## Requirements

- Pure TypeScript, zero external dependencies
- ES module syntax (import/export)
- Must be a drop-in replacement for all 4 existing logger.ts files
- Keep it simple — this is a leveled console logger, not winston

## Do NOT

- Don't modify any existing bot code
- Don't add external logging libraries
- Don't over-engineer (no log rotation, file output, structured JSON, etc.)
