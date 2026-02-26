/* ─── LairOS Desktop Widget Engine ─── */

const WIDGET_GRID = 80;       // grid snap size in px
const WIDGET_SNAP = WIDGET_GRID / 2; // half-grid snap for finer positioning
const WIDGET_MIN_COLS = 1;
const WIDGET_MIN_ROWS = 1;

const WIDGET_SIZE_MAP = {
    '1x1': { w: 1, h: 1 },
    '2x1': { w: 2, h: 1 },
    '2x2': { w: 2, h: 2 },
    '3x2': { w: 3, h: 2 },
    '4x1': { w: 4, h: 1 },
    '4x2': { w: 4, h: 2 },
    '7x1': { w: 7, h: 1 },
};

const WIDGET_GAP = 20;         // px gap between auto-placed widgets

function getWidgetLayerBounds() {
    const layer = document.getElementById('widget-layer');
    const layerWidth = layer?.clientWidth || window.innerWidth;
    const layerHeight = layer?.clientHeight || window.innerHeight;
    return {
        maxX: Math.max(0, layerWidth),
        maxY: Math.max(0, layerHeight),
    };
}

function clampWidgetPosition(x, y, widthPx, heightPx) {
    const { maxX, maxY } = getWidgetLayerBounds();
    return {
        x: Math.min(Math.max(0, x), Math.max(0, maxX - widthPx)),
        y: Math.min(Math.max(0, y), Math.max(0, maxY - heightPx)),
    };
}

/* Static fallback — only used if computeDefaultWidgetPositions() somehow fails */
const DEFAULT_WIDGETS = [
    { id: 'w_clock',  src: '/Lair-Store/apps/widget-clock.html',       x: 40,  y: 40,  w: 2, h: 2, z: 10 },
    { id: 'w_ticker', src: '/Lair-Store/apps/widget-ticker.html',      x: 240, y: 40,  w: 4, h: 1, z: 11 },
    // Quick Launch is now the permanent sidebar — no longer a draggable widget
];

/**
 * Compute default widget positions spread across the desktop so they don't
 * overlap each other or the left-side desktop icon column.
 *
 * Layout strategy (at 1920×1080 reference):
 *   Top-left  area : Clock (2×2)             — sits beside the icon column
 *   Top-right area : Crypto Ticker (4×1)     — anchored to right side
 *   Mid-left  area : Quick Launch (4×1)      — below the clock
 *
 * Positions scale down gracefully on smaller screens.
 */
function computeDefaultWidgetPositions() {
    const layer = document.getElementById('widget-layer');
    const vw = (layer?.clientWidth  || window.innerWidth)  - 40;
    const vh = (layer?.clientHeight || window.innerHeight) - 120; // account for taskbar
    const G = WIDGET_GRID; // 80

    // Icon column is roughly 100px wide, start widgets after that
    const leftCol  = 120;                         // left region x
    const rightCol = Math.max(vw - 4 * G - 40, vw * 0.6); // right region x
    const midX     = Math.round(vw * 0.35);       // middle-ish x
    const topY     = 40;
    const midY     = Math.round(vh * 0.35);

    return [
        // Top-left: Clock (2×2 = 160×160)
        { id: 'w_clock',  src: '/Lair-Store/apps/widget-clock.html',
          x: leftCol, y: topY, w: 2, h: 2, z: 10 },

        // Top-right: Crypto Ticker (4×1 = 320×80)
        { id: 'w_ticker', src: '/Lair-Store/apps/widget-ticker.html',
          x: Math.round(rightCol), y: topY, w: 4, h: 1, z: 11 },

        // Quick Launch is now the permanent sidebar — no longer a draggable widget
    ];
}

