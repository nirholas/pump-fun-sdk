# Agent Task 03: Extract Shared Config Loader

## Context

We're building **PumpKit** (`/workspaces/pump-fun-sdk/pumpkit/`). Read `pumpkit/README.md` and `pumpkit/docs/core-api.md` for the config API spec.

All 4 bots have a `config.ts` with the same pattern: load dotenv, read env vars with defaults, return typed object.

## Source Files to Read

- `/workspaces/pump-fun-sdk/telegram-bot/src/config.ts`
- `/workspaces/pump-fun-sdk/channel-bot/src/config.ts`
- `/workspaces/pump-fun-sdk/claim-bot/src/config.ts`
- `/workspaces/pump-fun-sdk/outsiders-bot/src/config.ts`

## Task

Create `/workspaces/pump-fun-sdk/pumpkit/packages/core/src/config/index.ts`:

1. Read all 4 config files to understand the patterns
2. Build a generic `loadConfig(schema)` function that:
   - Accepts a schema object defining env var names, types, defaults, and required flags
   - Supports types: `string`, `number`, `boolean`, `string[]` (comma-separated)
   - Validates required fields and throws clear errors
   - Returns a fully typed config object
3. Also export pre-built schemas for common config patterns (Telegram token, Solana RPC, feed toggles)

## API Design (from docs/core-api.md)

```typescript
const config = loadConfig({
  TELEGRAM_BOT_TOKEN: { type: 'string', required: true },
  SOLANA_RPC_URL: { type: 'string', required: true },
  FEED_CLAIMS: { type: 'boolean', default: true },
  WHALE_THRESHOLD_SOL: { type: 'number', default: 100 },
  ADMIN_CHAT_IDS: { type: 'string[]', default: [], separator: ',' },
});
```

## Requirements

- TypeScript with proper generic types so the return type is inferred from the schema
- Zero external dependencies (dotenv is loaded by the consumer, not by the config module)
- ES module syntax
- Clear error messages: "Missing required environment variable: TELEGRAM_BOT_TOKEN"

## Do NOT

- Don't import/require dotenv (let consumers handle it)
- Don't modify existing bot code
- Don't create .env files
