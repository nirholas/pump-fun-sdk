# Agent Task 04: Extract Health Check Server

## Context

We're building **PumpKit** (`/workspaces/pump-fun-sdk/pumpkit/`). Read `pumpkit/docs/core-api.md` for the health API spec.

Multiple bots have identical health check HTTP servers. Extract into `@pumpkit/core`.

## Source Files to Read

- `/workspaces/pump-fun-sdk/channel-bot/src/health.ts`
- `/workspaces/pump-fun-sdk/outsiders-bot/src/health.ts`
- `/workspaces/pump-fun-sdk/telegram-bot/src/api/server.ts` (look for the /health endpoint)

## Task

Create `/workspaces/pump-fun-sdk/pumpkit/packages/core/src/health/index.ts`:

1. Read the existing health check implementations
2. Create a `createHealthServer(options)` function that:
   - Starts an HTTP server on a configurable port
   - Responds to `GET /health` and `GET /` with JSON status
   - Includes uptime, status, and custom stats from a callback
   - Returns the server instance for cleanup

## API

```typescript
const server = createHealthServer({
  port: 3000,
  getStats: () => ({
    monitors: { claims: { running: true, processed: 123 } },
    watches: 42,
  }),
});

// GET /health → { "status": "ok", "uptime": "3600s", "monitors": {...}, "watches": 42 }
```

## Requirements

- Use Node.js built-in `http` module — no Express for this simple endpoint
- ES module syntax
- Return the `http.Server` instance so callers can `.close()` it on shutdown
- Include `startedAt` timestamp internally for uptime calculation

## Do NOT

- Don't use Express or any HTTP framework
- Don't modify existing bot code
