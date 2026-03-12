# PumpKit

> Open-source framework for building PumpFun Telegram bots on Solana. Claim monitors, channel feeds, group trackers, whale alerts — build your own or use ours.

## What is PumpKit?

PumpKit is a TypeScript framework and collection of production-ready bots for monitoring PumpFun activity on Solana via Telegram. It provides:

- **`@pumpkit/core`** — Shared framework: bot scaffolding, Solana monitoring, formatters, storage, config, health checks
- **`@pumpkit/monitor`** — All-in-one monitoring bot (fee claims, launches, graduations, whale trades, CTO alerts)
- **`@pumpkit/tracker`** — Group call-tracking bot (leaderboards, PNL cards, rankings, multi-chain)

## Why PumpKit?

Claim bots and PumpFun monitors are some of the most popular Telegram bots in crypto. But every builder starts from scratch — writing the same grammy setup, Solana RPC connections, message formatters, and deployment configs.

PumpKit gives you production-tested building blocks so you can ship a bot in hours, not weeks.

## Architecture

```
┌───────────────────────────────────────────────────┐
│                  @pumpkit/core                    │
│                                                   │
│  bot/       grammy scaffolding, command router    │
│  monitor/   WebSocket + HTTP event monitors       │
│  solana/    RPC client, program IDs, decoders     │
│  formatter/ HTML message builder (Telegram)       │
│  storage/   File-based + SQLite adapters          │
│  config/    Typed env loader with validation      │
│  health/    HTTP health check server              │
│  logger/    Leveled console logger                │
│  api/       REST + SSE + webhook server           │
│  social/    Twitter/X + GitHub integrations       │
│  types/     Shared event & program types          │
└──────────┬────────────────────────┬───────────────┘
           │                        │
    ┌──────▼───────┐          ┌──────▼───────┐
    │  @pumpkit/   │          │  @pumpkit/   │
    │   monitor    │          │   tracker    │
    │              │          │              │
    │ DM commands  │          │ Group calls  │
    │ Channel feed │          │ Leaderboards │
    │ REST API     │          │ PNL cards    │
    │ Webhooks     │          │ Rankings     │
    │ SSE stream   │          │ Multi-chain  │
    └──────────────┘          └──────────────┘
```

## Quick Start

### Use a pre-built bot

```bash
# Clone the repo
git clone https://github.com/pumpkit/pumpkit.git
cd pumpkit

# Install dependencies
npm install

# Configure
cp packages/monitor/.env.example packages/monitor/.env
# Edit .env with your TELEGRAM_BOT_TOKEN and SOLANA_RPC_URL

# Run the monitor bot
npm run dev --workspace=@pumpkit/monitor
```

### Build your own bot

```typescript
import { createBot, ClaimMonitor, formatClaim, createHealthServer } from '@pumpkit/core';

const bot = createBot({
  token: process.env.BOT_TOKEN!,
  commands: {
    start: (ctx) => ctx.reply('Welcome to my claim bot!'),
    help: (ctx) => ctx.reply('I monitor PumpFun fee claims.'),
  },
});

const monitor = new ClaimMonitor({
  rpcUrl: process.env.SOLANA_RPC_URL!,
  onClaim: async (event) => {
    await bot.broadcast(formatClaim(event));
  },
});

createHealthServer({ port: 3000, monitor });
monitor.start();
bot.launch();
```

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [`@pumpkit/core`](packages/core/) | Shared framework — logger, health server, config, shutdown, types | ✅ Ready |
| [`@pumpkit/monitor`](packages/monitor/) | All-in-one PumpFun monitor bot (DM + channel + API) | ✅ Ready |
| [`@pumpkit/channel`](packages/channel/) | Read-only Telegram channel feed (broadcasts token events) | ✅ Ready |
| [`@pumpkit/claim`](packages/claim/) | Fee claim tracker by token CA or X handle | ✅ Ready |
| [`@pumpkit/tracker`](packages/tracker/) | Group call-tracking bot with leaderboards & PNL cards | ✅ Ready |
| [`@pumpkit/web`](packages/web/) | Frontend dashboard and documentation site | 🚧 Coming Soon |

