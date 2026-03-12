# Tracker Bot — Feature Specification

> `@pumpkit/tracker` — Group call-tracking bot with leaderboards and PNL analytics.

## Overview

The Tracker Bot is adapted from **outsiders-bot** (11 files). It operates in Telegram groups where members paste token contract addresses, and the bot tracks performance, builds leaderboards, and generates PNL cards.

This is a fundamentally different interaction model from the Monitor Bot — it's social/competitive, driven by user submissions rather than on-chain events.

## Interaction Model

```
Group Chat: "Alpha Calls"
│
├── @alice pastes: EKpQGS...
│   Bot: 📞 Call registered by @alice
│        Token: $PUMP (PumpCoin)
│        Chain: Solana
│        Entry: $0.00012 | MC: $120K
│        ⏳ Tracking...
│
├── (ATH tracker polls every 60s)
│
├── @bob: /leaderboard
│   Bot: 🏆 Top Calls (7d)
│        1. @alice — 15.2x $PUMP ⭐⭐⭐⭐⭐
│        2. @charlie — 8.7x $MOON ⭐⭐⭐⭐
│        3. @bob — 3.1x $DEGEN ⭐⭐
│
├── @alice: /pnl
│   Bot: [Canvas-rendered PNL card image]
│        Entry: $0.00012 → ATH: $0.00182
│        Gain: +15.2x | Points: +5
│
└── @admin: /settings hardcore on 40
    Bot: ⚙️ Hardcore mode ON
         Min win rate: 40%
         Members below will be kicked.
```

## Features

### Call Tracking
- Paste a token CA, LP link, or chart URL → bot registers the call
- Auto-detect chain: Solana, Ethereum, Base, BSC
- Track entry price at time of call
- Poll ATH every 60 seconds via DexScreener

### Call Modes
- **Auto Mode** — Call registered automatically after 30-second confirmation window
- **Button Mode** — Manual confirm with alpha/gamble selection buttons

### Points System

| Multiplier | Points | Rating |
|-----------|--------|--------|
| < 1.5x | -1 | ❌ Miss |
| 1.5x - 2x | 0 | ➖ Break-even |
| 2x - 5x | +2 | ✅ Good |
| 5x - 15x | +3 | ⭐ Great |
| 15x - 30x | +4 | 🌟 Excellent |
| 30x+ | +5 | 💎 Legendary |

### Ranking System

| Rank | Title | Win Rate Required |
|------|-------|-------------------|
| 1 | Amateur | 0% |
| 2 | Novice | 20% |
| 3 | Contender | 35% |
| 4 | Guru | 50% |
| 5 | Oracle | 70% |

Win rate = percentage of calls hitting ≥ 2x multiplier.

### Leaderboards
- **Calls leaderboard** — Top calls by multiplier (24h / 7d / 30d / all)
- **Performance leaderboard** — Top users by points (24h / 7d / 30d / all)

### PNL Cards
- Canvas-rendered shareable images
- Shows: entry price, ATH, gain multiplier, points earned
- Branded with group name

### Hardcore Mode
- Admin-configurable minimum win rate
- Members below the threshold are auto-kicked
- Creates competitive pressure

### Admin Features
- `/block @user` — Block user from making calls
- `/unblock @user` — Unblock user
- `/settings` — Configure group settings
- Call forwarding to a dedicated channel

## Commands

### Group Commands

| Command | Description |
|---------|-------------|
| `/leaderboard [calls\|performance] [24h\|7d\|30d\|all]` | Show leaderboard |
| `/last` | Show last call in group |
| `/calls [@user]` | Call history for user |
| `/pnl [@user]` | PNL card image |
| `/rank [@user]` | User rank + stats |
| `/alpha` | Register current CA as alpha call |
| `/gamble` | Register current CA as gamble call |

### Admin Commands

