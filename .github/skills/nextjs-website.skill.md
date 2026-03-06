# PumpOS Website — Static Web Desktop with 169 Apps

## Skill Description

Build and maintain PumpOS — a fully static HTML/CSS/JS web desktop environment with 169 Pump-Store apps, live token dashboards, interactive DeFi tools, PWA support, and Vercel deployment. No framework, no build step.

## Context

PumpOS (`pumpos.app`) is a browser-based OS simulation themed around Solana DeFi. The entire desktop shell lives in a single `index.html` file. Apps are self-contained HTML files loaded in iframes. The kernel (`system32.js`) provides event bus and IPC routing between apps via `postMessage`. All crypto operations run client-side.

## Key Files

### Desktop Shell
- `website/index.html` — desktop shell (869 lines) — taskbar, windows, start menu, wallpaper
- `website/script.js` — app management, window lifecycle, taskbar, 30 default apps (3,187 lines)
- `website/system32.js` — OS kernel — event bus, IPC router, user system (1,310 lines)
- `website/pump.css` — design system tokens — colors, spacing, radii, easing (894 lines)
- `website/style.css` — full component styles — windows, taskbar, menus, scrollbars (4,678 lines)

### Script Modules (`website/scripts/`)
- `kernel.js`, `windman.js` — window management
- `commandpalette.js` — Cmd+K command palette
- `wallet-connect.js` — Solana wallet integration
- `systemtray.js`, `systemFeatures.js` — system tray features
- `notifications.js`, `onboarding.js` — UX features
- `widgets.js`, `smartmoney.js` — dashboard widgets
- `featureflags.js` — feature flag system
- `ctxmenu.js` — right-click context menus
- `readwrite.js` — virtual filesystem

### Special Pages
- `website/live.html` — real-time token launch dashboard (WebSocket relay)
- `website/bios.html` — boot/BIOS screen
- `website/newtab.html` — browser new-tab page
- `website/plugin-demo.html` — plugin SDK demo

### Built-in Apps (`website/appdata/`)
20+ apps: store, browser, calculator, camera, files, gallery, settings, terminal, studio, copilot, dashboard, portfolio, alerts

### Pump-Store Apps (`website/Pump-Store/apps/`)
169 installable apps as individual HTML files. Database at `Pump-Store/db/v2.json`.

### Configuration
- `website/vercel.json` — static deployment (SPA rewrite, immutable caching)
- `website/webmanifest.json` — PWA manifest (standalone, `web+pump://` protocol)
- `website/sw.js` — service worker (cache-first, offline support)
- `website/package.json` — metadata only (no build scripts)

### Developer Tools (`website/tools/`)
- `audit-store.js` — audit Pump-Store integrity
- `dedup-db.js` — deduplicate store database
- `generate-store-catalog.js` — generate store catalog
- `validate-apps.js` — validate app HTML files

## Key Concepts

### Desktop Architecture

Single-page app with OS-like window management:

```
index.html (shell)
├── Taskbar (bottom bar with pinned apps)
├── Start Menu (app launcher)
├── Desktop (wallpaper + icons)
└── Windows (draggable, resizable iframes)
    ├── Built-in apps (appdata/*.html)
    └── Pump-Store apps (Pump-Store/apps/*.html)
```

### IPC and Event Bus

Apps communicate via `system32.js` kernel:

```javascript
// App sending a message
parent.postMessage({
    type: 'pump-bus',
    target: 'portfolio',
    payload: { action: 'refresh' }
}, '*');

// App receiving messages
window.addEventListener('message', (event) => {
    if (event.data.type === 'pump-bus') {
        // Handle IPC message
    }
});
```

### Design System

CSS custom properties in `pump.css`:

```css
:root {
    --col-accent: #00e87b;        /* Pump green */
    --col-bg-0: #0a0a0a;          /* Deepest background */
    --col-bg-1: #111111;          /* Surface */
    --col-bg-2: #1a1a1a;          /* Elevated surface */
    --col-good: #00e87b;          /* Success */
    --col-bad: #ff4d4d;           /* Error */
    --border-radius-1: 0.7em;     /* Large radius */
    --border-radius-2: 0.35em;    /* Medium radius */
    --border-radius-3: 0.233em;   /* Small radius */
}
```

### PWA Support

- Cache-first service worker in `sw.js`
- Web app manifest with standalone display mode
- `web+pump://` custom protocol handler
- Installable with 512×512 icons
- Apple meta tags for iOS compatibility

## Patterns to Follow

- No frameworks — vanilla HTML/CSS/JS only
- Apps are self-contained HTML files loaded in iframes
- Use `system32.js` event bus for inter-app communication
- Use CSS custom properties from `pump.css` for consistent theming
- All crypto operations run client-side — never send keys to a server
- Store new apps in `Pump-Store/apps/` and register in `Pump-Store/db/v2.json`
- Keep tool scripts in `website/tools/` for store maintenance

## Common Pitfalls

- Service worker caching may serve stale content — update the whitelist version in `sw.js`
- `system32.js` IPC requires apps to listen for `postMessage` events with proper origin checks
- Pump-Store apps must be fully self-contained HTML (no external deps beyond `/libs/`)
- The `script.js` default app list controls first-launch desktop pins — update when adding built-in apps
- `vercel.json` SPA rewrite sends all non-asset paths to `index.html` — API routes need the `api/` function
- Mobile responsive breakpoint at 768px — test touch interactions for window management

## Deployment

- Hosted on Vercel at `pumpos.app`
- No build step — purely static files
- SPA routing via rewrite rules
- `/libs/` and `/assets/` get immutable caching (1 year max-age)
- API proxy serverless function at `api/proxy.js` (15s timeout, 256MB)

