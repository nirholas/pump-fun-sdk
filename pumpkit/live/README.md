# Live Dashboards

Standalone browser-based dashboards for real-time PumpFun monitoring. No build step, no dependencies — each dashboard is a single self-contained HTML file. Open directly in a browser or deploy to any static host.

## Dashboards

### Token Launch Monitor (`index.html`)

Real-time feed of new token launches on PumpFun.

- **Matrix-style terminal UI** — green-on-black, monospaced, system-log aesthetic
- **Dual data source** — connects to PumpFun WebSocket relay or directly to Solana RPC (`logsSubscribe` on the Pump program)
- **Auto-reconnect** — exponential backoff with endpoint rotation when connections drop
- **Live metadata** — fetches token name, symbol, image, description, and social links from IPFS/Arweave
- **GitHub detection** — scans metadata for GitHub URLs and flags tokens with open-source repos
- **Market cap display** — shows initial market cap in SOL for each launch
- **Search / filter** — text filter to find tokens by name, symbol, or mint address
- **Stats bar** — total launches, launches/min rate, GitHub token count, connection status
- **Backfill** — receives up to 50 recent launches when first connecting
- **Links** — each entry links to pump.fun, Solscan explorer, and social profiles

**Data flow:**

```
Solana RPC (logsSubscribe)     PumpFun WebSocket Relay
         │                              │
         └──────────┬───────────────────┘
                    ▼
          index.html (browser)
           ├── Parse program logs
           ├── Decode Borsh CreateEvent
           ├── Fetch IPFS metadata
           └── Render live feed
```

### Trade Analytics (`trades.html`)

Real-time Solana trade analytics with whale detection.

- **Multi-event tracking** — buys, sells, token launches, migrations, graduations, and whale trades
- **Color-coded feed** — green (buys), red (sells), blue (launches), gold (graduations), purple (migrations)
- **Whale alerts panel** — dedicated sidebar for large trades above configurable SOL threshold
- **Whale sound effects** — optional audio alert on whale trades (Web Audio API)
- **Live chart** — rolling event volume chart rendered on `<canvas>`
- **Token tracker** — tracks unique tokens seen with per-token trade history
- **Demo mode** — built-in demo data generator for testing without a live connection
- **Triple data source** — PumpPortal WebSocket, custom relay server, and direct Solana RPC
- **Stats dashboard** — events/sec, total volume, unique tokens, connection status
- **On-chain decoding** — parses Borsh-encoded TradeEvent, CreateEvent, CompleteEvent, and migration logs
- **Responsive layout** — grid layout adapts to desktop and mobile

**Event types decoded:**

| Event | Description | Color |
|-------|-------------|-------|
| `buy` | Token purchase from bonding curve | Green |
| `sell` | Token sale back to bonding curve | Red |
| `create` | New token launch | Blue |
| `graduation` | Token completes bonding curve | Gold |
| `migration` | Token migrates to PumpAMM | Purple |

### Vanity Address Generator (`vanity.html`)

Client-side Solana vanity address generator — runs entirely in the browser.

- **Zero-trust security** — all key generation happens client-side. No keys or seeds ever leave the browser
- **Modern glassmorphism UI** — dark theme with frosted glass effects, subtle animations
- **Prefix matching** — generate addresses starting with a custom string (Base58 characters only)
- **Speed estimation** — displays estimated time based on prefix length and key generation rate
- **Rate counter** — shows keys/second being generated in real-time
- **Copy to clipboard** — one-click copy of public key, private key, or JSON keypair
- **Download keypair** — exports Solana CLI-compatible JSON keypair file
- **Input validation** — rejects invalid Base58 characters with clear error messages
- **Performance notes** — warns users about exponential difficulty with longer prefixes

**Security model:**

- Uses `@solana/web3.js` `Keypair.generate()` loaded via CDN
- No network requests during key generation
- Private key displayed only after explicit user action
- No server component — works offline after initial page load

## Setup

### Local Development

Each dashboard is a standalone HTML file. Serve them with any static file server:

```bash
# Option 1: Node.js
npx serve live/

# Option 2: Python
python3 -m http.server 8080 -d live/

# Option 3: Open directly
open live/vanity.html  # Works without a server (vanity generator only)
```

### Connecting to Live Data

The **Token Launch Monitor** and **Trade Analytics** dashboards need a data source to display real-time events. They support three connection modes:

#### 1. WebSocket Relay (recommended)

Start the PumpFun WebSocket relay server:

```bash
cd websocket-server
npm install && npm start
# Relay runs on http://localhost:3099
# WS endpoint: ws://localhost:3099/ws
```

The dashboards auto-detect and connect to `ws://localhost:3099/ws`.

#### 2. Direct Solana RPC

The dashboards can also connect directly to a Solana RPC WebSocket endpoint using `logsSubscribe` on the Pump program. This mode is subject to rate limits on public endpoints — use a dedicated RPC provider for production.

#### 3. PumpPortal WebSocket (trades.html only)

The trade analytics dashboard can connect to PumpPortal's WebSocket API for trade data, providing an alternative data source.

### Deploy to Vercel

```bash
cd live
vercel
```

The included [vercel.json](vercel.json) handles routing configuration. All three dashboards are served as static files.

### Deploy Anywhere

Since these are static HTML files, they work on any hosting platform:

- **Vercel** — `vercel` CLI or git push
- **Netlify** — drag and drop the `live/` folder
- **GitHub Pages** — push to a `gh-pages` branch
- **Cloudflare Pages** — connect your repo
- **S3 + CloudFront** — upload to a bucket

## Architecture Notes

### No Build Step

Each `.html` file is fully self-contained — CSS, JavaScript, and markup are all in a single file. This is intentional:

- **Zero dependencies** — no npm, no webpack, no build pipeline
- **Instant deployment** — upload the file and it works
- **Easy modification** — edit CSS/JS directly in the file
- **CDN-only externals** — only `@solana/web3.js` is loaded from CDN (vanity generator only)

### On-Chain Log Parsing

The dashboards decode PumpFun program logs directly in the browser. This includes:

- **Borsh deserialization** — reads binary instruction data (strings, public keys, u64/i64 integers)
- **Discriminator matching** — identifies CreateEvent, TradeEvent, CompleteEvent by their 8-byte discriminators
- **Base58 encoding** — converts raw bytes to Solana addresses

### Connection Resilience

Both real-time dashboards implement:

- **Endpoint rotation** — cycles through multiple WebSocket URLs if one fails
- **Exponential backoff** — delays reconnect attempts (1s → 2s → 4s → ... up to 30s)
- **Connection status indicator** — shows green/red in the header bar
- **Graceful degradation** — continues displaying cached data when disconnected

## File Structure

```
live/
├── index.html     # Token launch monitor (815 lines, 31KB)
├── trades.html    # Trade analytics dashboard (1048 lines, 46KB)
├── vanity.html    # Vanity address generator (909 lines, 38KB)
└── vercel.json    # Vercel deployment config
```
