# PumpKit — Landing Page Content

## Hero Section

**Headline:** Ship PumpFun Bots in Hours, Not Weeks

**Subheadline:** The open-source TypeScript framework for building production-ready PumpFun Telegram bots on Solana — monitoring, alerts, tracking, and analytics out of the box.

**CTA Buttons:**
- **Get Started** → `/docs/getting-started`
- **View on GitHub** → `https://github.com/pumpkit/pumpkit`

---

## Problem Section

### Why PumpKit Exists

Every PumpFun bot builder starts from scratch. You wire up Grammy, connect to Solana RPC, write message formatters, handle graceful shutdown, figure out deployment — then do it all again for the next bot.

**The pain points:**

- **Repetitive scaffolding.** Grammy setup, command routing, health checks, signal handling — the same boilerplate in every bot.
- **Event monitoring is hard.** Parsing on-chain PumpFun events (claims, launches, graduations, whale trades) requires deep knowledge of the Pump program's account layouts and transaction logs.
- **No reusable primitives.** Need a fee claim alert? A graduation tracker? A whale detector? You build each from zero.
- **Deployment headaches.** Docker configs, Railway templates, environment validation, health endpoints — production readiness takes as long as the bot logic itself.

PumpKit extracts the patterns from 4 production bots and 50+ source files into a clean, composable framework. You focus on your bot's unique logic — PumpKit handles the infrastructure.

---

## Features Section

### What You Get

#### 1. Telegram Bot Framework
Production-tested Grammy scaffolding with command routing, error handling, graceful shutdown, and broadcast utilities. Create a fully functional bot in under 20 lines.

#### 2. Real-Time Monitoring (6 Event Types)
Built-in monitors for fee claims, token launches, graduations, whale trades, CTO alerts, and fee distributions. Each emits typed events you can subscribe to.

#### 3. Call Tracking + Leaderboards
Group-based call tracking with point systems, multiplier rankings, PNL cards, win rates, and tiered ranks from Amateur to Oracle. Powered by SQLite.

#### 4. REST API + Webhooks
Every bot includes optional HTTP endpoints for external integrations. Server-Sent Events for real-time streaming. Outbound webhooks for downstream services.

#### 5. Production Ready
Dockerfile, Railway template, health check server, typed environment validation, and graceful shutdown — included with every package. Deploy in minutes.

#### 6. Open Source
MIT licensed. Full source code, documentation, and 26 tutorials. Build on it, fork it, contribute back.

---

## How It Works

### 3 Steps to Your First Bot

**Step 1: Install @pumpkit/core**

```bash
npm install @pumpkit/core
```

**Step 2: Pick monitors + configure**

Choose the monitors you need — fee claims, token launches, graduations, whale trades — and wire them to your bot with a few lines of config:

```typescript
const monitor = new ClaimMonitor({
  rpcUrl: process.env.SOLANA_RPC_URL!,
  onClaim: async (event) => await bot.broadcast(formatClaim(event)),
});
```

**Step 3: Deploy to Railway**

```bash
# One-click deploy to Railway
railway up

# Or use Docker anywhere
docker build -t my-bot . && docker run my-bot
```

---

## Code Example

### A Complete Claim Monitor in 15 Lines

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

That's it. A production-ready fee claim bot with health checks, graceful shutdown, and formatted Telegram messages.

---

## Pre-Built Bots

### Monitor Bot (`@pumpkit/monitor`)

All-in-one PumpFun activity monitor consolidating 3 production bots:

- Fee claim alerts with creator/token details
- Token launch detection with metadata enrichment
- Graduation tracking (bonding curve → AMM migration)
- Whale trade alerts with configurable thresholds
- CTO (Creator Takeover) detection
- Fee distribution notifications
- DM commands: `/watch`, `/add`, `/remove`, `/list`, `/status`
- Channel broadcast mode for read-only feeds
- REST API + Server-Sent Events streaming
- Outbound webhook dispatch
- Twitter/X handle tracking with follower counts
- GitHub-based social fee PDA lookups

### Tracker Bot (`@pumpkit/tracker`)

Group call-tracking bot with competitive leaderboards:

- Paste a token CA → bot registers the call and tracks performance
- Leaderboards ranked by multiplier (24h, 7d, 30d, all-time)
- Canvas-rendered PNL cards (entry price, ATH, gain %)
- Tiered ranking: Amateur → Novice → Contender → Guru → Oracle
- Points system: -1 to +5 based on call multiplier
- Win rate tracking (% of calls hitting ≥ 2x)
- Hardcore mode: auto-kick below minimum win rate
- Multi-chain: Solana, Ethereum, Base, BSC

### Channel Bot (`@pumpkit/channel`)

Read-only broadcast feed for Telegram channels:

- Formatted token event cards (launches, graduations, claims)
- AI-enriched metadata (GitHub, social profiles)
- Zero-interaction — just add to a channel and go

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 20+ |
| **Language** | TypeScript (strict mode, ES modules) |
| **Telegram** | Grammy v1.35+ |
| **Blockchain** | @solana/web3.js v1.98+ |
| **Database** | better-sqlite3 (tracker), file-based JSON (monitor) |
| **Build** | tsup (library), tsc (bots) |
| **Monorepo** | Turborepo |
| **Deployment** | Docker + Railway |
| **Hosting** | Railway (~$5/mo per bot) |

---

## Community + Contributing

PumpKit is open source under the MIT license.

- **GitHub:** [github.com/pumpkit/pumpkit](https://github.com/pumpkit/pumpkit)
- **Contributing:** PRs welcome — see [CONTRIBUTING.md](https://github.com/pumpkit/pumpkit/blob/main/CONTRIBUTING.md)
- **26 Tutorials:** Hands-on guides covering the full framework
- **Protocol Docs:** All 9 official Pump protocol specs included

Built by the team behind [pump-fun-sdk](https://github.com/nirholas/pump-fun-sdk) — the community SDK for PumpFun on Solana.
