# Set Up a PumpFun Channel Feed

> Configure a read-only Telegram channel that broadcasts token launches, graduations, whale trades, and fee claims from PumpFun.

## What You'll Build

A one-way broadcast channel that automatically posts rich data cards whenever interesting events happen on the Pump protocol. No user interaction needed — it's a firehose of on-chain activity straight to your Telegram channel.

```
Solana RPC (WebSocket)
    │
    ├── Token launches       → 🚀 Launch card
    ├── Graduations          → 🎓 Graduation card
    ├── Whale trades (>10 SOL) → 🐋 Whale alert
    ├── Fee claims           → 💰 Claim card
    └── Fee distributions    → 📤 Distribution card
    │
    ▼
Your Telegram Channel
```

## Prerequisites

- Node.js 20+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A Telegram **channel** (not group) where your bot is an **admin**
- A Solana RPC URL with WebSocket support (recommended: [Helius](https://helius.dev))

## Step 1: Create a Telegram Channel

1. Open Telegram → New Channel → name it (e.g., "PumpFun Feed")
2. Set it to **Public** or **Private** (your choice)
3. Add your bot as an **admin** with "Post Messages" permission

> **Get the Channel ID**: Forward any message from your channel to [@userinfobot](https://t.me/userinfobot). It will reply with the channel ID (starts with `-100`).

## Step 2: Clone & Install PumpKit

```bash
git clone https://github.com/nirholas/pumpkit.git
cd pumpkit
npm install
```

## Step 3: Configure Environment

```bash
cp packages/channel/.env.example packages/channel/.env
```

Edit `packages/channel/.env`:

```bash
# ── Required ──────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
CHANNEL_ID=-1001234567890
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key

# ── Optional: WebSocket for real-time events ──────────────
SOLANA_WS_URL=wss://mainnet.helius-rpc.com/?api-key=your-key

# ── Feed toggles (true/false) ────────────────────────────
FEED_CLAIMS=true
FEED_LAUNCHES=true
FEED_GRADUATIONS=true
FEED_WHALES=true
FEED_FEE_DISTRIBUTIONS=false

# ── Filters ──────────────────────────────────────────────
WHALE_THRESHOLD_SOL=10
REQUIRE_GITHUB=false

# ── Optional: RPC fallback list ──────────────────────────
# SOLANA_RPC_URLS=https://rpc1.example.com,https://rpc2.example.com

# ── Optional: affiliate links ───────────────────────────
# AXIOM_REF=your_ref
# GMGN_REF=your_ref

# ── Optional: AI summaries ──────────────────────────────
# GROQ_API_KEY=gsk_xxxxxxxxxxxx

# ── Logging ──────────────────────────────────────────────
LOG_LEVEL=info
POLL_INTERVAL_SECONDS=5
```

## Step 4: Run the Channel Bot

```bash
npm run dev --workspace=@pumpkit/channel
```

Expected output:

```
[INFO] Channel bot starting...
[INFO] Connected to Solana RPC
[INFO] Feeds enabled: claims, launches, graduations, whales
[INFO] Broadcasting to channel: -1001234567890
[INFO] Monitoring started
```

## Step 5: Enable / Disable Specific Feeds

Each feed type can be independently toggled. The most common configurations:

### Launches Only (New Token Alert Channel)

```bash
FEED_CLAIMS=false
FEED_LAUNCHES=true
FEED_GRADUATIONS=false
FEED_WHALES=false
FEED_FEE_DISTRIBUTIONS=false
```

### Whale Alerts Only

```bash
FEED_CLAIMS=false
FEED_LAUNCHES=false
FEED_GRADUATIONS=false
FEED_WHALES=true
FEED_FEE_DISTRIBUTIONS=false
WHALE_THRESHOLD_SOL=50
```

### Everything (Firehose Mode)

```bash
FEED_CLAIMS=true
FEED_LAUNCHES=true
FEED_GRADUATIONS=true
FEED_WHALES=true
FEED_FEE_DISTRIBUTIONS=true
WHALE_THRESHOLD_SOL=5
```

> ⚠️ Firehose mode generates a **lot** of messages. Telegram rate-limits bots to ~30 messages/sec. For high-volume feeds, increase `WHALE_THRESHOLD_SOL` or disable some feeds.

## Step 6: Customize the Whale Threshold

The `WHALE_THRESHOLD_SOL` setting controls the minimum trade size that triggers a whale alert:

| Value | Effect |
|-------|--------|
| `5` | Very noisy — catches most medium trades |
| `10` | Default — significant trades only |
| `50` | Quiet — only major whale moves |
| `100` | Very quiet — only the biggest trades |

```bash
# Only alert on trades ≥ 25 SOL
WHALE_THRESHOLD_SOL=25
```

## Step 7: Filter by GitHub Identity

If you only want to see claims from creators who have verified GitHub profiles:

```bash
REQUIRE_GITHUB=true
```

This filters out anonymous claims and only broadcasts claims where the token creator has a linked GitHub identity via PumpFun's social fee system.

## Architecture

```
┌─────────────────────────────────────────────┐
│              Channel Bot                     │
│                                              │
│  config.ts ─── loadConfig()                  │
│      │                                       │
│      ▼                                       │
│  event-monitor.ts ─── WebSocket subscription │
│      │                                       │
│      ├── LaunchMonitor (Pump program)        │
│      ├── GraduationMonitor (Pump program)    │
│      ├── WhaleMonitor (Pump/AMM programs)    │
│      ├── ClaimMonitor (PumpFees program)     │
│      └── FeeDistMonitor (PumpFees program)   │
│      │                                       │
│      ▼                                       │
│  formatters.ts ─── HTML card builder         │
│      │                                       │
│      ▼                                       │
│  social-fee-index.ts ─── GitHub enrichment   │
│      │                                       │
│      ▼                                       │
│  Telegram Bot API ─── channel.sendMessage()  │
└─────────────────────────────────────────────┘
```

### Key Differences from the Monitor Bot

| Feature | Monitor Bot (`@pumpkit/monitor`) | Channel Bot (`@pumpkit/channel`) |
|---------|----------------------------------|----------------------------------|
| Mode | Interactive DM + channel | Channel-only (no commands) |
| Users | Individuals subscribe | Everyone in the channel sees everything |
| GitHub enrichment | Basic | Full profile, repos, followers, X handle |
| AI commentary | No | Optional (Groq-powered LLM summaries) |
| REST API | Yes | No |
| Webhooks | Yes | No |

## Step 8: Deploy to Railway

Once you're happy with local testing, deploy to Railway for 24/7 uptime:

```bash
cd packages/channel
railway login
railway init
railway up
```

Set environment variables in the Railway dashboard (same as your `.env` file).

See [05 — Deploy to Railway](05-deploy-railway.md) for detailed deployment instructions.

## Common Issues

| Issue | Fix |
|-------|-----|
| `Bot is not a member of the channel` | Add bot as admin in channel settings → Administrators |
| `Chat not found` | Verify `CHANNEL_ID` starts with `-100`. Use [@userinfobot](https://t.me/userinfobot) to confirm |
| Messages arrive slowly | Switch from polling to WebSocket by setting `SOLANA_WS_URL` |
| Too many messages | Increase `WHALE_THRESHOLD_SOL`, disable some feeds, or set `REQUIRE_GITHUB=true` |
| `Rate limit exceeded` | Telegram limits to 30 msg/sec. Reduce enabled feeds or increase thresholds |

## Next Steps

- [03 — Custom Monitors](03-custom-monitors.md): Build your own event monitors beyond the built-in ones
- [04 — Group Tracker](04-group-tracker.md): Set up call tracking in a Telegram group
- [06 — Webhooks & API](06-add-webhooks-api.md): Stream events to your own backend
