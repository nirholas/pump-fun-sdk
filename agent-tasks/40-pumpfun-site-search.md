# Task 40: PumpFun Site — Search Functionality & Keyboard Shortcuts

## Context

You are working in the `pump-fun-sdk` repository. The `pumpfun-site/` directory is a static token launchpad UI (pure HTML/CSS/JS, zero dependencies). There is a search input in the header/topbar but it doesn't do anything. The real pump.fun has a functional search with autocomplete results.

**Files to modify:**
- `pumpfun-site/app.js` (~344 lines) — add search functionality
- `pumpfun-site/styles.css` (~1196 lines) — search results dropdown styling
- `pumpfun-site/index.html` — search input (may need wrapper div for dropdown)

**Key info:** The pump.fun API supports search via `/coins?searchTerm=QUERY&limit=10`. Token results include `mint`, `name`, `symbol`, `image_uri`, `usd_market_cap`.

## Objective

1. Implement **live search** with debounced API calls as the user types
2. Show search results in a **dropdown** below the search input
3. Add **keyboard shortcuts**: `⌘K` / `Ctrl+K` to focus search, `Escape` to close
4. Navigate results with **arrow keys** and select with **Enter**

## Requirements

### 1. Search Result Dropdown HTML

Wrap the search input in a container that can hold the dropdown. On each page, ensure the search area has this structure:

```html
<div class="search-container">
  <div class="search-input-wrap">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <input type="text" id="searchInput" placeholder="Search for tokens..." aria-label="Search tokens" autocomplete="off">
    <kbd class="search-shortcut">⌘K</kbd>
  </div>
  <div class="search-results" id="searchResults" style="display:none">
    <!-- Populated dynamically -->
  </div>
</div>
```

### 2. Search Logic (in app.js)

Add these functions:

```javascript
// Debounce helper
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Search tokens
async function searchTokens(query) {
  if (!query || query.length < 2) {
    hideSearchResults();
    return;
  }

  try {
    const res = await fetch(`${PUMP_API}/coins?searchTerm=${encodeURIComponent(query)}&limit=8&offset=0&sort=market_cap&order=DESC`);
    if (!res.ok) return;
    const coins = await res.json();
    showSearchResults(coins);
  } catch (e) {
    console.error('Search error:', e);
  }
}

// Render search results
function showSearchResults(coins) {
  const container = document.getElementById('searchResults');
  if (!container) return;

  if (!coins.length) {
    container.innerHTML = '<div class="search-empty">No tokens found</div>';
    container.style.display = 'block';
    return;
  }

  container.innerHTML = coins.map((coin, i) => `
    <a href="token.html?mint=${coin.mint}" class="search-result-item${i === 0 ? ' active' : ''}" data-index="${i}">
      <div class="search-result-img">${tokenImageHtml(coin, 32)}</div>
      <div class="search-result-info">
        <span class="search-result-name">${coin.name}</span>
        <span class="search-result-ticker">${coin.symbol}</span>
      </div>
      <span class="search-result-mcap">${formatMcap(coin.usd_market_cap)}</span>
    </a>
  `).join('');

  container.style.display = 'block';
}

function hideSearchResults() {
  const container = document.getElementById('searchResults');
  if (container) container.style.display = 'none';
}

// Keyboard navigation for search results
let activeSearchIndex = -1;

function navigateSearchResults(direction) {
  const items = document.querySelectorAll('.search-result-item');
  if (!items.length) return;

  items.forEach(item => item.classList.remove('active'));
  activeSearchIndex += direction;
  if (activeSearchIndex < 0) activeSearchIndex = items.length - 1;
  if (activeSearchIndex >= items.length) activeSearchIndex = 0;

  items[activeSearchIndex]?.classList.add('active');
  items[activeSearchIndex]?.scrollIntoView({ block: 'nearest' });
}

function selectSearchResult() {
  const active = document.querySelector('.search-result-item.active');
  if (active) window.location.href = active.href;
}

// Initialize search
function initSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;

  const debouncedSearch = debounce(searchTokens, 300);

  input.addEventListener('input', () => {
    activeSearchIndex = -1;
    debouncedSearch(input.value.trim());
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); navigateSearchResults(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); navigateSearchResults(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); selectSearchResult(); }
    else if (e.key === 'Escape') { hideSearchResults(); input.blur(); }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) hideSearchResults();
  });

  // ⌘K / Ctrl+K shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}
```

Call `initSearch()` from the DOMContentLoaded handler or add it to the existing initialization.

### 3. CSS Styles

```css
/* Search container */
.search-container {
  position: relative;
  flex: 1;
  max-width: 400px;
}
.search-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: border-color 0.2s;
}
.search-input-wrap:focus-within {
  border-color: var(--green);
}
.search-input-wrap svg {
  flex-shrink: 0;
  color: var(--text-secondary);
}
#searchInput {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 14px;
  outline: none;
}
#searchInput::placeholder {
  color: var(--text-secondary);
}
.search-shortcut {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-family: system-ui;
}

/* Search results dropdown */
.search-results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 200;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.search-result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  text-decoration: none;
  color: var(--text);
  transition: background 0.15s;
}
.search-result-item:hover,
.search-result-item.active {
  background: rgba(255,255,255,0.05);
}
.search-result-item:first-child {
  border-radius: 12px 12px 0 0;
}
.search-result-item:last-child {
  border-radius: 0 0 12px 12px;
}
.search-result-img img, .search-result-img .gradient-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: cover;
}
.search-result-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.search-result-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.search-result-ticker {
  font-size: 11px;
  color: var(--text-secondary);
}
.search-result-mcap {
  font-size: 12px;
  color: var(--green);
  font-weight: 600;
  white-space: nowrap;
}
.search-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}
```

### 4. Verification

- Typing 2+ characters should show search results after 300ms debounce
- Results should show token image, name, ticker, and market cap
- Arrow keys should navigate through results (highlighting active item)
- Enter should navigate to the selected token page
- Escape should close the dropdown
- ⌘K / Ctrl+K should focus the search input
- Clicking outside should close the dropdown
- Empty results should show "No tokens found"
- Search should work on all pages that have the search input

## Anti-Patterns

- Do NOT add npm dependencies
- Do NOT use any external search library
- Do NOT cache search results (API is fast enough)
- Do NOT make search requests for single characters (min 2)
- Do NOT break existing app.js initialization
