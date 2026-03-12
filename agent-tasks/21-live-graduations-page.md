# Task 21: Graduations Live Page — PumpKit Web

## Context

You are working in the `pump-fun-sdk` repository. The `pumpkit/packages/web/` package is a React + Vite + Tailwind dashboard UI styled as a Telegram clone. It uses WebSocket connections to PumpPortal and a relay server for real-time Solana PumpFun events.

**Two live pages already exist** (don't modify them — use them as reference):
- `pumpkit/packages/web/src/pages/LiveLaunches.tsx` — new token launch feed
- `pumpkit/packages/web/src/pages/LiveTrades.tsx` — buy/sell/create trade feed

**Two WebSocket hooks already exist** (don't modify them — use them as reference):
- `pumpkit/packages/web/src/hooks/useLaunchStream.ts` — launch-only stream
- `pumpkit/packages/web/src/hooks/useTradeStream.ts` — all-trades stream

## Objective

Create a **Graduations** page that shows tokens migrating from the bonding curve to the PumpSwap AMM in real-time. Same Telegram-clone theme as the rest of PumpKit.

## What to Create

### 1. New Hook: `pumpkit/packages/web/src/hooks/useGraduationStream.ts`

Connect to WebSocket endpoints (tried in order with auto-reconnect + exponential backoff):
1. `wss://pumpportal.fun/api/data` (protocol: `pumpportal`) — send `{ "method": "subscribeNewToken" }` AND `{ "method": "subscribeTokenTrade", "keys": ["all"] }` on open
2. `wss://pump-fun-websocket-production.up.railway.app/ws` (protocol: `relay`) — no subscription needed

**PumpPortal messages:** Flat JSON objects. Graduation/migrate events may come as `txType: 'migrate'` or may not have an explicit txType. Look for messages that contain migration indicators. PumpPortal may also send events where `txType` is absent but there's a `mint` and the context indicates migration (check for `pool`, `marketCapSol` at graduation thresholds, or `txType: 'migrate'`).

**Relay messages:** JSON with `type` field. Skip `heartbeat` and `status` messages. Graduation events have `type: 'graduation'` or `type: 'migrate'` with fields: `mint`/`tokenMint`, `name`/`tokenName`, `signature`, `pool` (optional AMM pool address).

Export:
```typescript
interface GraduationEntry {
  id: string;
  mint: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  pool: string | null;
  creator: string | null;
  signature: string;
  timestamp: string;
  isNew: boolean;
}

interface GraduationStats {
  total: number;
  rate: number;
}

function useGraduationStream(): {
  graduations: GraduationEntry[];
  status: ConnectionStatus;
  stats: GraduationStats;
}
```

### 2. New Page: `pumpkit/packages/web/src/pages/LiveGraduations.tsx`

Telegram-themed graduation feed page. Use these Tailwind color classes (already defined):
- `bg-tg-chat`, `bg-tg-bubble-in`, `bg-tg-bubble`, `bg-tg-input`, `bg-tg-blue`
- `text-pump-purple` (graduation accent), `text-pump-green`, `text-pump-yellow`, `text-pump-cyan`
- `rounded-2xl rounded-tl-sm` for incoming bubbles, `rounded-2xl rounded-br-sm` for outgoing

Layout pattern (copy from LiveLaunches.tsx):
- Sticky filter bar at top with `StatusDot` component (import from `../components/StatusDot`)
- Stats pills showing: total graduations, rate/s
- Search input to filter by token name/symbol/mint
- Each graduation as an incoming chat bubble with:
  - 🎓 emoji avatar (use `bg-pump-purple` for the avatar circle)
  - "Token Graduated!" header
  - Token name + symbol
  - Mint address link → `https://pump.fun/coin/{mint}`
  - Pool address link (if available) → `https://solscan.io/account/{pool}`
  - Creator address link → `https://solscan.io/account/{creator}`
  - "Migrated to PumpSwap AMM" subtitle
  - Buttons: "Trade on PumpSwap", "Explorer" (Solscan TX link)
- Empty state with 🎓 emoji: "Waiting for token graduations…"

### 3. Wire into Router

Edit `pumpkit/packages/web/src/main.tsx`:
- Add import: `import { LiveGraduations } from './pages/LiveGraduations';`
- Add route after `live/trades`: `<Route path="live/graduations" element={<LiveGraduations />} />`

### 4. Wire into Sidebar

Edit `pumpkit/packages/web/src/components/Layout.tsx`:
- Add entry to the `channels` array after the `Live Trades` entry:
  `{ path: '/live/graduations', label: 'Graduations', emoji: '🎓', preview: 'Tokens migrating to AMM', unread: false },`

## Reference Files (READ these, don't modify)

- `pumpkit/packages/web/src/hooks/useLaunchStream.ts` — WebSocket hook pattern (simplest)
- `pumpkit/packages/web/src/hooks/useTradeStream.ts` — WebSocket hook with stats tracking
- `pumpkit/packages/web/src/pages/LiveLaunches.tsx` — page component pattern (simplest)
- `pumpkit/packages/web/src/components/StatusDot.tsx` — status indicator component
- `pumpkit/packages/web/src/components/EventCard.tsx` — FeedEvent type + bubble rendering pattern
- `pumpkit/packages/web/tailwind.config.js` — theme colors
- `pumpkit/packages/web/src/lib/types.ts` — `GraduationEvent` type definition

## Rules

- Create NEW files only — do not modify existing hooks or pages (except main.tsx and Layout.tsx for wiring)
- Use the exact same Tailwind classes and Telegram theme as existing pages
- All external links open in `target="_blank"` with `rel="noopener noreferrer"`
- Use `https://pump.fun/coin/{mint}` for token links, `https://solscan.io/tx/{sig}` for TX links, `https://solscan.io/account/{addr}` for wallet/pool links
- Export the page component as named export (not default)
- No `npx tsc --noEmit` — use `npm run typecheck` if type-checking is needed
