# Tutorial 3: Channel Feed Bot

> Set up a read-only Telegram channel that broadcasts PumpFun fee claims with rich data cards.

## What's Different from the Monitor Bot?

| Feature | Monitor Bot | Channel Bot |
|---------|-------------|-------------|
| **Mode** | DM commands + channel posts | Channel-only feed (no commands) |
| **GitHub enrichment** | Basic | Full (profile, repos, X handle, followers) |
| **LLM summaries** | No | Optional (Groq-powered AI commentary) |
| **Social fee index** | Yes | Yes (bootstraps all SharingConfigs at startup) |
| **Multi-token PDA** | Picks highest MC | Shows all linked coins |
| **Fake claim detection** | Yes | Yes (with ⚠️ badge) |

## Setup

```bash
cd pumpkit

# Configure channel bot
cp packages/channel/.env.example packages/channel/.env
```

Edit `.env`:

```bash
# Required
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHANNEL_ID=-1001234567890
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key

# Optional: real-time WebSocket (recommended)
SOLANA_WS_URL=wss://mainnet.helius-rpc.com/?api-key=your-key

# Optional: GitHub API (higher rate limits)
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Optional: AI summaries
GROQ_API_KEY=gsk_xxxxxxxxxxxx

# Optional: referral links
AXIOM_REF=your_ref
GMGN_REF=your_ref
PADRE_REF=your_ref
```

Run:

```bash
npm run dev --workspace=@pumpkit/channel
```

## Architecture

```
Solana WebSocket
    │
    ├── PumpFees program logs
    ├── Pump program logs
    └── PumpAMM program logs
    │
    ▼
ClaimMonitor
    │
    ├── Decode instruction discriminators
    ├── Match to claim types
    ├── Parse event data from CPI logs
    ├── Resolve mint via SocialFeeIndex
    │
    ▼
Enrichment Pipeline (3 waves)
    │
    ├── Wave 1: GitHub user, token info, SOL/USD price
    ├── Wave 2: X profile, repo info, creator profile, holders, trades, liquidity, bundles
    └── Wave 3: Dev wallet (RPC balance check)
    │
    ▼
Formatter → Telegram Channel
```

## Enrichment Data Sources

| Data | API | Rate Limit |
|------|-----|------------|
| GitHub user profile | `api.github.com/user/{id}` | 60/hr (unauthenticated), 5000/hr (token) |
| GitHub repo info | `api.github.com/repos/{owner}/{repo}` | Same |
| X/Twitter profile | `api.x.com` or scraping | Varies |
| Token info | `frontend-api-v3.pump.fun` | ~100/min |
| Creator profile | `frontend-api-v3.pump.fun/users` | ~100/min |
| Token holders | `frontend-api-v3.pump.fun/balances` | ~100/min |
| SOL/USD price | CoinGecko / Jupiter | Generous |
| Pool liquidity | DexScreener API | ~300/min |
| Bundle detection | Trench API | Varies |
| Dev wallet balance | Solana RPC | RPC-dependent |

## Social Fee Index

The channel bot maintains a `SocialFeeIndex` that maps social fee PDA addresses → token mints. This is critical because:

1. The `claim_social_fee_pda` instruction doesn't include the mint
2. The social fee PDA is derived from `["social-fee-pda", user_id, platform]` — **no mint in seeds**
3. One PDA can be a shareholder in MANY SharingConfigs (one per token)

The index bootstraps by fetching all `SharingConfig` accounts via `getProgramAccounts`, then updates live from `CreateFeeSharingConfigEvent` logs.

When a PDA maps to multiple tokens, the bot fetches token info for all candidates and picks the highest market cap as the primary display, while showing all linked coins in a separate section.

## Deployment

See [Deployment Guide](../docs/deployment.md) for Railway/Docker instructions.

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json turbo.json ./
COPY packages/core/package.json packages/core/
COPY packages/channel/package.json packages/channel/
RUN npm ci --omit=dev
COPY packages/core/ packages/core/
COPY packages/channel/ packages/channel/
RUN npm run build --workspace=@pumpkit/channel
CMD ["node", "packages/channel/dist/index.js"]
```
