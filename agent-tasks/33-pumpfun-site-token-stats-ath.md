# Task 33: PumpFun Site — Token Detail Page Redesign (Stats, ATH, Creator Rewards)

## Context

You are working in the `pump-fun-sdk` repository. The `pumpfun-site/` directory is a static token launchpad UI (pure HTML/CSS/JS, zero dependencies). The token detail page (`token.html`) shows chart, trading panel, thread, trades, holders, and token info — but the layout doesn't match the real pump.fun.

**Files to modify:**
- `pumpfun-site/token.html` (~508 lines) — page structure and inline scripts
- `pumpfun-site/styles.css` (~1196 lines) — styling

**DO NOT** modify `app.js`.

**Key info:** `token.html` loads data from the pump.fun API using a `?mint=` URL parameter. All dynamic content is loaded via inline `<script>` at the bottom, using fetch calls to `https://frontend-api-v3.pump.fun`. The page already has working: chart rendering, trade/buy/sell panel, thread messages, trades table, holders list, and token info sidebar.

## Objective

Add the following features to the token detail page that exist on the real pump.fun but are missing from our implementation:

1. **Stats row** — Price, Vol 24h, and % changes (5m, 1h, 6h, 24h)
2. **ATH (All-Time High) indicator** — visual bar showing current price vs ATH
3. **Creator rewards section** — shows if the creator earns fees
4. **"Join chat" and "Get notified" buttons** — action buttons near the thread

## Design Reference (pump.fun)

The real pump.fun token page has:
- Below the chart: a **stats row** with "Price: $0.0001234 | Vol 24h: $12.5K | 5m: +2.3% | 1h: -1.2% | 6h: +15% | 24h: +45%"
- An **ATH bar** showing "ATH: $0.005 | Current: $0.0001 | -98% from ATH" with a green/red progress bar
- In the info sidebar: **"Creator rewards"** section showing if rewards are enabled and the % share
- Near the thread: **"Join chat"** button and **"Get notified"** bell icon

## Requirements

### 1. Stats Row (below chart, above tabs)

Add a horizontal stats row between the chart and the trade/thread tabs:

```html
<div class="stats-row" id="statsRow">
  <div class="stat-item">
    <span class="stat-label">Price</span>
    <span class="stat-value" id="statPrice">—</span>
  </div>
  <div class="stat-item">
    <span class="stat-label">Vol 24h</span>
    <span class="stat-value" id="statVol24h">—</span>
  </div>
  <div class="stat-item">
    <span class="stat-label">5m</span>
    <span class="stat-value stat-change" id="stat5m">—</span>
  </div>
  <div class="stat-item">
    <span class="stat-label">1h</span>
    <span class="stat-value stat-change" id="stat1h">—</span>
  </div>
  <div class="stat-item">
    <span class="stat-label">6h</span>
    <span class="stat-value stat-change" id="stat6h">—</span>
  </div>
  <div class="stat-item">
    <span class="stat-label">24h</span>
    <span class="stat-value stat-change" id="stat24h">—</span>
  </div>
</div>
```

CSS:
```css
.stats-row {
  display: flex;
  gap: 4px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 12px;
  background: var(--bg-card);
  border-radius: 8px;
  min-width: 70px;
}
.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
}
.stat-value {
  font-size: 13px;
  font-weight: 600;
}
.stat-change.positive { color: var(--green); }
.stat-change.negative { color: #ff4d4d; }
```

### 2. ATH Indicator

Add an ATH section in the token info sidebar:

```html
<div class="info-row ath-row" id="athRow" style="display:none">
  <div class="ath-header">
    <span class="info-label">All-time high</span>
    <span class="ath-value" id="athValue">—</span>
  </div>
  <div class="ath-bar">
    <div class="ath-fill" id="athFill" style="width:0%"></div>
  </div>
  <span class="ath-change" id="athChange">—</span>
</div>
```

