# Tutorial 26: Live Dashboard Deployment

> Deploy real-time token launch and trading dashboards — zero build step, standalone HTML files that connect to the WebSocket relay.

## Prerequisites

- A running WebSocket relay server (see [Tutorial 21](./21-websocket-realtime-feeds.md))
- A web server or static hosting (Vercel, Netlify, GitHub Pages, or just `python3 -m http.server`)

## What's Included

The `live/` directory contains three standalone dashboards:

| Dashboard | File | Purpose |
|-----------|------|---------|
| Token Launches | `live/index.html` | Matrix-style terminal feed of new token launches |
| Trade Analytics | `live/trades.html` | Buy/sell feed with whale alerts and volume charts |
| Analytics | `live/dashboard.html` | Token analytics dashboard |

**No build step required** — these are plain HTML/CSS/JS files. Deploy anywhere.

## Step 1: Quick Local Start

```bash
cd live
python3 -m http.server 8080
```

Open `http://localhost:8080` in your browser. The dashboards will attempt to connect to the WebSocket relay.

## Step 2: Configure the WebSocket Endpoint

Each dashboard connects to a WebSocket URL. Edit the connection URL in the HTML file or pass it as a query parameter:

```html
<!-- In live/index.html, find the WebSocket connection -->
<script>
  // Default relay URL — change to your deployment
  const WS_URL = new URLSearchParams(window.location.search).get('ws')
    || 'wss://your-relay.example.com/ws';

  const ws = new WebSocket(WS_URL);
</script>
```

Or open with a query parameter:
```
http://localhost:8080/index.html?ws=ws://localhost:3099/ws
```

## Step 3: Token Launches Dashboard

The `index.html` dashboard provides a Matrix-inspired terminal UI:

**Features:**
- Real-time token launch feed with fade-in animations
- GitHub repository detection (highlighted)
- Connection status indicator
- Stats bar: total launches, uptime, connected clients
- Multi-endpoint failover
- Monospace terminal aesthetic (`#0a0a0a` background, `#00ff41` green text)

**Customization — Color Scheme:**

```css
/* Override the default Matrix green theme */
:root {
  --bg: #0a0a0a;
  --text: #00ff41;
  --accent: #00cc33;
  --dim: #006618;
  --highlight: #ffcc00;
}
```

**Customization — Add Token Filtering:**

```javascript
// Add after the ws.onmessage handler
function shouldDisplayLaunch(launch) {
  // Only show tokens with social links
  if (!launch.twitter && !launch.telegram && !launch.website) {
    return false;
  }
  // Only show tokens with minimum market cap
  if (launch.marketCapSol && launch.marketCapSol < 0.5) {
    return false;
  }
  return true;
}
```

## Step 4: Trade Analytics Dashboard

The `trades.html` dashboard provides detailed trading analytics:

**Features:**
- Color-coded trade types:
  - Buy: green (`#00ff41`)
  - Sell: red (`#ff4141`)
  - Create: yellow (`#ffcc00`)
  - Migrate: purple (`#b366ff`)
- Whale detection with sound alerts
- Event volume chart
- Token tracker sidebar
- Demo mode for testing
- Responsive layout (sidebar hides on mobile)

**Enable Whale Alerts:**

```javascript
const WHALE_THRESHOLD_SOL = 10; // Trades above this trigger alerts

function isWhale(trade) {
  return trade.solAmount >= WHALE_THRESHOLD_SOL;
}
```

## Step 5: Deploy to Vercel

The `live/` directory includes a `vercel.json` for instant deployment:

```bash
cd live
npx vercel
```

### vercel.json

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/$1" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=300" }
      ]
    }
  ]
}
```

## Step 6: Deploy to GitHub Pages

```bash
# From the repo root
git subtree push --prefix live origin gh-pages
```

## Step 7: Deploy with Docker

```dockerfile
FROM nginx:alpine
COPY live/ /usr/share/nginx/html/
EXPOSE 80
```

```bash
docker build -t pump-dashboards .
docker run -p 8080:80 pump-dashboards
```

## Step 8: Build a Custom Dashboard

Combine the SDK with a dashboard for richer data:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Pump Dashboard</title>
  <style>
    body { background: #0a0a0a; color: #00ff41; font-family: monospace; }
    .card { border: 1px solid #00ff41; padding: 12px; margin: 8px; border-radius: 4px; }
    .buy { border-color: #00ff41; }
    .sell { border-color: #ff4141; }
    .whale { background: rgba(255, 204, 0, 0.1); border-color: #ffcc00; }
    .stats { display: flex; gap: 20px; padding: 10px; border-bottom: 1px solid #333; }
    .stat { text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="stats">
    <div class="stat">
      <div class="stat-value" id="totalLaunches">0</div>
      <div class="stat-label">Launches</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="totalTrades">0</div>
      <div class="stat-label">Trades</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="whaleCount">0</div>
      <div class="stat-label">Whale Trades</div>
    </div>
  </div>

  <div id="feed"></div>

  <script>
    let stats = { launches: 0, trades: 0, whales: 0 };
    const feed = document.getElementById('feed');
    const WHALE_SOL = 10;

    function connect() {
      const ws = new WebSocket('ws://localhost:3099/ws');

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === 'token-launch') {
          stats.launches++;
          addCard('buy', `🚀 ${msg.symbol || '???'} — ${msg.name || 'New Token'}`,
            `Mint: ${msg.mint}<br>Creator: ${msg.creator}`);
        }

        if (msg.type === 'trade') {
          stats.trades++;
          const isWhale = msg.solAmount >= WHALE_SOL;
          if (isWhale) stats.whales++;

          const cls = isWhale ? 'whale' : (msg.isBuy ? 'buy' : 'sell');
          const emoji = isWhale ? '🐋' : (msg.isBuy ? '📈' : '📉');
          addCard(cls, `${emoji} ${msg.isBuy ? 'BUY' : 'SELL'} ${msg.solAmount.toFixed(2)} SOL`,
            `Token: ${msg.mint}`);
        }

        updateStats();
      };

      ws.onclose = () => setTimeout(connect, 3000);
    }

    function addCard(cls, title, body) {
      const el = document.createElement('div');
      el.className = `card ${cls}`;
      el.innerHTML = `<strong>${title}</strong><br><small>${body}</small>`;
      feed.prepend(el);
      while (feed.children.length > 200) feed.removeChild(feed.lastChild);
    }

    function updateStats() {
      document.getElementById('totalLaunches').textContent = stats.launches;
      document.getElementById('totalTrades').textContent = stats.trades;
      document.getElementById('whaleCount').textContent = stats.whales;
    }

    connect();
  </script>
</body>
</html>
```

## Next Steps

- Run the WebSocket relay first: [Tutorial 21](./21-websocket-realtime-feeds.md)
- Add Telegram alerts: [Tutorial 22](./22-channel-bot-setup.md)
- Monitor on-chain claims: [Tutorial 16](./16-monitoring-claims.md)
