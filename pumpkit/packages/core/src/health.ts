/**
 * @pumpkit/core — Health Check Server
 *
 * Minimal HTTP health endpoint for Railway / Docker health probes.
 * GET /health → 200 OK with uptime + stats JSON.
 */

import { createServer, type Server } from 'node:http';
import { log } from './logger.js';

const DEFAULT_PORT = 3000;

export interface HealthStats {
    /** Unix ms when the bot started */
    startedAt: number;
    /** Callback to get dynamic stats */
    getStats?: () => Record<string, unknown>;
}

let server: Server | null = null;

export function startHealthServer(opts: HealthStats): void {
    const port = Number(process.env.PORT || process.env.HEALTH_PORT || DEFAULT_PORT);

    server = createServer((req, res) => {
        if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
            const uptimeMs = Date.now() - opts.startedAt;
            const dynamicStats = opts.getStats?.() ?? {};
            const status = dynamicStats.degraded ? 'degraded' : 'ok';
            const body = JSON.stringify({
                status,
                uptime: `${Math.floor(uptimeMs / 1000)}s`,
                uptimeMs,
                ...dynamicStats,
            });
            const statusCode = status === 'ok' ? 200 : 503;
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(body);
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });

    server.listen(port, () => {
        log.info('Health server listening on port %d', port);
    });

    server.on('error', (err) => {
        log.warn('Health server error: %s', err);
    });
}

export function stopHealthServer(): Promise<void> {
    return new Promise((resolve) => {
        if (server) {
            server.close(() => resolve());
            server = null;
        } else {
            resolve();
        }
    });
}
