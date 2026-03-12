# Tutorial 22: Channel Bot — Telegram Broadcasting

> Deploy a read-only Telegram channel bot that broadcasts token launches, graduations, whale trades, and fee claims from the Solana blockchain.

## Prerequisites

- Node.js 18+
- A Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- A Telegram channel where the bot is an admin
- A Solana RPC endpoint

```bash
npm install @solana/web3.js node-telegram-bot-api dotenv
```

## What Does the Channel Bot Do?

Unlike the interactive Telegram bot (Tutorial 18), the channel bot is a **one-way broadcast feed**. It watches the Solana blockchain and posts formatted messages to your Telegram channel whenever it detects:

| Event | Description |
|-------|-------------|
| Token Launch | New token created on Pump |
| Graduation | Token migrated from bonding curve to PumpAMM |
| Whale Trade | Buy or sell above a SOL threshold |
| Fee Claim | Creator fee collection or cashback claim |
| Fee Distribution | Fee sharing payouts to shareholders |

## Architecture

```
┌──────────────────┐
│  Solana RPC      │
│  (WebSocket +    │
│   HTTP polling)  │
└────────┬─────────┘
         │ subscribe / poll
┌────────▼─────────┐
│  Event Decoder   │
│  (discriminators │
│   + log parsing) │
└────────┬─────────┘
         │ filtered events
┌────────▼─────────┐
│  Telegram API    │
│  (channel post)  │
└──────────────────┘
```

## Step 1: Configure Environment

```bash
# .env
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
TELEGRAM_CHANNEL_ID=-1001234567890
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_RPC_WS=wss://api.mainnet-beta.solana.com

# Toggle feeds (all enabled by default)
FEED_LAUNCHES=true
FEED_GRADUATIONS=true
FEED_WHALE_TRADES=true
FEED_FEE_CLAIMS=true
FEED_DISTRIBUTIONS=true

# Whale threshold in SOL
WHALE_THRESHOLD_SOL=10
```

## Step 2: Define Event Types

```typescript
interface TokenLaunchEvent {
  txSignature: string;
  slot: number;
  timestamp: number;
  mintAddress: string;
  creatorWallet: string;
  name: string;
  symbol: string;
  description: string;
  metadataUri: string;
  hasGithub: boolean;
  githubUrls: string[];
  mayhemMode: boolean;
  cashbackEnabled: boolean;
}

interface TradeAlertEvent {
  txSignature: string;
  timestamp: number;
  mintAddress: string;
  user: string;
  isBuy: boolean;
  solAmount: number;
  tokenAmount: number;
  fee: number;
  creatorFee: number;
  mayhemMode: boolean;
  marketCapSol: number;
  bondingCurveProgress: number;
}

interface GraduationEvent {
  txSignature: string;
  mintAddress: string;
  user: string;
  isMigration: boolean;
  solAmount?: number;
  poolAddress?: string;
}

interface FeeClaimEvent {
  txSignature: string;
  claimerWallet: string;
  tokenMint: string;
  amountLamports: number;
  claimType:
    | "collect_creator_fee"
    | "claim_cashback"
    | "distribute_creator_fees"
    | "collect_coin_creator_fee";
  isCashback: boolean;
  programId: string;
}
```

## Step 3: Decode On-Chain Events

The channel bot identifies transaction types using instruction discriminators:

```typescript
const DISCRIMINATORS = {
  // Pump Program
  collectCreatorFee: "1416567bc61cdb84",
  claimCashback: "253a237ebe35e4c5",
  distributeCreatorFees: "a572670079cef751",
  // PumpAMM Program
  collectCoinCreatorFee: "a039592ab58b2b42",
  transferCreatorFees: "8b348655e4e56cf1",
} as const;

function identifyTransaction(
  data: Buffer
): { type: string; discriminator: string } | null {
  const disc = data.subarray(0, 8).toString("hex");

  for (const [type, expected] of Object.entries(DISCRIMINATORS)) {
    if (disc === expected) {
      return { type, discriminator: disc };
    }
  }
  return null;
}
```

## Step 4: Format Telegram Messages

