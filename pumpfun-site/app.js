/* ================================================================
   Launchpad — Token Data & Interactions
   ================================================================ */

// ── Mock token data ──
const TOKEN_NAMES = [
  { name: 'PEPE2025', ticker: 'PEPE25', emoji: '🐸', color: '#6366f1,#a855f7', desc: 'The king of memes returns for 2025. Community-driven, no BS, just vibes.' },
  { name: 'DogWifHat2', ticker: 'WIF2', emoji: '🐕', color: '#f472b6,#a855f7', desc: 'He still has the hat. And this time, he brought friends.' },
  { name: 'SolCat', ticker: 'SCAT', emoji: '🐱', color: '#facc15,#fb923c', desc: 'Fastest cat on the Solana blockchain. Meow to the moon.' },
  { name: 'MoonBoy', ticker: 'MOON', emoji: '🌙', color: '#3b82f6,#06b6d4', desc: 'We\'re not stopping until we hit the moon. Then Mars.' },
  { name: 'WAGMI', ticker: 'WAGMI', emoji: '💎', color: '#22c55e,#16a34a', desc: 'We are all gonna make it. Diamond hands only.' },
  { name: 'BONK2', ticker: 'BONK2', emoji: '🔨', color: '#ef4444,#f97316', desc: 'BONK is back with a vengeance. Bonk bonk bonk.' },
  { name: 'GigaChad', ticker: 'CHAD', emoji: '🗿', color: '#8b5cf6,#6366f1', desc: 'For chads only. If you have to ask, you can\'t afford it.' },
  { name: 'Degen', ticker: 'DEGEN', emoji: '🎰', color: '#ec4899,#f43f5e', desc: 'Born to degen. Forced to wageslave. Trading is the way out.' },
  { name: 'CopiumMax', ticker: 'COPE', emoji: '😤', color: '#14b8a6,#06b6d4', desc: 'Maximum copium achieved. We hold because we believe.' },
  { name: 'BasedGod', ticker: 'BASED', emoji: '⚡', color: '#f59e0b,#ef4444', desc: 'The most based token on Solana. Lil B approves.' },
  { name: 'Fren', ticker: 'FREN', emoji: '🤝', color: '#84cc16,#22c55e', desc: 'Be a fren. Buy fren. Hold fren. Simple as.' },
  { name: 'NPC', ticker: 'NPC', emoji: '🤖', color: '#64748b,#475569', desc: 'We are all NPCs in a simulation. Might as well get rich.' },
  { name: 'HODL', ticker: 'HODL', emoji: '🫴', color: '#d946ef,#a855f7', desc: 'Never selling. Not now. Not ever. Holding until heat death of universe.' },
  { name: 'PUMP', ticker: 'PUMP', emoji: '🚀', color: '#7bff69,#00d4ff', desc: 'The token that pumps. That\'s it. That\'s the pitch.' },
  { name: 'ApeIn', ticker: 'APE', emoji: '🦍', color: '#b45309,#d97706', desc: 'Ape now, think later. Financial advice? Never heard of her.' },
  { name: 'Rugged', ticker: 'RUG', emoji: '🧹', color: '#dc2626,#991b1b', desc: 'We named it Rugged so you can\'t say we didn\'t warn you.' },
];

const CREATOR_NAMES = [
  'degen_420.sol', 'whale_hunter', 'solana_maxi', 'crypto_chad',
  'pepe_lord', 'ape_together', 'diamond_hands', 'moon_shot',
  'based_dev', 'anon_builder', 'giga_brain', 'pump_master',
];

const CREATOR_COLORS = [
  '#f472b6,#a855f7', '#facc15,#fb923c', '#3b82f6,#06b6d4',
  '#22c55e,#16a34a', '#ef4444,#f97316', '#8b5cf6,#6366f1',
];

