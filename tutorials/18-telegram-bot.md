# Tutorial 18: Telegram Bot for Pump Tokens

> Build a Telegram bot that monitors Pump tokens, sends price alerts, and lets users check bonding curve state from chat.

## What We're Building

A bot that supports:
- `/track <mint>` — Start tracking a token
- `/price <mint>` — Get current price and market cap
- `/claims <wallet>` — Check unclaimed incentives
- `/alert <mint> <price>` — Set a price alert
- Auto-alerts when tokens graduate or hit price targets

```
You: /price ABC123...
Bot: 📊 Token ABC123...
     Price: 0.00034 SOL
     Market Cap: 12.4 SOL
     Progress: 78.2% → graduation
     Status: ACTIVE
     Reserves: 8.2 / 85 SOL
```

---

## Step 1: Setup

### Create the Project

```bash
mkdir pump-telegram-bot && cd pump-telegram-bot
npm init -y
npm install telegraf @pump-fun/pump-sdk @solana/web3.js @coral-xyz/anchor bn.js dotenv
npm install -D typescript @types/node ts-node
npx tsc --init
```

### Get a Bot Token

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token

```bash
# .env
TELEGRAM_BOT_TOKEN=your_bot_token_here
SOLANA_RPC_URL=https://api.devnet.solana.com
```

---

## Step 2: SDK Service Layer

```typescript
// src/pump-service.ts
import { Connection, PublicKey } from "@solana/web3.js";
import {
  OnlinePumpSdk,
  PUMP_SDK,
  bondingCurveMarketCap,
  bondingCurvePda,
} from "@pump-fun/pump-sdk";
import BN from "bn.js";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  "confirmed"
);
const onlineSdk = new OnlinePumpSdk(connection);

export interface TokenInfo {
  mint: string;
  priceSol: number;
  marketCapSol: number;
  realSolReserves: number;
  progressPercent: number;
  complete: boolean;
  isMayhemMode: boolean;
  creator: string;
}

export async function getTokenInfo(mintAddress: string): Promise<TokenInfo | null> {
  try {
    const mint = new PublicKey(mintAddress);
    const bc = await onlineSdk.fetchBondingCurve(mint);

    const priceSol = bc.virtualTokenReserves.isZero()
      ? 0
      : bc.virtualSolReserves.toNumber() / bc.virtualTokenReserves.toNumber();

    let marketCapSol = 0;
    if (!bc.virtualTokenReserves.isZero()) {
      const mc = bondingCurveMarketCap({
        mintSupply: bc.tokenTotalSupply,
        virtualSolReserves: bc.virtualSolReserves,
        virtualTokenReserves: bc.virtualTokenReserves,
      });
      marketCapSol = mc.toNumber() / 1e9;
    }

    const realSol = bc.realSolReserves.toNumber() / 1e9;

    return {
      mint: mintAddress,
      priceSol,
      marketCapSol,
      realSolReserves: realSol,
      progressPercent: Math.min(100, (realSol / 85) * 100),
      complete: bc.complete,
      isMayhemMode: bc.isMayhemMode,
      creator: bc.creator.toBase58(),
    };
  } catch {
    return null;
  }
}

export interface ClaimInfo {
  unclaimedTokens: string;
  todayTokens: string;
  totalClaimed: string;
  volumeSol: number;
  creatorVaultSol: number;
}

export async function getClaimInfo(walletAddress: string): Promise<ClaimInfo> {
  const user = new PublicKey(walletAddress);

  const [unclaimed, today, stats, vault] = await Promise.all([
    onlineSdk.getTotalUnclaimedTokensBothPrograms(user),
    onlineSdk.getCurrentDayTokensBothPrograms(user),
    onlineSdk.fetchUserVolumeAccumulatorTotalStats(user),
    onlineSdk.getCreatorVaultBalanceBothPrograms(user),
  ]);

  return {
    unclaimedTokens: unclaimed.toString(),
    todayTokens: today.toString(),
    totalClaimed: stats.totalClaimedTokens.toString(),
    volumeSol: stats.currentSolVolume.toNumber() / 1e9,
    creatorVaultSol: vault.toNumber() / 1e9,
  };
}

export async function batchGetTokens(mints: string[]): Promise<Map<string, TokenInfo>> {
  const results = new Map<string, TokenInfo>();
  const pdas = mints.map((m) => bondingCurvePda(new PublicKey(m)));
  const accounts = await connection.getMultipleAccountsInfo(pdas);

  for (let i = 0; i < mints.length; i++) {
    const info = accounts[i];
    if (!info) continue;

    const bc = PUMP_SDK.decodeBondingCurveNullable(info);
    if (!bc) continue;

    const priceSol = bc.virtualTokenReserves.isZero()
      ? 0
      : bc.virtualSolReserves.toNumber() / bc.virtualTokenReserves.toNumber();

    let marketCapSol = 0;
    if (!bc.virtualTokenReserves.isZero()) {
      const mc = bondingCurveMarketCap({
        mintSupply: bc.tokenTotalSupply,
        virtualSolReserves: bc.virtualSolReserves,
        virtualTokenReserves: bc.virtualTokenReserves,
      });
      marketCapSol = mc.toNumber() / 1e9;
    }

    const realSol = bc.realSolReserves.toNumber() / 1e9;

    results.set(mints[i], {
      mint: mints[i],
      priceSol,
      marketCapSol,
      realSolReserves: realSol,
      progressPercent: Math.min(100, (realSol / 85) * 100),
      complete: bc.complete,
      isMayhemMode: bc.isMayhemMode,
      creator: bc.creator.toBase58(),
    });
  }

  return results;
}
```