CSS:
```css
.ath-row {
  flex-direction: column;
  gap: 6px;
}
.ath-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ath-bar {
  width: 100%;
  height: 6px;
  background: rgba(255,77,77,0.2);
  border-radius: 3px;
  overflow: hidden;
}
.ath-fill {
  height: 100%;
  background: var(--green);
  border-radius: 3px;
  transition: width 0.3s;
}
.ath-change {
  font-size: 11px;
  color: var(--text-secondary);
}
```

### 3. Creator Rewards Section

Add to the token info sidebar, after the creator address:

```html
<div class="info-row" id="creatorRewardsRow" style="display:none">
  <span class="info-label">Creator rewards</span>
  <span class="info-value rewards-badge" id="creatorRewards">—</span>
</div>
```

CSS:
```css
.rewards-badge {
  background: rgba(123,255,105,0.1);
  color: var(--green);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
}
```

### 4. Thread Action Buttons

Add "Join chat" and "Get notified" buttons near the thread header:

```html
<div class="thread-actions">
  <button class="btn-thread-action" onclick="document.getElementById('replyInput')?.focus()">
    💬 Join chat
  </button>
  <button class="btn-thread-action btn-notify" title="Get notified">
    🔔
  </button>
</div>
```

CSS:
```css
.thread-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.btn-thread-action {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
  transition: border-color 0.2s;
}
.btn-thread-action:hover {
  border-color: var(--green);
}
.btn-notify {
  padding: 8px 12px;
}
```

### 5. Populate Stats from Trade Data

In the inline `<script>` at the bottom of `token.html`, after trades are fetched, calculate and populate the stats:

```javascript
function populateStats(trades, currentPrice) {
  const now = Date.now();
  const priceEl = document.getElementById('statPrice');
  if (priceEl) priceEl.textContent = currentPrice ? `$${currentPrice.toFixed(8)}` : '—';

  // Calculate volume from trades in last 24h
  const vol24h = trades
    .filter(t => (now - t.timestamp * 1000) < 86400000)
    .reduce((sum, t) => sum + (t.sol_amount || 0), 0);
  const volEl = document.getElementById('statVol24h');
  if (volEl) volEl.textContent = formatMcap(vol24h * 0.00000000114); // rough SOL→USD, adjust as needed

  // Price changes — compare earliest trade in window to current
  const windows = { '5m': 300, '1h': 3600, '6h': 21600, '24h': 86400 };
  for (const [label, secs] of Object.entries(windows)) {
    const el = document.getElementById(`stat${label.replace('m','m').replace('h','h')}`);
    // Map label to element id: 5m→stat5m, 1h→stat1h, etc.
    const id = `stat${label}`;
    const statEl = document.getElementById(id);
    if (!statEl || !currentPrice) continue;

    const cutoff = now - secs * 1000;
    const oldTrades = trades.filter(t => t.timestamp * 1000 >= cutoff);
    if (oldTrades.length < 2) { statEl.textContent = '—'; continue; }

    const oldPrice = oldTrades[oldTrades.length - 1]?.sol_amount / oldTrades[oldTrades.length - 1]?.token_amount || 0;
    const change = oldPrice ? ((currentPrice - oldPrice) / oldPrice * 100) : 0;
    statEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    statEl.classList.toggle('positive', change >= 0);
    statEl.classList.toggle('negative', change < 0);
  }
}
```

Call `populateStats(trades, currentPrice)` after loading trades. `currentPrice` can be derived from the most recent trade.

### 6. Verification

- Stats row should show below the chart with price and percentage changes
- Positive changes should be green, negative should be red
- ATH bar should render (even if placeholder data)
- Creator rewards section should appear if applicable
- "Join chat" button should focus the reply input
- All existing functionality (chart, trades, holders, thread) must still work

## Anti-Patterns

- Do NOT modify `app.js` — all changes go in `token.html` inline script and `styles.css`
- Do NOT add npm dependencies
- Do NOT break the existing chart rendering or trade table
- Do NOT hardcode any token data — everything comes from the API
