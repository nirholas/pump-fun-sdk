# PumpOS Platform Guide

User guide and developer reference for the PumpOS web desktop environment.

> **Live:** The PumpOS desktop is deployed at the project's website, accessible via any modern browser.

---

## What is PumpOS?

PumpOS is a web-based desktop environment built around the Pump SDK ecosystem. It provides a familiar windowed interface with a taskbar, app store, and file system — all running in the browser with no installation required.

### Key Features

| Feature | Description |
|---------|-------------|
| **Window Manager** | Draggable, resizable windows with minimize/maximize/close |
| **Taskbar** | Running apps, system tray, clock |
| **App Store** | 169 installable apps across DeFi, analytics, utilities, and more |
| **File System** | Virtual filesystem persisted in localStorage |
| **Themes** | Light/dark mode, wallpaper customization |
| **PWA** | Install as a Progressive Web App for offline access |
| **Service Worker** | Offline caching for core shell and installed apps |

---

## App Categories

### DeFi & Trading

| App | Description |
|-----|-------------|
| Fee Manager | View vault balances, claim fees, manage shareholders |
| Token Creator | Launch new tokens with metadata wizard |
| Token Trader | Buy/sell tokens on bonding curves |
| Portfolio Tracker | View held tokens, entry prices, P&L |
| Swap | Token swap interface |
| Wallet | Balance viewer and transaction history |

### Analytics

| App | Description |
|-----|-------------|
| Bonding Curve Viewer | Visualize curve state, reserves, graduation progress |
| Price Charts | Token price history and charts |
| Whale Tracker | Monitor large trades |
| Market Overview | Top tokens by volume, market cap, age |

### Utilities

| App | Description |
|-----|-------------|
| Vanity Generator | Browser-based vanity address generation (keys never leave browser) |
| Address Lookup | Resolve addresses to labels |
| TX Explorer | View transaction details |
| Settings | System preferences, theme, RPC configuration |

### Information

| App | Description |
|-----|-------------|
| Documentation | Embedded docs viewer |
| Tutorials | Interactive tutorial browser |
| News Feed | Crypto news aggregator |

---

## Architecture

### Directory Structure

```
site/
├── index.html         # Main desktop shell (window manager, taskbar, app loader)
├── pump.css           # Core desktop styles
├── pump.js            # Window manager and app lifecycle
├── system32.js        # System utilities and file operations
├── script.js          # App store and installation logic
├── style.css          # Additional styles
├── sw.js              # Service worker for offline caching
├── webmanifest.json   # PWA manifest
├── Pump-Store/        # App definitions and metadata
├── screens/           # App HTML files (one per app)
├── assets/            # Icons, images, wallpapers
├── appdata/           # App data templates
├── libs/              # Shared JavaScript libraries
├── scripts/           # Helper scripts
└── workers/           # Web workers for background tasks
```

### How Apps Work

Each app is a self-contained HTML file in `screens/` or `Pump-Store/apps/`. When a user clicks an app icon:

1. **Window Manager** creates a new window (`<div>` with drag/resize handlers)
2. The app HTML is loaded into an `<iframe>` inside the window
3. Apps communicate with the shell via `postMessage` API
4. On close, the window and iframe are destroyed

### App Communication Protocol

Apps can interact with the PumpOS shell:

```javascript
// From inside an app iframe:

// Request: ask the shell for data
window.parent.postMessage({
  type: 'request',
  action: 'getBalance',
  data: { address: '...' }
}, '*');

// Listen for responses
window.addEventListener('message', (event) => {
  if (event.data.type === 'response') {
    console.log('Balance:', event.data.result);
  }
});
```

### Storage

| Storage | Scope | Persistence |
|---------|-------|-------------|
| `localStorage` | Per-origin | Persistent until cleared |
| `sessionStorage` | Per-tab | Cleared on tab close |
| Virtual File System | Shell-managed | localStorage-backed |
| IndexedDB | Per-app | Persistent, larger capacity |

---

## Developing a New App

### 1. Create the App HTML

Create a new file in `site/Pump-Store/apps/` or `site/screens/`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
  <style>
    body {
      font-family: -apple-system, system-ui, sans-serif;
      margin: 0;
      padding: 16px;
      background: #0a0a0a;
      color: #e0e0e0;
    }
  </style>
</head>
<body>
  <h2>My Custom App</h2>
  <div id="content"></div>

  <script>
    // Your app logic here
    document.getElementById('content').textContent = 'Hello from PumpOS!';
  </script>
</body>
</html>
```

### 2. Register in the App Store

Add your app to the store registry in `site/Pump-Store/`:

```json
{
  "name": "My App",
  "icon": "🔧",
  "category": "utilities",
  "description": "A custom utility app",
  "file": "apps/my-app.html",
  "version": "1.0.0"
}
```

### 3. Style Guidelines

- Use dark theme by default (`background: #0a0a0a`, `color: #e0e0e0`)
- Responsive — apps can be any window size
- No external CDN dependencies — bundle everything or use `site/libs/`
- Prefer emoji for icons (consistent with PumpOS aesthetic)

### 4. Security Rules

- **Keys never leave the browser** — all crypto operations must be client-side
- **No external requests without user consent** — apps shouldn't phone home
- **Sanitize all user input** — apps run in iframes but share the origin
- **Use `@solana/web3.js`** for any Solana operations — no third-party crypto

---

## Deployment

### Vercel (Recommended)

```bash
cd site
vercel --prod
```

The `site/vercel.json` handles routing.

### GitHub Pages

Push the `site/` directory to a `gh-pages` branch or configure GitHub Actions.

### Custom Domain

1. Add a `CNAME` file in `site/` with your domain
2. Configure DNS to point to your host
3. Enable HTTPS

---

## PWA Installation

PumpOS can be installed as a Progressive Web App:

1. Visit the site in Chrome/Edge/Safari
2. Click the "Install" prompt in the address bar (or browser menu → "Install App")
3. PumpOS appears as a standalone app with its own window

The service worker (`sw.js`) caches the shell, styles, and installed app pages for offline use.
