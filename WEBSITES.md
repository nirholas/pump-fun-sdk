# Web Directories — Consolidation Guide

The repository contains three web directories, each with a distinct purpose. They are **intentionally separate** — do not merge them.

## Directory Map

| Directory | Purpose | Tech | Deploys To |
|-----------|---------|------|------------|
| [`website/`](website/) | SDK documentation & marketing site | Vanilla HTML/CSS/JS SPA | Cloudflare Workers: [sdk.pumpk.it](https://sdk.pumpk.it) |
| [`pumpfun-site/`](pumpfun-site/) | pump.fun UI design template | Vanilla HTML/CSS/JS (4 pages) | Cloudflare Workers: [demo.pumpk.it](https://demo.pumpk.it) |
| [`site/`](site/) | PumpOS — full web desktop OS | Vanilla JS + PWA + Service Worker | Cloudflare Workers: [os.pumpk.it](https://os.pumpk.it) |

## When to Use Each

- **Building SDK docs or landing pages?** → `website/`
- **Designing pump.fun-style UI mockups?** → `pumpfun-site/`
- **Adding PumpOS apps or desktop features?** → `site/`

## Quick Start

All three are static sites with no build step:

```bash
# SDK docs site
cd website && npx serve .

# pump.fun design template
cd pumpfun-site && npx serve .

# PumpOS web desktop
cd site && npx serve .
```

## Color Palettes

Each site uses a different green accent by design:

| Site | Primary Green | Background | Purpose |
|------|---------------|------------|---------|
| `website/` | `#00ff88` | `#0a0a0f` | SDK branding — bright mint |
| `pumpfun-site/` | `#7bff69` | `#0e0e16` | Matches pump.fun UI |
| `site/` | `#5be45b` | Varies | PumpOS desktop theme |

## Security Headers

All three `vercel.json` configs include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (or `SAMEORIGIN` for PumpOS which uses iframes)
- `Referrer-Policy: strict-origin-when-cross-origin`
- Cache headers for static assets (CSS/JS)

PumpOS (`site/`) additionally has a Content-Security-Policy with frame-ancestors for allowed embed domains.

## Related

- [`live/`](live/) — Standalone browser dashboards (token launches, trades, vanity generator)
- [`websocket-server/`](websocket-server/) — Real-time data relay consumed by `site/` live dashboard
