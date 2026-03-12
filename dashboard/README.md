# PumpFun Dashboard — Unified Bot Control Panel

> Centralized dashboard for monitoring and controlling all PumpFun bots — health checks, real-time event streaming, and fleet management via REST API + SSE.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              PumpFun Dashboard                  │
│                                                 │
│  ┌─────────────┐  ┌───────────┐  ┌───────────┐ │
│  │ Health       │  │ Event Log │  │ REST API  │ │
│  │ Poller       │  │ (SSE)     │  │ (control) │ │
│  └──────┬──────┘  └─────┬─────┘  └─────┬─────┘ │
│         │               │              │        │
│         ▼               ▼              ▼        │
│  ┌─────────────────────────────────────────────┐│
│  │         Embedded SPA Dashboard              ││
│  │     (dark theme, real-time updates)         ││
│  └─────────────────────────────────────────────┘│
└──────────────┬──────────────────────────────────┘
               │  Health polling
    ┌──────────┼──────────────────────────┐
    ▼          ▼          ▼               ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐
│telegram│ │channel │ │outsider│ │websocket     │
│-bot    │ │-bot    │ │-bot    │ │-server       │
└────────┘ └────────┘ └────────┘ └──────────────┘
```

## Features

- **Health monitoring** — Poll each bot's health endpoint at configurable intervals
- **SSE event streaming** — Real-time server-sent events to browser clients
- **REST API** — Query bot status, events, and aggregate metrics
- **API key authentication** — Optional `X-API-Key` / `Bearer` token auth
- **CORS support** — Cross-origin requests for external frontends
- **Embedded SPA** — No build tools needed, fully self-contained HTML dashboard
- **Graceful shutdown** — Clean process termination with connection draining
- **Zero dependencies** — Only `dotenv` as runtime dependency

## Quick Start

```bash
cd dashboard
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your bot URLs

# Development (hot-reload)
npm run dev

# Production
npm run build
npm start
```

Dashboard: http://localhost:8080

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DASHBOARD_PORT` | `8080` | HTTP server port |
| `DASHBOARD_API_KEY` | — | API key for authentication (optional, open if unset) |
| `TELEGRAM_BOT_URL` | — | Telegram bot base URL (e.g. `http://localhost:3000`) |
| `CHANNEL_BOT_URL` | — | Channel bot base URL (e.g. `http://localhost:3002`) |
| `OUTSIDERS_BOT_URL` | — | Outsiders bot base URL (e.g. `http://localhost:3001`) |
| `WEBSOCKET_SERVER_URL` | — | WebSocket relay base URL (e.g. `http://localhost:3003`) |
| `TELEGRAM_BOT_API_KEY` | — | Telegram Bot API token for direct control |
| `TELEGRAM_BOT_ENABLE_API` | `true` | Enable Telegram API integration |
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Primary Solana RPC endpoint |
| `SOLANA_RPC_URLS` | — | Comma-separated fallback RPC URLs |

Only configure bot URLs for the bots you're actually running — unconfigured bots are omitted from health polling.

## Project Structure

```
dashboard/
├── .env.example         # Environment variable template
├── package.json         # Dependencies & scripts
├── tsconfig.json        # TypeScript config
└── src/
    ├── server.ts        # HTTP server — routing, auth, CORS, SSE
    ├── config.ts        # Environment config loader with service discovery
    ├── events.ts        # Event log with SSE broadcasting
    ├── health.ts        # Health poller for all registered services
    ├── process-manager.ts  # Bot process lifecycle management
    └── ui.ts            # Embedded SPA HTML renderer
```

## API Reference

### Authentication

All API endpoints support optional authentication:

```
Authorization: Bearer <api-key>
X-API-Key: <api-key>
```

If `DASHBOARD_API_KEY` is not set, all endpoints are open.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Dashboard SPA (HTML) |
| `GET` | `/api/v1/health` | Aggregate health of all services |
| `GET` | `/api/v1/services` | List all registered services + status |
| `GET` | `/api/v1/events` | Recent events (JSON) |
| `GET` | `/api/v1/events/stream` | SSE real-time event stream |

### Monitored Services

Each service is auto-discovered from environment variables:

| Service | Health Path | Description |
|---------|-------------|-------------|
| Telegram Bot | `/api/v1/health` | Fee claims, CTO alerts, whale trades, graduations |
| Channel Bot | `/health` | PumpFun channel feed with AI summaries |
| Outsiders Bot | `/health` | Call tracking, leaderboards, PNL cards |
| WebSocket Relay | `/health` | Real-time token launch broadcasting |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development with tsx hot-reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build |
| `npm run typecheck` | Type-check without emitting |

## Deployment

### Docker

The dashboard is lightweight (zero native deps) and can run in any Node.js container:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY dist/ dist/
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

### Railway

Add the following environment variables in Railway settings, pointing to your deployed bot URLs.

### Vercel

Not recommended — the dashboard uses SSE streaming which requires a persistent server.

## Security

- Set `DASHBOARD_API_KEY` in production to prevent unauthorized access
- Bot health URLs should be internal/private network addresses
- Never expose the dashboard directly to the internet without authentication
- RPC URLs are used for on-chain queries only — no signing capabilities

## License

MIT — Part of [pump-fun-sdk](https://github.com/nirholas/pump-fun-sdk)