---

## Step 3: Alert System

```typescript
// src/alerts.ts
export interface PriceAlert {
  chatId: number;
  mint: string;
  targetPrice: number;
  direction: "above" | "below";
  triggered: boolean;
}

export interface TrackedToken {
  chatId: number;
  mint: string;
  lastPrice: number;
  wasGraduated: boolean;
}

class AlertManager {
  private alerts: PriceAlert[] = [];
  private tracked: TrackedToken[] = [];

  addAlert(chatId: number, mint: string, targetPrice: number, direction: "above" | "below") {
    this.alerts.push({ chatId, mint, targetPrice, direction, triggered: false });
  }

  trackToken(chatId: number, mint: string) {
    if (!this.tracked.find((t) => t.chatId === chatId && t.mint === mint)) {
      this.tracked.push({ chatId, mint, lastPrice: 0, wasGraduated: false });
    }
  }

  untrackToken(chatId: number, mint: string) {
    this.tracked = this.tracked.filter((t) => !(t.chatId === chatId && t.mint === mint));
  }

  getTrackedMints(): string[] {
    return [...new Set(this.tracked.map((t) => t.mint))];
  }

  getTrackedForChat(chatId: number): TrackedToken[] {
    return this.tracked.filter((t) => t.chatId === chatId);
  }

  checkAlerts(mint: string, currentPrice: number): PriceAlert[] {
    const triggered: PriceAlert[] = [];

    for (const alert of this.alerts) {
      if (alert.mint !== mint || alert.triggered) continue;

      if (
        (alert.direction === "above" && currentPrice >= alert.targetPrice) ||
        (alert.direction === "below" && currentPrice <= alert.targetPrice)
      ) {
        alert.triggered = true;
        triggered.push(alert);
      }
    }

    return triggered;
  }

  checkGraduations(
    mint: string,
    complete: boolean,
  ): { chatId: number; mint: string }[] {
    const graduations: { chatId: number; mint: string }[] = [];

    for (const t of this.tracked) {
      if (t.mint !== mint) continue;
      if (complete && !t.wasGraduated) {
        t.wasGraduated = true;
        graduations.push({ chatId: t.chatId, mint });
      }
    }

    return graduations;
  }

  updatePrice(mint: string, price: number) {
    for (const t of this.tracked) {
      if (t.mint === mint) t.lastPrice = price;
    }
  }
}

export const alertManager = new AlertManager();
```

---

## Step 4: Bot Commands

