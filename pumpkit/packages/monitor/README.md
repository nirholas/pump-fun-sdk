# @pumpkit/monitor

Telegram bot + REST API that monitors **PumpFun** on Solana and sends real-time notifications when **Creator Fees**, **Cashback Rewards**, **Creator Takeovers (CTO)**, **Token Graduations**, **Whale Trades**, or **Fee Distributions** are detected. Also monitors new token launches with cashback coin detection.

Works in personal DMs, group chats, and as a standalone API.

## Features

- **Watch wallets** — Track any fee-recipient Solana wallet
- **Creator Fees + Cashback Coins** — Detects both claim types
- **CTO (Creator Takeover) alerts** — Detects creator fee redirection events
- **Token launch monitor** — Real-time detection of new PumpFun token mints
- **Graduation alerts** — Notifies when a token completes its bonding curve
- **Whale trade alerts** — Configurable SOL threshold for large buy/sell notifications
- **Fee distribution alerts** — Tracks creator fee distributions to shareholders
- **REST API** — HTTP API with auth, rate limiting, SSE streaming, and webhooks
- **Real-time** — WebSocket mode for instant alerts (or HTTP polling fallback)
- **Group-ready** — Add to Telegram groups so your whole team gets notified
- **Persistent watches** — Saved to disk, survives restarts

## Quick Start

### 1. Create a Telegram bot

1. Open [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token

### 2. Configure

```bash
cp .env.example .env
```

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Optional: restrict to specific Telegram user IDs (comma-separated)
ALLOWED_USER_IDS=123456789
```

> **Recommended:** Use a paid RPC provider (Helius, QuickNode, Triton) for reliable WebSocket connections.

### 3. Run

```bash
npm install
npm run dev        # Development (hot reload)
```

Production:

```bash
npm run build
npm start
```

### 4. API Only Mode

```bash
ENABLE_API=true API_ONLY=true npm run dev
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/watch <wallet>` | Watch a Solana wallet for fee claims |
| `/unwatch <wallet>` | Stop watching a wallet |
| `/list` | Show watched wallets |
| `/status` | Monitor status and stats |
| `/cto` | Check for Creator Takeover events |
| `/monitor` | Start/stop monitoring |
| `/price <mint>` | Get token price info |
| `/fees <mint>` | Get fee tier for a token |
| `/quote <mint> <sol>` | Get a buy/sell quote |
| `/alerts` | Configure alert preferences |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | Health check |
| `/api/v1/watches` | GET/POST/DELETE | Manage watches |
| `/api/v1/claims` | GET | Recent claim events |
| `/api/v1/claims/stream` | GET | SSE claim stream |
| `/api/v1/webhooks` | POST/DELETE | Manage webhook subscriptions |

## Docker

```bash
docker build -t pumpkit-monitor .
docker run -d --env-file .env -p 3000:3000 pumpkit-monitor
```

## License

MIT
