# @pumpkit/core

> Shared framework for building PumpFun Telegram bots on Solana.

[![npm version](https://img.shields.io/npm/v/@pumpkit/core)](https://www.npmjs.com/package/@pumpkit/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green)](https://nodejs.org/)

## What is PumpKit Core?

PumpKit Core is the shared foundation for building Telegram bots that monitor and interact with the PumpFun protocol on Solana. It provides event monitors, RPC management, Telegram bot scaffolding, message formatters, persistent storage, and configuration helpers — everything you need to ship a production bot.

## Installation

```bash
npm install @pumpkit/core
```

Peer dependencies (install what you need):

```bash
npm install grammy @solana/web3.js better-sqlite3
```

## Quick Start

```typescript
import {
  createBot, broadcast, setupShutdown,
  ClaimMonitor, createRpcConnection,
  formatClaim, log, requireEnv,
  startHealthServer, installShutdownHandlers,
} from '@pumpkit/core';

const token = requireEnv('TELEGRAM_BOT_TOKEN');
const chatId = requireEnv('CHAT_ID');
const connection = createRpcConnection();

const bot = createBot({ token, commands: [] });

const monitor = new ClaimMonitor({
  connection,
  programId: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  onClaim: async (event) => {
    const html = formatClaim({
      wallet: event.wallet,
      tokenName: event.tokenName ?? 'Unknown',
      amount: event.amount,
      signature: event.signature,
    });
    await broadcast(bot, [chatId], html);
  },
});

installShutdownHandlers();
startHealthServer({ startedAt: Date.now() });
setupShutdown(bot, () => monitor.stop());
monitor.start();
bot.start();
log.info('Bot running');
```

## Modules

### `bot/` — Telegram Bot Scaffolding

Create a grammy bot with defaults, broadcast messages to chats, and register graceful shutdown.

```typescript
import { createBot, broadcast, setupShutdown } from '@pumpkit/core';

const bot = createBot({ token: '...', commands: [] });
await broadcast(bot, [chatId], '<b>Hello!</b>');
```

### `monitor/` — Event Monitors

Six real-time monitors for on-chain PumpFun events via WebSocket subscriptions:

| Monitor | Detects | Program |
|---------|---------|---------|
| `ClaimMonitor` | Fee claims | PumpFees |
| `LaunchMonitor` | Token creates (`Create`/`CreateV2`) | Pump |
| `GraduationMonitor` | Bonding curve → AMM migration | Pump |
| `WhaleMonitor` | Large buys/sells (configurable threshold) | Pump |
| `CTOMonitor` | Creator authority transfers | Pump |
| `FeeDistMonitor` | Fee distribution events | PumpFees |

All monitors extend `BaseMonitor` and provide `.start()`, `.stop()`, and `.status()`.

### `solana/` — RPC Connection & Program IDs

```typescript
import {
  createRpcConnection, RpcFallback, deriveWsUrl,
  PUMP_PROGRAM_ID, PUMP_AMM_PROGRAM_ID, PUMP_FEE_PROGRAM_ID,
} from '@pumpkit/core';

const conn = createRpcConnection(); // uses RPC_URL env var
const fallback = new RpcFallback(['https://rpc1.example.com', 'https://rpc2.example.com']);
const wsUrl = deriveWsUrl('https://api.mainnet-beta.solana.com');
```

### `solana/sdk-bridge` — Pump SDK Wrappers

```typescript
import { getTokenPrice, getBuyQuote, getGraduationProgress } from '@pumpkit/core';
```

### `formatter/` — Telegram HTML Templates

Pre-built notification templates for all event types, plus link helpers.

```typescript
import { formatLaunch, formatWhaleTrade, solscanTx, shortenAddress } from '@pumpkit/core';
```

### `storage/` — Persistent Storage

```typescript
import { FileStore, SqliteStore } from '@pumpkit/core';

// JSON file persistence with atomic writes
const fileStore = new FileStore<string[]>('./data/seen.json', []);

// SQLite with WAL mode
const db = new SqliteStore('./data/bot.db');
db.exec('CREATE TABLE IF NOT EXISTS claims (sig TEXT PRIMARY KEY)');
```

### `config/` — Environment Variables

```typescript
import { requireEnv, optionalEnv, parseIntEnv, parseListEnv } from '@pumpkit/core';

const token = requireEnv('BOT_TOKEN');          // throws if missing
const rpc = optionalEnv('RPC_URL', 'https://api.mainnet-beta.solana.com');
const port = parseIntEnv('PORT', 3000);
const chats = parseListEnv('CHAT_IDS', []);     // comma-separated → string[]
```

### `health/` — Health Check Server

```typescript
import { startHealthServer, stopHealthServer } from '@pumpkit/core';

startHealthServer({ startedAt: Date.now() });
```

### `logger/` — Leveled Logger

```typescript
import { log, setLogLevel } from '@pumpkit/core';

setLogLevel('debug');
log.info('Bot started');
log.debug('Processing event %s', signature);
```

## Configuration Schema

All PumpKit bots use environment variables. Common variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | — | Telegram Bot API token |
| `CHAT_IDS` | Yes | — | Comma-separated chat IDs |
| `RPC_URL` | No | mainnet-beta | Solana RPC endpoint |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |
| `PORT` | No | `3000` | Health check server port |

## Built With

- [grammy](https://grammy.dev/) — Telegram Bot framework
- [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/) — Solana RPC client
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — Synchronous SQLite
- [dotenv](https://github.com/motdotla/dotenv) — Environment variable loading

## Pre-Built Bots

- **@pumpkit/channel** — PumpFun activity monitor (launches, graduations, whale trades)
- **@pumpkit/claim** — Fee claim tracker bot
- **@pumpkit/web** — React dashboard UI

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT
