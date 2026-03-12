# Tutorial 43: Standalone Plugin Artifacts — Interactive Chat Dashboards

> Build interactive iframe-based UIs that embed inside AI chat windows — real-time dashboards, trading forms, and charts that communicate bidirectionally with the host AI.

## Prerequisites

- HTML/CSS/JavaScript
- Understanding of `postMessage` for iframe communication
- Familiarity with [Tutorial 32](./32-plugin-delivery.md) and [Tutorial 41](./41-plugin-gateway-api-handlers.md)

## What Are Standalone Plugins?

Unlike default plugins (text in, text out), **standalone** plugins embed a full interactive UI inside the AI chat as an iframe:

```
┌─────────────────────────────────┐
│  AI Chat                        │
│                                 │
│  User: Show me token analytics  │
│                                 │
│  AI: Here's the dashboard:      │
│  ┌───────────────────────────┐  │
│  │  📊 Token Analytics       │  │
│  │  ┌─────┐ ┌─────┐        │  │
│  │  │Price│ │Vol  │         │  │
│  │  │Chart│ │Chart│         │  │
│  │  └─────┘ └─────┘        │  │
│  │  [Buy 1 SOL] [Refresh]  │  │
│  └───────────────────────────┘  │
│                                 │
│  User: Now check another token  │
└─────────────────────────────────┘
```

## Step 1: Plugin Manifest (Standalone Type)

```json
{
  "identifier": "pump-analytics-dashboard",
  "type": "standalone",

  "meta": {
    "title": "Pump Analytics Dashboard",
    "description": "Interactive token analytics with charts and trading controls",
    "avatar": "📊",
    "tags": ["analytics", "dashboard", "pump"]
  },

  "api": [
    {
      "name": "showDashboard",
      "description": "Show the interactive analytics dashboard for a token",
      "parameters": {
        "type": "object",
        "properties": {
          "mint": {
            "type": "string",
            "description": "Token mint address"
          }
        },
        "required": ["mint"]
      }
    }
  ],

  "ui": {
    "url": "https://your-domain.com/plugins/analytics/index.html",
    "width": 600,
    "height": 400,
    "mode": "iframe"
  }
}
```

The key difference: `type: "standalone"` + `ui` block tells the host to render an iframe instead of text.

## Step 2: Build the Standalone HTML

```html
<!-- plugins/analytics/index.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Token Analytics</title>
  <style>
    * { margin: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      padding: 16px;
      min-height: 100vh;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .header h2 { font-size: 16px; color: #58a6ff; }
    .status { font-size: 12px; color: #8b949e; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    .stat-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .stat-value {
      font-size: 20px;
      font-weight: bold;
      color: #3fb950;
    }
    .stat-label {
      font-size: 11px;
      color: #8b949e;
      margin-top: 4px;
    }

    .chart-area {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      min-height: 120px;
    }

    .actions {
      display: flex;
      gap: 8px;
    }
    button {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
    }
    .btn-buy { background: #238636; color: #fff; }
    .btn-sell { background: #da3633; color: #fff; }
    .btn-refresh { background: #30363d; color: #c9d1d9; }
    button:hover { opacity: 0.9; }

    .mint-display {
      font-family: monospace;
      font-size: 11px;
      color: #8b949e;
      word-break: break-all;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>📊 <span id="tokenName">Loading...</span></h2>
    <span class="status" id="status">Connecting</span>
  </div>

  <div class="mint-display" id="mintDisplay"></div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value" id="price">-</div>
      <div class="stat-label">SOL Price</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="mcap">-</div>
      <div class="stat-label">Market Cap</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="progress">-</div>
      <div class="stat-label">Curve Progress</div>
    </div>
  </div>

  <div class="chart-area" id="chart">
    <!-- Simple text-based price visualization -->
  </div>

  <div class="actions">
    <button class="btn-buy" onclick="sendAction('buy')">Buy 0.1 SOL</button>
    <button class="btn-sell" onclick="sendAction('sell')">Sell 50%</button>
    <button class="btn-refresh" onclick="requestData()">↻ Refresh</button>
  </div>

  <script>
    let currentMint = null;

    // ─── Communication with host AI ───

    // Listen for data from the host
    window.addEventListener("message", (event) => {
      const msg = event.data;

      if (msg.type === "plugin:init") {
        // Host sends initial parameters (from API call)
        currentMint = msg.params?.mint;
        document.getElementById("mintDisplay").textContent = currentMint || "";
        requestData();
      }

      if (msg.type === "plugin:data") {
        updateDashboard(msg.data);
      }
    });

    // Send messages back to the host AI
    function sendToHost(message) {
      window.parent.postMessage(message, "*");
    }

    // Request fresh data
    function requestData() {
      document.getElementById("status").textContent = "Loading...";
      sendToHost({
        type: "plugin:request",
        action: "fetchAnalytics",
        params: { mint: currentMint },
      });
    }

    // Send a trade action
    function sendAction(action) {
      sendToHost({
        type: "plugin:action",
        action: action,
        params: {
          mint: currentMint,
          amount: action === "buy" ? "0.1" : "50%",
        },
      });
    }

    // ─── UI Updates ───

    function updateDashboard(data) {
      document.getElementById("tokenName").textContent =
        escapeHtml(data.name || "Unknown");
      document.getElementById("price").textContent =
        (data.price || 0).toFixed(8);
      document.getElementById("mcap").textContent =
        formatUsd(data.marketCapUsd || 0);
      document.getElementById("progress").textContent =
        (data.curveProgress || 0).toFixed(1) + "%";

      // Simple text chart
      renderMiniChart(data.priceHistory || []);

      document.getElementById("status").textContent =
        `Updated ${new Date().toLocaleTimeString()}`;
    }

    function renderMiniChart(prices) {
      if (prices.length === 0) {
        document.getElementById("chart").textContent = "No price data yet";
        return;
      }

      const max = Math.max(...prices);
      const min = Math.min(...prices);
      const range = max - min || 1;
      const height = 6; // rows

      const lines = [];
      for (let row = height - 1; row >= 0; row--) {
        let line = "";
        for (const price of prices.slice(-40)) {
          const normalized = ((price - min) / range) * (height - 1);
          line += Math.round(normalized) >= row ? "█" : " ";
        }
        lines.push(line);
      }

      const chart = document.getElementById("chart");
      chart.style.fontFamily = "monospace";
      chart.style.fontSize = "12px";
      chart.style.whiteSpace = "pre";
      chart.style.color = "#3fb950";
      chart.textContent = lines.join("\n");
    }

    function formatUsd(amount) {
      if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
      if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
      return `$${amount.toFixed(0)}`;
    }

    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }

    // Signal readiness
    sendToHost({ type: "plugin:ready" });
  </script>
</body>
</html>
```

## Step 3: Host-Plugin Communication Protocol

```
Host (AI Chat)                    Plugin (iframe)
     │                                 │
     │── {type: "plugin:init",         │
     │    params: {mint: "..."}} ─────►│
     │                                 │
     │◄── {type: "plugin:ready"} ──────│
     │                                 │
     │◄── {type: "plugin:request",     │
     │     action: "fetchAnalytics"} ──│
     │                                 │
     │── {type: "plugin:data",         │
     │    data: {...}} ───────────────►│
     │                                 │
     │◄── {type: "plugin:action",      │
     │     action: "buy",              │
     │     params: {amount: "0.1"}} ───│
```

### Message Types

| Direction | Type | Purpose |
|-----------|------|---------|
| Host → Plugin | `plugin:init` | Send initial params (mint, config) |
| Plugin → Host | `plugin:ready` | Plugin loaded and ready |
| Plugin → Host | `plugin:request` | Request data fetch |
| Host → Plugin | `plugin:data` | Return fetched data |
| Plugin → Host | `plugin:action` | User-triggered action (buy, sell) |

## Step 4: API Handler for the Dashboard

The backend that fetches data for the standalone plugin:

```typescript
// api/pump-analytics/dashboard.ts
export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { mint } = await req.json();

  if (!mint || typeof mint !== "string") {
    return new Response(
      JSON.stringify({ error: "mint required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // In production, fetch real data from SDK
  const analytics = {
    mint,
    name: "PumpCoin",
    symbol: "PUMP",
    price: 0.00001234,
    marketCapUsd: 45000,
    curveProgress: 72.5,
    holders: 89,
    volume24hSol: 156.7,
    priceHistory: generateMockPrices(40),
  };

  return new Response(JSON.stringify(analytics), {
    headers: { "Content-Type": "application/json" },
  });
}

function generateMockPrices(count: number): number[] {
  const prices = [0.00001];
  for (let i = 1; i < count; i++) {
    const change = (Math.random() - 0.48) * 0.000002;
    prices.push(Math.max(0.000001, prices[i - 1] + change));
  }
  return prices;
}
```

## Step 5: Deploy

```bash
# Plugin HTML goes to static hosting
# API handlers deploy as edge functions

# Deploy with Vercel
cd packages/plugin.delivery
vercel deploy

# Or serve locally for development
npx serve plugins/analytics/ -p 8080
```

## Step 6: Register as a Plugin

```json
{
  "identifier": "pump-analytics-dashboard",
  "type": "standalone",
  "ui": {
    "url": "https://your-domain.com/plugins/analytics/index.html",
    "width": 600,
    "height": 400,
    "mode": "iframe"
  },
  "api": [{
    "name": "showDashboard",
    "description": "Show interactive token analytics dashboard",
    "parameters": {
      "type": "object",
      "properties": {
        "mint": { "type": "string" }
      },
      "required": ["mint"]
    }
  }]
}
```

## Security Considerations

| Risk | Mitigation |
|------|-----------|
| XSS in token names | Always use `textContent`, never `innerHTML` with external data |
| Malicious host messages | Validate `event.origin` in production |
| Click-jacking | Set `X-Frame-Options` headers appropriately |
| Data injection | Sanitize all data from `postMessage` events |

## Next Steps

- See [Tutorial 41](./41-plugin-gateway-api-handlers.md) for backend API handlers
- See [Tutorial 26](./26-live-dashboard-deployment.md) for standalone dashboard deployment
