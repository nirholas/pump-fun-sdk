# Tutorial 1: Your First Claim Bot

> Build a PumpFun fee claim monitor that posts to Telegram in under 10 minutes.

## What You'll Build

A Telegram bot that monitors the Pump protocol for fee claims (social fees, creator fees, cashback) and posts formatted cards to a channel or DM.

## Prerequisites

- Node.js 20+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A Solana RPC URL (free: [Helius](https://helius.dev), [QuickNode](https://quicknode.com))
- A Telegram channel where your bot is an admin (optional — can use DMs instead)

## Step 1: Clone & Install

```bash
git clone https://github.com/nirholas/pumpkit.git
cd pumpkit
npm install
```

## Step 2: Configure Environment

```bash
cp packages/monitor/.env.example packages/monitor/.env
```

Edit `.env`:

```bash
# Required
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key

# Optional: post to a channel instead of DM
TELEGRAM_CHANNEL_ID=-1001234567890

# Optional: WebSocket for real-time (faster than polling)
SOLANA_WS_URL=wss://mainnet.helius-rpc.com/?api-key=your-key
```

## Step 3: Run

```bash
npm run dev --workspace=@pumpkit/monitor
```

You should see:

```
[INFO] Bot started: @YourBotName
[INFO] Claim monitor: monitoring 3 programs
[INFO] SocialFeeIndex: bootstrapped 1,247 mappings from 312 SharingConfig accounts
```

## Step 4: Test It

Send `/start` to your bot on Telegram. You'll get a welcome message. Fee claims will start appearing as they happen on-chain.

## How It Works

```
Solana RPC (WebSocket)
    │
    ▼
ClaimMonitor — watches Pump, PumpAMM, PumpFees programs
    │
    ├── Detects claim instructions in transaction logs
    ├── Decodes event data (amount, user, token, lifetime)
    ├── Resolves token ↔ mint via SocialFeeIndex
    │
    ▼
Formatter — builds rich Telegram HTML card
    │
    ├── GitHub user profile
    ├── Token info (MC, price, status)
    ├── Claim stats (amount, lifetime total)
    ├── Creator profile + linked coins
    │
    ▼
Telegram Bot API — posts to channel/DM
```

### What Gets Monitored

| Claim Type | Program | Description |
|-----------|---------|-------------|
| `claim_social_fee_pda` | PumpFees | GitHub/social fee sharing claims |
| `collect_creator_fee` | Pump | Bonding curve creator fees |
| `collect_coin_creator_fee` | PumpAMM | AMM pool creator fees |
| `distribute_creator_fees` | PumpFees | Fee distribution to shareholders |
| `claim_cashback` | PumpFees | Volume-based cashback rewards |

### Claim Card Anatomy

Each claim generates a card like:

```
🔄 REPEAT CLAIM

BhhJg7ePbnvu4drQzttL3CdaJbMydVYn2fZ4RWFDpump

🐙 $TOKEN — Token Name
💰 MC: $12,345.67
💲 Price: 0.000145 SOL ($0.0123)
📈 Status: Graduated (AMM)

💸 Claim Stats
Claim #5
0.1234 SOL ($10.50)
Lifetime claims: 4.5678 SOL ($388.27)

👨‍💻 Linked Dev
username (Display Name)
📦 Repos: 42
👁 Followers: 1,234
```

## Next Steps

- [Tutorial 2: Customizing Claim Cards](./02-customizing-claim-cards.md) — change the layout, add your own data
- [Tutorial 3: Channel Feed Bot](./03-channel-feed-bot.md) — set up a read-only channel feed
- [Tutorial 4: Adding Trade Links](./04-adding-trade-links.md) — add Axiom/GMGN/Padre referral links
