# Task 38: PumpFun Site — Profile Page Redesign (Holdings, Activity, PnL)

## Context

You are working in the `pump-fun-sdk` repository. The `pumpfun-site/` directory is a static token launchpad UI (pure HTML/CSS/JS, zero dependencies). The profile page (`profile.html`) currently shows a basic connected wallet state with created tokens, but needs a fuller layout matching pump.fun.

**Files to modify:**
- `pumpfun-site/profile.html` (~164 lines) — page structure and inline script
- `pumpfun-site/styles.css` (~1196 lines) — profile styling

**DO NOT** modify `app.js`.

**Key info:** The inline script in `profile.html` uses `connectWallet()` from app.js and fetches from `/coins/user-created-coins/{address}`. The page checks for a `?address=` URL param or uses the connected wallet address.

## Objective

Redesign the profile page with:
1. **Profile header** with wallet address, avatar, copy button
2. **Holdings tab** showing tokens the user holds (placeholder data until portfolio API available)
3. **Created tab** showing tokens the user created (already implemented)
4. **Activity tab** showing recent transactions
5. **Summary stats** — Total value, # coins created, # trades

## Design Reference (pump.fun)

Pump.fun's profile page:
- Profile header: Jazzicon/avatar + full address + copy icon + explorer link
- Stats row: "Followers: 0 | Following: 0 | Likes received: 0"
- Tabs: "Coins held" | "Coins created" | "Followers" | "Following" | "Activity"
- Coins held: grid of token cards with amount held, value, PnL%
- Coins created: grid of token cards (same as board cards)
- Activity: list of buy/sell/create transactions

## Requirements

### 1. Profile Header

```html
<div class="profile-header">
  <div class="profile-avatar" id="profileAvatar">
    <!-- Jazzicon-style gradient circle -->
    <div class="avatar-circle" id="avatarCircle"></div>
  </div>
  <div class="profile-info">
    <div class="profile-address-row">
      <span class="profile-address" id="profileAddress">Not connected</span>
      <button class="btn-copy" onclick="copyAddress()" title="Copy address">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <a class="btn-explorer" id="explorerLink" href="#" target="_blank" title="View on Solscan">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
    </div>
    <div class="profile-stats" id="profileStats">
      <span class="profile-stat"><strong id="statCoinsCreated">0</strong> coins created</span>
      <span class="profile-stat-sep">·</span>
      <span class="profile-stat"><strong id="statTotalTrades">—</strong> trades</span>
    </div>
  </div>
</div>
```

### 2. Profile Tabs

```html
<div class="profile-tabs">
  <button class="profile-tab active" data-tab="held" onclick="switchProfileTab('held')">Coins held</button>
  <button class="profile-tab" data-tab="created" onclick="switchProfileTab('created')">Coins created</button>
  <button class="profile-tab" data-tab="activity" onclick="switchProfileTab('activity')">Activity</button>
</div>

<div class="profile-content">
  <!-- Coins held -->
  <div class="profile-tab-content active" id="tabHeld">
    <div class="held-grid" id="heldGrid">
      <div class="empty-state">
        <span class="empty-icon">💼</span>
        <p>No holdings found</p>
        <p class="empty-hint">Buy tokens to see them here</p>
      </div>
    </div>
  </div>

  <!-- Coins created -->
  <div class="profile-tab-content" id="tabCreated" style="display:none">
    <div class="created-grid" id="createdGrid">
      <!-- Populated by JS -->
    </div>
  </div>

  <!-- Activity -->
  <div class="profile-tab-content" id="tabActivity" style="display:none">
    <div class="activity-list" id="activityList">
      <div class="empty-state">
        <span class="empty-icon">📋</span>
        <p>No activity yet</p>
      </div>
    </div>
  </div>
</div>
```

### 3. Inline Script

