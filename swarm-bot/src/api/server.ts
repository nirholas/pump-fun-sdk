import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { BotManager } from '../engine/bot-manager.js';
import type { TokenFeed } from '../market/token-feed.js';
import type { PriceFeed } from '../market/price-feed.js';
import { handleRequest } from './routes.js';
import { WsHandler } from './ws-handler.js';
import { logger } from '../logger.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * API Server — serves REST endpoints, WebSocket connections, and the
 * static dashboard on a single HTTP port.
 */
export class ApiServer {
  private readonly port: number;
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private wsHandler: WsHandler | null = null;
  private botManager: BotManager;
  private tokenFeed: TokenFeed;
  private priceFeed: PriceFeed;

  constructor(opts: {
    port: number;
    botManager: BotManager;
    tokenFeed: TokenFeed;
    priceFeed: PriceFeed;
  }) {
    this.port = opts.port;
    this.botManager = opts.botManager;
    this.tokenFeed = opts.tokenFeed;
    this.priceFeed = opts.priceFeed;
  }

  /** Start the HTTP + WebSocket server */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        // Serve dashboard at root
        if (req.url === '/' || req.url === '/index.html') {
          this.serveDashboard(res);
          return;
        }

        // API routes
        if (req.url?.startsWith('/api/')) {
          handleRequest(req, res, {
            botManager: this.botManager,
            tokenFeed: this.tokenFeed,
            priceFeed: this.priceFeed,
          });
          return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });

      // WebSocket server on same HTTP server
      this.wss = new WebSocketServer({ server: this.server, path: '/ws' });
      this.wsHandler = new WsHandler(this.wss, this.botManager, this.tokenFeed, this.priceFeed);
      this.wsHandler.start();

      this.server.listen(this.port, () => {
        logger.info(`API server listening on http://0.0.0.0:${this.port}`);
        logger.info(`Dashboard: http://localhost:${this.port}`);
        logger.info(`WebSocket: ws://localhost:${this.port}/ws`);
        resolve();
      });
    });
  }

  /** Stop the server */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wsHandler?.stop();
      this.wss?.close();
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private serveDashboard(res: http.ServerResponse): void {
    const dashboardPath = path.join(import.meta.dirname ?? '.', '..', 'dashboard', 'index.html');
    try {
      const html = fs.readFileSync(dashboardPath, 'utf-8');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(html);
    } catch {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body><h1>Swarm Bot Dashboard</h1><p>Dashboard file not found. Check installation.</p></body></html>');
    }
  }
}
