# Getting Started with PumpKit

> Build your own PumpFun Telegram bot in minutes.

## Prerequisites

- Node.js 20+
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))
- A Solana RPC URL (free tier: [Helius](https://helius.dev), [QuickNode](https://quicknode.com), or public `https://api.mainnet-beta.solana.com`)

## Option 1: Run a Pre-Built Bot

### Monitor Bot (fee claims, launches, whales, graduations)

```bash
git clone https://github.com/pumpkit/pumpkit.git
cd pumpkit
npm install

# Configure
cp packages/monitor/.env.example packages/monitor/.env
```

Edit `packages/monitor/.env`:

```bash
TELEGRAM_BOT_TOKEN=your-bot-token-here
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key
```

Run:

```bash
npm run dev --workspace=@pumpkit/monitor
```

Your bot is now live! Send `/start` to it on Telegram.

### Tracker Bot (group call tracking, leaderboards)

```bash
cp packages/tracker/.env.example packages/tracker/.env
```

Edit `packages/tracker/.env`:

```bash
TELEGRAM_BOT_TOKEN=your-other-bot-token
```

Run:

```bash
npm run dev --workspace=@pumpkit/tracker
```

Add the bot to a Telegram group. Members can paste token CAs to start tracking calls.

---

## Option 2: Build a Custom Bot

### 1. Create a new project

```bash
mkdir my-pump-bot
cd my-pump-bot
npm init -y
npm install @pumpkit/core grammy dotenv
npm install -D typescript @types/node tsx
```

### 2. Create `.env`

```bash
TELEGRAM_BOT_TOKEN=your-bot-token
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### 3. Write your bot

Create `src/index.ts`:

```typescript
import 'dotenv/config';
import { createBot, ClaimMonitor, formatClaim, log } from '@pumpkit/core';

// 1. Create the bot
const bot = createBot({
  token: process.env.TELEGRAM_BOT_TOKEN!,
  commands: {
    start: (ctx) => ctx.reply(
      '👋 Welcome! I monitor PumpFun fee claims.\n' +
      'Send /watch <wallet> to track a wallet.'
    ),
    help: (ctx) => ctx.reply(
      '/watch <wallet> — Track fee claims\n' +
      '/unwatch <wallet> — Stop tracking\n' +
      '/list — Show watched wallets'
    ),
  },
});

// 2. Set up the monitor
const monitor = new ClaimMonitor({
  rpcUrl: process.env.SOLANA_RPC_URL!,
  onClaim: async (event) => {
    const message = formatClaim(event);
    // Send to all watchers of this wallet
    for (const chatId of getWatchers(event.wallet)) {
      await bot.api.sendMessage(chatId, message, { parse_mode: 'HTML' });
    }
  },
});

// 3. Simple in-memory watch list (use FileStore for persistence)
const watchers = new Map<string, Set<number>>();

function getWatchers(wallet: string): number[] {
  return [...(watchers.get(wallet) || [])];
}

bot.command('watch', (ctx) => {
  const wallet = ctx.match?.trim();
  if (!wallet) return ctx.reply('Usage: /watch <wallet_address>');

  if (!watchers.has(wallet)) watchers.set(wallet, new Set());
  watchers.get(wallet)!.add(ctx.chat.id);
  ctx.reply(`✅ Watching ${wallet} for fee claims.`);
});

bot.command('unwatch', (ctx) => {
  const wallet = ctx.match?.trim();
  if (!wallet) return ctx.reply('Usage: /unwatch <wallet_address>');

  watchers.get(wallet)?.delete(ctx.chat.id);
  ctx.reply(`🚫 Stopped watching ${wallet}.`);
});

bot.command('list', (ctx) => {
  const watching = [...watchers.entries()]
    .filter(([, ids]) => ids.has(ctx.chat.id))
    .map(([w]) => `• <code>${w}</code>`);
  ctx.reply(watching.length ? watching.join('\n') : 'No wallets being watched.', { parse_mode: 'HTML' });
});

// 4. Launch
monitor.start();
bot.launch();
log.info('Bot running!');

// 5. Graceful shutdown
const shutdown = () => { monitor.stop(); bot.stop(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

### 4. Run it

```bash
npx tsx src/index.ts
```

### 5. Iterate

Add more monitors:

```typescript
import { LaunchMonitor, WhaleMonitor, formatLaunch, formatWhaleTrade } from '@pumpkit/core';

const launchMonitor = new LaunchMonitor({
  rpcUrl: process.env.SOLANA_RPC_URL!,
  onLaunch: async (event) => {
    await bot.api.sendMessage(CHANNEL_ID, formatLaunch(event), { parse_mode: 'HTML' });
  },
});

const whaleMonitor = new WhaleMonitor({
  rpcUrl: process.env.SOLANA_RPC_URL!,
  thresholdSol: 50,
  onWhaleTrade: async (event) => {
    await bot.api.sendMessage(CHANNEL_ID, formatWhaleTrade(event), { parse_mode: 'HTML' });
  },
});
```

Add persistence:

```typescript
import { FileStore } from '@pumpkit/core';

interface Watch { wallet: string; chatId: number; }
const store = new FileStore<Watch[]>({ path: 'data/watches.json', defaultValue: [] });

// Load saved watches on startup
for (const { wallet, chatId } of store.read()) {
  if (!watchers.has(wallet)) watchers.set(wallet, new Set());
  watchers.get(wallet)!.add(chatId);
}
```

Add a health check:

```typescript
import { createHealthServer } from '@pumpkit/core';

createHealthServer({
  port: 3000,
  getStats: () => ({
    watchers: watchers.size,
    monitoring: monitor.status(),
  }),
});
```

---

## Deployment

### Docker

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc

FROM node:20-alpine
RUN addgroup -S bot && adduser -S bot -G bot
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
USER bot
HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
```

### Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

Set environment variables in the Railway dashboard.

---

## Examples

See the [examples/](../examples/) directory for more starter templates:

- **claim-alert/** — Minimal claim notification bot
- **whale-watcher/** — Whale trade channel feed
- **launch-sniper/** — New token launch alert
- **channel-feed/** — Read-only broadcast channel

## Next Steps

- [Architecture](architecture.md) — Understand the system design
- [Core API](core-api.md) — Full `@pumpkit/core` reference
- [Monitor Bot](monitor-bot.md) — Pre-built monitor features
- [Tracker Bot](tracker-bot.md) — Pre-built tracker features
- [Deployment](deployment.md) — Production deployment guide
