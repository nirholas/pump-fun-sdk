import { Connection, Keypair } from '@solana/web3.js';
import { BotInstance, type BotConfig, type BotStatus } from './bot-instance.js';
import type { SwarmDb } from '../store/db.js';
import { logger } from '../logger.js';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

export interface BotSummary {
  id: string;
  name: string;
  strategy: string;
  status: BotStatus;
  walletPubkey: string;
  openPositions: number;
  trackedMints: number;
}

/**
 * BotManager — orchestrates multiple BotInstance objects.
 *
 * Responsibilities:
 *  - Create / delete bots
 *  - Start / stop / pause bots
 *  - Route new token events to the right bots
 *  - Provide aggregate status for the dashboard
 *  - Emergency shutdown all bots
 */
export class BotManager extends EventEmitter {
  private bots = new Map<string, BotInstance>();
  private db: SwarmDb;
  private connection: Connection;

  constructor(db: SwarmDb, connection: Connection) {
    super();
    this.db = db;
    this.connection = connection;
  }

  /** Create a new bot and persist it */
  createBot(opts: {
    name: string;
    strategyName: string;
    strategyParams?: Record<string, number | string | boolean>;
    maxBuySol?: number;
    maxPositions?: number;
    slippageBps?: number;
    pollIntervalMs?: number;
    watchMints?: string[];
    walletKeypair?: Keypair; // If not provided, generates a new one
  }): BotInstance {
    const id = crypto.randomUUID();
    const wallet = opts.walletKeypair ?? Keypair.generate();

    const config: BotConfig = {
      id,
      name: opts.name,
      strategyName: opts.strategyName,
      strategyParams: opts.strategyParams ?? {},
      maxBuySol: opts.maxBuySol ?? 1,
      maxPositions: opts.maxPositions ?? 5,
      slippageBps: opts.slippageBps ?? 500,
      pollIntervalMs: opts.pollIntervalMs ?? 5000,
      watchMints: opts.watchMints,
    };

    const bot = new BotInstance({
      config,
      wallet,
      connection: this.connection,
      db: this.db,
    });

    // Persist to database
    this.db.insertBot({
      id,
      name: opts.name,
      strategy: opts.strategyName,
      status: 'stopped',
      wallet_pubkey: wallet.publicKey.toBase58(),
      config_json: JSON.stringify({
        ...config,
        // Store secret key encrypted-at-rest would go here in production
        // For now just store pubkey — private key is held in memory only
      }),
    });

    this.bots.set(id, bot);
    this.emit('bot:created', { id, name: opts.name, strategy: opts.strategyName });
    logger.info(`Bot created: ${opts.name} (${id.slice(0, 8)}…) strategy=${opts.strategyName} wallet=${wallet.publicKey.toBase58().slice(0, 8)}…`);

    return bot;
  }

  /** Start a bot by ID */
  startBot(id: string): void {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Bot not found: ${id}`);
    bot.start();
    this.emit('bot:started', { id });
  }

  /** Pause a bot by ID */
  pauseBot(id: string): void {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Bot not found: ${id}`);
    bot.pause();
    this.emit('bot:paused', { id });
  }

  /** Resume a paused bot */
  resumeBot(id: string): void {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Bot not found: ${id}`);
    bot.resume();
    this.emit('bot:resumed', { id });
  }

  /** Stop a bot by ID */
  stopBot(id: string): void {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Bot not found: ${id}`);
    bot.stop();
    this.emit('bot:stopped', { id });
  }

  /** Delete a bot (must be stopped first) */
  deleteBot(id: string): void {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Bot not found: ${id}`);
    if (bot.getStatus() === 'running') {
      bot.stop();
    }
    this.bots.delete(id);
    this.db.deleteBot(id);
    this.emit('bot:deleted', { id });
    logger.info(`Bot deleted: ${id}`);
  }

  /** Emergency: stop all bots and sell all positions */
  async emergencyShutdown(): Promise<void> {
    logger.warn('EMERGENCY SHUTDOWN — stopping all bots');
    const promises: Promise<void>[] = [];
    for (const bot of this.bots.values()) {
      if (bot.getStatus() === 'running') {
        promises.push(bot.emergencyExit());
      }
    }
    await Promise.allSettled(promises);
    this.emit('swarm:emergency-shutdown');
    logger.warn('Emergency shutdown complete');
  }

  /** Route a new token event to all running bots */
  onNewToken(mint: string, metadata?: { name?: string; symbol?: string; ageSec?: number }): void {
    for (const bot of this.bots.values()) {
      if (bot.getStatus() === 'running') {
        bot.addMint(mint);
      }
    }
  }

  /** Get a bot instance by ID */
  getBot(id: string): BotInstance | undefined {
    return this.bots.get(id);
  }

  /** List all bots with summary info */
  listBots(): BotSummary[] {
    const summaries: BotSummary[] = [];
    for (const bot of this.bots.values()) {
      summaries.push({
        id: bot.id,
        name: bot.name,
        strategy: bot.config.strategyName,
        status: bot.getStatus(),
        walletPubkey: bot.wallet.publicKey.toBase58(),
        openPositions: bot.getPositionTracker().getOpenPositions().length,
        trackedMints: bot.getTrackedMints().length,
      });
    }
    return summaries;
  }

  /** Start all stopped bots */
  startAll(): void {
    for (const bot of this.bots.values()) {
      if (bot.getStatus() === 'stopped' || bot.getStatus() === 'paused') {
        bot.start();
      }
    }
    this.emit('swarm:started');
  }

  /** Stop all running bots */
  stopAll(): void {
    for (const bot of this.bots.values()) {
      if (bot.getStatus() === 'running') {
        bot.stop();
      }
    }
    this.emit('swarm:stopped');
  }

  /** Get global stats across all bots */
  getGlobalStats(): {
    totalBots: number;
    runningBots: number;
    totalOpenPositions: number;
    totalTrackedMints: number;
  } {
    let running = 0;
    let openPositions = 0;
    let trackedMints = 0;
    for (const bot of this.bots.values()) {
      if (bot.getStatus() === 'running') running++;
      openPositions += bot.getPositionTracker().getOpenPositions().length;
      trackedMints += bot.getTrackedMints().length;
    }
    return {
      totalBots: this.bots.size,
      runningBots: running,
      totalOpenPositions: openPositions,
      totalTrackedMints: trackedMints,
    };
  }

  /** Get the underlying connection */
  getConnection(): Connection {
    return this.connection;
  }

  /** Number of active bots */
  get size(): number {
    return this.bots.size;
  }
}
