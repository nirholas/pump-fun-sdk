# Agent Task 25: Create Monitor Bot API Layer (REST + SSE + Webhooks)

## Context

We're building **PumpKit** (`/workspaces/pump-fun-sdk/pumpkit/`). Read `pumpkit/docs/monitor-bot.md` for the API spec.

The Monitor Bot has an optional REST API with SSE streaming and outbound webhooks. This is separate from the @pumpkit/core API primitives — this is the monitor-specific routes and handlers.

## Source Files to Read

- `/workspaces/pump-fun-sdk/telegram-bot/src/api/server.ts`
- `/workspaces/pump-fun-sdk/telegram-bot/src/api/types.ts`
- `/workspaces/pump-fun-sdk/telegram-bot/src/api/apiStore.ts`
- `/workspaces/pump-fun-sdk/telegram-bot/src/api/claimBuffer.ts`
- `/workspaces/pump-fun-sdk/telegram-bot/src/api/rateLimiter.ts`
- `/workspaces/pump-fun-sdk/telegram-bot/src/api/webhooks.ts`
- `/workspaces/pump-fun-sdk/telegram-bot/src/api/index.ts`

## Task

Create these files under `/workspaces/pump-fun-sdk/pumpkit/packages/monitor/src/api/`:

### 1. `server.ts` — HTTP API server
Routes (from monitor-bot.md spec):
- `GET /health` — Health + uptime
- `GET /status` — Monitor status + event counts
- `GET /watches` — List active watches
- `POST /watches` — Add a watch
- `DELETE /watches/:wallet` — Remove a watch
- `GET /claims` — Recent claim events
- `GET /launches` — Recent launches
- `GET /stream` — SSE event stream
- `POST /webhooks` — Register webhook
- `DELETE /webhooks/:id` — Remove webhook

Auth: Bearer token from config

### 2. `types.ts` — API request/response types

### 3. `index.ts` — Wire up API with monitors and stores

## Requirements

- Use @pumpkit/core's API primitives (createApiServer, SSEManager, WebhookManager, RateLimiter) where they exist
- If core primitives don't exist yet, use Node.js built-in `http` module directly
- Bearer token authentication
- JSON request/response
- ES module syntax
- Adapt from existing telegram-bot/src/api/ code

## Do NOT

- Don't use Express
- Don't modify existing bot code
