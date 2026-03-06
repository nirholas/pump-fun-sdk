import { WebSocketServer, WebSocket } from 'ws';
import type { BotManager } from '../engine/bot-manager.js';
import type { TokenFeed, TokenLaunch } from '../market/token-feed.js';
import type { PriceFeed, PriceUpdate } from '../market/price-feed.js';
import { logger } from '../logger.js';

/**
 * WebSocket handler — broadcasts real-time updates to connected dashboards.
 *
 * Messages sent to clients:
 *  - { type: 'state', data: { bots, stats } }  — full state snapshot (every 2s)
 *  - { type: 'token', data: TokenLaunch }       — new token detected
 *  - { type: 'price', data: PriceUpdate }       — price update
 *  - { type: 'bot:event', data: { ... } }       — bot lifecycle events
 *  - { type: 'trade', data: { ... } }           — trade executed
 *
 * Messages from clients:
 *  - { type: 'subscribe', channels: string[] }  — subscribe to specific channels
 *  - { type: 'command', action: string, ... }    — bot management commands
 */
export class WsHandler {
  private wss: WebSocketServer;
  private botManager: BotManager;
  private tokenFeed: TokenFeed;
  private priceFeed: PriceFeed;
  private stateTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<() => void> = [];

  constructor(wss: WebSocketServer, botManager: BotManager, tokenFeed: TokenFeed, priceFeed: PriceFeed) {
    this.wss = wss;
    this.botManager = botManager;
    this.tokenFeed = tokenFeed;
    this.priceFeed = priceFeed;
  }

  start(): void {
    // Handle new WebSocket connections
    this.wss.on('connection', (ws: WebSocket) => {
      logger.debug('WS client connected');

      // Send initial state
      this.sendState(ws);

      // Handle client messages
      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString('utf-8'));
          this.handleClientMessage(ws, msg);
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => {
        logger.debug('WS client disconnected');
      });
    });

    // Broadcast state every 2 seconds
    this.stateTimer = setInterval(() => {
      this.broadcastState();
    }, 2000);

    // Forward token feed events
    const onToken = (launch: TokenLaunch) => {
      this.broadcast({ type: 'token', data: launch });
    };
    this.tokenFeed.on('token', onToken);
    this.listeners.push(() => this.tokenFeed.off('token', onToken));

    // Forward price updates (throttled — only every 5th update per mint)
    let priceCounter = 0;
    const onPrice = (update: PriceUpdate) => {
      priceCounter++;
      if (priceCounter % 5 === 0) {
        this.broadcast({
          type: 'price',
          data: {
            mint: update.mint,
            marketCapSol: update.marketCapLamports.toNumber() / 1e9,
            progressBps: update.progressBps,
            complete: update.complete,
          },
        });
      }
    };
    this.priceFeed.on('price', onPrice);
    this.listeners.push(() => this.priceFeed.off('price', onPrice));

    // Forward bot manager events
    const botEvents = ['bot:created', 'bot:started', 'bot:paused', 'bot:stopped', 'bot:deleted', 'swarm:emergency-shutdown'];
    for (const event of botEvents) {
      const handler = (data: unknown) => {
        this.broadcast({ type: 'bot:event', event, data });
      };
      this.botManager.on(event, handler);
      this.listeners.push(() => this.botManager.off(event, handler));
    }

    logger.info('WS handler started');
  }

  stop(): void {
    if (this.stateTimer) {
      clearInterval(this.stateTimer);
      this.stateTimer = null;
    }
    for (const unsub of this.listeners) {
      unsub();
    }
    this.listeners = [];
  }

  /** Handle incoming client WebSocket messages */
  private handleClientMessage(ws: WebSocket, msg: Record<string, unknown>): void {
    const type = msg.type as string;

    switch (type) {
      case 'ping':
        this.send(ws, { type: 'pong', time: Date.now() });
        break;

      case 'get-state':
        this.sendState(ws);
        break;

      case 'command':
        this.handleCommand(ws, msg);
        break;

      default:
        this.send(ws, { type: 'error', message: `Unknown message type: ${type}` });
    }
  }

  /** Handle bot management commands via WebSocket */
  private handleCommand(ws: WebSocket, msg: Record<string, unknown>): void {
    const action = msg.action as string;
    const botId = msg.botId as string | undefined;

    try {
      switch (action) {
        case 'start-bot':
          if (!botId) throw new Error('botId required');
          this.botManager.startBot(botId);
          this.send(ws, { type: 'command:ok', action });
          break;

        case 'stop-bot':
          if (!botId) throw new Error('botId required');
          this.botManager.stopBot(botId);
          this.send(ws, { type: 'command:ok', action });
          break;

        case 'pause-bot':
          if (!botId) throw new Error('botId required');
          this.botManager.pauseBot(botId);
          this.send(ws, { type: 'command:ok', action });
          break;

        case 'start-all':
          this.botManager.startAll();
          this.send(ws, { type: 'command:ok', action });
          break;

        case 'stop-all':
          this.botManager.stopAll();
          this.send(ws, { type: 'command:ok', action });
          break;

        case 'emergency-shutdown':
          this.botManager.emergencyShutdown();
          this.send(ws, { type: 'command:ok', action });
          break;

        default:
          this.send(ws, { type: 'command:error', message: `Unknown action: ${action}` });
      }
    } catch (err) {
      this.send(ws, { type: 'command:error', message: err instanceof Error ? err.message : 'Command failed' });
    }
  }

  /** Send full state to a specific client */
  private sendState(ws: WebSocket): void {
    const data = this.getState();
    this.send(ws, { type: 'state', data });
  }

  /** Broadcast full state to all clients */
  private broadcastState(): void {
    if (this.wss.clients.size === 0) return;
    const data = this.getState();
    this.broadcast({ type: 'state', data });
  }

  /** Build current state snapshot */
  private getState(): unknown {
    return {
      bots: this.botManager.listBots(),
      stats: this.botManager.getGlobalStats(),
      tokenFeedSeen: this.tokenFeed.seenCount,
      priceFeedTracked: this.priceFeed.trackCount,
      uptime: process.uptime(),
      time: Date.now(),
    };
  }

  /** Send a JSON message to a specific client */
  private send(ws: WebSocket, data: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /** Broadcast a JSON message to all connected clients */
  private broadcast(data: unknown): void {
    const msg = JSON.stringify(data);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }
}
