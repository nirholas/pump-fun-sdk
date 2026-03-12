// ── Lair-TG — Data Sources ────────────────────────────────────────
//
// Aggregates token data from multiple DeFi APIs.
// Each source implements the DataSource interface.

import { log } from './logger.js';
import type { DataSource, TokenInfo } from './types.js';

/** DexScreener data source. */
export class DexScreenerSource implements DataSource {
  readonly name = 'DexScreener';

  async fetchToken(address: string): Promise<TokenInfo | null> {
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        pairs?: Array<{
          baseToken: { address: string; symbol: string; name: string };
          priceUsd?: string;
          fdv?: number;
          volume?: { h24?: number };
          priceChange?: { h24?: number };
        }>;
      };
      const pair = data.pairs?.[0];
      if (!pair) return null;
      return {
        address: pair.baseToken.address,
        symbol: pair.baseToken.symbol,
        name: pair.baseToken.name,
        decimals: 9,
        priceUsd: pair.priceUsd ? Number(pair.priceUsd) : null,
        marketCapUsd: pair.fdv ?? null,
        volume24h: pair.volume?.h24 ?? null,
        priceChange24h: pair.priceChange?.h24 ?? null,
      };
    } catch (err) {
      log.warn('DexScreener fetch failed for %s: %s', address, err);
      return null;
    }
  }
}

/** Aggregate across all sources, returning the first successful result. */
export class DataAggregator {
  private readonly sources: DataSource[];

  constructor(sources?: DataSource[]) {
    this.sources = sources ?? [new DexScreenerSource()];
  }

  async fetchToken(address: string): Promise<TokenInfo | null> {
    for (const source of this.sources) {
      const result = await source.fetchToken(address);
      if (result) return result;
    }
    return null;
  }
}
