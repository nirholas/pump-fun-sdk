/**
 * Dashboard UI — Server-rendered SPA
 *
 * Full production dashboard with real-time monitoring, event feed,
 * service health cards, and system metrics.
 */

export function renderDashboard(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PumpFun Swarms Dashboard</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0a0f;--bg2:#12121a;--bg3:#1a1a26;--bg4:#222233;
  --border:#2a2a3a;--border2:#363650;
  --text:#e0e0f0;--text2:#9090b0;--text3:#606080;
  --accent:#7c5cfc;--accent2:#9b7cff;--accent-glow:rgba(124,92,252,0.15);
  --green:#22c55e;--green-bg:rgba(34,197,94,0.12);
  --red:#ef4444;--red-bg:rgba(239,68,68,0.12);
  --yellow:#eab308;--yellow-bg:rgba(234,179,8,0.12);
  --blue:#3b82f6;--blue-bg:rgba(59,130,246,0.12);
  --radius:12px;--radius-sm:8px;
  --shadow:0 4px 24px rgba(0,0,0,0.4);
  --font:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  --mono:'SF Mono','Cascadia Code','Fira Code',monospace;
}
html{font-family:var(--font);background:var(--bg);color:var(--text);font-size:14px;line-height:1.5}
body{min-height:100vh;overflow-x:hidden}
a{color:var(--accent2);text-decoration:none}
a:hover{text-decoration:underline}
button{font-family:var(--font);cursor:pointer;border:none;border-radius:var(--radius-sm)}

/* ── Layout ─────────────────────────────────────────────── */
.app{display:grid;grid-template-rows:auto 1fr;min-height:100vh}
.header{
  background:var(--bg2);border-bottom:1px solid var(--border);
  padding:16px 24px;display:flex;align-items:center;gap:16px;
  position:sticky;top:0;z-index:100;backdrop-filter:blur(12px);
}
.header h1{font-size:18px;font-weight:700;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.header .badge{font-size:11px;padding:2px 8px;border-radius:10px;background:var(--accent-glow);color:var(--accent2);font-weight:600}
.header .spacer{flex:1}
.header .status-pill{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2)}
.header .status-pill .dot{width:8px;height:8px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
.header .btn-refresh{padding:6px 14px;background:var(--bg3);color:var(--text);border:1px solid var(--border);font-size:12px;transition:all .2s}
.header .btn-refresh:hover{background:var(--bg4);border-color:var(--accent)}

@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}

.main{display:grid;grid-template-columns:1fr 380px;gap:0;overflow:hidden}
@media(max-width:960px){.main{grid-template-columns:1fr}}

/* ── Left Panel ─────────────────────────────────────────── */
.content{padding:24px;overflow-y:auto;max-height:calc(100vh - 60px)}

/* Stats Row */
.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px}
.stat-card{
  background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
  padding:16px;display:flex;flex-direction:column;gap:4px;
  transition:border-color .2s;
}
.stat-card:hover{border-color:var(--border2)}
.stat-card .label{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--text3);font-weight:600}
.stat-card .value{font-size:28px;font-weight:700;font-family:var(--mono)}
.stat-card .sub{font-size:11px;color:var(--text2)}
.stat-card.healthy .value{color:var(--green)}
.stat-card.degraded .value{color:var(--yellow)}
.stat-card.down .value{color:var(--red)}

/* Section headers */
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.section-header h2{font-size:15px;font-weight:600;color:var(--text)}
.section-header .badge-count{font-size:11px;padding:2px 8px;border-radius:10px;background:var(--bg3);color:var(--text2)}

/* Service cards */
.services{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:32px}
.svc-card{
  background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
  padding:18px;display:flex;flex-direction:column;gap:10px;
  transition:all .25s;position:relative;overflow:hidden;
}
.svc-card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:var(--border);transition:background .3s;
}
.svc-card.healthy::before{background:var(--green)}
.svc-card.degraded::before{background:var(--yellow)}
.svc-card.down::before{background:var(--red)}
.svc-card:hover{border-color:var(--border2);transform:translateY(-1px);box-shadow:var(--shadow)}

