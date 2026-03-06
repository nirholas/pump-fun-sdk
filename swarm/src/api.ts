// ── PumpFun Swarm — API Server ─────────────────────────────────────
//
// REST API + WebSocket for the admin dashboard.
// Routes:
//   GET  /health                 — Swarm health
//   GET  /api/v1/bots            — All bots + health
//   GET  /api/v1/bots/:id        — Single bot + health
//   POST /api/v1/bots/:id/start  — Start a bot
//   POST /api/v1/bots/:id/stop   — Stop a bot
//   POST /api/v1/bots/:id/restart — Restart a bot
//   POST /api/v1/bots/:id/build  — Build a bot
//   GET  /api/v1/bots/:id/logs   — Bot log buffer
//   GET  /api/v1/events          — Recent events
//   GET  /api/v1/metrics         — Swarm metrics
//   GET  /                       — Dashboard HTML
//   WS   /ws                     — Real-time event stream
// ──────────────────────────────────────────────────────────────────

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { createLogger } from './logger.js';
import { BotManager } from './bot-manager.js';
import { EventBus } from './event-bus.js';
import type { ApiResponse, BotId, SwarmConfig, SwarmMetrics, DashboardState, BatchResult } from './types.js';
import { getDashboardHtml } from './dashboard.js';

const log = createLogger('api');

export class SwarmApi {
  private config: SwarmConfig;
  private botManager: BotManager;
  private eventBus: EventBus;
  private server: ReturnType<typeof createServer> | null = null;
  private wss: WebSocketServer | null = null;
  private startedAt = Date.now();
  private wsClients = new Set<WebSocket>();

  constructor(config: SwarmConfig, botManager: BotManager, eventBus: EventBus) {
    this.config = config;
    this.botManager = botManager;
    this.eventBus = eventBus;
  }

