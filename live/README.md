# Live Dashboards

Standalone browser-based dashboards for real-time PumpFun monitoring. No build step required — open directly in a browser or deploy to Vercel.

## Dashboards

### Token Launch Monitor (`index.html`)

Real-time feed of new token launches on PumpFun.

- Matrix-style green-on-black terminal aesthetic
- WebSocket-powered live updates
- Links to token pages on PumpFun

### Trade Analytics (`trades.html`)

Real-time Solana trade analytics dashboard.

- Monitors buys, sells, token launches, migrations, and whale activity
- Color-coded events (green = buys, red = sells, gold = graduations)
- WebSocket connection to the relay server

### Vanity Address Generator (`vanity.html`)

Client-side Solana vanity address generator.

- Runs entirely in the browser — no key material leaves the client
- Modern glassmorphism UI design
- Prefix matching for custom addresses

## Setup

### Local

```bash
# Serve locally (any static file server works)
npx serve live/
# or
python3 -m http.server 8080 -d live/
```

Then open `http://localhost:8080` in your browser.

### With WebSocket Relay

The token launch and trade dashboards connect to a WebSocket server for real-time data. Start the relay first:

```bash
cd websocket-server
npm install && npm start
# Relay runs on :3099
```

Then open the dashboards — they connect to the relay automatically.

### Deploy to Vercel

```bash
cd live
vercel
```

Deployment config is in [vercel.json](vercel.json).

## File Structure

```
live/
├── index.html     # Token launch monitor
├── trades.html    # Trade analytics dashboard
├── vanity.html    # Vanity address generator
└── vercel.json    # Vercel deployment config
```
