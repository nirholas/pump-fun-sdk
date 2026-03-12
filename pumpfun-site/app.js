/* ================================================================
   Launchpad — Real Token Data & Wallet Connection
   ================================================================ */

const PUMP_API = 'https://frontend-api-v3.pump.fun';

// ── Helpers ──
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return (Math.random() * (max - min) + min).toFixed(2); }
function randItem(arr) { return arr[rand(0, arr.length - 1)]; }
function formatMcap(n) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K';
  return '$' + n;
}
function shortAddr(addr) {
  if (!addr) return '???';
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}
function timeAgo(ts) {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return secs + 's ago';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  return Math.floor(secs / 86400) + 'd ago';
}

const GRADIENT_COLORS = [
  '#6366f1,#a855f7', '#f472b6,#a855f7', '#facc15,#fb923c',
  '#3b82f6,#06b6d4', '#22c55e,#16a34a', '#ef4444,#f97316',
  '#8b5cf6,#6366f1', '#ec4899,#f43f5e', '#14b8a6,#06b6d4',
  '#f59e0b,#ef4444', '#84cc16,#22c55e', '#d946ef,#a855f7',
];

function tokenImageHtml(coin, size) {
  if (coin.image_uri) {
    return `<img src="${coin.image_uri}" alt="${coin.symbol || ''}" style="width:${size};height:${size};object-fit:cover;border-radius:8px;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div style="display:none;width:${size};height:${size};background:linear-gradient(135deg,${randItem(GRADIENT_COLORS)});align-items:center;justify-content:center;font-size:${parseInt(size)/2}px;border-radius:8px;">🪙</div>`;
  }
  return `<div style="width:${size};height:${size};background:linear-gradient(135deg,${randItem(GRADIENT_COLORS)});display:flex;align-items:center;justify-content:center;font-size:${parseInt(size)/2}px;border-radius:8px;">🪙</div>`;
}

// ── Fetch coins from pump.fun API ──
let cachedCoins = null;

