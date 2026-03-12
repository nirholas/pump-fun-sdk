# Tutorial 21: WebSocket Real-Time Token Feeds

> Stream live token launches and trades from the Solana blockchain to your browser or Node.js app.

## Prerequisites

- Node.js 18+
- A Solana RPC endpoint with WebSocket support

```bash
npm install ws express @solana/web3.js
```

## Architecture

The Pump SDK includes a WebSocket relay server that bridges Solana RPC events to browser clients:

```
┌─────────────────┐     WebSocket     ┌───────────────┐     WebSocket     ┌─────────────┐
│  Solana RPC     │ ◄───────────────► │  Relay Server │ ◄───────────────► │  Browser /  │
│  (mainnet)      │    (subscribe)    │  (port 3099)  │    (broadcast)    │  Node.js    │
└─────────────────┘                   └───────────────┘                   └─────────────┘
```

**Message types flowing to clients:**
- `token-launch` — New token created on Pump
- `status` — Server health and statistics
- `heartbeat` — Keep-alive ping every 15s

## Step 1: Start the Relay Server

Clone and run the built-in relay:

```bash
cd websocket-server
npm install
npm start
```

Or configure with environment variables:

```bash
PORT=3099 \
SOLANA_RPC_WS=wss://api.mainnet-beta.solana.com \
npm start
```

The server exposes:
- `ws://localhost:3099/ws` — WebSocket endpoint
- `http://localhost:3099/health` — Health check (JSON)
- `http://localhost:3099/` — Built-in dashboard

## Step 2: Connect from the Browser

```html
<!DOCTYPE html>
<html>
<head><title>Pump Token Feed</title></head>
<body>
  <h1>Live Token Launches</h1>
  <div id="stats"></div>
  <div id="feed"></div>

  <script>
    const feed = document.getElementById('feed');
    const stats = document.getElementById('stats');
    let ws;

    function connect() {
      ws = new WebSocket('ws://localhost:3099/ws');

      ws.onopen = () => {
        console.log('Connected to relay');
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'token-launch':
            handleLaunch(msg);
            break;
          case 'status':
            handleStatus(msg);
            break;
          case 'heartbeat':
            // Connection alive
            break;
        }
      };

      ws.onclose = () => {
        console.log('Disconnected, reconnecting in 3s...');
        setTimeout(connect, 3000);
      };
    }

    function handleLaunch(launch) {
      const el = document.createElement('div');
      el.className = 'launch';
      el.innerHTML = `
        <strong>${launch.symbol || '???'}</strong> — ${launch.name || 'Unknown'}
        <br>Mint: <code>${launch.mint}</code>
        <br>Creator: <code>${launch.creator}</code>
        ${launch.hasGithub ? '<br>🔧 Has GitHub repo!' : ''}
        ${launch.marketCapSol ? `<br>Market Cap: ${launch.marketCapSol.toFixed(2)} SOL` : ''}
        <br><small>${new Date(launch.time).toLocaleTimeString()}</small>
        <hr>
      `;
      feed.prepend(el);

      // Keep only last 100 launches in DOM
      while (feed.children.length > 100) {
        feed.removeChild(feed.lastChild);
      }
    }

    function handleStatus(status) {
      stats.innerHTML = `
        Connected: ${status.connected} |
        Uptime: ${Math.floor(status.uptime / 60)}m |
        Total Launches: ${status.totalLaunches} |
        GitHub Launches: ${status.githubLaunches} |
        Clients: ${status.clients}
      `;
    }

    connect();
  </script>
</body>
</html>
```

## Step 3: Connect from Node.js

