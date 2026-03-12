# Task 31: PumpFun Site — Board Page Card Redesign

## Context

You are working in the `pump-fun-sdk` repository. The `pumpfun-site/` directory is a static token launchpad UI (pure HTML/CSS/JS, zero dependencies). The board page (`index.html`) shows a grid of token cards, but the card design doesn't match pump.fun's layout.

**Files to modify:**
- `pumpfun-site/app.js` (~344 lines) — `renderCoinCards()` function generates card HTML
- `pumpfun-site/styles.css` (~1196 lines) — card styling
- `pumpfun-site/index.html` (~143 lines) — may need structural changes to the grid container

**Key function in app.js:** `renderCoinCards(coins, gridId, append)` — this renders all token cards. The function receives coin objects from the pump.fun API with fields: `mint`, `name`, `symbol`, `image_uri`, `usd_market_cap`, `reply_count`, `created_timestamp`, `creator`, `description`.

**Helper functions in app.js:** `formatMcap(n)`, `shortAddr(a)`, `timeAgo(ts)`, `tokenImageHtml(coin, size)` — use these, don't recreate them.

## Objective

Redesign the token cards to match pump.fun's real card layout. Current cards show a bonding curve progress bar and vertical layout. Pump.fun cards are simpler, more image-focused, and show key metrics inline.

## Design Reference (pump.fun)

Each card in pump.fun shows:
- **Token image** — large, fills the top of the card (~60% of card height), with rounded top corners
- **Creator badge** — small text at top-left of the image area like "Created by: [short address]" with a colored profile icon
- **Token name + ticker** — below the image, bold, e.g. "PUSS IN BOOTS (PIB)"
- **Description snippet** — 1-2 lines, gray text, truncated
- **Market cap** — green text, e.g. "market cap: $45.2K", at the bottom
- **Reply count** — shown as a small count, e.g. "15 replies"
- No bonding curve progress bar on the cards
- Cards have dark background, subtle border, rounded corners (~12px)
- Hover effect: slight border glow or elevation

## Requirements

### 1. Card HTML (in `renderCoinCards()` in app.js)

Update the card HTML template to match this structure:

```html
<a href="token.html?mint=${coin.mint}" class="coin-card" title="${coin.name}">
  <div class="card-image">
    ${tokenImageHtml(coin, 200)}
    <span class="card-creator">
      <span class="creator-dot" style="background:${creatorColor}"></span>
      Created by ${shortAddr(coin.creator)}
    </span>
  </div>
  <div class="card-body">
    <div class="card-title">${coin.name} <span class="card-ticker">(${coin.symbol})</span></div>
    <p class="card-desc">${truncatedDescription}</p>
    <div class="card-footer">
      <span class="card-mcap">market cap: ${formatMcap(coin.usd_market_cap)}</span>
      <span class="card-replies">${coin.reply_count || 0} replies</span>
    </div>
  </div>
</a>
```

Where:
- `creatorColor` — pick from a color array using a simple hash of the creator address
- `truncatedDescription` — first 80 chars of `coin.description`, with "..." if truncated
- `tokenImageHtml(coin, 200)` — already exists, renders image or gradient placeholder

### 2. Card Grid (CSS)

The grid should be a **3-column grid** on desktop, **2 columns** on tablet, **1 column** on mobile:

```css
.token-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 16px 0;
}

@media (max-width: 1024px) {
  .token-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .token-grid { grid-template-columns: 1fr; }
}
```

### 3. Card Styles (CSS)

```css
.coin-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  text-decoration: none;
  color: var(--text);
  transition: border-color 0.2s, transform 0.2s;
  display: flex;
  flex-direction: column;
}
.coin-card:hover {
  border-color: var(--green);
  transform: translateY(-2px);
}

.card-image {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: var(--bg);
}
.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-creator {
  position: absolute;
  bottom: 8px;
  left: 8px;
  font-size: 11px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0,0,0,0.6);
  padding: 3px 8px;
  border-radius: 6px;
}
.creator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.card-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.card-title {
  font-weight: 700;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-ticker {
  color: var(--text-secondary);
  font-weight: 400;
}
.card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 8px;
}
.card-mcap {
  font-size: 12px;
  color: var(--green);
  font-weight: 600;
}
.card-replies {
  font-size: 11px;
  color: var(--text-secondary);
}
```

### 4. Remove Old Card Styles

Remove or replace these existing classes that were for the old card design:
- `.coin-card .card-header` (if it exists)
- `.bonding-bar`, `.bonding-fill` (progress bar on cards)
- Any vertical metric stack inside cards

### 5. Tab Filter Bar

Keep the existing tab filter buttons (Trending / New / Top / Pump.fun) but style them as **pill buttons** in a horizontal row above the grid:

```css
.tabs {
  display: flex;
  gap: 8px;
  padding: 12px 0;
}
.tab-btn {
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}
.tab-btn.active, .tab-btn:hover {
  background: var(--green);
  color: var(--bg);
  border-color: var(--green);
}
```

### 6. Verification

- Cards should display token images prominently
- Creator address should show at bottom of image
- Market cap and reply count should be visible
- Grid should be responsive (3 → 2 → 1 columns)
- Clicking a card should navigate to `token.html?mint=...`
- The "Show more" / load more button should still work

## Anti-Patterns

- Do NOT remove the API fetch logic — only change how cards are rendered
- Do NOT break the `loadMoreTokens()` pagination
- Do NOT add npm dependencies
- Do NOT modify wallet connection code
