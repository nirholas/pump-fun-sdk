# Lair-TG — Unified Telegram Bot for DeFi Intelligence

A unified Telegram bot platform that aggregates data from multiple DeFi sources and provides real-time market intelligence, wallet tracking, and token analytics on Solana.

## Features

- **Token Lookups** — Fetch token info from DexScreener (more sources planned)
- **Price Checks** — Quick price queries for any Solana token
- **Modular Architecture** — Enable/disable modules via environment variables
- **Health Endpoint** — `/health` for Docker/Railway probes
- **Extensible Data Sources** — Add new DeFi APIs by implementing the `DataSource` interface

### Planned

- **Wallet Module** — Balance checks via Solana RPC
- **Price Alerts** — Configurable alerts with polling
- **Token Launch** — Deploy tokens via bonding curves
- **AI Assistant** — Natural language queries with function calling
- **MCP Integration** — Model Context Protocol for AI agent access

## Quick Start

```bash
# Install dependencies
npm install

# Copy env template and fill in values
cp .env.example .env

# Development (hot reload)
npm run dev

# Production
npm run build
npm start
```

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and quick reference |
| `/help` | Full command list |
| `/token <address>` | Full token info card |
| `/price <address>` | Quick price check |

## Configuration

All configuration is via environment variables. See [.env.example](.env.example) for the full list.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | — | Bot token from @BotFather |
| `SOLANA_RPC_URL` | Yes | — | Solana RPC endpoint |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |
| `HEALTH_PORT` | No | `3000` | Health check server port |
| `MODULE_WALLET` | No | `true` | Enable wallet module |
| `MODULE_MARKET` | No | `true` | Enable market data module |
| `MODULE_LAUNCH` | No | `true` | Enable token launch module |
| `MODULE_ALERTS` | No | `true` | Enable price alerts module |

## Project Structure

```
lair-tg/
├── src/
│   ├── index.ts          # Entry point — startup, shutdown, health
│   ├── bot.ts            # Grammy bot setup & command handlers
│   ├── config.ts         # Environment config loader
│   ├── data-sources.ts   # DeFi data aggregator (DexScreener, etc.)
│   ├── formatters.ts     # Telegram HTML message formatters
│   ├── health.ts         # HTTP health check server
│   ├── logger.ts         # Structured logger
│   └── types.ts          # Shared TypeScript types
├── Dockerfile            # Multi-stage production build
├── railway.json          # Railway deployment config
├── package.json
└── tsconfig.json
```

## Deployment

### Docker

```bash
docker build -t lair-tg .
docker run -d \
  -e TELEGRAM_BOT_TOKEN=your-token \
  -e SOLANA_RPC_URL=https://api.mainnet-beta.solana.com \
  -p 3000:3000 \
  lair-tg
```

### Railway

Push the `lair-tg/` directory to Railway. The `railway.json` config will auto-detect the Dockerfile.

Set `TELEGRAM_BOT_TOKEN` and `SOLANA_RPC_URL` as environment variables in the Railway dashboard.

## Architecture

Lair-TG follows the same patterns as the other bots in this repository:

- **grammY** for Telegram bot framework
- **Modular config** via `loadConfig()` with env vars
- **Structured logger** with level filtering
- **Health server** for container orchestration probes
- **Graceful shutdown** on SIGINT/SIGTERM
- **HTML formatting** for rich Telegram messages

The `DataAggregator` class provides a unified interface for fetching token data across multiple DeFi APIs. New sources are added by implementing the `DataSource` interface.

## License

See the root [LICENSE](../LICENSE) file.
