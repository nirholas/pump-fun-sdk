/**
 * Monitor Bot API — REST Server
 *
 * HTTP API using Node.js built-in http module. Features:
 * - Bearer token authentication
 * - Per-client sliding-window rate limiting
 * - Paginated list endpoints with filtering
 * - SSE real-time event streaming with heartbeat
 * - Webhook registration for outbound event delivery
 * - Health check endpoint (no auth required)
 * - Request logging with timing
 * - Graceful shutdown with connection draining
 * - Security headers
 *
 * Routes (from monitor-bot.md spec):
 *   GET  /health           — Health + uptime (no auth)
 *   GET  /status           — Monitor status + event counts
 *   GET  /watches          — List active watches
 *   POST /watches          — Add a watch
 *   DELETE /watches/:wallet — Remove a watch by wallet
 *   GET  /claims           — Recent claim events
 *   GET  /launches         — Recent token launches
 *   GET  /stream           — SSE event stream
 *   POST /webhooks         — Register webhook
 *   DELETE /webhooks/:id   — Remove webhook
 */

import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { log } from '../logger.js';
import type { FeeClaimEvent } from '../types.js';
import {
    addApiWatch,
    findMatchingApiWatches,
    getApiWatchCount,
    getApiWatchesForClient,
    getClientWatchCount,
    loadApiWatches,
    removeApiWatch,
} from './apiStore.js';
import { ClaimBuffer } from './claimBuffer.js';
import { RateLimiter } from './rateLimiter.js';
import type {
    ApiConfig,
    ClaimResponse,
    CreateWatchBody,
    HealthResponse,
    LaunchResponse,
    PaginatedResponse,
    RegisterWebhookBody,
    StatusResponse,
    WatchResponse,
    WebhookRegistration,
} from './types.js';
import { dispatchWebhooks } from './webhooks.js';

// ============================================================================
// API Config Loader
// ============================================================================

export function loadApiConfig(): ApiConfig {
    return {
        bearerToken: process.env.API_BEARER_TOKEN || process.env.API_KEY || '',
        claimBufferSize: Number.parseInt(process.env.CLAIM_BUFFER_SIZE || '10000', 10),
        corsOrigins: process.env.CORS_ORIGINS || '*',
        launchBufferSize: Number.parseInt(process.env.LAUNCH_BUFFER_SIZE || '1000', 10),
        maxWatchesPerClient: Number.parseInt(process.env.MAX_WATCHES_PER_CLIENT || '100', 10),
        port: Number.parseInt(process.env.PORT || process.env.API_PORT || '3000', 10),
        rateLimitMax: Number.parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
        rateLimitWindowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    };
}

// ============================================================================
// Launch Buffer — ring buffer for recent token launches
// ============================================================================

class LaunchBuffer {
    private buffer: LaunchResponse[] = [];
    private maxSize: number;
    private totalProcessed = 0;

    constructor(maxSize: number = 1_000) {
        this.maxSize = maxSize;
    }

    push(launch: LaunchResponse): void {
        this.buffer.push(launch);
        this.totalProcessed++;
        if (this.buffer.length > this.maxSize) {
            this.buffer.splice(0, this.buffer.length - this.maxSize);
        }
    }

    query(opts: {
        creator?: string;
        githubOnly?: boolean;
        page?: number;
        limit?: number;
    }): { data: LaunchResponse[]; total: number } {
        let results = [...this.buffer];
        if (opts.creator) {
            const c = opts.creator.toLowerCase();
            results = results.filter((l) => l.creatorWallet.toLowerCase() === c);
        }
        if (opts.githubOnly) {
            results = results.filter((l) => l.hasGithub);
        }
        results.reverse();
        const total = results.length;
        const page = opts.page ?? 1;
        const limit = Math.min(opts.limit ?? 50, 100);
        const offset = (page - 1) * limit;
        return { data: results.slice(offset, offset + limit), total };
    }

    get size(): number {
        return this.buffer.length;
    }

    get total(): number {
        return this.totalProcessed;
    }
}

// ============================================================================
// API Server
// ============================================================================

export class MonitorApi {
    private config: ApiConfig;
    private rateLimiter: RateLimiter;
    private claimBuffer: ClaimBuffer;
    private launchBuffer: LaunchBuffer;
    private webhooks = new Map<string, WebhookRegistration>();
    private server: Server | null = null;
    private startedAt = 0;
    private monitorState: () => { running: boolean; mode: string; claimsDetected: number };

