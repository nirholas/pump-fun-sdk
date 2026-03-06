import type { IncomingMessage, ServerResponse } from 'http';
import type { BotManager } from '../engine/bot-manager.js';
import type { TokenFeed } from '../market/token-feed.js';
import type { PriceFeed } from '../market/price-feed.js';
import { Keypair } from '@solana/web3.js';
import { logger } from '../logger.js';
import * as crypto from 'crypto';

interface ApiContext {
  botManager: BotManager;
  tokenFeed: TokenFeed;
  priceFeed: PriceFeed;
}

type RouteHandler = (req: IncomingMessage, res: ServerResponse, ctx: ApiContext, params: Record<string, string>) => Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

const routes: Route[] = [];

function route(method: string, path: string, handler: RouteHandler): void {
  const paramNames: string[] = [];
  const pattern = path.replace(/:(\w+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  routes.push({ method, pattern: new RegExp(`^/api${pattern}$`), paramNames, handler });
}

// ── Bot CRUD ──────────────────────────────────────────────────────────────────

route('GET', '/bots', async (_req, res, ctx) => {
  const bots = ctx.botManager.listBots();
  json(res, bots);
});

route('POST', '/bots', async (req, res, ctx) => {
  const body = await readBody(req);
  if (!body.name || !body.strategy) {
    return error(res, 400, 'name and strategy are required');
  }

  const validStrategies = ['sniper', 'momentum', 'graduation', 'market-maker'];
  if (!validStrategies.includes(body.strategy)) {
    return error(res, 400, `Invalid strategy. Valid: ${validStrategies.join(', ')}`);
  }

  try {
    const bot = ctx.botManager.createBot({
      name: String(body.name).slice(0, 50),
      strategyName: body.strategy,
      strategyParams: body.params ?? {},
      maxBuySol: Number(body.maxBuySol) || 1,
      maxPositions: Number(body.maxPositions) || 5,
      slippageBps: Number(body.slippageBps) || 500,
      pollIntervalMs: Number(body.pollIntervalMs) || 5000,
      watchMints: Array.isArray(body.watchMints) ? body.watchMints.map(String) : undefined,
    });
    json(res, { id: bot.id, name: bot.name, wallet: bot.wallet.publicKey.toBase58() }, 201);
  } catch (err) {
    error(res, 500, err instanceof Error ? err.message : 'Failed to create bot');
  }
});

route('GET', '/bots/:id', async (_req, res, ctx, params) => {
  const bot = ctx.botManager.getBot(params.id);
  if (!bot) return error(res, 404, 'Bot not found');

  const positions = bot.getPositionTracker().getOpenPositions();
  json(res, {
    id: bot.id,
    name: bot.name,
    strategy: bot.config.strategyName,
    status: bot.getStatus(),
    wallet: bot.wallet.publicKey.toBase58(),
    config: bot.config,
    trackedMints: bot.getTrackedMints(),
    openPositions: positions.map(p => ({
      mint: p.mint,
      tokenAmount: p.tokenAmount.toString(),
      entrySol: (p.entrySol.toNumber() / 1e9).toFixed(4),
      entryPrice: p.entryAvgPrice,
      currentPrice: p.currentPrice,
      unrealizedPnl: p.unrealizedPnlSol.toFixed(4),
    })),
  });
});

route('DELETE', '/bots/:id', async (_req, res, ctx, params) => {
  try {
    ctx.botManager.deleteBot(params.id);
    json(res, { ok: true });
  } catch (err) {
    error(res, 404, err instanceof Error ? err.message : 'Not found');
  }
});

// ── Bot Actions ───────────────────────────────────────────────────────────────

route('POST', '/bots/:id/start', async (_req, res, ctx, params) => {
  try {
    ctx.botManager.startBot(params.id);
    json(res, { ok: true });
  } catch (err) {
    error(res, 404, err instanceof Error ? err.message : 'Not found');
  }
});

route('POST', '/bots/:id/pause', async (_req, res, ctx, params) => {
  try {
    ctx.botManager.pauseBot(params.id);
    json(res, { ok: true });
  } catch (err) {
    error(res, 404, err instanceof Error ? err.message : 'Not found');
  }
});

route('POST', '/bots/:id/resume', async (_req, res, ctx, params) => {
  try {
    ctx.botManager.resumeBot(params.id);
    json(res, { ok: true });
  } catch (err) {
    error(res, 404, err instanceof Error ? err.message : 'Not found');
  }
});

route('POST', '/bots/:id/stop', async (_req, res, ctx, params) => {
  try {
    ctx.botManager.stopBot(params.id);
    json(res, { ok: true });
  } catch (err) {
    error(res, 404, err instanceof Error ? err.message : 'Not found');
  }
});

route('POST', '/bots/:id/emergency-exit', async (_req, res, ctx, params) => {
  const bot = ctx.botManager.getBot(params.id);
  if (!bot) return error(res, 404, 'Bot not found');
  await bot.emergencyExit();
  json(res, { ok: true });
});

// ── Bot Mint Management ───────────────────────────────────────────────────────

route('POST', '/bots/:id/mints', async (req, res, ctx, params) => {
  const bot = ctx.botManager.getBot(params.id);
  if (!bot) return error(res, 404, 'Bot not found');

  const body = await readBody(req);
  if (!body.mint || typeof body.mint !== 'string') {
    return error(res, 400, 'mint is required');
  }

  // Basic Solana address validation
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(body.mint)) {
    return error(res, 400, 'Invalid mint address format');
  }

  bot.addMint(body.mint);
  ctx.priceFeed.track(body.mint);
  json(res, { ok: true, mint: body.mint });
});

route('DELETE', '/bots/:id/mints/:mint', async (_req, res, ctx, params) => {
  const bot = ctx.botManager.getBot(params.id);
  if (!bot) return error(res, 404, 'Bot not found');
  bot.removeMint(params.mint);
  json(res, { ok: true });
});

// ── Global Actions ────────────────────────────────────────────────────────────

route('POST', '/swarm/start-all', async (_req, res, ctx) => {
  ctx.botManager.startAll();
  json(res, { ok: true });
});

route('POST', '/swarm/stop-all', async (_req, res, ctx) => {
  ctx.botManager.stopAll();
  json(res, { ok: true });
});

route('POST', '/swarm/emergency-shutdown', async (_req, res, ctx) => {
  await ctx.botManager.emergencyShutdown();
  json(res, { ok: true });
});

route('GET', '/stats', async (_req, res, ctx) => {
  const botStats = ctx.botManager.getGlobalStats();
  json(res, {
    ...botStats,
    tokenFeedSeen: ctx.tokenFeed.seenCount,
    priceFeedTracked: ctx.priceFeed.trackCount,
    uptime: process.uptime(),
  });
});

route('GET', '/strategies', async (_req, res) => {
  json(res, [
    { name: 'sniper', description: 'Buy new launches instantly, sell at profit target or stop-loss', params: ['maxAgeSec', 'maxMarketCapSol', 'takeProfitMultiple', 'stopLossPercent'] },
    { name: 'momentum', description: 'Buy tokens with rising mcap velocity, ride the wave', params: ['minMcapSol', 'maxMcapSol', 'entryVelocityPctPerSec', 'exitVelocityPctPerSec', 'takeProfitPct', 'stopLossPct', 'windowSec'] },
    { name: 'graduation', description: 'Accumulate before graduation, sell into AMM liquidity', params: ['minProgressBps', 'entryProgressBps', 'maxEntrySol', 'entryTranches', 'holdAfterGradMs', 'takeProfitPct', 'stopLossPct'] },
    { name: 'market-maker', description: 'Grid-style buy/sell around bonding curve midpoint', params: ['targetPositionSol', 'gridSpreadPct', 'rebalanceThresholdPct', 'minMcapSol', 'maxMcapSol', 'maxInventoryDeviationPct'] },
  ]);
});

// ── Health ────────────────────────────────────────────────────────────────────

route('GET', '/health', async (_req, res) => {
  json(res, { status: 'ok', time: new Date().toISOString() });
});

// ── Request Handler ───────────────────────────────────────────────────────────

export function handleRequest(req: IncomingMessage, res: ServerResponse, ctx: ApiContext): void {
  const method = req.method ?? 'GET';
  const url = req.url ?? '';

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Match route
  for (const r of routes) {
    if (r.method !== method) continue;
    const match = url.match(r.pattern);
    if (!match) continue;

    const params: Record<string, string> = {};
    for (let i = 0; i < r.paramNames.length; i++) {
      params[r.paramNames[i]] = decodeURIComponent(match[i + 1]);
    }

    r.handler(req, res, ctx, params).catch(err => {
      logger.error(`API error: ${err instanceof Error ? err.message : err}`);
      error(res, 500, 'Internal server error');
    });
    return;
  }

  error(res, 404, `No route: ${method} ${url}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function error(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

const MAX_BODY_SIZE = 1024 * 64; // 64KB max request body

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        if (!raw) {
          resolve({});
          return;
        }
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          resolve({});
          return;
        }
        resolve(parsed as Record<string, unknown>);
      } catch {
        resolve({});
      }
    });

    req.on('error', reject);
  });
}