```typescript
// src/bot.ts
import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { getTokenInfo, getClaimInfo, batchGetTokens } from "./pump-service";
import { alertManager } from "./alerts";

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

// /start
bot.start((ctx) => {
  ctx.reply(
    "🟢 *Pump Token Bot*\n\n" +
    "Commands:\n" +
    "`/price <mint>` — Token price & stats\n" +
    "`/track <mint>` — Track a token\n" +
    "`/untrack <mint>` — Stop tracking\n" +
    "`/list` — Your tracked tokens\n" +
    "`/claims <wallet>` — Check claimable rewards\n" +
    "`/alert <mint> above|below <price>` — Set price alert\n",
    { parse_mode: "Markdown" }
  );
});

// /price <mint>
bot.command("price", async (ctx) => {
  const mint = ctx.message.text.split(" ")[1];
  if (!mint) return ctx.reply("Usage: `/price <mint_address>`", { parse_mode: "Markdown" });

  const info = await getTokenInfo(mint);
  if (!info) return ctx.reply("❌ Token not found or invalid address");

  const statusEmoji = info.complete ? "🎓" : "📊";
  const status = info.complete ? "GRADUATED" : "ACTIVE";
  const progressBar = renderProgressBar(info.progressPercent);

  ctx.reply(
    `${statusEmoji} *Token* \`${info.mint.slice(0, 8)}...${info.mint.slice(-6)}\`\n\n` +
    `💰 Price: \`${info.priceSol.toFixed(10)} SOL\`\n` +
    `📈 Market Cap: \`${info.marketCapSol.toFixed(2)} SOL\`\n` +
    `🏦 Reserves: \`${info.realSolReserves.toFixed(4)} SOL\`\n` +
    `📊 Progress: ${progressBar} ${info.progressPercent.toFixed(1)}%\n` +
    `🔖 Status: *${status}*${info.isMayhemMode ? " 🔥 MAYHEM" : ""}\n` +
    `👤 Creator: \`${info.creator.slice(0, 8)}...\``,
    { parse_mode: "Markdown" }
  );
});

// /track <mint>
bot.command("track", async (ctx) => {
  const mint = ctx.message.text.split(" ")[1];
  if (!mint) return ctx.reply("Usage: `/track <mint_address>`", { parse_mode: "Markdown" });

  const info = await getTokenInfo(mint);
  if (!info) return ctx.reply("❌ Token not found");

  alertManager.trackToken(ctx.chat.id, mint);
  ctx.reply(
    `✅ Now tracking \`${mint.slice(0, 8)}...${mint.slice(-6)}\`\n` +
    `You'll be notified on graduation and price movements.`,
    { parse_mode: "Markdown" }
  );
});

// /untrack <mint>
bot.command("untrack", async (ctx) => {
  const mint = ctx.message.text.split(" ")[1];
  if (!mint) return ctx.reply("Usage: `/untrack <mint_address>`", { parse_mode: "Markdown" });

  alertManager.untrackToken(ctx.chat.id, mint);
  ctx.reply(`🛑 Stopped tracking \`${mint.slice(0, 8)}...\``, { parse_mode: "Markdown" });
});

// /list
bot.command("list", (ctx) => {
  const tracked = alertManager.getTrackedForChat(ctx.chat.id);
  if (tracked.length === 0) return ctx.reply("No tracked tokens. Use `/track <mint>` to start.", { parse_mode: "Markdown" });

  const lines = tracked.map(
    (t) => `• \`${t.mint.slice(0, 8)}...${t.mint.slice(-6)}\` — last: ${t.lastPrice.toFixed(10)} SOL`
  );
  ctx.reply(`📋 *Tracked Tokens*\n\n${lines.join("\n")}`, { parse_mode: "Markdown" });
});

// /claims <wallet>
bot.command("claims", async (ctx) => {
  const wallet = ctx.message.text.split(" ")[1];
  if (!wallet) return ctx.reply("Usage: `/claims <wallet_address>`", { parse_mode: "Markdown" });

  try {
    const info = await getClaimInfo(wallet);
    ctx.reply(
      `🎁 *Claimable Rewards*\n\n` +
      `🪙 Unclaimed Tokens: \`${info.unclaimedTokens}\`\n` +
      `📅 Today's Tokens: \`${info.todayTokens}\`\n` +
      `✅ Total Claimed: \`${info.totalClaimed}\`\n` +
      `📊 SOL Volume: \`${info.volumeSol.toFixed(4)} SOL\`\n` +
      `🏦 Creator Vault: \`${info.creatorVaultSol.toFixed(6)} SOL\``,
      { parse_mode: "Markdown" }
    );
  } catch {
    ctx.reply("❌ Could not fetch claim data. Check the wallet address.");
  }
});