/* Built-in widget catalog (always shown first in picker) */
const BUILTIN_WIDGETS = [
    { name: 'Clock',         src: '/Lair-Store/apps/widget-clock.html',       symbol: 'schedule',               cat: 'widget' },
    { name: 'Crypto Ticker', src: '/Lair-Store/apps/widget-ticker.html',      symbol: 'monitoring',             cat: 'widget' },
    { name: 'Quick Launch',  src: '/Lair-Store/apps/widget-quicklaunch.html', symbol: 'apps',                   cat: 'widget' },
    { name: 'Weather',       src: '/Lair-Store/apps/widget-weather.html',     symbol: 'cloud',                  cat: 'widget' },
    { name: 'Portfolio',     src: '/Lair-Store/apps/widget-portfolio.html',   symbol: 'account_balance_wallet', cat: 'widget' },
    { name: 'PnL Tracker',  src: '/Lair-Store/apps/widget-pnl.html',         symbol: 'trending_up',            cat: 'widget' },
    { name: 'Mini Chart',  src: '/Lair-Store/apps/widget-minichart.html',   symbol: 'show_chart',             cat: 'widget' },
    { name: 'Gas Tracker', src: '/Lair-Store/apps/widget-gas.html',          symbol: 'local_gas_station',      cat: 'widget' },
    { name: 'Fear & Greed', src: '/Lair-Store/apps/widget-feargreed.html',   symbol: 'speed',                  cat: 'widget' },
    { name: 'Top Movers',  src: '/Lair-Store/apps/widget-topmovers.html',  symbol: 'swap_vert',              cat: 'widget' },
    { name: 'Volume Leaders', src: '/Lair-Store/apps/widget-volume.html',  symbol: 'bar_chart',              cat: 'widget' },
];

/* ── State ─────────────────────────────── */
let activeWidgets = [];
let _widgetBlobUrls = [];       // track for cleanup
let _widgetMaxZ = 10;           // z-ordering counter
let _widgetsLocked = false;     // lock mode
let _widgetSettings = {};       // per-widget settings: { widgetId: { key: value } }
let _widgetSettingsSchemas = {}; // per-widget settings schemas from iframes

/* ── Persistence ───────────────────────── */

async function loadWidgetConfig() {
    try {
        const saved = await getSetting('desktopWidgets');
        if (saved && Array.isArray(saved) && saved.length > 0) {
            // Migration: detect old bunched-up default positions and recompute.
            // Old defaults had clock at (40,40), ticker at (240,40), quick at (400,325).
            // If all 3 default widgets still have those exact coords, user never moved
            // them — replace with the new spread-out layout.
            if (saved.length === 3) {
                const hasOldLayout = saved.some(w => w.id === 'w_clock'  && w.x === 40  && w.y === 40) &&
                                     saved.some(w => w.id === 'w_ticker' && w.x === 240 && w.y === 40) &&
                                     saved.some(w => w.id === 'w_quick'  && w.x === 400 && w.y === 325);
                if (hasOldLayout) {
                    const fresh = computeDefaultWidgetPositions();
                    await setSetting('desktopWidgets', fresh);
                    return fresh;
                }
            }
            // Migration: remove w_quick if present — now a permanent sidebar
            const filtered = saved.filter(w => w.id !== 'w_quick');
            if (filtered.length !== saved.length) {
                await setSetting('desktopWidgets', filtered);
                return filtered;
            }
            return saved;
        }
    } catch (_) {}
    return computeDefaultWidgetPositions();
}

async function saveWidgetConfig() {
    const clean = activeWidgets.map(({ id, src, x, y, w, h, name, z }) => ({ id, src, x, y, w, h, name, z }));
    await setSetting('desktopWidgets', clean);
}

async function loadLockState() {
    try {
        const v = await getSetting('widgetsLocked');
        _widgetsLocked = !!v;
    } catch (_) { _widgetsLocked = false; }
}

async function saveLockState() {
    await setSetting('widgetsLocked', _widgetsLocked);
}

async function loadWidgetSettings() {
    try {
        const v = await getSetting('widgetSettings');
        if (v && typeof v === 'object') _widgetSettings = v;
    } catch (_) {}
}

async function saveWidgetSettings() {
    await setSetting('widgetSettings', _widgetSettings);
}

/* ── Lock Mode ─────────────────────────── */

async function toggleWidgetLock() {
    _widgetsLocked = !_widgetsLocked;
    await saveLockState();
    document.getElementById('widget-layer')?.classList.toggle('widgets-locked', _widgetsLocked);
}

function isWidgetsLocked() {
    return _widgetsLocked;
}

/* ── Rendering ─────────────────────────── */

