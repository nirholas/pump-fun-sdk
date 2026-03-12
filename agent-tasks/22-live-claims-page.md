# Task 22: Fee Claims Live Page — PumpKit Web

## Context

You are working in the `pump-fun-sdk` repository. The `pumpkit/packages/web/` package is a React + Vite + Tailwind dashboard UI styled as a Telegram clone. It uses WebSocket connections to PumpPortal and a relay server for real-time Solana PumpFun events.

**Two live pages already exist** (don't modify them — use them as reference):
- `pumpkit/packages/web/src/pages/LiveLaunches.tsx` — new token launch feed
- `pumpkit/packages/web/src/pages/LiveTrades.tsx` — buy/sell/create trade feed

**Two WebSocket hooks already exist** (don't modify them — use them as reference):
- `pumpkit/packages/web/src/hooks/useLaunchStream.ts` — launch-only stream
- `pumpkit/packages/web/src/hooks/useTradeStream.ts` — all-trades stream

## Background on Fee Claims

On PumpFun, token creators earn fees from trading activity on their tokens. There are multiple claim types:
- `creator_fee` — Creator fees from bonding curve trading
- `cashback` — Cashback rewards from the PumpFun incentive program
- `social_fee` — Social fees from referrals/shares

Fee claims are detected by monitoring Solana program logs for claim-related instructions on the Pump program (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`) and the PumpFees program (`pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ`).

## Objective

Create a **Fee Claims** page that shows real-time fee claim events. Same Telegram-clone theme as the rest of PumpKit.

## What to Create

### 1. New Hook: `pumpkit/packages/web/src/hooks/useClaimStream.ts`

Connect to WebSocket endpoints (tried in order with auto-reconnect + exponential backoff):
1. `wss://pumpportal.fun/api/data` (protocol: `pumpportal`) — send `{ "method": "subscribeTokenTrade", "keys": ["all"] }` on open. PumpPortal may surface claim events in its trade stream.
2. `wss://pump-fun-websocket-production.up.railway.app/ws` (protocol: `relay`) — no subscription needed. The relay server monitors both Pump and PumpFees programs and emits claim events.

**PumpPortal messages:** Flat JSON. Fee claim events are less common on PumpPortal. Look for messages containing claim indicators — some may come through as trade events with specific patterns. For any message, check if `txType` contains `claim` or if there's a `claimType` field.

**Relay messages:** JSON with `type` field. Skip `heartbeat` and `status` messages. Claim events have `type: 'claim'` with fields: `claimerWallet`, `tokenMint`/`mint`, `tokenName`, `tokenSymbol`, `amountSol`/`solAmount`, `claimType` (`creator_fee`|`cashback`|`social_fee`), `signature`.

**Since real claim data may be sparse**, include a mock/demo mode that generates sample claim events every 5-10 seconds when no real data is flowing, so the page isn't empty. Toggle between live and demo with a state flag.

Export:
```typescript
type ClaimType = 'creator_fee' | 'cashback' | 'social_fee';

interface ClaimEntry {
  id: string;
  claimerWallet: string;
  mint: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  amountSol: number;
  claimType: ClaimType;
  signature: string;
  timestamp: string;
  isNew: boolean;
}

interface ClaimStats {
  total: number;
  totalSol: number;
  creatorFees: number;
  cashback: number;
  socialFees: number;
  rate: number;
}

function useClaimStream(): {
  claims: ClaimEntry[];
  status: ConnectionStatus;
  stats: ClaimStats;
  isDemo: boolean;
}
```

### 2. New Page: `pumpkit/packages/web/src/pages/LiveClaims.tsx`

Telegram-themed fee claims page. Use these Tailwind color classes (already defined):
- `bg-tg-chat`, `bg-tg-bubble-in`, `bg-tg-bubble`, `bg-tg-input`, `bg-tg-blue`
- `text-pump-green` (claim accent — money!), `text-pump-yellow`, `text-pump-cyan`, `text-pump-purple`
- `rounded-2xl rounded-tl-sm` for incoming bubbles, `rounded-2xl rounded-br-sm` for outgoing

Layout pattern (copy from LiveLaunches.tsx / LiveTrades.tsx):
- Sticky filter bar at top with `StatusDot` component (import from `../components/StatusDot`)
- Filter buttons: All, 💰 Creator Fees, 🎁 Cashback, 🤝 Social Fees
- Search input to filter by wallet/token
- Demo/Live mode indicator
- Stats panel as outgoing bubble showing: total claims, total SOL claimed, creator fees count, cashback count, social fees count, rate/s
- Each claim as an incoming chat bubble with:
  - 💰 emoji avatar (use `bg-pump-green` for the avatar circle)
  - Claim type badge (Creator Fee / Cashback / Social Fee) with color coding
  - SOL amount in green font
  - Token name + mint link → `https://pump.fun/coin/{mint}`
  - Claimer wallet link → `https://solscan.io/account/{wallet}`
  - Button: "View TX" (Solscan link)
- Empty state with 💰 emoji: "Waiting for fee claims…"

### 3. Wire into Router

Edit `pumpkit/packages/web/src/main.tsx`:
- Add import: `import { LiveClaims } from './pages/LiveClaims';`
- Add route after `live/trades`: `<Route path="live/claims" element={<LiveClaims />} />`

### 4. Wire into Sidebar

Edit `pumpkit/packages/web/src/components/Layout.tsx`:
- Add entry to the `channels` array after the `Live Trades` entry:
  `{ path: '/live/claims', label: 'Fee Claims', emoji: '💰', preview: 'Creator fee & cashback claims', unread: false },`

## Reference Files (READ these, don't modify)

- `pumpkit/packages/web/src/hooks/useTradeStream.ts` — WebSocket hook pattern with stats
- `pumpkit/packages/web/src/hooks/useLaunchStream.ts` — simpler WebSocket hook
- `pumpkit/packages/web/src/pages/LiveTrades.tsx` — page component with filters + stats
- `pumpkit/packages/web/src/pages/LiveLaunches.tsx` — simpler page pattern
- `pumpkit/packages/web/src/components/StatusDot.tsx` — status indicator
- `pumpkit/packages/web/src/components/EventCard.tsx` — claim rendering in EventContent
- `pumpkit/packages/web/tailwind.config.js` — theme colors
- `pumpkit/packages/web/src/lib/types.ts` — `ClaimEvent` type definition

## Rules

- Create NEW files only — do not modify existing hooks or pages (except main.tsx and Layout.tsx for wiring)
- Use the exact same Tailwind classes and Telegram theme as existing pages
- All external links open in `target="_blank"` with `rel="noopener noreferrer"`
- Use `https://pump.fun/coin/{mint}` for token links, `https://solscan.io/tx/{sig}` for TX links, `https://solscan.io/account/{addr}` for wallet links
- Export the page component as named export (not default)
- No `npx tsc --noEmit` — use `npm run typecheck` if type-checking is needed
