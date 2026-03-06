import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { OnlinePumpSdk } from '@pump-fun/pump-sdk';
import { getGraduationProgress, bondingCurveMarketCap } from '@pump-fun/pump-sdk';
import type { Strategy, StrategyConfig, TokenSnapshot, TradeSignal } from '../strategies/types.js';
import { STRATEGY_REGISTRY } from '../strategies/index.js';
import { Executor } from './executor.js';
import { PositionTracker } from './position-tracker.js';
import type { SwarmDb } from '../store/db.js';
import { logger } from '../logger.js';

const LAMPORTS_PER_SOL = 1_000_000_000;

export type BotStatus = 'running' | 'paused' | 'stopped' | 'error';

export interface BotConfig {
  id: string;
  name: string;
  strategyName: string;
  strategyParams: Record<string, number | string | boolean>;
  maxBuySol: number;
  maxPositions: number;
  slippageBps: number;
  pollIntervalMs: number;
  watchMints?: string[]; // Specific mints to watch (empty = auto-discover via feeds)
}

interface EvalLoop {
  timer: ReturnType<typeof setInterval> | null;
  feedUnsubscribe?: () => void;
}

/**
 * BotInstance — a single autonomous trading bot running one strategy.
 *
 * Each bot has:
 *  - Its own wallet (Keypair)
 *  - A strategy (from registry)
 *  - An executor (builds + signs + sends TXs)
 *  - A position tracker (records trades, computes P&L)
 *  - A set of mints to evaluate
 *
 * The bot runs a periodic evaluation loop, calling strategy.evaluate()
 * on each tracked mint, and executing trades when signals fire.
 */
export class BotInstance {
  readonly id: string;
  readonly name: string;
  readonly config: BotConfig;
  readonly wallet: Keypair;

  private status: BotStatus = 'stopped';
  private strategy: Strategy;
  private strategyConfig: StrategyConfig;
  private executor: Executor;
  private positionTracker: PositionTracker;
  private onlineSdk: OnlinePumpSdk;
  private db: SwarmDb;
  private loop: EvalLoop = { timer: null };
  private trackedMints = new Set<string>();
  private processingMints = new Set<string>(); // Lock to prevent concurrent evals per mint

  // Callbacks for external event feed
  private onNewToken: ((mint: string) => void) | null = null;

  constructor(opts: {
    config: BotConfig;
    wallet: Keypair;
    connection: Connection;
    db: SwarmDb;
  }) {
    this.id = opts.config.id;
    this.name = opts.config.name;
    this.config = opts.config;
    this.wallet = opts.wallet;
    this.db = opts.db;

    // Resolve strategy from registry
    const factory = STRATEGY_REGISTRY[opts.config.strategyName];
    if (!factory) {
      throw new Error(`Unknown strategy: ${opts.config.strategyName}`);
    }
    this.strategy = factory();

    this.strategyConfig = {
      maxBuySol: opts.config.maxBuySol,
      maxPositions: opts.config.maxPositions,
      slippageBps: opts.config.slippageBps,
      params: opts.config.strategyParams,
    };

    this.executor = new Executor({
      connection: opts.connection,
      wallet: opts.wallet,
      defaultSlippage: opts.config.slippageBps / 10000,
    });

    this.positionTracker = new PositionTracker(opts.db, this.id);
    this.onlineSdk = new OnlinePumpSdk(opts.connection);

    // Pre-populate with explicit watch list
    if (opts.config.watchMints) {
      for (const m of opts.config.watchMints) {
        this.trackedMints.add(m);
      }
    }
  }

  getStatus(): BotStatus {
    return this.status;
  }

  getTrackedMints(): string[] {
    return [...this.trackedMints];
  }

  getPositionTracker(): PositionTracker {
    return this.positionTracker;
  }

  /** Register a callback when the bot wants to listen for new tokens */
  setNewTokenCallback(cb: (mint: string) => void): void {
    this.onNewToken = cb;
  }

  /** Add a mint to the tracked set (called by feed or manually) */
  addMint(mint: string): void {
    this.trackedMints.add(mint);
  }

  /** Remove a mint from tracking */
  removeMint(mint: string): void {
    this.trackedMints.delete(mint);
  }

