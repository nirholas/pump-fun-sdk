# PumpKit Architecture

> System design, module boundaries, and data flow for the PumpKit framework.

## Overview

PumpKit is a monorepo containing 3 packages:

```
pumpkit/
├── packages/
│   ├── core/              @pumpkit/core — shared framework
│   ├── monitor/           @pumpkit/monitor — monitoring bot
│   └── tracker/           @pumpkit/tracker — group tracker bot
├── docs/                  documentation
├── examples/              starter templates
└── turbo.json             monorepo config
```

## Package Dependencies

```
@pumpkit/monitor ──→ @pumpkit/core
@pumpkit/tracker ──→ @pumpkit/core
```

Both bots depend on `@pumpkit/core`. The core package has zero internal dependencies — it only depends on external npm packages.

## @pumpkit/core — Module Map

```
@pumpkit/core/
├── bot/
│   ├── createBot.ts          Grammy bot factory with error handling
│   ├── commandRouter.ts      Command registration + help generation
│   └── middleware.ts         Rate limiting, logging, auth middleware
│
├── monitor/
│   ├── EventMonitor.ts       Base class: WebSocket + HTTP polling
│   ├── ClaimMonitor.ts       Fee claim event detection
│   ├── LaunchMonitor.ts      New token mint detection
│   ├── GraduationMonitor.ts  Bonding curve completion detection
│   ├── WhaleMonitor.ts       Large trade detection (configurable threshold)
│   ├── CTOMonitor.ts         Creator Takeover detection
│   └── FeeDistMonitor.ts     Fee distribution event detection
│
├── solana/
│   ├── rpc.ts                Connection factory + RPC fallback rotation
│   ├── programs.ts           Program IDs (Pump, PumpAMM, PumpFees)
│   ├── decoders.ts           Instruction + event log decoders
│   ├── pdas.ts               PDA derivation helpers
│   └── types.ts              On-chain account types
│
├── formatter/
│   ├── html.ts               Telegram HTML message builder
│   ├── templates.ts          Pre-built notification templates
│   └── links.ts              Solscan, pump.fun, explorer link generators
│
├── storage/
│   ├── FileStore.ts          JSON file persistence (watches, config)
│   ├── SqliteStore.ts        better-sqlite3 adapter (calls, leaderboards)
│   └── types.ts              Storage interface (pluggable)
│
├── config/
│   ├── loadConfig.ts         Typed env loader with defaults + validation
│   └── schema.ts             Config schemas for each bot type
│
├── health/
│   └── server.ts             HTTP health check endpoint
│
├── logger/
│   └── index.ts              Leveled console logger (debug/info/warn/error)
│
├── api/
│   ├── server.ts             Express HTTP server factory
│   ├── sse.ts                Server-Sent Events streaming
│   ├── webhooks.ts           Outbound webhook dispatch
│   └── rateLimiter.ts        Per-user rate limiting
│
├── social/
│   ├── twitter.ts            Twitter/X v2 API client
│   ├── github.ts             GitHub API (social fee PDA lookup)
│   └── types.ts              Social integration types
│
└── types/
    ├── events.ts             Claim, launch, graduation, trade event types
    ├── programs.ts           Pump program discriminators + account types
    └── common.ts             Shared utility types
```

## Data Flow

### Monitor Bot — Event Detection Pipeline

```
Solana Mainnet
     │
     ├── WebSocket (onLogs)    ← Real-time event stream
     │        │
     │        ▼
     │   EventMonitor
     │   ├── decode program logs
     │   ├── match instruction discriminators
     │   └── emit typed events
     │
     ├── HTTP Polling           ← Fallback / batch queries
     │        │
     │        ▼
     │   ClaimMonitor / LaunchMonitor / etc.
     │   ├── getSignaturesForAddress
     │   ├── getParsedTransaction
     │   └── deduplicate (claim tracker)
     │
     ▼
Event Bus
     │
     ├──→ Telegram (grammy)
     │    ├── DM notifications (watched wallets)
     │    ├── Group messages
     │    └── Channel broadcasts
     │
     ├──→ REST API
     │    ├── GET /claims, /launches, /status
     │    └── SSE /stream
     │
     └──→ Webhooks
          └── POST to registered URLs
```

### Tracker Bot — Call Tracking Pipeline

```
Telegram Group Chat
     │
     ├── User pastes CA / LP link / chart URL
     │        │
     │        ▼
     │   CallParser
     │   ├── Extract contract address
     │   ├── Detect chain (Sol/Eth/Base/BSC)
     │   └── Validate token exists
     │
     ├── DexScreener API
     │        │
     │        ▼
     │   TokenService
     │   ├── Get current price + mcap
     │   ├── Track ATH (poll every 60s)
     │   └── Calculate multiplier
     │
     ▼
SQLite Database
     │
     ├── calls table (token, user, group, entry price, ATH)
     ├── users table (points, win rate, rank)
     └── groups table (settings, hardcore mode)
     │
     ▼
Telegram Responses
     ├── /leaderboard — Top calls + performance rankings
     ├── /pnl — Canvas-rendered PNL card image
     ├── /rank — User rank + stats
     └── /calls — Call history
```

## Bot Interaction Models

### Model 1: Interactive DM (Monitor Bot)

```
User ──/watch 0x... ──→ Bot
User ←── "Watching wallet 0x..." ──── Bot
         ... time passes ...
User ←── "🔔 Fee Claimed! 2.5 SOL" ── Bot (triggered by on-chain event)
```

