# PumpFun Channel Bot

Read-only Telegram channel feed that broadcasts PumpFun on-chain activity — token launches, graduations, whale trades, fee claims, and fee distributions.

## Features

| Feed | Description | Toggle |
|------|-------------|--------|
| **Fee Claims** | Creator fee claim events | `FEED_CLAIMS` |
| **Token Launches** | New token creations on Pump | `FEED_LAUNCHES` |
| **Graduations** | Tokens graduating to PumpAMM | `FEED_GRADUATIONS` |
| **Whale Trades** | Large trades above threshold | `FEED_WHALES` |
| **Fee Distributions** | Fee sharing distribution events | `FEED_FEE_DISTRIBUTIONS` |

All feeds are enabled by default. Disable individual feeds via environment variables.

## Architecture

```
Solana RPC (WebSocket + HTTP polling)
        │
        ▼
  ┌─────────────┐
  │ EventMonitor │──▶ Decodes on-chain program logs
  │ ClaimMonitor │──▶ Tracks fee claim events
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  Formatters  │──▶ HTML-formatted Telegram messages
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ Grammy Bot   │──▶ Posts to Telegram channel
  └─────────────┘
```

Monitors both Pump (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`) and PumpAMM (`pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`) programs.

## Quick Start

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Run `/newbot` and follow the prompts
3. Copy the bot token
4. Add the bot as an admin to your channel

### 2. Configure Environment

```bash
cp .env.example .env   # or create manually
```

```env
# Required
TELEGRAM_BOT_TOKEN=your-bot-token
CHANNEL_ID=@your_channel_name   # or numeric chat ID like -100xxx

# Optional
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WS_URL=wss://api.mainnet-beta.solana.com
POLL_INTERVAL_SECONDS=30
LOG_LEVEL=info                  # debug | info | warn | error
WHALE_THRESHOLD_SOL=10          # Minimum SOL for whale alerts

# Feed toggles (all default to true)
FEED_CLAIMS=true
FEED_LAUNCHES=true
FEED_GRADUATIONS=true
FEED_WHALES=true
FEED_FEE_DISTRIBUTIONS=true
```

### 3. Run

```bash
# Development (hot reload)
npm install
npm run dev

# Production
npm run build
npm start
```

### 4. Deploy with Docker

```bash
docker build -t pumpfun-channel-bot .
docker run -d --env-file .env pumpfun-channel-bot
```

Railway deployment is also supported — see [railway.json](railway.json).

## Project Structure

```
channel-bot/
├── src/
│   ├── index.ts           # Entry point — wires monitors to Telegram
│   ├── config.ts          # Environment variable loading & validation
│   ├── event-monitor.ts   # Decodes on-chain program logs (WebSocket + HTTP)
│   ├── claim-monitor.ts   # Fee claim event tracking
│   ├── claim-tracker.ts   # Persistence for claim records
│   ├── pump-client.ts     # PumpFun HTTP API client (token info, creator profiles)
│   ├── formatters.ts      # HTML message formatting for Telegram
│   ├── types.ts           # Program IDs, discriminators, event types
│   └── logger.ts          # Logging utility
├── Dockerfile             # Multi-stage Docker build
├── railway.json           # Railway deployment config
├── package.json
└── tsconfig.json
```

## Requirements

- Node.js >= 20.0.0
- A Telegram bot token (via [@BotFather](https://t.me/BotFather))
- A Telegram channel with the bot added as admin
- Solana RPC endpoint (public mainnet works, dedicated RPC recommended for production)
