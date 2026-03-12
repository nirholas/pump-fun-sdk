# Pump SDK Website

PumpFun-styled documentation and information site for the Pump SDK.

## Structure

```
website/
├── index.html      # Single-page app with all pages
├── styles.css      # PumpFun-inspired dark theme
├── app.js          # Navigation, doc rendering, search
├── vercel.json     # Vercel deployment config
└── README.md       # This file
```

## Pages

- **Home** — Hero, stats, featured features, doc card grid, on-chain programs, quick start code
- **Docs** — Searchable documentation index with sidebar categories
- **SDK** — Architecture diagram, key types, import map, common pitfalls
- **Tools** — MCP server, live dashboards, vanity generators, bots, PumpOS
- **Ecosystem** — Project structure tree, performance metrics, security, links

## Development

```bash
# Serve locally
cd website
npx serve .

# Or with Python
python3 -m http.server 8080
```

## Deployment

Deploy `website/` to Vercel as a static site. The `vercel.json` handles SPA routing.

## Design

- Dark theme matching PumpFun aesthetic (#0a0a0f background, #00ff88 green accents)
- Token card pattern for documentation entries (with emoji icons, tickers, categories)
- Green/cyan/purple gradient accents
- Responsive mobile-first layouts
- No build step — pure HTML/CSS/JS
