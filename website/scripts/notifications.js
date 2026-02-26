// ============================================
// LairOS Unified Notification Center
// Toast notifications, history panel, preferences,
// debouncing, browser notifications, Lair.notify() bridge
// ============================================

const NotificationCenter = (() => {
    // ─── State ───
    let stack = [];          // currently visible toasts
    let history = [];        // persistent history (max 50)
    const MAX_VISIBLE = 3;
    const MAX_HISTORY = 50;
    const DEBOUNCE_MS = 800; // de-duplicate rapid-fire
    const AUTO_DISMISS = 5000;

    // debounce tracking: key → timestamp
    const _recentKeys = new Map();

    // ─── Preferences (localStorage) ───
    const _defaultPrefs = {
        toasts: true,
        sound: true,
        browser: false,       // browser Notification API (requires grant)
        // per-source toggles (all default on)
        'source.priceAlert': true,
        'source.whaleAlert': true,
        'source.gasTracker': true,
        'source.cryptoNews': true,
        'source.lairLaunch': true,
        'source.portfolio': true,
        'source.system': true,
    };

    function _loadPrefs() {
        try {
            const saved = localStorage.getItem('lair-notif-prefs');
            return saved ? { ..._defaultPrefs, ...JSON.parse(saved) } : { ..._defaultPrefs };
        } catch { return { ..._defaultPrefs }; }
    }

    function _savePrefs(prefs) {
        try { localStorage.setItem('lair-notif-prefs', JSON.stringify(prefs)); } catch {}
    }

    let prefs = _loadPrefs();

    // ─── Type config ───
    const TYPE_CONFIG = {
        info:    { icon: 'info',          borderColor: '#6179ff' },
        success: { icon: 'check_circle',  borderColor: 'var(--col-good, #85FF85)' },
        warning: { icon: 'warning',       borderColor: '#f5a623' },
        error:   { icon: 'error',         borderColor: 'var(--col-bad, #AC4949)' },
        price:   { icon: 'trending_up',   borderColor: 'var(--colors-accent, #6179ff)' },
    };

    // ─── Helpers ───
    function _escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    function _uid() {
        return 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    }

    function _dedupeKey(title, message) {
        return title + '::' + message;
    }

    function _isDuplicate(title, message) {
        const key = _dedupeKey(title, message);
        const last = _recentKeys.get(key);
        if (last && Date.now() - last < DEBOUNCE_MS) return true;
        _recentKeys.set(key, Date.now());
        // prune old keys every 50 entries
        if (_recentKeys.size > 50) {
            const now = Date.now();
            for (const [k, t] of _recentKeys) {
                if (now - t > DEBOUNCE_MS * 2) _recentKeys.delete(k);
            }
        }
        return false;
    }

    // ─── Sound (uses systemFeatures playSound if available) ───
    function _playChime(type) {
        if (!prefs.sound) return;
        if (typeof window.playSound === 'function') {
            window.playSound(type === 'error' ? 'error' : 'notification');
        }
    }

    // ─── Browser Notification API ───
    function _sendBrowserNotif(title, message, iconEmoji) {
        if (!prefs.browser) return;
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;
        try {
            new Notification(title, { body: message, icon: undefined, badge: undefined });
        } catch {}
    }

    /** Request browser notification permission (must be user-initiated) */
    function requestBrowserPermission() {
        if (!('Notification' in window)) return Promise.resolve('denied');
        return Notification.requestPermission().then(result => {
            if (result === 'granted') {
                prefs.browser = true;
                _savePrefs(prefs);
            }
            return result;
        });
    }

    // ─── History persistence ───
    function _saveHistory() {
        try {
            localStorage.setItem('lair-notification-history', JSON.stringify(history));
        } catch {}
    }

    function _loadHistory() {
        try {
            const saved = localStorage.getItem('lair-notification-history');
            if (saved) {
                history = JSON.parse(saved).map(n => ({
                    ...n,
                    timestamp: new Date(n.timestamp),
                }));
            }
        } catch {}
    }

    // ─── Badge ───
    function _updateBadge() {
        const badge = document.getElementById('notification-badge');
        if (!badge) return;
        const unread = history.filter(n => !n.read).length;
        badge.textContent = unread > 99 ? '99+' : String(unread);
        badge.style.display = unread > 0 ? 'flex' : 'none';
    }

    // ─── Time grouping ───
    function _timeGroup(date) {
        const now = new Date();
        const d = new Date(date);
        const sod = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
        const todayStart = sod(now);
        const ts = d.getTime();
        if (ts >= todayStart) return 'Today';
        if (ts >= todayStart - 86400000) return 'Yesterday';
        return 'Earlier';
    }

    function _formatTime(date) {
        const d = new Date(date);
        const now = new Date();
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    }

    // ─── Toast DOM ───
    function _createToastEl(item) {
        const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
        const el = document.createElement('div');
        el.className = 'nc-toast nc-toast--' + (item.type || 'info');
        el.id = item.id;
        el.style.borderLeftColor = cfg.borderColor;
        el.innerHTML = `
            <div class="nc-toast__icon">
                ${item.emoji ? '<span class="nc-toast__emoji">' + _escapeHtml(item.emoji) + '</span>' : '<span class="material-symbols-rounded">' + cfg.icon + '</span>'}
            </div>
            <div class="nc-toast__body">
                <div class="nc-toast__title">${_escapeHtml(item.title)}</div>
                ${item.message ? '<div class="nc-toast__msg">' + _escapeHtml(item.message) + '</div>' : ''}
                ${item.source ? '<div class="nc-toast__source">' + _escapeHtml(item.source) + '</div>' : ''}
            </div>
            <button class="nc-toast__close" aria-label="Dismiss">
                <span class="material-symbols-rounded">close</span>
            </button>
        `;

        // dismiss on close button
        el.querySelector('.nc-toast__close').addEventListener('click', (e) => {
            e.stopPropagation();
            _dismissToast(item.id);
        });
        // dismiss on click body
        el.addEventListener('click', () => _dismissToast(item.id));

        return el;
    }

    function _dismissToast(id) {
        const idx = stack.findIndex(s => s.id === id);
        if (idx === -1) return;
        const { element } = stack[idx];
        stack.splice(idx, 1);
        if (element) {
            element.classList.remove('nc-toast--enter');
            element.classList.add('nc-toast--exit');
            setTimeout(() => element.remove(), 320);
        }
    }

    // ─── Core: show ───
    /**
     * Show a notification.
     * @param {object} opts
     * @param {string}  opts.title    - required
     * @param {string}  [opts.message]
     * @param {string}  [opts.type]   - 'info'|'success'|'warning'|'error'|'price'
     * @param {string}  [opts.emoji]  - custom emoji icon (overrides type icon)
     * @param {string}  [opts.source] - source app name
     * @param {number}  [opts.duration] - auto-dismiss ms (0 = sticky)
     * @returns {string} notification id
     */
    function show(opts) {
        const title = opts.title || 'Notification';
        const message = opts.message || '';
        const type = opts.type || 'info';
        const emoji = opts.emoji || '';
        const source = opts.source || '';
        const duration = opts.duration !== undefined ? opts.duration : AUTO_DISMISS;

        // Feature-flag check
        if (typeof FeatureFlags !== 'undefined') {
            if (!FeatureFlags.isEnabled('notify')) return null;
        }

        // Debounce
        if (_isDuplicate(title, message)) return null;

        const id = _uid();

        // ── History ──
        const historyItem = {
            id,
            title,
            message,
            type,
            emoji,
            source,
            timestamp: new Date(),
            read: false,
        };
        history.unshift(historyItem);
        if (history.length > MAX_HISTORY) history.pop();
        _saveHistory();
        _updateBadge();

        // ── Sound ──
        _playChime(type);

        // ── Browser notification ──
        _sendBrowserNotif(title, message, emoji);

        // ── Toast ──
        if (prefs.toasts) {
            if (typeof FeatureFlags !== 'undefined' && !FeatureFlags.isEnabled('notify.toast')) {
                return id; // toasts disabled by flag
            }

            const container = document.getElementById('notification-center');
            if (!container) return id;

            const el = _createToastEl(historyItem);

            // trim oldest if at max
            while (stack.length >= MAX_VISIBLE) {
                const oldest = stack.shift();
                if (oldest.element?.parentNode) {
                    oldest.element.classList.add('nc-toast--exit');
                    setTimeout(() => oldest.element.remove(), 320);
                }
            }

            stack.push({ id, element: el });
            container.appendChild(el);

            // entrance animation on next frame
            requestAnimationFrame(() => el.classList.add('nc-toast--enter'));

            // auto-dismiss
            if (duration > 0) {
                setTimeout(() => _dismissToast(id), duration);
            }
        }

        return id;
    }

    // ─── Convenience wrappers ───
    function info(title, message, source)    { return show({ title, message, type: 'info', source }); }
    function success(title, message, source) { return show({ title, message, type: 'success', source }); }
    function warning(title, message, source) { return show({ title, message, type: 'warning', source }); }
    function error(title, message, source)   { return show({ title, message, type: 'error', source }); }
    function price(title, message, source)   { return show({ title, message, type: 'price', source }); }

    // ─── Panel rendering ───
    function _renderPanel() {
        const list = document.getElementById('nc-history-list');
        if (!list) return;

        if (history.length === 0) {
            list.innerHTML = '<div class="nc-history__empty"><span class="material-symbols-rounded">notifications_off</span><span>No notifications yet</span></div>';
            return;
        }

        // Group by time
        const groups = {};
        for (const n of history) {
            const g = _timeGroup(n.timestamp);
            (groups[g] = groups[g] || []).push(n);
        }

        const order = ['Today', 'Yesterday', 'Earlier'];
        let html = '';
        for (const label of order) {
            const items = groups[label];
            if (!items || items.length === 0) continue;
            html += `<div class="nc-history__group-label">${label}</div>`;
            for (const n of items) {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                html += `
                    <div class="nc-history__item nc-history__item--${n.type}${n.read ? '' : ' nc-history__item--unread'}">
                        <div class="nc-history__item-icon" style="color:${cfg.borderColor}">
                            ${n.emoji ? '<span>' + _escapeHtml(n.emoji) + '</span>' : '<span class="material-symbols-rounded">' + cfg.icon + '</span>'}
                        </div>
                        <div class="nc-history__item-body">
                            <div class="nc-history__item-title">${_escapeHtml(n.title)}</div>
                            ${n.message ? '<div class="nc-history__item-msg">' + _escapeHtml(n.message) + '</div>' : ''}
                            <div class="nc-history__item-meta">
                                ${n.source ? '<span class="nc-history__item-source">' + _escapeHtml(n.source) + '</span>' : ''}
                                <span class="nc-history__item-time">${_formatTime(n.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        list.innerHTML = html;
    }

    function togglePanel() {
        const panel = document.getElementById('nc-panel');
        if (!panel) return;
        const isOpen = panel.classList.contains('nc-panel--open');
        if (isOpen) {
            panel.classList.remove('nc-panel--open');
            panel.setAttribute('aria-hidden', 'true');
        } else {
            // close other slide panels
            if (typeof closeHistoryPanels === 'function') {
                closeHistoryPanels('nc-panel');
            }
            _renderPanel();
            panel.classList.add('nc-panel--open');
            panel.setAttribute('aria-hidden', 'false');
            // mark all read
            markAllRead();
        }
    }

    function markAllRead() {
        let changed = false;
        for (const n of history) {
            if (!n.read) { n.read = true; changed = true; }
        }
        if (changed) {
            _saveHistory();
            _updateBadge();
        }
    }

    function clearAll() {
        history = [];
        _saveHistory();
        _renderPanel();
        _updateBadge();
    }

    // ─── Preferences API ───
    function getPref(key) { return prefs[key]; }
    function setPref(key, value) {
        prefs[key] = value;
        _savePrefs(prefs);
    }
    function getAllPrefs() { return { ...prefs }; }

    // ─── Init ───
    function init() {
        _loadHistory();
        _updateBadge();
        _injectPanel();
        _bindDismiss();

        // Make the old showNotification() bridge into this system
        window.showNotification = function (title, message, type, duration) {
            return show({ title, message, type, duration, source: 'System' });
        };

        // Bridge legacy notify() — wrap whatever is currently defined
        _patchLegacyNotify();

        // Bridge Lair.notify for iframes/apps
        window.LairNotify = function (title, message, emoji) {
            return show({ title, message, emoji, type: 'info', source: 'App' });
        };

        console.log('[NotificationCenter] Initialized');
    }

    let _legacyPatched = false;
    function _patchLegacyNotify() {
        if (_legacyPatched) return;
        const origNotify = window.notify;
        if (typeof origNotify === 'function') {
            _legacyPatched = true;
            window.notify = function (...args) {
                const flat = (args.length === 1 && Array.isArray(args[0])) ? args[0] : args;
                const [title = 'Notification', description = ''] = flat;
                show({ title, message: description, type: 'info', source: 'System' });
                try { origNotify.apply(window, args); } catch {}
            };
        }
    }

    // Re-patch after other scripts may have defined notify()
    function lateInit() {
        _patchLegacyNotify();
    }

    function _injectPanel() {
        // Replace the old notification-history-panel with the new nc-panel
        const oldPanel = document.getElementById('notification-history-panel');
        if (oldPanel) oldPanel.remove();

        // Create new panel
        const panel = document.createElement('div');
        panel.id = 'nc-panel';
        panel.className = 'nc-panel';
        panel.setAttribute('aria-hidden', 'true');
        panel.innerHTML = `
            <div class="nc-panel__header">
                <h3 class="nc-panel__title">Notifications</h3>
                <div class="nc-panel__actions">
                    <button class="nc-panel__btn" id="nc-mark-read-btn" title="Mark all as read">
                        <span class="material-symbols-rounded">done_all</span>
                    </button>
                    <button class="nc-panel__btn" id="nc-clear-btn" title="Clear all">
                        <span class="material-symbols-rounded">delete_sweep</span>
                    </button>
                    <button class="nc-panel__btn" id="nc-close-btn" title="Close">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
            </div>
            <div class="nc-panel__list" id="nc-history-list"></div>
            <div class="nc-panel__footer">
                <button class="nc-panel__pref-btn" id="nc-pref-btn" title="Notification preferences">
                    <span class="material-symbols-rounded">tune</span>
                    <span>Preferences</span>
                </button>
            </div>
        `;
        document.getElementById('main').appendChild(panel);

        // Bind buttons
        document.getElementById('nc-mark-read-btn').addEventListener('click', () => {
            markAllRead();
            _renderPanel();
        });
        document.getElementById('nc-clear-btn').addEventListener('click', () => clearAll());
        document.getElementById('nc-close-btn').addEventListener('click', () => togglePanel());
        document.getElementById('nc-pref-btn').addEventListener('click', () => _showPrefs());
    }

    function _bindDismiss() {
        // Close panel when clicking outside
        document.addEventListener('mousedown', (e) => {
            const panel = document.getElementById('nc-panel');
            if (!panel || !panel.classList.contains('nc-panel--open')) return;
            if (e.target.closest('#nc-panel') || e.target.closest('.notification-bell-btn')) return;
            panel.classList.remove('nc-panel--open');
            panel.setAttribute('aria-hidden', 'true');
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const panel = document.getElementById('nc-panel');
                if (panel?.classList.contains('nc-panel--open')) {
                    panel.classList.remove('nc-panel--open');
                    panel.setAttribute('aria-hidden', 'true');
                }
            }
        });
    }

    // ─── Preferences dialog (inline) ───
    function _showPrefs() {
        const panel = document.getElementById('nc-panel');
        if (!panel) return;
        const list = document.getElementById('nc-history-list');
        if (!list) return;

        const make = (key, label) => {
            const checked = prefs[key] ? 'checked' : '';
            return `<label class="nc-pref__row">
                <span>${label}</span>
                <input type="checkbox" data-pref="${key}" ${checked}>
            </label>`;
        };

        list.innerHTML = `
            <div class="nc-pref__section">
                <div class="nc-pref__heading">General</div>
                ${make('toasts', 'Show toast popups')}
                ${make('sound', 'Play notification sounds')}
                ${make('browser', 'Browser notifications')}
            </div>
            <div class="nc-pref__section">
                <div class="nc-pref__heading">Sources</div>
                ${make('source.priceAlert', 'Price Alerts')}
                ${make('source.whaleAlert', 'Whale Alerts')}
                ${make('source.gasTracker', 'Gas Tracker')}
                ${make('source.cryptoNews', 'Crypto News')}
                ${make('source.lairLaunch', 'Lair Launch')}
                ${make('source.portfolio', 'Portfolio')}
                ${make('source.system', 'System')}
            </div>
            <button class="nc-pref__back" id="nc-pref-back">
                <span class="material-symbols-rounded">arrow_back</span>
                Back to notifications
            </button>
        `;

        // Bind toggles
        list.querySelectorAll('input[data-pref]').forEach(input => {
            input.addEventListener('change', (e) => {
                const key = e.target.dataset.pref;
                const val = e.target.checked;
                setPref(key, val);
                // if enabling browser notifications, request permission
                if (key === 'browser' && val) {
                    requestBrowserPermission().then(result => {
                        if (result !== 'granted') {
                            e.target.checked = false;
                            setPref('browser', false);
                        }
                    });
                }
            });
        });

        document.getElementById('nc-pref-back').addEventListener('click', () => _renderPanel());
    }

    // ─── Public API ───
    return {
        show,
        info,
        success,
        warning,
        error,
        price,
        togglePanel,
        markAllRead,
        clearAll,
        getPref,
        setPref,
        getAllPrefs,
        requestBrowserPermission,
        init,
        lateInit,
    };
})();

// ─── Override toggleNotificationHistory for backward compat ───
function toggleNotificationHistory() {
    NotificationCenter.togglePanel();
}
function clearNotificationHistory() {
    NotificationCenter.clearAll();
}

// ─── Initialize when DOM ready ───
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => NotificationCenter.init());
} else {
    NotificationCenter.init();
}

// Re-patch legacy notify() after all defer scripts have run
window.addEventListener('load', () => NotificationCenter.lateInit());

// ─── Global exports ───
window.NotificationCenter = NotificationCenter;