    constructor(
        config: ApiConfig,
        getMonitorState: () => { running: boolean; mode: string; claimsDetected: number },
    ) {
        this.config = config;
        this.monitorState = getMonitorState;
        this.rateLimiter = new RateLimiter(config);
        this.claimBuffer = new ClaimBuffer(config.claimBufferSize);
        this.launchBuffer = new LaunchBuffer(config.launchBufferSize);
        loadApiWatches();
    }

    // ════════════════════════════════════════════════════════════════════
    // Event Handlers — called by index.ts to feed events into the API
    // ════════════════════════════════════════════════════════════════════

    /** Buffer a claim event, dispatch webhooks to matching watches. */
    handleClaim(event: FeeClaimEvent): void {
        this.claimBuffer.push(event);

        const matchingApiWatches = findMatchingApiWatches(event.claimerWallet);
        if (matchingApiWatches.length > 0) {
            const claimResp: ClaimResponse = {
                amountLamports: event.amountLamports,
                amountSol: event.amountSol,
                claimLabel: event.claimLabel,
                claimType: event.claimType,
                claimerWallet: event.claimerWallet,
                isCashback: event.isCashback,
                programId: event.programId,
                slot: event.slot,
                timestamp: new Date(event.timestamp * 1000).toISOString(),
                tokenMint: event.tokenMint,
                tokenName: event.tokenName,
                tokenSymbol: event.tokenSymbol,
                txSignature: event.txSignature,
            };
            dispatchWebhooks(claimResp, matchingApiWatches).catch((err) =>
                log.error('Webhook dispatch error:', err),
            );
        }
    }

    /** Buffer a token launch event. */
    handleLaunch(launch: LaunchResponse): void {
        this.launchBuffer.push(launch);
    }

    // ════════════════════════════════════════════════════════════════════
    // Lifecycle
    // ════════════════════════════════════════════════════════════════════

    async start(): Promise<void> {
        this.startedAt = Date.now();

        this.server = createServer(async (req, res) => {
            const start = Date.now();
            const method = req.method || 'GET';
            const url = req.url || '/';

            res.on('finish', () => {
                const duration = Date.now() - start;
                const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'debug';
                log[level]('%s %s → %d (%dms)', method, url, res.statusCode, duration);
            });

            try {
                await this.handleRequest(req, res);
            } catch (err) {
                log.error('Unhandled API error:', err);
                this.sendJson(res, 500, {
                    code: 'INTERNAL_ERROR',
                    error: 'Internal server error',
                    statusCode: 500,
                });
            }
        });

        this.server.keepAliveTimeout = 65_000;
        this.server.headersTimeout = 66_000;
        this.server.maxHeadersCount = 100;

        return new Promise((resolve) => {
            this.server!.listen(this.config.port, '0.0.0.0', () => {
                log.info('Monitor API listening on 0.0.0.0:%d', this.config.port);
                resolve();
            });
        });
    }