```typescript
function formatLaunchMessage(event: TokenLaunchEvent): string {
  const lines = [
    `🚀 <b>New Token Launch</b>`,
    ``,
    `<b>${event.symbol}</b> — ${event.name}`,
    `Mint: <code>${event.mintAddress}</code>`,
    `Creator: <code>${event.creatorWallet}</code>`,
  ];

  if (event.hasGithub) {
    lines.push(`🔧 GitHub: ${event.githubUrls[0]}`);
  }
  if (event.mayhemMode) {
    lines.push(`⚡ Mayhem Mode enabled`);
  }
  if (event.cashbackEnabled) {
    lines.push(`💰 Cashback enabled`);
  }

  lines.push(
    ``,
    `<a href="https://solscan.io/tx/${event.txSignature}">View on Solscan</a>`
  );

  return lines.join("\n");
}

function formatWhaleMessage(event: TradeAlertEvent): string {
  const emoji = event.isBuy ? "🐋 BUY" : "🔴 SELL";
  return [
    `${emoji} <b>Whale Alert</b>`,
    ``,
    `Token: <code>${event.mintAddress}</code>`,
    `Amount: <b>${event.solAmount.toFixed(2)} SOL</b>`,
    `Trader: <code>${event.user}</code>`,
    `Market Cap: ${event.marketCapSol.toFixed(2)} SOL`,
    `Progress: ${(event.bondingCurveProgress * 100).toFixed(1)}%`,
    ``,
    `<a href="https://solscan.io/tx/${event.txSignature}">View on Solscan</a>`,
  ].join("\n");
}

function formatGraduationMessage(event: GraduationEvent): string {
  return [
    `🎓 <b>Token Graduated!</b>`,
    ``,
    `Mint: <code>${event.mintAddress}</code>`,
    event.poolAddress
      ? `AMM Pool: <code>${event.poolAddress}</code>`
      : "",
    event.solAmount
      ? `Liquidity: ${event.solAmount.toFixed(2)} SOL`
      : "",
    ``,
    `<a href="https://solscan.io/tx/${event.txSignature}">View on Solscan</a>`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatFeeClaimMessage(event: FeeClaimEvent): string {
  const solAmount = event.amountLamports / 1e9;
  const typeLabel = event.isCashback ? "Cashback Claim" : "Creator Fee Collection";
  return [
    `💸 <b>${typeLabel}</b>`,
    ``,
    `Claimer: <code>${event.claimerWallet}</code>`,
    `Token: <code>${event.tokenMint}</code>`,
    `Amount: <b>${solAmount.toFixed(4)} SOL</b>`,
    `Type: ${event.claimType}`,
    ``,
    `<a href="https://solscan.io/tx/${event.txSignature}">View on Solscan</a>`,
  ].join("\n");
}
```

## Step 5: Wire It Together

```typescript
import TelegramBot from "node-telegram-bot-api";
import { Connection } from "@solana/web3.js";
import "dotenv/config";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
const channelId = process.env.TELEGRAM_CHANNEL_ID!;
const connection = new Connection(process.env.SOLANA_RPC_URL!, {
  wsEndpoint: process.env.SOLANA_RPC_WS,
  commitment: "confirmed",
});

const WHALE_THRESHOLD = parseFloat(process.env.WHALE_THRESHOLD_SOL || "10");

async function postToChannel(html: string) {
  await bot.sendMessage(channelId, html, { parse_mode: "HTML" });
}

// Event handler dispatcher
async function handleEvent(
  type: string,
  event: TokenLaunchEvent | TradeAlertEvent | GraduationEvent | FeeClaimEvent
) {
  switch (type) {
    case "launch":
      if (process.env.FEED_LAUNCHES !== "false") {
        await postToChannel(formatLaunchMessage(event as TokenLaunchEvent));
      }
      break;

    case "whale_trade":
      if (
        process.env.FEED_WHALE_TRADES !== "false" &&
        (event as TradeAlertEvent).solAmount >= WHALE_THRESHOLD
      ) {
        await postToChannel(formatWhaleMessage(event as TradeAlertEvent));
      }
      break;

    case "graduation":
      if (process.env.FEED_GRADUATIONS !== "false") {
        await postToChannel(formatGraduationMessage(event as GraduationEvent));
      }
      break;

    case "fee_claim":
      if (process.env.FEED_FEE_CLAIMS !== "false") {
        await postToChannel(formatFeeClaimMessage(event as FeeClaimEvent));
      }
      break;
  }
}

console.log("Channel bot started, broadcasting to", channelId);
```

## Step 6: Deploy

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
CMD ["node", "dist/index.js"]
```

```bash
docker build -t pump-channel-bot .
docker run --env-file .env pump-channel-bot
```

### Railway

The `channel-bot/` directory includes a `railway.json` for one-click deploy:

```bash
cd channel-bot
railway up
```

Set environment variables in the Railway dashboard.

## Customization Ideas

- **Add token images** — Fetch `imageUri` from metadata and attach to messages
- **Add reply buttons** — Link to PumpFun trading page for the token
- **Rate limiting** — Batch messages during high-volume periods
- **Multi-channel** — Route different event types to different channels
- **Webhook mode** — Combine with the WebSocket relay for lower latency

## Next Steps

- Use [Tutorial 18](./18-telegram-bot.md) for an interactive bot with commands
- Use [Tutorial 21](./21-websocket-realtime-feeds.md) for browser-based feeds
- Use [Tutorial 26](./26-live-dashboard-deployment.md) to deploy visual dashboards
