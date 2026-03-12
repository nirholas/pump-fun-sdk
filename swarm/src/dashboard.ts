// ── PumpFun Swarm — Dashboard HTML ────────────────────────────────
//
// Production dashboard with agent network visualization. No build tools.
// SVG-based swarm topology, animated event flows, glassmorphism, dark theme.
// ──────────────────────────────────────────────────────────────────

export function getDashboardHtml(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PumpFun Swarm — Control Panel</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg-primary: #07080c;
    --bg-secondary: #0e1017;
    --bg-card: #13151d;
    --bg-card-hover: #191c27;
    --border: #1e2133;
    --border-active: #2e3350;
    --text-primary: #e4e6f0;
    --text-secondary: #8b8fa3;
    --text-muted: #4e5268;
    --green: #00e676;
    --green-dim: rgba(0,230,118,.1);
    --green-glow: rgba(0,230,118,.35);
    --red: #ff5252;
    --red-dim: rgba(255,82,82,.1);
    --blue: #448aff;
    --blue-dim: rgba(68,138,255,.1);
    --yellow: #ffd740;
    --yellow-dim: rgba(255,215,64,.1);
    --purple: #b388ff;
    --purple-dim: rgba(179,136,255,.1);
    --orange: #ff9100;
    --orange-dim: rgba(255,145,0,.1);
    --cyan: #18ffff;
    --cyan-dim: rgba(24,255,255,.1);
    --radius: 14px;
    --radius-sm: 8px;
    --font: 'Inter', system-ui, sans-serif;
    --mono: 'JetBrains Mono', 'Fira Code', monospace;
    --transition: 180ms ease;
  }

  *{margin:0;padding:0;box-sizing:border-box}
  html{font-size:14px}
  body{
    background:var(--bg-primary);
    color:var(--text-primary);
    font-family:var(--font);
    min-height:100vh;
    overflow-x:hidden;
    background-image:
      radial-gradient(ellipse at 15% 50%, rgba(0,230,118,.025) 0%, transparent 50%),
      radial-gradient(ellipse at 85% 30%, rgba(68,138,255,.025) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 90%, rgba(179,136,255,.02) 0%, transparent 50%);
  }

  /* ── App Layout ──────────────────────────────────────────────── */
  .app{display:grid;grid-template-rows:auto 1fr;min-height:100vh}

  /* ── Header ──────────────────────────────────────────────────── */
  .header{
    display:flex;align-items:center;justify-content:space-between;
    padding:12px 24px;
    background:rgba(14,16,23,.85);
    border-bottom:1px solid var(--border);
    position:sticky;top:0;z-index:100;
    backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
  }
  .header-left{display:flex;align-items:center;gap:16px}
  .logo-group{display:flex;flex-direction:column;gap:0}
  .logo{
    font-size:1.35rem;font-weight:800;letter-spacing:-.5px;
    background:linear-gradient(135deg,var(--green),var(--cyan));
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;
    background-clip:text;
  }
  .logo-sub{font-size:.6rem;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;margin-top:-1px}
  .status-badge{
    display:inline-flex;align-items:center;gap:6px;
    padding:4px 12px;border-radius:20px;
    font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;
  }
  .status-badge.connected{background:var(--green-dim);color:var(--green)}
  .status-badge.disconnected{background:var(--red-dim);color:var(--red)}
  .status-dot{width:7px;height:7px;border-radius:50%;background:currentColor;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
  .header-right{display:flex;align-items:center;gap:16px}
  .header-stat{display:flex;flex-direction:column;align-items:center;padding:0 14px;border-right:1px solid var(--border)}
  .header-stat:last-child{border-right:none}
  .header-stat-value{font-size:1.05rem;font-weight:700;font-family:var(--mono)}
  .header-stat-label{font-size:.58rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px}
  .batch-actions{display:flex;gap:6px;margin-left:8px}

  /* ── Main Layout ─────────────────────────────────────────────── */
  .main{
    display:grid;
    grid-template-columns:1fr 360px;
    grid-template-rows:auto auto 1fr;
    gap:16px;
    padding:16px 24px 24px;
    max-width:1680px;
    margin:0 auto;width:100%;
  }

  /* ── Metrics Bar ─────────────────────────────────────────────── */
  .metrics-bar{
    grid-column:1/-1;
    display:grid;
    grid-template-columns:repeat(6,1fr);
    gap:10px;
  }
  .metric-card{
    background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);
    padding:14px 16px;display:flex;flex-direction:column;gap:3px;
    transition:var(--transition);position:relative;overflow:hidden;
  }
  .metric-card:hover{border-color:var(--border-active);background:var(--bg-card-hover)}
  .metric-card::after{
    content:'';position:absolute;top:0;left:0;right:0;height:2px;
    opacity:.6;border-radius:var(--radius-sm) var(--radius-sm) 0 0;
  }
  .metric-card:nth-child(1)::after{background:var(--cyan)}
  .metric-card:nth-child(2)::after{background:var(--green)}
  .metric-card:nth-child(3)::after{background:var(--blue)}
  .metric-card:nth-child(4)::after{background:var(--purple)}
  .metric-card:nth-child(5)::after{background:var(--yellow)}
  .metric-card:nth-child(6)::after{background:var(--red)}
  .metric-value{font-size:1.5rem;font-weight:700;font-family:var(--mono);line-height:1}
  .metric-label{font-size:.62rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px}
  .mv-cyan{color:var(--cyan)}.mv-green{color:var(--green)}.mv-blue{color:var(--blue)}
  .mv-purple{color:var(--purple)}.mv-yellow{color:var(--yellow)}.mv-red{color:var(--red)}

  /* ── Network Visualization ───────────────────────────────────── */
  .network-section{
    grid-column:1/-1;
    background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);
    position:relative;overflow:hidden;
  }
  .network-header{
    display:flex;align-items:center;justify-content:space-between;
    padding:12px 20px;border-bottom:1px solid var(--border);
  }
  .section-title{
    font-size:.72rem;font-weight:600;color:var(--text-muted);
    text-transform:uppercase;letter-spacing:1px;
  }
  .network-legend{display:flex;gap:14px}
  .legend-item{display:flex;align-items:center;gap:5px;font-size:.62rem;color:var(--text-muted)}
  .legend-dot{width:8px;height:8px;border-radius:50%}
  .network-canvas{
    position:relative;width:100%;height:340px;
    background:
      radial-gradient(circle at 50% 50%, rgba(0,230,118,.015) 0%, transparent 60%);
  }
  .network-svg{position:absolute;inset:0;width:100%;height:100%}

  /* SVG Agent Nodes */
  .agent-node{cursor:pointer;transition:transform .2s ease}
  .agent-node:hover{transform:scale(1.05)}
  .node-ring{fill:none;stroke-width:2;opacity:.3;transition:opacity .3s}
  .agent-node:hover .node-ring{opacity:.7}
  .node-ring-pulse{fill:none;stroke-width:1.5;opacity:0;animation:ring-pulse 3s infinite}
  @keyframes ring-pulse{
    0%{r:36;opacity:.5}
    100%{r:52;opacity:0}
  }
  .node-bg{fill:var(--bg-card);stroke-width:2}
  .node-icon{font-size:22px;text-anchor:middle;dominant-baseline:central;pointer-events:none}
  .node-label{
    fill:var(--text-primary);font-size:10px;font-weight:600;
    text-anchor:middle;font-family:var(--font);pointer-events:none;
  }
  .node-status-text{
    fill:var(--text-muted);font-size:8px;font-weight:500;
    text-anchor:middle;font-family:var(--mono);text-transform:uppercase;
    letter-spacing:.5px;pointer-events:none;
  }
  .node-status-text.running{fill:var(--green)}
  .node-status-text.stopped{fill:var(--text-muted)}
  .node-status-text.error{fill:var(--red)}
  .node-status-text.starting{fill:var(--yellow)}

  /* SVG Connection Lines */
  .conn-line{fill:none;stroke-width:1;opacity:.15;transition:opacity .3s}
  .conn-line.active{opacity:.35;stroke-width:1.5}
  .conn-line-glow{fill:none;stroke-width:3;opacity:0;filter:blur(3px)}
  .conn-line-glow.active{opacity:.12}

  /* SVG Event Particles */
  .event-particle{r:3;opacity:0}

  /* Orchestrator center label */
  .orch-ring{fill:none;stroke:var(--green);stroke-width:1.5;stroke-dasharray:4 3;opacity:.2;animation:orch-spin 30s linear infinite}
  @keyframes orch-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}

  /* ── Bot Cards Grid ──────────────────────────────────────────── */
  .bots-section{display:flex;flex-direction:column;gap:10px}
  .bot-grid{display:flex;flex-direction:column;gap:10px}

  .bot-card{
    background:var(--bg-card);border:1px solid var(--border);
    border-radius:var(--radius-sm);padding:16px;
    display:flex;flex-direction:column;gap:10px;
    transition:var(--transition);position:relative;overflow:hidden;
  }
  .bot-card:hover{border-color:var(--border-active);transform:translateY(-1px);box-shadow:var(--shadow-sm)}
  .bot-card::before{
    content:'';position:absolute;top:0;left:0;right:0;height:2px;
    border-radius:var(--radius-sm) var(--radius-sm) 0 0;
  }
  .bot-card.running::before{background:var(--green)}
  .bot-card.stopped::before{background:var(--text-muted)}
  .bot-card.error::before{background:var(--red)}
  .bot-card.starting::before{background:linear-gradient(90deg,var(--yellow),transparent);animation:shimmer 1.5s infinite}
  .bot-card.stopping::before{background:linear-gradient(90deg,var(--orange),transparent);animation:shimmer 1.5s infinite reverse}
  @keyframes shimmer{0%{opacity:.3}50%{opacity:1}100%{opacity:.3}}

  .bot-header{display:flex;justify-content:space-between;align-items:flex-start}
  .bot-name{font-size:.9rem;font-weight:600;display:flex;align-items:center;gap:6px}
  .bot-id{font-size:.62rem;color:var(--text-muted);font-family:var(--mono)}
  .bot-status{
    font-size:.62rem;font-weight:600;padding:2px 9px;border-radius:10px;
    text-transform:uppercase;letter-spacing:.5px;
  }
  .bot-status.running{background:var(--green-dim);color:var(--green)}
  .bot-status.stopped{background:rgba(78,82,104,.15);color:var(--text-muted)}
  .bot-status.error{background:var(--red-dim);color:var(--red)}
  .bot-status.starting{background:var(--yellow-dim);color:var(--yellow)}
  .bot-status.stopping{background:var(--orange-dim);color:var(--orange)}

  .bot-stats{
    display:grid;grid-template-columns:repeat(3,1fr);gap:6px;
    padding:8px 0;border-top:1px solid var(--border);
  }
  .bot-stat{display:flex;flex-direction:column;align-items:center;gap:1px}
  .bot-stat-value{font-family:var(--mono);font-weight:600;font-size:.82rem}
  .bot-stat-label{font-size:.55rem;color:var(--text-muted);text-transform:uppercase}

  .bot-actions{display:flex;gap:6px}

  /* Health bar */
  .health-bar{
    height:3px;background:var(--border);border-radius:2px;overflow:hidden;margin-top:2px;
  }
  .health-bar-fill{height:100%;border-radius:2px;transition:width .5s ease}
  .health-bar-fill.good{background:var(--green)}
  .health-bar-fill.warn{background:var(--yellow)}
  .health-bar-fill.bad{background:var(--red)}

  /* ── Event Feed ──────────────────────────────────────────────── */
  .feed-section{display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 520px);min-height:300px}
  .feed-header{display:flex;align-items:center;justify-content:space-between}
  .feed-filters{display:flex;gap:5px;flex-wrap:wrap}
  .filter-btn{
    padding:3px 9px;border:1px solid var(--border);border-radius:12px;
    background:transparent;color:var(--text-muted);
    font-size:.6rem;cursor:pointer;transition:var(--transition);
    font-family:var(--font);text-transform:uppercase;letter-spacing:.3px;
  }
  .filter-btn:hover{border-color:var(--border-active);color:var(--text-secondary)}
  .filter-btn.active{background:var(--blue-dim);border-color:var(--blue);color:var(--blue)}

  .feed{
    flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:3px;
    scrollbar-width:thin;scrollbar-color:var(--border) transparent;
  }
  .feed-item{
    display:grid;grid-template-columns:62px 82px 1fr;gap:6px;
    padding:7px 10px;background:var(--bg-card);border:1px solid var(--border);
    border-radius:6px;font-size:.72rem;align-items:center;
    transition:var(--transition);animation:slideIn 200ms ease;
  }
  .feed-item:hover{background:var(--bg-card-hover);border-color:var(--border-active)}
  @keyframes slideIn{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:translateX(0)}}

  .feed-time{font-family:var(--mono);font-size:.6rem;color:var(--text-muted)}
  .feed-type{font-weight:600;font-size:.6rem;text-transform:uppercase;letter-spacing:.3px}
  .feed-type.bot-started,.feed-type.bot-health{color:var(--green)}
  .feed-type.bot-stopped{color:var(--text-muted)}
  .feed-type.bot-error{color:var(--red)}
  .feed-type.bot-log{color:var(--text-secondary)}
  .feed-type.token-launch{color:var(--cyan)}
  .feed-type.token-graduation{color:var(--purple)}
  .feed-type.trade-buy{color:var(--green)}
  .feed-type.trade-sell{color:var(--red)}
  .feed-type.trade-whale,.feed-type.alert-whale{color:var(--yellow)}
  .feed-type.fee-claim,.feed-type.fee-distribution{color:var(--blue)}
  .feed-type.call-new{color:var(--orange)}
  .feed-type.alert-cto{color:var(--purple)}
  .feed-message{color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

  /* ── Buttons ─────────────────────────────────────────────────── */
  .btn{
    display:inline-flex;align-items:center;gap:5px;
    padding:5px 12px;border:1px solid var(--border);border-radius:6px;
    background:transparent;color:var(--text-primary);
    font-size:.7rem;font-weight:500;cursor:pointer;
    transition:var(--transition);font-family:var(--font);
  }
  .btn:hover{background:var(--glass);border-color:var(--border-active)}
  .btn:disabled{opacity:.35;cursor:not-allowed}
  .btn-sm{padding:3px 9px;font-size:.65rem}
  .btn.primary{border-color:var(--green);color:var(--green)}
  .btn.primary:hover{background:var(--green-dim)}
  .btn.danger{border-color:var(--red);color:var(--red)}
  .btn.danger:hover{background:var(--red-dim)}
  .btn.warning{border-color:var(--yellow);color:var(--yellow)}
  .btn.warning:hover{background:var(--yellow-dim)}

  /* ── Log Modal ───────────────────────────────────────────────── */
  .modal-overlay{
    position:fixed;inset:0;background:rgba(0,0,0,.75);
    backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
    z-index:200;display:none;place-items:center;
  }
  .modal-overlay.active{display:grid}
  .modal{
    background:var(--bg-secondary);border:1px solid var(--border);
    border-radius:var(--radius);width:min(92vw,860px);
    max-height:82vh;display:flex;flex-direction:column;box-shadow:var(--shadow);
  }
  .modal-header{
    display:flex;justify-content:space-between;align-items:center;
    padding:14px 20px;border-bottom:1px solid var(--border);
  }
  .modal-title{font-weight:600;font-size:.95rem}
  .modal-close{
    background:none;border:none;color:var(--text-muted);cursor:pointer;
    font-size:1.3rem;padding:4px;transition:color .15s;
  }
  .modal-close:hover{color:var(--text-primary)}
  .log-viewer{
    flex:1;overflow-y:auto;padding:16px;
    font-family:var(--mono);font-size:.7rem;line-height:1.6;
    color:var(--text-secondary);white-space:pre-wrap;word-break:break-all;
    scrollbar-width:thin;scrollbar-color:var(--border) transparent;
  }
  .log-line{padding:1px 0}
  .log-line.error{color:var(--red)}
  .log-line.warn{color:var(--yellow)}

  /* ── Responsive ──────────────────────────────────────────────── */
  @media(max-width:1100px){
    .main{grid-template-columns:1fr;grid-template-rows:auto auto auto auto}
    .feed-section{max-height:380px}
    .metrics-bar{grid-template-columns:repeat(3,1fr)}
  }
  @media(max-width:640px){
    .header{flex-direction:column;gap:10px}
    .header-right{flex-wrap:wrap;justify-content:center}
    .main{padding:10px}
    .metrics-bar{grid-template-columns:repeat(2,1fr)}
    .network-canvas{height:260px}
  }
</style>
</head>
<body>
<div class="app">

  <!-- ── Header ──────────────────────────────────────────────── -->
  <header class="header">
    <div class="header-left">
      <div class="logo-group">
        <div class="logo">PumpFun Swarm</div>
        <div class="logo-sub">Agent Orchestrator</div>
      </div>
      <span id="ws-status" class="status-badge disconnected">
        <span class="status-dot"></span>
        <span id="ws-status-text">Connecting&hellip;</span>
      </span>
    </div>
    <div class="header-right">
      <div class="header-stat">
        <span class="header-stat-value" id="stat-uptime">0s</span>
        <span class="header-stat-label">Uptime</span>
      </div>
      <div class="header-stat">
        <span class="header-stat-value" id="stat-active-bots" style="color:var(--green)">0</span>
        <span class="header-stat-label">Active</span>
      </div>
      <div class="header-stat">
        <span class="header-stat-value" id="stat-events-min" style="color:var(--cyan)">0</span>
        <span class="header-stat-label">Events/min</span>
      </div>
      <div class="header-stat">
        <span class="header-stat-value" id="stat-ws-clients" style="color:var(--blue)">0</span>
        <span class="header-stat-label">Clients</span>
      </div>
      <div class="batch-actions">
        <button class="btn btn-sm primary" onclick="batchAction('start-all')">&#9654; All</button>
        <button class="btn btn-sm danger" onclick="batchAction('stop-all')">&#9724; All</button>
        <button class="btn btn-sm warning" onclick="batchAction('restart-all')">&#8635; All</button>
      </div>
    </div>
  </header>

  <!-- ── Main Content ────────────────────────────────────────── -->
  <main class="main">

    <!-- Metrics Bar -->
    <div class="metrics-bar">
      <div class="metric-card"><span class="metric-value mv-cyan" id="m-total-events">0</span><span class="metric-label">Total Events</span></div>
      <div class="metric-card"><span class="metric-value mv-green" id="m-token-launches">0</span><span class="metric-label">Launches</span></div>
      <div class="metric-card"><span class="metric-value mv-blue" id="m-fee-claims">0</span><span class="metric-label">Fee Claims</span></div>
      <div class="metric-card"><span class="metric-value mv-purple" id="m-total-trades">0</span><span class="metric-label">Trades</span></div>
      <div class="metric-card"><span class="metric-value mv-yellow" id="m-calls">0</span><span class="metric-label">Calls</span></div>
      <div class="metric-card"><span class="metric-value mv-red" id="m-errors">0</span><span class="metric-label">Errors</span></div>
    </div>

    <!-- ── Agent Network Visualization ───────────────────────── -->
    <div class="network-section">
      <div class="network-header">
        <span class="section-title">&#128300; Swarm Topology</span>
        <div class="network-legend">
          <div class="legend-item"><span class="legend-dot" style="background:var(--green)"></span>Running</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--text-muted)"></span>Stopped</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--red)"></span>Error</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--yellow)"></span>Starting</div>
        </div>
      </div>
      <div class="network-canvas" id="network-canvas">
        <svg class="network-svg" id="network-svg" xmlns="http://www.w3.org/2000/svg"></svg>
      </div>
    </div>

    <!-- Bot Cards -->
    <section class="bots-section">
      <div class="section-title">Bot Fleet</div>
      <div class="bot-grid" id="bot-grid"></div>
    </section>

    <!-- Event Feed -->
    <section class="feed-section">
      <div class="feed-header">
        <span class="section-title">Live Event Feed</span>
        <div class="feed-filters">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="bot">Bots</button>
          <button class="filter-btn" data-filter="token">Tokens</button>
          <button class="filter-btn" data-filter="trade">Trades</button>
          <button class="filter-btn" data-filter="fee">Fees</button>
          <button class="filter-btn" data-filter="call">Calls</button>
          <button class="filter-btn" data-filter="alert">Alerts</button>
        </div>
      </div>
      <div class="feed" id="event-feed">
        <div class="feed-item">
          <span class="feed-time">--:--:--</span>
          <span class="feed-type">system</span>
          <span class="feed-message">Waiting for connection&hellip;</span>
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

  // ── Configuration ──────────────────────────────────────────
  const BOT_META = {
    'telegram-bot':      { name: 'Fee Monitor',     icon: '\\ud83d\\udce1', color: '#00e676', desc: 'Creator fees, CTO alerts, whale trades' },
    'outsiders-bot':     { name: 'Call Tracker',     icon: '\\ud83c\\udfc6', color: '#ffd740', desc: 'Leaderboards, PNL cards, win rates' },
    'channel-bot':       { name: 'Channel Feed',     icon: '\\ud83d\\udce2', color: '#448aff', desc: 'Launch, graduation, whale, claim feed' },
    'websocket-server':  { name: 'WS Relay',         icon: '\\ud83d\\udd0c', color: '#b388ff', desc: 'Real-time token launch broadcasts' },
    'swarm-bot':         { name: 'Trading Swarm',    icon: '\\ud83e\\udd16', color: '#ff9100', desc: 'Multi-strategy autonomous trading' },
  };
  const BOT_IDS = Object.keys(BOT_META);

  // Event type → which bots typically produce/consume
  const EVENT_ROUTES = {
    'token:launch':      { from: 'websocket-server', to: ['channel-bot', 'swarm-bot'] },
    'token:graduation':  { from: 'channel-bot',      to: ['swarm-bot'] },
    'fee:claim':         { from: 'telegram-bot',      to: ['channel-bot'] },
    'fee:distribution':  { from: 'telegram-bot',      to: ['channel-bot'] },
    'trade:buy':         { from: 'swarm-bot',         to: ['channel-bot'] },
    'trade:sell':        { from: 'swarm-bot',         to: ['channel-bot'] },
    'trade:whale':       { from: 'channel-bot',       to: ['telegram-bot', 'outsiders-bot'] },
    'alert:whale':       { from: 'channel-bot',       to: ['telegram-bot'] },
    'alert:cto':         { from: 'telegram-bot',      to: ['channel-bot', 'outsiders-bot'] },
    'call:new':          { from: 'outsiders-bot',     to: ['swarm-bot'] },
    'call:result':       { from: 'outsiders-bot',     to: [] },
  };

  // ── State ──────────────────────────────────────────────────
  let ws = null;
  let state = { bots: {}, events: [], metrics: {}, uptime: 0, startedAt: '' };
  let activeFilter = 'all';
  const MAX_FEED = 200;
  let particleQueue = [];

  // ── DOM Refs ───────────────────────────────────────────────
  const botGrid = document.getElementById('bot-grid');
  const eventFeed = document.getElementById('event-feed');
  const wsStatusBadge = document.getElementById('ws-status');
  const wsStatusText = document.getElementById('ws-status-text');
  const networkSvg = document.getElementById('network-svg');

  // ── Network Visualization ──────────────────────────────────
  // Node positions: orchestrator in center, 5 bots in a pentagon around it
  let nodePositions = {};

  function calcNodePositions() {
    const w = networkSvg.clientWidth || 800;
    const h = networkSvg.clientHeight || 340;
    const cx = w / 2;
    const cy = h / 2;
    const rx = Math.min(w * 0.35, 280);
    const ry = Math.min(h * 0.35, 120);

    nodePositions = { orchestrator: { x: cx, y: cy } };

    BOT_IDS.forEach((id, i) => {
      const angle = (i / BOT_IDS.length) * Math.PI * 2 - Math.PI / 2;
      nodePositions[id] = {
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
      };
    });
  }

  function buildNetworkSvg() {
    calcNodePositions();
    const oc = nodePositions.orchestrator;

    // Defs for gradients and filters
    let svg = '<defs>';
    svg += '<filter id="glow"><feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';

    // Gradient for each bot connection
    BOT_IDS.forEach(id => {
      const c = BOT_META[id].color;
      svg += '<linearGradient id="grad-' + id + '" x1="0%" y1="0%" x2="100%" y2="0%">';
      svg += '<stop offset="0%" stop-color="' + c + '" stop-opacity="0.6"/>';
      svg += '<stop offset="50%" stop-color="' + c + '" stop-opacity="0.15"/>';
      svg += '<stop offset="100%" stop-color="' + c + '" stop-opacity="0.6"/>';
      svg += '</linearGradient>';
    });
    svg += '</defs>';

    // Draw connection lines (orchestrator → each bot)
    BOT_IDS.forEach(id => {
      const n = nodePositions[id];
      const c = BOT_META[id].color;
      svg += '<line class="conn-line" id="conn-' + id + '" x1="' + oc.x + '" y1="' + oc.y + '" x2="' + n.x + '" y2="' + n.y + '" stroke="' + c + '"/>';
      svg += '<line class="conn-line-glow" id="conn-glow-' + id + '" x1="' + oc.x + '" y1="' + oc.y + '" x2="' + n.x + '" y2="' + n.y + '" stroke="' + c + '"/>';
    });

    // Draw cross-connections (bot ↔ bot) as subtle arcs
    const crossPairs = [
      ['telegram-bot', 'channel-bot'],
      ['channel-bot', 'swarm-bot'],
      ['outsiders-bot', 'swarm-bot'],
      ['websocket-server', 'channel-bot'],
      ['telegram-bot', 'outsiders-bot'],
    ];
    crossPairs.forEach(([a, b]) => {
      const pa = nodePositions[a];
      const pb = nodePositions[b];
      if (!pa || !pb) return;
      // Curved path through midpoint offset toward center
      const mx = (pa.x + pb.x) / 2 + (oc.x - (pa.x + pb.x) / 2) * 0.3;
      const my = (pa.y + pb.y) / 2 + (oc.y - (pa.y + pb.y) / 2) * 0.3;
      svg += '<path class="conn-line" id="xconn-' + a + '-' + b + '" d="M' + pa.x + ',' + pa.y + ' Q' + mx + ',' + my + ' ' + pb.x + ',' + pb.y + '" stroke="rgba(255,255,255,0.06)"/>';
    });

    // Draw orchestrator node (center)
    svg += '<g transform="translate(' + oc.x + ',' + oc.y + ')">';
    svg += '<circle class="orch-ring" cx="0" cy="0" r="50" transform-origin="0 0"/>';
    svg += '<circle cx="0" cy="0" r="28" fill="rgba(0,230,118,0.06)" stroke="var(--green)" stroke-width="1.5" opacity="0.5"/>';
    svg += '<text x="0" y="-2" class="node-icon" style="font-size:18px">&#x2B22;</text>';
    svg += '<text x="0" y="16" class="node-label" style="font-size:8px;fill:var(--green)">ORCHESTRATOR</text>';
    svg += '</g>';

    // Draw bot nodes
    BOT_IDS.forEach(id => {
      const n = nodePositions[id];
      const m = BOT_META[id];
      const statusClass = getBotStatus(id);
      const statusColor = statusClass === 'running' ? m.color : statusClass === 'error' ? '#ff5252' : statusClass === 'starting' ? '#ffd740' : '#4e5268';

      svg += '<g class="agent-node" id="node-' + id + '" transform="translate(' + n.x + ',' + n.y + ')" onclick="nodeClick(\\'' + id + '\\')">';
      // Pulse ring (only when running)
      svg += '<circle class="node-ring-pulse" id="pulse-' + id + '" cx="0" cy="0" r="36" stroke="' + m.color + '" style="display:' + (statusClass === 'running' ? 'block' : 'none') + '"/>';
      // Outer ring
      svg += '<circle class="node-ring" cx="0" cy="0" r="34" stroke="' + statusColor + '"/>';
      // Background
      svg += '<circle class="node-bg" cx="0" cy="0" r="28" stroke="' + statusColor + '"/>';
      // Icon
      svg += '<text x="0" y="-3" class="node-icon">' + m.icon + '</text>';
      // Label
      svg += '<text x="0" y="44" class="node-label">' + escapeHtml(m.name) + '</text>';
      // Status
      svg += '<text x="0" y="54" class="node-status-text ' + statusClass + '" id="nstatus-' + id + '">' + statusClass.toUpperCase() + '</text>';
      svg += '</g>';
    });

    // Particle container
    svg += '<g id="particle-layer"></g>';

    networkSvg.innerHTML = svg;
  }

  function getBotStatus(id) {
    const h = state.bots[id];
    return h ? (h.status || 'stopped') : 'stopped';
  }

  // Animate an event particle along a connection path
  function animateParticle(fromId, toId, color) {
    const layer = document.getElementById('particle-layer');
    if (!layer) return;

    const from = nodePositions[fromId] || nodePositions.orchestrator;
    const to = nodePositions[toId] || nodePositions.orchestrator;

    const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    particle.setAttribute('cx', String(from.x));
    particle.setAttribute('cy', String(from.y));
    particle.setAttribute('r', '3');
    particle.setAttribute('fill', color);
    particle.setAttribute('opacity', '0');
    particle.setAttribute('filter', 'url(#glow)');
    layer.appendChild(particle);

    // Animate with requestAnimationFrame
    const duration = 800;
    const start = performance.now();
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const x = from.x + (to.x - from.x) * ease;
      const y = from.y + (to.y - from.y) * ease;
      const opacity = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1;
      particle.setAttribute('cx', String(x));
      particle.setAttribute('cy', String(y));
      particle.setAttribute('opacity', String(opacity * 0.9));
      particle.setAttribute('r', String(2 + Math.sin(t * Math.PI) * 2));
      if (t < 1) requestAnimationFrame(step);
      else layer.removeChild(particle);
    }
    requestAnimationFrame(step);
  }

  function triggerEventVisualization(event) {
    const route = EVENT_ROUTES[event.type];
    if (!route) return;

    const color = BOT_META[route.from] ? BOT_META[route.from].color : '#18ffff';

    // Flash the connection line
    const connEl = document.getElementById('conn-' + route.from);
    const glowEl = document.getElementById('conn-glow-' + route.from);
    if (connEl) { connEl.classList.add('active'); setTimeout(() => connEl.classList.remove('active'), 600); }
    if (glowEl) { glowEl.classList.add('active'); setTimeout(() => glowEl.classList.remove('active'), 600); }

    // Animate particle: source → orchestrator
    animateParticle(route.from, 'orchestrator', color);

    // Then orchestrator → each target (staggered)
    route.to.forEach((target, i) => {
      setTimeout(() => {
        animateParticle('orchestrator', target, color);
        // Flash target connection
        const tc = document.getElementById('conn-' + target);
        const tg = document.getElementById('conn-glow-' + target);
        if (tc) { tc.classList.add('active'); setTimeout(() => tc.classList.remove('active'), 600); }
        if (tg) { tg.classList.add('active'); setTimeout(() => tg.classList.remove('active'), 600); }
      }, 400 + i * 150);
    });
  }

  function updateNetworkNodes() {
    BOT_IDS.forEach(id => {
      const s = getBotStatus(id);
      const m = BOT_META[id];
      const statusColor = s === 'running' ? m.color : s === 'error' ? '#ff5252' : s === 'starting' ? '#ffd740' : '#4e5268';

      const statusText = document.getElementById('nstatus-' + id);
      if (statusText) {
        statusText.textContent = s.toUpperCase();
        statusText.className = 'node-status-text ' + s;
      }

      const pulseEl = document.getElementById('pulse-' + id);
      if (pulseEl) pulseEl.style.display = s === 'running' ? 'block' : 'none';

      // Update ring/bg colors
      const nodeGroup = document.getElementById('node-' + id);
      if (nodeGroup) {
        const rings = nodeGroup.querySelectorAll('.node-ring');
        rings.forEach(r => r.setAttribute('stroke', statusColor));
        const bg = nodeGroup.querySelector('.node-bg');
        if (bg) bg.setAttribute('stroke', statusColor);
      }
    });
  }

  // Resize handling
  window.addEventListener('resize', () => { buildNetworkSvg(); });

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
      try { handleMessage(JSON.parse(e.data)); } catch {}
    };
  }

  // ── Message Handler ─────────────────────────────────────────
  function handleMessage(msg) {
    if (msg.type === 'init' || msg.type === 'state') {
      state = msg.data;
      renderAll();
      return;
    }

    // It's a SwarmEvent — update state
    state.events.push(msg);
    if (state.events.length > MAX_FEED) state.events = state.events.slice(-MAX_FEED);

    if (msg.type === 'bot:health' && msg.data && msg.data.status) {
      state.bots[msg.source] = msg.data;
    }
    if (msg.type === 'bot:started' || msg.type === 'bot:stopped' || msg.type === 'bot:error') {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: 'status' }));
    }

    // Increment metrics
    if (msg.type.startsWith('token:')) state.metrics.totalTokenLaunches = (state.metrics.totalTokenLaunches || 0) + 1;
    if (msg.type.startsWith('trade:')) state.metrics.totalTrades = (state.metrics.totalTrades || 0) + 1;
    if (msg.type.startsWith('fee:')) state.metrics.totalFeeClaims = (state.metrics.totalFeeClaims || 0) + 1;
    if (msg.type.startsWith('call:')) state.metrics.totalCalls = (state.metrics.totalCalls || 0) + 1;
    if (msg.type.includes('error')) state.metrics.totalErrors = (state.metrics.totalErrors || 0) + 1;
    state.metrics.totalEvents = (state.metrics.totalEvents || 0) + 1;

    renderMetrics();
    renderHeader();
    updateNetworkNodes();
    addFeedItem(msg);

    // Trigger network visualization
    triggerEventVisualization(msg);
  }

  // ── Render Functions ────────────────────────────────────────
  function renderAll() {
    renderHeader();
    renderMetrics();
    renderBots();
    renderFeed();
    buildNetworkSvg();
  }

  function renderHeader() {
    const uptime = state.uptime || 0;
    document.getElementById('stat-uptime').textContent = formatUptime(uptime);
    document.getElementById('stat-active-bots').textContent =
      Object.values(state.bots).filter(function(b) { return b.status === 'running'; }).length;
    document.getElementById('stat-events-min').textContent =
      state.metrics && state.metrics.eventsPerMinute ? state.metrics.eventsPerMinute : 0;
  }

  function renderMetrics() {
    var m = state.metrics || {};
    document.getElementById('m-total-events').textContent = fmtNum(m.totalEvents || 0);
    document.getElementById('m-token-launches').textContent = fmtNum(m.totalTokenLaunches || 0);
    document.getElementById('m-fee-claims').textContent = fmtNum(m.totalFeeClaims || 0);
    document.getElementById('m-total-trades').textContent = fmtNum(m.totalTrades || 0);
    document.getElementById('m-calls').textContent = fmtNum(m.totalCalls || 0);
    document.getElementById('m-errors').textContent = fmtNum(m.totalErrors || 0);
  }

  function renderBots() {
    botGrid.innerHTML = BOT_IDS.map(function(id) {
      var m = BOT_META[id];
      var h = state.bots[id] || { status: 'stopped', uptime: 0, restarts: 0, metrics: { eventsProcessed: 0, eventsEmitted: 0, errorsTotal: 0 } };
      var s = h.status || 'stopped';
      var healthPct = s === 'running' ? Math.min(100, ((h.uptime || 0) / 3600) * 100) : 0;
      var healthClass = healthPct > 50 ? 'good' : healthPct > 20 ? 'warn' : 'bad';
      if (s !== 'running') healthClass = '';

      return '<div class="bot-card ' + s + '" data-bot="' + id + '">' +
        '<div class="bot-header">' +
          '<div>' +
            '<div class="bot-name">' + m.icon + ' ' + m.name + '</div>' +
            '<div class="bot-id">' + id + '</div>' +
          '</div>' +
          '<span class="bot-status ' + s + '">' + s + '</span>' +
        '</div>' +
        '<div class="bot-stats">' +
          '<div class="bot-stat"><span class="bot-stat-value">' + formatUptime(h.uptime || 0) + '</span><span class="bot-stat-label">Uptime</span></div>' +
          '<div class="bot-stat"><span class="bot-stat-value">' + (h.restarts || 0) + '</span><span class="bot-stat-label">Restarts</span></div>' +
          '<div class="bot-stat"><span class="bot-stat-value">' + fmtNum((h.metrics && h.metrics.eventsEmitted) || 0) + '</span><span class="bot-stat-label">Events</span></div>' +
        '</div>' +
        (s === 'running' ? '<div class="health-bar"><div class="health-bar-fill ' + healthClass + '" style="width:' + healthPct + '%"></div></div>' : '') +
        '<div class="bot-actions">' +
          (s === 'stopped' || s === 'error'
            ? '<button class="btn btn-sm primary" onclick="botAction(\\'' + id + '\\',\\'start\\')">&#9654; Start</button>'
            : '<button class="btn btn-sm danger" onclick="botAction(\\'' + id + '\\',\\'stop\\')">&#9724; Stop</button>') +
          (s === 'running' ? '<button class="btn btn-sm warning" onclick="botAction(\\'' + id + '\\',\\'restart\\')">&#8635;</button>' : '') +
          '<button class="btn btn-sm" onclick="showLogs(\\'' + id + '\\')">&#128196;</button>' +
        '</div>' +
        (h.lastError ? '<div style="font-size:.65rem;color:var(--red);margin-top:4px">&#9888; ' + escapeHtml(h.lastError) + '</div>' : '') +
      '</div>';
    }).join('');
  }

  function renderFeed() {
    var filtered = filterEvents(state.events || []);
    eventFeed.innerHTML = filtered.slice(-100).map(function(ev) { return feedItemHtml(ev); }).join('');
    eventFeed.scrollTop = eventFeed.scrollHeight;
  }

  function addFeedItem(ev) {
    if (!matchFilter(ev)) return;
    eventFeed.insertAdjacentHTML('beforeend', feedItemHtml(ev));
    while (eventFeed.children.length > MAX_FEED) eventFeed.removeChild(eventFeed.firstChild);
    eventFeed.scrollTop = eventFeed.scrollHeight;
  }

  function feedItemHtml(ev) {
    var time = new Date(ev.timestamp).toLocaleTimeString();
    var typeClass = ev.type.replace(/:/g, '-');
    var typeLabel = ev.type.replace(':', ' ').replace(/_/g, ' ');
    var source = ev.source || '?';
    var msg = '';
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

  // ── Filters ─────────────────────────────────────────────────
  function filterEvents(events) {
    if (activeFilter === 'all') return events;
    return events.filter(function(e) { return matchFilter(e); });
  }

  function matchFilter(ev) {
    if (activeFilter === 'all') return true;
    return ev.type.startsWith(activeFilter + ':') || ev.type.startsWith(activeFilter);
  }

  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
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
      fetch('/api/v1/bots/' + botId + '/' + action, { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function() { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: 'status' })); });
    }
  };

  window.batchAction = function(action) {
    if (action === 'stop-all' && !confirm('Stop all bots?')) return;
    fetch('/api/v1/batch/' + action, { method: 'POST' })
      .then(function(r) { return r.json(); })
      .then(function() { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: 'status' })); });
  };

  window.nodeClick = function(botId) {
    // Highlight the bot card and scroll to it
    var card = document.querySelector('[data-bot="' + botId + '"]');
    if (card) {
      card.style.boxShadow = '0 0 20px ' + BOT_META[botId].color + '33';
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(function() { card.style.boxShadow = ''; }, 1500);
    }
  };

  // ── Log Modal ───────────────────────────────────────────────
  window.showLogs = function(botId) {
    document.getElementById('log-modal-title').textContent = botId + ' \\u2014 Logs';
    document.getElementById('log-modal').classList.add('active');
    document.getElementById('log-viewer').textContent = 'Loading\\u2026';

    fetch('/api/v1/bots/' + botId + '/logs?limit=300')
      .then(function(r) { return r.json(); })
      .then(function(res) {
        var logs = res.data || [];
        document.getElementById('log-viewer').innerHTML = logs.map(function(l) {
          var cls = l.includes('ERROR') ? ' error' : l.includes('WARN') ? ' warn' : '';
          return '<div class="log-line' + cls + '">' + escapeHtml(l) + '</div>';
        }).join('');
        var viewer = document.getElementById('log-viewer');
        viewer.scrollTop = viewer.scrollHeight;
      })
      .catch(function() {
        document.getElementById('log-viewer').textContent = 'Failed to load logs.';
      });
  };

  document.getElementById('log-modal-close').addEventListener('click', function() {
    document.getElementById('log-modal').classList.remove('active');
  });
  document.getElementById('log-modal').addEventListener('click', function(e) {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });

  // ── Utilities ───────────────────────────────────────────────
  function formatUptime(secs) {
    if (!secs || secs <= 0) return '0s';
    var d = Math.floor(secs / 86400);
    var h = Math.floor((secs % 86400) / 3600);
    var m = Math.floor((secs % 3600) / 60);
    var s = Math.floor(secs % 60);
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + s + 's';
    return s + 's';
  }

  function fmtNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Timers ──────────────────────────────────────────────────
  setInterval(function() {
    if (state.startedAt) {
      state.uptime = (Date.now() - new Date(state.startedAt).getTime()) / 1000;
      renderHeader();
    }
  }, 1000);

  setInterval(function() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'status' }));
    }
  }, 10000);

  // ── Demo Mode (when no WS data — shows the visualization) ──
  function startDemoMode() {
    // Set initial demo state so the visualization is visible
    state = {
      bots: {
        'telegram-bot': { status: 'running', uptime: 3642, restarts: 0, metrics: { eventsProcessed: 1247, eventsEmitted: 892, errorsTotal: 3 }, lastError: null },
        'outsiders-bot': { status: 'running', uptime: 3600, restarts: 1, metrics: { eventsProcessed: 456, eventsEmitted: 201, errorsTotal: 0 }, lastError: null },
        'channel-bot': { status: 'running', uptime: 3580, restarts: 0, metrics: { eventsProcessed: 2893, eventsEmitted: 2893, errorsTotal: 1 }, lastError: null },
        'websocket-server': { status: 'running', uptime: 3640, restarts: 0, metrics: { eventsProcessed: 5420, eventsEmitted: 5420, errorsTotal: 0 }, lastError: null },
        'swarm-bot': { status: 'stopped', uptime: 0, restarts: 0, metrics: { eventsProcessed: 0, eventsEmitted: 0, errorsTotal: 0 }, lastError: null },
      },
      events: [],
      metrics: { totalEvents: 4231, totalTokenLaunches: 1892, totalFeeClaims: 47, totalTrades: 156, totalCalls: 23, totalErrors: 4, eventsPerMinute: 42 },
      uptime: 3642,
      startedAt: new Date(Date.now() - 3642000).toISOString(),
    };
    renderAll();

    // Simulate events flowing through the network
    var demoEvents = [
      { type: 'token:launch', source: 'websocket-server' },
      { type: 'fee:claim', source: 'telegram-bot' },
      { type: 'trade:whale', source: 'channel-bot' },
      { type: 'call:new', source: 'outsiders-bot' },
      { type: 'token:graduation', source: 'channel-bot' },
      { type: 'alert:cto', source: 'telegram-bot' },
    ];
    var demoIdx = 0;

    setInterval(function() {
      if (ws && ws.readyState === WebSocket.OPEN) return; // Real data available, stop demo
      var ev = demoEvents[demoIdx % demoEvents.length];
      triggerEventVisualization(ev);
      demoIdx++;
    }, 2500);
  }

  // ── Init ────────────────────────────────────────────────────
  connect();

  // Start demo mode after a short delay if no real data arrives
  setTimeout(function() {
    if (!state.startedAt) startDemoMode();
  }, 2000);
})();
</script>
</body>
</html>`;
}