    stop(): void {
        this.rateLimiter.stop();
        if (this.server) {
            this.server.close(() => {
                log.info('Monitor API stopped');
            });
            setTimeout(() => {
                this.server?.closeAllConnections?.();
            }, 10_000).unref();
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // Request Router
    // ════════════════════════════════════════════════════════════════════

    private async handleRequest(
        req: import('node:http').IncomingMessage,
        res: import('node:http').ServerResponse,
    ): Promise<void> {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const method = req.method?.toUpperCase() || 'GET';
        const path = url.pathname;

        // Security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-Request-Id', `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', this.config.corsOrigins);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Request-Id');

        if (method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // ── Public routes (no auth) ─────────────────────────────────────
        if (path === '/health' && method === 'GET') {
            return this.handleHealth(res);
        }

        // ── Auth (Bearer token) ─────────────────────────────────────────
        const clientId = this.authenticate(req);
        if (!clientId) {
            return this.sendJson(res, 401, {
                code: 'UNAUTHORIZED',
                error: 'Invalid or missing Bearer token. Set Authorization: Bearer <token>.',
                statusCode: 401,
            });
        }

        // ── Rate limiting ───────────────────────────────────────────────
        const rateCheck = this.rateLimiter.check(clientId);
        res.setHeader('X-RateLimit-Limit', rateCheck.limit.toString());
        res.setHeader('X-RateLimit-Remaining', rateCheck.remaining.toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil(rateCheck.resetMs / 1000).toString());

        if (!rateCheck.allowed) {
            res.setHeader('Retry-After', Math.ceil(rateCheck.resetMs / 1000).toString());
            return this.sendJson(res, 429, {
                code: 'RATE_LIMITED',
                error: `Rate limit exceeded. Try again in ${Math.ceil(rateCheck.resetMs / 1000)}s.`,
                statusCode: 429,
            });
        }

        // ── Route matching ──────────────────────────────────────────────

        if (path === '/status' && method === 'GET') {
            return this.handleStatus(res);
        }

        if (path === '/claims' && method === 'GET') {
            return this.handleGetClaims(url, res);
        }

        if (path === '/launches' && method === 'GET') {
            return this.handleGetLaunches(url, res);
        }

        if (path === '/stream' && method === 'GET') {
            return this.handleStream(req, res, clientId, url);
        }

        // Watches
        if (path === '/watches') {
            if (method === 'GET') return this.handleListWatches(url, clientId, res);
            if (method === 'POST') return this.handleCreateWatch(req, clientId, res);
        }

        // DELETE /watches/:wallet
        const watchDeleteMatch = path.match(/^\/watches\/([1-9A-HJ-NP-Za-km-z]{32,44})$/);
        if (watchDeleteMatch && method === 'DELETE') {
            return this.handleDeleteWatchByWallet(watchDeleteMatch[1]!, clientId, res);
        }

        // Webhooks
        if (path === '/webhooks') {
            if (method === 'POST') return this.handleRegisterWebhook(req, clientId, res);
        }

        const webhookDeleteMatch = path.match(/^\/webhooks\/([a-zA-Z0-9_-]+)$/);
        if (webhookDeleteMatch && method === 'DELETE') {
            return this.handleDeleteWebhook(webhookDeleteMatch[1]!, clientId, res);
        }

        // 404
        this.sendJson(res, 404, {
            code: 'NOT_FOUND',
            error: `Route not found: ${method} ${path}`,
            statusCode: 404,
        });
    }

    // ════════════════════════════════════════════════════════════════════
    // Auth — Bearer token only
    // ════════════════════════════════════════════════════════════════════

    private authenticate(req: import('node:http').IncomingMessage): string | null {
        // If no bearer token configured, allow all with a default client ID
        if (!this.config.bearerToken) {
            return 'default';
        }

        const auth = req.headers.authorization;
        if (auth?.startsWith('Bearer ')) {
            const token = auth.slice(7).trim();
            if (token === this.config.bearerToken) {
                return 'authenticated';
            }
        }

        return null;
    }

    // ════════════════════════════════════════════════════════════════════
    // Handlers
    // ════════════════════════════════════════════════════════════════════

    private handleHealth(res: import('node:http').ServerResponse): void {
        const state = this.monitorState();
        const response: HealthResponse = {
            status: state.running ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: this.startedAt ? Date.now() - this.startedAt : 0,
        };
        this.sendJson(res, 200, response);
    }

    private handleStatus(res: import('node:http').ServerResponse): void {
        const state = this.monitorState();
        const watchCounts = getApiWatchCount();
        const response: StatusResponse = {
            claims: {
                buffered: this.claimBuffer.size,
                total: this.claimBuffer.total,
            },
            launches: {
                buffered: this.launchBuffer.size,
                total: this.launchBuffer.total,
            },
            monitor: state,
            uptime: this.startedAt ? Date.now() - this.startedAt : 0,
            watches: watchCounts,
        };
        this.sendJson(res, 200, response);
    }

    // ── Claims ──────────────────────────────────────────────────────────

    private handleGetClaims(
        url: URL,
        res: import('node:http').ServerResponse,
    ): void {
        const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '50', 10)));

        const result = this.claimBuffer.query({
            claimType: url.searchParams.get('claimType') || undefined,
            isCashback: url.searchParams.has('isCashback')
                ? url.searchParams.get('isCashback') === 'true'
                : undefined,
            limit,
            maxAmountSol: url.searchParams.has('maxAmountSol')
                ? Number.parseFloat(url.searchParams.get('maxAmountSol')!)
                : undefined,
            minAmountSol: url.searchParams.has('minAmountSol')
                ? Number.parseFloat(url.searchParams.get('minAmountSol')!)
                : undefined,
            page,
            since: url.searchParams.get('since') || undefined,
            tokenMint: url.searchParams.get('tokenMint') || undefined,
            until: url.searchParams.get('until') || undefined,
            wallet: url.searchParams.get('wallet') || undefined,
        });

        const totalPages = Math.ceil(result.total / limit);

        const response: PaginatedResponse<ClaimResponse> = {
            data: result.data,
            pagination: {
                hasNext: page < totalPages,
                hasPrev: page > 1,
                limit,
                page,
                total: result.total,
                totalPages,
            },
        };
        this.sendJson(res, 200, response);
    }

