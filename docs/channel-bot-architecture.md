# Channel Bot Architecture

Deep dive into the `@pumpfunclaims` channel bot — how it detects on-chain events, tracks claims, and formats messages.

> **Source:** `channel-bot/src/`
> **Channel:** [@pumpfunclaims](https://t.me/pumpfunclaims)
> **Purpose:** Read-only broadcast of PumpFun first fee claims by GitHub-assigned developers

---

## Overview

The channel bot is a **one-way feed** — it monitors Solana for PumpFun events and posts formatted messages to a Telegram channel. No interactive commands, no user input. It runs as a single long-lived process.

### What It Tracks

The bot is specifically focused on **first fee claims** — when a developer assigned to a PumpFun token claims their creator fees for the very first time. This is a signal that the developer is active and engaged with their token.

**Detection criteria:**
1. A fee claim transaction is detected on the Pump or PumpAMM program
2. The claim tracker confirms this is the **first ever claim** on that specific token
3. Only then is a message broadcast to the channel

---

## Data Flow

```
Solana RPC (WebSocket)  ──► Event Monitor ──► Claim Tracker ──► Formatter ──► Telegram API
                                │                                     │
                                ▼                                     ▼
                          PumpFun API ◄────────────────────── Token + Creator Data
                          (metadata,                         (holders, trades,
                           profiles)                          GitHub URLs, SOL price)
```

### Step-by-Step

1. **Event Monitor** (`event-monitor.ts`) subscribes to Solana program logs via WebSocket (with HTTP polling fallback)
2. When a fee claim transaction is detected, it extracts the claim event data
3. **Claim Tracker** (`claim-tracker.ts`) checks if this is the first claim on this token — if not, the event is dropped
4. **Pump Client** (`pump-client.ts`) fetches enrichment data in parallel:
   - Token info (name, symbol, image, price, socials, description)
   - Creator profile (launch count, followers, socials, recent coins)
   - Token holders (count from PumpFun API)
   - Recent trades (volume and count)
   - SOL/USD price (from Jupiter, cached 60s)
   - GitHub URLs (extracted from token description and socials)
   - Bonding curve progress (calculated from reserves)
5. **Formatter** (`formatters.ts`) builds a compact, emoji-dense message with all data
6. If the token has an image, the message is sent as a **photo with caption** via Telegram's `sendPhoto` API; otherwise falls back to `sendMessage`

---

## Key Components

### Claim Tracker (`claim-tracker.ts`)

Tracks claim history per wallet+token pair with LRU eviction:

```typescript
interface ClaimRecord {
  claimCount: number;           // Total claims by this wallet for this token
  totalClaimedSol: number;      // Cumulative SOL claimed
  firstClaimTimestamp: number;  // Unix seconds
  lastClaimTimestamp: number;   // Unix seconds
}
```

**Key methods:**
| Method | Purpose |
|--------|---------|
| `recordClaim(wallet, mint, sol)` | Record a claim and return the updated record |
| `getClaimRecord(wallet, mint)` | Look up claim history |
| `isFirstClaimOnToken(mint)` | Check if any wallet has ever claimed on this token |
| `getTrackedCount()` | Number of tracked wallet+token pairs |

**Capacity:** 50,000 entries with LRU eviction (oldest entries dropped when full).

### Pump Client (`pump-client.ts`)

API wrapper for PumpFun data and external services:

| Function | Source | Cache |
|----------|--------|-------|
| `fetchTokenInfo(mint)` | PumpFun API | None |
| `fetchCreatorProfile(address)` | PumpFun API | None |
| `fetchTokenHolders(mint)` | PumpFun API | None |
| `fetchTokenTrades(mint)` | PumpFun API | None |
| `fetchSolUsdPrice()` | Jupiter API | 60s |
| `extractGithubUrls(text)` | Local parsing | N/A |

**Token info includes:**
- Name, symbol, mint address
- Price in SOL, market cap, graduated status
- Image URI, description
- Social links (Twitter, Telegram, website)
- Creator address, launch timestamp
- GitHub URLs (extracted from description)
- Bonding curve progress (% from virtual reserves)

### Event Monitor (`event-monitor.ts`)

Dual-mode event detection:

| Mode | Method | Latency | Reliability |
|------|--------|---------|-------------|
| WebSocket | `connection.onLogs(PUMP_PROGRAM_ID)` | < 2s | May disconnect |
| HTTP Polling | `getSignaturesForAddress` + `getTransaction` | 5-10s | Reliable fallback |

The monitor auto-falls back to polling if WebSocket disconnects, and reconnects WebSocket when available.

### Formatters (`formatters.ts`)

Builds compact Telegram messages with HTML formatting. Returns `{ imageUrl, caption }` for photo messages.

**Message structure:**
```
🆕 FIRST FEE CLAIM

🪙 TokenName $SYMBOL
💰 0.00021 SOL ⋅ $0.032
💎 Mcap: 21.6K ⋅ Curve: 45%
📊 Vol: 18K ⋅ 👥 285 ⋅ Age: 2d
🐙 github.com/dev/project

📅 Launched: 2h ago
👤 Creator: BYsXqJ…Vwmu (self-claim)
   50 launches ⋅ 🎓 3 graduated ⋅ 49 followers
   Recent: Token1 ⭐, Token2, Token3

💰 0.0154 SOL ($2.31) claimed
⏱ 2h after launch

🔗 TX ⋅ Wallet ⋅ Pump ⋅ DEX
📝 "Token description truncated..."
🕐 2026-03-06 03:42:13 UTC
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | Bot token from BotFather |
| `TELEGRAM_CHANNEL_ID` | ✅ | — | Channel to post to |
| `SOLANA_RPC_URL` | ✅ | — | RPC endpoint |
| `SOLANA_WS_URL` | ⬜ | Derived from RPC | WebSocket endpoint |
| `FEED_CLAIMS` | ⬜ | `true` | Enable fee claim feed |
| `FEED_LAUNCHES` | ⬜ | `true` | Enable token launch feed |
| `FEED_GRADUATIONS` | ⬜ | `true` | Enable graduation feed |
| `FEED_WHALES` | ⬜ | `true` | Enable whale trade feed |
| `FEED_FEE_DISTRIBUTIONS` | ⬜ | `true` | Enable distribution feed |

### Current Channel Focus

For the `@pumpfunclaims` channel, the primary focus is **first fee claims only**. Other feeds can be enabled for testing or branched into separate channels.

---

## Deployment

See [Deployment Guide](./deployment.md#channel-bot) for Docker and Railway instructions.

### Quick Start

```bash
cd channel-bot
cp .env.example .env
# Edit .env with your tokens and RPC URL
npm install
npm run dev
```

---

## Extending

### Adding a New Feed Type

1. Create a new monitor function in `event-monitor.ts`
2. Add a new `FEED_*` environment variable in `config.ts`
3. Create a formatter in `formatters.ts`
4. Wire it into the event processing pipeline in `index.ts`

### Branching to Multiple Channels

To post different feeds to different channels:

1. Add multiple `TELEGRAM_CHANNEL_ID_*` env vars
2. Route events by type to the appropriate channel
3. Each feed type → its own channel for clean separation
