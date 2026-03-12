# Task 34: PumpFun Site — Token Detail Holders Redesign (Bubble Map + Top Holders)

## Context

You are working in the `pump-fun-sdk` repository. The `pumpfun-site/` directory is a static token launchpad UI (pure HTML/CSS/JS, zero dependencies). The token detail page (`token.html`) has a basic holders list, but pump.fun shows holders with a **Bubble map** visualization and a toggle between list and bubble views.

**Files to modify:**
- `pumpfun-site/token.html` (~508 lines) — holders section HTML and inline script
- `pumpfun-site/styles.css` (~1196 lines) — holder styles

**Key info:** The inline script in `token.html` already fetches holder data. The `holderList` element is populated with holder entries. Currently it shows a simple vertical list with address + percentage bar.

## Objective

Redesign the holders section to match pump.fun:
1. **Toggle between "Top holders" list and "Bubble map" view**
2. **Top holders list** — show rank, colored dot, short address, percentage, with a horizontal bar
3. **Bubble map** — SVG visualization where each holder is a circle sized by their percentage
4. **Dev/Creator badge** — mark the creator's address with a special badge

## Design Reference (pump.fun)

Pump.fun's holders section:
- Header: "Top holders" with toggle buttons [List | Bubble map]
- List view: numbered rows, each showing:
  - Rank number (1, 2, 3...)
  - Colored circle (unique per holder)
  - Short address (e.g. "8xJ2...k4Fp")
  - If creator: "👑 dev" badge
  - Percentage held (e.g. "4.2%")
  - Small horizontal bar (width proportional to %)
- Bubble map view: SVG with circles packed, sizes proportional to holdings
  - Hover on a bubble shows tooltip with address + percentage
  - Largest bubble in center, smaller ones around it

## Requirements

### 1. Holders Section HTML

Replace the current holders section with:

```html
<div class="holders-section">
  <div class="holders-header">
    <h3>Top holders</h3>
    <div class="holders-toggle">
      <button class="holder-view-btn active" data-view="list" onclick="switchHolderView('list')">List</button>
      <button class="holder-view-btn" data-view="bubble" onclick="switchHolderView('bubble')">Bubble map</button>
    </div>
  </div>

  <div class="holders-list-view" id="holderListView">
    <div id="holderList">
      <!-- Populated by JS -->
    </div>
  </div>

  <div class="holders-bubble-view" id="holderBubbleView" style="display:none">
    <svg id="bubbleMap" width="100%" height="300" viewBox="0 0 400 300"></svg>
  </div>
</div>
```

### 2. Holder List Item HTML (in inline script)

When rendering holders, use this template for each:

```javascript
function renderHolderItem(holder, index, creatorAddress) {
  const isDev = holder.address === creatorAddress;
  const color = HOLDER_COLORS[index % HOLDER_COLORS.length];
  const pct = holder.percentage.toFixed(2);

  return `
    <div class="holder-item">
      <span class="holder-rank">${index + 1}</span>
      <span class="holder-dot" style="background:${color}"></span>
      <span class="holder-addr">
        ${shortAddr(holder.address)}
        ${isDev ? '<span class="holder-dev-badge">👑 dev</span>' : ''}
      </span>
      <span class="holder-pct">${pct}%</span>
      <div class="holder-bar">
        <div class="holder-bar-fill" style="width:${Math.min(pct, 100)}%;background:${color}"></div>
      </div>
    </div>
  `;
}

const HOLDER_COLORS = [
  '#7bff69', '#00d4ff', '#ff6b6b', '#f0c040', '#a78bfa',
  '#fb7185', '#34d399', '#60a5fa', '#fbbf24', '#c084fc',
  '#f472b6', '#22d3ee', '#4ade80', '#818cf8', '#fb923c'
];
```

### 3. Bubble Map Rendering

Add a bubble map renderer:

