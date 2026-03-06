# PumpFun WebSocket Relay Server

Real-time token launch relay — connects to PumpFun's API, parses new token launches, and broadcasts structured events to browser clients over WebSocket.

```
PumpFun API ◄── SolanaMonitor ──► Relay Server (ws) ──► Browsers
  (polling)                         :3099/ws
```

## Quick Start

```bash
# Install
cd websocket-server
npm install

# Development (hot-reload)
npm run dev

# Production
npm run build
npm start
```

The server starts on `http://localhost:3099` and serves a built-in dashboard UI at the root path.

## WebSocket Endpoint

Connect to `ws://localhost:3099/ws` to receive real-time events.

```javascript
const ws = new WebSocket('ws://localhost:3099/ws');

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  switch (msg.type) {
    case 'token-launch': console.log('New token:', msg.name, msg.symbol, msg.mint); break;
    case 'status':       console.log('Server status:', msg);                        break;
    case 'heartbeat':    /* keep-alive */                                            break;
  }
};
```

### Message Types

#### `token-launch`

Emitted when a new token is created on PumpFun.

```json
{
  "type": "token-launch",
  "signature": "5xYz...",
  "time": "2026-02-27T12:00:00.000Z",
  "name": "MoonCat",
  "symbol": "MCAT",
  "mint": "ABC123...def",
  "creator": "9xYz...abc",
  "isV2": true,
  "metadataUri": "https://cf-ipfs.com/ipfs/Qm...",
  "imageUri": "https://cf-ipfs.com/ipfs/Qm...",
  "description": "The first cat on the moon",
  "marketCapSol": 28.5,
  "website": "https://mooncat.io",
  "twitter": "https://twitter.com/mooncat",
  "telegram": "https://t.me/mooncat",
  "hasGithub": true,
  "githubUrls": ["https://github.com/mooncat/contracts"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `signature` | `string` | Transaction signature or mint address |
| `time` | `string` | ISO 8601 timestamp |
| `name` | `string \| null` | Token name |
| `symbol` | `string \| null` | Token ticker symbol |
| `mint` | `string \| null` | Token mint address |
| `creator` | `string \| null` | Creator wallet address |
| `isV2` | `boolean` | Whether this is a v2 token |
| `metadataUri` | `string \| null` | IPFS/Arweave metadata URI |
| `imageUri` | `string \| null` | Token logo image URI |
| `description` | `string \| null` | Token description (max 200 chars) |
| `marketCapSol` | `number \| null` | Market cap in SOL |
| `website` | `string \| null` | Project website |
| `twitter` | `string \| null` | Twitter/X URL |
| `telegram` | `string \| null` | Telegram group URL |
| `hasGithub` | `boolean` | Whether GitHub URLs were found |
| `githubUrls` | `string[]` | Extracted GitHub URLs |

#### `status`

Broadcast every 10 seconds and on connection.

```json
{
  "type": "status",
  "connected": true,
  "uptime": 3600,
  "totalLaunches": 1234,
  "githubLaunches": 42,
  "clients": 7
}
```

| Field | Type | Description |
|-------|------|-------------|
| `connected` | `boolean` | Whether upstream data source is active |
| `uptime` | `number` | Server uptime in seconds |
| `totalLaunches` | `number` | Total token launches observed |
| `githubLaunches` | `number` | Launches with GitHub URLs |
| `clients` | `number` | Connected WebSocket clients |

#### `heartbeat`

Sent every 15 seconds to keep connections alive through proxies.

```json
{
  "type": "heartbeat",
  "ts": 1708789200000
}
```

## HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Built-in dashboard UI |
| `GET` | `/health` | Health check (JSON) |

### Health Check

```bash
curl http://localhost:3099/health
```

```json
{
  "status": "ok",
  "solana": true,
  "clients": 3,
  "totalLaunches": 567,
  "uptime": 7200.5
}
```

## Architecture

### Data Sources

The server uses a dual-source strategy:

1. **PumpFun API (primary)** — Polls `https://frontend-api-v3.pump.fun/coins` every 5 seconds for the latest token launches. This is the reliable data source that provides full token metadata (name, symbol, image, socials, market cap).

2. **Solana RPC WebSocket (bonus)** — Subscribes to `logsSubscribe` on the Pump program (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`). Public RPC endpoints often rate-limit this subscription, so it's used as a supplementary source when available.

### Components

| File | Purpose |
|------|---------|
| `src/server.ts` | HTTP server, WebSocket relay, broadcast logic |
| `src/solana-monitor.ts` | PumpFun API poller + Solana RPC subscriber |
| `src/types.ts` | Shared TypeScript interfaces |
| `public/index.html` | Built-in dashboard UI |

### Client Connection Flow

1. Client connects to `/ws`
2. Server sends current `status` message
3. Server sends up to 50 recent `token-launch` events (backfill)
4. Client receives real-time `token-launch` events as they occur
5. Client receives `heartbeat` every 15s and `status` every 10s

### Deduplication

Token launches are deduplicated by mint address. The server maintains a rolling set of the last 5,000 seen mints. The broadcast buffer keeps the 50 most recent launches for new client backfill.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3099` | HTTP/WebSocket listen port |
| `SOLANA_RPC_WS` | `wss://api.mainnet-beta.solana.com` | Solana RPC WebSocket URL |
| `IPFS_GATEWAY` | `https://cf-ipfs.com/ipfs/` | IPFS gateway for metadata |

## Deployment

### Railway (recommended)

The server includes a `railway.json` and `Dockerfile` for one-click Railway deployment.

```bash
railway up
```

**Production URL:** `https://pump-fun-websocket-production.up.railway.app`
- Health: `GET /health`
- WebSocket: `wss://pump-fun-websocket-production.up.railway.app/ws`
- Dashboard: `GET /`

### Docker

```bash
docker build -t pumpfun-ws .
docker run -p 3099:3099 pumpfun-ws
```

### Custom RPC

For higher throughput, use a dedicated Solana RPC:

```bash
SOLANA_RPC_WS=wss://your-rpc.example.com npm start
```

## Browser Example

```html
<script>
  const ws = new WebSocket('wss://pump-fun-websocket-production.up.railway.app/ws');

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'token-launch') {
      const el = document.createElement('div');
      el.textContent = `${msg.symbol || '???'} — ${msg.name || 'Unknown'} (${msg.mint?.slice(0, 8)}...)`;
      document.body.prepend(el);
    }
  };

  ws.onclose = () => setTimeout(() => location.reload(), 5000);
</script>
```

## Related

- **Live Token Monitor** — [`live/index.html`](../live/index.html) (standalone browser client using PumpPortal WebSocket)
- **Live Trade Dashboard** — [`live/trades.html`](../live/trades.html) (full trade analytics with whale alerts)
- **PumpOS Integration** — [`website/live.html`](../website/live.html) (embedded in PumpOS desktop)
