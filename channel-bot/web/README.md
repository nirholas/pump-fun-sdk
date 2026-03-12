# @pumpkit/web — Dashboard UI

> React 19 + Vite + Tailwind dashboard for real-time PumpFun bot monitoring. Displays fee claims, token launches, graduations, whale trades, and CTO alerts via SSE streaming. Styled as a Telegram chat interface.

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Project overview, feature grid, package cards, quick start |
| `/create` | Create Coin | Interactive token creation form (demo/marketing) |
| `/dashboard` | Live Feed | Real-time event feed with filters and stats |
| `/docs` | Documentation | Getting started, architecture, packages, API, tutorials, FAQ |
| `/packages` | Packages | Detailed showcase of all 5 PumpKit packages |

### Dashboard Layout

```
┌─────────────────────────────────────────────────┐
│  Header: PumpKit Dashboard    [Status: ●]       │
├───────────┬─────────────────────────────────────┤
│  Sidebar  │  Event Feed (real-time cards)       │
│           │                                     │
│  Watches  │  [Claim] [Launch] [Grad] [Whale]   │
│  + Add    │                                     │
│  Filters  │  ┌─────────────────────────────┐   │
│  ☑ Claims │  │ 💰 Fee Claim                │   │
│  ☑ Launch │  │ Creator: 7xKp...            │   │
│  ☑ Grad   │  │ Amount: 1.23 SOL • 2s ago   │   │
│  ☑ Whale  │  └─────────────────────────────┘   │
│  ☑ CTO    │  ┌─────────────────────────────┐   │
│           │  │ 🚀 Token Launch              │   │
│           │  │ CoolToken (COOL) • 5s ago    │   │
│           │  └─────────────────────────────┘   │
└───────────┴─────────────────────────────────────┘
```

### Telegram-Style UI

- Dark chat interface with message bubbles (incoming/outgoing)
- Sidebar with channel-style navigation
- Cosmetic message input bar
- Inline keyboard buttons for CTAs
- Date separators and timestamps

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI framework |
| React Router | 7.1 | Client-side routing |
| Vite | 6 | Dev server + bundler |
| Tailwind CSS | 3.4 | Utility-first styling with `tg-*` and `pump-*` tokens |
| TypeScript | 5.7 | Type safety |

## Quick Start

```bash
cd pumpkit

# Install all workspace dependencies
npm install

# Dev server (hot-reload)
npx turbo dev --filter=@pumpkit/web

# Or directly
cd packages/web
npm run dev      # Start Vite dev server at http://localhost:5173
npm run build    # Production build (tsc + vite)
npm run preview  # Preview production build
```

## API Integration

The dashboard connects to a running `@pumpkit/monitor` bot API.
Set the `VITE_API_URL` environment variable to enable live data:

```bash
VITE_API_URL=http://localhost:3000 npm run dev
```

Without `VITE_API_URL`, the dashboard displays a simulated event feed for demonstration.

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

### SSE Connection

```typescript
const eventSource = new EventSource('/api/v1/claims/stream');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Add to feed — auto-reconnects with exponential backoff
};
```

### Watch Management

```typescript
// Add a wallet watch
await fetch('/api/v1/watches', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: walletAddress }),
});

// Remove a watch
await fetch(`/api/v1/watches/${address}`, { method: 'DELETE' });
```

## Event Types

| Event | Icon | Color | Fields |
|-------|------|-------|--------|
| Fee Claim | 💰 | `pump-green` | creator, amount, token, signature |
| Token Launch | 🚀 | `tg-blue` | name, symbol, creator, cashback |
| Graduation | 🎓 | `pump-purple` | token, pool, liquidity |
| Whale Trade | 🐋 | `pump-orange` | direction, amount, token, wallet |
| CTO | 👑 | `pump-pink` | old_creator, new_creator, token |
| Fee Distribution | 💎 | `pump-cyan` | token, shareholders, amounts |

## Design System

### Color Palettes

**Telegram palette (`tg-*`):** Dark theme inspired by Telegram Desktop

| Token | Hex | Usage |
|-------|-----|-------|
| `tg-bg` | `#17212b` | Main background |
| `tg-sidebar` | `#0e1621` | Sidebar / left panel |
| `tg-input` | `#242f3d` | Input fields, cards |
| `tg-blue` | `#5eb5f7` | Links, accent |
| `tg-green` | `#4fae4e` | Online / success |
| `tg-bubble` | `#2b5278` | Outgoing message bubble |

**PumpFun palette (`pump-*`):** Vibrant event colors

| Token | Hex | Usage |
|-------|-----|-------|
| `pump-green` | `#00e676` | Buy / success / launch |
| `pump-pink` | `#ff6b9d` | Sell / hot |
| `pump-yellow` | `#ffd54f` | Warnings / trending |
| `pump-purple` | `#b388ff` | Graduation |
| `pump-orange` | `#ff9100` | Whale |
| `pump-cyan` | `#00e5ff` | Info |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| < 768px | Single column, sidebar collapses to bottom nav |
| 768px–1024px | Sidebar as overlay/drawer |
| > 1024px | Full sidebar + main layout |

## Project Structure

```
packages/web/
├── UI_SPEC.md                    Design specification
├── package.json                  Dependencies & scripts
├── vite.config.ts                Vite config with React plugin
├── tailwind.config.js            Custom tg-*/pump-* color palettes
├── postcss.config.js             PostCSS with Tailwind + autoprefixer
├── index.html                    HTML entry point
├── public/                       Static assets
└── src/
    ├── main.tsx                  Entry point + React Router config
    ├── index.css                 Tailwind directives + animations
    ├── types.ts                  Re-exports + UI-specific types (BotStatus, RankTier, etc.)
    ├── pages/
    │   ├── Home.tsx              Landing page with hero + package cards
    │   ├── CreateCoin.tsx        Token creation form (demo)
    │   ├── Dashboard.tsx         Real-time event feed
    │   ├── Docs.tsx              Documentation viewer
    │   └── Packages.tsx          Package showcase
    ├── components/
    │   ├── EventCard.tsx         Event card (6 event types with colored badges)
    │   ├── Layout.tsx            Telegram-style shell (sidebar + top bar + input bar)
    │   ├── MarkdownChat.tsx      Markdown documentation renderer
    │   ├── SolAmount.tsx         SOL amount formatter with icons
    │   ├── StatsBar.tsx          Real-time stats display bar
    │   ├── StatusDot.tsx         Connection status indicator (green/yellow/red)
    │   ├── TimeAgo.tsx           Relative timestamp rendering
    │   ├── TokenBadge.tsx        Token CA + symbol badge
    │   ├── WalletAddress.tsx     Wallet address with truncation
    │   ├── WatchForm.tsx         Add wallet watch form
    │   └── WatchList.tsx         Sidebar watches list
    ├── hooks/
    │   ├── useEventStream.ts     SSE connection with auto-reconnect
    │   ├── useHealth.ts          Health check polling hook
    │   └── useWatches.ts         Watch management hook (CRUD)
    └── lib/
        ├── api.ts                HTTP client + SSE functions
        ├── content.ts            Content loaders (docs/tutorials)
        └── types.ts              API TypeScript interfaces
```

## Performance

- First Contentful Paint < 1.5s
- SSE auto-reconnect < 3s with exponential backoff
- Event card render < 16ms (60fps scrolling)
- Maximum 200 events in DOM (virtualized for more)

## Deployment

Designed for Vercel:

```json
{
  "buildCommand": "npm run build --workspace=@pumpkit/web",
  "outputDirectory": "packages/web/dist",
  "framework": null
}
```

## License

MIT — Part of [pumpkit](../../README.md)
