# Tutorial 39: Channel Bot — AI Summaries & GitHub Enrichment

> Add AI-powered claim analysis with Groq, GitHub repo metadata enrichment, first-claim detection, and rich HTML cards to your Telegram feed.

## Prerequisites

- Node.js 18+
- Groq API key (free at [console.groq.com](https://console.groq.com))
- GitHub personal access token (optional, for higher rate limits)
- Telegram bot token + channel

```bash
cd channel-bot && npm install
```

## Architecture

The channel bot enriches raw on-chain fee claims with intelligence:

```
Solana RPC ──► ClaimMonitor ──► Enrichment Pipeline ──► Telegram Channel
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              Groq AI          GitHub API     Claim Tracker
           (1-line take)    (repo + user)   (first-claim?)
                    │               │               │
                    └───────┬───────┘───────────────┘
                            ▼
                      Rich HTML Card
                    (formatted caption)
```

## Step 1: Groq AI Summaries

The Groq client generates a one-line AI analysis for each fee claim:

```typescript
import { generateClaimSummary, type ClaimSummaryInput } from "./groq-client";

const summary = await generateClaimSummary({
  // Token info
  tokenName: "PumpCoin",
  tokenSymbol: "PUMP",
  tokenDescription: "Community token for pump.fun",
  mcapUsd: 45000,
  graduated: false,
  curveProgress: 0.72,

  // Claim details
  claimAmountSol: 1.5,
  claimAmountUsd: 225,
  launchToClaimSeconds: 3600,
  isSelfClaim: true,

  // Creator stats
  creatorLaunches: 12,
  creatorGraduated: 3,
  creatorFollowers: 450,

  // Market data
  holderCount: 89,
  recentTradeCount: 234,

  // GitHub enrichment (null if no GitHub link)
  githubRepoName: "pump-fun-sdk",
  githubStars: 150,
  githubLanguage: "TypeScript",
  githubLastPush: "2026-03-05T10:00:00Z",
  githubDescription: "Solana token SDK",
  githubIsFork: false,
  githubUserLogin: "nirholas",
  githubUserFollowers: 200,
  githubUserRepos: 45,
  githubUserCreatedAt: "2020-01-15T00:00:00Z",
});

console.log(summary);
// "Active dev with 150★ repo claims $225 at 72% curve — 3/12 graduated, legit builder"
```

### How It Works

- **Model**: `llama-3.3-70b-versatile` via Groq (fast, free tier)
- **Output**: Max 150 chars, 1 line, no HTML tags
- **Temperature**: 0.3 (focused, not creative)
- **Max tokens**: 80
- **Safety**: HTML tags stripped from output to prevent injection

## Step 2: GitHub Enrichment

When a token's description contains a GitHub URL, the bot fetches repo and user metadata:

```typescript
import {
  parseGitHubRepo,
  fetchGitHubRepo,
  fetchGitHubUser,
  type GitHubRepoInfo,
  type GitHubUserInfo,
} from "./github-client";

// Parse GitHub URL from token description
const parsed = parseGitHubRepo("https://github.com/nirholas/pump-fun-sdk");
// { owner: "nirholas", repo: "pump-fun-sdk" }

if (parsed) {
  // Fetch repo metadata (cached 10 min, max 200 entries)
  const repo: GitHubRepoInfo | null = await fetchGitHubRepo(
    parsed.owner,
    parsed.repo
  );

  if (repo) {
    console.log({
      fullName: repo.fullName,         // "nirholas/pump-fun-sdk"
      stars: repo.stars,                // 150
      forks: repo.forks,               // 23
      language: repo.language,          // "TypeScript"
      lastPush: repo.lastPush,         // ISO date
      lastPushAgo: repo.lastPushAgo,   // "2 hours ago"
      isFork: repo.isFork,             // false
      topics: repo.topics,             // ["solana", "defi"]
      commitCount: repo.commitCount,   // 342
    });
  }

  // Fetch user profile
  const user: GitHubUserInfo | null = await fetchGitHubUser(parsed.owner);
  if (user) {
    console.log({
      login: user.login,
      followers: user.followers,
      publicRepos: user.publicRepos,
      createdAt: user.createdAt,
      twitterUsername: user.twitterUsername,
    });
  }
}
```

### Cache Strategy

The GitHub client uses an in-memory LRU cache:
- **TTL**: 10 minutes
- **Max entries**: 200
- **Auto-eviction**: Oldest entries removed when full
- Prevents hitting GitHub's 60 req/hour unauthenticated limit

## Step 3: First-Claim Detection

Track which tokens have been claimed for the first time:

```typescript
import {
  recordClaim,
  isFirstClaimOnToken,
  getClaimRecord,
  getTrackedCount,
  loadPersistedClaims,
} from "./claim-tracker";

// Load persisted state on startup
loadPersistedClaims(); // Reads from data/first-claims.json

// Record a claim
const record = recordClaim(
  "WalletPubkey...",  // claimer wallet
  "TokenMint...",     // token mint
  1.5,                // amount in SOL
  Date.now() / 1000   // timestamp
);

console.log(record);
// {
//   claimCount: 1,
//   totalClaimedSol: 1.5,
//   firstClaimTimestamp: 1709712000,
//   lastClaimTimestamp: 1709712000,
// }

// Check if this is the first-ever claim on a token
const isFirst = isFirstClaimOnToken("TokenMint...");
// true on first call, false after

// Stats
console.log(`Tracking ${getTrackedCount()} wallet-token pairs`);
```

### Persistence

- Claims saved to `data/first-claims.json`
- Debounced writes (5 seconds) to avoid disk thrashing
- Max 50,000 entries before oldest are evicted

## Step 4: Rich HTML Formatting

The formatter combines all enrichment data into a Telegram HTML card:

```typescript
import { formatClaimFeed, type ClaimFeedContext } from "./formatters";

const ctx: ClaimFeedContext = {
  event: feeClaimEvent,
  token: tokenInfo,
  creator: creatorProfile,
  claimRecord: { claimCount: 1, totalClaimedSol: 1.5, ... },
  holders: { count: 89, top10Pct: 45 },
  trades: { count24h: 234, volume24hSol: 156 },
  solUsdPrice: 150.0,
  githubRepo: repoInfo,      // or null
  githubUser: userInfo,       // or null
  aiSummary: "Active dev claims $225 at 72% curve",
};

const { imageUrl, caption } = formatClaimFeed(ctx);

// Send to Telegram
await bot.api.sendMessage(channelId, caption, {
  parse_mode: "HTML",
});
```

### Card Layout

```
🎯 Fee Claim: PumpCoin ($PUMP)

💰 1.500 SOL ($225.00)
📊 Type: Creator Fee | First Claim! 🆕

📈 Market: $45K mcap | 89 holders | 72% curve
🔄 24h: 234 trades | 156.0 SOL volume

👤 Creator: 12 launches | 3 graduated
🔗 github.com/nirholas/pump-fun-sdk ⭐ 150

🤖 AI: Active dev with 150★ repo claims $225
   at 72% curve — 3/12 graduated, legit builder

🏦 CA: TokenMint...
⏱️ Launch → Claim: 1h 0m
```

## Step 5: Claim Monitor with Rate Limiting

The monitor handles Solana RPC rate limiting gracefully:

```typescript
import { ClaimMonitor } from "./claim-monitor";

const monitor = new ClaimMonitor({
  rpcUrl: process.env.RPC_URL!,
  telegramBot: bot,
  channelId: process.env.CHANNEL_ID!,
});

// Two monitoring modes:

// 1. WebSocket (real-time, preferred)
await monitor.startWebSocket();
// Heartbeat: 60s interval, 90s timeout
// Auto-reconnects on disconnect

// 2. HTTP polling (fallback)
await monitor.startPolling();
// Poll interval: configurable
```

### RPC Rate Limiting Queue

```typescript
// The RpcQueue prevents 429 errors:
// - MAX_QUEUE_SIZE = 50 (drops oldest if full)
// - MAX_CONCURRENCY = 1 (sequential processing)
// - MIN_REQUEST_INTERVAL_MS = 1000 (1 req/sec)
// - Tracks 429 responses and backs off automatically
```

## Step 6: Environment Setup

```bash
# .env
RPC_URL=https://api.mainnet-beta.solana.com
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHANNEL_ID=-1001234567890
GROQ_API_KEY=gsk_...
GITHUB_TOKEN=ghp_...  # Optional, increases rate limit to 5000/hr
```

## Step 7: Docker Deployment

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

```bash
docker build -t pump-channel-bot .
docker run -d --env-file .env pump-channel-bot
```

## Enrichment Pipeline Summary

| Stage | Source | Latency | Cached |
|-------|--------|---------|--------|
| Claim detection | Solana RPC | Real-time | No |
| Token metadata | Pump SDK | ~200ms | Yes |
| Creator profile | Pump SDK | ~200ms | Yes |
| GitHub repo | GitHub API | ~300ms | 10 min |
| GitHub user | GitHub API | ~300ms | 10 min |
| Claim history | Local JSON | <1ms | Always |
| AI summary | Groq API | ~500ms | No |
| Formatting | Local | <1ms | No |

## Next Steps

- See [Tutorial 22](./22-channel-bot-setup.md) for basic channel bot setup
- See [Tutorial 18](./18-telegram-bot.md) for interactive Telegram bot
- See [Tutorial 29](./29-event-parsing-analytics.md) for event parsing fundamentals