async function renderWidgets() {
    const layer = document.getElementById('widget-layer');
    if (!layer) return;

    // Revoke old blob URLs to free memory
    _widgetBlobUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) {} });
    _widgetBlobUrls = [];
    layer.innerHTML = '';

    await loadLockState();
    await loadWidgetSettings();
    activeWidgets = await loadWidgetConfig();

    // Apply lock class
    layer.classList.toggle('widgets-locked', _widgetsLocked);

    if (activeWidgets.length === 0) {
        layer.innerHTML = '<div class="widget-empty-hint">Right-click desktop to add widgets</div>';
        return;
    }

    // Determine max z-index
    _widgetMaxZ = activeWidgets.reduce((m, w) => Math.max(m, w.z || 0), 10);

    for (const w of activeWidgets) {
        const el = createWidgetElement(w);
        layer.appendChild(el);
        loadWidgetIframe(el, w); // don't await — load in parallel
    }
}

function createWidgetElement(w) {
    const el = document.createElement('div');
    el.className = 'desktop-widget';
    el.id = 'dw-' + w.id;
    el.setAttribute('data-widget-id', w.id);
    el.style.left = w.x + 'px';
    el.style.top = w.y + 'px';
    el.style.width = (w.w * WIDGET_GRID) + 'px';
    el.style.height = (w.h * WIDGET_GRID) + 'px';
    if (w.z) el.style.zIndex = w.z;
    el.style.touchAction = 'none';

    // Click to bring to front (z-ordering)
    el.addEventListener('mousedown', () => bringWidgetToFront(el, w));
    el.addEventListener('touchstart', () => bringWidgetToFront(el, w), { passive: true });

    // Drag handle (top area, invisible)
    const handle = document.createElement('div');
    handle.className = 'widget-drag-handle';
    el.appendChild(handle);

    // Remove button
    const rm = document.createElement('button');
    rm.className = 'widget-remove-btn';
    rm.innerHTML = '&times;';
    rm.title = 'Remove widget';
    rm.addEventListener('click', (e) => {
        e.stopPropagation();
        removeWidget(w.id);
    });
    el.appendChild(rm);

    // Settings button (hidden until widget declares settings)
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'widget-settings-btn';
    settingsBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:12px;">settings</span>';
    settingsBtn.title = 'Widget settings';
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openWidgetSettings(w.id);
    });
    el.appendChild(settingsBtn);

    // Content area for iframe
    const content = document.createElement('div');
    content.className = 'widget-content';
    el.appendChild(content);

    // Resize handle (bottom-right corner)
    const resize = document.createElement('div');
    resize.className = 'widget-resize-handle';
    el.appendChild(resize);

    attachWidgetDrag(el, handle, w);
    attachWidgetResize(el, resize, w);

    return el;
}

/* ── Z-Ordering ────────────────────────── */

function bringWidgetToFront(el, w) {
    _widgetMaxZ++;
    el.style.zIndex = _widgetMaxZ;
    w.z = _widgetMaxZ;
    saveWidgetConfig();
}

/* ── iframe loading ────────────────────── */

function extractBodyContent(html) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const headMatch = html.match(/<head[^>]*>([\s\S]*)<\/head>/i);
    return {
        head: headMatch ? headMatch[1] : '',
        body: bodyMatch ? bodyMatch[1] : html,
    };
}

