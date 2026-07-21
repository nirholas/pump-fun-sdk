# Deployment & Operations Guide

Production deployment guide for every component in the Pump SDK ecosystem.

> **Prerequisites:** Familiarity with Docker, environment variables, and your hosting provider (Railway, Vercel, Fly.io, or bare VPS).

---

## Core SDK

The SDK itself is a library — there's nothing to deploy. Install it in your project:

```bash
npm install @nirholas/pump-sdk @solana/web3.js @coral-xyz/anchor bn.js
```

---

## Telegram Bot

**Platform:** Railway (recommended), Docker, or any Node.js host

### Railway Deployment

```bash
cd telegram-bot

# 1. Set up environment
cp .env.example .env
# Edit .env with your values

# 2. Deploy to Railway
railway login
railway init
railway up
```

### Docker Deployment

```bash
cd telegram-bot
docker build -t pump-telegram-bot .
docker run -d \
  --name pump-telegram-bot \
  --restart unless-stopped \
  --env-file .env \
  pump-telegram-bot
```

### Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | Token from [@BotFather](https://t.me/BotFather) |
| `SOLANA_RPC_URL` | ✅ | Helius, Alchemy, or QuickNode RPC endpoint |
| `SOLANA_WS_URL` | ⬜ | WebSocket URL (defaults to RPC URL with `wss://`) |
| `ADMIN_CHAT_IDS` | ⬜ | Comma-separated Telegram user IDs for admin commands |
| `PORT` | ⬜ | REST API port (default: 3000) |
| `WEBHOOK_SECRET` | ⬜ | HMAC secret for webhook signatures |
| `WHALE_THRESHOLD_SOL` | ⬜ | Minimum SOL for whale alerts (default: 10) |

### Health Monitoring

```bash
# REST API health check
curl http://localhost:3000/api/v1/health

# Check bot is responding
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
```

---

## Channel Bot

**Platform:** Railway (recommended), Docker

### Railway Deployment

```bash
cd channel-bot
railway login
railway init
railway up
```

The `railway.json` in the directory configures the build automatically.

### Docker Deployment

```bash
cd channel-bot
docker build -t pump-channel-bot .
docker run -d \
  --name pump-channel-bot \
  --restart unless-stopped \
  --env-file .env \
  pump-channel-bot
```

### Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | Bot token with permission to post in channel |
| `TELEGRAM_CHANNEL_ID` | ✅ | Channel ID (e.g., `@pumpfunclaims` or `-1001234567890`) |
| `SOLANA_RPC_URL` | ✅ | RPC endpoint |
| `SOLANA_WS_URL` | ⬜ | WebSocket URL |
| `FEED_CLAIMS` | ⬜ | Enable fee claim feed (default: `true`) |
| `FEED_LAUNCHES` | ⬜ | Enable token launch feed (default: `true`) |
| `FEED_GRADUATIONS` | ⬜ | Enable graduation feed (default: `true`) |
| `FEED_WHALES` | ⬜ | Enable whale trade feed (default: `true`) |
| `FEED_FEE_DISTRIBUTIONS` | ⬜ | Enable fee distribution feed (default: `true`) |

### Channel Setup