.svc-card .svc-top{display:flex;align-items:center;gap:10px}
.svc-card .svc-icon{width:36px;height:36px;border-radius:var(--radius-sm);display:grid;place-items:center;font-size:16px;background:var(--bg3)}
.svc-card .svc-name{font-weight:600;font-size:14px}
.svc-card .svc-status{
  margin-left:auto;font-size:11px;padding:3px 10px;border-radius:10px;
  font-weight:600;text-transform:uppercase;letter-spacing:.5px;
}
.svc-card.healthy .svc-status{background:var(--green-bg);color:var(--green)}
.svc-card.degraded .svc-status{background:var(--yellow-bg);color:var(--yellow)}
.svc-card.down .svc-status{background:var(--red-bg);color:var(--red)}
.svc-card.unknown .svc-status{background:var(--bg3);color:var(--text3)}

.svc-card .svc-desc{font-size:12px;color:var(--text2);line-height:1.4}
.svc-card .svc-meta{
  display:flex;gap:16px;font-size:11px;color:var(--text3);
  border-top:1px solid var(--border);padding-top:8px;margin-top:auto;
  font-family:var(--mono);
}
.svc-card .svc-meta span{display:flex;align-items:center;gap:4px}

/* ── Right Panel (Event Feed) ───────────────────────────── */
.sidebar{
  background:var(--bg2);border-left:1px solid var(--border);
  display:flex;flex-direction:column;overflow:hidden;
  max-height:calc(100vh - 60px);
}
@media(max-width:960px){.sidebar{border-left:none;border-top:1px solid var(--border);max-height:400px}}

.sidebar-header{
  padding:16px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;gap:8px;
  background:var(--bg2);position:sticky;top:0;
}
.sidebar-header h3{font-size:13px;font-weight:600;flex:1}
.sidebar-header .live-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}