  /** Start the evaluation loop */
  start(): void {
    if (this.status === 'running') return;
    this.status = 'running';

    this.db.updateBot(this.id, { status: 'running' });
    logger.info(`[${this.id}] Bot "${this.name}" started (strategy: ${this.strategy.name}, wallet: ${this.wallet.publicKey.toBase58().slice(0, 8)}…)`);

    // Start the evaluation loop
    this.loop.timer = setInterval(() => {
      this.evaluateAll().catch(err => {
        logger.error(`[${this.id}] Eval loop error: ${err instanceof Error ? err.message : err}`);
      });
    }, this.config.pollIntervalMs);

    // Run first evaluation immediately
    this.evaluateAll().catch(() => {});
  }

  /** Pause the bot (stop evaluating but keep state) */
  pause(): void {
    if (this.status !== 'running') return;
    this.status = 'paused';
    if (this.loop.timer) {
      clearInterval(this.loop.timer);
      this.loop.timer = null;
    }
    this.db.updateBot(this.id, { status: 'paused' });
    logger.info(`[${this.id}] Bot "${this.name}" paused`);
  }

  /** Resume a paused bot */
  resume(): void {
    if (this.status !== 'paused') return;
    this.start();
  }

  /** Stop the bot completely */
  stop(): void {
    this.status = 'stopped';
    if (this.loop.timer) {
      clearInterval(this.loop.timer);
      this.loop.timer = null;
    }
    if (this.loop.feedUnsubscribe) {
      this.loop.feedUnsubscribe();
    }
    this.db.updateBot(this.id, { status: 'stopped' });
    logger.info(`[${this.id}] Bot "${this.name}" stopped`);
  }

  /** Emergency: sell all open positions and stop */
  async emergencyExit(): Promise<void> {
    logger.warn(`[${this.id}] EMERGENCY EXIT — selling all positions`);
    this.pause(); // Stop evaluating

    const positions = this.positionTracker.getOpenPositions();
    for (const pos of positions) {
      try {
        const mint = new PublicKey(pos.mint);
        const result = await this.executor.sellAll(mint);
        this.positionTracker.recordSell(pos.mint, result);
      } catch (err) {
        logger.error(`[${this.id}] Emergency sell failed for ${pos.mint}: ${err instanceof Error ? err.message : err}`);
      }
    }

    this.stop();
    logger.warn(`[${this.id}] Emergency exit complete`);
  }

  /** Run one evaluation cycle across all tracked mints */
  private async evaluateAll(): Promise<void> {
    if (this.status !== 'running') return;

    const mints = [...this.trackedMints];
    const openPositions = this.positionTracker.getOpenPositions();

    // Also track mints we have open positions in
    for (const pos of openPositions) {
      if (!this.trackedMints.has(pos.mint)) {
        mints.push(pos.mint);
      }
    }

    // Evaluate in parallel batches (max 5 concurrent)
    const batchSize = 5;
    for (let i = 0; i < mints.length; i += batchSize) {
      const batch = mints.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(m => this.evaluateMint(m)));
    }