// ── Helpers ──
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return (Math.random() * (max - min) + min).toFixed(2); }
function randItem(arr) { return arr[rand(0, arr.length - 1)]; }
function formatMcap(n) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K';
  return '$' + n;
}

// ── Generate ticker ──
function generateTicker() {
  const track = document.getElementById('tickerTrack');
  if (!track) return;
  const actions = ['bought', 'sold', 'created'];
  let html = '';
  for (let i = 0; i < 30; i++) {
    const token = randItem(TOKEN_NAMES);
    const creator = randItem(CREATOR_NAMES);
    const action = randItem(actions);
    const amount = randFloat(0.1, 20);
    const cls = action === 'bought' ? 'green' : action === 'sold' ? 'red' : 'gradient-text';
    html += `<div class="ticker-item">
      <div style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,${token.color});display:flex;align-items:center;justify-content:center;font-size:11px;">${token.emoji}</div>
      <span style="color:var(--text-muted)">${creator}</span>
      <span class="${cls}">${action}</span>
      ${action !== 'created' ? `<span>${amount} SOL of</span>` : ''}
      <span style="font-weight:600;">${token.name}</span>
      <span style="color:var(--text-dim)">${rand(1, 59)}s ago</span>
    </div>`;
  }
  // Duplicate for seamless scroll
  track.innerHTML = html + html;
}

// ── Generate token cards ──
function generateTokenGrid(count, gridId) {
  const grid = document.getElementById(gridId || 'tokenGrid');
  if (!grid) return;

  const shuffled = [...TOKEN_NAMES].sort(() => Math.random() - 0.5);
  const tokens = shuffled.slice(0, Math.min(count, shuffled.length));

  let html = '';
  tokens.forEach((t, i) => {
    const mcap = rand(5000, 900000);
    const progress = rand(5, 98);
    const change = rand(-30, 500);
    const replies = rand(2, 342);
    const creator = randItem(CREATOR_NAMES);
    const creatorColor = randItem(CREATOR_COLORS);
    const isKing = i === 0 && !gridId;
    const isNew = rand(0, 5) === 0;

    html += `<div class="token-card fade-in" style="animation-delay:${i * 50}ms" onclick="window.location='token.html'">
      ${isKing ? '<div class="token-card-badge king">👑 King</div>' : isNew ? '<div class="token-card-badge">✨ New</div>' : ''}
      <div style="width:100%;aspect-ratio:1;background:linear-gradient(135deg,${t.color});display:flex;align-items:center;justify-content:center;font-size:64px;">${t.emoji}</div>
      <div class="token-card-body">
        <div class="token-card-header">
          <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,${creatorColor});display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;">👤</div>
          <span class="token-card-creator">${creator}</span>
          <span style="margin-left:auto;font-size:11px;color:var(--text-dim);">${rand(1, 59)}m ago</span>
        </div>
        <div class="token-card-name">${t.name} <span class="token-card-ticker">${t.ticker}</span></div>
        <div class="token-card-desc">${t.desc}</div>
        <div class="bonding-progress">
          <div class="bonding-progress-header">
            <span>bonding curve</span>
            <span style="color:${progress > 80 ? 'var(--green)' : 'var(--text-secondary)'};">${progress}%</span>
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
          <div class="token-stat ${change >= 0 ? 'green' : 'red'}">
            ${change >= 0 ? '+' : ''}${change}%
          </div>
        </div>
      </div>
    </div>`;
  });

  grid.innerHTML += html;
}

function loadMoreTokens() {
  generateTokenGrid(8);
}

// ── Tab switching ──
function initTabs() {
  document.querySelectorAll('.tab-bar .tab').forEach(tab => {
    tab.addEventListener('click', function () {
      this.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      // In a real app this would filter/sort; here we just shuffle cards
      const grid = document.getElementById('tokenGrid');
      if (grid) {
        grid.innerHTML = '';
        generateTokenGrid(12);
      }
    });
  });
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

  // Observe cards as they're added
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
