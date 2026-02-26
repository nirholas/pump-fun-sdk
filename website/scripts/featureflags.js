/**
 * LairOS Feature Flags
 * Lightweight feature flag system for client-side control
 * 
 * Usage:
 *   FeatureFlags.isEnabled('app.lairai')   // Check if app is enabled
 *   FeatureFlags.isEnabled('permissions')    // Check if permission prompts are enabled
 *   FeatureFlags.isEnabled('notify.toast')   // Check if toast notifications are enabled
 */

const FeatureFlags = {
    // ============ Configuration ============
    
    // Remote config URL (optional - for dynamic flags)
    REMOTE_CONFIG_URL: null, // e.g., 'https://lair2.vercel.app/api/flags' or a JSON file
    
    // Default flags (fallback if remote fails)
    defaults: {
        // =====================================
        // ACCESS CONTROL
        // =====================================
        'beta_required': false,          // Require beta code to access OS
        'beta_codes': ['LAIROS2026', 'BETAUSER', 'EARLYACCESS'], // Valid beta codes
        
        // =====================================
        // APP FLAGS (app.{appname})
        // Controls whether each app is available
        // =====================================
        
        // Core OS Apps
        'app.store': true,
        'app.files': true,
        'app.settings': true,
        'app.browser': true,
        'app.uvbrowser': true,
        'app.calculator': true,
        'app.text': true,
        'app.musicplr': true,
        'app.camera': true,
        'app.time': true,
        'app.gallery': true,
        'app.studio': true,
        'app.welcome': true,

        // Lair Native Apps
        'app.lairai': true,
        'app.lairbot': true,
        'app.lairdefi': true,
        'app.lairdocs': true,
        'app.lairchat': true,
        'app.copilot': true,
        'app.liza': true,
        'app.lairlaunch': true,
        'app.lairtrending': true,
        'app.laircoin': true,
        'app.lairportfolio': true,
        'app.lairheatmap': true,
        'app.lairliquidations': true,
        'app.lairterminal': true,
        'app.lairwatchlist': true,
        'app.laircalendar': true,
        'app.lairdexscreener': true,
        'app.lairfeargreed': true,
        'app.laironchain': true,

        // Store dApps
        'app.dashboard': true,
        'app.cryptonews-widget': true,
        'app.cli': true,
        'app.claw': true,
        'app.datamgr': true,
        'app.rubixtimer': true,
        'app.owifive': true,
        'app.textame': true,
        'app.paintviz': true,
        'app.ducksquack': true,
        'app.wcanvas': true,
        'app.lizabot3': true,
        'app.originaccess': true,
        'app.dotengine': true,
        'app.json': true,
        'app.pdfviewer': true,
        'app.badthings': true,
        'app.nvamine': true,
        'app.obamafy': true,
        'app.tictactoe': true,
        'app.pysphere': true,
        'app.teletextengine': true,
        'app.rotur': true,
        'app.blockexplorer': true,
        'app.cryptocalc': true,
        'app.cryptocharts': true,
        'app.cryptoglossary': true,
        'app.cryptonews': true,
        'app.defidashboard': true,
        'app.defiyields': true,
        'app.feargreed': true,
        'app.defillama': true,
        'app.gastracker': true,
        'app.dexscreener': true,
        'app.liquidations': true,
        'app.portfolio-aggregator': true,
        'app.position-calculator': true,
        'app.tradingview': true,
        'app.economic-calendar': true,
        'app.calendar': true,
        'app.economiccalendar': true,
        'app.airdrops': true,
        'app.smartmoney': true,
        'app.openinterest': true,
        'app.bridges': true,
        'app.bridgeflows': true,
        'app.orderbook': true,
        'app.coinglass': true,
        'app.funding-rates': true,
        'app.marketheatmap': true,
        'app.mevmonitor': true,
        'app.portfolio-tracker': true,
        'app.smart-money': true,
        'app.stakingdashboard': true,
        'app.token-unlocks': true,
        'app.wallet-tracker': true,
        'app.yieldradar': true,
        'app.nftgallery': true,
        'app.portfolio': true,
        'app.priceticker': true,
        'app.dexswap': true,
        'app.tokenscanner': true,
        'app.trending': true,
        'app.unitconverter': true,
        'app.walletviewer': true,
        'app.whalealerts': true,
        'app.coingecko': true,
        'app.heatmap': true,
        'app.watchlist': true,
        'app.correlation-matrix': true,
        
        // =====================================
        // FEATURE FLAGS
        // =====================================
        'defi_swap': false,              // Swap feature (coming soon)
        'defi_staking': false,           // Staking feature (coming soon)
        'uv_proxy': true,                // UV Browser proxy functionality
        'rotur_network': true,           // Rotur P2P features

        // =====================================
        // CRYPTO TOOLING FLAGS
        // =====================================
        'crypto.live_prices': true,
        'crypto.whale_alerts': true,
        'crypto.gas_alerts': true,
        'crypto.portfolio_sync': false,
        'crypto.ai_signals': true,
        
        // =====================================
        // PERMISSIONS FLAGS
        // Controls the permission prompt system
        // =====================================
        'permissions': true,             // Master toggle: show permission prompts
        'permissions.auto_grant_builtin': true,  // Auto-grant to built-in apps
        'permissions.auto_grant_all': false,     // Auto-grant ALL permissions (dangerous!)
        'permissions.show_risk_level': true,     // Show risk level in prompts
        
        // Per-permission auto-grant (when permissions=true)
        'permissions.grant.files': false,        // Auto-grant file access
        'permissions.grant.settings': false,     // Auto-grant settings access
        'permissions.grant.system': false,       // Auto-grant system access
        'permissions.grant.apps': false,         // Auto-grant apps access
        'permissions.grant.unsandboxed': false,  // Auto-grant unsandboxed (dangerous!)
        
        // =====================================
        // NOTIFICATION FLAGS
        // Controls which notifications appear
        // =====================================
        'notify': true,                  // Master toggle: all notifications
        'notify.toast': true,            // Toast notifications (bottom popup)
        'notify.panel': true,            // Notification panel (top-right)
        'notify.sound': false,           // Play notification sounds
        
        // Specific notification types
        'notify.app.install': true,      // "App installed" notifications
        'notify.app.update': true,       // "App updated" notifications
        'notify.file.saved': true,       // "File saved" notifications
        'notify.file.deleted': true,     // "File deleted" notifications
        'notify.permission.granted': true, // "Permission granted" notifications
        'notify.permission.denied': true,  // "Permission denied" notifications
        'notify.error': true,            // Error notifications
        'notify.welcome': true,          // Welcome/onboarding notifications
        'notify.changelog': true,        // Changelog notifications
        
        // =====================================
        // UI FLAGS
        // =====================================
        'ui.animations': true,           // Window open/close animations
        'ui.blur': true,                 // Blur effects (can affect performance)
        'ui.desktop_widgets': true,      // Desktop widgets
        'ui.dark_mode_only': false,      // Force dark mode
        'ui.show_welcome': true,         // Show welcome screen on first run
        
        // =====================================
        // DEBUG FLAGS
        // =====================================
        'debug': false,                  // Master debug toggle
        'debug.console': true,           // Allow console logging
        'debug.performance': false,      // Show performance metrics
        'debug.api_calls': false,        // Log all NTX API calls
        
        // =====================================
        // EXPERIMENTS
        // =====================================
        'experiment.new_taskbar': false, // New taskbar design
        'experiment.new_start_menu': false, // New start menu design
    },
    
    // ============ State ============
    _flags: {},
    _loaded: false,
    _listeners: new Map(),
    
    // ============ Core Methods ============
    
    /**
     * Initialize feature flags
     * Loads from localStorage, then optionally fetches remote config
     */
    async init() {
        // Load from localStorage first (instant)
        this._loadFromStorage();
        
        // Mark as loaded with local values
        this._loaded = true;
        
        // Fetch remote config in background (if configured)
        if (this.REMOTE_CONFIG_URL) {
            this._fetchRemote().catch(e => console.warn('[FeatureFlags] Remote fetch failed:', e));
        }
        
        // Check beta access if required
        if (this.isEnabled('beta_required')) {
            this._checkBetaAccess();
        }
        
        console.log('[FeatureFlags] Initialized:', this._flags);
        return this;
    },
    
    /**
     * Check if a feature is enabled
     */
    isEnabled(flag) {
        if (!this._loaded) {
            console.warn('[FeatureFlags] Not initialized, using defaults');
            return this.defaults[flag] ?? false;
        }
        return this._flags[flag] ?? this.defaults[flag] ?? false;
    },
    
    /**
     * Get a flag value (for non-boolean flags)
     */
    get(flag) {
        if (!this._loaded) {
            return this.defaults[flag];
        }
        return this._flags[flag] ?? this.defaults[flag];
    },
    
    /**
     * Set a flag value (persists to localStorage)
     */
    set(flag, value) {
        this._flags[flag] = value;
        this._saveToStorage();
        this._notifyListeners(flag, value);
    },
    
    /**
     * Toggle a boolean flag
     */
    toggle(flag) {
        const newValue = !this.isEnabled(flag);
        this.set(flag, newValue);
        return newValue;
    },
    
    /**
     * Reset flags to defaults
     */
    reset() {
        this._flags = { ...this.defaults };
        this._saveToStorage();
    },
    
    /**
     * Listen for flag changes
     */
    onChange(flag, callback) {
        if (!this._listeners.has(flag)) {
            this._listeners.set(flag, new Set());
        }
        this._listeners.get(flag).add(callback);
        
        // Return unsubscribe function
        return () => this._listeners.get(flag)?.delete(callback);
    },
    
    // ============ Storage ============
    
    _loadFromStorage() {
        try {
            const stored = localStorage.getItem('lair_feature_flags');
            if (stored) {
                this._flags = { ...this.defaults, ...JSON.parse(stored) };
            } else {
                this._flags = { ...this.defaults };
            }
        } catch (e) {
            console.error('[FeatureFlags] Failed to load from storage:', e);
            this._flags = { ...this.defaults };
        }
    },
    
    _saveToStorage() {
        try {
            localStorage.setItem('lair_feature_flags', JSON.stringify(this._flags));
        } catch (e) {
            console.error('[FeatureFlags] Failed to save to storage:', e);
        }
    },
    
    // ============ Remote Config ============
    
    async _fetchRemote() {
        if (!this.REMOTE_CONFIG_URL) return;
        
        try {
            const response = await fetch(this.REMOTE_CONFIG_URL, {
                cache: 'no-store',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const remoteFlags = await response.json();
            
            // Merge remote flags (remote takes precedence)
            this._flags = { ...this._flags, ...remoteFlags };
            this._saveToStorage();
            
            console.log('[FeatureFlags] Remote config loaded');
            
            // Re-check beta if it changed
            if (remoteFlags.beta_required !== undefined) {
                this._checkBetaAccess();
            }
        } catch (e) {
            console.warn('[FeatureFlags] Remote fetch failed, using cached/defaults');
        }
    },
    
    // ============ Beta Access ============
    
    _checkBetaAccess() {
        if (!this.isEnabled('beta_required')) return;
        
        const storedCode = localStorage.getItem('lair_beta_code');
        const validCodes = this.get('beta_codes') || [];
        
        if (!storedCode || !validCodes.includes(storedCode.toUpperCase())) {
            this._showBetaGate();
        }
    },
    
    _showBetaGate() {
        // Create beta gate overlay
        const overlay = document.createElement('div');
        overlay.id = 'beta-gate';
        overlay.innerHTML = `
            <style>
                #beta-gate {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 99999;
                    font-family: system-ui, sans-serif;
                    color: #fff;
                }
                #beta-gate .container {
                    text-align: center;
                    padding: 2rem;
                    max-width: 400px;
                }
                #beta-gate h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
                #beta-gate .logo { font-size: 4rem; margin-bottom: 1rem; }
                #beta-gate p { opacity: 0.7; margin-bottom: 2rem; }
                #beta-gate input {
                    width: 100%;
                    padding: 1rem;
                    font-size: 1.1rem;
                    border: 2px solid #333;
                    border-radius: 12px;
                    background: #1a1a2e;
                    color: #fff;
                    text-align: center;
                    letter-spacing: 4px;
                    text-transform: uppercase;
                    margin-bottom: 1rem;
                }
                #beta-gate input:focus { outline: none; border-color: #6366f1; }
                #beta-gate button {
                    width: 100%;
                    padding: 1rem 2rem;
                    font-size: 1.1rem;
                    background: #6366f1;
                    color: #fff;
                    border: none;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: 0.2s;
                }
                #beta-gate button:hover { background: #5558e3; }
                #beta-gate .error { color: #f87171; margin-top: 1rem; display: none; }
                #beta-gate .signup-link { margin-top: 2rem; opacity: 0.6; font-size: 0.9rem; }
                #beta-gate .signup-link a { color: #6366f1; }
            </style>
            <div class="container">
                <div class="logo">🚀</div>
                <h1>LairOS Beta</h1>
                <p>Enter your beta access code to continue</p>
                <form id="beta-form">
                    <input type="text" id="beta-code" placeholder="BETA CODE" maxlength="20" autocomplete="off" autofocus>
                    <button type="submit">Enter Beta</button>
                </form>
                <p class="error" id="beta-error">Invalid code. Please try again.</p>
                <p class="signup-link">
                    Don't have a code? <a href="https://lair2.vercel.app/waitlist" target="_blank">Join the waitlist</a>
                </p>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Handle form submission
        document.getElementById('beta-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const code = document.getElementById('beta-code').value.trim().toUpperCase();
            const validCodes = this.get('beta_codes') || [];
            
            if (validCodes.includes(code)) {
                localStorage.setItem('lair_beta_code', code);
                overlay.remove();
            } else {
                document.getElementById('beta-error').style.display = 'block';
                document.getElementById('beta-code').classList.add('shake');
                setTimeout(() => document.getElementById('beta-code').classList.remove('shake'), 500);
            }
        });
    },
    
    // ============ Helpers ============
    
    _notifyListeners(flag, value) {
        const listeners = this._listeners.get(flag);
        if (listeners) {
            listeners.forEach(cb => {
                try { cb(value, flag); } catch (e) { console.error(e); }
            });
        }
    },
    
    /**
     * Get all flags (for debugging/admin)
     */
    getAll() {
        return { ...this._flags };
    },
    
    /**
     * Check if user has beta access
     */
    hasBetaAccess() {
        const storedCode = localStorage.getItem('lair_beta_code');
        const validCodes = this.get('beta_codes') || [];
        return storedCode && validCodes.includes(storedCode.toUpperCase());
    },
    
    /**
     * Validate a beta code without storing
     */
    validateBetaCode(code) {
        const validCodes = this.get('beta_codes') || [];
        return validCodes.includes(code.toUpperCase());
    },
    
    /**
     * Grant beta access with a code
     */
    grantBetaAccess(code) {
        if (this.validateBetaCode(code)) {
            localStorage.setItem('lair_beta_code', code.toUpperCase());
            return true;
        }
        return false;
    },
    
    /**
     * Revoke beta access
     */
    revokeBetaAccess() {
        localStorage.removeItem('lair_beta_code');
    },
    
    // ============ App Helpers ============
    
    /**
     * Check if an app is enabled
     * @param {string} appName - App name (e.g., 'lairai', 'calculator')
     */
    isAppEnabled(appName) {
        const normalized = appName.toLowerCase().replace(/\.html$/, '');
        return this.isEnabled(`app.${normalized}`);
    },
    
    /**
     * Enable/disable an app
     */
    setAppEnabled(appName, enabled) {
        const normalized = appName.toLowerCase().replace(/\.html$/, '');
        this.set(`app.${normalized}`, enabled);
    },
    
    /**
     * Get all app flags
     */
    getAppFlags() {
        const apps = {};
        for (const [key, value] of Object.entries(this._flags)) {
            if (key.startsWith('app.')) {
                apps[key.replace('app.', '')] = value;
            }
        }
        return apps;
    },
    
    // ============ Permission Helpers ============
    
    /**
     * Check if permission prompts are enabled
     */
    arePermissionsEnabled() {
        return this.isEnabled('permissions');
    },
    
    /**
     * Check if a specific permission should be auto-granted
     * @param {string} permission - Permission name (e.g., 'files', 'settings')
     * @param {boolean} isBuiltIn - Whether the app is built-in
     */
    shouldAutoGrant(permission, isBuiltIn = false) {
        // If permissions are disabled entirely, auto-grant everything
        if (!this.isEnabled('permissions')) return true;
        
        // Auto-grant all?
        if (this.isEnabled('permissions.auto_grant_all')) return true;
        
        // Auto-grant built-in apps?
        if (isBuiltIn && this.isEnabled('permissions.auto_grant_builtin')) return true;
        
        // Check specific permission flag
        return this.isEnabled(`permissions.grant.${permission}`);
    },
    
    /**
     * Disable all permission prompts (auto-grant everything)
     */
    disablePermissions() {
        this.set('permissions', false);
    },
    
    /**
     * Enable permission prompts
     */
    enablePermissions() {
        this.set('permissions', true);
    },
    
    // ============ Notification Helpers ============
    
    /**
     * Check if notifications are enabled
     */
    areNotificationsEnabled() {
        return this.isEnabled('notify');
    },
    
    /**
     * Check if a specific notification type is enabled
     * @param {string} type - Notification type (e.g., 'toast', 'app.install', 'error')
     */
    isNotifyEnabled(type) {
        // Master toggle
        if (!this.isEnabled('notify')) return false;
        
        // Specific type
        return this.isEnabled(`notify.${type}`);
    },
    
    /**
     * Check if toast notifications are enabled
     */
    isToastEnabled() {
        return this.isEnabled('notify') && this.isEnabled('notify.toast');
    },
    
    /**
     * Disable all notifications
     */
    disableNotifications() {
        this.set('notify', false);
    },
    
    /**
     * Enable notifications
     */
    enableNotifications() {
        this.set('notify', true);
    },
    
    // ============ UI Helpers ============
    
    /**
     * Check if UI animations are enabled
     */
    areAnimationsEnabled() {
        return this.isEnabled('ui.animations');
    },
    
    /**
     * Check if debug mode is enabled
     */
    isDebugMode() {
        return this.isEnabled('debug');
    },
    
    // ============ Bulk Operations ============
    
    /**
     * Enable only Lair apps, disable others
     */
    lairOnlyMode() {
        const lairApps = ['store', 'files', 'settings', 'lairai', 'lairbot', 
                           'lairdefi', 'lairdocs', 'lairchat', 'portfolio'];
        
        for (const [key, _] of Object.entries(this.defaults)) {
            if (key.startsWith('app.')) {
                const appName = key.replace('app.', '');
                this.set(key, lairApps.includes(appName));
            }
        }
    },
    
    /**
     * Enable all apps
     */
    enableAllApps() {
        for (const [key, _] of Object.entries(this.defaults)) {
            if (key.startsWith('app.')) {
                this.set(key, true);
            }
        }
    },
    
    /**
     * Silent mode - disable most notifications
     */
    silentMode() {
        this.set('notify.toast', false);
        this.set('notify.panel', false);
        this.set('notify.sound', false);
        this.set('notify.app.install', false);
        this.set('notify.app.update', false);
        this.set('notify.file.saved', false);
        // Keep errors and permissions
    },
    
    /**
     * Power user mode - disable prompts and notifications
     */
    powerUserMode() {
        this.disablePermissions();
        this.silentMode();
    }
};

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
    window.FeatureFlags = FeatureFlags;
    
    // Initialize on DOMContentLoaded or immediately if already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => FeatureFlags.init());
    } else {
        FeatureFlags.init();
    }
}
