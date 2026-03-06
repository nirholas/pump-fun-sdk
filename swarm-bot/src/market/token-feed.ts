import { EventEmitter } from 'events';
import { logger } from '../logger.js';

const PUMP_API = 'https://frontend-api-v3.pump.fun';

export interface TokenLaunch {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  imageUri: string | null;
  description: string | null;
  marketCapSol: number;
  createdTimestamp: number;
  complete: boolean;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
}

/**
 * TokenFeed — detects new token launches by polling the PumpFun HTTP API.
 *
 * Emits:
 *  - 'token' (TokenLaunch) for each newly detected token
 *  - 'error' (Error) on fetch failures
 *
 * Design: Polls GET /coins?sort=created_timestamp&order=DESC every pollIntervalMs.
 * Tracks seen mints to avoid duplicate emissions. This is the same approach
 * used by the websocket-server's solana-monitor.ts (proven reliable).
 */
export class TokenFeed extends EventEmitter {
  private pollInterval: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private seenMints = new Set<string>();
  private running = false;
  private fetchTimeout: number;

  constructor(opts?: { pollIntervalMs?: number; fetchTimeoutMs?: number }) {
    super();
    this.pollInterval = opts?.pollIntervalMs ?? 5000;
    this.fetchTimeout = opts?.fetchTimeoutMs ?? 10000;
  }

  /** Start polling for new tokens */
  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('TokenFeed started — polling PumpFun API');

    // First poll immediately
    this.poll().catch(() => {});

    this.timer = setInterval(() => {
      this.poll().catch(() => {});
    }, this.pollInterval);
  }

  /** Stop polling */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('TokenFeed stopped');
  }

  /** Get the number of tokens seen in this session */
  get seenCount(): number {
    return this.seenMints.size;
  }

  /** Check if a mint has been seen */
  hasSeen(mint: string): boolean {
    return this.seenMints.has(mint);
  }

  private async poll(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.fetchTimeout);

      const url = `${PUMP_API}/coins?offset=0&limit=50&sort=created_timestamp&order=DESC&includeNsfw=true`;
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        throw new Error(`API returned ${resp.status}`);
      }

      const coins: Array<Record<string, unknown>> = await resp.json() as Array<Record<string, unknown>>;

      let newCount = 0;
      for (const coin of coins) {
        const mint = coin.mint as string;
        if (!mint || this.seenMints.has(mint)) continue;

        this.seenMints.add(mint);
        newCount++;

        const launch: TokenLaunch = {
          mint,
          name: (coin.name as string) ?? '',
          symbol: (coin.symbol as string) ?? '',
          creator: (coin.creator as string) ?? '',
          imageUri: (coin.image_uri as string) ?? null,
          description: (coin.description as string)?.slice(0, 200) ?? null,
          marketCapSol: (coin.market_cap_sol as number) ?? (coin.market_cap as number) ?? 0,
          createdTimestamp: (coin.created_timestamp as number) ?? Date.now(),
          complete: (coin.complete as boolean) ?? false,
          virtualSolReserves: (coin.virtual_sol_reserves as number) ?? 0,
          virtualTokenReserves: (coin.virtual_token_reserves as number) ?? 0,
          website: (coin.website as string) ?? null,
          twitter: (coin.twitter as string) ?? null,
          telegram: (coin.telegram as string) ?? null,
        };

        this.emit('token', launch);
      }

      if (newCount > 0) {
        logger.debug(`TokenFeed: ${newCount} new tokens detected (total seen: ${this.seenMints.size})`);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.warn('TokenFeed: request timed out');
      } else {
        logger.warn(`TokenFeed poll error: ${err instanceof Error ? err.message : err}`);
      }
      this.emit('error', err);
    }
  }
}