| Command | Description |
|---------|-------------|
| `/settings` | View/modify group settings |
| `/settings hardcore [on\|off] [min_winrate]` | Toggle hardcore mode |
| `/settings channel [channel_id]` | Set call forwarding channel |
| `/settings mode [auto\|button]` | Set call registration mode |
| `/block @user` | Block user from calls |
| `/unblock @user` | Unblock user |

## Multi-Chain Support

| Chain | Token Resolution | Price Source |
|-------|-----------------|--------------|
| Solana | Native CA (base58) | DexScreener |
| Ethereum | 0x address | DexScreener |
| Base | 0x address | DexScreener |
| BSC | 0x address | DexScreener |

Chain is auto-detected from the contract address format or link domain.

## Database Schema (SQLite)

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  telegram_id TEXT UNIQUE NOT NULL,
  username TEXT,
  total_points INTEGER DEFAULT 0,
  total_calls INTEGER DEFAULT 0,
  winning_calls INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE groups (
  id INTEGER PRIMARY KEY,
  telegram_id TEXT UNIQUE NOT NULL,
  name TEXT,
  mode TEXT DEFAULT 'auto',        -- 'auto' | 'button'
  hardcore_mode INTEGER DEFAULT 0,
  min_win_rate INTEGER DEFAULT 40,
  call_channel_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE calls (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  group_id INTEGER NOT NULL REFERENCES groups(id),
  token_ca TEXT NOT NULL,
  chain TEXT NOT NULL,              -- 'solana' | 'ethereum' | 'base' | 'bsc'
  call_type TEXT DEFAULT 'alpha',   -- 'alpha' | 'gamble'
  entry_price REAL NOT NULL,
  entry_mcap REAL,
  ath_price REAL,
  ath_mcap REAL,
  multiplier REAL DEFAULT 1.0,
  points INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE blocked_users (
  group_id INTEGER NOT NULL REFERENCES groups(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  blocked_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
```

## Configuration

```bash
# Required
TELEGRAM_BOT_TOKEN=          # BotFather token

# Database
DB_PATH=data/tracker.sqlite  # SQLite file path

# ATH Tracking
ATH_POLL_INTERVAL=60000      # Poll interval in ms (default: 60s)
DEXSCREENER_API_URL=https://api.dexscreener.com  # Price API

# Health
HEALTH_PORT=3001             # Health check port

# Admin
LOG_LEVEL=info
```

## File Structure

```
packages/tracker/
├── package.json
├── tsconfig.json
├── Dockerfile
├── railway.json
├── .env.example
└── src/
    ├── index.ts             Entry point: config → db → bot → ath tracker
    ├── bot.ts               Grammy bot + command handlers
    ├── config.ts            Typed config loader
    ├── types.ts             Call types, rank system, points
    ├── db.ts                SQLite database (users, groups, calls, leaderboards)
    ├── token-service.ts     DexScreener API client (price, mcap)
    ├── ath-tracker.ts       Polls active calls for ATH updates
    ├── pnl-card.ts          Canvas PNL card generator
    └── formatters.ts        Leaderboard, stats, PNL formatting
```

## Migration from outsiders-bot

| outsiders-bot file | → tracker-bot location | Changes |
|-------------------|----------------------|---------|
| `index.ts` | `src/index.ts` | Use `@pumpkit/core` config + health |
| `bot.ts` | `src/bot.ts` | Use `@pumpkit/core` createBot |
| `config.ts` | `src/config.ts` | Use `@pumpkit/core` loadConfig |
| `types.ts` | `src/types.ts` | Minor cleanup |
| `db.ts` | `src/db.ts` | Keep as-is (SQLite logic is specialized) |
| `token-service.ts` | `src/token-service.ts` | Keep as-is |
| `ath-tracker.ts` | `src/ath-tracker.ts` | Keep as-is |
| `pnl-card.ts` | `src/pnl-card.ts` | Keep as-is |
| `formatters.ts` | `src/formatters.ts` | Use `@pumpkit/core` link helpers |
| `health.ts` | **Remove** → `@pumpkit/core` | Shared health server |
| `logger.ts` | **Remove** → `@pumpkit/core` | Shared logger |
