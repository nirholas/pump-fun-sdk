# Build Your First PumpFun Bot (10 Minutes)

> Create a minimal fee claim alert bot with @pumpkit/core in under 40 lines of code.

## What You'll Build

A Telegram bot that monitors the Pump protocol for fee claims and posts formatted alerts. When someone claims creator fees, social fees, or cashback on-chain, your bot sends a notification in real time.

```
Solana RPC (WebSocket)
    │
    ▼
ClaimMonitor — watches PumpFees program
    │
    ▼
Your callback — formats + sends to Telegram
```

## Prerequisites

- Node.js 20+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A Solana RPC URL (free tier: [Helius](https://helius.dev) or [QuickNode](https://quicknode.com))

## Step 1: Create Your Project

```bash
mkdir my-pump-bot && cd my-pump-bot
npm init -y
npm install @pumpkit/core grammy @solana/web3.js dotenv
npm install -D typescript tsx @types/node
npx tsc --init --target ES2020 --module nodenext --moduleResolution nodenext --outDir dist --strict
```

## Step 2: Set Up Environment Variables

Create a `.env` file:

```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key
```

> **Get your bot token**: Message [@BotFather](https://t.me/BotFather) on Telegram, send `/newbot`, and follow the prompts. Copy the token it gives you.

## Step 3: Write the Bot

Create `src/index.ts`:

```typescript
import "dotenv/config";
import {
  createBot,
  ClaimMonitor,
  formatClaim,
  createRpcConnection,
  requireEnv,
  installShutdownHandlers,
  startHealthServer,
} from "@pumpkit/core";

// ── Config ───────────────────────────────────────────────
const token = requireEnv("TELEGRAM_BOT_TOKEN");
const rpcUrl = requireEnv("SOLANA_RPC_URL");

// ── Solana connection ────────────────────────────────────
const connection = createRpcConnection(rpcUrl);

// ── Telegram bot ─────────────────────────────────────────
const bot = createBot({ token });

// Register /start command
bot.command("start", (ctx) =>
  ctx.reply("👋 I'm monitoring PumpFun fee claims. You'll see them here!")
);

// Register /watch command — users send a wallet address
const watchedWallets = new Set<string>();

bot.command("watch", (ctx) => {
  const wallet = ctx.match?.trim();
  if (!wallet || wallet.length < 32) {
    return ctx.reply("Usage: /watch <wallet_address>");
  }
  watchedWallets.add(wallet);
  return ctx.reply(`✅ Watching ${wallet.slice(0, 8)}…`);
});

// ── Claim monitor ────────────────────────────────────────
const monitor = new ClaimMonitor({
  connection,
  onClaim: async (event) => {
    // Format the claim into a readable Telegram message
    const message = formatClaim(event);

    // Send to all active chats (simplified: send to bot owner)
    // In production, use a store to track subscriber chat IDs
    console.log(`[CLAIM] ${event.type} — ${event.amount} SOL`);
  },
});

// ── Launch ───────────────────────────────────────────────
async function main(): Promise<void> {
  monitor.start();
  bot.start();
  startHealthServer();
  installShutdownHandlers();
  console.log("🚀 Bot is running! Send /start to your bot on Telegram.");
}

main().catch(console.error);
```

## Step 4: Run the Bot

```bash
npx tsx src/index.ts
```

Expected output:

```
[INFO] ClaimMonitor: Starting...
[INFO] ClaimMonitor: WebSocket subscription active
[INFO] Health server listening on :3000
🚀 Bot is running! Send /start to your bot on Telegram.
```

## Step 5: Test It

1. Open Telegram and find your bot by its username
2. Send `/start` — you should see the welcome message
3. Send `/watch 5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1` (any Solana wallet)
4. Wait for a fee claim to happen on-chain — the monitor logs it to your console

## Step 6: Send Alerts to a Chat

To actually send messages to Telegram when claims happen, update `onClaim`:

```typescript
// Track which chats are subscribed
const subscribedChats = new Set<number>();

bot.command("start", (ctx) => {
  subscribedChats.add(ctx.chat.id);
  return ctx.reply("👋 I'm monitoring PumpFun fee claims. You'll see them here!");
});

const monitor = new ClaimMonitor({
  connection,
  onClaim: async (event) => {
    const message = formatClaim(event);
    for (const chatId of subscribedChats) {
      await bot.api.sendMessage(chatId, message, { parse_mode: "HTML" });
    }
  },
});
```

## How It Works

1. **`createBot()`** scaffolds a [Grammy](https://grammy.dev) Telegram bot with error handling and graceful shutdown
2. **`ClaimMonitor`** subscribes to the PumpFees program via WebSocket (`connection.onLogs`) and decodes claim events
3. **`formatClaim()`** turns raw event data into a human-readable HTML card with links to Solscan and PumpFun
4. **`installShutdownHandlers()`** ensures clean exit on SIGINT/SIGTERM — closes WebSocket, stops the bot, and drains pending messages

### Monitor Lifecycle

```
monitor.start()
    │
    ├── Subscribes to PumpFees program logs via WebSocket
    ├── Falls back to HTTP polling if WebSocket fails
    ├── Deduplicates events by transaction signature
    │
    ▼
onClaim(event) fires for each new claim
    │
    ▼
monitor.stop()  ← called automatically on shutdown
```

## Common Issues

| Issue | Fix |
|-------|-----|
| `WebSocket failed, falling back to polling` | Your RPC doesn't support WebSocket. Add `SOLANA_WS_URL` or use an RPC that supports `wss://` |
| Bot doesn't respond | Check `TELEGRAM_BOT_TOKEN` is correct. Delete the bot and recreate with BotFather if needed |
| No claims showing up | Claims can be infrequent. Wait a few minutes — the monitor is working if you see the startup logs |
| `ECONNREFUSED` | Check `SOLANA_RPC_URL` is reachable. Try `curl $SOLANA_RPC_URL` to verify |

## Next Steps

- [02 — Channel Broadcast](02-channel-broadcast.md): Set up a read-only channel feed
- [03 — Custom Monitors](03-custom-monitors.md): Build your own event monitors
- [05 — Deploy to Railway](05-deploy-railway.md): Ship to production in 5 minutes