```javascript
// Generate a pseudo-random avatar based on address
function generateAvatar(address) {
  const circle = document.getElementById('avatarCircle');
  if (!circle || !address) return;
  // Create gradient from address hash
  const h1 = parseInt(address.slice(0, 6), 36) % 360;
  const h2 = (h1 + 120) % 360;
  circle.style.background = `linear-gradient(135deg, hsl(${h1}, 70%, 50%), hsl(${h2}, 70%, 50%))`;
}

// Copy address
function copyAddress() {
  const addr = document.getElementById('profileAddress')?.textContent;
  if (addr && addr !== 'Not connected') {
    navigator.clipboard.writeText(addr);
    // Brief visual feedback
    const btn = document.querySelector('.btn-copy');
    if (btn) { btn.style.color = 'var(--green)'; setTimeout(() => btn.style.color = '', 1000); }
  }
}

// Tab switching
function switchProfileTab(tab) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.profile-tab-content').forEach(c => c.style.display = 'none');
  const target = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (target) target.style.display = 'block';
}

// Load profile data
async function loadProfile(address) {
  if (!address) return;

  const profileAddr = document.getElementById('profileAddress');
  const explorerLink = document.getElementById('explorerLink');

  if (profileAddr) profileAddr.textContent = address;
  if (explorerLink) explorerLink.href = `https://solscan.io/account/${address}`;
  generateAvatar(address);

  // Load created coins
  try {
    const res = await fetch(`https://frontend-api-v3.pump.fun/coins/user-created-coins/${address}?limit=20&offset=0`);
    if (res.ok) {
      const created = await res.json();
      const grid = document.getElementById('createdGrid');
      const stat = document.getElementById('statCoinsCreated');
      if (stat) stat.textContent = created.length;

      if (grid && created.length > 0) {
        grid.innerHTML = created.map(coin => `
          <a href="token.html?mint=${coin.mint}" class="coin-card-mini">
            <div class="mini-img">${tokenImageHtml(coin, 48)}</div>
            <div class="mini-info">
              <div class="mini-name">${coin.name} <span class="mini-ticker">(${coin.symbol})</span></div>
              <div class="mini-mcap">${formatMcap(coin.usd_market_cap)}</div>
            </div>
          </a>
        `).join('');
      } else if (grid) {
        grid.innerHTML = '<div class="empty-state"><span class="empty-icon">🎨</span><p>No coins created yet</p><a href="create.html" class="empty-action">Create your first coin</a></div>';
      }
    }
  } catch (e) {
    console.error('Failed to load created coins:', e);
  }
}

// Init
(async () => {
  const params = new URLSearchParams(window.location.search);
  const address = params.get('address');

  if (address) {
    loadProfile(address);
  } else {
    // Try connected wallet
    const provider = window.phantom?.solana || window.solflare;
    if (provider?.isConnected) {
      loadProfile(provider.publicKey.toString());
    } else {
      // Show connect prompt
      document.querySelector('.profile-content').innerHTML = `
        <div class="connect-prompt">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><circle cx="18" cy="16" r="1"/></svg>
          <h3>Connect your wallet</h3>
          <p>Connect your wallet to view your profile, holdings, and activity</p>
          <button class="btn-wallet" onclick="connectWallet()">Connect wallet</button>
        </div>
      `;
    }
  }
})();
```

### 4. CSS Styles

```css
/* Profile page */
.profile-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
}
.avatar-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #333, #555);
}
.profile-address-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.profile-address {
  font-size: 16px;
  font-weight: 600;
  font-family: monospace;
}
.btn-copy, .btn-explorer {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}
.btn-copy:hover, .btn-explorer:hover { color: var(--green); }
.profile-stats {
  display: flex;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}
.profile-stats strong {
  color: var(--text);
}
.profile-stat-sep {
  color: var(--border);
}

/* Profile tabs */
.profile-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
}
.profile-tab {
  padding: 12px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.profile-tab:hover { color: var(--text); }
.profile-tab.active {
  color: var(--text);
  border-bottom-color: var(--green);
  font-weight: 600;
}

/* Mini coin cards for created grid */
.created-grid, .held-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.coin-card-mini {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  text-decoration: none;
  color: var(--text);
  transition: border-color 0.2s;
}
.coin-card-mini:hover { border-color: var(--green); }
.mini-img img, .mini-img .gradient-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
}
.mini-name {
  font-size: 14px;
  font-weight: 600;
}
.mini-ticker {
  color: var(--text-secondary);
  font-weight: 400;
}
.mini-mcap {
  font-size: 13px;
  color: var(--green);
  margin-top: 2px;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-secondary);
}
.empty-icon {
  font-size: 36px;
  display: block;
  margin-bottom: 12px;
}
.empty-state p { margin: 4px 0; }
.empty-hint { font-size: 13px; opacity: 0.6; }
.empty-action {
  display: inline-block;
  margin-top: 12px;
  padding: 8px 20px;
  background: var(--green);
  color: var(--bg);
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 13px;
}

/* Connect prompt */
.connect-prompt {
  text-align: center;
  padding: 64px 24px;
}
.connect-prompt h3 {
  font-size: 20px;
  margin: 16px 0 8px;
}
.connect-prompt p {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

@media (max-width: 640px) {
  .profile-header { flex-direction: column; text-align: center; }
  .profile-address-row { justify-content: center; }
  .profile-stats { justify-content: center; }
  .profile-tabs { overflow-x: auto; }
}
```

### 5. Verification

- Profile page should show avatar + address when connected or using `?address=`
- Copy button should copy address to clipboard
- Explorer link should open Solscan
- "Coins created" tab should show created tokens from API
- "Coins held" tab should show empty state (placeholder until portfolio API)
- "Activity" tab should show empty state
- Disconnected state should show connect wallet prompt
- Page should be responsive

## Anti-Patterns

- Do NOT modify `app.js`
- Do NOT add npm dependencies
- Do NOT fetch from any API not already used (no portfolio/balance APIs — show empty states)
- Do NOT hardcode any addresses or fake data
