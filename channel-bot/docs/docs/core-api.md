# @pumpkit/core — API Reference

> Shared framework modules for building PumpFun Telegram bots.

## Installation

```bash
npm install @pumpkit/core
```

## Modules

---

## `bot/` — Telegram Bot Scaffolding

### `createBot(options): Bot`

Factory function that creates a configured grammy Bot instance with error handling, graceful shutdown, and standard middleware.

```typescript
import { createBot } from '@pumpkit/core';

const bot = createBot({
  token: process.env.TELEGRAM_BOT_TOKEN!,
  commands: {
    start: (ctx) => ctx.reply('Welcome!'),
    help: (ctx) => ctx.reply('Available commands: /start, /help'),
  },
  // Optional
  onError: (err) => console.error('Bot error:', err),
  parseMode: 'HTML',                // Default: 'HTML'
  adminChatIds: [123456789],        // Chat IDs for admin notifications
});

await bot.launch();
```

**Options:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `token` | `string` | ✅ | — | Telegram bot token from BotFather |
| `commands` | `Record<string, CommandHandler>` | ❌ | `{}` | Command handlers |
| `onError` | `(err: Error) => void` | ❌ | `console.error` | Global error handler |
| `parseMode` | `'HTML' \| 'MarkdownV2'` | ❌ | `'HTML'` | Default parse mode |
| `adminChatIds` | `number[]` | ❌ | `[]` | Chat IDs for error notifications |

### `bot.broadcast(chatIds, message, options?)`

Send a message to multiple chat IDs with automatic rate limiting (30 msg/sec Telegram limit).

```typescript
await bot.broadcast([chatId1, chatId2], formatClaim(event));
```

### `bot.notifyAdmins(message)`

Send a message to all admin chat IDs.

---

## `monitor/` — Event Monitors

All monitors extend `BaseMonitor` and share the same lifecycle:

```typescript
const monitor = new ClaimMonitor({ rpcUrl, onEvent });
monitor.start();   // Begin monitoring
monitor.stop();    // Graceful stop
monitor.status();  // { running, lastEvent, eventsProcessed }
```

### `ClaimMonitor`

Detects fee claim events on the PumpFees program.

```typescript
import { ClaimMonitor } from '@pumpkit/core';

const monitor = new ClaimMonitor({
  rpcUrl: process.env.SOLANA_RPC_URL!,
  rpcFallbackUrls: ['https://backup-rpc.example.com'],
  pollIntervalMs: 5000,              // Default: 5000
  onClaim: async (event) => {
    console.log(`${event.wallet} claimed ${event.amount} SOL from ${event.mint}`);
  },
});
```

**ClaimEvent:**

```typescript
interface ClaimEvent {
  signature: string;
  wallet: PublicKey;
  mint: PublicKey;
  amount: BN;           // lamports
  tokenName?: string;
  tokenSymbol?: string;
  timestamp: number;
}
```

### `LaunchMonitor`

Detects new token creations on the Pump program.

```typescript
import { LaunchMonitor } from '@pumpkit/core';

const monitor = new LaunchMonitor({
  rpcUrl: process.env.SOLANA_RPC_URL!,
  onLaunch: async (event) => {
    console.log(`New token: ${event.name} (${event.symbol}) — ${event.mint}`);
  },
});
```

**LaunchEvent:**

```typescript
interface LaunchEvent {
  signature: string;
  mint: PublicKey;
  creator: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  isMayhemMode: boolean;
  hasCashback: boolean;
  timestamp: number;
}
```

### `GraduationMonitor`

Detects bonding curve completions (token graduates to AMM).

```typescript
import { GraduationMonitor } from '@pumpkit/core';

const monitor = new GraduationMonitor({
  rpcUrl: process.env.SOLANA_RPC_URL!,
  onGraduation: async (event) => {
    console.log(`${event.tokenName} graduated! Pool: ${event.poolAddress}`);
  },
});
```

### `WhaleMonitor`

Detects large trades above a configurable SOL threshold.

```typescript
import { WhaleMonitor } from '@pumpkit/core';

const monitor = new WhaleMonitor({
  rpcUrl: process.env.SOLANA_RPC_URL!,
  thresholdSol: 100,    // Minimum SOL value for alert
  onWhaleTrade: async (event) => {
    console.log(`🐋 ${event.side} ${event.solAmount} SOL of ${event.tokenSymbol}`);
  },
});
```

### `CTOMonitor`

Detects Creator Takeover events (fee redirection).

### `FeeDistMonitor`

Detects fee distribution events to shareholders.

---

## `solana/` — Solana Utilities

### `createRpcConnection(options): Connection`

Creates a Solana Connection with fallback URL rotation.

```typescript
import { createRpcConnection } from '@pumpkit/core';

const connection = createRpcConnection({
  url: process.env.SOLANA_RPC_URL!,
  fallbackUrls: ['https://backup1.example.com', 'https://backup2.example.com'],
  commitment: 'confirmed',
});
```

### Program Constants

```typescript
import { PUMP_PROGRAM_ID, PUMP_AMM_PROGRAM_ID, PUMP_FEE_PROGRAM_ID } from '@pumpkit/core';

// PUMP_PROGRAM_ID     = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'
// PUMP_AMM_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'
// PUMP_FEE_PROGRAM_ID = 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ'
```

### `decodePumpLogs(logs): PumpEvent[]`

Decodes Pump program log messages into typed events.

