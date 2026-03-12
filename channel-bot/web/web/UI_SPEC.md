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
- Footer: MIT license, GitHub link, npm link

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
| Fee Claim | 💰 | `pump-green` | creator, amount, token, signature, time |
| Token Launch | 🚀 | `tg-blue` | name, symbol, creator, cashback, time |
| Graduation | 🎓 | `pump-purple` | token, pool, liquidity, time |
| Whale Trade | 🐋 | `pump-orange` | direction, amount, token, wallet, time |
| CTO | 👑 | `pump-pink` | old_creator, new_creator, token, time |
| Fee Distribution | 💎 | `pump-cyan` | token, shareholders, amounts, time |

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
- npm Packages

## Design Tokens

Uses Tailwind custom colors defined in `tailwind.config.js`. Two palettes:

### Telegram Palette (`tg-*`)
| Token | Hex | Usage |
|-------|-----|-------|
| `tg-bg` | `#17212b` | Main background (dark mode) |
| `tg-sidebar` | `#0e1621` | Sidebar / left panel |
| `tg-chat` | `#0e1621` | Chat area background |
| `tg-header` | `#17212b` | Top bar |
| `tg-input` | `#242f3d` | Input fields, cards |
| `tg-hover` | `#202b36` | Hover state |
| `tg-border` | `#1c2733` | Subtle borders |
| `tg-blue` | `#5eb5f7` | Links, accent (Telegram blue) |
| `tg-green` | `#4fae4e` | Online / success |
| `tg-bubble` | `#2b5278` | Outgoing message bubble |
| `tg-bubble-in` | `#182533` | Incoming message bubble |

### PumpFun Palette (`pump-*`)
| Token | Hex | Usage |
|-------|-----|-------|
| `pump-green` | `#00e676` | Buy / success / launch |
| `pump-pink` | `#ff6b9d` | Sell / hot |
| `pump-yellow` | `#ffd54f` | Warnings / trending |
| `pump-purple` | `#b388ff` | Graduation |
| `pump-orange` | `#ff9100` | Whale |
| `pump-cyan` | `#00e5ff` | Info |

### Typography
```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
```

### Spacing
```css
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
