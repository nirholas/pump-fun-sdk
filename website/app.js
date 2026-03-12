/* ========================================================
   Pump SDK Website — Application Logic
   ======================================================== */

// ==================== Documentation Data ====================
const DOCS = [
  // Getting Started
  { title: "Getting Started", ticker: "GUIDE", emoji: "🚀", category: "getting-started", desc: "Prerequisites, installation, peer dependencies, and your first SDK call.", file: "getting-started.md" },
  { title: "End-to-End Workflow", ticker: "FLOW", emoji: "🔄", category: "getting-started", desc: "Complete token lifecycle — create, buy, sell, migrate, claim fees.", file: "end-to-end-workflow.md" },
  { title: "Examples", ticker: "CODE", emoji: "💡", category: "getting-started", desc: "Practical code examples for common SDK operations.", file: "examples.md" },
  { title: "CLI Guide", ticker: "CLI", emoji: "⌨️", category: "getting-started", desc: "Command-line tools and Bash wrappers for production use.", file: "cli-guide.md" },
  { title: "FAQ", ticker: "FAQ", emoji: "❓", category: "getting-started", desc: "Frequently asked questions and quick answers.", file: "faq.md" },

  // Core Concepts
  { title: "Architecture", ticker: "ARCH", emoji: "🏗️", category: "core", desc: "PumpSdk vs OnlinePumpSdk, offline-first design, program layout.", file: "architecture.md" },
  { title: "Bonding Curve Math", ticker: "MATH", emoji: "📐", category: "core", desc: "Virtual/real reserves, buy/sell formulas, price calculations with BN.js.", file: "bonding-curve-math.md" },
  { title: "AMM Trading", ticker: "AMM", emoji: "🏊", category: "core", desc: "PumpSwap constant-product pools — swap, deposit, withdraw post-graduation.", file: "amm-trading.md" },
  { title: "Fee Tiers", ticker: "TIER", emoji: "📊", category: "core", desc: "Dynamic fee tiers based on market cap thresholds.", file: "fee-tiers.md" },
  { title: "Fee Sharing", ticker: "SHARE", emoji: "💰", category: "core", desc: "Creator fee sharing configs — shareholders, BPS, claiming.", file: "fee-sharing.md" },
  { title: "Token Incentives", ticker: "EARN", emoji: "🎁", category: "core", desc: "Volume-based cashback rewards and token incentive programs.", file: "token-incentives.md" },
  { title: "Analytics", ticker: "DATA", emoji: "📈", category: "core", desc: "Price impact, graduation progress, token price, market analytics.", file: "analytics.md" },

  // Advanced
  { title: "Mayhem Mode", ticker: "CHAOS", emoji: "🔥", category: "advanced", desc: "Mayhem mode tokens with special bonding curve behavior.", file: "mayhem-mode.md" },
  { title: "Social Fees", ticker: "SOCIAL", emoji: "🤝", category: "advanced", desc: "Social referral fees and community-driven fee distribution.", file: "social-fees.md" },
  { title: "Cashback Rewards", ticker: "CASH", emoji: "💸", category: "advanced", desc: "UserVolumeAccumulator PDA and cashback reward mechanics.", file: "cashback.md" },
  { title: "DeFi Agents", ticker: "AGENT", emoji: "🤖", category: "advanced", desc: "AI agent integration patterns with MCP server and DeFi tools.", file: "defi-agents.md" },
  { title: "Admin Operations", ticker: "ADMIN", emoji: "🔧", category: "advanced", desc: "Protocol admin operations — global config, authority management.", file: "admin-operations.md" },
  { title: "Governance", ticker: "GOV", emoji: "🏛️", category: "advanced", desc: "Protocol governance and upgrade mechanisms.", file: "governance.md" },
  { title: "Performance", ticker: "PERF", emoji: "⚡", category: "advanced", desc: "Benchmarks, CU optimization, RPC batching strategies.", file: "performance.md" },

  // Reference
  { title: "API Reference", ticker: "API", emoji: "📖", category: "reference", desc: "Complete SDK method reference with parameter types.", file: "api-reference.md" },
  { title: "Events Reference", ticker: "EVENT", emoji: "📡", category: "reference", desc: "On-chain event types — CreateEvent, BuyEvent, SellEvent, MigrateEvent.", file: "events-reference.md" },
  { title: "Error Codes", ticker: "ERR", emoji: "🚨", category: "reference", desc: "Common errors, causes, and solutions.", file: "errors.md" },
  { title: "Glossary", ticker: "GLOSS", emoji: "📝", category: "reference", desc: "Key terms — bonding curve, graduation, AMM, slippage, PDA, BPS.", file: "glossary.md" },
  { title: "Security", ticker: "SEC", emoji: "🔐", category: "reference", desc: "Security practices, audit checklist, key management.", file: "security.md" },
  { title: "Testing", ticker: "TEST", emoji: "🧪", category: "reference", desc: "Test patterns, fixtures, Jest config, coverage.", file: "testing.md" },
  { title: "RPC Best Practices", ticker: "RPC", emoji: "🌐", category: "reference", desc: "Connection management, batching, rate limiting, error handling.", file: "rpc-best-practices.md" },
  { title: "Migration Guide", ticker: "MIGRATE", emoji: "📦", category: "reference", desc: "Upgrading from v1 to v2 — breaking changes and migration steps.", file: "MIGRATION.md" },
  { title: "Troubleshooting", ticker: "FIX", emoji: "🔍", category: "reference", desc: "Common issues and debugging strategies.", file: "TROUBLESHOOTING.md" },
  { title: "Deployment", ticker: "DEPLOY", emoji: "🚢", category: "reference", desc: "Deploying bots, servers, and dashboards to production.", file: "deployment.md" },
];

