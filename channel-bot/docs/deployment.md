# Deployment Guide

> Deploy PumpKit bots to Railway, Docker, or any Node.js host.

## Railway (Recommended)

Railway provides persistent background workers with volumes, custom domains, and auto-deployments from GitHub.

### Prerequisites

```bash
npm install -g @railway/cli
railway login
```

### Deploy Monitor Bot

```bash
cd packages/monitor
railway init
railway link

# Set environment variables
railway variables set TELEGRAM_BOT_TOKEN=your-token
railway variables set SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key

# Deploy
railway up
```

### Deploy Tracker Bot

```bash
cd packages/tracker
railway init
railway link

railway variables set TELEGRAM_BOT_TOKEN=your-other-token
railway up
```

### Persistent Storage

Railway volumes persist data across redeployments:

```bash
railway volume create --mount /app/data
```

- Monitor Bot stores `watches.json` in `/app/data/`
- Tracker Bot stores `tracker.sqlite` in `/app/data/`

### Health Checks

Both bots expose `/health` endpoints. Configure in Railway dashboard:
- **Health Check Path:** `/health`
- **Health Check Interval:** 30s

### railway.json

Include in each bot package:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
```

---

## Docker

### Build

```bash
# Monitor Bot
docker build -t pumpkit-monitor packages/monitor/

# Tracker Bot
docker build -t pumpkit-tracker packages/tracker/
```

### Run

```bash
# Monitor Bot
docker run -d \
  --name pumpkit-monitor \
  --restart unless-stopped \
  -e TELEGRAM_BOT_TOKEN=your-token \
  -e SOLANA_RPC_URL=https://your-rpc.com \
  -v pumpkit-monitor-data:/app/data \
  -p 3000:3000 \
  pumpkit-monitor

# Tracker Bot
docker run -d \
  --name pumpkit-tracker \
  --restart unless-stopped \
  -e TELEGRAM_BOT_TOKEN=your-token \
  -v pumpkit-tracker-data:/app/data \
  -p 3001:3001 \
  pumpkit-tracker
```

### Docker Compose

```yaml
version: '3.8'
services:
  monitor:
    build: packages/monitor/
    restart: unless-stopped
    env_file: packages/monitor/.env
    volumes:
      - monitor-data:/app/data
    ports:
      - "3000:3000"

  tracker:
    build: packages/tracker/
    restart: unless-stopped
    env_file: packages/tracker/.env
    volumes:
      - tracker-data:/app/data
    ports:
      - "3001:3001"

volumes:
  monitor-data:
  tracker-data:
```

---

## Documentation Site (Vercel)

### VitePress Setup

```bash
cd docs-site
npm install
npm run dev      # Local preview at localhost:5173
npm run build    # Generates static site in .vitepress/dist/
```

### Deploy to Vercel

```bash
npx vercel --prod
```

Or connect the GitHub repo and set:
- **Root Directory:** `docs-site`
- **Build Command:** `npm run build`
- **Output Directory:** `.vitepress/dist`

---

## Environment Variables Reference

### Monitor Bot

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | BotFather token |
| `SOLANA_RPC_URL` | ✅ | — | Primary Solana RPC |
| `SOLANA_RPC_URLS` | ❌ | — | Comma-separated fallback RPCs |
| `CHANNEL_ID` | ❌ | — | Channel broadcast mode |
| `BROADCAST_ONLY` | ❌ | `false` | Disable DM commands |
| `FEED_CLAIMS` | ❌ | `true` | Enable claim alerts |
| `FEED_LAUNCHES` | ❌ | `true` | Enable launch alerts |
| `FEED_GRADUATIONS` | ❌ | `true` | Enable graduation alerts |
| `FEED_WHALES` | ❌ | `true` | Enable whale alerts |
| `FEED_CTO` | ❌ | `true` | Enable CTO alerts |
| `FEED_FEE_DISTRIBUTIONS` | ❌ | `true` | Enable fee dist alerts |
| `WHALE_THRESHOLD_SOL` | ❌ | `100` | Min SOL for whale alert |
| `API_ENABLED` | ❌ | `false` | Enable REST API |
| `API_PORT` | ❌ | `3000` | API port |
| `API_AUTH_TOKEN` | ❌ | — | API Bearer token |
| `TWITTER_BEARER_TOKEN` | ❌ | — | Twitter/X API |
| `GITHUB_TOKEN` | ❌ | — | GitHub API |
| `GROQ_API_KEY` | ❌ | — | Groq LLM |
| `ADMIN_CHAT_IDS` | ❌ | — | Admin Telegram IDs |
| `LOG_LEVEL` | ❌ | `info` | Log verbosity |

### Tracker Bot

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | BotFather token |
| `DB_PATH` | ❌ | `data/tracker.sqlite` | SQLite path |
| `ATH_POLL_INTERVAL` | ❌ | `60000` | ATH poll ms |
| `DEXSCREENER_API_URL` | ❌ | `https://api.dexscreener.com` | Price API |
| `HEALTH_PORT` | ❌ | `3001` | Health check port |
| `LOG_LEVEL` | ❌ | `info` | Log verbosity |

---

## Monitoring in Production

### Logs

```bash
# Railway
railway logs -f

# Docker
docker logs -f pumpkit-monitor
docker logs -f pumpkit-tracker
```

### Health Checks

```bash
curl http://localhost:3000/health  # Monitor
curl http://localhost:3001/health  # Tracker
```

Response:
```json
{
  "status": "ok",
  "uptime": "86400s",
  "monitors": {
    "claims": { "running": true, "lastEvent": 1710000000, "processed": 1234 },
    "launches": { "running": true, "lastEvent": 1710000100, "processed": 567 }
  }
}
```
