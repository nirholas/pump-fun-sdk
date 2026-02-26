# PumpFun Fee Claim Telegram Bot

A standalone Telegram bot that monitors **PumpFun** on Solana and sends you real-time notifications when **Creator Fees** or **Cashback Rewards** are claimed by watched wallets.

Works in personal DMs and group chats.

## Features

- **Watch wallets** — Track any fee-recipient Solana wallet
- **Creator Fees + Cashback Coins** — Detects both claim types
- **Real-time** — WebSocket mode for instant alerts (or HTTP polling fallback)
- **Group-ready** — Add to Telegram groups so your whole team gets notified
- **Persistent watches** — Saved to disk, survives restarts
- **Links** — Every notification includes Solscan TX link, wallet link, and pump.fun token link

## Quick Start

### 1. Create a Telegram bot

1. Open [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Optional: restrict to specific Telegram user IDs (comma-separated)
ALLOWED_USER_IDS=123456789

# Optional: use a dedicated RPC with WebSocket support for real-time monitoring
# SOLANA_WS_URL=wss://atlas-mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

> **Recommended:** Use a paid RPC provider (Helius, QuickNode, Triton) for reliable WebSocket connections and higher rate limits. The free Solana mainnet RPC can rate-limit you.

### 3. Install & Run

```bash
npm install
npm run dev      # Development (hot reload with tsx)
```

For production:

```bash
npm run build
npm start
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show all commands |
| `/watch <wallet> [label]` | Watch a fee-recipient wallet for claims |
| `/unwatch <wallet_or_#>` | Stop watching (by address or list number) |
| `/list` | Show all active watches for this chat |
| `/status` | Monitor status, uptime, claims detected |

## How It Works

```
┌─────────────────────────────────────────────────┐
│                  Solana Mainnet                  │
│                                                  │
│   PumpFun Program (6EF8r...F6P)                 │
│   ├── Creator Fee claims                        │
│   └── Cashback coin claims                      │
└──────────────────┬──────────────────────────────┘
                   │ WebSocket onLogs / HTTP polling
                   ▼
┌─────────────────────────────────────────────────┐
│            PumpFunMonitor                        │
│                                                  │
│   1. Detect PumpFun program transactions         │
│   2. Parse for fee-claim instruction patterns    │
│   3. Extract: claimer, amount, token, type       │
│   4. Match against watched wallets               │
└──────────────────┬──────────────────────────────┘
                   │ FeeClaimEvent
                   ▼
┌─────────────────────────────────────────────────┐
│            Telegram Notifications                │
│                                                  │
│   🏦 Creator Fee Claim Detected!                │
│   👤 Claimer: HN7c...4xYz (MyProject)          │
│   💰 Amount: 2.5000 SOL                         │
│   🔗 View TX · Wallet · pump.fun               │
└─────────────────────────────────────────────────┘
```

### Detection Strategies

The monitor uses three layered strategies to catch fee claims:

1. **Instruction discriminator matching** — Checks the first 8 bytes of PumpFun instruction data against known `claimCreatorFees` and `claimCashback` discriminators
2. **Inner instruction SOL transfers** — Detects SOL moving from PumpFun-owned accounts to external wallets via CPI
3. **Balance-change heuristic** — As a fallback, identifies accounts that gained SOL when PumpFun was invoked

## Example Notification

```
🏦 Creator Fee Claim Detected!

👤 Claimer: HN7c...4xYz (MyProject)
💰 Amount: 2.5000 SOL
🔗 Token Mint: pump...Dfn
🕐 Time: 2026-02-26 14:30:00 UTC

🔗 View TX · Wallet · pump.fun
```

For Cashback Coins:

```
💸 Cashback Claim Detected!

👤 Claimer: 9kBf...3mNp (Trader)
💰 Amount: 0.1500 SOL
🔗 Token Mint: cash...xyz
🕐 Time: 2026-02-26 14:32:00 UTC

🔗 View TX · Wallet · pump.fun
```

## Project Structure

```
pumpfun-telegram-bot/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
├── data/                  # Persisted watch data (auto-created)
│   └── watches.json
└── src/
    ├── index.ts           # Entry point — wires everything together
    ├── config.ts          # Environment variable loading
    ├── types.ts           # All type definitions & PumpFun constants
    ├── logger.ts          # Simple leveled logger
    ├── store.ts           # In-memory + disk-persisted watch store
    ├── monitor.ts         # Solana RPC monitor for PumpFun fee claims
    ├── bot.ts             # grammY Telegram bot & command handlers
    └── formatters.ts      # Rich HTML message formatting
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | Bot token from @BotFather |
| `SOLANA_RPC_URL` | — | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |
| `SOLANA_WS_URL` | — | Derived from RPC URL | WebSocket endpoint for real-time |
| `POLL_INTERVAL_SECONDS` | — | `15` | Polling interval (when WS unavailable) |
| `ALLOWED_USER_IDS` | — | (allow all) | Comma-separated Telegram user IDs |
| `LOG_LEVEL` | — | `info` | `debug`, `info`, `warn`, `error` |

## Adding to a Group Chat

1. Add your bot to the Telegram group
2. Anyone in the group can use `/watch` to add wallets
3. All group members will see claim notifications
4. Use `ALLOWED_USER_IDS` to restrict who can manage watches

## Tech Stack

- **[grammY](https://grammy.dev/)** — Telegram Bot framework for TypeScript
- **[@solana/web3.js](https://solana-labs.github.io/solana-web3.js/)** — Solana RPC client
- **TypeScript** — Full type safety
- **tsx** — Fast dev mode with hot reload

## License

MIT