async function loadWidgetIframe(el, w) {
    const content = el.querySelector('.widget-content');
    try {
        const resp = await fetch(w.src);
        if (!resp.ok) throw new Error('Fetch failed: ' + resp.status);
        const rawHtml = await resp.text();
        const { head, body } = extractBodyContent(rawHtml);

        // Inject lair.css if the widget requests it
        let styleBlock = '';
        if (rawHtml.includes('lair-include') && rawHtml.includes('lair.css')) {
            styleBlock = `<style>${lairdotcsscache || ''}</style>`;
        }

        // Inject saved settings as a global on the iframe window
        const savedSettings = _widgetSettings[w.id] || {};
const cfetchScript = `<script>window.LAIR_HOST="${location.origin}";window.cfetch=async function(u,o){try{var x=new URL(u,window.LAIR_HOST);if(x.origin===window.LAIR_HOST)return fetch(u,o)}catch(_){}var p=window.LAIR_HOST+"/api/proxy?url="+encodeURIComponent(u);if(o&&o.method&&o.method.toUpperCase()==="POST"){return fetch(p,{method:"POST",headers:{"Content-Type":"application/json"},body:o.body})}return fetch(p)}<\/script>`;
        const settingsScript = `<script>window.__widgetSettings = ${JSON.stringify(savedSettings)}; window.__widgetId = "${w.id}";<\/script>`;

        const blobHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${location.origin}/">${styleBlock}${cfetchScript}${settingsScript}${head}</head><body style="margin:0;overflow:hidden;background:transparent;">${body}</body></html>`;
        const blob = new Blob([blobHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        _widgetBlobUrls.push(url);

        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        iframe.setAttribute('data-widget-id', w.id);
        iframe.style.cssText = 'width:100%;height:100%;border:none;background:transparent;';
        content.appendChild(iframe);
    } catch (e) {
        console.error('Widget load error:', w.src, e);
        content.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;opacity:0.3;font-size:0.75rem;">Failed to load</div>';
    }
}

/* ── Disable/enable iframe pointer-events during interactions ── */

function disableWidgetIframes() {
    document.querySelectorAll('.widget-content iframe').forEach(f => f.style.pointerEvents = 'none');
}
function enableWidgetIframes() {
    document.querySelectorAll('.widget-content iframe').forEach(f => f.style.pointerEvents = '');
}

/* ── Widget Drag ───────────────────────── */

function attachWidgetDrag(el, handle, w) {
    let startX, startY, origX, origY, isDragging = false;

    function onDown(e) {
        if (_widgetsLocked) return; // locked — no dragging
        e.preventDefault();
        isDragging = true;
        const ev = e.touches ? e.touches[0] : e;
        startX = ev.clientX;
        startY = ev.clientY;
        origX = parseInt(el.style.left) || 0;
        origY = parseInt(el.style.top) || 0;
        el.classList.add('widget-dragging');
        disableWidgetIframes();
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
    }

    function onMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        const ev = e.touches ? e.touches[0] : e;
        const nextX = origX + ev.clientX - startX;
        const nextY = origY + ev.clientY - startY;
        const clamped = clampWidgetPosition(nextX, nextY, el.offsetWidth, el.offsetHeight);
        el.style.left = clamped.x + 'px';
        el.style.top = clamped.y + 'px';
    }

    function onUp() {
        if (!isDragging) return;
        isDragging = false;
        el.classList.remove('widget-dragging');
        enableWidgetIframes();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);

        // Snap to half-grid
        const snappedX = Math.round((parseInt(el.style.left) || 0) / WIDGET_SNAP) * WIDGET_SNAP;
        const snappedY = Math.round((parseInt(el.style.top) || 0) / WIDGET_SNAP) * WIDGET_SNAP;
        const clamped = clampWidgetPosition(snappedX, snappedY, el.offsetWidth, el.offsetHeight);
        el.style.left = clamped.x + 'px';
        el.style.top = clamped.y + 'px';

        w.x = clamped.x;
        w.y = clamped.y;
        saveWidgetConfig();
    }

    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
}

/* ── Widget Resize ─────────────────────── */

function attachWidgetResize(el, handle, w) {
    let startX, startY, origW, origH, isResizing = false;

    function onDown(e) {
        if (_widgetsLocked) return; // locked — no resizing
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        const ev = e.touches ? e.touches[0] : e;
        startX = ev.clientX;
        startY = ev.clientY;
        origW = el.offsetWidth;
        origH = el.offsetHeight;
        el.classList.add('widget-dragging');
        disableWidgetIframes();
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
    }

    function onMove(e) {
        if (!isResizing) return;
        e.preventDefault();
        const ev = e.touches ? e.touches[0] : e;
        const bounds = getWidgetLayerBounds();
        const currentLeft = parseInt(el.style.left) || 0;
        const currentTop = parseInt(el.style.top) || 0;
        const maxAllowedW = Math.max(WIDGET_MIN_COLS * WIDGET_GRID, bounds.maxX - currentLeft);
        const maxAllowedH = Math.max(WIDGET_MIN_ROWS * WIDGET_GRID, bounds.maxY - currentTop);
        const newW = Math.max(WIDGET_MIN_COLS * WIDGET_GRID, Math.min(maxAllowedW, origW + ev.clientX - startX));
        const newH = Math.max(WIDGET_MIN_ROWS * WIDGET_GRID, Math.min(maxAllowedH, origH + ev.clientY - startY));
        el.style.width = newW + 'px';
        el.style.height = newH + 'px';
    }

    function onUp() {
        if (!isResizing) return;
        isResizing = false;
        el.classList.remove('widget-dragging');
        enableWidgetIframes();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);

        // Snap size to grid
        const bounds = getWidgetLayerBounds();
        const currentLeft = parseInt(el.style.left) || 0;
        const currentTop = parseInt(el.style.top) || 0;
        const maxCols = Math.max(WIDGET_MIN_COLS, Math.floor((bounds.maxX - currentLeft) / WIDGET_GRID));
        const maxRows = Math.max(WIDGET_MIN_ROWS, Math.floor((bounds.maxY - currentTop) / WIDGET_GRID));

        const snappedW = Math.min(maxCols, Math.max(WIDGET_MIN_COLS, Math.round(el.offsetWidth / WIDGET_GRID)));
        const snappedH = Math.min(maxRows, Math.max(WIDGET_MIN_ROWS, Math.round(el.offsetHeight / WIDGET_GRID)));
        el.style.width = (snappedW * WIDGET_GRID) + 'px';
        el.style.height = (snappedH * WIDGET_GRID) + 'px';

        const clampedPos = clampWidgetPosition(currentLeft, currentTop, snappedW * WIDGET_GRID, snappedH * WIDGET_GRID);
        el.style.left = clampedPos.x + 'px';
        el.style.top = clampedPos.y + 'px';

        w.w = snappedW;
        w.h = snappedH;
        w.x = clampedPos.x;
        w.y = clampedPos.y;
        saveWidgetConfig();
    }

    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
}

