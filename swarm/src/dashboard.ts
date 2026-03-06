// ── PumpFun Swarm — Dashboard HTML ────────────────────────────────
//
// Single-file production dashboard. No build tools. Modern CSS Grid,
// real-time WebSocket, dark theme with glassmorphism, fully responsive.
// ──────────────────────────────────────────────────────────────────

export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PumpFun Swarm — Control Panel</title>
<style>
  :root {
    --bg-primary: #0a0b0f;
    --bg-secondary: #12141a;
    --bg-card: #181b24;
    --bg-card-hover: #1e2230;
    --border: #2a2d3a;
    --border-active: #3b3f52;
    --text-primary: #e4e6f0;
    --text-secondary: #8b8fa3;
    --text-muted: #565a6e;
    --accent-green: #00e676;
    --accent-green-dim: rgba(0, 230, 118, 0.15);
    --accent-red: #ff5252;
    --accent-red-dim: rgba(255, 82, 82, 0.15);
    --accent-blue: #448aff;
    --accent-blue-dim: rgba(68, 138, 255, 0.15);
    --accent-yellow: #ffd740;
    --accent-yellow-dim: rgba(255, 215, 64, 0.15);
    --accent-purple: #b388ff;
    --accent-purple-dim: rgba(179, 136, 255, 0.15);
    --accent-orange: #ff9100;
    --accent-cyan: #18ffff;
    --radius: 12px;
    --radius-sm: 8px;
    --glass: rgba(255, 255, 255, 0.03);
    --shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.2);
    --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
    --transition: 150ms ease;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { font-size: 14px; }

  body {
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: var(--font);
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* ── Layout ────────────────────────────────────────────────── */
  .app {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 100vh;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(20px);
  }

  .header-left { display: flex; align-items: center; gap: 16px; }

  .logo {
    font-size: 1.4rem;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent-green), var(--accent-cyan));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.5px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-badge.connected {
    background: var(--accent-green-dim);
    color: var(--accent-green);
  }

  .status-badge.disconnected {
    background: var(--accent-red-dim);
    color: var(--accent-red);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .header-right { display: flex; align-items: center; gap: 12px; }

  .header-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 12px;
    border-right: 1px solid var(--border);
  }
  .header-stat:last-child { border-right: none; }
  .header-stat-value {
    font-size: 1.1rem;
    font-weight: 700;
    font-family: var(--mono);
  }
  .header-stat-label {
    font-size: 0.65rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* ── Main Content ──────────────────────────────────────────── */
  .main {
    display: grid;
    grid-template-columns: 1fr 380px;
    grid-template-rows: auto 1fr;
    gap: 20px;
    padding: 20px 24px;
    max-width: 1600px;
    margin: 0 auto;
    width: 100%;
  }

  /* ── Metrics Bar ───────────────────────────────────────────── */
  .metrics-bar {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }

  .metric-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: var(--transition);
  }
  .metric-card:hover {
    border-color: var(--border-active);
    background: var(--bg-card-hover);
  }
  .metric-value {
    font-size: 1.6rem;
    font-weight: 700;
    font-family: var(--mono);
    line-height: 1;
  }
  .metric-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .metric-value.green { color: var(--accent-green); }
  .metric-value.blue { color: var(--accent-blue); }
  .metric-value.yellow { color: var(--accent-yellow); }
  .metric-value.purple { color: var(--accent-purple); }
  .metric-value.red { color: var(--accent-red); }
  .metric-value.cyan { color: var(--accent-cyan); }

  /* ── Bot Cards ─────────────────────────────────────────────── */
  .bots-section { display: flex; flex-direction: column; gap: 16px; }

  .section-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }

  .bot-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }

  .bot-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: var(--transition);
    position: relative;
    overflow: hidden;
  }
  .bot-card:hover {
    border-color: var(--border-active);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
  .bot-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: var(--radius) var(--radius) 0 0;
  }
  .bot-card.running::before { background: var(--accent-green); }
  .bot-card.stopped::before { background: var(--text-muted); }
  .bot-card.error::before { background: var(--accent-red); }
  .bot-card.starting::before {
    background: linear-gradient(90deg, var(--accent-yellow), transparent);
    animation: loading 1.5s infinite;
  }
  .bot-card.stopping::before {
    background: linear-gradient(90deg, var(--accent-orange), transparent);
    animation: loading 1.5s infinite reverse;
  }

  @keyframes loading {
    0% { opacity: 0.3; }
    50% { opacity: 1; }
    100% { opacity: 0.3; }
  }

  .bot-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .bot-name {
    font-size: 1rem;
    font-weight: 600;
  }

  .bot-id {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-family: var(--mono);
  }

  .bot-status {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .bot-status.running { background: var(--accent-green-dim); color: var(--accent-green); }
  .bot-status.stopped { background: rgba(86, 90, 110, 0.2); color: var(--text-muted); }
  .bot-status.error { background: var(--accent-red-dim); color: var(--accent-red); }
  .bot-status.starting { background: var(--accent-yellow-dim); color: var(--accent-yellow); }
  .bot-status.stopping { background: rgba(255, 145, 0, 0.15); color: var(--accent-orange); }

  .bot-desc {
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .bot-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 8px 0;
    border-top: 1px solid var(--border);
  }

  .bot-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .bot-stat-value {
    font-family: var(--mono);
    font-weight: 600;
    font-size: 0.9rem;
  }
  .bot-stat-label {
    font-size: 0.6rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .bot-actions {
    display: flex;
    gap: 8px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: transparent;
    color: var(--text-primary);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    font-family: var(--font);
  }
  .btn:hover {
    background: var(--glass);
    border-color: var(--border-active);
  }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn.primary   { border-color: var(--accent-green); color: var(--accent-green); }
  .btn.primary:hover   { background: var(--accent-green-dim); }
  .btn.danger    { border-color: var(--accent-red); color: var(--accent-red); }
  .btn.danger:hover    { background: var(--accent-red-dim); }
  .btn.warning   { border-color: var(--accent-yellow); color: var(--accent-yellow); }
  .btn.warning:hover   { background: var(--accent-yellow-dim); }

  /* ── Event Feed ────────────────────────────────────────────── */
  .feed-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: calc(100vh - 240px);
  }

  .feed-filters {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .filter-btn {
    padding: 4px 10px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.65rem;
    cursor: pointer;
    transition: var(--transition);
    font-family: var(--font);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .filter-btn:hover { border-color: var(--border-active); color: var(--text-secondary); }
  .filter-btn.active {
    background: var(--accent-blue-dim);
    border-color: var(--accent-blue);
    color: var(--accent-blue);
  }

  .feed {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }

  .feed-item {
    display: grid;
    grid-template-columns: 70px 90px 1fr;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    align-items: center;
    transition: var(--transition);
    animation: slideIn 200ms ease;
  }
  .feed-item:hover {
    background: var(--bg-card-hover);
    border-color: var(--border-active);
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(10px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .feed-time {
    font-family: var(--mono);
    font-size: 0.65rem;
    color: var(--text-muted);
  }

  .feed-type {
    font-weight: 600;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .feed-type.bot-started,
  .feed-type.bot-health { color: var(--accent-green); }
  .feed-type.bot-stopped { color: var(--text-muted); }
  .feed-type.bot-error { color: var(--accent-red); }
  .feed-type.bot-log { color: var(--text-secondary); }
  .feed-type.token-launch { color: var(--accent-cyan); }
  .feed-type.token-graduation { color: var(--accent-purple); }
  .feed-type.trade-buy { color: var(--accent-green); }
  .feed-type.trade-sell { color: var(--accent-red); }
  .feed-type.trade-whale,
  .feed-type.alert-whale { color: var(--accent-yellow); }
  .feed-type.fee-claim,
  .feed-type.fee-distribution { color: var(--accent-blue); }
  .feed-type.call-new { color: var(--accent-orange); }
  .feed-type.alert-cto { color: var(--accent-purple); }

  .feed-message {
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Log Viewer Modal ──────────────────────────────────────── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 200;
    display: none;
    place-items: center;
  }
  .modal-overlay.active { display: grid; }

  .modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    width: min(90vw, 800px);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }
  .modal-title { font-weight: 600; }
  .modal-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 1.2rem;
    padding: 4px;
  }
  .modal-close:hover { color: var(--text-primary); }

  .log-viewer {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    font-family: var(--mono);
    font-size: 0.72rem;
    line-height: 1.6;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-all;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }

  .log-line { padding: 1px 0; }
  .log-line.error { color: var(--accent-red); }
  .log-line.warn { color: var(--accent-yellow); }

  /* ── Responsive ────────────────────────────────────────────── */
  @media (max-width: 1024px) {
    .main {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto;
    }
    .feed-section { max-height: 400px; }
  }

  @media (max-width: 640px) {
    .header { flex-direction: column; gap: 12px; }
    .header-right { flex-wrap: wrap; justify-content: center; }
    .main { padding: 12px; }
    .metrics-bar { grid-template-columns: repeat(2, 1fr); }
    .bot-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<div class="app">

  <!-- ── Header ──────────────────────────────────────────────── -->
  <header class="header">
    <div class="header-left">
      <div class="logo">PumpFun Swarm</div>
      <span id="ws-status" class="status-badge disconnected">
        <span class="status-dot"></span>
        <span id="ws-status-text">Connecting…</span>
      </span>
    </div>
    <div class="header-right">
      <div class="header-stat">
        <span class="header-stat-value" id="stat-uptime">0s</span>
        <span class="header-stat-label">Uptime</span>
      </div>
      <div class="header-stat">
        <span class="header-stat-value" id="stat-active-bots">0</span>
        <span class="header-stat-label">Active Bots</span>
      </div>
      <div class="header-stat">
        <span class="header-stat-value" id="stat-events-min">0</span>
        <span class="header-stat-label">Events/min</span>
      </div>
      <div class="header-stat">
        <span class="header-stat-value" id="stat-ws-clients">0</span>
        <span class="header-stat-label">WS Clients</span>
      </div>
    </div>
  </header>

  <!-- ── Main Content ────────────────────────────────────────── -->
  <main class="main">

    <!-- Metrics Bar -->
    <div class="metrics-bar">
      <div class="metric-card">
        <span class="metric-value cyan" id="m-total-events">0</span>
        <span class="metric-label">Total Events</span>
      </div>
      <div class="metric-card">
        <span class="metric-value green" id="m-token-launches">0</span>
        <span class="metric-label">Token Launches</span>
      </div>
      <div class="metric-card">
        <span class="metric-value blue" id="m-fee-claims">0</span>
        <span class="metric-label">Fee Claims</span>
      </div>
      <div class="metric-card">
        <span class="metric-value purple" id="m-total-trades">0</span>
        <span class="metric-label">Trades</span>
      </div>
      <div class="metric-card">
        <span class="metric-value yellow" id="m-calls">0</span>
        <span class="metric-label">Calls Made</span>
      </div>
      <div class="metric-card">
        <span class="metric-value red" id="m-errors">0</span>
        <span class="metric-label">Errors</span>
      </div>
    </div>

    <!-- Bot Cards -->
    <section class="bots-section">
      <div class="section-title">Bot Fleet</div>
      <div class="bot-grid" id="bot-grid">
        <!-- Populated by JS -->
      </div>
    </section>

    <!-- Event Feed -->
    <section class="feed-section">
      <div class="section-title">Live Event Feed</div>
      <div class="feed-filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="bot">Bots</button>
        <button class="filter-btn" data-filter="token">Tokens</button>
        <button class="filter-btn" data-filter="trade">Trades</button>
        <button class="filter-btn" data-filter="fee">Fees</button>
        <button class="filter-btn" data-filter="call">Calls</button>
        <button class="filter-btn" data-filter="alert">Alerts</button>
      </div>
      <div class="feed" id="event-feed">
        <div class="feed-item">
          <span class="feed-time">--:--:--</span>
          <span class="feed-type">system</span>
          <span class="feed-message">Waiting for connection…</span>
        </div>
      </div>
    </section>

  </main>
</div>

<!-- ── Log Modal ──────────────────────────────────────────────── -->
<div class="modal-overlay" id="log-modal">
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title" id="log-modal-title">Bot Logs</span>
      <button class="modal-close" id="log-modal-close">&times;</button>
    </div>
    <div class="log-viewer" id="log-viewer"></div>
  </div>
</div>

<script>
(function() {
  'use strict';

  // ── State ───────────────────────────────────────────────────
  let ws = null;
  let state = { bots: {}, events: [], metrics: {}, uptime: 0, startedAt: '' };
  let activeFilter = 'all';
  const MAX_FEED = 200;

  // ── DOM Refs ────────────────────────────────────────────────
  const botGrid = document.getElementById('bot-grid');
  const eventFeed = document.getElementById('event-feed');
  const wsStatusBadge = document.getElementById('ws-status');
  const wsStatusText = document.getElementById('ws-status-text');

  // ── WebSocket Connection ────────────────────────────────────
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(proto + '//' + location.host + '/ws');

    ws.onopen = () => {
      wsStatusBadge.className = 'status-badge connected';
      wsStatusText.textContent = 'Connected';
    };

    ws.onclose = () => {
      wsStatusBadge.className = 'status-badge disconnected';
      wsStatusText.textContent = 'Disconnected';
      setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      wsStatusBadge.className = 'status-badge disconnected';
      wsStatusText.textContent = 'Error';
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        handleMessage(msg);
      } catch { /* ignore parse errors */ }
    };
  }

  // ── Message Handler ─────────────────────────────────────────
  function handleMessage(msg) {
    if (msg.type === 'init' || msg.type === 'state') {
      state = msg.data;
      renderAll();
      return;
    }

    // It's a SwarmEvent
    state.events.push(msg);
    if (state.events.length > MAX_FEED) {
      state.events = state.events.slice(-MAX_FEED);
    }

    // Update bot health on relevant events
    if (msg.type === 'bot:health' && msg.data?.status) {
      state.bots[msg.source] = msg.data;
    }
    if (msg.type === 'bot:started' || msg.type === 'bot:stopped' || msg.type === 'bot:error') {
      // Request fresh state
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'status' }));
      }
    }

    // Update metrics
    if (msg.type.startsWith('token:')) state.metrics.totalTokenLaunches = (state.metrics.totalTokenLaunches || 0) + 1;
    if (msg.type.startsWith('trade:')) state.metrics.totalTrades = (state.metrics.totalTrades || 0) + 1;
    if (msg.type.startsWith('fee:')) state.metrics.totalFeeClaims = (state.metrics.totalFeeClaims || 0) + 1;
    if (msg.type.startsWith('call:')) state.metrics.totalCalls = (state.metrics.totalCalls || 0) + 1;
    state.metrics.totalEvents = (state.metrics.totalEvents || 0) + 1;

    renderMetrics();
    renderHeader();
    addFeedItem(msg);
  }

  // ── Render Functions ────────────────────────────────────────
  function renderAll() {
    renderHeader();
    renderMetrics();
    renderBots();
    renderFeed();
  }

  function renderHeader() {
    const uptime = state.uptime || 0;
    document.getElementById('stat-uptime').textContent = formatUptime(uptime);
    document.getElementById('stat-active-bots').textContent =
      Object.values(state.bots).filter(b => b.status === 'running').length;
    document.getElementById('stat-events-min').textContent =
      state.metrics?.eventsPerMinute || 0;
  }

  function renderMetrics() {
    const m = state.metrics || {};
    document.getElementById('m-total-events').textContent = fmtNum(m.totalEvents || 0);
    document.getElementById('m-token-launches').textContent = fmtNum(m.totalTokenLaunches || 0);
    document.getElementById('m-fee-claims').textContent = fmtNum(m.totalFeeClaims || 0);
    document.getElementById('m-total-trades').textContent = fmtNum(m.totalTrades || 0);
    document.getElementById('m-calls').textContent = fmtNum(m.totalCalls || 0);
    document.getElementById('m-errors').textContent = fmtNum(m.totalErrors || 0);
  }

  function renderBots() {
    const botIds = ['telegram-bot', 'outsiders-bot', 'channel-bot', 'websocket-server'];
    const names = {
      'telegram-bot': 'PumpFun Fee Monitor',
      'outsiders-bot': 'Outsiders Call Tracker',
      'channel-bot': 'Channel Feed Bot',
      'websocket-server': 'WebSocket Relay',
    };
    const icons = {
      'telegram-bot': '📡',
      'outsiders-bot': '🏆',
      'channel-bot': '📢',
      'websocket-server': '🔌',
    };
    const descs = {
      'telegram-bot': 'Monitors creator fees, CTO alerts, whale trades. REST API + webhooks.',
      'outsiders-bot': 'Call tracking with leaderboards, PNL cards, win rates, hardcore mode.',
      'channel-bot': 'Read-only feed: launches, graduations, whales, fee claims.',
      'websocket-server': 'Real-time token launch broadcasts via WebSocket.',
    };

    botGrid.innerHTML = botIds.map(id => {
      const h = state.bots[id] || { status: 'stopped', uptime: 0, restarts: 0, metrics: { eventsProcessed: 0, eventsEmitted: 0, errorsTotal: 0 } };
      const s = h.status || 'stopped';
      return '<div class="bot-card ' + s + '" data-bot="' + id + '">' +
        '<div class="bot-header">' +
          '<div>' +
            '<div class="bot-name">' + icons[id] + ' ' + names[id] + '</div>' +
            '<div class="bot-id">' + id + '</div>' +
          '</div>' +
          '<span class="bot-status ' + s + '">' + s + '</span>' +
        '</div>' +
        '<div class="bot-desc">' + descs[id] + '</div>' +
        '<div class="bot-stats">' +
          '<div class="bot-stat"><span class="bot-stat-value">' + formatUptime(h.uptime || 0) + '</span><span class="bot-stat-label">Uptime</span></div>' +
          '<div class="bot-stat"><span class="bot-stat-value">' + (h.restarts || 0) + '</span><span class="bot-stat-label">Restarts</span></div>' +
          '<div class="bot-stat"><span class="bot-stat-value">' + fmtNum(h.metrics?.eventsEmitted || 0) + '</span><span class="bot-stat-label">Events</span></div>' +
        '</div>' +
        '<div class="bot-actions">' +
          (s === 'stopped' || s === 'error' ?
            '<button class="btn primary" onclick="botAction(\\'' + id + '\\', \\'start\\')">&#9654; Start</button>' :
            '<button class="btn danger" onclick="botAction(\\'' + id + '\\', \\'stop\\')">&#9724; Stop</button>') +
          (s === 'running' ? '<button class="btn warning" onclick="botAction(\\'' + id + '\\', \\'restart\\')">&#8635; Restart</button>' : '') +
          '<button class="btn" onclick="showLogs(\\'' + id + '\\')">&#128196; Logs</button>' +
        '</div>' +
        (h.lastError ? '<div style="font-size:0.7rem;color:var(--accent-red);margin-top:4px;">&#9888; ' + escapeHtml(h.lastError) + '</div>' : '') +
      '</div>';
    }).join('');
  }

  function renderFeed() {
    const filtered = filterEvents(state.events || []);
    eventFeed.innerHTML = filtered.slice(-100).map(ev => feedItemHtml(ev)).join('');
    eventFeed.scrollTop = eventFeed.scrollHeight;
  }

  function addFeedItem(ev) {
    if (!matchFilter(ev)) return;
    eventFeed.insertAdjacentHTML('beforeend', feedItemHtml(ev));
    // Keep max items
    while (eventFeed.children.length > MAX_FEED) {
      eventFeed.removeChild(eventFeed.firstChild);
    }
    eventFeed.scrollTop = eventFeed.scrollHeight;
  }

  function feedItemHtml(ev) {
    const time = new Date(ev.timestamp).toLocaleTimeString();
    const typeClass = ev.type.replace(/:/g, '-');
    const typeLabel = ev.type.replace(':', ' ').replace(/_/g, ' ');
    const source = ev.source || '?';
    let msg = '';
    if (ev.data) {
      if (typeof ev.data === 'string') msg = ev.data;
      else if (ev.data.message) msg = ev.data.message;
      else if (ev.data.raw) msg = ev.data.raw;
      else if (ev.data.error) msg = ev.data.error;
      else if (ev.data.botId) msg = ev.data.botId + (ev.data.pid ? ' (pid=' + ev.data.pid + ')' : '');
      else msg = JSON.stringify(ev.data).slice(0, 120);
    }
    return '<div class="feed-item">' +
      '<span class="feed-time">' + time + '</span>' +
      '<span class="feed-type ' + typeClass + '">' + escapeHtml(typeLabel) + '</span>' +
      '<span class="feed-message">[' + escapeHtml(source) + '] ' + escapeHtml(msg) + '</span>' +
    '</div>';
  }

  // ── Filter ──────────────────────────────────────────────────
  function filterEvents(events) {
    if (activeFilter === 'all') return events;
    return events.filter(e => matchFilter(e));
  }

  function matchFilter(ev) {
    if (activeFilter === 'all') return true;
    return ev.type.startsWith(activeFilter + ':') || ev.type.startsWith(activeFilter);
  }

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderFeed();
    });
  });

  // ── Bot Actions ─────────────────────────────────────────────
  window.botAction = function(botId, action) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: action, botId: botId }));
    } else {
      // Fallback to REST
      fetch('/api/v1/bots/' + botId + '/' + action, { method: 'POST' })
        .then(r => r.json())
        .then(() => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: 'status' })); });
    }
  };

  // ── Log Modal ───────────────────────────────────────────────
  window.showLogs = function(botId) {
    document.getElementById('log-modal-title').textContent = botId + ' — Logs';
    document.getElementById('log-modal').classList.add('active');
    document.getElementById('log-viewer').textContent = 'Loading…';

    fetch('/api/v1/bots/' + botId + '/logs?limit=300')
      .then(r => r.json())
      .then(res => {
        const logs = res.data || [];
        document.getElementById('log-viewer').innerHTML = logs.map(l => {
          const cls = l.includes('ERROR') ? ' error' : l.includes('WARN') ? ' warn' : '';
          return '<div class="log-line' + cls + '">' + escapeHtml(l) + '</div>';
        }).join('');
        const viewer = document.getElementById('log-viewer');
        viewer.scrollTop = viewer.scrollHeight;
      })
      .catch(() => {
        document.getElementById('log-viewer').textContent = 'Failed to load logs.';
      });
  };

  document.getElementById('log-modal-close').addEventListener('click', () => {
    document.getElementById('log-modal').classList.remove('active');
  });
  document.getElementById('log-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });

  // ── Utilities ───────────────────────────────────────────────
  function formatUptime(secs) {
    if (!secs || secs <= 0) return '0s';
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + s + 's';
    return s + 's';
  }

  function fmtNum(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Refresh timer (uptime counter) ─────────────────────────
  setInterval(() => {
    if (state.startedAt) {
      state.uptime = (Date.now() - new Date(state.startedAt).getTime()) / 1000;
      renderHeader();
    }
  }, 1000);

  // ── Periodic full refresh ──────────────────────────────────
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'status' }));
    }
  }, 10000);

  // ── Init ────────────────────────────────────────────────────
  connect();
})();
</script>
</body>
</html>`;
}
