# Graduation Message Fields Reference

This document describes all the information displayed in the enhanced graduation notification for PumpFun tokens that complete the bonding curve and migrate to AMM pools.

## Sample Output

```
🎓 TOKEN GRADUATED

💊 ⚡️⚡️ drpigeonwifmask  $DRMASK
CA: 9PC4GtUXhUkoTCfzqkNj5jd3BnTfGfDb8eNJrPpppump
     Bonding Curve: 45s
     Launched 2m ago

📈 Type: Bonding Curve Complete
     SOL Migrated: 85.50 SOL ($12,825)
     Migration Fee: 0.0200 SOL
     Pool: 5Qc7...nX2p
     Triggered by: 843VNw…jHBs

💹 Market Cap: $15.2K
     Price: 0.000152000 SOL
     ATH: $18.5K
     Holders: 342
     Recent Volume: 125.3 SOL (50 trades)
     Replies: 28
     👑 KotH: 15m ago

👤 Dev: 9wHk...xZ3f
     Name: devmaster
     Total Launches: 12
     Past Graduations: 3
     Best ATH: MoonCoin ($125K)

🔗 Socials: Website · 𝕏 @drmasktoken · Telegram · GitHub

🤖 Photon · BullX · Trojan · Banana · Maestro

🔍 TX · Pump.fun · Solscan · DexScreener
🕐 2026-03-06 10:23:45 UTC
```

## Field Breakdown

### Line 1: Header
- **🎓 TOKEN GRADUATED** — constant header

### Line 2: Token Identity
- **Launchpad emoji** — indicates which launchpad was used:
  - `💊` Pump.fun
  - `🐕` Bonk Launchpad
  - `®️` Raydium Launchpad
  - `👾` Boop Launchpad
  - `🍭` Sugar Launchpad
  - `🪽` Heaven Launchpad
  
- **Speed emoji** — indicates how quickly the token graduated:
  - `⚡️⚡️⚡️` Less than 30 seconds
  - `⚡️⚡️` Less than 1 minute
  - `⚡️` Less than 2 minutes
  - `💤` More than 3 days
  - (no emoji) Between 2 minutes and 3 days

- **Token name** — clickable link to Pump.fun token page
- **Ticker** — token symbol in monospace font (e.g., `$DRMASK`)

### Line 3: Contract Address
- **CA:** — full token mint address in monospace font

### Lines 4-5: Launch Timing
- **Bonding Curve:** — time spent from launch to graduation (e.g., `45s`, `2m`, `1h 23m`, `2d 5h`)
- **Launched** — relative time since token creation (e.g., `2m ago`, `1h ago`, `3d ago`)

### Lines 7-11: Migration Details
- **Type:** — either `Bonding Curve Complete` or `AMM Migration`
- **SOL Migrated:** — amount of SOL moved to the AMM pool, with USD value if available
- **Migration Fee:** — fee paid for the migration transaction (PumpSwap)
- **Pool:** — AMM pool address (clickable link to Solscan)
- **Triggered by:** — wallet that initiated the graduation (clickable link to Pump.fun profile)

### Lines 13-16: Market Information
- **Market Cap:** — current market capitalization in USD (e.g., `$15.2K`, `$1.5M`)
  - Falls back to SOL value if USD not available
- **Price:** — current price per token in SOL
- **ATH:** — all-time high market cap (only shown if > current market cap)
- **Holders:** — number of unique token holders at graduation time
- **Recent Volume:** — total SOL volume and number of recent trades (last 50)
- **Replies:** — number of community replies on the token page
- **👑 KotH:** — when the token hit King of the Hill (relative time)

### Lines 18-23: Developer Details
- **Dev:** — creator wallet address (clickable link to Pump.fun profile)
- **Name:** — PumpFun display username (if set)
- **Total Launches:** — number of tokens this dev has created
- **⚠️ Suspected Rugs:** — count of non-graduated tokens with near-zero market cap (only shown if > 0)
- **Past Graduations:** — number of previous tokens that graduated to AMM
- **Best ATH:** — name and peak market cap of dev's best-performing token (only shown if ATH > $1K)

### Line 25: Socials
- **Socials:** — links to all available social media and websites
  - Website
  - 𝕏 (Twitter/X) with handle
  - Telegram
  - GitHub

### Line 27: Trading Bot Quick Links
Direct links to open the token in popular Solana trading bots:
- **Photon** — Photon trading interface
- **BullX** — BullX Telegram bot
- **Trojan** — Trojan trading bot
- **Banana** — Banana Gun bot
- **Maestro** — Maestro trading bot

### Lines 29-30: Transaction Links & Timestamp
- **TX** — transaction signature on Solscan
- **Pump.fun** — token page on Pump.fun
- **Solscan** — token page on Solscan
- **DexScreener** — token chart on DexScreener
- **Timestamp** — UTC timestamp of graduation (e.g., `2026-03-06 10:23:45 UTC`)

## Data Sources

All data is fetched from:

1. **On-chain event data** — graduation transaction details (SOL amount, pool address, etc.)
2. **PumpFun API** — token metadata, market cap, price, socials
3. **PumpFun Creator API** — dev's launch history, username, profile
4. **DexScreener API** — fallback for token data if PumpFun API fails
5. **Solana RPC** — transaction signatures and account states

## Optional Fields

Fields that may not appear in every graduation message:

- Speed emoji (only if graduated <2min or >3 days)
- SOL Migrated (only for AMM migrations)
- Migration Fee (only for AMM migrations)
- Pool address (only for AMM migrations)
- Market Cap (if not available from API)
- Price (if token reserves are invalid)
- ATH (only if ATH > current market cap)
- Holders (only if holder count > 0 and data available)
- Recent Volume (only if recent trades exist)
- Replies (only if reply count > 0)
- KotH (only if token reached King of the Hill)
- Dev Name (only if set in PumpFun profile)
- Suspected Rugs (only if > 0)
- Past Graduations (only if dev has graduated tokens)
- Best ATH (only if > $1K)
- Socials (only fields that are populated)

## Configuration

Enable/disable graduation feed in `.env`:

```bash
FEED_GRADUATIONS=true
```

The bot will ignore graduated tokens if this is set to `false`.