    // ── Launches ────────────────────────────────────────────────────────

    private handleGetLaunches(
        url: URL,
        res: import('node:http').ServerResponse,
    ): void {
        const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '50', 10)));

        const result = this.launchBuffer.query({
            creator: url.searchParams.get('creator') || undefined,
            githubOnly: url.searchParams.has('githubOnly')
                ? url.searchParams.get('githubOnly') === 'true'
                : undefined,
            limit,
            page,
        });

        const totalPages = Math.ceil(result.total / limit);

        const response: PaginatedResponse<LaunchResponse> = {
            data: result.data,
            pagination: {
                hasNext: page < totalPages,
                hasPrev: page > 1,
                limit,
                page,
                total: result.total,
                totalPages,
            },
        };
        this.sendJson(res, 200, response);
    }

    // ── SSE Stream ──────────────────────────────────────────────────────

    private handleStream(
        req: import('node:http').IncomingMessage,
        res: import('node:http').ServerResponse,
        clientId: string,
        url: URL,
    ): void {
        const walletFilter = url.searchParams.get('wallet')?.toLowerCase();
        const cashbackFilter = url.searchParams.has('isCashback')
            ? url.searchParams.get('isCashback') === 'true'
            : undefined;

        res.writeHead(200, {
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Content-Type': 'text/event-stream',
            'X-Accel-Buffering': 'no',
        });

        res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`);

        const heartbeat = setInterval(() => {
            res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
        }, 30_000);

        const subscriberId = `${clientId}_${Date.now()}`;
        const unsubscribe = this.claimBuffer.subscribe(subscriberId, (claim) => {
            if (walletFilter && claim.claimerWallet.toLowerCase() !== walletFilter) return;
            if (cashbackFilter !== undefined && claim.isCashback !== cashbackFilter) return;
            res.write(`event: claim\ndata: ${JSON.stringify(claim)}\n\n`);
        });

        req.on('close', () => {
            clearInterval(heartbeat);
            unsubscribe();
            log.debug('SSE client disconnected: %s', subscriberId);
        });
    }

    // ── Watches ─────────────────────────────────────────────────────────

    private handleListWatches(
        url: URL,
        clientId: string,
        res: import('node:http').ServerResponse,
    ): void {
        const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '50', 10)));

        const watches = getApiWatchesForClient(clientId).filter((w) => w.active);
        const total = watches.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;
        const pageData = watches.slice(offset, offset + limit).map(this.toWatchResponse);

        const response: PaginatedResponse<WatchResponse> = {
            data: pageData,
            pagination: {
                hasNext: page < totalPages,
                hasPrev: page > 1,
                limit,
                page,
                total,
                totalPages,
            },
        };
        this.sendJson(res, 200, response);
    }

    private async handleCreateWatch(
        req: import('node:http').IncomingMessage,
        clientId: string,
        res: import('node:http').ServerResponse,
    ): Promise<void> {
        const body = await this.readBody<CreateWatchBody>(req);
        if (!body) {
            return this.sendJson(res, 400, {
                code: 'INVALID_BODY',
                error: 'Request body must be valid JSON with a "wallet" field.',
                statusCode: 400,
            });
        }

        if (!body.wallet || typeof body.wallet !== 'string') {
            return this.sendJson(res, 400, {
                code: 'MISSING_WALLET',
                error: '"wallet" field is required and must be a string.',
                statusCode: 400,
            });
        }

        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(body.wallet)) {
            return this.sendJson(res, 400, {
                code: 'INVALID_WALLET',
                error: 'Invalid Solana wallet address.',
                statusCode: 400,
            });
        }

        if (body.webhookUrl) {
            try {
                const parsed = new URL(body.webhookUrl);
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    throw new Error('bad protocol');
                }
            } catch {
                return this.sendJson(res, 400, {
                    code: 'INVALID_WEBHOOK',
                    error: 'webhookUrl must be a valid HTTP(S) URL.',
                    statusCode: 400,
                });
            }
        }

        const currentCount = getClientWatchCount(clientId);
        if (currentCount >= this.config.maxWatchesPerClient) {
            return this.sendJson(res, 409, {
                code: 'WATCH_LIMIT',
                error: `Maximum watches per client reached (${this.config.maxWatchesPerClient}).`,
                statusCode: 409,
            });
        }

        const existing = getApiWatchesForClient(clientId);
        if (existing.some((w) => w.recipientWallet.toLowerCase() === body.wallet.toLowerCase() && w.active)) {
            return this.sendJson(res, 409, {
                code: 'DUPLICATE_WATCH',
                error: 'This wallet is already being watched.',
                statusCode: 409,
            });
        }

        const watch = addApiWatch(
            clientId,
            body.wallet,
            body.label,
            body.tokenFilter,
            body.webhookUrl,
        );

        this.sendJson(res, 201, this.toWatchResponse(watch));
    }

    private handleDeleteWatchByWallet(
        wallet: string,
        clientId: string,
        res: import('node:http').ServerResponse,
    ): void {
        const watches = getApiWatchesForClient(clientId);
        const match = watches.find(
            (w) => w.recipientWallet.toLowerCase() === wallet.toLowerCase() && w.active,
        );

        if (!match) {
            return this.sendJson(res, 404, {
                code: 'WATCH_NOT_FOUND',
                error: `No active watch found for wallet "${wallet}".`,
                statusCode: 404,
            });
        }

        removeApiWatch(match.id, clientId);
        this.sendJson(res, 200, { message: 'Watch removed successfully.' });
    }

    // ── Webhooks ────────────────────────────────────────────────────────

    private async handleRegisterWebhook(
        req: import('node:http').IncomingMessage,
        clientId: string,
        res: import('node:http').ServerResponse,
    ): Promise<void> {
        const body = await this.readBody<RegisterWebhookBody>(req);
        if (!body || !body.url || typeof body.url !== 'string') {
            return this.sendJson(res, 400, {
                code: 'INVALID_BODY',
                error: 'Request body must be valid JSON with a "url" field.',
                statusCode: 400,
            });
        }

        try {
            const parsed = new URL(body.url);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                throw new Error('bad protocol');
            }
        } catch {
            return this.sendJson(res, 400, {
                code: 'INVALID_URL',
                error: 'url must be a valid HTTP(S) URL.',
                statusCode: 400,
            });
        }

        const id = randomUUID();
        const registration: WebhookRegistration = {
            clientId,
            createdAt: new Date().toISOString(),
            events: body.events ?? ['claim', 'launch'],
            id,
            url: body.url,
        };

        this.webhooks.set(id, registration);
        log.info('Webhook registered: %s → %s', id, body.url);
        this.sendJson(res, 201, registration);
    }

    private handleDeleteWebhook(
        webhookId: string,
        clientId: string,
        res: import('node:http').ServerResponse,
    ): void {
        const webhook = this.webhooks.get(webhookId);
        if (!webhook || webhook.clientId !== clientId) {
            return this.sendJson(res, 404, {
                code: 'WEBHOOK_NOT_FOUND',
                error: `Webhook "${webhookId}" not found.`,
                statusCode: 404,
            });
        }

        this.webhooks.delete(webhookId);
        log.info('Webhook removed: %s', webhookId);
        this.sendJson(res, 200, { message: 'Webhook removed successfully.' });
    }

    // ════════════════════════════════════════════════════════════════════
    // Helpers
    // ════════════════════════════════════════════════════════════════════

    private toWatchResponse(watch: import('./types.js').ApiWatchEntry): WatchResponse {
        return {
            active: watch.active,
            clientId: watch.clientId,
            createdAt: new Date(watch.createdAt).toISOString(),
            id: watch.id,
            label: watch.label,
            tokenFilter: watch.tokenFilter,
            wallet: watch.recipientWallet,
            webhookUrl: watch.webhookUrl,
        };
    }

    private sendJson(
        res: import('node:http').ServerResponse,
        status: number,
        body: unknown,
    ): void {
        const json = JSON.stringify(body);
        res.writeHead(status, {
            'Content-Length': Buffer.byteLength(json),
            'Content-Type': 'application/json',
        });
        res.end(json);
    }

    private readBody<T>(req: import('node:http').IncomingMessage): Promise<T | null> {
        return new Promise((resolve) => {
            const chunks: Buffer[] = [];
            let size = 0;
            const MAX_BODY = 64 * 1024; // 64KB

            req.on('data', (chunk: Buffer) => {
                size += chunk.length;
                if (size > MAX_BODY) {
                    resolve(null);
                    req.destroy();
                    return;
                }
                chunks.push(chunk);
            });

            req.on('end', () => {
                try {
                    const raw = Buffer.concat(chunks).toString('utf-8');
                    resolve(JSON.parse(raw) as T);
                } catch {
                    resolve(null);
                }
            });

            req.on('error', () => resolve(null));
        });
    }
}

