# Task 35: PumpFun Site — Chart Timeframe Dropdown & Enhanced Candlestick Chart

## Context

You are working in the `pump-fun-sdk` repository. The `pumpfun-site/` directory is a static token launchpad UI (pure HTML/CSS/JS, zero dependencies). The token detail page (`token.html`) has a candlestick chart rendered in SVG with timeframe buttons (1m, 5m, 15m, 1h, 4h, 1D), but it doesn't match pump.fun's chart controls or quality.

**Files to modify:**
- `pumpfun-site/token.html` (~508 lines) — chart HTML and inline script containing `renderTradeChart(trades)`
- `pumpfun-site/styles.css` (~1196 lines) — chart styling

**Key function:** `renderTradeChart(trades)` in the inline script — takes an array of trades, aggregates them into candle buckets, and renders SVG candlesticks. Timeframe buttons re-fetch trades with different limits.

## Objective

1. Replace the timeframe buttons with a **dropdown selector** like pump.fun (showing "1s | 5s | 15s | 30s | 1m | 5m | 15m | 30m | 1h | 2h | 4h | 6h | 12h | 24h")
2. Improve the chart with **Y-axis labels** (price scale), **X-axis labels** (time), **crosshair on hover**, and **OHLC tooltip**
3. Add a **volume bar chart** below the candlestick chart
4. Add chart type toggle: **Candle | Line**

## Design Reference (pump.fun)

Pump.fun's chart:
- Timeframe dropdown at top-right showing intervals from "1s" to "24h"
- Chart type toggle: Candle vs Line icons
- Y-axis: price labels on right side
- X-axis: time labels at bottom
- Green candles for up, red for down
- Volume bars at bottom (semi-transparent)
- Hover: vertical crosshair line + tooltip showing O/H/L/C + volume
- Current price label on right axis

## Requirements

### 1. Chart Controls HTML

Replace the current timeframe buttons with:

```html
<div class="chart-controls">
  <div class="chart-type-toggle">
    <button class="chart-type-btn active" data-type="candle" onclick="setChartType('candle')" title="Candlestick">
      <svg width="16" height="16" viewBox="0 0 16 16"><rect x="3" y="2" width="2" height="12" fill="currentColor" rx="1"/><rect x="7" y="5" width="2" height="6" fill="currentColor" rx="1"/><rect x="11" y="3" width="2" height="10" fill="currentColor" rx="1"/></svg>
    </button>
    <button class="chart-type-btn" data-type="line" onclick="setChartType('line')" title="Line">
      <svg width="16" height="16" viewBox="0 0 16 16"><path d="M1 12 L5 6 L9 9 L15 3" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>
    </button>
  </div>

  <div class="chart-timeframe">
    <select id="timeframeSelect" onchange="changeTimeframe(this.value)">
      <option value="60">1m</option>
      <option value="300" selected>5m</option>
      <option value="900">15m</option>
      <option value="1800">30m</option>
      <option value="3600">1h</option>
      <option value="7200">2h</option>
      <option value="14400">4h</option>
      <option value="21600">6h</option>
      <option value="43200">12h</option>
      <option value="86400">24h</option>
    </select>
  </div>
</div>
```

### 2. Enhanced Chart Rendering

Update `renderTradeChart` to include:

**Y-axis labels:**
```javascript
// Add price scale on right side of chart
const priceSteps = 5;
for (let i = 0; i <= priceSteps; i++) {
  const price = minPrice + (maxPrice - minPrice) * (1 - i / priceSteps);
  const y = padding.top + (chartHeight * i / priceSteps);
  // Grid line
  svgContent += `<line x1="${padding.left}" y1="${y}" x2="${chartWidth + padding.left}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
  // Price label
  svgContent += `<text x="${chartWidth + padding.left + 5}" y="${y + 4}" fill="var(--text-secondary)" font-size="10">${formatPrice(price)}</text>`;
}
```

**X-axis labels:**
```javascript
// Add time labels at bottom
const timeSteps = Math.min(6, candles.length);
for (let i = 0; i < timeSteps; i++) {
  const idx = Math.floor(i * candles.length / timeSteps);
  const candle = candles[idx];
  const x = padding.left + idx * candleWidth + candleWidth / 2;
  svgContent += `<text x="${x}" y="${chartHeight + padding.top + 14}" fill="var(--text-secondary)" font-size="9" text-anchor="middle">${formatTime(candle.time)}</text>`;
}
```

**Volume bars (at bottom of chart):**
```javascript
// Render volume bars in bottom 20% of chart
const volHeight = chartHeight * 0.15;
const maxVol = Math.max(...candles.map(c => c.volume));
candles.forEach((candle, i) => {
  const x = padding.left + i * candleWidth + candleWidth * 0.2;
  const barH = maxVol > 0 ? (candle.volume / maxVol) * volHeight : 0;
  const y = chartHeight + padding.top - barH;
  const color = candle.close >= candle.open ? 'rgba(123,255,105,0.3)' : 'rgba(255,77,77,0.3)';
  svgContent += `<rect x="${x}" y="${y}" width="${candleWidth * 0.6}" height="${barH}" fill="${color}" rx="1"/>`;
});
```

**Hover crosshair (interactive SVG overlay):**
```javascript
// Add invisible rect for mouse events + crosshair elements
svgContent += `
  <line id="crosshairV" x1="0" y1="${padding.top}" x2="0" y2="${chartHeight + padding.top}" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4" style="display:none"/>
  <line id="crosshairH" x1="${padding.left}" y1="0" x2="${chartWidth + padding.left}" y2="0" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4" style="display:none"/>
  <rect class="chart-overlay" x="${padding.left}" y="${padding.top}" width="${chartWidth}" height="${chartHeight}" fill="transparent" style="cursor:crosshair"/>
`;
```

Add mouse event listeners after rendering:
```javascript
const overlay = svg.querySelector('.chart-overlay');
const crossV = svg.getElementById('crosshairV');
const crossH = svg.getElementById('crosshairH');

