# @pumpkit/web

> Frontend dashboard and documentation site for PumpKit — styled as a Telegram chat interface.

## Features

### Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Project overview, feature grid, package cards, quick start |
| `/create` | Create Coin | Interactive token creation form (demo/marketing) |
| `/dashboard` | Live Feed | Real-time event feed with filters and stats |
| `/docs` | Documentation | Getting started, architecture, packages, API, tutorials, FAQ |
| `/packages` | Packages | Detailed showcase of all 5 PumpKit packages |

### Telegram-Style UI

- Dark chat interface with message bubbles (incoming/outgoing)
- Sidebar with channel-style navigation
- Cosmetic message input bar
- Inline keyboard buttons for CTAs
- Date separators and timestamps

## Tech Stack

| Tool | Purpose |
|------|---------|
| **Vite** | Build tool and dev server |
| **React 19** | UI framework |
| **React Router 7** | Client-side routing |
| **Tailwind CSS 3** | Styling with `tg-*` and `pump-*` color tokens |

## Development

```bash
cd packages/web
npm run dev      # Start Vite dev server
npm run build    # Production build (tsc + vite)
npm run preview  # Preview production build
```

## API Integration

The dashboard can connect to a running `@pumpkit/monitor` bot API.
Set the `VITE_API_URL` environment variable to enable live data:

```bash
VITE_API_URL=http://localhost:3000 npm run dev
```

### Monitor API Endpoints

```
GET  /api/v1/health           → Bot status, uptime, connected wallets
GET  /api/v1/watches          → List watched wallets
POST /api/v1/watches          → Add a watch (body: { address: string })
DELETE /api/v1/watches/:addr  → Remove a watch
GET  /api/v1/claims           → Recent claim events (paginated)
GET  /api/v1/claims/stream    → SSE stream of real-time claims
POST /api/v1/webhooks         → Register webhook URL
DELETE /api/v1/webhooks/:id   → Remove webhook
```

### Design Direction

- Dark theme (crypto standard)
- Real-time updates (SSE/WebSocket)
- Mobile-responsive
- Minimal, data-dense dashboard style
- Card-based event feed (similar to Telegram message cards)

### Data Models

These are the key TypeScript interfaces the UI should render:

```typescript
// Bot health status
interface BotStatus {
  name: "monitor" | "tracker" | "channel" | "claim";
  status: "online" | "offline" | "error";
  uptime: number;           // seconds
  lastEvent: string;        // ISO timestamp
  version: string;
  activeCalls?: number;     // tracker only
  watchedWallets?: number;  // monitor only
}

// Monitor events (from SSE stream)
interface MonitorEvent {
  id: string;
  type: "claim" | "launch" | "graduation" | "whale" | "cto" | "distribution";
  timestamp: string;        // ISO timestamp
  mint?: string;            // token mint address
  creator?: string;         // creator address
  amountSol?: number;       // SOL amount (display only, use string for precision)
  txSignature: string;      // Solana transaction signature
}

// Tracker leaderboard entry (from tracker API / DB)
interface LeaderboardEntry {
  rank: number;
  username: string;
  telegramId: number;
  totalCalls: number;
  avgMultiplier: number;
  winRate: number;          // 0-100%
  points: number;
  tier: "Amateur" | "Novice" | "Contender" | "Guru" | "Oracle";
}

// Active call (tracker)
interface ActiveCall {
  id: number;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  chain: "solana" | "ethereum" | "base" | "bsc";
  callerUsername: string;
  entryPrice: number;
  currentPrice: number;
  athPrice: number;
  multiplier: number;
  calledAt: string;         // ISO timestamp
}

// Watched wallet (monitor)
interface WatchedWallet {
  address: string;
  label?: string;
  addedAt: string;
  lastClaim?: string;
  totalClaims: number;
}
```

### Page Mockups

**Home Dashboard:**
```
┌─────────────────────────────────────────────────────┐
│  PumpKit Dashboard                    [Monitor] [Tracker]  │
├─────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Monitor  │ │ Tracker  │ │ Channel  │ │ Claim    │     │
│  │ ● Online │ │ ● Online │ │ ○ Off    │ │ ● Online │     │
│  │ 2h 14m   │ │ 5h 02m   │ │ —        │ │ 1h 33m   │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                           │
│  Recent Activity                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │ 🎓 Graduation  BONK → AMM    2 min ago          │    │
│  │ 💰 Fee Claim   0.5 SOL       5 min ago          │    │
│  │ 🐋 Whale Buy   120 SOL       8 min ago          │    │
│  │ 🚀 Launch      $NEWTOKEN     12 min ago         │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Tracker Leaderboard:**
```
┌─────────────────────────────────────────────────────┐
│  Leaderboard    [24h] [7d] [30d] [All]              │
├─────────────────────────────────────────────────────┤
│  #  User          Calls  Avg×   Win%   Points  Tier │
│  1  @CryptoKing   42     8.3×   71%    156    🏆   │
│  2  @SolanaSniper  38     6.1×   65%    112    🥈   │
│  3  @DeFiDegen    35     4.7×   60%     89    🥉   │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

## Development

```bash
# From monorepo root
npm run dev --workspace=@pumpkit/web
```

## License

MIT
