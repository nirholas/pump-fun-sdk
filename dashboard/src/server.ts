/**
 * PumpFun Swarms Dashboard — HTTP Server
 *
 * Production-grade dashboard server with:
 * - REST API for bot health, events, and control
 * - SSE real-time event streaming
 * - Embedded SPA frontend (no external build tools)
 * - API key authentication
 * - CORS support
 * - Graceful shutdown
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { loadConfig } from './config.js';
import { HealthPoller } from './health.js';
import { EventLog } from './events.js';
import { renderDashboard } from './ui.js';

const config = loadConfig();
const poller = new HealthPoller(config.services);
const eventLog = new EventLog();

// ── Auth ──────────────────────────────────────────────────────────────

function authenticate(req: IncomingMessage): boolean {
  if (!config.apiKey) return true; // no key = open
  const authHeader = req.headers['authorization'] || '';
  const apiKeyHeader = req.headers['x-api-key'] || '';
  if (apiKeyHeader === config.apiKey) return true;
  if (authHeader === `Bearer ${config.apiKey}`) return true;
  return false;
}

// ── Helpers ───────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  });
  res.end(body);
}

function cors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
}

function parseUrl(req: IncomingMessage): { path: string; query: URLSearchParams } {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  return { path: url.pathname, query: url.searchParams };
}

// ── Request Handler ──────────────────────────────────────────────────

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const { path, query } = parseUrl(req);

  // ── Public routes ───────────────────────────────────────────────

  // Dashboard SPA
  if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderDashboard());
    return;
  }

  // Health (for this dashboard itself)
  if (req.method === 'GET' && path === '/health') {
    json(res, 200, {
      service: 'dashboard',
      status: 'ok',
      uptimeMs: Date.now() - startedAt,
      services: poller.getAll().length,
      sseClients: eventLog.subscriberCount,
    });
    return;
  }

  // ── Protected routes ────────────────────────────────────────────

  if (!authenticate(req)) {
    json(res, 401, { error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    return;
  }

  // Service health summary
  if (req.method === 'GET' && path === '/api/services') {
    json(res, 200, {
      services: poller.getAll(),
      totalServices: poller.getAll().length,
      healthy: poller.getAll().filter((s) => s.status === 'healthy').length,
      timestamp: Date.now(),
    });
    return;
  }

  // Single service health
  if (req.method === 'GET' && path.startsWith('/api/services/')) {
    const id = path.split('/')[3];
    if (!id) { json(res, 400, { error: 'Missing service ID' }); return; }
    const svc = poller.get(id);
    if (!svc) { json(res, 404, { error: 'Service not found' }); return; }
    json(res, 200, svc);
    return;
  }

  // Event log
  if (req.method === 'GET' && path === '/api/events') {
    const limit = Math.min(Number(query.get('limit') || '50'), 200);
    const service = query.get('service') || '';
    const events = service
      ? eventLog.getByService(service, limit)
      : eventLog.getRecent(limit);
    json(res, 200, { events, total: eventLog.size });
    return;
  }

  // SSE stream
  if (req.method === 'GET' && path === '/api/events/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const subId = `sse_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Send initial state
    res.write(`data: ${JSON.stringify({ type: 'init', services: poller.getAll(), recentEvents: eventLog.getRecent(20) })}\n\n`);

    // Subscribe to updates
    eventLog.subscribe(subId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    // Heartbeat
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 15_000);

    req.on('close', () => {
      eventLog.unsubscribe(subId);
      clearInterval(heartbeat);
    });
    return;
  }

  // Force re-poll a service
  if (req.method === 'POST' && path === '/api/services/refresh') {
    await Promise.resolve(); // allow any pending I/O
    poller.stop();
    await poller.start();
    json(res, 200, { message: 'Refreshed', services: poller.getAll() });
    return;
  }

  // Dashboard stats summary
  if (req.method === 'GET' && path === '/api/stats') {
    const services = poller.getAll();
    json(res, 200, {
      totalServices: services.length,
      healthy: services.filter((s) => s.status === 'healthy').length,
      degraded: services.filter((s) => s.status === 'degraded').length,
      down: services.filter((s) => s.status === 'down').length,
      unknown: services.filter((s) => s.status === 'unknown').length,
      totalEvents: eventLog.size,
      sseClients: eventLog.subscriberCount,
      uptimeMs: Date.now() - startedAt,
    });
    return;
  }

  // 404
  json(res, 404, { error: 'Not Found' });
}

// ── Wire health changes to event log ──────────────────────────────────

poller.onHealthChange((health) => {
  eventLog.push({
    service: health.id,
    type: 'health_change',
    title: `${health.name} is now ${health.status}`,
    details: {
      status: health.status,
      latencyMs: health.latencyMs,
      consecutiveFailures: health.consecutiveFailures,
      error: health.details?.error,
    },
  });
});

// ── Start ─────────────────────────────────────────────────────────────

let startedAt = Date.now();

const server = createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('Request error:', err);
    if (!res.headersSent) {
      json(res, 500, { error: 'Internal Server Error' });
    }
  });
});

async function main(): Promise<void> {
  startedAt = Date.now();

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     PumpFun Swarms Dashboard                ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Port:     ${String(config.port).padEnd(33)}║`);
  console.log(`║  Services: ${String(config.services.length).padEnd(33)}║`);
  console.log(`║  Auth:     ${(config.apiKey ? 'API Key' : 'Open').padEnd(33)}║`);
  console.log('╚══════════════════════════════════════════════╝');

  for (const svc of config.services) {
    console.log(`  → ${svc.name}: ${svc.url}${svc.healthPath}`);
  }

  await poller.start();

  eventLog.push({
    service: 'dashboard',
    type: 'info',
    title: 'Dashboard started',
    details: { services: config.services.length },
  });

  server.listen(config.port, () => {
    console.log(`\n✓ Dashboard live at http://localhost:${config.port}\n`);
  });
}

// ── Graceful shutdown ────────────────────────────────────────────────

function shutdown(): void {
  console.log('\nShutting down dashboard...');
  poller.stop();
  server.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