// /alert <mint> above|below <price>
bot.command("alert", (ctx) => {
  const parts = ctx.message.text.split(" ");
  if (parts.length < 4) {
    return ctx.reply("Usage: `/alert <mint> above|below <price_in_sol>`", { parse_mode: "Markdown" });
  }

  const [, mint, direction, priceStr] = parts;
  if (direction !== "above" && direction !== "below") {
    return ctx.reply("Direction must be `above` or `below`", { parse_mode: "Markdown" });
  }

  const price = parseFloat(priceStr);
  if (isNaN(price) || price <= 0) {
    return ctx.reply("Price must be a positive number");
  }

  alertManager.addAlert(ctx.chat.id, mint, price, direction as "above" | "below");
  ctx.reply(
    `🔔 Alert set: notify when \`${mint.slice(0, 8)}...\` goes *${direction}* \`${price} SOL\``,
    { parse_mode: "Markdown" }
  );
});

function renderProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

export { bot };
```

---

## Step 5: Background Monitor Loop

```typescript
// src/monitor.ts
import { bot } from "./bot";
import { batchGetTokens } from "./pump-service";
import { alertManager } from "./alerts";

export function startMonitor(intervalMs = 30_000) {
  setInterval(async () => {
    const mints = alertManager.getTrackedMints();
    if (mints.length === 0) return;

    try {
      const tokenMap = await batchGetTokens(mints);

      for (const [mint, info] of tokenMap) {
        // Check price alerts
        const triggered = alertManager.checkAlerts(mint, info.priceSol);
        for (const alert of triggered) {
          bot.telegram.sendMessage(
            alert.chatId,
            `🔔 *Price Alert!*\n\n` +
            `Token \`${mint.slice(0, 8)}...\` is now *${alert.direction}* ${alert.targetPrice}\n` +
            `Current price: \`${info.priceSol.toFixed(10)} SOL\``,
            { parse_mode: "Markdown" }
          );
        }

        // Check graduations
        const grads = alertManager.checkGraduations(mint, info.complete);
        for (const g of grads) {
          bot.telegram.sendMessage(
            g.chatId,
            `🎓 *Token Graduated!*\n\n` +
            `\`${mint.slice(0, 8)}...\` has completed its bonding curve!\n` +
            `Final market cap: \`${info.marketCapSol.toFixed(2)} SOL\`\n` +
            `It's now trading on PumpAMM.`,
            { parse_mode: "Markdown" }
          );
        }

        // Update stored prices
        alertManager.updatePrice(mint, info.priceSol);
      }
    } catch (err) {
      console.error("Monitor error:", err);
    }
  }, intervalMs);
}
```

---

## Step 6: Entry Point

```typescript
// src/index.ts
import { bot } from "./bot";
import { startMonitor } from "./monitor";

async function main() {
  console.log("Starting Pump Telegram Bot...");

  // Start polling for alerts every 30s
  startMonitor(30_000);

  // Start bot
  await bot.launch();
  console.log("Bot is running!");

  // Graceful shutdown
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch(console.error);
```

---

## Step 7: Run

```bash
npx ts-node src/index.ts
```

Or add to `package.json`:

```json
{
  "scripts": {
    "start": "ts-node src/index.ts",
    "dev": "ts-node --watch src/index.ts"
  }
}
```

---

## Deployment

### Docker

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npx", "ts-node", "src/index.ts"]
```

### Environment

```bash
TELEGRAM_BOT_TOKEN=your_token
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

---

## What's Next?

- [Tutorial 19: CoinGecko Integration](./19-coingecko-integration.md) — enriche with market data
- [Tutorial 17: Build a Monitoring Website](./17-monitoring-website.md) — full web dashboard
