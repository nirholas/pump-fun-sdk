/**
 * PumpOS Command Palette & Keyboard Shortcuts
 * Ctrl+K / Ctrl+Shift+P — fuzzy-search command palette
 */

(function () {
    'use strict';

    // ── MRU tracking ──────────────────────────────────────────────
    const MRU_KEY = 'lair_cmd_mru';
    const MRU_MAX = 20;

    function getMRU() {
        try {
            return JSON.parse(localStorage.getItem(MRU_KEY)) || [];
        } catch { return []; }
    }
    function pushMRU(id) {
        let mru = getMRU().filter(x => x !== id);
        mru.unshift(id);
        if (mru.length > MRU_MAX) mru = mru.slice(0, MRU_MAX);
        localStorage.setItem(MRU_KEY, JSON.stringify(mru));
    }

    // ── Fuzzy matching ────────────────────────────────────────────
    function fuzzyMatch(query, text) {
        let qi = 0;
        const lq = query.toLowerCase(), lt = text.toLowerCase();
        for (let ti = 0; ti < lt.length && qi < lq.length; ti++) {
            if (lt[ti] === lq[qi]) qi++;
        }
        return qi === lq.length;
    }

    function scoreMatch(query, text) {
        const lq = query.toLowerCase(), lt = text.toLowerCase();
        // Exact match
        if (lt === lq) return 100;
        // Starts with query
        if (lt.startsWith(lq)) return 90;
        // Word boundary match
        const words = lt.split(/[\s\-_:>]+/);
        for (const w of words) {
            if (w.startsWith(lq)) return 80;
        }
        // Contains as substring
        if (lt.includes(lq)) return 70;
        // Fuzzy — measure density (lower spread = better)
        let qi = 0, first = -1, last = -1;
        for (let ti = 0; ti < lt.length && qi < lq.length; ti++) {
            if (lt[ti] === lq[qi]) {
                if (first === -1) first = ti;
                last = ti;
                qi++;
            }
        }
        if (qi < lq.length) return 0; // no match
        const spread = last - first + 1;
        return Math.max(1, 60 - (spread - lq.length) * 3);
    }

    // ── Build command list ────────────────────────────────────────
    function buildCommands() {
        const cmds = [];

        // ── Apps from IndexedDB (populated after getFileNamesByFolder) ──
        // We pull from the app menu DOM which is already populated, or from defAppsList
        if (typeof defAppsList !== 'undefined') {
            defAppsList.forEach(appName => {
                cmds.push({
                    id: 'app.' + appName,
                    label: 'Open ' + toTitleCase(appName),
                    icon: 'open_in_new',
                    category: 'Apps',
                    action: () => openapp(appName, 1)
                });
            });
        }

        // Also pull any custom / store-installed apps visible in the menu
        const menuApps = document.querySelectorAll('#appsindeck [data-app-id]');
        const seen = new Set(defAppsList || []);
        menuApps.forEach(el => {
            const appId = el.dataset.appId;
            const appName = (el.querySelector('.app-title')?.textContent || el.getAttribute('unid') || appId || '').trim();
            if (!appName || seen.has(appName.toLowerCase())) return;
            seen.add(appName.toLowerCase());
            cmds.push({
                id: 'app.custom.' + appId,
                label: 'Open ' + appName,
                icon: 'apps',
                category: 'Apps',
                action: () => openapp(appName, appId)
            });
        });

        // ── Actions ───────────────────────────────────────────────
        cmds.push(
            { id: 'action.lock', label: 'Lock Screen', icon: 'lock', category: 'Actions', action: () => { if (typeof lockScreen === 'function') lockScreen(); } },
            { id: 'action.show_desktop', label: 'Show Desktop', icon: 'desktop_windows', category: 'Actions', action: () => toggleShowDesktop() },
            { id: 'action.close_all', label: 'Close All Windows', icon: 'close', category: 'Actions', action: () => closeallwindows() },
            { id: 'action.app_menu', label: 'Open App Menu', icon: 'apps', category: 'Actions', action: () => openn() },
            { id: 'action.search', label: 'Open Search Panel', icon: 'search', category: 'Actions', action: () => opensearchpanel() }
        );

        // ── Settings ──────────────────────────────────────────────
        cmds.push(
            { id: 'setting.settings', label: 'Open Settings', icon: 'settings', category: 'Settings', action: () => openapp('settings', 1) },
            { id: 'setting.fullscreen', label: 'Toggle Fullscreen', icon: 'fullscreen', category: 'Settings', action: () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); } },
            { id: 'setting.onboarding', label: 'Show Onboarding Tour', icon: 'school', category: 'Settings', action: () => { if (typeof PumpOnboarding !== 'undefined') PumpOnboarding.forceStart(); } }
        );

        // ── Window actions (only when windows exist) ──────────────
        cmds.push(
            { id: 'win.close', label: 'Close Focused Window', icon: 'close', category: 'Window', action: () => closeFocusedWindow() },
            { id: 'win.minimize', label: 'Minimize Focused Window', icon: 'remove', category: 'Window', action: () => minimizeFocusedWindow() },
            { id: 'win.maximize', label: 'Maximize Focused Window', icon: 'open_in_full', category: 'Window', action: () => maximizeFocusedWindow() },
            { id: 'win.snap_left', label: 'Snap Window Left', icon: 'align_horizontal_left', category: 'Window', action: () => snapFocusedWindow('left') },
            { id: 'win.snap_right', label: 'Snap Window Right', icon: 'align_horizontal_right', category: 'Window', action: () => snapFocusedWindow('right') }
        );

        // ── Quick nav ─────────────────────────────────────────────
        cmds.push(
            { id: 'nav.dexscreener', label: 'Open DEX Screener', icon: 'candlestick_chart', category: 'Quick Nav', action: () => openapp('lairdexscreener', 1) },
            { id: 'nav.portfolio', label: 'Open Portfolio', icon: 'account_balance_wallet', category: 'Quick Nav', action: () => openapp('lairportfolio', 1) },
            { id: 'nav.trending', label: 'Open Trending', icon: 'trending_up', category: 'Quick Nav', action: () => openapp('lairtrending', 1) },
            { id: 'nav.heatmap', label: 'Open Heatmap', icon: 'grid_view', category: 'Quick Nav', action: () => openapp('lairheatmap', 1) },
            { id: 'nav.terminal', label: 'Open Terminal', icon: 'terminal', category: 'Quick Nav', action: () => openapp('lairterminal', 1) },
            { id: 'nav.ai', label: 'Open Pump AI', icon: 'smart_toy', category: 'Quick Nav', action: () => openapp('lairai', 1) }
        );

        return cmds;
    }

    // ── Focused-window helpers ────────────────────────────────────
    function getTopWindowUid() {
        const keys = Object.keys(winds);
        if (!keys.length) return null;
        let topKey = keys[0], topZ = -Infinity;
        keys.forEach(k => {
            const z = Number(winds[k].zIndex) || 0;
            const el = document.getElementById('window' + k);
            if (z > topZ && el && el.style.display !== 'none' && winds[k].visualState !== 'minimized') {
                topZ = z; topKey = k;
            }
        });
        return topKey;
    }
    function closeFocusedWindow() {
        const uid = getTopWindowUid();
        if (uid) clwin(uid);
    }
    function minimizeFocusedWindow() {
        const uid = getTopWindowUid();
        if (uid) minim(uid);
    }
    function maximizeFocusedWindow() {
        const uid = getTopWindowUid();
        if (uid) maximizeWindow(uid);
    }
    function snapFocusedWindow(dir) {
        const uid = getTopWindowUid();
        if (!uid) return;
        updateNavSize();
        const el = document.getElementById('window' + uid);
        if (!el) return;
        suppressNudge = true;
        el.classList.add('snapping');
        if (dir === 'left') {
            el.style.cssText = `position:absolute;left:0;top:0;width:calc(50% - 0px);height:calc(100% - ${navheight}px);`;
        } else {
            el.style.cssText = `position:absolute;right:0;top:0;width:calc(50% - 0px);height:calc(100% - ${navheight}px);left:auto;`;
        }
        el.querySelector('.flbtn').innerHTML = 'open_in_full';
        winds[uid].visualState = 'snapped';
        setTimeout(() => { el.classList.remove('snapping'); suppressNudge = false; }, 1000);
    }

    // ── Palette DOM ───────────────────────────────────────────────
    const palette = document.getElementById('command-palette');
    const backdrop = palette?.querySelector('.palette-backdrop');
    const input = document.getElementById('palette-input');
    const results = document.getElementById('palette-results');
    let selectedIndex = 0;
    let visibleItems = [];
    let paletteOpen = false;

    function openPalette() {
        if (!palette) return;
        const cmds = buildCommands();
        window.__cmdPaletteCommands = cmds;
        paletteOpen = true;
        palette.style.display = 'flex';
        input.value = '';
        selectedIndex = 0;
        renderResults('', cmds);
        requestAnimationFrame(() => {
            input.focus();
            palette.classList.add('palette-visible');
        });
    }
    function closePalette() {
        if (!palette) return;
        paletteOpen = false;
        palette.classList.remove('palette-visible');
        setTimeout(() => { palette.style.display = 'none'; }, 200);
    }
    function isPaletteOpen() { return paletteOpen; }

    function renderResults(query, cmds) {
        if (!results) return;
        const mru = getMRU();
        let items;

        if (!query) {
            // Show recent first, then all by category
            const recentIds = new Set(mru);
            const recent = mru.map(id => cmds.find(c => c.id === id)).filter(Boolean);
            const rest = cmds.filter(c => !recentIds.has(c.id));
            items = [...recent, ...rest];
        } else {
            items = cmds
                .map(c => ({ cmd: c, score: scoreMatch(query, c.label) }))
                .filter(x => x.score > 0)
                .sort((a, b) => {
                    // MRU bonus
                    const aIdx = mru.indexOf(a.cmd.id);
                    const bIdx = mru.indexOf(b.cmd.id);
                    const aBonus = aIdx >= 0 ? 10 : 0;
                    const bBonus = bIdx >= 0 ? 10 : 0;
                    return (b.score + bBonus) - (a.score + aBonus);
                })
                .map(x => x.cmd);
        }

        // Cap at 50 max
        items = items.slice(0, 50);
        visibleItems = items;

        if (items.length === 0) {
            results.innerHTML = '<div class="palette-empty">No matching commands</div>';
            return;
        }

        let currentCategory = '';
        let html = '';
        items.forEach((item, i) => {
            if (!query && item.category !== currentCategory) {
                currentCategory = item.category;
                html += `<div class="palette-category">${escapeHTML(currentCategory)}</div>`;
            }
            const activeClass = i === selectedIndex ? ' palette-item-active' : '';
            html += `<div class="palette-item${activeClass}" data-index="${i}" data-id="${escapeHTML(item.id)}">
                <span class="material-symbols-rounded palette-item-icon">${escapeHTML(item.icon)}</span>
                <span class="palette-item-label">${highlightMatch(query, item.label)}</span>
                <span class="palette-item-category">${escapeHTML(item.category)}</span>
            </div>`;
        });
        results.innerHTML = html;

        // Scroll active into view
        const activeEl = results.querySelector('.palette-item-active');
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }

    function escapeHTML(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }
    function highlightMatch(query, text) {
        if (!query) return escapeHTML(text);
        const lq = query.toLowerCase(), lt = text.toLowerCase();
        let qi = 0, out = '';
        for (let ti = 0; ti < text.length; ti++) {
            if (qi < lq.length && lt[ti] === lq[qi]) {
                out += `<b>${escapeHTML(text[ti])}</b>`;
                qi++;
            } else {
                out += escapeHTML(text[ti]);
            }
        }
        return out;
    }

    function executeItem(index) {
        const item = visibleItems[index];
        if (!item) return;
        pushMRU(item.id);
        closePalette();
        try { item.action(); } catch (e) { console.error('Command palette action error:', e); }
    }

    // ── Event wiring ──────────────────────────────────────────────
    if (input) {
        input.addEventListener('input', () => {
            selectedIndex = 0;
            renderResults(input.value.trim(), window.__cmdPaletteCommands || []);
        });
    }
    if (results) {
        results.addEventListener('click', (e) => {
            const item = e.target.closest('.palette-item');
            if (item) executeItem(Number(item.dataset.index));
        });
        results.addEventListener('mousemove', (e) => {
            const item = e.target.closest('.palette-item');
            if (item) {
                const idx = Number(item.dataset.index);
                if (idx !== selectedIndex) {
                    selectedIndex = idx;
                    results.querySelectorAll('.palette-item').forEach((el, i) => {
                        el.classList.toggle('palette-item-active', i === selectedIndex);
                    });
                }
            }
        });
    }
    if (backdrop) {
        backdrop.addEventListener('click', closePalette);
    }

    // ── Keyboard navigation inside palette ────────────────────────
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, visibleItems.length - 1);
                updateSelection();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateSelection();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                executeItem(selectedIndex);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closePalette();
            }
        });
    }
    function updateSelection() {
        if (!results) return;
        results.querySelectorAll('.palette-item').forEach((el, i) => {
            el.classList.toggle('palette-item-active', i === selectedIndex);
        });
        const activeEl = results.querySelector('.palette-item-active');
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }

    // ── Cycle windows helper ──────────────────────────────────────
    function cycleWindows(reverse) {
        const keys = Object.keys(winds);
        if (keys.length < 2) return;
        // Sort by z-index ascending
        const sorted = keys.slice().sort((a, b) => (Number(winds[a].zIndex) || 0) - (Number(winds[b].zIndex) || 0));
        const topUid = sorted[sorted.length - 1];
        let nextIdx;
        if (reverse) {
            // Bring the one just below top to front
            nextIdx = sorted.length - 2;
        } else {
            // Send top to bottom, bring next to front
            nextIdx = sorted.length - 2;
        }
        // Actually: cycle means move focus to next/prev
        const topIdx = sorted.indexOf(topUid);
        if (reverse) {
            nextIdx = topIdx - 1 < 0 ? sorted.length - 1 : topIdx - 1;
        } else {
            nextIdx = (topIdx + 1) % sorted.length;
        }
        const nextUid = sorted[nextIdx];
        const el = document.getElementById('window' + nextUid);
        if (el) {
            if (winds[nextUid].visualState === 'minimized') {
                el.style.display = 'flex';
                winds[nextUid].visualState = 'free';
            }
            putwinontop('window' + nextUid);
        }
    }

    // ── Global hotkeys ────────────────────────────────────────────
    document.addEventListener('keydown', function (e) {
        // Don't intercept if typing in an iframe or contenteditable (but do intercept for palette input)
        const tag = e.target.tagName;
        const isInput = (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable);
        const isPaletteInput = e.target === input;

        // Ctrl+K or Ctrl+Shift+P — Command Palette
        if ((e.ctrlKey && e.key === 'k') || (e.ctrlKey && e.shiftKey && e.key === 'P')) {
            e.preventDefault();
            if (isPaletteOpen()) closePalette(); else openPalette();
            return;
        }

        // If palette is open, let its own handler deal with keys
        if (isPaletteOpen()) return;

        // Skip remaining shortcuts if user is typing in an input
        if (isInput) return;

        // Ctrl+W — Close focused window
        if (e.ctrlKey && !e.shiftKey && e.key === 'w') {
            e.preventDefault();
            closeFocusedWindow();
            return;
        }
        // Ctrl+M — Minimize focused window
        if (e.ctrlKey && !e.shiftKey && e.key === 'm') {
            e.preventDefault();
            minimizeFocusedWindow();
            return;
        }
        // Ctrl+ArrowUp — Maximize focused window
        if (e.ctrlKey && e.key === 'ArrowUp') {
            e.preventDefault();
            maximizeFocusedWindow();
            return;
        }
        // Ctrl+ArrowLeft — Snap left
        if (e.ctrlKey && e.key === 'ArrowLeft') {
            e.preventDefault();
            snapFocusedWindow('left');
            return;
        }
        // Ctrl+ArrowRight — Snap right
        if (e.ctrlKey && e.key === 'ArrowRight') {
            e.preventDefault();
            snapFocusedWindow('right');
            return;
        }
        // Ctrl+Tab — Cycle windows forward
        if (e.ctrlKey && !e.shiftKey && e.key === 'Tab') {
            e.preventDefault();
            cycleWindows(false);
            return;
        }
        // Ctrl+Shift+Tab — Cycle windows reverse
        if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
            e.preventDefault();
            cycleWindows(true);
            return;
        }
        // Ctrl+D — Show desktop
        if (e.ctrlKey && !e.shiftKey && e.key === 'd') {
            e.preventDefault();
            toggleShowDesktop();
            return;
        }
        // Ctrl+L — Lock screen
        if (e.ctrlKey && !e.shiftKey && e.key === 'l') {
            e.preventDefault();
            if (typeof lockScreen === 'function') lockScreen();
            return;
        }
        // F11 — Toggle fullscreen
        if (e.key === 'F11') {
            e.preventDefault();
            if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
            else document.exitFullscreen?.();
            return;
        }
        // Alt+1 through Alt+9 — Open app by taskbar position
        if (e.altKey && e.key >= '1' && e.key <= '9') {
            e.preventDefault();
            const idx = parseInt(e.key) - 1;
            const taskbarItems = document.querySelectorAll('#nowrunninapps .taskbar-item');
            if (taskbarItems[idx]) {
                const wid = taskbarItems[idx].getAttribute('winid');
                if (wid) {
                    putwinontop('window' + wid);
                    minim(wid);
                }
            } else {
                // Try dock pinned apps
                const dockItems = document.querySelectorAll('#dock .adock');
                if (dockItems[idx]) dockItems[idx].click();
            }
            return;
        }
        // Escape — close palette (handled above), close top modal
        if (e.key === 'Escape') {
            // Let existing handlers deal with dialog closing
            return;
        }
    }, true); // capture phase so we can intercept before other handlers

    // ── Expose for external use ───────────────────────────────────
    window.PumpCommandPalette = { open: openPalette, close: closePalette, isOpen: isPaletteOpen };
})();