```typescript
import { decodePumpLogs } from '@pumpkit/core';

connection.onLogs(PUMP_PROGRAM_ID, (logInfo) => {
  const events = decodePumpLogs(logInfo.logs);
  for (const event of events) {
    switch (event.type) {
      case 'create': // ...
      case 'buy': // ...
      case 'sell': // ...
      case 'complete': // graduation
    }
  }
});
```

---

## `formatter/` — Telegram Message Formatting

### `formatClaim(event): string`

```typescript
import { formatClaim } from '@pumpkit/core';

const html = formatClaim({
  wallet: new PublicKey('...'),
  mint: new PublicKey('...'),
  amount: new BN(2_500_000_000), // 2.5 SOL
  tokenName: 'PumpCoin',
  tokenSymbol: 'PUMP',
});
// Returns HTML string with bold title, amount, links
```

### `formatLaunch(event): string`
### `formatGraduation(event): string`
### `formatWhaleTrade(event): string`
### `formatCTO(event): string`
### `formatFeeDistribution(event): string`

All formatters return HTML strings compatible with Telegram's `parse_mode: 'HTML'`.

### `link(label, url): string`

```typescript
import { link, solscanTx, solscanAccount, pumpFunToken } from '@pumpkit/core';

link('View TX', 'https://...');              // <a href="...">View TX</a>
solscanTx(signature);                        // Solscan transaction link
solscanAccount(address);                     // Solscan account link
pumpFunToken(mint);                          // pump.fun token page link
```

---

## `storage/` — Persistence

### `FileStore`

JSON file persistence. Atomic writes. Survives restarts.

```typescript
import { FileStore } from '@pumpkit/core';

interface Watch { wallet: string; chatId: number; addedAt: number; }

const store = new FileStore<Watch[]>({
  path: 'data/watches.json',
  defaultValue: [],
});

const watches = store.read();
store.write([...watches, { wallet: '...', chatId: 123, addedAt: Date.now() }]);
```

### `SqliteStore`

SQLite adapter using better-sqlite3.

```typescript
import { SqliteStore } from '@pumpkit/core';

const db = new SqliteStore('data/bot.sqlite');
db.exec(`CREATE TABLE IF NOT EXISTS calls (...)`);
const calls = db.query('SELECT * FROM calls WHERE group_id = ?', [groupId]);
db.close();
```

---

## `config/` — Configuration

### `loadConfig(schema): Config`

Loads environment variables with type coercion, defaults, and validation.

```typescript
import { loadConfig, configSchema } from '@pumpkit/core';

const config = loadConfig({
  TELEGRAM_BOT_TOKEN: { type: 'string', required: true },
  SOLANA_RPC_URL: { type: 'string', required: true },
  FEED_CLAIMS: { type: 'boolean', default: true },
  WHALE_THRESHOLD_SOL: { type: 'number', default: 100 },
  API_PORT: { type: 'number', default: 3000 },
  ADMIN_CHAT_IDS: { type: 'string[]', default: [], separator: ',' },
});
```

---

## `health/` — Health Checks

### `createHealthServer(options): http.Server`

```typescript
import { createHealthServer } from '@pumpkit/core';

createHealthServer({
  port: 3000,
  getStats: () => ({
    monitors: monitor.status(),
    watches: store.read().length,
  }),
});

// GET /health → { status: 'ok', uptime: '3600s', monitors: {...} }
```

---

## `logger/` — Logging

### `log`

```typescript
import { log } from '@pumpkit/core';

log.debug('Verbose info');
log.info('Normal operation');
log.warn('Something unusual');
log.error('Something broke', error);
```

Set log level via `LOG_LEVEL` env var: `debug`, `info`, `warn`, `error`.

---

## `api/` — REST API Layer

### `createApiServer(options): Express`

Optional REST API with SSE streaming and webhooks.

```typescript
import { createApiServer } from '@pumpkit/core';

const api = createApiServer({
  port: 3000,
  authToken: process.env.API_AUTH_TOKEN,
  routes: (app) => {
    app.get('/claims', (req, res) => res.json(recentClaims));
    app.get('/status', (req, res) => res.json(monitor.status()));
  },
  sse: {
    path: '/stream',
    events: eventBus,   // Subscribe to monitor events
  },
  webhooks: {
    path: '/webhooks',
    store: webhookStore,
  },
});
```

---

## `social/` — Social Integrations

### `TwitterClient`

```typescript
import { TwitterClient } from '@pumpkit/core';

const twitter = new TwitterClient({ bearerToken: process.env.TWITTER_BEARER_TOKEN! });
const { followers, followsInfluencers } = await twitter.getUserInfo('@handle');
```

### `GitHubClient`

```typescript
import { GitHubClient } from '@pumpkit/core';

const github = new GitHubClient({ token: process.env.GITHUB_TOKEN });
const socialFeePda = await github.lookupSocialFee(mint);
```

---

## Types

### Core Event Types

```typescript
import type {
  ClaimEvent,
  LaunchEvent,
  GraduationEvent,
  WhaleTradeEvent,
  CTOEvent,
  FeeDistEvent,
  PumpEvent,
} from '@pumpkit/core';
```

### Monitor Types

```typescript
import type {
  MonitorOptions,
  MonitorStatus,
  BaseMonitorConfig,
} from '@pumpkit/core';
```

### Config Types

```typescript
import type {
  BotConfig,
  MonitorConfig,
  TrackerConfig,
  ConfigSchema,
} from '@pumpkit/core';
```
