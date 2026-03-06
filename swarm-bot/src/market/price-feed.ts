import { Connection, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { OnlinePumpSdk } from '@pump-fun/pump-sdk';
import { bondingCurveMarketCap, getGraduationProgress } from '@pump-fun/pump-sdk';
import { EventEmitter } from 'events';
import { logger } from '../logger.js';

const LAMPORTS_PER_SOL = 1_000_000_000;

export interface PriceUpdate {
  mint: string;
  marketCapLamports: BN;
  pricePerTokenLamports: BN;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
  progressBps: number;
  complete: boolean;
  timestamp: number;
}

/**
 * PriceFeed — polls bonding curve state for tracked mints and emits price updates.
 *
 * Emits:
 *  - 'price' (PriceUpdate) for each mint update
 *  - 'graduation' ({ mint: string }) when a token graduates
 *
 * Design: Batches multiple mints per poll cycle using getMultipleAccountsInfo
 * for efficiency (one RPC call per batch of 100 accounts).
 */
export class PriceFeed extends EventEmitter {
  private connection: Connection;
  private onlineSdk: OnlinePumpSdk;
  private trackedMints = new Set<string>();
  private graduatedMints = new Set<string>();
  private pollInterval: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private batchSize: number;

  constructor(opts: {
    connection: Connection;
    pollIntervalMs?: number;
    batchSize?: number;
  }) {
    super();
    this.connection = opts.connection;
    this.onlineSdk = new OnlinePumpSdk(opts.connection);
    this.pollInterval = opts.pollIntervalMs ?? 5000;
    this.batchSize = opts.batchSize ?? 20; // Poll 20 mints per cycle
  }

  /** Add a mint to track */
  track(mint: string): void {
    this.trackedMints.add(mint);
  }

  /** Remove a mint from tracking */
  untrack(mint: string): void {
    this.trackedMints.delete(mint);
  }

  /** Check if a mint is being tracked */
  isTracking(mint: string): boolean {
    return this.trackedMints.has(mint);
  }

  /** Number of mints being tracked */
  get trackCount(): number {
    return this.trackedMints.size;
  }

  /** Start the price polling loop */
  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info(`PriceFeed started — tracking ${this.trackedMints.size} mints`);

    this.timer = setInterval(() => {
      this.pollAll().catch(err => {
        logger.warn(`PriceFeed poll error: ${err instanceof Error ? err.message : err}`);
      });
    }, this.pollInterval);
  }

  /** Stop polling */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('PriceFeed stopped');
  }

  /** Poll all tracked mints */
  private async pollAll(): Promise<void> {
    const mints = [...this.trackedMints];
    if (mints.length === 0) return;

    // Process in batches
    for (let i = 0; i < mints.length; i += this.batchSize) {
      const batch = mints.slice(i, i + this.batchSize);
      await this.pollBatch(batch);
    }
  }

  /** Poll a batch of mints */
  private async pollBatch(mints: string[]): Promise<void> {
    // Fetch bonding curve state for each mint
    // We could optimize further with getMultipleAccountsInfo, but
    // OnlinePumpSdk.fetchBondingCurve does PDA derivation for us
    const results = await Promise.allSettled(
      mints.map(async (mint) => {
        const mintPk = new PublicKey(mint);
        const [bondingCurve, global] = await Promise.all([
          this.onlineSdk.fetchBondingCurve(mintPk),
          this.onlineSdk.fetchGlobal(),
        ]);

        const mcap = bondingCurveMarketCap({
          mintSupply: bondingCurve.tokenTotalSupply,
          virtualSolReserves: bondingCurve.virtualSolReserves,
          virtualTokenReserves: bondingCurve.virtualTokenReserves,
        });

        const grad = getGraduationProgress(global, bondingCurve);
        const pricePerToken = bondingCurve.virtualSolReserves
          .mul(new BN(1_000_000))
          .div(bondingCurve.virtualTokenReserves);

        const update: PriceUpdate = {
          mint,
          marketCapLamports: mcap,
          pricePerTokenLamports: pricePerToken,
          virtualSolReserves: bondingCurve.virtualSolReserves,
          virtualTokenReserves: bondingCurve.virtualTokenReserves,
          progressBps: grad.progressBps,
          complete: bondingCurve.complete,
          timestamp: Date.now(),
        };

        this.emit('price', update);

        // Detect graduation
        if (bondingCurve.complete && !this.graduatedMints.has(mint)) {
          this.graduatedMints.add(mint);
          this.emit('graduation', { mint });
          logger.info(`PriceFeed: Token ${mint.slice(0, 8)}… graduated`);
        }

        return update;
      })
    );

    // Log failures
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        const reason = (results[i] as PromiseRejectedResult).reason;
        logger.debug(`PriceFeed: Failed to fetch ${mints[i].slice(0, 8)}… — ${reason}`);
      }
    }
  }
}