### Model 2: Channel Broadcast (Monitor Bot)

```
                    ┌── Channel (read-only)
On-chain event ──→ Bot ──→ "🚀 New Token: $PUMP"
                         "🎓 Graduated: $MOON"
                         "🐋 Whale Buy: 500 SOL"
```

### Model 3: Group Tracker (Tracker Bot)

```
Group Member ── pastes CA ──→ Bot
Bot ──→ "📞 Call registered! Tracking..."
         ... time passes ... (ATH tracker polls)
Group Member ── /leaderboard ──→ Bot
Bot ──→ "🏆 Top Calls (7d):
         1. @alice — 15.2x $PUMP
         2. @bob — 8.7x $MOON"
```

## Solana Program Integration

PumpKit monitors 3 on-chain programs:

| Program | ID | Events Monitored |
|---------|-----|-------------------|
| **Pump** | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Create, Buy, Sell, Complete (graduation) |
| **PumpAMM** | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Swap, CreatePool, Deposit, Withdraw |
| **PumpFees** | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | ClaimFees, DistributeFees |

### Event Detection Method

```typescript
// WebSocket — subscribe to program logs
connection.onLogs(PUMP_PROGRAM_ID, (logs) => {
  const events = decodePumpLogs(logs);
  events.forEach(event => eventBus.emit(event.type, event));
});

// HTTP Polling — fallback for missed events
const sigs = await connection.getSignaturesForAddress(PUMP_PROGRAM_ID, { limit: 50 });
for (const sig of sigs) {
  const tx = await connection.getParsedTransaction(sig.signature);
  const events = parsePumpTransaction(tx);
  // ... deduplicate and process
}
```

## Storage Architecture

### File-Based (Monitor Bot)

Simple JSON persistence for watch lists and settings. Survives restarts, no dependencies.

```
data/
├── watches.json       [{ wallet, chatId, addedAt }]
├── launches.json      [{ mint, name, symbol, detectedAt }]
└── claims.json        [{ signature, processed: true }]
```

### SQLite (Tracker Bot)

Relational storage for leaderboards, call history, group settings.

```sql
-- Core tables
CREATE TABLE users (id, telegram_id, username, points, win_rate, rank);
CREATE TABLE groups (id, telegram_id, name, settings_json, hardcore_mode);
CREATE TABLE calls (id, user_id, group_id, token_ca, chain, entry_price, ath_price, multiplier, created_at);
```

## Deployment Architecture

```
┌──────────── Railway ─────────────┐
│                                   │
│  ┌─────────────┐  ┌───────────┐  │
│  │ Monitor Bot  │  │ Tracker   │  │
│  │ (Node.js)   │  │ Bot       │  │
│  │             │  │ (Node.js) │  │
│  │ Port 3000   │  │ Port 3001 │  │
│  │ /health     │  │ /health   │  │
│  └──────┬──────┘  └─────┬─────┘  │
│         │               │         │
│    data/ (volume)  data/ (volume) │
│    watches.json    bot.sqlite     │
└──────────────────────────────────┘
         │                │
         └───── Telegram API ─────→ Users
         │
    ┌────▼─────┐
    │  Solana   │
    │  Mainnet  │
    │  (RPC)    │
    └──────────┘

┌──────── Vercel ────────┐
│  docs.pumpkit.dev      │
│  (VitePress / Starlight)│
└────────────────────────┘
```

## Configuration Model

Every PumpKit bot is configured via environment variables with typed defaults:

```bash
# Required
TELEGRAM_BOT_TOKEN=        # BotFather token
SOLANA_RPC_URL=            # Helius, QuickNode, etc.

# Optional — feature toggles
FEED_CLAIMS=true           # Enable/disable claim monitoring
FEED_LAUNCHES=true         # Enable/disable launch detection
FEED_GRADUATIONS=true      # Enable/disable graduation alerts
FEED_WHALES=true           # Enable/disable whale trade alerts
WHALE_THRESHOLD_SOL=100    # Minimum SOL for whale alert

# Optional — channel mode
CHANNEL_ID=                # Telegram channel ID for broadcast mode
BROADCAST_ONLY=false       # Disable DM commands, channel-only

# Optional — API
API_ENABLED=false          # Enable REST API
API_PORT=3000              # API server port
API_AUTH_TOKEN=            # Bearer token for API auth

# Optional — social integrations
TWITTER_BEARER_TOKEN=      # Twitter/X API v2 token
GITHUB_TOKEN=              # GitHub API token (social fees)
GROQ_API_KEY=              # Groq LLM for summaries (optional)
```

## Error Handling Strategy

```
Bot Error        → grammy error boundary → log + notify admin
RPC Error        → retry with backoff → rotate to fallback RPC
WebSocket Drop   → auto-reconnect with exponential backoff
Storage Error    → log + continue (non-fatal for monitors)
Telegram Error   → grammy retry middleware → rate limit backoff
```

## Security Boundaries

- No private keys handled by bots — read-only monitoring
- Telegram bot tokens stored in .env, never committed
- RPC URLs treated as secrets (rate-limited endpoints)
- API auth via Bearer token (optional, for REST endpoints)
- Rate limiting on both Telegram commands and API endpoints
- SQLite WAL mode for concurrent reads (tracker bot)