/* ── Add / Remove ──────────────────────── */

/* Find a free position for a widget that doesn't overlap existing ones */
function findFreePosition(wCols, hRows) {
    const wPx = wCols * WIDGET_GRID;
    const hPx = hRows * WIDGET_GRID;
    const layer = document.getElementById('widget-layer');
    const vw = (layer?.clientWidth || window.innerWidth) - 40;
    const vh = (layer?.clientHeight || window.innerHeight) - 40;

    // Build list of occupied rectangles
    const occupied = activeWidgets.map(w => ({
        x1: w.x,
        y1: w.y,
        x2: w.x + w.w * WIDGET_GRID,
        y2: w.y + w.h * WIDGET_GRID
    }));

    function overlaps(x, y) {
        const nx1 = x, ny1 = y, nx2 = x + wPx, ny2 = y + hPx;
        return occupied.some(r =>
            nx1 < r.x2 + WIDGET_GAP && nx2 > r.x1 - WIDGET_GAP &&
            ny1 < r.y2 + WIDGET_GAP && ny2 > r.y1 - WIDGET_GAP
        );
    }

    // Start scanning from x=120 to avoid desktop icon column on the left
    const startX = 120;
    for (let y = 40; y + hPx <= vh; y += WIDGET_GRID) {
        for (let x = startX; x + wPx <= vw; x += WIDGET_GRID) {
            if (!overlaps(x, y)) return { x, y };
        }
    }

    // Fallback: place below all existing widgets
    const maxY = occupied.length > 0
        ? occupied.reduce((m, r) => Math.max(m, r.y2), 0) + WIDGET_GAP
        : 40;
    return { x: startX, y: maxY };
}

async function addWidget(src, name) {
    const id = 'w_' + Date.now();
    let wCols = 3, hRows = 2;

    // Read preferred size from meta tag
    try {
        const resp = await fetch(src);
        const html = await resp.text();
        const match = html.match(/lair-widget-size["']\s+content=["']([^"']+)/);
        if (match && WIDGET_SIZE_MAP[match[1]]) {
            wCols = WIDGET_SIZE_MAP[match[1]].w;
            hRows = WIDGET_SIZE_MAP[match[1]].h;
        }
    } catch (_) {}

    const pos = findFreePosition(wCols, hRows);
    const newW = { id, src, x: pos.x, y: pos.y, w: wCols, h: hRows, name: name || src, z: ++_widgetMaxZ };

    activeWidgets.push(newW);
    await saveWidgetConfig();
    await renderWidgets();
    return id;
}