```typescript
import WebSocket from "ws";

interface TokenLaunchEvent {
  type: "token-launch";
  signature: string;
  time: string;
  name: string | null;
  symbol: string | null;
  metadataUri: string | null;
  mint: string | null;
  creator: string | null;
  isV2: boolean;
  hasGithub: boolean;
  githubUrls: string[];
  imageUri: string | null;
  description: string | null;
  marketCapSol: number | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
}

interface ServerStatus {
  type: "status";
  connected: boolean;
  uptime: number;
  totalLaunches: number;
  githubLaunches: number;
  clients: number;
}

function connectToRelay(url: string = "ws://localhost:3099/ws") {
  const ws = new WebSocket(url);

  ws.on("open", () => {
    console.log("Connected to Pump relay server");
  });

  ws.on("message", (data: WebSocket.Data) => {
    const msg = JSON.parse(data.toString());

    if (msg.type === "token-launch") {
      const launch = msg as TokenLaunchEvent;
      console.log(
        `[LAUNCH] ${launch.symbol} (${launch.name}) — ${launch.mint}`
      );

      if (launch.hasGithub) {
        console.log(`  GitHub: ${launch.githubUrls.join(", ")}`);
      }

      if (launch.marketCapSol) {
        console.log(`  Market Cap: ${launch.marketCapSol.toFixed(4)} SOL`);
      }
    }

    if (msg.type === "status") {
      const status = msg as ServerStatus;
      console.log(
        `[STATUS] Launches: ${status.totalLaunches} | Clients: ${status.clients}`
      );
    }
  });

  ws.on("close", () => {
    console.log("Disconnected, reconnecting in 3s...");
    setTimeout(() => connectToRelay(url), 3000);
  });

  return ws;
}

connectToRelay();
```

## Step 4: Filter and React to Launches

Build a filter pipeline to watch for specific patterns:

```typescript
interface LaunchFilter {
  minMarketCap?: number;
  requireGithub?: boolean;
  symbolPattern?: RegExp;
  requireSocials?: boolean;
}

function matchesFilter(
  launch: TokenLaunchEvent,
  filter: LaunchFilter
): boolean {
  if (filter.minMarketCap && (launch.marketCapSol ?? 0) < filter.minMarketCap) {
    return false;
  }
  if (filter.requireGithub && !launch.hasGithub) {
    return false;
  }
  if (filter.symbolPattern && launch.symbol && !filter.symbolPattern.test(launch.symbol)) {
    return false;
  }
  if (filter.requireSocials && !launch.twitter && !launch.telegram && !launch.website) {
    return false;
  }
  return true;
}

// Example: Only show tokens with GitHub repos and > 1 SOL market cap
const myFilter: LaunchFilter = {
  minMarketCap: 1.0,
  requireGithub: true,
};

ws.on("message", (data: WebSocket.Data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === "token-launch" && matchesFilter(msg, myFilter)) {
    console.log(`[MATCH] ${msg.symbol} — ${msg.mint}`);
    // Trigger your trading logic, alerts, etc.
  }
});
```

## Step 5: Build Your Own Relay Server

If you want to customize the relay or add new event types:

```typescript
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { Connection } from "@solana/web3.js";

const PORT = parseInt(process.env.PORT || "3099", 10);
const SOLANA_RPC_WS = process.env.SOLANA_RPC_WS || "wss://api.mainnet-beta.solana.com";
const HEARTBEAT_INTERVAL = 15_000;
const MAX_RECENT = 50;

// HTTP server for health checks
const httpServer = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", clients: wss.clients.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

// WebSocket server
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
const recentLaunches: any[] = [];

wss.on("connection", (client) => {
  // Send recent launches to new clients
  for (const launch of recentLaunches) {
    client.send(JSON.stringify(launch));
  }
});

// Broadcast to all connected clients
function broadcast(message: object) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Heartbeat
setInterval(() => {
  broadcast({ type: "heartbeat", ts: Date.now() });
}, HEARTBEAT_INTERVAL);

httpServer.listen(PORT, () => {
  console.log(`Relay server running on port ${PORT}`);
});
```

## Deployment

### Local Development
```bash
PORT=3099 SOLANA_RPC_WS=wss://api.devnet.solana.com npm start
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3099
CMD ["node", "dist/index.js"]
```

### Railway / Vercel
The `websocket-server/` directory is deployment-ready. Set `PORT` and `SOLANA_RPC_WS` in your environment.

## Next Steps

- Combine with [Tutorial 11](./11-trading-bot.md) to auto-trade on launch events
- Use [Tutorial 22](./22-channel-bot-setup.md) to broadcast to Telegram
- Deploy the [live dashboards](./26-live-dashboard-deployment.md) for a visual feed
