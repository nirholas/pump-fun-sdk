# @pumpkit/core

Shared utilities for all PumpKit Telegram bots.

## What's Inside

- **Logger** — Leveled console logger with ISO timestamps
- **Health Server** — Minimal HTTP health endpoint for Railway/Docker
- **Config Helpers** — Environment variable loading and validation
- **Shutdown** — Graceful SIGINT/SIGTERM handler registration
- **Types** — Common type definitions (BaseBotConfig, PumpEvent, TokenInfo)

## Usage

```typescript
import {
  log,
  setLogLevel,
  startHealthServer,
  requireEnv,
  installShutdownHandlers,
  onShutdown,
} from '@pumpkit/core';

// Set log level
setLogLevel('debug');
log.info('Bot starting…');

// Require env vars (throws if missing)
const token = requireEnv('TELEGRAM_BOT_TOKEN');

// Health check on PORT (default 3000)
startHealthServer({ startedAt: Date.now() });

// Graceful shutdown
installShutdownHandlers();
onShutdown(async () => {
  log.info('Cleaning up…');
});
```

## Install

```bash
# From the monorepo root
npm install
```

Since this is a workspace package, other PumpKit packages reference it directly:

```json
{
  "dependencies": {
    "@pumpkit/core": "workspace:*"
  }
}
```

## License

MIT
