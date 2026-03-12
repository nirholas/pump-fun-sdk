# PumpKit Web UI — Design Specification

> Specification for the PumpKit frontend dashboard. Written for an AI agent to implement.

## Overview

A single-page dashboard that connects to the `@pumpkit/monitor` REST API and displays real-time PumpFun activity. Deployed on Vercel.

## Pages

### 1. Landing / Home (`/`)

**Purpose:** Project overview + quick links.

**Sections:**
- Hero: "PumpKit" logo, tagline "Open-source PumpFun bot framework", CTA buttons (GitHub, Docs, Dashboard)
- Package cards: core, monitor, channel, claim, tracker — each with description + npm status badge
- Quick start code snippet (the `createBot` example from README)
- Footer: MIT license, GitHub link, npm link (coming soon)

### 2. Dashboard (`/dashboard`)

**Purpose:** Real-time event feed from monitor bot API.

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  Header: PumpKit Dashboard    [Status: ●]       │
├───────────┬─────────────────────────────────────┤
│  Sidebar  │  Main Content                       │
│           │                                     │
│  Watches  │  Event Feed (real-time cards)       │
│  --------│  [Claim] [Launch] [Grad] [Whale]    │
│  + Add    │                                     │
│  wallet1  │  ┌─────────────────────────────┐   │
│  wallet2  │  │ 💰 Fee Claim                 │   │
│  wallet3  │  │ Creator: 7xKp...            │   │
│           │  │ Amount: 1.23 SOL            │   │
│  Filters  │  │ Token: PUMP • 2s ago        │   │
│  --------│  └─────────────────────────────┘   │
│  ☑ Claims │  ┌─────────────────────────────┐   │
│  ☑ Launch │  │ 🚀 Token Launch              │   │
│  ☑ Grad   │  │ Name: CoolToken (COOL)      │   │
│  ☑ Whale  │  │ Creator: 3xMk...            │   │
│  ☑ CTO    │  │ Cashback: Yes • 5s ago      │   │
│           │  └─────────────────────────────┘   │
└───────────┴─────────────────────────────────────┘
```

**Data Source:** `GET /api/v1/claims/stream` (SSE) for real-time, `GET /api/v1/claims` for history.

**Event Card Types:**
| Event | Icon | Color | Fields |
|-------|------|-------|--------|
| Fee Claim | 💰 | Green | creator, amount, token, signature, time |
| Token Launch | 🚀 | Blue | name, symbol, creator, cashback, time |
| Graduation | 🎓 | Purple | token, pool, liquidity, time |
| Whale Trade | 🐋 | Orange | direction, amount, token, wallet, time |
| CTO | 👑 | Red | old_creator, new_creator, token, time |
| Fee Distribution | 💎 | Cyan | token, shareholders, amounts, time |

### 3. Docs (`/docs`)

**Purpose:** Render markdown documentation.

**Content source:** Link to GitHub docs or render inline from `docs/` folder.

**Navigation:**
- Getting Started
- Architecture  
- Core API
- Monitor Bot
- Tracker Bot
- Channel Bot
- Claim Bot
- Tutorials
- FAQ
- npm (Coming Soon)

## Design Tokens

```css
/* Colors */
--bg-primary: #0a0a0f;
--bg-card: #12121a;
--bg-sidebar: #0e0e16;
--border: #1e1e2e;
--text-primary: #e4e4e7;
--text-secondary: #71717a;
--accent-green: #22c55e;
--accent-blue: #3b82f6;
--accent-purple: #a855f7;
--accent-orange: #f97316;
--accent-red: #ef4444;
--accent-cyan: #06b6d4;

/* Typography */
--font-sans: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Spacing */
--radius: 8px;
--card-padding: 16px;
--sidebar-width: 280px;
```

## API Integration

### SSE Connection
```typescript
const eventSource = new EventSource('/api/v1/claims/stream');

eventSource.onmessage = (event) => {
  const claim = JSON.parse(event.data);
  addToFeed(claim);
};

eventSource.onerror = () => {
  // Auto-reconnect with exponential backoff
};
```

### Watch Management
```typescript
// List watches
const watches = await fetch('/api/v1/watches').then(r => r.json());

// Add watch
await fetch('/api/v1/watches', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: walletAddress }),
});

// Remove watch
await fetch(`/api/v1/watches/${address}`, { method: 'DELETE' });
```

## Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| < 768px | Single column, sidebar collapses to bottom nav |
| 768px–1024px | Sidebar as overlay/drawer |
| > 1024px | Full sidebar + main layout |

## Performance Requirements

- First Contentful Paint < 1.5s
- SSE reconnection < 3s
- Event card render < 16ms (60fps scrolling)
- Maximum 200 events in DOM (virtualized list for more)

## Deployment

```json
// vercel.json
{
  "buildCommand": "npm run build --workspace=@pumpkit/web",
  "outputDirectory": "packages/web/dist",
  "framework": null
}
```

## File Structure (Suggested)

```
packages/web/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                 Entry point
│   ├── App.tsx                  Root component + router
│   ├── pages/
│   │   ├── Home.tsx             Landing page
│   │   ├── Dashboard.tsx        Real-time event dashboard
│   │   └── Docs.tsx             Documentation viewer
│   ├── components/
│   │   ├── EventCard.tsx        Event card (claim/launch/grad/whale)
│   │   ├── EventFeed.tsx        Scrolling event list
│   │   ├── Sidebar.tsx          Watch list + filters
│   │   ├── StatusBadge.tsx      Bot connection status
│   │   ├── WatchForm.tsx        Add wallet form
│   │   └── CodeBlock.tsx        Syntax-highlighted code
│   ├── hooks/
│   │   ├── useSSE.ts            SSE connection hook
│   │   └── useWatches.ts        Watch CRUD hook
│   ├── lib/
│   │   ├── api.ts               API client functions
│   │   └── types.ts             Shared TypeScript types
│   └── styles/
│       └── globals.css          Tailwind + custom properties
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vite.config.ts
```
