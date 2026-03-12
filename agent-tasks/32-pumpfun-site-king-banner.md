# Task 32: PumpFun Site — King of the Hill & Featured Banner

## Context

You are working in the `pump-fun-sdk` repository. The `pumpfun-site/` directory is a static token launchpad UI (pure HTML/CSS/JS, zero dependencies). The board page (`index.html`) currently has a "King of the Hill" banner at the top, but it's a simple text block. The real pump.fun has a more prominent featured/king section.

**Files to modify:**
- `pumpfun-site/index.html` (~143 lines) — banner HTML
- `pumpfun-site/app.js` (~344 lines) — `updateKingBanner()` function
- `pumpfun-site/styles.css` (~1196 lines) — banner styling

**Key function in app.js:** `updateKingBanner()` — fetches from `/coins/king-of-the-hill` API and updates the banner. Currently sets `kingLink`, `kingImg`, `kingName`, `kingTicker`, `kingMcap` elements.

## Objective

Redesign the King of the Hill banner to be a prominent featured hero section at the top of the board page, matching pump.fun's featured coins area.

## Design Reference (pump.fun)

Pump.fun shows at the top of the board page:
- A **highlighted featured token** — large card spanning full width with:
  - Token image (large, left side)
  - Token name + ticker
  - Current market cap (large green text)
  - Description snippet
  - Creator address
  - "King of the Hill 👑" badge
  - A call-to-action link to the token page
- Below it, optionally, a row of **runner-up tokens** (2-3 smaller cards)
- The whole section has a subtle gradient or glow background to stand out

## Requirements

### 1. Banner HTML (index.html)

Replace the current king banner section with:

```html
<section class="king-section" id="kingSection">
  <div class="king-badge">👑 King of the Hill</div>
  <a href="#" class="king-card" id="kingLink">
    <div class="king-image" id="kingImgWrap">
      <div class="gradient-placeholder" style="width:160px;height:160px;border-radius:12px;background:linear-gradient(135deg,#333,#555)"></div>
    </div>
    <div class="king-info">
      <h2 class="king-name" id="kingName">Loading...</h2>
      <span class="king-ticker" id="kingTicker"></span>
      <p class="king-desc" id="kingDesc"></p>
      <div class="king-stats">
        <span class="king-mcap" id="kingMcap">—</span>
        <span class="king-creator" id="kingCreator"></span>
      </div>
    </div>
  </a>
</section>
```

### 2. Banner Styles (CSS)

```css
.king-section {
  position: relative;
  padding: 24px;
  margin-bottom: 24px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(123,255,105,0.05), rgba(0,212,255,0.05));
  border: 1px solid rgba(123,255,105,0.15);
}
.king-badge {
  font-size: 13px;
  font-weight: 700;
  color: #f0c040;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.king-card {
  display: flex;
  align-items: center;
  gap: 24px;
  text-decoration: none;
  color: var(--text);
}
.king-image img {
  width: 160px;
  height: 160px;
  border-radius: 12px;
  object-fit: cover;
}
.king-info {
  flex: 1;
}
.king-name {
  font-size: 24px;
  font-weight: 800;
  margin: 0 0 4px;
}
.king-ticker {
  font-size: 16px;
  color: var(--text-secondary);
  font-weight: 600;
}
.king-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 12px 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.king-stats {
  display: flex;
  gap: 20px;
  align-items: center;
  margin-top: 8px;
}
.king-mcap {
  font-size: 18px;
  font-weight: 700;
  color: var(--green);
}
.king-creator {
  font-size: 12px;
  color: var(--text-secondary);
}

@media (max-width: 640px) {
  .king-card { flex-direction: column; align-items: flex-start; }
  .king-image img { width: 100%; height: auto; max-height: 200px; }
  .king-name { font-size: 20px; }
}
```

### 3. Update `updateKingBanner()` in app.js

Update the function to populate the new elements:

```javascript
async function updateKingBanner() {
  try {
    const coin = await fetchKingOfTheHill();
    if (!coin) return;

    const kingLink = document.getElementById('kingLink');
    const kingName = document.getElementById('kingName');
    const kingTicker = document.getElementById('kingTicker');
    const kingMcap = document.getElementById('kingMcap');
    const kingDesc = document.getElementById('kingDesc');
    const kingCreator = document.getElementById('kingCreator');
    const kingImgWrap = document.getElementById('kingImgWrap');

    if (kingLink) kingLink.href = `token.html?mint=${coin.mint}`;
    if (kingName) kingName.textContent = coin.name;
    if (kingTicker) kingTicker.textContent = `(${coin.symbol})`;
    if (kingMcap) kingMcap.textContent = `Market cap: ${formatMcap(coin.usd_market_cap)}`;
    if (kingDesc) kingDesc.textContent = coin.description || '';
    if (kingCreator) kingCreator.textContent = `Created by ${shortAddr(coin.creator)}`;
    if (kingImgWrap) kingImgWrap.innerHTML = tokenImageHtml(coin, 160);
  } catch (e) {
    console.error('King banner error:', e);
  }
}
```

### 4. Remove Old King Banner

Remove old king-related styles:
- `.king-banner`, `.king-banner-content`, or any old king banner classes
- The old inline king banner HTML

### 5. Verification

- Banner should show the King of the Hill token prominently
- Image, name, ticker, market cap, description, and creator should all display
- Clicking the banner should navigate to the token page
- Mobile should stack vertically
- If API fails, the banner should degrade gracefully (show "Loading..." state)

## Anti-Patterns

- Do NOT add npm dependencies
- Do NOT break the existing `fetchKingOfTheHill()` API call
- Do NOT remove the ticker strip — it should remain below or above the king section
