# PumpKit Web — Component Reference

> Guide for the frontend agent building the PumpKit dashboard. Describes every component needed, its props, data source, and behavior.

## Existing Assets

Before building React components, review these existing assets already in the repo:

### API Layer (ready to use)
- **[src/lib/types.ts](src/lib/types.ts)** — All event types, API response interfaces
- **[src/lib/api.ts](src/lib/api.ts)** — HTTP client + SSE stream functions
- **[index.html](index.html)** — Shell HTML entry point
- **[public/favicon.svg](public/favicon.svg)** — Logo

### Design Spec
- **[UI_SPEC.md](UI_SPEC.md)** — Full page layouts, color tokens, typography, card designs
- **[.env.example](.env.example)** — Environment variables

### Reference Dashboards
- **[../../live/index.html](../../live/index.html)** — Standalone token launch dashboard (dark theme, card layouts, WebSocket)
- **[../../live/trades.html](../../live/trades.html)** — Trade analytics with whale detection
- **[../../live/dashboard.html](../../live/dashboard.html)** — Combined dashboard view

These are single-file HTML dashboards that demonstrate the styling patterns and data display patterns PumpKit should follow.

## Component Tree

```
App
├── Layout
│   ├── Header (logo, nav, status indicator)
│   └── Sidebar (watches, filters)
├── Pages
│   ├── LandingPage
│   │   ├── Hero
│   │   ├── PackageCards
│   │   ├── QuickStart (code snippet)
│   │   └── Footer
│   ├── DashboardPage
│   │   ├── StatusBar (connection, uptime, claim count)
│   │   ├── FilterBar (event type toggles)
│   │   ├── WatchList (sidebar)
│   │   │   ├── WatchItem
│   │   │   └── AddWatchForm
│   │   └── EventFeed
│   │       ├── ClaimCard
│   │       ├── LaunchCard
│   │       ├── GraduationCard
│   │       ├── WhaleCard
│   │       ├── CTOCard
│   │       └── DistributionCard
│   └── DocsPage (markdown renderer or redirect to GitHub)
└── Shared
    ├── SolAmount (formats SOL with USD)
    ├── WalletAddress (truncated + copy button)
    ├── TimeAgo (relative timestamps)
    ├── TokenBadge (name, symbol, icon)
    └── StatusDot (green/yellow/red)
```

## Key Components

### EventCard (base)
All event cards share a common structure:

```
┌──────────────────────────────────┐
│ [Icon] [Type Label]    [TimeAgo] │
│                                  │
│ [Primary Info — varies by type]  │
│                                  │
│ [Details — key-value pairs]      │
│                                  │
│ [Actions — Explorer, PumpFun]    │
└──────────────────────────────────┘
```

### ClaimCard
- **Data**: `ClaimEvent` from SSE stream
- **Primary**: Creator wallet + SOL amount
- **Details**: Token name/symbol, claim type, tx signature
- **Color accent**: Green (`--accent-green`)

### LaunchCard
- **Data**: `LaunchEvent` from SSE stream
- **Primary**: Token name + symbol
- **Details**: Creator, cashback status
- **Color accent**: Blue (`--accent-blue`)

### WatchList
- **Data**: `fetchWatches()` on mount, refresh on add/remove
- **Actions**: Add (input + button), Remove (click X)
- **Behavior**: Highlight watches that have recent activity

### StatusBar
- **Data**: `fetchHealth()` polling every 30s
- **Display**: Connection dot (green/red), uptime, total claims, monitor mode
- **Behavior**: Flash when connection drops

## Data Flow

```
Monitor Bot (Railway)
    │
    ├── GET /api/v1/health      → StatusBar (poll 30s)
    ├── GET /api/v1/watches     → WatchList (on mount)
    ├── GET /api/v1/claims      → EventFeed (initial load)
    └── GET /api/v1/claims/stream (SSE) → EventFeed (real-time)
```

## State Management

Keep it simple — no Redux needed:
- **Server state**: React Query or SWR for API calls
- **Local state**: `useState` for filters, sidebar toggle
- **SSE state**: Custom hook `useClaimStream()` backed by `createClaimStream()`

## Routing

3 pages, client-side routing:
- `/` → LandingPage
- `/dashboard` → DashboardPage  
- `/docs` → DocsPage (or redirect to GitHub docs)

## Build Notes

- Vite + React + TypeScript
- Tailwind CSS for styling (matches design tokens in UI_SPEC.md)
- Deploy to Vercel (static export)
- API URL configurable via `VITE_API_URL` env var
