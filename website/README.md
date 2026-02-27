# PumpOS Website

Web desktop for the Pump Fun SDK — token creation, bonding curves, DeFi tools, and wallet management on Solana.

Source: https://github.com/nirholas/pump-fun-sdk/tree/main/website

## Overview

PumpOS is a full web-based desktop environment featuring a taskbar, windowed applications, an app store, and a service worker for offline support. It serves as the documentation hub and interactive playground for the Pump SDK.

## Features

- **Desktop Environment** — Draggable, resizable windows with taskbar and system tray
- **Pump-Store** — 143 installable apps covering DeFi dashboards, trading tools, charts, wallet viewers, Pump SDK reference, and more
- **Live Trades Dashboard** — Real-time token launch and trade analytics via WebSocket relay (`live.html`)
- **Service Worker** — Offline-capable with `sw.js` caching
- **BIOS Screen** — Boot animation at `bios.html`
- **Plugin System** — Extensible via `plugin-demo.html`

## Directory Structure

```
website/
├── index.html              # Main PumpOS desktop
├── live.html               # Live trades dashboard (WebSocket)
├── bios.html               # Boot animation
├── newtab.html             # New tab page
├── Pump-Store/             # 143 installable apps
│   ├── apps/               # Individual app HTML files
│   └── db/                 # App metadata
├── api/                    # Serverless API endpoints
├── assets/                 # Icons, images, fonts
├── docs/                   # In-app documentation
├── libs/                   # Third-party libraries
├── scripts/                # Utility scripts
├── src/                    # Source modules
├── tools/                  # Developer tools
├── uv/                     # UV proxy
├── workers/                # Web workers
├── style.css               # Main stylesheet
├── pump.css                # Pump theme
├── script.js               # Main application logic
├── system32.js             # System utilities
├── sw.js                   # Service worker
└── vercel.json             # Vercel deployment config
```

## Deployment

Deployed on Vercel as a static site. See `vercel.json` for routing rules.

## Local Development

```bash
# Serve locally with any static file server
npx serve website/
```