async function fetchCoins(sort, limit) {
  try {
    const url = `${PUMP_API}/coins?sort=${encodeURIComponent(sort || 'market_cap')}&limit=${limit || 24}&offset=0&includeNsfw=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('pump.fun API unavailable, using cached data:', e.message);
    return [];
  }
}

async function fetchKingOfTheHill() {
  try {
    const res = await fetch(`${PUMP_API}/coins/king-of-the-hill?includeNsfw=false`);
    if (!res.ok) throw new Error('API ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('King of the Hill unavailable:', e.message);
    return null;
  }
}

// ── Generate ticker from real data ──
async function generateTicker() {
  const track = document.getElementById('tickerTrack');
  if (!track) return;

  const coins = await fetchCoins('last_trade_timestamp', 30);
  if (coins.length === 0) return;

  let html = '';
  coins.forEach(coin => {
    const action = randItem(['bought', 'sold']);
    const amount = randFloat(0.1, 20);
    const cls = action === 'bought' ? 'green' : 'red';
    const ago = coin.last_trade_timestamp ? timeAgo(coin.last_trade_timestamp) : rand(1, 59) + 's ago';
    html += `<div class="ticker-item">
      ${tokenImageHtml(coin, '20px')}
      <span style="color:var(--text-muted)">${shortAddr(coin.creator)}</span>
      <span class="${cls}">${action}</span>
      <span>${amount} SOL of</span>
      <span style="font-weight:600;">${coin.name || 'Unknown'}</span>
      <span style="color:var(--text-dim)">${ago}</span>
    </div>`;
  });
  track.innerHTML = html + html;
}

// ── Render token cards from real coin data ──
function renderCoinCards(coins, gridId, append) {
  const grid = document.getElementById(gridId || 'tokenGrid');
  if (!grid) return;

  let html = '';
  coins.forEach((coin, i) => {
    const mcap = coin.usd_market_cap || 0;
    const progress = Math.min(100, Math.max(0, ((coin.bonding_curve_progress || 0) * 100)));
    const replies = coin.reply_count || 0;
    const isKing = i === 0 && !gridId;
    const isComplete = coin.complete === true;
    const ago = coin.created_timestamp ? timeAgo(coin.created_timestamp) : '';

    html += `<div class="token-card fade-in" style="animation-delay:${i * 50}ms" onclick="window.location='token.html?mint=${coin.mint}'">
      ${isKing ? '<div class="token-card-badge king">👑 King</div>' : isComplete ? '<div class="token-card-badge">🎓 Graduated</div>' : ''}
      <div style="width:100%;aspect-ratio:1;overflow:hidden;border-radius:8px 8px 0 0;">
        ${tokenImageHtml(coin, '100%')}
      </div>
      <div class="token-card-body">
        <div class="token-card-header">
          <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,${randItem(GRADIENT_COLORS)});display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;">👤</div>
          <span class="token-card-creator">${shortAddr(coin.creator)}</span>
          <span style="margin-left:auto;font-size:11px;color:var(--text-dim);">${ago}</span>
        </div>
        <div class="token-card-name">${coin.name || 'Unknown'} <span class="token-card-ticker">${coin.symbol || '???'}</span></div>
        <div class="token-card-desc">${coin.description ? coin.description.slice(0, 100) : ''}</div>
        <div class="bonding-progress">
          <div class="bonding-progress-header">
            <span>bonding curve</span>
            <span style="color:${progress > 80 ? 'var(--green)' : 'var(--text-secondary)'};">${progress.toFixed(1)}%</span>
          </div>
          <div class="bonding-progress-bar">
            <div class="bonding-progress-fill" style="width:${progress}%"></div>
          </div>
        </div>
        <div class="token-card-stats">
          <div class="token-stat">
            <span class="token-stat-label">mkt cap: </span>
            <span class="token-stat-value">${formatMcap(mcap)}</span>
          </div>
          <div class="token-stat">
            <span class="token-stat-label">replies: </span>
            <span class="token-stat-value">${replies}</span>
          </div>
        </div>
      </div>
    </div>`;
  });

  if (append) {
    grid.innerHTML += html;
  } else {
    grid.innerHTML = html;
  }
}

// ── Main grid loader ──
let currentSort = 'market_cap';
let currentOffset = 0;

async function generateTokenGrid(count, gridId) {
  const coins = await fetchCoins(currentSort, count || 12);
  if (coins.length > 0) {
    cachedCoins = coins;
    renderCoinCards(coins, gridId);
  }
}

async function loadMoreTokens() {
  currentOffset += 12;
  try {
    const url = `${PUMP_API}/coins?sort=${encodeURIComponent(currentSort)}&limit=8&offset=${currentOffset}&includeNsfw=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('API ' + res.status);
    const coins = await res.json();
    if (Array.isArray(coins) && coins.length > 0) {
      renderCoinCards(coins, 'tokenGrid', true);
    }
  } catch (e) {
    console.warn('Load more failed:', e.message);
  }
}

// ── King of the Hill banner ──
async function updateKingBanner() {
  const king = await fetchKingOfTheHill();
  if (!king) return;
  const banner = document.querySelector('.king-banner');
  if (!banner) return;

  const imgEl = banner.querySelector('.king-banner-img');
  if (imgEl && king.image_uri) {
    imgEl.innerHTML = `<img src="${king.image_uri}" alt="${king.name}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" onerror="this.textContent='🐸'">`;
  }
  const nameEl = banner.querySelector('.king-banner-name');
  if (nameEl) nameEl.innerHTML = `${king.name || 'Unknown'} <span style="color:var(--text-muted);font-size:14px;font-weight:400;">$${king.symbol || '???'}</span>`;
  const statsEl = banner.querySelector('.king-banner-stats');
  if (statsEl) {
    const mcap = king.usd_market_cap || 0;
    statsEl.innerHTML = `
      <span>Market cap: <strong class="green">${formatMcap(mcap)}</strong></span>
      <span>Replies: <strong>${king.reply_count || 0}</strong></span>
      <span><span class="live-dot"></span> <strong class="green">King</strong></span>
    `;
  }
}

