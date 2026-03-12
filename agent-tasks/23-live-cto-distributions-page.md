# Task 23: CTO & Fee Distributions Live Page — PumpKit Web

## Context

You are working in the `pump-fun-sdk` repository. The `pumpkit/packages/web/` package is a React + Vite + Tailwind dashboard UI styled as a Telegram clone. It uses WebSocket connections to PumpPortal and a relay server for real-time Solana PumpFun events.

**Two live pages already exist** (don't modify them — use them as reference):
- `pumpkit/packages/web/src/pages/LiveLaunches.tsx` — new token launch feed
- `pumpkit/packages/web/src/pages/LiveTrades.tsx` — buy/sell/create trade feed

**Two WebSocket hooks already exist** (don't modify them — use them as reference):
- `pumpkit/packages/web/src/hooks/useLaunchStream.ts` — launch-only stream
- `pumpkit/packages/web/src/hooks/useTradeStream.ts` — all-trades stream

## Background

**CTO (Creator Transfer Ownership):** When a token's creator transfers ownership to a new wallet. This is significant because it can signal a "community takeover" where the original creator hands off the project.

**Fee Distributions:** When accumulated trading fees are distributed to shareholders of a fee-sharing config. Each distribution event contains a list of shareholders and their SOL payouts.

Both are relatively low-frequency events, so they share one page with tab filtering.

## Objective

Create a **CTO & Distributions** page that shows both creator transfer events and fee distribution events in real-time. Same Telegram-clone theme as the rest of PumpKit.

## What to Create

### 1. New Hook: `pumpkit/packages/web/src/hooks/useCTOStream.ts`

Connect to WebSocket endpoints (tried in order with auto-reconnect + exponential backoff):
1. `wss://pumpportal.fun/api/data` (protocol: `pumpportal`) — send `{ "method": "subscribeTokenTrade", "keys": ["all"] }` on open
2. `wss://pump-fun-websocket-production.up.railway.app/ws` (protocol: `relay`) — no subscription needed

**PumpPortal messages:** Flat JSON. CTO events are rare on PumpPortal. Check for messages with CTO-related fields (`oldCreator`, `newCreator`, `txType: 'cto'`).

**Relay messages:** JSON with `type` field. Skip `heartbeat` and `status` messages.
- CTO events: `type: 'cto'` with `tokenMint`/`mint`, `oldCreator`, `newCreator`, `signature`
- Distribution events: `type: 'distribution'` with `tokenMint`/`mint`, `shareholders` (array of `{ address, amountSol }`), `signature`

**Since both event types are sparse**, include a demo mode that generates sample events every 8-15 seconds when no real data arrives for 30+ seconds. Toggle with state.

Export:
```typescript
interface CTOEntry {
  id: string;
  kind: 'cto';
  mint: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  oldCreator: string;
  newCreator: string;
  signature: string;
  timestamp: string;
  isNew: boolean;
}

interface DistributionEntry {
  id: string;
  kind: 'distribution';
  mint: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  shareholders: Array<{ address: string; amountSol: number }>;
  totalSol: number;
  signature: string;
  timestamp: string;
  isNew: boolean;
}

type CTOFeedEntry = CTOEntry | DistributionEntry;

interface CTOStats {
  totalCTO: number;
  totalDistributions: number;
  totalDistributedSol: number;
  rate: number;
}

function useCTOStream(): {
  entries: CTOFeedEntry[];
  status: ConnectionStatus;
  stats: CTOStats;
  isDemo: boolean;
}
```

### 2. New Page: `pumpkit/packages/web/src/pages/LiveCTO.tsx`

Telegram-themed CTO & distributions page. Use these Tailwind color classes (already defined):
- `bg-tg-chat`, `bg-tg-bubble-in`, `bg-tg-bubble`, `bg-tg-input`, `bg-tg-blue`
- `text-pump-pink` (CTO accent — ownership transfer is dramatic), `text-pump-cyan` (distribution accent), `text-pump-green`, `text-pump-yellow`
- `rounded-2xl rounded-tl-sm` for incoming bubbles, `rounded-2xl rounded-br-sm` for outgoing

Layout pattern (copy from LiveTrades.tsx):
- Sticky filter bar at top with `StatusDot` component (import from `../components/StatusDot`)
- Filter buttons: All, 👑 CTO, 💎 Distributions
- Search input to filter by token name/mint/wallet
- Demo/Live mode indicator
- Stats panel as outgoing bubble showing: total CTO events, total distributions, total SOL distributed, rate/s
- **CTO entries** as incoming chat bubbles:
  - 👑 emoji avatar (use `bg-pump-pink` for the circle)
  - "Creator Transfer" header
  - Token name + mint link → `https://pump.fun/coin/{mint}`
  - Old creator → New creator (with wallet links to Solscan)
  - "Community Takeover" badge if applicable
  - Button: "View TX"
- **Distribution entries** as incoming chat bubbles:
  - 💎 emoji avatar (use `bg-pump-cyan` for the circle)
  - "Fee Distribution" header with total SOL amount
  - Token name + mint link
  - Shareholder list: each address + SOL amount received
  - Button: "View TX"
- Empty state with 👑💎 emojis: "Waiting for CTO & distribution events…"

### 3. Wire into Router

Edit `pumpkit/packages/web/src/main.tsx`:
- Add import: `import { LiveCTO } from './pages/LiveCTO';`
- Add route after `live/trades`: `<Route path="live/cto" element={<LiveCTO />} />`

### 4. Wire into Sidebar

Edit `pumpkit/packages/web/src/components/Layout.tsx`:
- Add TWO entries to the `channels` array after the `Live Trades` entry:
  `{ path: '/live/cto', label: 'CTO & Distributions', emoji: '👑', preview: 'Creator transfers & fee payouts', unread: false },`

## Reference Files (READ these, don't modify)

- `pumpkit/packages/web/src/hooks/useTradeStream.ts` — WebSocket hook pattern with stats
- `pumpkit/packages/web/src/hooks/useLaunchStream.ts` — simpler WebSocket hook
- `pumpkit/packages/web/src/pages/LiveTrades.tsx` — page component with filters + stats + multiple event types
- `pumpkit/packages/web/src/pages/LiveLaunches.tsx` — simpler page pattern
- `pumpkit/packages/web/src/components/StatusDot.tsx` — status indicator
- `pumpkit/packages/web/src/components/EventCard.tsx` — CTO + Distribution rendering in EventContent (see the `cto` and `distribution` cases)
- `pumpkit/packages/web/tailwind.config.js` — theme colors
- `pumpkit/packages/web/src/lib/types.ts` — `CTOEvent`, `DistributionEvent` type definitions

## Rules

- Create NEW files only — do not modify existing hooks or pages (except main.tsx and Layout.tsx for wiring)
- Use the exact same Tailwind classes and Telegram theme as existing pages
- All external links open in `target="_blank"` with `rel="noopener noreferrer"`
- Use `https://pump.fun/coin/{mint}` for token links, `https://solscan.io/tx/{sig}` for TX links, `https://solscan.io/account/{addr}` for wallet links
- Export the page component as named export (not default)
- No `npx tsc --noEmit` — use `npm run typecheck` if type-checking is needed
