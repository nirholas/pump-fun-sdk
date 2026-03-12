# Monitor Bot — Feature Specification

> `@pumpkit/monitor` — All-in-one PumpFun monitoring bot for Telegram.

## Overview

The Monitor Bot consolidates 3 existing production bots into one:

| Source Bot | Features Absorbed |
|-----------|-------------------|
| **telegram-bot** (19 files) | DM commands, REST API, SSE, webhooks, fee claims, CTO alerts, whale trades, graduations, launches, fee distributions |
| **channel-bot** (16 files) | Channel broadcast mode, GitHub social fees, Groq LLM summaries, X/Twitter integration, RPC fallback |
| **claim-bot** (10 files) | WebSocket relay client, Twitter follower tracking, token/handle tracking |

**Total source files merged: 45 → target ~20 (with shared code in @pumpkit/core)**

## Interaction Modes

The Monitor Bot operates in 3 modes depending on configuration:

### Mode 1: Interactive DM

User sends commands to the bot in a private chat. Bot responds with information and sends real-time alerts.

```
User: /watch 7xKXt...
Bot: ✅ Watching wallet 7xKXt... for fee claims.

(later, triggered by on-chain event)
Bot: 🔔 Fee Claimed!
     Wallet: 7xKXt...
     Amount: 2.5 SOL
     Token: $PUMP (PumpCoin)
     🔗 Solscan | pump.fun
```

### Mode 2: Channel Broadcast

Bot posts to a read-only Telegram channel. No user interaction. All feeds configurable.

```
Channel: PumpFun Activity
Bot: 🚀 New Token Launch
     Name: PumpCoin ($PUMP)
     Creator: 4xBn...
     Mayhem Mode: ❌
     Cashback: ✅
     🔗 pump.fun | Solscan

Bot: 🎓 Token Graduated!
     $MOON migrated to PumpAMM
     Final mcap: 69,000 SOL
     Pool: pAMM...
     🔗 Pool | Solscan

Bot: 🐋 Whale Buy
     500 SOL → $DEGEN
     Buyer: 9xFz...
     Progress: ████████░░ 82%
     🔗 Solscan TX
```

### Mode 3: Group Chat

Bot is added to a group. Members can use commands and receive alerts.

```
Group Member: /watch 7xKXt...
Bot: ✅ This group will be notified about 7xKXt... fee claims.
```

## Commands

### User Commands

| Command | Description | Modes |
|---------|-------------|-------|
| `/start` | Welcome message + quick start | DM, Group |
| `/help` | Full command reference | DM, Group |
| `/watch <wallet>` | Track a wallet for fee claims | DM, Group |
| `/unwatch <wallet>` | Stop tracking a wallet | DM, Group |
| `/add <CA or @handle>` | Track a token or X account (from claim-bot) | DM, Group |
| `/remove <CA or @handle>` | Stop tracking | DM, Group |
| `/list` | Show all tracked items | DM, Group |
| `/status` | Monitor status + stats | DM, Group |
| `/price <CA>` | Current token price | DM, Group |
| `/quote <CA> <amount>` | Buy/sell quote | DM, Group |
| `/fees <CA>` | Fee info for a token | DM, Group |
| `/alerts [on/off]` | Toggle alert types | DM, Group |

### Admin Commands

| Command | Description |
|---------|-------------|
| `/monitor [start/stop]` | Start/stop event monitoring |
| `/broadcast <message>` | Send message to all watchers |

## Alert Types (Feeds)

Each feed can be independently enabled/disabled via environment variables:

| Feed | Env Var | Default | Description |
|------|---------|---------|-------------|
| Fee Claims | `FEED_CLAIMS` | `true` | Creator fee claim events |
| Token Launches | `FEED_LAUNCHES` | `true` | New token creations |
| Graduations | `FEED_GRADUATIONS` | `true` | Bonding curve completions |
| Whale Trades | `FEED_WHALES` | `true` | Large trades above threshold |
| CTO Alerts | `FEED_CTO` | `true` | Creator Takeover events |
| Fee Distributions | `FEED_FEE_DISTRIBUTIONS` | `true` | Fee sharing payouts |

## REST API (Optional)