async function removeWidget(id) {
    activeWidgets = activeWidgets.filter(w => w.id !== id);
    await saveWidgetConfig();
    // Animate out
    const el = document.getElementById('dw-' + id);
    if (el) {
        el.style.transition = 'opacity 0.2s, transform 0.2s';
        el.style.opacity = '0';
        el.style.transform = 'scale(0.9)';
        setTimeout(() => el.remove(), 200);
    }
    // Show empty hint if none left
    if (activeWidgets.length === 0) {
        const layer = document.getElementById('widget-layer');
        if (layer) layer.innerHTML = '<div class="widget-empty-hint">Right-click desktop to add widgets</div>';
    }
    // Clean up settings for removed widget
    delete _widgetSettings[id];
    delete _widgetSettingsSchemas[id];
    await saveWidgetSettings();
}

async function resetWidgets() {
    activeWidgets = computeDefaultWidgetPositions();
    _widgetSettings = {};
    _widgetSettingsSchemas = {};
    await saveWidgetConfig();
    await saveWidgetSettings();
    await renderWidgets();
}

/* ── Widget Settings Panel ─────────────── */

function openWidgetSettings(widgetId) {
    const schema = _widgetSettingsSchemas[widgetId];
    if (!schema || schema.length === 0) return; // no settings declared

    const current = _widgetSettings[widgetId] || {};
    const dialog = document.getElementById('widgetSettingsDialog');
    if (!dialog) return;

    const title = dialog.querySelector('.widget-settings-title');
    const body = dialog.querySelector('.widget-settings-body');
    const w = activeWidgets.find(w => w.id === widgetId);
    title.textContent = (w?.name || 'Widget') + ' Settings';
    body.innerHTML = '';

    schema.forEach(field => {
        const row = document.createElement('div');
        row.className = 'widget-settings-row';

        const label = document.createElement('label');
        label.textContent = field.label;
        label.className = 'widget-settings-label';
        row.appendChild(label);

        let input;
        const val = current[field.key] !== undefined ? current[field.key] : field.value;

        if (field.type === 'toggle') {
            input = document.createElement('button');
            input.className = 'widget-settings-toggle' + (val ? ' active' : '');
            input.textContent = val ? 'On' : 'Off';
            input.addEventListener('click', () => {
                const newVal = !input.classList.contains('active');
                input.classList.toggle('active', newVal);
                input.textContent = newVal ? 'On' : 'Off';
                updateWidgetSetting(widgetId, field.key, newVal);
            });
        } else if (field.type === 'select' && field.options) {
            input = document.createElement('select');
            input.className = 'widget-settings-select';
            field.options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt.value || opt;
                o.textContent = opt.label || opt;
                if (String(opt.value || opt) === String(val)) o.selected = true;
                input.appendChild(o);
            });
            input.addEventListener('change', () => updateWidgetSetting(widgetId, field.key, input.value));
        } else {
            input = document.createElement('input');
            input.className = 'widget-settings-input';
            input.type = field.type || 'text';
            input.value = val || '';
            input.addEventListener('input', () => updateWidgetSetting(widgetId, field.key, input.value));
        }

        row.appendChild(input);
        body.appendChild(row);
    });

    dialog.showModal();
}

async function updateWidgetSetting(widgetId, key, value) {
    if (!_widgetSettings[widgetId]) _widgetSettings[widgetId] = {};
    _widgetSettings[widgetId][key] = value;
    await saveWidgetSettings();
    // Send updated settings to the widget iframe
    const iframe = document.querySelector(`iframe[data-widget-id="${widgetId}"]`);
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'widgetSettingsUpdate', settings: _widgetSettings[widgetId] }, '*');
    }
}

/* ── Widget Picker Dialog ──────────────── */

async function openWidgetPicker() {
    const dialog = document.getElementById('widgetPickerDialog');
    if (!dialog) return;

    const grid = dialog.querySelector('.widget-picker-grid');
    grid.innerHTML = '<div style="opacity:0.3;padding:1rem;text-align:center;">Loading...</div>';
    dialog.showModal();

    const available = [];

    // 1. Built-in widgets (always first)
    BUILTIN_WIDGETS.forEach(w => available.push({ ...w }));

    // 2. Store apps
    try {
        const storeResp = await fetch('/Lair-Store/db/v2.json');
        const store = await storeResp.json();
        for (const app of store.apps || []) {
            if (app.src && !available.find(a => a.src === app.src)) {
                available.push({ name: app.name, src: app.src, symbol: app.symbol || 'widgets', cat: 'app' });
            }
        }
    } catch (_) {}

    grid.innerHTML = '';
    if (available.length === 0) {
        grid.innerHTML = '<div style="opacity:0.3;padding:1rem;text-align:center;">No widgets found</div>';
        return;
    }

    // Section: Widgets
    const widgets = available.filter(a => a.cat === 'widget');
    const apps = available.filter(a => a.cat !== 'widget');

    if (widgets.length) {
        const label = document.createElement('div');
        label.className = 'widget-picker-section';
        label.textContent = 'Widgets';
        grid.appendChild(label);
        widgets.forEach(app => grid.appendChild(createPickerCard(app)));
    }

    if (apps.length) {
        const label = document.createElement('div');
        label.className = 'widget-picker-section';
        label.textContent = 'Apps';
        grid.appendChild(label);
        apps.forEach(app => grid.appendChild(createPickerCard(app)));
    }
}

