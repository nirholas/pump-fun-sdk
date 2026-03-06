// ════════════════════════════════════════════════════════════════════
// PumpFun WebSocket Relay Server
//
// Architecture:
//   Solana RPC (wss) ◄── SolanaMonitor ──► Relay Server (ws) ──► Browsers
//
// One upstream connection to Solana, broadcasts parsed token launch
// events to all connected browser clients. Also serves the HTML page.
// ════════════════════════════════════════════════════════════════════

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { SolanaMonitor } from './solana-monitor.js';
import type { TokenLaunchEvent, ServerStatus, Heartbeat } from './types.js';

// ── Config ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3099', 10);
const SOLANA_RPC_WS = process.env.SOLANA_RPC_WS || 'wss://api.mainnet-beta.solana.com';
const HEARTBEAT_INTERVAL = 15_000; // 15s
const STATUS_INTERVAL = 10_000;    // 10s

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load static HTML page ───────────────────────────────────────────
let indexHtml = '<html><body>PumpFun WebSocket Relay — connect via WebSocket</body></html>';
const htmlPath = resolve(__dirname, '../public/index.html');
if (existsSync(htmlPath)) {
  indexHtml = readFileSync(htmlPath, 'utf-8');
}

// ── HTTP server (serves the page) ───────────────────────────────────
const httpServer = createServer((req, res) => {
  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      solana: monitor.connected,
      clients: wss.clients.size,
      totalLaunches: monitor.stats.totalLaunches,
      uptime: process.uptime(),
    }));
    return;
  }

  // Favicon
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // Serve the HTML page
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(indexHtml);
});

// ── WebSocket server (relay to browsers) ────────────────────────────
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

// Track recent launches for new clients (last 50)
const recentLaunches: TokenLaunchEvent[] = [];
const MAX_RECENT = 50;

wss.on('connection', (client, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[relay] Client connected (${wss.clients.size} total) from ${ip}`);

  // Send current status
  sendTo(client, makeStatus());

  // Send recent launches so the page isn't empty
  for (const launch of recentLaunches) {
    sendTo(client, launch);
  }

  client.on('close', () => {
    console.log(`[relay] Client disconnected (${wss.clients.size} total)`);
  });

  client.on('error', (err) => {
    console.error('[relay] Client error:', err.message);
  });
});

// ── Broadcast helpers ───────────────────────────────────────────────
function broadcast(msg: TokenLaunchEvent | ServerStatus | Heartbeat): void {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function sendTo(client: WebSocket, msg: TokenLaunchEvent | ServerStatus | Heartbeat): void {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(msg));
  }
}

function makeStatus(): ServerStatus {
  return {
    type: 'status',
    connected: monitor.connected,
    uptime: Math.floor(process.uptime()),
    totalLaunches: monitor.stats.totalLaunches,
    githubLaunches: monitor.stats.githubLaunches,
    clients: wss.clients.size,
  };
}

// ── Solana Monitor (upstream) ───────────────────────────────────────
const monitor = new SolanaMonitor(
  SOLANA_RPC_WS,
  // On token launch — broadcast to all clients
  (event: TokenLaunchEvent) => {
    // Store in recent buffer
    const existing = recentLaunches.findIndex(e => e.signature === event.signature);
    if (existing >= 0) {
      recentLaunches[existing] = event; // update enriched version
    } else {
      recentLaunches.push(event);
      if (recentLaunches.length > MAX_RECENT) recentLaunches.shift();
    }
    broadcast(event);
  },
  // On status change
  (connected: boolean) => {
    console.log(`[relay] Solana ${connected ? 'connected' : 'disconnected'}`);
    broadcast(makeStatus());
  },
);

// ── Heartbeat (keeps connections alive through proxies) ─────────────
setInterval(() => {
  const hb: Heartbeat = { type: 'heartbeat', ts: Date.now() };
  broadcast(hb);
}, HEARTBEAT_INTERVAL);

// ── Periodic status broadcast ───────────────────────────────────────
setInterval(() => {
  broadcast(makeStatus());
}, STATUS_INTERVAL);

// ── Start ───────────────────────────────────────────────────────────
monitor.start();

httpServer.listen(PORT, () => {
  console.log(`[relay] PumpFun WebSocket Relay running on http://0.0.0.0:${PORT}`);
  console.log(`[relay] WebSocket endpoint: ws://0.0.0.0:${PORT}/ws`);
  console.log(`[relay] Upstream Solana RPC: ${SOLANA_RPC_WS}`);
});

// ── Graceful shutdown ───────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[relay] SIGTERM — shutting down');
  monitor.stop();
  wss.close();
  httpServer.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[relay] SIGINT — shutting down');
  monitor.stop();
  wss.close();
  httpServer.close();
  process.exit(0);
});
