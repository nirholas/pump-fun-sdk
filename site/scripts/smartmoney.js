/**
 * Smart Money Data Service
 * Aggregates data from free APIs: DexScreener, GeckoTerminal, CoinGecko
 * No API keys required!
 */

const SmartMoneyService = {
    // Configuration
    config: {
        // DexScreener (FREE, no key)
        dexscreener: {
            baseUrl: 'https://api.dexscreener.com'
        },
        // GeckoTerminal (FREE, no key) - CoinGecko's DEX tracker
        geckoterminal: {
            baseUrl: 'https://api.geckoterminal.com/api/v2'
        },
        // CoinGecko (FREE tier, no key for basic)
        coingecko: {
            baseUrl: 'https://api.coingecko.com/api/v3'
        },
        // Jupiter (Solana DEX aggregator, FREE)
        jupiter: {
            baseUrl: 'https://token.jup.ag'
        },
        // Optional: GMGN proxy for smart money data
        proxyUrl: null,
        // Cache duration in ms
        cacheDuration: 30000 // 30 seconds
    },

    // Cache storage
    cache: new Map(),

    /**
     * Initialize the service
     */
    init(options = {}) {
        if (options.proxyUrl) this.config.proxyUrl = options.proxyUrl;
        console.log('[SmartMoney] Service initialized (Free APIs mode)');
        return this;
    },

    /**
     * Get cached data or fetch new
     */
    async getCached(key, fetchFn, duration = this.config.cacheDuration) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < duration) {
            return cached.data;
        }
        try {
            const data = await fetchFn();
            this.cache.set(key, { data, timestamp: Date.now() });
            return data;
        } catch (err) {
            if (cached) return cached.data;
            throw err;
        }
    },

    // ==========================================
    // DexScreener API (FREE, no key required)
    // ==========================================

    /**
     * Get trending/new token pairs
     */
    async getTrendingTokens(chain = 'solana') {
        return this.getCached(`dex_trending_${chain}`, async () => {
            const res = await fetch(`${this.config.dexscreener.baseUrl}/token-profiles/latest/v1`);
            if (!res.ok) throw new Error('DexScreener API error');
            const data = await res.json();
            // Filter by chain
            return data.filter(t => t.chainId === chain).slice(0, 20);
        });
    },

    /**
     * Search tokens on DexScreener
     */
    async searchTokens(query) {
        return this.getCached(`dex_search_${query}`, async () => {
            const res = await fetch(`${this.config.dexscreener.baseUrl}/latest/dex/search?q=${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error('DexScreener search error');
            const data = await res.json();
            return data.pairs || [];
        });
    },

    /**
     * Get token pair data
     */
    async getTokenPairs(tokenAddress) {
        return this.getCached(`dex_pairs_${tokenAddress}`, async () => {
            const res = await fetch(`${this.config.dexscreener.baseUrl}/latest/dex/tokens/${tokenAddress}`);
            if (!res.ok) throw new Error('DexScreener token error');
            const data = await res.json();
            return data.pairs || [];
        });
    },

    // ==========================================
    // GeckoTerminal API (FREE, no key required)
    // Best for DEX data and recent trades
    // ==========================================

    /**
     * Get trending pools on a network
     */
    async getTrendingPools(network = 'solana') {
        return this.getCached(`gecko_trending_${network}`, async () => {
            const res = await fetch(`${this.config.geckoterminal.baseUrl}/networks/${network}/trending_pools`);
            if (!res.ok) throw new Error('GeckoTerminal API error');
            const data = await res.json();
            return data.data || [];
        });
    },

    /**
     * Get new pools (recent launches)
     */
    async getNewPools(network = 'solana') {
        return this.getCached(`gecko_new_${network}`, async () => {
            const res = await fetch(`${this.config.geckoterminal.baseUrl}/networks/${network}/new_pools`);
            if (!res.ok) throw new Error('GeckoTerminal new pools error');
            const data = await res.json();
            return data.data || [];
        });
    },

    /**
     * Get recent trades for a pool (shows wallet activity!)
     */
    async getPoolTrades(network, poolAddress) {
        return this.getCached(`gecko_trades_${poolAddress}`, async () => {
            const res = await fetch(`${this.config.geckoterminal.baseUrl}/networks/${network}/pools/${poolAddress}/trades`);
            if (!res.ok) throw new Error('GeckoTerminal trades error');
            const data = await res.json();
            return data.data || [];
        }, 15000); // 15s cache for trades
    },

    /**
     * Get top pools by volume
     */
    async getTopPools(network = 'solana', page = 1) {
        return this.getCached(`gecko_top_${network}_${page}`, async () => {
            const res = await fetch(`${this.config.geckoterminal.baseUrl}/networks/${network}/pools?page=${page}`);
            if (!res.ok) throw new Error('GeckoTerminal pools error');
            const data = await res.json();
            return data.data || [];
        });
    },

    /**
     * Get OHLCV data for a pool
     */
    async getPoolOHLCV(network, poolAddress, timeframe = 'hour') {
        return this.getCached(`gecko_ohlcv_${poolAddress}_${timeframe}`, async () => {
            const res = await fetch(`${this.config.geckoterminal.baseUrl}/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}`);
            if (!res.ok) throw new Error('GeckoTerminal OHLCV error');
            const data = await res.json();
            return data.data?.attributes?.ohlcv_list || [];
        });
    },

    // ==========================================
    // CoinGecko API (FREE tier)
    // ==========================================

    /**
     * Get trending coins
     */
    async getCGTrending() {
        return this.getCached('cg_trending', async () => {
            const res = await fetch(`${this.config.coingecko.baseUrl}/search/trending`);
            if (!res.ok) throw new Error('CoinGecko trending error');
            const data = await res.json();
            return data.coins || [];
        }, 60000); // 1 min cache
    },

    /**
     * Get global market data
     */
    async getGlobalData() {
        return this.getCached('cg_global', async () => {
            const res = await fetch(`${this.config.coingecko.baseUrl}/global`);
            if (!res.ok) throw new Error('CoinGecko global error');
            return (await res.json()).data;
        }, 60000);
    },

    // ==========================================
    // Aggregated Smart Money Analysis
    // Uses trade data to identify active wallets
    // ==========================================

    /**
     * Analyze wallet activity from recent trades
     * This extracts "smart money" patterns from trade data
     */
    async analyzeTopTraders(network = 'solana', limit = 10) {
        try {
            // Get trending pools
            const pools = await this.getTrendingPools(network);
            const topPools = pools.slice(0, 5);

            // Collect trades from top pools
            const allTrades = [];
            for (const pool of topPools) {
                try {
                    const trades = await this.getPoolTrades(network, pool.attributes.address);
                    allTrades.push(...trades.map(t => ({
                        ...t.attributes,
                        poolName: pool.attributes.name,
                        poolAddress: pool.attributes.address
                    })));
                } catch (e) {
                    console.warn('Failed to get trades for pool:', pool.attributes.address);
                }
            }

            // Aggregate by wallet address
            const walletStats = {};
            allTrades.forEach(trade => {
                const wallet = trade.tx_from_address;
                if (!walletStats[wallet]) {
                    walletStats[wallet] = {
                        address: wallet,
                        trades: 0,
                        buys: 0,
                        sells: 0,
                        volume: 0,
                        tokens: new Set(),
                        lastTrade: null
                    };
                }
                walletStats[wallet].trades++;
                walletStats[wallet].volume += parseFloat(trade.volume_in_usd || 0);
                walletStats[wallet].tokens.add(trade.from_token_address);
                walletStats[wallet].tokens.add(trade.to_token_address);
                
                if (trade.kind === 'buy') walletStats[wallet].buys++;
                else walletStats[wallet].sells++;

                const tradeTime = new Date(trade.block_timestamp).getTime();
                if (!walletStats[wallet].lastTrade || tradeTime > walletStats[wallet].lastTrade) {
                    walletStats[wallet].lastTrade = tradeTime;
                }
            });

            // Convert to array and sort by volume
            const wallets = Object.values(walletStats)
                .map(w => ({
                    ...w,
                    tokens: w.tokens.size,
                    winRate: w.trades > 0 ? w.buys / w.trades : 0
                }))
                .sort((a, b) => b.volume - a.volume)
                .slice(0, limit);

            return { wallets, totalTrades: allTrades.length };
        } catch (err) {
            console.error('[SmartMoney] analyzeTopTraders error:', err);
            return { wallets: [], totalTrades: 0, error: err.message };
        }
    },

    /**
     * Get hot tokens with smart money activity
     */
    async getHotTokens(network = 'solana') {
        try {
            const [trending, newPools] = await Promise.all([
                this.getTrendingPools(network),
                this.getNewPools(network)
            ]);

            // Combine and dedupe
            const seen = new Set();
            const tokens = [];

            [...trending, ...newPools].forEach(pool => {
                const addr = pool.attributes?.address;
                if (addr && !seen.has(addr)) {
                    seen.add(addr);
                    const attr = pool.attributes;
                    tokens.push({
                        address: addr,
                        name: attr.name,
                        price: attr.base_token_price_usd,
                        priceChange: attr.price_change_percentage,
                        volume24h: attr.volume_usd?.h24,
                        txns24h: (attr.transactions?.h24?.buys || 0) + (attr.transactions?.h24?.sells || 0),
                        liquidity: attr.reserve_in_usd,
                        fdv: attr.fdv_usd,
                        createdAt: attr.pool_created_at,
                        isTrending: trending.some(t => t.attributes?.address === addr),
                        isNew: newPools.some(t => t.attributes?.address === addr)
                    });
                }
            });

            return tokens.slice(0, 30);
        } catch (err) {
            console.error('[SmartMoney] getHotTokens error:', err);
            return [];
        }
    },

    /**
     * Track a specific wallet's recent activity
     */
    async trackWalletActivity(walletAddress, network = 'solana') {
        // Note: GeckoTerminal doesn't have wallet-specific endpoints
        // This would need to scan recent trades to find the wallet
        // For now, return what we can find in cached trade data
        
        const result = {
            address: walletAddress,
            recentTrades: [],
            tokensTraded: new Set()
        };

        // Check cached trades
        for (const [key, cached] of this.cache) {
            if (key.startsWith('gecko_trades_')) {
                const trades = cached.data || [];
                trades.forEach(t => {
                    if (t.attributes?.tx_from_address === walletAddress) {
                        result.recentTrades.push(t.attributes);
                        result.tokensTraded.add(t.attributes.from_token_address);
                        result.tokensTraded.add(t.attributes.to_token_address);
                    }
                });
            }
        }

        result.tokensTraded = result.tokensTraded.size;
        return result;
    },

    // ==========================================
    // Helper Methods
    // ==========================================

    formatAddress(address, length = 4) {
        if (!address || address.length < 10) return address;
        return `${address.slice(0, length)}...${address.slice(-length)}`;
    },

    formatCurrency(value, decimals = 2) {
        if (!value) return '$0';
        value = parseFloat(value);
        if (value >= 1e9) return `$${(value / 1e9).toFixed(decimals)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(decimals)}M`;
        if (value >= 1e3) return `$${(value / 1e3).toFixed(decimals)}K`;
        return `$${value.toFixed(decimals)}`;
    },

    formatPercent(value, decimals = 1) {
        if (!value) return '0%';
        const num = parseFloat(value);
        const sign = num >= 0 ? '+' : '';
        return `${sign}${num.toFixed(decimals)}%`;
    }
};

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartMoneyService;
}
if (typeof window !== 'undefined') {
    window.SmartMoneyService = SmartMoneyService;
}
