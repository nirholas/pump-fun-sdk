# PumpFun Swarm — Bot Orchestration & Dashboard

> Unified control center for all PumpFun bots — real-time monitoring, cross-bot event routing, admin dashboard, and fleet management.

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    PumpFun Swarm Orchestrator                  │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │  Event Bus   │  │ Bot Manager │  │   REST API + WS      │ │
│  │  (pub/sub)   │◄─│  (lifecycle)│  │   (dashboard)        │ │
│  └──────┬───────┘  └──────┬──────┘  └──────────┬───────────┘ │
│         │                 │                     │             │
│    ┌────┴────────────────┴─────────────────────┘             │
│    │                                                          │
│    ▼                                                          │
│  ┌──────────┐ ┌──────────────┐ ┌───────────┐ ┌────────────┐ │
│  │telegram  │ │outsiders     │ │channel    │ │websocket   │ │
│  │  -bot    │ │  -bot        │ │  -bot     │ │  -server   │ │
│  │(fees,    │ │(calls,       │ │(feed,     │ │(relay,     │ │
│  │ alerts)  │ │ leaderboards)│ │ broadcast)│ │ launches)  │ │
│  └──────────┘ └──────────────┘ └───────────┘ └────────────┘ │
└───────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
    ┌──────────┐                      ┌──────────────┐
    │ Telegram │                      │ Browser      │
    │ Users    │                      │ Dashboard    │
    └──────────┘                      └──────────────┘
```

## Features

### Bot Fleet Management
- **Start / Stop / Restart** any bot from the dashboard or API
- **Auto-start** configured bots on swarm launch
- **Build** bots (TypeScript compilation) from the dashboard
- **Health monitoring** with configurable intervals
- **Log aggregation** — view any bot's stdout/stderr in real-time

### Cross-Bot Event Bus
- In-process pub/sub with typed events
- Route whale alerts, token launches, fee claims across bots
- Sliding-window events/minute metrics
- Circular buffer (configurable, default 5000 events)
- Upgradeable to Redis pub/sub for multi-instance deployments

### Admin Dashboard
- Real-time WebSocket updates (no polling)
- Bot fleet overview with status, uptime, restarts, event counts
- Live event feed with type filtering
- Aggregate metrics: launches, trades, fees, calls, errors
- Log viewer modal for each bot
- Dark theme with glassmorphism design
- Fully responsive (desktop, tablet, mobile)

### REST API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Swarm health check |
| GET | `/api/v1/bots` | List all bots + health |
| GET | `/api/v1/bots/:id` | Single bot details |
| POST | `/api/v1/bots/:id/start` | Start a bot |
| POST | `/api/v1/bots/:id/stop` | Stop a bot |
| POST | `/api/v1/bots/:id/restart` | Restart a bot |
| POST | `/api/v1/bots/:id/build` | Build a bot |
| GET | `/api/v1/bots/:id/logs` | Bot log buffer |
| GET | `/api/v1/events` | Recent events (filterable) |
| GET | `/api/v1/metrics` | Aggregate metrics |

### WebSocket (`/ws`)
Connects to the event bus. Receives:
- `init` — Full dashboard state on connect
- `SwarmEvent` — Real-time events as they happen

Sends:
- `{ action: "start", botId: "..." }` — Start a bot
- `{ action: "stop", botId: "..." }` — Stop a bot
- `{ action: "restart", botId: "..." }` — Restart a bot
- `{ action: "status" }` — Request full state refresh

## Quick Start

```bash
cd swarm
npm install
npm run dev
```

Dashboard: http://localhost:4000

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `SWARM_PORT` | `4000` | HTTP + WebSocket port |
| `SWARM_LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `SWARM_HEALTH_INTERVAL` | `10000` | Health check interval (ms) |
| `SWARM_MAX_EVENTS` | `5000` | Max events in circular buffer |
| `SWARM_API_KEY` | — | API key for REST endpoints (optional) |
| `SWARM_AUTO_START` | — | Comma-separated bot IDs to auto-start |
| `SWARM_CORS_ORIGINS` | `*` | CORS allowed origins |

## Bot Fleet

| Bot ID | Name | What It Does |
|--------|------|-------------|
| `telegram-bot` | Fee Monitor | Creator fees, CTO alerts, whale trades, REST API |
| `outsiders-bot` | Call Tracker | Call tracking, leaderboards, PNL cards, hardcore mode |
| `channel-bot` | Channel Feed | Read-only feed: launches, graduations, whales |
| `websocket-server` | WS Relay | Token launch WebSocket broadcasts |

Each bot must be **built** before it can be started. Use the dashboard's Build button or:

```bash
# Build all bots
cd ../telegram-bot && npm run build
cd ../outsiders-bot && npm run build
cd ../channel-bot && npm run build
cd ../websocket-server && npm run build
```

## Event Types

| Event | Source | Description |
|-------|--------|-------------|
| `bot:started` | Any bot | Bot process spawned |
| `bot:stopped` | Any bot | Bot process exited |
| `bot:error` | Any bot | Fatal or recoverable error |
| `bot:health` | Orchestrator | Periodic health snapshot |
| `bot:log` | Any bot | Stdout/stderr line |
| `token:launch` | websocket-server | New token created |
| `token:graduation` | channel-bot | Token graduated to AMM |
| `trade:buy` | channel-bot | Buy trade detected |
| `trade:sell` | channel-bot | Sell trade detected |
| `trade:whale` | channel-bot | Whale trade (≥5 SOL) |
| `fee:claim` | telegram-bot | Creator fee claimed |
| `fee:distribution` | telegram-bot | Fee distribution event |
| `call:new` | outsiders-bot | New call registered |
| `call:result` | outsiders-bot | Call outcome (ATH update) |
| `alert:cto` | telegram-bot | CTO (Creator Took Over) |
| `alert:whale` | Multiple | Whale movement detected |
| `system:metric` | Orchestrator | Internal metrics snapshot |