overlay?.addEventListener('mousemove', (e) => {
  const rect = svg.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  crossV.setAttribute('x1', x); crossV.setAttribute('x2', x);
  crossH.setAttribute('y1', y); crossH.setAttribute('y2', y);
  crossV.style.display = crossH.style.display = 'block';

  // Find nearest candle and show tooltip
  const candleIdx = Math.floor((x - padding.left) / candleWidth);
  if (candleIdx >= 0 && candleIdx < candles.length) {
    const c = candles[candleIdx];
    updateChartTooltip(c, x, y);
  }
});

overlay?.addEventListener('mouseleave', () => {
  crossV.style.display = crossH.style.display = 'none';
  hideChartTooltip();
});
```

### 3. Chart Tooltip

Add a tooltip div:
```html
<div class="chart-tooltip" id="chartTooltip" style="display:none">
  <div class="tooltip-row"><span>O:</span> <span id="ttOpen">—</span></div>
  <div class="tooltip-row"><span>H:</span> <span id="ttHigh">—</span></div>
  <div class="tooltip-row"><span>L:</span> <span id="ttLow">—</span></div>
  <div class="tooltip-row"><span>C:</span> <span id="ttClose">—</span></div>
  <div class="tooltip-row"><span>Vol:</span> <span id="ttVol">—</span></div>
</div>
```

CSS:
```css
.chart-tooltip {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(14,14,22,0.9);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 11px;
  pointer-events: none;
  z-index: 10;
}
.tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.tooltip-row span:first-child {
  color: var(--text-secondary);
}
```

### 4. Line Chart Mode

Add a line chart renderer:
```javascript
function renderLineChart(candles, svg, padding, chartWidth, chartHeight, minPrice, maxPrice) {
  let pathD = '';
  let areaD = `M ${padding.left} ${chartHeight + padding.top} `;

  candles.forEach((c, i) => {
    const x = padding.left + i * (chartWidth / candles.length) + (chartWidth / candles.length / 2);
    const y = padding.top + chartHeight - ((c.close - minPrice) / (maxPrice - minPrice)) * chartHeight;
    pathD += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
    areaD += `L ${x} ${y} `;
  });

  areaD += `L ${padding.left + chartWidth} ${chartHeight + padding.top} Z`;

  return `
    <path d="${areaD}" fill="url(#lineGrad)" opacity="0.3"/>
    <path d="${pathD}" stroke="var(--green)" fill="none" stroke-width="2"/>
    <defs>
      <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--green)" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="var(--green)" stop-opacity="0"/>
      </linearGradient>
    </defs>
  `;
}
```

### 5. CSS for Controls

```css
.chart-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}
.chart-type-toggle {
  display: flex;
  gap: 2px;
  background: var(--bg);
  border-radius: 6px;
  padding: 2px;
}
.chart-type-btn {
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
}
.chart-type-btn.active {
  background: var(--bg-card);
  color: var(--text);
}
.chart-timeframe select {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}
```

### 6. Helper Functions

```javascript
function formatPrice(p) {
  if (p < 0.00001) return p.toExponential(2);
  if (p < 0.01) return p.toFixed(6);
  if (p < 1) return p.toFixed(4);
  return p.toFixed(2);
}

function formatTime(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
```

### 7. Verification

- Timeframe dropdown should show 10 options from 1m to 24h
- Selecting a timeframe should re-fetch trades and re-render
- Candle/Line toggle should switch chart type
- Y-axis should show price labels
- X-axis should show time labels
- Volume bars should appear at bottom of chart
- Hover should show crosshair + OHLC tooltip
- Current price label should still appear on right axis
- Chart should be responsive

## Anti-Patterns

- Do NOT add any charting library (TradingView, Chart.js, etc.) — pure SVG
- Do NOT modify `app.js`
- Do NOT add npm dependencies
- Do NOT break the existing trade data fetching