// ── Tab switching ──
function initTabs() {
  const SORT_MAP = {
    'terminal': 'last_trade_timestamp',
    'trending': 'market_cap',
    'top': 'market_cap',
    'new': 'created_timestamp',
    'graduating': 'market_cap',
    'graduated': 'market_cap',
  };

  document.querySelectorAll('.tab-bar .tab').forEach(tab => {
    tab.addEventListener('click', async function () {
      this.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      const tabName = this.dataset.tab || 'terminal';
      currentSort = SORT_MAP[tabName] || 'market_cap';
      currentOffset = 0;
      const grid = document.getElementById('tokenGrid');
      if (grid) {
        grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Loading...</div>';
        await generateTokenGrid(12);
      }
    });
  });
}

// ── Wallet connection ──
let connectedWallet = null;

function getProvider() {
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
  if (window.solflare?.isSolflare) return window.solflare;
  if (window.solana?.isPhantom) return window.solana;
  return null;
}

async function connectWallet() {
  const provider = getProvider();
  if (!provider) {
    window.open('https://phantom.app/', '_blank', 'noopener');
    return;
  }
  try {
    const resp = await provider.connect();
    connectedWallet = resp.publicKey.toString();
    updateWalletButtons();
  } catch (e) {
    console.warn('Wallet connection rejected:', e.message);
  }
}

async function disconnectWallet() {
  const provider = getProvider();
  if (provider) {
    try { await provider.disconnect(); } catch (_) {}
  }
  connectedWallet = null;
  updateWalletButtons();
}

function updateWalletButtons() {
  document.querySelectorAll('.btn-wallet').forEach(btn => {
    if (connectedWallet) {
      btn.innerHTML = `<span class="live-dot" style="width:6px;height:6px;"></span><span>${shortAddr(connectedWallet)}</span>`;
      btn.style.background = 'var(--bg-card)';
      btn.style.color = 'var(--green)';
      btn.style.border = '1px solid rgba(123,255,105,0.2)';
      btn.onclick = disconnectWallet;
    } else {
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><circle cx="18" cy="16" r="1"/></svg><span>Connect Wallet</span>`;
      btn.style.background = '';
      btn.style.color = '';
      btn.style.border = '';
      btn.onclick = connectWallet;
    }
  });
}

// Auto-reconnect if user previously connected
async function autoReconnect() {
  const provider = getProvider();
  if (provider) {
    try {
      const resp = await provider.connect({ onlyIfTrusted: true });
      connectedWallet = resp.publicKey.toString();
      updateWalletButtons();
    } catch (_) {}
  }
}

// ── Mobile nav ──
function toggleMobileNav() {
  const nav = document.getElementById('mobileNav');
  if (nav) nav.classList.toggle('open');
}

// ── Timeframe buttons ──
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('chart-tf-btn')) {
    e.target.parentElement.querySelectorAll('.chart-tf-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
  }
});

// ── Search focus effect ──
document.querySelectorAll('.header-search input').forEach(input => {
  input.addEventListener('focus', () => input.parentElement.style.borderColor = 'var(--green)');
  input.addEventListener('blur', () => input.parentElement.style.borderColor = 'var(--border)');
});

// ── Intersection observer for fade-in ──
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  const gridObserver = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.classList && node.classList.contains('token-card')) {
          observer.observe(node);
        }
      });
    });
  });

  document.querySelectorAll('.token-grid').forEach(grid => {
    gridObserver.observe(grid, { childList: true });
  });
}

// ── Init wallet on page load ──
document.addEventListener('DOMContentLoaded', () => {
  updateWalletButtons();
  autoReconnect();
});