```javascript
function renderBubbleMap(holders, creatorAddress) {
  const svg = document.getElementById('bubbleMap');
  if (!svg || !holders.length) return;

  const width = 400, height = 300;
  const maxPct = Math.max(...holders.map(h => h.percentage));

  // Simple circle packing: place circles in a spiral pattern
  let html = '';
  const cx = width / 2, cy = height / 2;
  holders.slice(0, 20).forEach((holder, i) => {
    const r = Math.max(8, (holder.percentage / maxPct) * 50);
    const angle = i * 0.8;
    const dist = 15 + i * 12;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const color = HOLDER_COLORS[i % HOLDER_COLORS.length];
    const isDev = holder.address === creatorAddress;

    html += `
      <g class="bubble-holder" data-addr="${holder.address}">
        <circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="0.8" stroke="${isDev ? '#f0c040' : 'none'}" stroke-width="${isDev ? 2 : 0}">
          <title>${shortAddr(holder.address)}: ${holder.percentage.toFixed(2)}%${isDev ? ' (dev)' : ''}</title>
        </circle>
        ${r > 15 ? `<text x="${x}" y="${y + 4}" text-anchor="middle" fill="var(--bg)" font-size="9" font-weight="700">${holder.percentage.toFixed(1)}%</text>` : ''}
      </g>
    `;
  });

  svg.innerHTML = html;
}
```

### 4. View Toggle Logic

```javascript
function switchHolderView(view) {
  const listView = document.getElementById('holderListView');
  const bubbleView = document.getElementById('holderBubbleView');
  const btns = document.querySelectorAll('.holder-view-btn');

  btns.forEach(b => b.classList.toggle('active', b.dataset.view === view));

  if (view === 'list') {
    listView.style.display = 'block';
    bubbleView.style.display = 'none';
  } else {
    listView.style.display = 'none';
    bubbleView.style.display = 'block';
  }
}
```

### 5. CSS Styles

```css
.holders-section {
  background: var(--bg-card);
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 16px;
}
.holders-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.holders-header h3 {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}
.holders-toggle {
  display: flex;
  gap: 4px;
  background: var(--bg);
  border-radius: 8px;
  padding: 2px;
}
.holder-view-btn {
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.holder-view-btn.active {
  background: var(--bg-card);
  color: var(--text);
  font-weight: 600;
}
.holder-item {
  display: grid;
  grid-template-columns: 24px 12px 1fr auto 80px;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.holder-rank {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: right;
}
.holder-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.holder-addr {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.holder-dev-badge {
  font-size: 10px;
  background: rgba(240,192,64,0.15);
  color: #f0c040;
  padding: 1px 6px;
  border-radius: 4px;
}
.holder-pct {
  font-size: 13px;
  font-weight: 600;
  text-align: right;
}
.holder-bar {
  height: 4px;
  background: rgba(255,255,255,0.05);
  border-radius: 2px;
  overflow: hidden;
}
.holder-bar-fill {
  height: 100%;
  border-radius: 2px;
}
.bubble-holder circle {
  cursor: pointer;
  transition: opacity 0.2s;
}
.bubble-holder:hover circle {
  opacity: 1;
}
```

### 6. Integrate with Existing Code

In the existing inline script where holders are loaded, call both renderers:

```javascript
// After fetching holders:
holderList.innerHTML = holders.map((h, i) => renderHolderItem(h, i, coin.creator)).join('');
renderBubbleMap(holders, coin.creator);
```

### 7. Verification

- List view should show ranked holders with colored dots, addresses, dev badge, percentages, and bars
- Bubble map should show proportionally-sized circles with tooltips
- Toggle should switch between views smoothly
- Dev/creator address should have a 👑 badge
- Works on mobile (list should be scrollable, bubbles should scale)

## Anti-Patterns

- Do NOT modify `app.js`
- Do NOT add npm dependencies
- Do NOT use any external charting library — pure SVG
- Do NOT break the existing trades or thread sections