> **npm:** Packages will be published to npm soon. See [npm docs](docs/npm.md) for details.

## Features

### Monitor Bot (`@pumpkit/monitor`)

Consolidates 3 existing production bots into one:

| Feature | Source | Description |
|---------|--------|-------------|
| **Fee Claim Alerts** | telegram-bot, claim-bot | Real-time notifications when creators claim fees |
| **Token Launch Monitor** | telegram-bot, channel-bot | Detect new PumpFun token mints |
| **Graduation Alerts** | telegram-bot, channel-bot | Bonding curve completion → AMM migration |
| **Whale Trade Alerts** | telegram-bot, channel-bot | Large buy/sell above configurable threshold |
| **CTO Alerts** | telegram-bot | Creator Takeover (fee redirection) detection |
| **Fee Distributions** | telegram-bot, channel-bot | Fee sharing payouts to shareholders |
| **Channel Broadcast** | channel-bot | Read-only Telegram channel feed mode |
| **DM Commands** | telegram-bot, claim-bot | `/watch`, `/add`, `/remove`, `/list`, `/status` |
| **REST API + SSE** | telegram-bot | HTTP endpoints, Server-Sent Events streaming |
| **Webhooks** | telegram-bot | Outbound webhook dispatch for integrations |
| **Twitter/X Tracking** | claim-bot, channel-bot | Track tokens by X handle, follower counts |
| **GitHub Social Fees** | channel-bot | Social fee PDA lookup via GitHub |

### Tracker Bot (`@pumpkit/tracker`)

| Feature | Description |
|---------|-------------|
| **Call Tracking** | Paste a token CA → bot registers and tracks performance |
| **Leaderboards** | Top calls by multiplier, rankings by points (24h/7d/30d/all) |
| **PNL Cards** | Shareable Canvas-rendered images (entry, ATH, gain) |
| **Ranking System** | Amateur → Novice → Contender → Guru → Oracle |
| **Points System** | -1 to +5 based on call multiplier |
| **Win Rate** | Percentage of calls hitting ≥ 2x |
| **Hardcore Mode** | Auto-kick below minimum win rate |
| **Multi-Chain** | Solana, Ethereum, Base, BSC |

## Hosting

| Component | Platform | Cost |
|-----------|----------|------|
| Monitor Bot | Railway | ~$5/mo (Hobby) |
| Tracker Bot | Railway | ~$5/mo (Hobby) |
| Documentation | Vercel | Free |

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript (ES modules, strict mode)
- **Telegram:** grammy v1.35+
- **Solana:** @solana/web3.js v1.98+
- **Database:** better-sqlite3 (tracker), file-based JSON (monitor)
- **Build:** tsup (library), tsc (bots)
- **Monorepo:** Turborepo
- **Deployment:** Docker + Railway

## Documentation

### Framework
- [Architecture](docs/architecture.md) — System design, module boundaries, data flow
- [Getting Started](docs/getting-started.md) — Setup, configuration, first bot
- [Core API](docs/core-api.md) — `@pumpkit/core` module reference
- [Monitor Bot](docs/monitor-bot.md) — Feature spec, commands, configuration
- [Tracker Bot](docs/tracker-bot.md) — Feature spec, commands, configuration
- [Deployment](docs/deployment.md) — Railway, Docker, Vercel setup
- [npm Packages](docs/npm-packages.md) — Package publishing roadmap (coming soon)

