# Set Up Call Tracking in Your Group

> Create a tracker bot for your Telegram group that records token calls, tracks PNL, and manages a competitive leaderboard.

## What You'll Build

A group bot that detects when members paste Solana token contract addresses, records them as "calls," tracks profit/loss, and maintains a leaderboard with rankings. Members compete to find the best tokens.

```
Telegram Group
    │
    ├── User pastes token CA → Bot records as "call"
    ├── /leaderboard         → Rankings by win rate
    ├── /pnl <CA>            → Profit/loss for a token
    ├── /alpha <CA>          → Mark as "alpha" call
    ├── /gamble <CA>         → Mark as "gamble" call
    │
    ▼
SQLite DB — persistent call history + rankings
```

## Prerequisites

- Node.js 20+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A Telegram **group** (not channel) where your bot is a member
- A Solana RPC URL

## Step 1: Clone & Install PumpKit

```bash
git clone https://github.com/nirholas/pumpkit.git
cd pumpkit
npm install
```

## Step 2: Create the Bot with BotFather

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. **Important**: Send `/setprivacy` → select your bot → **Disable** (so it can read group messages)
4. Copy the bot token

## Step 3: Configure Environment

```bash
cp packages/tracker/.env.example packages/tracker/.env
```

Edit `packages/tracker/.env`:

```bash
# ── Required ──────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key

# ── Optional ──────────────────────────────────────────────
LOG_LEVEL=info
```

## Step 4: Add the Bot to Your Group

1. Open your Telegram group
2. Go to group settings → Add Members → search for your bot
3. Add it to the group
4. **Optional**: Make it an admin if you want it to pin messages

## Step 5: Run the Tracker

```bash
npm run dev --workspace=@pumpkit/tracker
```

Expected output:

```
[INFO] Tracker bot started: @YourTrackerBot
[INFO] SQLite database initialized
[INFO] Ready to track calls
```

## Step 6: Test the Commands

### Start the Bot

Send `/start` in your group:

```
👋 I'm a PumpFun call tracker!

Paste any Solana token CA and I'll track it.

Commands:
/leaderboard — Top callers
/last 10 — Recent 10 calls
/calls @user — User's call history
/winrate @user — Win rate stats
/alpha <CA> — Record an alpha call
/gamble <CA> — Record a gamble call
/pnl <CA> — Check token PNL
/rank — Your ranking
```

### Make a Call

Paste any Solana token contract address in the group chat:

```
EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

The bot responds:

```
📞 Call recorded!
Token: USDC
Price at call: $1.00
Type: auto
Called by: @username
```

### Manually Classify a Call

```
/alpha EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

Response:

```
🧠 Alpha call recorded!
Token: USDC
Price at call: $1.00
Called by: @username
```

```
/gamble EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

Response:

```
🎲 Gamble call recorded!
Token: USDC
Price at call: $1.00
Called by: @username
```

### Check Leaderboard

```
/leaderboard
```

Response:

```
🏆 Leaderboard (7d)

#1 @alice — 12 calls, 67% win rate, +340% avg
#2 @bob — 8 calls, 62% win rate, +180% avg
#3 @charlie — 15 calls, 40% win rate, +90% avg
```

### Check Individual Stats

```
/calls @alice
```

```
📊 @alice's Calls (last 30d)

1. BONK — +450% 🟢 (alpha)
2. WIF — +120% 🟢 (alpha)
3. MYRO — -80% 🔴 (gamble)
4. POPCAT — +900% 🟢 (alpha)
```

```
/winrate @alice
```

```
📈 @alice — Win Rate

7d:  75% (6/8)
30d: 67% (12/18)
All: 61% (22/36)
```

## Step 7: Configure Settings

The bot admin (the person who added it) can configure behavior with `/settings`:

```
/settings
```

```
⚙️ Tracker Settings

Call Mode: auto
  → auto: any pasted CA is recorded
  → button: bot asks "Alpha or Gamble?" via inline buttons

Display Mode: simple
  → simple: basic text cards
  → advanced: full PNL card with chart

Hardcore Mode: off
  → Hides losing calls from leaderboard