.event-feed{flex:1;overflow-y:auto;padding:8px}
.event-item{
  padding:10px 12px;border-radius:var(--radius-sm);margin-bottom:4px;
  border-left:3px solid transparent;transition:background .15s;
  cursor:default;
}
.event-item:hover{background:var(--bg3)}
.event-item.health_change{border-left-color:var(--blue)}
.event-item.claim{border-left-color:var(--green)}
.event-item.launch{border-left-color:var(--accent)}
.event-item.graduation{border-left-color:var(--yellow)}
.event-item.whale_trade{border-left-color:var(--red)}
.event-item.fee_distribution{border-left-color:#f97316}
.event-item.cto{border-left-color:#ec4899}
.event-item.info{border-left-color:var(--text3)}
.event-item.error{border-left-color:var(--red)}

.event-item .ev-time{font-size:10px;color:var(--text3);font-family:var(--mono)}
.event-item .ev-title{font-size:12px;font-weight:500;margin-top:2px}
.event-item .ev-svc{font-size:10px;color:var(--text2);margin-top:1px}
.event-item .ev-detail{font-size:11px;color:var(--text3);margin-top:3px;font-family:var(--mono)}

.empty-state{color:var(--text3);font-size:12px;text-align:center;padding:40px 16px}

/* ── Auth Modal ──────────────────────────────────────────── */
.auth-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,0.8);
  display:grid;place-items:center;z-index:1000;
}
.auth-modal{
  background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
  padding:32px;width:380px;max-width:90vw;box-shadow:var(--shadow);
}
.auth-modal h2{font-size:18px;margin-bottom:8px;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.auth-modal p{font-size:12px;color:var(--text2);margin-bottom:20px}
.auth-modal input{
  width:100%;padding:10px 14px;background:var(--bg3);border:1px solid var(--border);
  border-radius:var(--radius-sm);color:var(--text);font-family:var(--mono);font-size:13px;
  margin-bottom:12px;outline:none;transition:border-color .2s;
}
.auth-modal input:focus{border-color:var(--accent)}
.auth-modal .btn-auth{
  width:100%;padding:10px;background:var(--accent);color:#fff;font-weight:600;
  font-size:13px;border-radius:var(--radius-sm);transition:opacity .2s;
}
.auth-modal .btn-auth:hover{opacity:.85}
.auth-modal .error-msg{color:var(--red);font-size:11px;margin-top:8px;display:none}

.hidden{display:none !important}
</style>
</head>
<body>
<div class="app">
  <!-- Header -->
  <header class="header">
    <h1>PumpFun Swarms</h1>
    <span class="badge">DASHBOARD</span>
    <div class="spacer"></div>
    <div class="status-pill" id="connStatus">
      <span class="dot" id="connDot"></span>
      <span id="connText">Connecting…</span>
    </div>
    <button class="btn-refresh" id="btnRefresh" title="Force refresh all services">↻ Refresh</button>
  </header>

  <!-- Main Area -->
  <div class="main">
    <!-- Left: Services & Stats -->
    <div class="content">
      <!-- Stats Row -->
      <div class="stats-row" id="statsRow">
        <div class="stat-card" id="statTotal"><div class="label">Total Services</div><div class="value">—</div><div class="sub">configured</div></div>
        <div class="stat-card healthy" id="statHealthy"><div class="label">Healthy</div><div class="value">—</div><div class="sub">running</div></div>
        <div class="stat-card" id="statEvents"><div class="label">Events</div><div class="value">—</div><div class="sub">captured</div></div>
        <div class="stat-card" id="statUptime"><div class="label">Uptime</div><div class="value">—</div><div class="sub">dashboard</div></div>
        <div class="stat-card" id="statClients"><div class="label">SSE Clients</div><div class="value">—</div><div class="sub">connected</div></div>
      </div>

      <!-- Services -->
      <div class="section-header">
        <h2>Bot Services</h2>
        <span class="badge-count" id="svcCount">0 services</span>
      </div>
      <div class="services" id="serviceGrid">
        <div class="empty-state">No services configured. Add bot URLs in .env</div>
      </div>
    </div>

    <!-- Right: Event Feed -->
    <div class="sidebar">
      <div class="sidebar-header">
        <span class="live-dot"></span>
        <h3>Live Event Feed</h3>
        <span class="badge-count" id="eventCount">0</span>
      </div>
      <div class="event-feed" id="eventFeed">
        <div class="empty-state">Waiting for events…</div>
      </div>
    </div>
  </div>
</div>

<!-- Auth Modal -->
<div class="auth-overlay hidden" id="authOverlay">
  <div class="auth-modal">
    <h2>Authentication Required</h2>
    <p>Enter your dashboard API key to continue.</p>
    <input type="password" id="authInput" placeholder="API Key" autocomplete="off" />
    <button class="btn-auth" id="authBtn">Authenticate</button>
    <div class="error-msg" id="authError">Invalid API key. Please try again.</div>
  </div>
</div>

<script>
(function() {
  'use strict';

  // ── State ────────────────────────────────────────────────
  let apiKey = localStorage.getItem('dashboard_key') || '';
  let services = [];
  let events = [];
  let eventSource = null;
  let stats = {};

  // ── DOM refs ─────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const serviceGrid = $('#serviceGrid');
  const eventFeed = $('#eventFeed');
  const authOverlay = $('#authOverlay');
  const authInput = $('#authInput');
  const authBtn = $('#authBtn');
  const authError = $('#authError');
  const btnRefresh = $('#btnRefresh');
  const connDot = $('#connDot');
  const connText = $('#connText');

  // ── Icons for each service ───────────────────────────────
  const SVC_ICONS = {
    'telegram-bot': '🤖',
    'channel-bot': '📢',
    'outsiders-bot': '👥',
    'websocket-server': '⚡',
  };

  const EVENT_ICONS = {
    health_change: '🔄',
    claim: '💰',
    launch: '🚀',
    graduation: '🎓',
    whale_trade: '🐋',
    fee_distribution: '💸',
    cto: '👑',
    info: 'ℹ️',
    error: '❌',
  };

  // ── Auth ─────────────────────────────────────────────────
  function headers() {
    const h = { 'Content-Type': 'application/json' };
    if (apiKey) h['X-API-Key'] = apiKey;
    return h;
  }

  async function checkAuth() {
    try {
      const res = await fetch('/api/stats', { headers: headers() });
      if (res.status === 401) {
        authOverlay.classList.remove('hidden');
        return false;
      }
      authOverlay.classList.add('hidden');
      return true;
    } catch {
      return false;
    }
  }

  authBtn.addEventListener('click', async () => {
    apiKey = authInput.value.trim();
    if (!apiKey) return;
    localStorage.setItem('dashboard_key', apiKey);
    const ok = await checkAuth();
    if (ok) {
      authError.style.display = 'none';
      init();
    } else {
      authError.style.display = 'block';
      localStorage.removeItem('dashboard_key');
    }
  });

  authInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') authBtn.click();
  });

  // ── API calls ────────────────────────────────────────────
  async function fetchServices() {
    try {
      const res = await fetch('/api/services', { headers: headers() });
      if (!res.ok) return;
      const data = await res.json();
      services = data.services || [];
      renderServices();
    } catch { /* network error */ }
  }

  async function fetchStats() {
    try {
      const res = await fetch('/api/stats', { headers: headers() });
      if (!res.ok) return;
      stats = await res.json();
      renderStats();
    } catch { /* network error */ }
  }

  async function fetchEvents() {
    try {
      const res = await fetch('/api/events?limit=50', { headers: headers() });
      if (!res.ok) return;
      const data = await res.json();
      events = data.events || [];
      renderEvents();
    } catch { /* network error */ }
  }

  // ── SSE ──────────────────────────────────────────────────
  function connectSSE() {
    if (eventSource) eventSource.close();

    const url = '/api/events/stream';
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      connDot.style.background = 'var(--green)';
      connText.textContent = 'Connected';
    };

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'init') {
          // Initial payload
          if (data.services) { services = data.services; renderServices(); }
          if (data.recentEvents) { events = data.recentEvents; renderEvents(); }
        } else {
          // Live event
          events.unshift(data);
          if (events.length > 200) events.pop();
          renderEventItem(data, true);
          // Re-fetch services on health change
          if (data.type === 'health_change') fetchServices();
        }
        fetchStats();
      } catch { /* parse error */ }
    };

    eventSource.onerror = () => {
      connDot.style.background = 'var(--red)';
      connText.textContent = 'Disconnected';
      setTimeout(connectSSE, 5000);
    };
  }

  // ── Render functions ─────────────────────────────────────

  function renderStats() {
    setStatCard('statTotal', stats.totalServices ?? '—');
    setStatCard('statHealthy', stats.healthy ?? '—');
    setStatCard('statEvents', stats.totalEvents ?? '—');
    setStatCard('statUptime', formatDuration(stats.uptimeMs || 0));
    setStatCard('statClients', stats.sseClients ?? '—');

    // Color code healthy stat
    const healthyCard = $('#statHealthy');
    healthyCard.classList.remove('healthy', 'degraded', 'down');
    if (stats.totalServices > 0) {
      if (stats.healthy === stats.totalServices) healthyCard.classList.add('healthy');
      else if (stats.down > 0) healthyCard.classList.add('down');
      else healthyCard.classList.add('degraded');
    }
  }

  function setStatCard(id, value) {
    const card = document.getElementById(id);
    if (card) card.querySelector('.value').textContent = value;
  }

  function renderServices() {
    if (!services.length) {
      serviceGrid.innerHTML = '<div class="empty-state">No services configured. Add bot URLs in .env</div>';
      return;
    }
    serviceGrid.innerHTML = services.map(svc => {
      const icon = SVC_ICONS[svc.id] || '📦';
      return \`
        <div class="svc-card \${svc.status}" data-id="\${esc(svc.id)}">
          <div class="svc-top">
            <div class="svc-icon">\${icon}</div>
            <div class="svc-name">\${esc(svc.name)}</div>
            <div class="svc-status">\${svc.status}</div>
          </div>
          <div class="svc-desc">\${esc(svc.description)}</div>
          <div class="svc-meta">
            <span>⏱ \${svc.latencyMs}ms</span>
            <span>🔄 \${timeAgo(svc.lastCheck)}</span>
            \${svc.uptimeMs ? \`<span>⏳ \${formatDuration(svc.uptimeMs)}</span>\` : ''}
          </div>
        </div>
      \`;
    }).join('');
    $('#svcCount').textContent = services.length + ' service' + (services.length !== 1 ? 's' : '');
  }

  function renderEvents() {
    if (!events.length) {
      eventFeed.innerHTML = '<div class="empty-state">Waiting for events…</div>';
      return;
    }
    eventFeed.innerHTML = events.map(ev => eventItemHtml(ev)).join('');
    $('#eventCount').textContent = events.length;
  }

  function renderEventItem(ev, prepend) {
    const existing = eventFeed.querySelector('.empty-state');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.innerHTML = eventItemHtml(ev);
    const node = div.firstElementChild;
    node.style.animation = 'fadeIn .3s ease';

    if (prepend) eventFeed.prepend(node);
    else eventFeed.appendChild(node);

    // Keep max items
    while (eventFeed.children.length > 200) eventFeed.lastChild.remove();
    $('#eventCount').textContent = eventFeed.children.length;
  }

  function eventItemHtml(ev) {
    const icon = EVENT_ICONS[ev.type] || '📝';
    const detail = ev.details?.error || ev.details?.status || '';
    return \`
      <div class="event-item \${ev.type}">
        <div class="ev-time">\${icon} \${formatTime(ev.timestamp)}</div>
        <div class="ev-title">\${esc(ev.title)}</div>
        <div class="ev-svc">\${esc(ev.service)}</div>
        \${detail ? \`<div class="ev-detail">\${esc(String(detail))}</div>\` : ''}
      </div>
    \`;
  }

  // ── Utilities ────────────────────────────────────────────
  function esc(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = String(s);
    return div.innerHTML;
  }

  function formatTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function timeAgo(ts) {
    if (!ts) return 'never';
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 5) return 'just now';
    if (sec < 60) return sec + 's ago';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    return Math.floor(sec / 3600) + 'h ago';
  }

  function formatDuration(ms) {
    if (!ms || ms < 0) return '—';
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return sec + 's';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ' + (sec % 60) + 's';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h < 24) return h + 'h ' + m + 'm';
    const d = Math.floor(h / 24);
    return d + 'd ' + (h % 24) + 'h';
  }

  // ── Refresh button ───────────────────────────────────────
  btnRefresh.addEventListener('click', async () => {
    btnRefresh.disabled = true;
    btnRefresh.textContent = '↻ Refreshing…';
    try {
      await fetch('/api/services/refresh', { method: 'POST', headers: headers() });
      await fetchServices();
      await fetchStats();
    } finally {
      btnRefresh.disabled = false;
      btnRefresh.textContent = '↻ Refresh';
    }
  });

  // ── Add fadeIn animation ─────────────────────────────────
  const style = document.createElement('style');
  style.textContent = '@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(style);

  // ── Init ─────────────────────────────────────────────────
  async function init() {
    await fetchServices();
    await fetchStats();
    await fetchEvents();
    connectSSE();

    // Periodic refresh
    setInterval(fetchStats, 15000);
    setInterval(fetchServices, 30000);
  }

  // ── Entry ────────────────────────────────────────────────
  checkAuth().then(ok => { if (ok) init(); });
})();
</script>
</body>
</html>`;
}