function createPickerCard(app) {
    const alreadyAdded = activeWidgets.some(w => w.src === app.src);
    const card = document.createElement('div');
    card.className = 'widget-picker-card' + (alreadyAdded ? ' added' : '');
    card.innerHTML = `
        <span class="material-symbols-rounded" style="font-size:1.5rem;opacity:0.7;">${app.symbol || 'widgets'}</span>
        <span class="widget-picker-name">${app.name}</span>
        ${alreadyAdded ? '<span class="widget-picker-badge">Added</span>' : ''}
    `;
    if (!alreadyAdded) {
        card.addEventListener('click', async () => {
            await addWidget(app.src, app.name);
            card.classList.add('added');
            const badge = document.createElement('span');
            badge.className = 'widget-picker-badge';
            badge.textContent = 'Added';
            card.appendChild(badge);
        });
    }
    return card;
}

/* ── Responsive Layout ─────────────────── */

let _reflowTimer = null;

function reflowWidgets() {
    const layer = document.getElementById('widget-layer');
    if (!layer || activeWidgets.length === 0) return;

    const vw = layer.clientWidth || window.innerWidth;
    const vh = layer.clientHeight || window.innerHeight;
    const isNarrow = vw < 600;

    if (isNarrow) {
        // Stack widgets in a single centered column with proper gaps
        let yOffset = 20;
        activeWidgets.forEach(w => {
            const el = document.getElementById('dw-' + w.id);
            if (!el) return;
            const wPx = Math.min(w.w * WIDGET_GRID, vw - 40);
            const xPos = Math.max(0, (vw - wPx) / 2);
            el.style.left = xPos + 'px';
            el.style.top = yOffset + 'px';
            el.style.width = wPx + 'px';
            w.x = xPos;
            w.y = yOffset;
            yOffset += el.offsetHeight + WIDGET_GAP;
        });
    } else {
        // Clamp widgets within viewport bounds
        activeWidgets.forEach(w => {
            const el = document.getElementById('dw-' + w.id);
            if (!el) return;
            const maxX = Math.max(0, vw - el.offsetWidth);
            const maxY = Math.max(0, vh - el.offsetHeight);
            if (w.x > maxX) {
                w.x = Math.max(0, maxX);
                el.style.left = w.x + 'px';
            }
            if (w.y > maxY) {
                w.y = Math.max(0, maxY);
                el.style.top = w.y + 'px';
            }
        });
    }

    saveWidgetConfig();
}

function _onWidgetResize() {
    clearTimeout(_reflowTimer);
    _reflowTimer = setTimeout(reflowWidgets, 250);
}

window.addEventListener('resize', _onWidgetResize);

/* ── Message handlers ──────────────────── */

window.addEventListener('message', (e) => {
    if (!e.data || !e.data.type) return;

    // Quick-launch: open an app from widget
    if (e.data.type === 'widgetOpenApp') {
        const appName = e.data.app;
        const map = {
            files: 'files', browser: 'browser', ai: 'lairai',
            defi: 'lairdefi', store: 'store', settings: 'settings'
        };
        const key = map[appName] || appName;
        try { openapp(key, 1); } catch (_) {}
    }

    // Settings: widget declares its settings schema
    if (e.data.type === 'widgetDeclareSettings') {
        const widgetId = e.data.widgetId;
        if (widgetId && Array.isArray(e.data.settings)) {
            _widgetSettingsSchemas[widgetId] = e.data.settings;
            const el = document.getElementById('dw-' + widgetId);
            if (el) el.classList.add('has-settings');
        }
    }
});
