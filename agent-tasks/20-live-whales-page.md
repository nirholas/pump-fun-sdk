# Task 20: Whale Trades Live Page — PumpKit Web

## Context

You are working in the `pump-fun-sdk` repository. The `pumpkit/packages/web/` package is a React + Vite + Tailwind dashboard UI styled as a Telegram clone. It uses WebSocket connections to PumpPortal and a relay server for real-time Solana PumpFun events.

**Two live pages already exist** (don't modify them — use them as reference):
- `pumpkit/packages/web/src/pages/LiveLaunches.tsx` — new token launch feed
- `pumpkit/packages/web/src/pages/LiveTrades.tsx` — buy/sell/create trade feed

**Two WebSocket hooks already exist** (don't modify them — use them as reference):
- `pumpkit/packages/web/src/hooks/useLaunchStream.ts` — launch-only stream
- `pumpkit/packages/web/src/hooks/useTradeStream.ts` — all-trades stream

## Objective

Create a **Whale Trades** page that shows only large trades (≥1 SOL) in real-time. Same Telegram-clone theme as the rest of PumpKit.

## What to Create

### 1. New Hook: `pumpkit/packages/web/src/hooks/useWhaleStream.ts`

Connect to WebSocket endpoints (tried in order with auto-reconnect + exponential backoff):
1. `wss://pumpportal.fun/api/data` (protocol: `pumpportal`) — send `{ "method": "subscribeTokenTrade", "keys": ["all"] }` on open
2. `wss://pump-fun-websocket-production.up.railway.app/ws` (protocol: `relay`) — no subscription needed

**PumpPortal messages:** Flat JSON with `txType` (`buy`/`sell`), `mint`, `name`, `symbol`, `solAmount` (could be lamports >1e6 or SOL), `traderPublicKey`, `signature`.

**Relay messages:** JSON with `type` field. Skip `heartbeat` and `status` messages. Trade events have `type: 'buy'|'sell'`, `mint`, `solAmount`, etc.

**Whale threshold:** Only emit entries where SOL amount ≥ 1 SOL.

Export:
```typescript
interface WhaleEntry {
  id: string;
  direction: 'buy' | 'sell';
  mint: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  solAmount: number;
  tokenAmount: number;
  trader: string | null;
  signature: string;
  timestamp: string;
  isNew: boolean;
}

interface WhaleStats {
  total: number;
  buys: number;
  sells: number;
  volumeSol: number;
  biggestTrade: number;
  rate: number;
}

function useWhaleStream(): {
  whales: WhaleEntry[];
  status: ConnectionStatus;
  stats: WhaleStats;
}
```

### 2. New Page: `pumpkit/packages/web/src/pages/LiveWhales.tsx`

Telegram-themed whale activity page. Use these Tailwind color classes (already defined):
- `bg-tg-chat`, `bg-tg-bubble-in`, `bg-tg-bubble`, `bg-tg-input`, `bg-tg-blue`
- `text-pump-green` (buys), `text-pump-pink` (sells), `text-pump-orange` (whale accent), `text-pump-yellow`, `text-pump-cyan`
- `rounded-2xl rounded-tl-sm` for incoming bubbles, `rounded-2xl rounded-br-sm` for outgoing

Layout pattern (copy from LiveTrades.tsx):
- Sticky filter bar at top with `StatusDot` component (import from `../components/StatusDot`)
- Stats panel as outgoing bubble (blue `bg-tg-bubble`) showing: total whales, buys, sells, volume, biggest trade, rate/s
- Buy/sell ratio bar (green/pink)
- Each whale trade as an incoming chat bubble with: direction emoji (🟢/🔴), SOL amount, token name/link, trader address link, Solscan TX link
- Filter buttons: All, 🟢 Buys, 🔴 Sells, plus a search input
- Empty state with 🐋 emoji

### 3. Wire into Router

Edit `pumpkit/packages/web/src/main.tsx`:
- Add import: `import { LiveWhales } from './pages/LiveWhales';`
- Add route after the `live/trades` route: `<Route path="live/whales" element={<LiveWhales />} />`

### 4. Wire into Sidebar

Edit `pumpkit/packages/web/src/components/Layout.tsx`:
- Add entry to the `channels` array after the `Live Trades` entry:
  `{ path: '/live/whales', label: 'Whale Trades', emoji: '🐋', preview: 'Large trades ≥1 SOL', unread: false },`

## Reference Files (READ these, don't modify)

- `pumpkit/packages/web/src/hooks/useTradeStream.ts` — WebSocket hook pattern
- `pumpkit/packages/web/src/pages/LiveTrades.tsx` — page component pattern
- `pumpkit/packages/web/src/components/StatusDot.tsx` — status indicator component
- `pumpkit/packages/web/src/components/EventCard.tsx` — FeedEvent type + bubble pattern
- `pumpkit/packages/web/tailwind.config.js` — theme colors
- `pumpkit/packages/web/src/lib/types.ts` — `EventType`, `WhaleEvent` types

## Rules

- Create NEW files only — do not modify existing hooks or pages (except main.tsx and Layout.tsx for wiring)
- Use the exact same Tailwind classes and Telegram theme as existing pages
- All external links open in `target="_blank"` with `rel="noopener noreferrer"`
- Use `https://pump.fun/coin/{mint}` for token links, `https://solscan.io/tx/{sig}` for TX links, `https://solscan.io/account/{addr}` for wallet links
- Export the page component as named export (not default)
- No `npx tsc --noEmit` — use `npm run typecheck` if type-checking is needed