const CATEGORIES = [
  { key: "getting-started", label: "Getting Started" },
  { key: "core", label: "Core Concepts" },
  { key: "advanced", label: "Advanced" },
  { key: "reference", label: "Reference" },
];

// ==================== Navigation ====================
let currentPage = 'home';

function navigateTo(page) {
  // Deactivate all pages and nav links
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  // Activate target
  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.add('active');
  }

  // Mark nav
  const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (navLink) navLink.classList.add('active');

  currentPage = page;

  // Close mobile menu
  document.getElementById('navLinks').classList.remove('open');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Initialize page content if needed
  if (page === 'docs') renderDocsPage();
}

function toggleMobileMenu() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ==================== Doc Grid (Home Page) ====================
function renderDocGrid(filter = 'all') {
  const grid = document.getElementById('docGrid');
  if (!grid) return;

  const filtered = filter === 'all' ? DOCS : DOCS.filter(d => d.category === filter);

  grid.innerHTML = filtered.map(doc => `
    <div class="token-card" data-category="${doc.category}" onclick="navigateTo('docs')">
      <div class="token-card-header">${doc.emoji}</div>
      <div class="token-card-body">
        <div class="token-card-title">
          ${doc.title}
          <span class="token-card-ticker">$${doc.ticker}</span>
        </div>
        <div class="token-card-desc">${doc.desc}</div>
        <div class="token-card-meta">
          <span>${doc.category.replace('-', ' ')}</span>
          <span>${doc.file}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function filterDocs(category) {
  // Update filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().replace(/\s/g, '-') === category || (category === 'all' && btn.textContent === 'All'));
  });

  renderDocGrid(category);
}

// ==================== Docs Page ====================
function renderDocsPage() {
  renderDocsSidebar();
  renderDocsContent();
}

function renderDocsSidebar() {
  const sidebar = document.getElementById('docsSidebar');
  if (!sidebar) return;

  sidebar.innerHTML = CATEGORIES.map(cat => `
    <div class="docs-category">
      <div class="docs-category-title">${cat.label}</div>
      ${DOCS.filter(d => d.category === cat.key).map(doc => `
        <a href="#" class="docs-category-link" onclick="filterDocsPage('${doc.file}')" title="${doc.title}">
          ${doc.emoji} ${doc.title}
        </a>
      `).join('')}
    </div>
  `).join('');
}

function renderDocsContent(filter = null) {
  const content = document.getElementById('docsContent');
  if (!content) return;

  const docs = filter ? DOCS.filter(d => d.file === filter) : DOCS;

  content.innerHTML = docs.map(doc => `
    <div class="token-card" data-category="${doc.category}">
      <div class="token-card-header">${doc.emoji}</div>
      <div class="token-card-body">
        <div class="token-card-title">
          ${doc.title}
          <span class="token-card-ticker">$${doc.ticker}</span>
        </div>
        <div class="token-card-desc">${doc.desc}</div>
        <div class="token-card-meta">
          <span>${doc.category.replace('-', ' ')}</span>
          <span>${doc.file}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function filterDocsPage(file) {
  // Highlight sidebar link
  document.querySelectorAll('.docs-category-link').forEach(l => l.classList.remove('active'));
  const link = document.querySelector(`.docs-category-link[onclick*="${file}"]`);
  if (link) link.classList.add('active');

  if (file) {
    renderDocsContent(file);
  } else {
    renderDocsContent();
  }
}

function searchDocs(query) {
  const content = document.getElementById('docsContent');
  if (!content) return;

  if (!query.trim()) {
    renderDocsContent();
    return;
  }

  const q = query.toLowerCase();
  const filtered = DOCS.filter(d =>
    d.title.toLowerCase().includes(q) ||
    d.desc.toLowerCase().includes(q) ||
    d.ticker.toLowerCase().includes(q) ||
    d.category.toLowerCase().includes(q) ||
    d.file.toLowerCase().includes(q)
  );

  content.innerHTML = filtered.length > 0 ? filtered.map(doc => `
    <div class="token-card" data-category="${doc.category}">
      <div class="token-card-header">${doc.emoji}</div>
      <div class="token-card-body">
        <div class="token-card-title">
          ${doc.title}
          <span class="token-card-ticker">$${doc.ticker}</span>
        </div>
        <div class="token-card-desc">${doc.desc}</div>
        <div class="token-card-meta">
          <span>${doc.category.replace('-', ' ')}</span>
          <span>${doc.file}</span>
        </div>
      </div>
    </div>
  `).join('') : `
    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
      No documentation found matching "${query.replace(/</g, '&lt;')}"
    </div>
  `;
}

// ==================== Code Tabs ====================
function showCodeTab(tab) {
  document.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.code-panel').forEach(p => p.classList.remove('active'));

  const tabBtn = document.querySelector(`.code-tab[onclick*="${tab}"]`);
  const panel = document.getElementById(`code-${tab}`);

  if (tabBtn) tabBtn.classList.add('active');
  if (panel) panel.classList.add('active');
}

// ==================== Clipboard ====================
function copyInstall() {
  const text = 'npm install @nirholas/pump-sdk';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showCopyFeedback();
    });
  } else {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showCopyFeedback();
  }
}

function showCopyFeedback() {
  const btn = document.querySelector('.copy-btn');
  if (btn) {
    const original = btn.textContent;
    btn.textContent = '✅';
    setTimeout(() => { btn.textContent = original; }, 1500);
  }
}

// ==================== Init ====================
document.addEventListener('DOMContentLoaded', () => {
  renderDocGrid();

  // Handle hash navigation
  const hash = window.location.hash.replace('#', '');
  if (hash && ['home', 'docs', 'sdk', 'tools', 'ecosystem'].includes(hash)) {
    navigateTo(hash);
  }
});
