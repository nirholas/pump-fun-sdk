---
name: pump-website
description: "PumpOS — static HTML/CSS/JS web desktop for the Pump SDK with 169 Pump-Store apps, live token dashboards, interactive DeFi tools, PWA support, and Vercel deployment."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
---

# PumpOS Website — Static Web Desktop

PumpOS is a fully static HTML/CSS/JS web desktop environment — a browser-based OS simulation themed around Solana DeFi. No framework, no build step. Deployed on Vercel at `pumpos.app`.

## Key Files

| File | Purpose |
|------|---------|
| `website/index.html` | Desktop shell — taskbar, windows, start menu, wallpaper |
| `website/script.js` | App management, window lifecycle, taskbar, default apps |
| `website/system32.js` | OS kernel — event bus, IPC routing, user system |
| `website/pump.css` | Design system tokens — colors, spacing, radii, easing |
| `website/style.css` | Full component styles — windows, taskbar, menus |
| `website/sw.js` | Service worker — cache-first PWA |
| `website/live.html` | Real-time token launch dashboard (WebSocket relay) |
| `website/vercel.json` | Static deployment config with SPA rewrite |

## Architecture

- Single HTML page (`index.html`) as the desktop shell
- Apps loaded as HTML fragments in iframes
- `system32.js` provides event bus + IPC between apps via `postMessage`
- `script.js` manages window lifecycle, taskbar, and 30 built-in apps
- 24 JS modules in `website/scripts/` (kernel, window manager, wallet-connect, etc.)

## Pump-Store Apps (143)

All in `website/Pump-Store/apps/` as individual `.html` files. Database at `Pump-Store/db/v2.json`. Categories:
- **DeFi tools** — bonding curve calculator, DEX aggregator, fee manager, fee tier explorer
- **Trading** — trading signals, token sniper, multichart, orderbook, watchlist
- **Analytics** — on-chain analytics, whale flow, smart money, correlation matrix
- **Monitoring** — liquidation heatmap, gas predictor, MEV detector, whale alerts
- **Portfolio** — portfolio tracker, PnL leaderboard, position calculator
- **SDK-specific** — pump-sdk-reference, token-launcher, token-launch-sim, creator-fee-sharing, migration-tracker

## Design System

CSS custom properties in `pump.css`:
- Primary accent: `#00e87b` (Pump green)
- Background: `#0a0a0a` → `#111111` → `#1a1a1a` (dark theme)
- Border radius: 3-tier system (`0.7em` / `0.35em` / `0.233em`)
- Responsive breakpoint at 768px
- Custom cubic-bezier easing curves

## PWA Support

- Service worker with cache-first strategy
- Web app manifest with standalone display mode
- `web+pump://` protocol handler
- Installable with proper icons (512×512)

## Deployment

- Vercel (static, no framework, no build command)
- SPA routing: all non-asset paths rewrite to `/index.html`
- `/libs/` and `/assets/` get immutable caching (1 year)
- API proxy function at `api/proxy.js`

## Patterns to Follow

- No frameworks — vanilla HTML/CSS/JS only
- Apps are self-contained HTML files loaded in iframes
- Use `system32.js` event bus for inter-app communication
- All crypto operations run client-side
- Use CSS custom properties from `pump.css` for theming

## Common Pitfalls

- Service worker caching may serve stale content — version your cache
- `system32.js` IPC requires apps to listen for `postMessage` events
- Pump-Store app HTML must be self-contained (no external dependencies beyond libs/)
- The `script.js` default app list controls first-launch pins — update it when adding built-in apps