1. Create a Telegram channel
2. Create a bot via [@BotFather](https://t.me/BotFather)
3. Add the bot as an **administrator** of the channel (needs "Post Messages" permission)
4. Set `TELEGRAM_CHANNEL_ID` to the channel's username or numeric ID

---

## WebSocket Relay Server

**Platform:** Railway, Fly.io, Render, or any host with WebSocket support

### Railway Deployment

```bash
cd websocket-server
railway login
railway init
railway up
```

### Docker Deployment

```bash
cd websocket-server
docker build -t pump-ws-relay .
docker run -d \
  --name pump-ws-relay \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file .env \
  pump-ws-relay
```

### Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | ⬜ | Server port (default: 8080) |
| `SOLANA_RPC_URL` | ⬜ | RPC endpoint (has default) |
| `PUMP_API_URL` | ⬜ | PumpFun API base URL |
| `POLL_INTERVAL_MS` | ⬜ | API polling interval (default: 5000) |

### Verify

```bash
# Health check
curl http://localhost:8080/health

# WebSocket test
wscat -c ws://localhost:8080
```

---

## Live Dashboards

**Platform:** Cloudflare Workers (production), or any static host

### Production

The dashboards ship inside the docs site at [sdk.pumpk.it/live](https://sdk.pumpk.it/live/); `scripts/build-site.mjs` copies `live/*.html` into the deployed bundle:

```bash
node scripts/build-site.mjs
npx wrangler deploy
```

### Manual

No build step required — these are plain HTML files:

```bash
cd live
npx serve .
```

---

## x402 Payment Server

**Platform:** Any Node.js host with HTTPS

```bash
cd x402
npm install
npm start
```

### Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SOLANA_RPC_URL` | ✅ | Mainnet RPC endpoint |
| `FACILITATOR_PRIVATE_KEY` | ✅ | Facilitator wallet private key (base58) |
| `PAYMENT_AMOUNT` | ⬜ | USDC amount per request (default: 0.01) |
| `PORT` | ⬜ | Server port (default: 3402) |

> ⚠️ **Security:** Never commit `FACILITATOR_PRIVATE_KEY`. Use environment variables or a secrets manager.

---

## Plugin Delivery Platform

**Platform:** any static host (no production deployment currently)

```bash
cd packages/plugin.delivery
bun install
bun run build
npx serve public
```

---


## Live Deployments

Current production deployments and their hosting platforms:

### Cloudflare Workers (static sites)

All public sites deploy as Cloudflare Workers static assets under the pumpk.it zone. Each has a `wrangler.jsonc` with its custom domain baked in; `npx wrangler deploy` (with `-c <dir>/wrangler.jsonc` for the non-root ones) builds nothing and ships the prebuilt assets.

| URL | Source | Deploy |
|-----|--------|--------|
| [sdk.pumpk.it](https://sdk.pumpk.it) | `website/` + `live/` (assembled by `scripts/build-site.mjs`) | `node scripts/build-site.mjs && npx wrangler deploy` |
| [demo.pumpk.it](https://demo.pumpk.it) | `pumpfun-site/` | `npx wrangler deploy -c pumpfun-site/wrangler.jsonc` |
| [agents.pumpk.it](https://agents.pumpk.it) | `packages/defi-agents/` (`bun run build` first) | `npx wrangler deploy -c packages/defi-agents/wrangler.jsonc` |
| [pumpk.it](https://pumpk.it) | `packages/web` in [nirholas/pumpkit](https://github.com/nirholas/pumpkit) | `npx turbo build --filter=@pumpkit/web && npx wrangler deploy` |

The old `*.vercel.app` deployments are retired (Vercel returns 402 DEPLOYMENT_DISABLED).

### Railway

| Component | Notes |
|-----------|-------|
| Telegram bots | Channel bot, claim bot, outsiders bot |

> Most Telegram bots are deployed on Railway. Live dashboards and static sites are on Cloudflare Workers.

---

## Production Checklist

### Before Going Live

- [ ] **RPC endpoint:** Use a paid provider (Helius, Alchemy, QuickNode) — public endpoints have strict rate limits
- [ ] **Environment variables:** All secrets set via env vars, not hardcoded
- [ ] **Bot tokens:** Generated fresh, not shared between environments
- [ ] **HTTPS:** All public endpoints served over TLS
- [ ] **Rate limiting:** REST API rate limits configured
- [ ] **Monitoring:** Health check endpoints monitored (UptimeRobot, Betterstack, etc.)
- [ ] **Logging:** Structured logging enabled, no PII or private keys in logs
- [ ] **Restart policy:** `--restart unless-stopped` for Docker, auto-restart on Railway
- [ ] **Backups:** Database/state backups if using persistent storage

### Monitoring Endpoints

| Component | Health Check |
|-----------|-------------|
| Telegram Bot | `GET /api/v1/health` |
| WebSocket Relay | `GET /health` |
| x402 Server | `GET /health` |
| Plugin Delivery | Vercel dashboard |

### RPC Provider Recommendations

| Provider | Free Tier | Paid Plans | WebSocket |
|----------|-----------|------------|-----------|
| [Helius](https://helius.dev) | 100K req/day | From $49/mo | ✅ |
| [Alchemy](https://alchemy.com) | 300M CU/mo | From $49/mo | ✅ |
| [QuickNode](https://quicknode.com) | 50M credits | From $49/mo | ✅ |
| [Triton](https://triton.one) | — | Custom | ✅ |

> See [RPC Best Practices](./rpc-best-practices.md) for rate limiting, failover, and optimization.

### Scaling Notes

- **Telegram bots** scale vertically — a single instance handles thousands of users. Only scale horizontally if you need separate bot instances per channel.
- **WebSocket relay** can handle ~10K concurrent connections on a 1 vCPU machine. For more, put behind a load balancer with sticky sessions.
- **Live dashboards** are static files — scale infinitely behind a CDN.
- **Plugin delivery** runs on Vercel Edge Functions — auto-scales globally.
