# Web Directories — Consolidation Guide

The repository contains two web directories, each with a distinct purpose. They are **intentionally separate** — do not merge them.

## Directory Map

| Directory | Purpose | Tech | Deploys To |
|-----------|---------|------|------------|
| [`website/`](website/) | SDK documentation & marketing site | Vanilla HTML/CSS/JS SPA | Cloudflare Workers: [sdk.pumpk.it](https://sdk.pumpk.it) |
| [`pumpfun-site/`](pumpfun-site/) | pump.fun UI design template | Vanilla HTML/CSS/JS (4 pages) | Cloudflare Workers: [demo.pumpk.it](https://demo.pumpk.it) |

## When to Use Each

- **Building SDK docs or landing pages?** → `website/`
- **Designing pump.fun-style UI mockups?** → `pumpfun-site/`

## Quick Start

All three are static sites with no build step:

```bash
# SDK docs site
cd website && npx serve .

# pump.fun design template
cd pumpfun-site && npx serve .
```

## Color Palettes

Each site uses a different green accent by design:

| Site | Primary Green | Background | Purpose |
|------|---------------|------------|---------|
| `website/` | `#00ff88` | `#0a0a0f` | SDK branding — bright mint |
| `pumpfun-site/` | `#7bff69` | `#0e0e16` | Matches pump.fun UI |

## Security Headers

All three `vercel.json` configs include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- Cache headers for static assets (CSS/JS)

## Related

- [`live/`](live/) — Standalone browser dashboards (token launches, trades, vanity generator)
- [`websocket-server/`](websocket-server/) — Real-time data relay for the live dashboards
