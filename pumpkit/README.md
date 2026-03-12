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
| [`@pumpkit/web`](packages/web/) | Frontend dashboard and documentation site | 🏗️ Skeleton |

> **npm:** Packages will be published to npm under the `@pumpkit` scope. See [npm Packages](docs/npm.md) for the publishing roadmap.

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

### Getting Started
- [Getting Started](docs/getting-started.md) — Setup, configuration, first bot
- [Development](docs/development.md) — Local environment, commands, debugging
- [Architecture](docs/architecture.md) — System design, module boundaries, data flow
- [Deployment](docs/deployment.md) — Railway, Docker, Vercel setup
- [FAQ](docs/faq.md) — Common questions and troubleshooting

### Package Docs
- [Core API](docs/core-api.md) — `@pumpkit/core` module reference
- [Monitor Bot](docs/monitor-bot.md) — Feature spec, commands, configuration
- [Tracker Bot](docs/tracker-bot.md) — Feature spec, commands, configuration
- [npm Packages](docs/npm.md) — Publishing roadmap (coming soon)

### Pump Protocol Reference
- [Protocol Overview](docs/pump-protocol/) — All 9 official protocol specs + IDLs
- [Bonding Curve Math](docs/guides/bonding-curve-math.md) — Constant-product formula, buy/sell calculations
- [Fee Tiers](docs/guides/fee-tiers.md) — Market-cap-based dynamic fee selection
- [Fee Sharing](docs/guides/fee-sharing.md) — Multi-shareholder fee distribution
- [Social Fees](docs/guides/social-fees.md) — GitHub identity-based fee sharing
- [Cashback](docs/guides/cashback.md) — Trader cashback opt-in system
- [Token Incentives](docs/guides/token-incentives.md) — Volume-based PUMP rewards
- [Mayhem Mode](docs/guides/mayhem-mode.md) — Alternate vault routing, Token2022
- [Events Reference](docs/guides/events-reference.md) — 20+ on-chain event types
- [Analytics](docs/guides/analytics.md) — Price impact, graduation progress, market cap
- [End-to-End Workflow](docs/guides/end-to-end-workflow.md) — Full token lifecycle

### Reference
- [Glossary](docs/glossary.md) — Key terms and definitions
- [Code Examples](docs/examples.md) — Practical code samples
- [Error Reference](docs/errors.md) — Custom error classes and fixes
- [RPC Best Practices](docs/rpc-best-practices.md) — Provider selection, batching, rate limiting
- [Performance](docs/performance.md) — Benchmarks, latency, and optimization tips
- [Security Guide](docs/guides/security.md) — Crypto library rules, key management
- [Troubleshooting](docs/troubleshooting.md) — Common issues and solutions
- [Support](docs/support.md) — Getting help, bug reports, feature requests
- [Roadmap](docs/roadmap.md) — Where PumpKit is headed

### Tutorials

26 hands-on guides in [tutorials/](tutorials/):

| Tutorial | Topic |
|----------|-------|
| [Create Token](tutorials/01-create-token.md) | Launch a token on bonding curve |
| [Buy Tokens](tutorials/02-buy-tokens.md) | Purchase tokens via bonding curve |
| [Sell Tokens](tutorials/03-sell-tokens.md) | Sell tokens back for SOL |
| [Create & Buy](tutorials/04-create-and-buy.md) | Atomic create + first buy |
| [Bonding Curve Math](tutorials/05-bonding-curve-math.md) | Price calculation formulas |
| [Migration](tutorials/06-migration.md) | Token graduation to AMM |
| [Fee Sharing](tutorials/07-fee-sharing.md) | Shareholder setup |
| [Token Incentives](tutorials/08-token-incentives.md) | Volume-based rewards |
| [Fee System](tutorials/09-fee-system.md) | Tiered fee calculations |
| [Working with PDAs](tutorials/10-working-with-pdas.md) | Program Derived Addresses |
| [Trading Bot](tutorials/11-trading-bot.md) | Condition-based trading patterns |
| [Decoding Accounts](tutorials/15-decoding-accounts.md) | Parse on-chain account data |
| [Monitoring Claims](tutorials/16-monitoring-claims.md) | Fee claim monitoring architecture |
| [Telegram Bot](tutorials/18-telegram-bot.md) | Interactive DM bot with grammy |
| [MCP Server](tutorials/20-mcp-server-ai-agents.md) | AI agent integration |
| [WebSocket Feeds](tutorials/21-websocket-realtime-feeds.md) | Real-time token data |
| [Channel Bot Setup](tutorials/22-channel-bot-setup.md) | Read-only broadcast feed |
| [Event Parsing](tutorials/29-event-parsing-analytics.md) | Decoding on-chain events |
| [Error Handling](tutorials/33-error-handling-patterns.md) | Validation and error classes |
| [Security Auditing](tutorials/37-security-auditing-verification.md) | Security audit checklist |
| [AI Enrichment](tutorials/39-channel-bot-ai-enrichment.md) | GitHub + AI-powered cards |
| [Your First Claim Bot](tutorials/40-your-first-claim-bot.md) | Build a claim bot from scratch |
| [Customizing Claim Cards](tutorials/41-customizing-claim-cards.md) | HTML formatting, badges, enrichment |
| [Channel Feed Bot](tutorials/42-channel-feed-bot.md) | Channel broadcasting setup |
| [Understanding Events](tutorials/43-understanding-pumpfun-events.md) | On-chain event types and parsing |

### Community
- [Contributing](CONTRIBUTING.md) — How to contribute
- [Code of Conduct](CODE_OF_CONDUCT.md) — Community standards
- [Security Policy](SECURITY.md) — Vulnerability reporting
- [Changelog](CHANGELOG.md) — Release history

## Origins

PumpKit was extracted from the [pump-fun-sdk](https://github.com/nirholas/pump-fun-sdk) Telegram bot ecosystem — 4 production bots with 50+ source files consolidated into a clean, reusable framework.

## License

MIT