  /** Start the HTTP + WebSocket server */
  start(): void {
    this.server = createServer((req, res) => this.handleRequest(req, res));

    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });
    this.wss.on('connection', (ws) => this.handleWebSocket(ws));

    // Forward all events to WebSocket clients
    this.eventBus.onAny((event) => {
      const msg = JSON.stringify(event);
      for (const ws of this.wsClients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(msg);
        }
      }
    });

    this.server.listen(this.config.port, () => {
      log.info(`Swarm API listening on http://localhost:${this.config.port}`);
      log.info(`Dashboard: http://localhost:${this.config.port}/`);
      log.info(`WebSocket: ws://localhost:${this.config.port}/ws`);
    });
  }

  /** Stop the server */
  async stop(): Promise<void> {
    for (const ws of this.wsClients) {
      ws.close();
    }
    this.wsClients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    return new Promise<void>((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  // ── WebSocket ───────────────────────────────────────────────────

  private handleWebSocket(ws: WebSocket): void {
    this.wsClients.add(ws);
    log.info(`WS client connected (total: ${this.wsClients.size})`);

    // Send initial state
    const state = this.getDashboardState();
    ws.send(JSON.stringify({ type: 'init', data: state }));

    ws.on('close', () => {
      this.wsClients.delete(ws);
      log.info(`WS client disconnected (total: ${this.wsClients.size})`);
    });

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        await this.handleWsMessage(ws, msg);
      } catch {
        ws.send(JSON.stringify({ type: 'error', data: 'Invalid message' }));
      }
    });
  }

  private async handleWsMessage(ws: WebSocket, msg: { action: string; botId?: string }): Promise<void> {
    try {
      switch (msg.action) {
        case 'start':
          if (msg.botId) await this.botManager.start(msg.botId as BotId);
          break;
        case 'stop':
          if (msg.botId) await this.botManager.stop(msg.botId as BotId);
          break;
        case 'restart':
          if (msg.botId) await this.botManager.restart(msg.botId as BotId);
          break;
        case 'status':
          ws.send(JSON.stringify({ type: 'state', data: this.getDashboardState() }));
          break;
        default:
          ws.send(JSON.stringify({ type: 'error', data: `Unknown action: ${msg.action}` }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', data: String(err) }));
    }
  }

  // ── HTTP Request Handler ────────────────────────────────────────

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://localhost:${this.config.port}`);
    const method = req.method || 'GET';
    const path = url.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', this.config.corsOrigins);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Auth check (skip for health and dashboard)
    if (path.startsWith('/api/') && this.config.apiKey) {
      const key = req.headers['x-api-key'] || this.extractBearerToken(req);
      if (key !== this.config.apiKey) {
        this.sendJson(res, 401, { ok: false, error: 'Unauthorized', timestamp: new Date().toISOString() });
        return;
      }
    }

    try {
      // Dashboard
      if (path === '/' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getDashboardHtml());
        return;
      }

      // Health
      if (path === '/health' && method === 'GET') {
        const health = {
          status: 'ok',
          uptime: (Date.now() - this.startedAt) / 1000,
          bots: this.botManager.getAllHealth(),
          wsClients: this.wsClients.size,
        };
        this.sendJson(res, 200, { ok: true, data: health, timestamp: new Date().toISOString() });
        return;
      }

      // ── Bot CRUD ──────────────────────────────────────────────

      // GET /api/v1/bots
      if (path === '/api/v1/bots' && method === 'GET') {
        const bots = this.botManager.getAllDefinitions().map(def => ({
          ...def,
          health: this.botManager.getHealth(def.id),
        }));
        this.sendJson(res, 200, { ok: true, data: bots, timestamp: new Date().toISOString() });
        return;
      }

      // Match /api/v1/bots/:id[/action]
      const botMatch = path.match(/^\/api\/v1\/bots\/([\w-]+)(\/(\w+))?$/);
      if (botMatch) {
        const botId = botMatch[1] as BotId;
        const action = botMatch[3];

        // Validate bot ID
        try {
          this.botManager.getDefinition(botId);
        } catch {
          this.sendJson(res, 404, { ok: false, error: `Bot not found: ${botId}`, timestamp: new Date().toISOString() });
          return;
        }

        // GET /api/v1/bots/:id
        if (!action && method === 'GET') {
          const def = this.botManager.getDefinition(botId);
          const health = this.botManager.getHealth(botId);
          this.sendJson(res, 200, { ok: true, data: { ...def, health }, timestamp: new Date().toISOString() });
          return;
        }

        // POST /api/v1/bots/:id/start
        if (action === 'start' && method === 'POST') {
          await this.botManager.start(botId);
          this.sendJson(res, 200, { ok: true, data: { message: `${botId} started` }, timestamp: new Date().toISOString() });
          return;
        }

        // POST /api/v1/bots/:id/stop
        if (action === 'stop' && method === 'POST') {
          await this.botManager.stop(botId);
          this.sendJson(res, 200, { ok: true, data: { message: `${botId} stopped` }, timestamp: new Date().toISOString() });
          return;
        }

        // POST /api/v1/bots/:id/restart
        if (action === 'restart' && method === 'POST') {
          await this.botManager.restart(botId);
          this.sendJson(res, 200, { ok: true, data: { message: `${botId} restarted` }, timestamp: new Date().toISOString() });
          return;
        }

        // POST /api/v1/bots/:id/build
        if (action === 'build' && method === 'POST') {
          const output = await this.botManager.buildBot(botId);
          this.sendJson(res, 200, { ok: true, data: { message: `${botId} built`, output }, timestamp: new Date().toISOString() });
          return;
        }

        // GET /api/v1/bots/:id/logs
        if (action === 'logs' && method === 'GET') {
          const limit = parseInt(url.searchParams.get('limit') || '100', 10);
          const logs = this.botManager.getLogs(botId, Math.min(limit, 500));
          this.sendJson(res, 200, { ok: true, data: logs, timestamp: new Date().toISOString() });
          return;
        }

        // GET /api/v1/bots/:id/env
        if (action === 'env' && method === 'GET') {
          const config = this.botManager.getEnvConfig(botId);
          this.sendJson(res, 200, { ok: true, data: config, timestamp: new Date().toISOString() });
          return;
        }

        // PUT /api/v1/bots/:id/env
        if (action === 'env' && method === 'PUT') {
          const body = await this.readBody(req);
          const updates = JSON.parse(body);
          if (typeof updates !== 'object' || Array.isArray(updates)) {
            this.sendJson(res, 400, { ok: false, error: 'Body must be a JSON object of key-value pairs', timestamp: new Date().toISOString() });
            return;
          }
          this.botManager.setEnvConfig(botId, updates);
          this.sendJson(res, 200, { ok: true, data: { message: `${botId} env updated` }, timestamp: new Date().toISOString() });
          return;
        }
      }

      // ── Batch Operations ──────────────────────────────────────

      // POST /api/v1/swarm/start-all
      if (path === '/api/v1/swarm/start-all' && method === 'POST') {
        const results = await this.batchOperation('start');
        this.sendJson(res, 200, { ok: true, data: results, timestamp: new Date().toISOString() });
        return;
      }

      // POST /api/v1/swarm/stop-all
      if (path === '/api/v1/swarm/stop-all' && method === 'POST') {
        const results = await this.batchOperation('stop');
        this.sendJson(res, 200, { ok: true, data: results, timestamp: new Date().toISOString() });
        return;
      }

      // POST /api/v1/swarm/restart-all
      if (path === '/api/v1/swarm/restart-all' && method === 'POST') {
        const results = await this.batchOperation('restart');
        this.sendJson(res, 200, { ok: true, data: results, timestamp: new Date().toISOString() });
        return;
      }

      // POST /api/v1/swarm/build-all
      if (path === '/api/v1/swarm/build-all' && method === 'POST') {
        const results = await this.batchOperation('build');
        this.sendJson(res, 200, { ok: true, data: results, timestamp: new Date().toISOString() });
        return;
      }

      // GET /api/v1/events
      if (path === '/api/v1/events' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '100', 10);
        const type = url.searchParams.get('type');
        const source = url.searchParams.get('source');

        let events;
        if (type) {
          events = this.eventBus.getEventsByType(type as any, Math.min(limit, 500));
        } else if (source) {
          events = this.eventBus.getEventsBySource(source as BotId, Math.min(limit, 500));
        } else {
          events = this.eventBus.getRecentEvents(Math.min(limit, 500));
        }

        this.sendJson(res, 200, { ok: true, data: events, timestamp: new Date().toISOString() });
        return;
      }

      // GET /api/v1/metrics
      if (path === '/api/v1/metrics' && method === 'GET') {
        const metrics = this.getSwarmMetrics();
        this.sendJson(res, 200, { ok: true, data: metrics, timestamp: new Date().toISOString() });
        return;
      }

      // 404
      this.sendJson(res, 404, { ok: false, error: 'Not found', timestamp: new Date().toISOString() });
    } catch (err) {
      log.error(`Request error: ${err}`);
      this.sendJson(res, 500, { ok: false, error: 'Internal server error', timestamp: new Date().toISOString() });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private sendJson(res: ServerResponse, status: number, body: ApiResponse): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  private extractBearerToken(req: IncomingMessage): string | null {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }

  private getDashboardState(): DashboardState {
    return {
      bots: this.botManager.getAllHealth(),
      events: this.eventBus.getRecentEvents(200),
      metrics: this.getSwarmMetrics(),
      uptime: (Date.now() - this.startedAt) / 1000,
      startedAt: new Date(this.startedAt).toISOString(),
    };
  }

  private getSwarmMetrics(): SwarmMetrics {
    const busMetrics = this.eventBus.getMetrics();
    const allHealth = this.botManager.getAllHealth();
    const activeBots = Object.values(allHealth).filter(h => h.status === 'running').length;
    const totalErrors = Object.values(allHealth).reduce((sum, h) => sum + h.metrics.errorsTotal, 0);

    return {
      totalEvents: busMetrics.totalEvents,
      eventsPerMinute: busMetrics.eventsPerMinute,
      totalTokenLaunches: busMetrics.eventsByType['token:launch'] || 0,
      totalTrades: (busMetrics.eventsByType['trade:buy'] || 0) + (busMetrics.eventsByType['trade:sell'] || 0),
      totalFeeClaims: busMetrics.eventsByType['fee:claim'] || 0,
      totalCalls: busMetrics.eventsByType['call:new'] || 0,
      totalErrors,
      activeBots,
      peakMemory: process.memoryUsage().heapUsed,
      eventsByType: busMetrics.eventsByType,
      eventsByBot: busMetrics.eventsByBot,
    };
  }
}