Leaderboard Timeframe: 7d
  → 24h / 7d / 30d / all
```

### Auto Mode vs Button Mode

**Auto mode** (default): Any Solana contract address pasted in the group is automatically recorded as a call.

**Button mode**: When someone pastes a CA, the bot shows inline buttons:

```
New token detected: BONK
[🧠 Alpha] [🎲 Gamble] [❌ Skip]
```

The caller picks one. There's a 30-second timeout — if no button is pressed, the call is discarded.

Switch modes:

```
/settings callmode button
```

### Enable Hardcore Mode

Hardcore mode hides all losing calls from the leaderboard. Only profitable calls count. This pushes the competition toward quality over quantity.

```
/hardcore
```

```
💀 Hardcore mode: ON
Only profitable calls will appear on the leaderboard.
```

Toggle it off:

```
/hardcore
```

```
😌 Hardcore mode: OFF
All calls are now visible.
```

## Step 8: Customize Leaderboard Timeframes

View leaderboard for different time periods:

```
/leaderboard 24h     # Last 24 hours
/leaderboard 7d      # Last 7 days (default)
/leaderboard 30d     # Last 30 days
/leaderboard all     # All time
```

## Step 9: Admin Commands

### Block/Unblock Users

Prevent spam callers:

```
/block @spammer
```

```
🚫 @spammer is blocked from making calls.
```

```
/unblock @spammer
```

```
✅ @spammer can make calls again.
```

### Wipe Leaderboard

Nuclear option — reset all call history:

```
/wipeleaderboard
```

```
⚠️ Are you sure? This deletes ALL call history.
Send /wipeleaderboard confirm to proceed.
```

```
/wipeleaderboard confirm
```

```
🗑️ Leaderboard wiped. Starting fresh.
```

## Architecture

```
┌─────────────────────────────────────────────┐
│              Tracker Bot                     │
│                                              │
│  bot.ts ─── Grammy bot + command handlers    │
│      │                                       │
│      ├── Auto-call detection (regex on CAs)  │
│      ├── /alpha, /gamble manual calls         │
│      ├── /leaderboard, /rank, /winrate        │
│      ├── /settings, /hardcore, /block         │
│      │                                       │
│      ▼                                       │
│  token-service.ts ─── Resolve token info     │
│      │                                       │
│      ├── Fetch token metadata (name, symbol) │
│      ├── Get current price from bonding curve│
│      └── Multi-chain resolution fallback     │
│      │                                       │
│      ▼                                       │
│  db.ts ─── SQLite storage                    │
│      │                                       │
│      ├── calls table (user, token, price,    │
│      │   type, timestamp)                    │
│      ├── Leaderboard aggregation queries     │
│      └── User stats (win rate, avg PNL)      │
│      │                                       │
│      ▼                                       │
│  pnl-card.ts ─── Canvas-rendered PNL cards   │
│      │                                       │
│      └── Visual trade cards (optional)       │
└─────────────────────────────────────────────┘
```

### Data Flow: Auto-Call Detection

```
1. User pastes "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" in group
2. Bot detects Solana address pattern (base58, 32-44 chars)
3. token-service.ts fetches token metadata + current price
4. db.ts inserts call record
5. Bot replies with call confirmation card
6. Later: /pnl compares current price to call-time price
```

## Common Issues

| Issue | Fix |
|-------|-----|
| Bot doesn't see messages | Set privacy to **Disabled** via BotFather's `/setprivacy` command |
| `Not a valid Solana address` | Ensure the pasted text is a valid base58 address (32-44 chars) |
| Token not found | The token may not be on PumpFun. The bot resolves via multiple sources |
| Leaderboard empty | Need at least one call first. Paste any token CA to get started |
| PNL shows 0% | Price may not have changed, or the token may have graduated (bonding curve → AMM) |

## Next Steps

- [05 — Deploy to Railway](05-deploy-railway.md): Ship your tracker bot to production with persistent SQLite storage
- [06 — Webhooks & API](06-add-webhooks-api.md): Expose call data via REST API
- [03 — Custom Monitors](03-custom-monitors.md): Add realtime alerts on top of call tracking
