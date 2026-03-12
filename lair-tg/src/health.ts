/**
 * Lair-TG — Health Check Server
 *
 * Exposes GET /health for Docker/Railway probes.
 */

import { createServer, type Server } from 'node:http';
import { log } from './logger.js';

export interface HealthOptions {
  serviceName: string;
  startedAt: number;
  port: number;
  getStats?: () => Record<string, unknown>;
}

let server: Server | null = null;

export function startHealthServer(opts: HealthOptions): void {
  server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
      const uptimeMs = Date.now() - opts.startedAt;
      const body = JSON.stringify({
        service: opts.serviceName,
        status: 'ok',
        uptime: `${Math.floor(uptimeMs / 1000)}s`,
        uptimeMs,
        ...opts.getStats?.(),
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(body);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(opts.port, () => {
    log.info('Health server listening on :%d', opts.port);
  });
}

export function stopHealthServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
