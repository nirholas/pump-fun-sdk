/**
 * Smart Money Widget Component
 * Displays top wallets, trending tokens, and signals
 * Uses FREE APIs: DexScreener, GeckoTerminal, CoinGecko (no API keys!)
 */

const SmartMoneyWidget = {
    // Widget state
    state: {
        isLoading: true,
        wallets: [],
        hotTokens: [],
        trending: [],
        trackedWallets: [],
        activeTab: 'hot-tokens',
        error: null
    },

    // Configuration
    config: {
        refreshInterval: 30000, // 30 seconds
        maxItems: 20,
        network: 'solana'
    },

    // DOM element reference
    container: null,

    /**
     * Initialize widget
     */
    init(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('[SmartMoneyWidget] Container not found:', containerId);
            return;
        }

        // Merge options
        Object.assign(this.config, options);

        // Load tracked wallets from localStorage
        try {
            const saved = localStorage.getItem('smartmoney_tracked');
            if (saved) this.state.trackedWallets = JSON.parse(saved);
        } catch (e) {}

        // Initialize SmartMoneyService
        if (window.SmartMoneyService) {
            window.SmartMoneyService.init();
        }

        // Render initial UI
        this.render();

        // Load data
        this.loadData();

        // Set up auto-refresh
        if (this.config.refreshInterval > 0) {
            setInterval(() => this.loadData(), this.config.refreshInterval);
        }

        return this;
    },

    /**
     * Load all data from FREE APIs
     */
    async loadData() {
        this.state.isLoading = true;
        this.updateLoadingState();

        const service = window.SmartMoneyService;
        if (!service) {
            this.state.error = 'SmartMoneyService not loaded';
            this.state.isLoading = false;
            this.render();
            return;
        }

        try {
            // Load data in parallel from free APIs
            const [hotTokens, topTraders, cgTrending] = await Promise.all([
                service.getHotTokens(this.config.network).catch(e => []),
                service.analyzeTopTraders(this.config.network, 15).catch(e => ({ wallets: [] })),
                service.getCGTrending().catch(e => [])
            ]);

            this.state.hotTokens = hotTokens;
            this.state.wallets = topTraders.wallets || [];
            this.state.trending = cgTrending;
            this.state.error = null;

        } catch (err) {
            console.error('[SmartMoneyWidget] Error loading data:', err);
            this.state.error = err.message;
        }

        this.state.isLoading = false;
        this.render();
    },

    /**
     * Render the widget
     */
    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="smart-money-widget">
                <div class="smw-header">
                    <div class="smw-title">
                        <span class="smw-icon">🔥</span>
                        <span>Smart Money</span>
                        <span class="smw-live-dot"></span>
                    </div>
                    <div class="smw-tabs">
                        <button class="smw-tab ${this.state.activeTab === 'hot-tokens' ? 'active' : ''}" data-tab="hot-tokens">
                            Hot Tokens
                        </button>
                        <button class="smw-tab ${this.state.activeTab === 'top-wallets' ? 'active' : ''}" data-tab="top-wallets">
                            Wallets
                        </button>
                        <button class="smw-tab ${this.state.activeTab === 'trending' ? 'active' : ''}" data-tab="trending">
                            Trending
                        </button>
                    </div>
                </div>
                
                <div class="smw-content">
                    ${this.state.error ? this.renderError() : ''}
                    ${this.renderTabContent()}
                </div>
                
                <div class="smw-footer">
                    <span class="smw-source">Free: DexScreener • GeckoTerminal</span>
                    <button class="smw-refresh" title="Refresh">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
                        </svg>
                    </button>
                </div>
            </div>
            <style>${this.getStyles()}</style>
        `;

        this.attachEventListeners();
    },

    /**
     * Render tab content based on active tab
     */
    renderTabContent() {
        if (this.state.isLoading) {
            return this.renderSkeleton();
        }

        switch (this.state.activeTab) {
            case 'hot-tokens':
                return this.renderHotTokens();
            case 'top-wallets':
                return this.renderWalletsList();
            case 'trending':
                return this.renderTrendingList();
            default:
                return '';
        }
    },

    /**
     * Render hot tokens list
     */
    renderHotTokens() {
        if (!this.state.hotTokens.length) {
            return '<div class="smw-empty">Loading hot tokens...</div>';
        }

        return `
            <div class="smw-tokens-list">
                ${this.state.hotTokens.slice(0, 10).map((token, i) => `
                    <div class="smw-token-item" data-address="${token.address}">
                        <div class="smw-token-rank">#${i + 1}</div>
                        <div class="smw-token-info">
                            <div class="smw-token-name">${this.truncate(token.name, 20)}</div>
                            <div class="smw-token-meta">
                                ${token.isTrending ? '<span class="smw-badge trending">🔥</span>' : ''}
                                ${token.isNew ? '<span class="smw-badge new">NEW</span>' : ''}
                                <span class="smw-token-txns">${this.formatNumber(token.txns24h)} txns</span>
                            </div>
                        </div>
                        <div class="smw-token-stats">
                            <div class="smw-stat">
                                <span class="smw-stat-value ${parseFloat(token.priceChange?.h24 || 0) >= 0 ? 'positive' : 'negative'}">
                                    ${this.formatPercent(token.priceChange?.h24)}
                                </span>
                            </div>
                            <div class="smw-stat">
                                <span class="smw-stat-label">Vol</span>
                                <span class="smw-stat-value">${this.formatCurrency(token.volume24h)}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Render wallets list (from trade analysis)
     */
    renderWalletsList() {
        if (!this.state.wallets.length) {
            return '<div class="smw-empty">Analyzing wallet activity...</div>';
        }

        return `
            <div class="smw-wallets-list">
                ${this.state.wallets.slice(0, 10).map((wallet, i) => `
                    <div class="smw-wallet-item" data-address="${wallet.address}">
                        <div class="smw-wallet-rank">#${i + 1}</div>
                        <div class="smw-wallet-info">
                            <div class="smw-wallet-address" title="${wallet.address}">
                                ${this.formatAddress(wallet.address)}
                            </div>
                            <div class="smw-wallet-meta">
                                <span>${wallet.trades} trades</span>
                                <span>•</span>
                                <span>${wallet.tokens} tokens</span>
                            </div>
                        </div>
                        <div class="smw-wallet-stats">
                            <div class="smw-stat">
                                <span class="smw-stat-label">Vol</span>
                                <span class="smw-stat-value">${this.formatCurrency(wallet.volume)}</span>
                            </div>
                            <div class="smw-stat">
                                <span class="smw-stat-label">Buy%</span>
                                <span class="smw-stat-value">${(wallet.winRate * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                        <button class="smw-copy-btn" data-address="${wallet.address}" title="Copy address">
                            📋
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Render CoinGecko trending
     */
    renderTrendingList() {
        if (!this.state.trending.length) {
            return '<div class="smw-empty">Loading trending coins...</div>';
        }

        return `
            <div class="smw-trending-list">
                ${this.state.trending.slice(0, 10).map((item, i) => `
                    <div class="smw-trending-item">
                        <div class="smw-trending-rank">#${i + 1}</div>
                        <img class="smw-trending-icon" src="${item.item?.small || ''}" alt="" onerror="this.style.display='none'">
                        <div class="smw-trending-info">
                            <div class="smw-trending-name">${item.item?.name || 'Unknown'}</div>
                            <div class="smw-trending-symbol">${item.item?.symbol || ''}</div>
                        </div>
                        <div class="smw-trending-mcap">
                            ${item.item?.market_cap_rank ? `#${item.item.market_cap_rank}` : '-'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Render loading skeleton
     */
    renderSkeleton() {
        return `
            <div class="smw-skeleton-list">
                ${Array(5).fill().map(() => `
                    <div class="smw-skeleton-item">
                        <div class="smw-skeleton smw-skeleton-rank"></div>
                        <div class="smw-skeleton smw-skeleton-address"></div>
                        <div class="smw-skeleton smw-skeleton-stats"></div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Render error message
     */
    renderError() {
        return `
            <div class="smw-error">
                <span>⚠️ ${this.state.error}</span>
            </div>
        `;
    },

    /**
     * Update loading state indicator
     */
    updateLoadingState() {
        const refreshBtn = this.container?.querySelector('.smw-refresh');
        if (refreshBtn) {
            refreshBtn.classList.toggle('loading', this.state.isLoading);
        }
    },

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Tab switching
        this.container.querySelectorAll('.smw-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.state.activeTab = tab.dataset.tab;
                this.render();
            });
        });

        // Refresh button
        const refreshBtn = this.container.querySelector('.smw-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadData());
        }

        // Copy wallet buttons
        this.container.querySelectorAll('.smw-copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(btn.dataset.address);
                this.showToast('Address copied!');
            });
        });

        // Token item click (open on DexScreener)
        this.container.querySelectorAll('.smw-token-item').forEach(item => {
            item.addEventListener('click', () => {
                const addr = item.dataset.address;
                window.open(`https://dexscreener.com/solana/${addr}`, '_blank');
            });
        });

        // Wallet item click (copy address)
        this.container.querySelectorAll('.smw-wallet-item').forEach(item => {
            item.addEventListener('click', () => {
                navigator.clipboard.writeText(item.dataset.address);
                this.showToast('Address copied!');
            });
        });
    },

    /**
     * Show toast notification
     */
    showToast(message) {
        const existing = this.container.querySelector('.smw-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'smw-toast';
        toast.textContent = message;
        this.container.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    },

    // ==========================================
    // Helper Methods
    // ==========================================

    formatAddress(address) {
        if (!address || address.length < 10) return address;
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    },

    formatCurrency(value) {
        if (!value) return '$0';
        value = parseFloat(value);
        if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
        if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
        return `$${value.toFixed(0)}`;
    },

    formatPercent(value) {
        if (!value) return '0%';
        const num = parseFloat(value);
        const sign = num >= 0 ? '+' : '';
        return `${sign}${num.toFixed(1)}%`;
    },

    formatNumber(value) {
        if (!value) return '0';
        value = parseInt(value);
        if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
        if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
        return value.toString();
    },

    truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.slice(0, len) + '...' : str;
    },

    formatTime(timestamp) {
        if (!timestamp) return '';
        const diff = (Date.now() - new Date(timestamp).getTime()) / 1000 / 60;
        if (diff < 1) return 'Just now';
        if (diff < 60) return `${Math.floor(diff)}m ago`;
        if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
        return `${Math.floor(diff / 1440)}d ago`;
    },

    // ==========================================
    // Styles
    // ==========================================

    getStyles() {
        return `
            .smart-money-widget {
                background: rgba(15, 15, 25, 0.95);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                overflow: hidden;
                font-family: 'Inter', -apple-system, sans-serif;
                position: relative;
            }

            .smw-header {
                padding: 12px 14px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            }

            .smw-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                font-weight: 600;
                color: #fff;
                margin-bottom: 10px;
            }

            .smw-icon {
                font-size: 16px;
            }

            .smw-live-dot {
                width: 6px;
                height: 6px;
                background: #4ade80;
                border-radius: 50%;
                animation: smw-pulse 2s infinite;
            }

            @keyframes smw-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
            }

            .smw-tabs {
                display: flex;
                gap: 4px;
            }

            .smw-tab {
                flex: 1;
                padding: 6px 10px;
                background: rgba(255, 255, 255, 0.03);
                border: none;
                border-radius: 6px;
                color: rgba(255, 255, 255, 0.6);
                font-size: 11px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .smw-tab:hover {
                background: rgba(255, 255, 255, 0.08);
                color: rgba(255, 255, 255, 0.8);
            }

            .smw-tab.active {
                background: rgba(99, 102, 241, 0.2);
                color: #a5b4fc;
            }

            .smw-content {
                max-height: 320px;
                overflow-y: auto;
            }

            .smw-tokens-list,
            .smw-wallets-list,
            .smw-trending-list {
                padding: 8px;
            }

            .smw-token-item,
            .smw-wallet-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px;
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(255, 255, 255, 0.04);
                border-radius: 8px;
                margin-bottom: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .smw-token-item:hover,
            .smw-wallet-item:hover {
                background: rgba(255, 255, 255, 0.05);
                border-color: rgba(99, 102, 241, 0.3);
            }

            .smw-token-rank,
            .smw-wallet-rank,
            .smw-trending-rank {
                font-size: 11px;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.4);
                min-width: 24px;
            }

            .smw-token-info,
            .smw-wallet-info {
                flex: 1;
                min-width: 0;
            }

            .smw-token-name {
                font-size: 12px;
                font-weight: 500;
                color: #fff;
            }

            .smw-token-meta,
            .smw-wallet-meta {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-top: 3px;
                font-size: 10px;
                color: rgba(255, 255, 255, 0.4);
            }

            .smw-badge {
                font-size: 9px;
                padding: 2px 5px;
                border-radius: 4px;
            }

            .smw-badge.trending {
                background: rgba(249, 115, 22, 0.2);
            }

            .smw-badge.new {
                background: rgba(74, 222, 128, 0.2);
                color: #4ade80;
            }

            .smw-wallet-address {
                font-size: 12px;
                font-weight: 500;
                color: #fff;
                font-family: 'SF Mono', monospace;
            }

            .smw-token-stats,
            .smw-wallet-stats {
                display: flex;
                gap: 12px;
            }

            .smw-stat {
                text-align: right;
            }

            .smw-stat-label {
                display: block;
                font-size: 9px;
                color: rgba(255, 255, 255, 0.4);
                margin-bottom: 2px;
            }

            .smw-stat-value {
                font-size: 12px;
                font-weight: 600;
                color: #fff;
            }

            .smw-stat-value.positive {
                color: #4ade80;
            }

            .smw-stat-value.negative {
                color: #f87171;
            }

            .smw-copy-btn {
                padding: 6px;
                background: rgba(255, 255, 255, 0.05);
                border: none;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 12px;
            }

            .smw-copy-btn:hover {
                background: rgba(99, 102, 241, 0.2);
            }

            /* Trending list */
            .smw-trending-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px;
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(255, 255, 255, 0.04);
                border-radius: 8px;
                margin-bottom: 6px;
            }

            .smw-trending-icon {
                width: 24px;
                height: 24px;
                border-radius: 50%;
            }

            .smw-trending-info {
                flex: 1;
            }

            .smw-trending-name {
                font-size: 12px;
                font-weight: 500;
                color: #fff;
            }

            .smw-trending-symbol {
                font-size: 10px;
                color: rgba(255, 255, 255, 0.4);
                text-transform: uppercase;
            }

            .smw-trending-mcap {
                font-size: 11px;
                color: rgba(255, 255, 255, 0.5);
            }

            .smw-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 14px;
                border-top: 1px solid rgba(255, 255, 255, 0.06);
            }

            .smw-source {
                font-size: 10px;
                color: rgba(255, 255, 255, 0.3);
            }

            .smw-refresh {
                padding: 6px;
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.4);
                cursor: pointer;
                border-radius: 4px;
                transition: all 0.2s ease;
            }

            .smw-refresh:hover {
                background: rgba(255, 255, 255, 0.05);
                color: rgba(255, 255, 255, 0.8);
            }

            .smw-refresh.loading svg {
                animation: smw-spin 1s linear infinite;
            }

            @keyframes smw-spin {
                100% { transform: rotate(360deg); }
            }

            .smw-empty {
                padding: 30px 20px;
                text-align: center;
                color: rgba(255, 255, 255, 0.4);
                font-size: 13px;
            }

            .smw-error {
                padding: 10px 14px;
                background: rgba(248, 113, 113, 0.1);
                border-bottom: 1px solid rgba(248, 113, 113, 0.2);
                font-size: 11px;
                color: #f87171;
            }

            .smw-skeleton-list {
                padding: 8px;
            }

            .smw-skeleton-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 10px;
                margin-bottom: 6px;
            }

            .smw-skeleton {
                background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%);
                background-size: 200% 100%;
                animation: smw-shimmer 1.5s infinite;
                border-radius: 4px;
            }

            .smw-skeleton-rank {
                width: 20px;
                height: 14px;
            }

            .smw-skeleton-address {
                flex: 1;
                height: 16px;
            }

            .smw-skeleton-stats {
                width: 80px;
                height: 14px;
            }

            @keyframes smw-shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }

            .smw-toast {
                position: absolute;
                bottom: 60px;
                left: 50%;
                transform: translateX(-50%) translateY(10px);
                background: rgba(0, 0, 0, 0.9);
                color: #fff;
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 12px;
                opacity: 0;
                transition: all 0.3s ease;
                pointer-events: none;
                z-index: 100;
            }

            .smw-toast.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }

            /* Scrollbar */
            .smw-content::-webkit-scrollbar {
                width: 4px;
            }

            .smw-content::-webkit-scrollbar-track {
                background: transparent;
            }

            .smw-content::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 2px;
            }
        `;
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartMoneyWidget;
}
if (typeof window !== 'undefined') {
    window.SmartMoneyWidget = SmartMoneyWidget;
}
