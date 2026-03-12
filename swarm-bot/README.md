# PumpFun Swarm Bot — Multi-Strategy Trading Bot Manager

> Multi-strategy Solana trading bot with real-time web dashboard, SQLite persistence, and configurable risk management.

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                       Swarm Bot Manager                       │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐│
│  │  Bot Manager  │  │  Token Feed  │  │  REST API + WS      ││
│  │  (lifecycle)  │  │  (new mints) │  │  (dashboard)        ││
│  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────┘│
│         │                 │                      │           │
│         ▼                 ▼                      ▼           │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐│
│  │  Strategies   │  │  Price Feed  │  │  SQLite Database    ││
│  │  (pluggable)  │  │  (real-time) │  │  (positions/trades) ││
│  └──────────────┘  └──────────────┘  └─────────────────────┘│
└───────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
    ┌──────────┐                      ┌──────────────┐
    │ Solana   │                      │ Browser      │
    │ Mainnet  │                      │ Dashboard    │
    └──────────┘                      └──────────────┘
```

## Features

- **Multi-strategy bot engine** — Run multiple bots with independent strategies, each with isolated position tracking
- **Token feed** — Detect new PumpFun token launches in real-time
- **Price feed** — Continuous price monitoring for open positions
- **SQLite persistence** — All positions, trades, and bot state persisted to disk
- **Risk management** — Per-bot and global SOL position limits, configurable slippage
- **Web dashboard** — Real-time admin interface via REST API + WebSocket
- **Docker-ready** — Multi-stage Dockerfile with tini init and persistent volumes

## Quick Start

```bash
# Install dependencies
cd swarm-bot
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your RPC URL and settings

# Development (hot-reload)
npm run dev

# Production
npm run build
npm start
```

Dashboard: http://localhost:3100

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC HTTP endpoint |
| `SOLANA_WS_URL` | Auto-derived from RPC URL | Solana WebSocket endpoint |
| `PORT` | `3100` | Dashboard HTTP + WS port |
| `DB_PATH` | `./data/swarm.db` | SQLite database file path |
| `DEFAULT_SLIPPAGE_BPS` | `500` | Default slippage tolerance (500 = 5%) |
| `MAX_POSITION_SOL_PER_BOT` | `5` | Max SOL a single bot can hold |
| `MAX_TOTAL_POSITION_SOL` | `50` | Global max SOL across all bots |
| `POLL_INTERVAL_MS` | `5000` | Price polling interval (ms) |
| `LOG_LEVEL` | `info` | Log level: debug, info, warn, error |

## Project Structure

```
swarm-bot/
├── Dockerfile           # Multi-stage Docker build
├── package.json         # Dependencies & scripts
├── tsconfig.json        # TypeScript config
└── src/
    ├── index.ts         # Entry point — initializes all components
    ├── config.ts        # Environment config loader
    ├── logger.ts        # Leveled logger
    ├── api/
    │   └── server.ts    # REST API + WebSocket server
    ├── dashboard/
    │   └── ...          # Embedded web dashboard UI
    ├── engine/
    │   └── bot-manager.ts  # Bot lifecycle management
    ├── market/
    │   ├── token-feed.ts   # New token detection
    │   └── price-feed.ts   # Price monitoring
    ├── store/
    │   └── db.ts        # SQLite storage layer
    └── strategies/
        └── ...          # Pluggable trading strategies
```

## Docker

```bash
# Build
docker build -f swarm-bot/Dockerfile -t pump-swarm-bot .

# Run with persistent data
docker run -d \
  --name swarm-bot \
  -p 3100:3100 \
  -v swarm-data:/app/data \
  -e SOLANA_RPC_URL=https://your-rpc.com \
  pump-swarm-bot
```

The Docker image uses:
- **node:22-alpine** — Minimal Node.js runtime
- **tini** — Proper PID 1 init for signal handling
- **Multi-stage build** — Build artifacts only in production image
- **Persistent volume** at `/app/data` for SQLite database

## Dependencies

| Package | Purpose |
|---------|---------|
| `@nirholas/pump-sdk` | Pump protocol instruction builders |
| `@solana/web3.js` | Solana RPC client |
| `@solana/spl-token` | SPL token operations |
| `better-sqlite3` | SQLite database |
| `bn.js` | Big number math for token amounts |
| `ws` | WebSocket server for dashboard |
| `dotenv` | Environment variable loading |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development with tsx hot-reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build |
| `npm run typecheck` | Type-check without emitting |

## Security Notes

- Never commit `.env` files or private keys
- Use dedicated wallets with limited SOL for bot operations
- Set `MAX_POSITION_SOL_PER_BOT` and `MAX_TOTAL_POSITION_SOL` conservatively
- Monitor the dashboard for unexpected position sizes
- SQLite database contains trade history — protect file permissions

## License

MIT — Part of [pump-fun-sdk](https://github.com/nirholas/pump-fun-sdk)