    // Periodic PnL snapshot
    this.positionTracker.snapshotPnl();
  }

  /** Evaluate a single mint — fetch state, run strategy, execute if needed */
  private async evaluateMint(mint: string): Promise<void> {
    // Prevent concurrent evaluation of same mint
    if (this.processingMints.has(mint)) return;
    this.processingMints.add(mint);

    try {
      const snapshot = await this.fetchSnapshot(mint);
      if (!snapshot) {
        this.trackedMints.delete(mint); // Couldn't fetch — remove
        return;
      }

      // Check if strategy wants to track this token
      if (!this.strategy.shouldTrack(snapshot, this.strategyConfig)) {
        // If no open position, stop tracking
        const pos = this.positionTracker.getPosition(mint);
        if (!pos) {
          this.trackedMints.delete(mint);
          return;
        }
      }

      // Get current position size in SOL
      const pos = this.positionTracker.getPosition(mint);
      const openPositionSol = pos ? pos.entrySol : null;

      // Check max positions limit
      const openCount = this.positionTracker.getOpenPositions().length;

      // Get signal from strategy
      const signal = this.strategy.evaluate(snapshot, openPositionSol, this.strategyConfig);

      // Update price in position tracker
      const pricePerToken = snapshot.pricePerToken.toNumber() / LAMPORTS_PER_SOL;
      this.positionTracker.updatePrice(mint, pricePerToken);

      // Execute signal
      await this.executeSignal(signal, openCount);
    } catch (err) {
      logger.debug(`[${this.id}] Eval ${mint.slice(0, 8)}… error: ${err instanceof Error ? err.message : err}`);
    } finally {
      this.processingMints.delete(mint);
    }
  }

  /** Execute a trade signal */
  private async executeSignal(signal: TradeSignal, openPositionCount: number): Promise<void> {
    if (signal.action === 'hold') return;

    const mintPk = new PublicKey(signal.mint);

    if (signal.action === 'buy') {
      // Check max positions
      if (openPositionCount >= this.strategyConfig.maxPositions) {
        logger.debug(`[${this.id}] Skipping buy — max positions reached (${openPositionCount}/${this.strategyConfig.maxPositions})`);
        return;
      }

      // Check SOL balance
      const balance = await this.executor.getSolBalance();
      const buySol = signal.solAmount ?? new BN(Math.floor(this.strategyConfig.maxBuySol * LAMPORTS_PER_SOL));

      if (balance.lt(buySol.muln(2))) { // Keep 2x buffer for rent & fees
        logger.warn(`[${this.id}] Skipping buy — insufficient balance (${(balance.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL)`);
        return;
      }

      logger.info(`[${this.id}] SIGNAL: BUY ${signal.mint.slice(0, 8)}… — ${signal.reason} (urgency: ${signal.urgency})`);
      const result = await this.executor.buy(mintPk, buySol, this.strategyConfig.slippageBps / 10000);
      this.positionTracker.recordBuy(signal.mint, result);
    }

    if (signal.action === 'sell') {
      const pos = this.positionTracker.getPosition(signal.mint);
      const tokenAmount = signal.tokenAmount ?? (pos ? pos.tokenAmount : undefined);

      logger.info(`[${this.id}] SIGNAL: SELL ${signal.mint.slice(0, 8)}… — ${signal.reason} (urgency: ${signal.urgency})`);
      const result = await this.executor.sell(mintPk, tokenAmount, this.strategyConfig.slippageBps / 10000);
      this.positionTracker.recordSell(signal.mint, result);

      // Remove from tracking if fully sold
      const updatedPos = this.positionTracker.getPosition(signal.mint);
      if (!updatedPos) {
        this.trackedMints.delete(signal.mint);
      }
    }
  }

  /** Fetch a TokenSnapshot for strategy evaluation */
  private async fetchSnapshot(mint: string): Promise<TokenSnapshot | null> {
    try {
      const mintPk = new PublicKey(mint);
      const [bondingCurve, global] = await Promise.all([
        this.onlineSdk.fetchBondingCurve(mintPk),
        this.onlineSdk.fetchGlobal(),
      ]);

      const mintSupply = bondingCurve.tokenTotalSupply;
      const mcap = bondingCurveMarketCap({
        mintSupply,
        virtualSolReserves: bondingCurve.virtualSolReserves,
        virtualTokenReserves: bondingCurve.virtualTokenReserves,
      });

      const grad = getGraduationProgress(global, bondingCurve);

      // Compute price per token (SOL per 1 raw token unit)
      const pricePerToken = bondingCurve.virtualSolReserves
        .mul(mintSupply)
        .div(bondingCurve.virtualTokenReserves)
        .div(mintSupply);

      // Estimate age from reserves (newer tokens have higher virtual ratios)
      // We don't have exact creation time without API, use 0 for now
      const ageSec = 0; // Will be updated by token feed

      return {
        mint,
        marketCapLamports: mcap,
        pricePerToken: bondingCurve.virtualSolReserves.mul(new BN(1_000_000)).div(bondingCurve.virtualTokenReserves),
        virtualSolReserves: bondingCurve.virtualSolReserves,
        virtualTokenReserves: bondingCurve.virtualTokenReserves,
        realSolReserves: bondingCurve.realSolReserves,
        realTokenReserves: bondingCurve.realTokenReserves,
        complete: bondingCurve.complete,
        progressBps: grad.progressBps,
        ageSec,
      };
    } catch {
      return null;
    }
  }
}