Enabled via `API_ENABLED=true`. All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check + uptime |
| `GET` | `/status` | Monitor status + event counts |
| `GET` | `/watches` | List all active watches |
| `POST` | `/watches` | Add a watch `{ wallet, chatId }` |
| `DELETE` | `/watches/:wallet` | Remove a watch |
| `GET` | `/claims` | Recent claim events |
| `GET` | `/launches` | Recent launches |
| `GET` | `/stream` | SSE event stream |
| `POST` | `/webhooks` | Register webhook URL |
| `DELETE` | `/webhooks/:id` | Remove webhook |

## Social Integrations

### Twitter/X (from claim-bot + channel-bot)

- Track tokens by X handle: `/add @pumpfun_creator`
- Display follower count in notifications
- Flag influencer follows (configurable influencer list)

### GitHub Social Fees (from channel-bot)

- Look up social fee PDAs via GitHub API
- Display in claim notifications

### Groq LLM Summaries (from channel-bot)

- Optional AI-generated token description summaries
- Enabled via `GROQ_API_KEY` env var

## Configuration

```bash
# Required
TELEGRAM_BOT_TOKEN=          # BotFather token
SOLANA_RPC_URL=              # Primary RPC endpoint

# Mode selection
CHANNEL_ID=                  # Channel ID for broadcast mode (leave empty for DM mode)
BROADCAST_ONLY=false         # If true, disable DM commands

# RPC
SOLANA_RPC_URLS=             # Comma-separated fallback RPCs
RPC_WS_URL=                  # WebSocket URL (auto-derived from HTTP if not set)

# Feed toggles
FEED_CLAIMS=true
FEED_LAUNCHES=true
FEED_GRADUATIONS=true
FEED_WHALES=true
FEED_CTO=true
FEED_FEE_DISTRIBUTIONS=true

# Thresholds
WHALE_THRESHOLD_SOL=100      # Min SOL for whale alert

# API (optional)
API_ENABLED=false
API_PORT=3000
API_AUTH_TOKEN=              # Bearer token

# Social (optional)
TWITTER_BEARER_TOKEN=
GITHUB_TOKEN=
GROQ_API_KEY=

# Admin
ADMIN_CHAT_IDS=              # Comma-separated Telegram chat IDs
LOG_LEVEL=info               # debug|info|warn|error
```

## File Structure

```
packages/monitor/
├── package.json
├── tsconfig.json
├── Dockerfile
├── railway.json
├── .env.example
└── src/
    ├── index.ts               Entry point: config → monitors → bot → api
    ├── bot.ts                 Grammy bot + command handlers
    ├── config.ts              Typed config loader
    ├── types.ts               Monitor-specific types
    │
    ├── monitors/
    │   ├── index.ts           Monitor manager (start/stop all)
    │   ├── claims.ts          Fee claim monitor
    │   ├── launches.ts        Token launch monitor  
    │   ├── graduations.ts     Graduation monitor
    │   ├── whales.ts          Whale trade monitor
    │   ├── cto.ts             Creator takeover monitor
    │   └── distributions.ts   Fee distribution monitor
    │
    ├── integrations/
    │   ├── twitter.ts         X/Twitter client
    │   ├── github.ts          GitHub social fees
    │   └── groq.ts            LLM summaries
    │
    └── api/
        ├── server.ts          Express HTTP server
        ├── sse.ts             Server-Sent Events
        └── webhooks.ts        Outbound webhooks
```

## Migration Plan

### From telegram-bot
- Core bot logic → `src/bot.ts`
- Monitor → `src/monitors/claims.ts` + others
- Pump client → `@pumpkit/core/solana`
- API layer → `src/api/`
- Formatters → `@pumpkit/core/formatter`
- Store → `@pumpkit/core/storage`
- Logger → `@pumpkit/core/logger`

### From channel-bot
- Event monitor → `src/monitors/` (merge with telegram-bot monitors)
- Claim monitor + tracker → `src/monitors/claims.ts`
- GitHub client → `src/integrations/github.ts`
- X client → `src/integrations/twitter.ts`
- Groq client → `src/integrations/groq.ts`
- RPC fallback → `@pumpkit/core/solana/rpc.ts`
- Health → `@pumpkit/core/health`

### From claim-bot
- WebSocket relay client → `src/monitors/claims.ts` (as alternative transport)
- Twitter client → `src/integrations/twitter.ts` (merge)
- Token/handle tracking → `src/bot.ts` (`/add`, `/remove` commands)
- Store → `@pumpkit/core/storage`