### Pump Protocol Reference
- [Protocol Overview](docs/pump-protocol/) — All 9 official protocol specs + IDLs
- [Events Reference](docs/guides/events-reference.md) — 20+ on-chain event types with field mappings
- [Bonding Curve Math](docs/guides/bonding-curve-math.md) — Constant-product formula, buy/sell calculations
- [Fee Tiers](docs/guides/fee-tiers.md) — Market-cap-based dynamic fee selection
- [Fee Sharing](docs/guides/fee-sharing.md) — Multi-shareholder fee distribution
- [Social Fees](docs/guides/social-fees.md) — GitHub identity-based fee sharing
- [Cashback](docs/guides/cashback.md) — Trader cashback opt-in system
- [Token Incentives](docs/guides/token-incentives.md) — Volume-based PUMP rewards
- [Mayhem Mode](docs/guides/mayhem-mode.md) — Alternate vault routing, Token2022
- [End-to-End Workflow](docs/guides/end-to-end-workflow.md) — Full token lifecycle
- [Analytics](docs/guides/analytics.md) — Price impact, graduation progress, market cap
- [Security](docs/guides/security.md) — Crypto library rules, key management

### Reference
- [Glossary](docs/reference/glossary.md) — 60+ protocol and SDK terms
- [Code Examples](docs/reference/examples.md) — 20+ practical code samples
- [Error Reference](docs/reference/errors.md) — Custom error classes and fixes
- [RPC Best Practices](docs/reference/rpc-best-practices.md) — Provider selection, batching, rate limiting

### Tutorials
- [Tutorial Index](tutorials/) — 19 hands-on guides covering SDK basics, fee system, bot development, and infrastructure

### Contributing
- [Contributing](CONTRIBUTING.md) — How to contribute

### Protocol & Reference

- [Events Reference](docs/events-reference.md) — All 20+ PumpFun on-chain event types
- [Fee Sharing](docs/fee-sharing.md) — Shareholder configuration and distribution
- [Fee Tiers](docs/fee-tiers.md) — Market cap-based fee calculation
- [Cashback](docs/cashback.md) — Cashback accumulation and claiming
- [Channel Bot Architecture](docs/channel-bot-architecture.md) — Deep dive into event detection patterns
- [Analytics](docs/analytics.md) — Price impact, graduation progress, token pricing
- [RPC Best Practices](docs/rpc-best-practices.md) — Connection management and fallback
- [Error Handling](docs/errors.md) — Error types and validation patterns
- [End-to-End Workflow](docs/end-to-end-workflow.md) — Full token lifecycle
- [FAQ](docs/faq.md) — Common issues and CU optimization
- [npm Packages](docs/npm.md) — Coming soon

### Tutorials

9 hands-on guides in [tutorials/](tutorials/):

| Tutorial | Topic |
|----------|-------|
| [Telegram Bot Patterns](tutorials/18-telegram-bot.md) | Interactive DM bot with grammy |
| [Channel Bot Setup](tutorials/22-channel-bot-setup.md) | Read-only broadcast feed |
| [Monitoring Claims](tutorials/16-monitoring-claims.md) | Fee claim monitoring architecture |
| [WebSocket Feeds](tutorials/21-websocket-realtime-feeds.md) | Real-time token data |
| [Event Parsing](tutorials/29-event-parsing-analytics.md) | Decoding on-chain events |
| [AI Enrichment](tutorials/39-channel-bot-ai-enrichment.md) | GitHub + AI-powered cards |
| [Trading Bot](tutorials/11-trading-bot.md) | Condition-based trading patterns |
| [Fee Sharing](tutorials/07-fee-sharing.md) | Shareholder setup |
| [Error Handling](tutorials/33-error-handling-patterns.md) | Validation and error classes |

### Protocol Specs

Official Pump protocol documentation in [docs/protocol/](docs/protocol/):
- Pump Program (bonding curve state, instructions)
- PumpSwap AMM (pool state, swap instructions)
- Fee Program (dynamic fee tiers)
- Creator Fees, Cashback, and more
- Anchor IDL files for all 3 programs

## Origins

PumpKit was extracted from the [pump-fun-sdk](https://github.com/nirholas/pump-fun-sdk) Telegram bot ecosystem — 4 production bots with 50+ source files consolidated into a clean, reusable framework.

## License

MIT
