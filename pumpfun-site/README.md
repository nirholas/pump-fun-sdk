<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

<img src="https://img.shields.io/badge/Solana-Token_Launchpad-7bff69?style=for-the-badge&logo=solana&logoColor=white" alt="Solana Token Launchpad" />

# 🟢 Solana Launchpad UI

**Open-source token launchpad frontend inspired by pump.fun**

Dark theme · Bonding curves · Trading panel · 4 pages · Pure HTML/CSS/JS · Zero dependencies

[![Live Demo](https://img.shields.io/badge/Live_Demo-▶_View-7bff69?style=flat-square)](https://solana-launchpad-ui.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Stars](https://img.shields.io/github/stars/nirholas/solana-launchpad-ui?style=flat-square&color=yellow)](https://github.com/nirholas/solana-launchpad-ui/stargazers)
[![Forks](https://img.shields.io/github/forks/nirholas/solana-launchpad-ui?style=flat-square)](https://github.com/nirholas/solana-launchpad-ui/network/members)
[![Issues](https://img.shields.io/github/issues/nirholas/solana-launchpad-ui?style=flat-square)](https://github.com/nirholas/solana-launchpad-ui/issues)

<br />

[**Live Demo**](https://solana-launchpad-ui.vercel.app) · [**Report Bug**](https://github.com/nirholas/solana-launchpad-ui/issues/new?template=bug_report.md) · [**Request Feature**](https://github.com/nirholas/solana-launchpad-ui/issues/new?template=feature_request.md)

</div>

---

## 📸 Screenshots

| Board | Token Detail | Create Token |
|:---:|:---:|:---:|
| Token grid, King of the Hill, activity ticker | Price chart, buy/sell panel, holders | Token creation form, social links |

> **Note:** Screenshots coming soon — deploy it yourself and see!

## ✨ Features

- 🌑 **Dark theme** — neon green accent, pump.fun-inspired aesthetic
- 📱 **Fully responsive** — mobile-first with breakpoints at 480/768/1024px
- 📊 **Token board** — filterable grid with market cap, bonding curve progress, price changes
- 👑 **King of the Hill** — highlighted hero banner for top-performing token
- 📈 **Trading UI** — buy/sell toggle, quick amount buttons (1/5/10 SOL), slippage control
- 📉 **SVG price chart** — candlestick-style placeholder chart
- 🎢 **Bonding curve progress** — visual progress bars on every token card
- 💬 **Thread/comments** — community chat section with emoji avatars
- 📜 **Transaction table** — buy/sell history with color-coded rows
- 🥧 **Holder distribution** — ranked list with percentage bars
- 🏷️ **Tab navigation** — Terminal, Trending, Top, New, Graduating, Graduated
- 📡 **Activity ticker** — horizontally scrolling feed of recent trades
- 🎨 **Token creation form** — image upload, metadata, social links, mayhem mode
- 👤 **Profile page** — created/held tokens, activity history, favorites
- ✨ **Fade-in animations** — staggered card entrance effects
- 💀 **Skeleton loading** — shimmer CSS class for loading states
- 🚫 **Zero dependencies** — pure HTML, CSS, and vanilla JavaScript
- ⚡ **Instant deploy** — works on Vercel, Netlify, GitHub Pages, any static host

## 🚀 Quick Start

### Option 1: Clone & Open

```bash
git clone https://github.com/nirholas/solana-launchpad-ui.git
cd solana-launchpad-ui
open index.html
```

### Option 2: Local Server

```bash
# Using npx (Node.js)
npx serve .

# Using Python
python3 -m http.server 8000

# Using PHP
php -S localhost:8000
```

### Option 3: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/nirholas/solana-launchpad-ui)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/nirholas/solana-launchpad-ui)

## 📁 Project Structure

```
solana-launchpad-ui/
├── index.html          # Token board — grid, tabs, King of the Hill, ticker
├── create.html         # Token creation form — metadata, socials, settings
├── token.html          # Token detail — chart, trading panel, holders, thread
├── profile.html        # User profile — portfolio, activity, favorites
├── styles.css          # All styles — dark theme, responsive, animations
├── app.js              # Mock data, interactions, tab switching
├── vercel.json         # Vercel deployment config with security headers
├── LICENSE             # MIT License
├── CONTRIBUTING.md     # Contribution guidelines
├── SECURITY.md         # Security policy
└── CHANGELOG.md        # Version history
```

## 📄 Pages

### 🏠 Board (`index.html`)

The main token listing page:
- **Tab bar** — filter by Terminal, Trending, Top, New, Graduating, Graduated
- **Search** — filter tokens by name or ticker
- **Token cards** — name, ticker, market cap, price change %, bonding curve progress bar, creation time
- **King of the Hill** — highlighted banner for the top token
- **Activity ticker** — horizontally scrolling feed of recent trades

### 🎨 Create (`create.html`)

Token creation form:
- Token name, ticker, description
- Image upload with preview
- Social links (Twitter, Telegram, Website, GitHub)
- Creator fee toggle and fee sharing
- Mayhem mode option

### 📊 Trade (`token.html`)

Full token detail page:
- **SVG price chart** — placeholder candlestick visualization
- **Buy/Sell panel** — toggle buy/sell, quick amounts (1, 5, 10 SOL), slippage, max
- **Token stats** — market cap, price, 24h volume, 24h change, holders, supply
- **Bonding curve** — visual progress indicator
- **Thread** — community chat with emoji avatars and timestamps
- **Transactions** — table of recent trades with SOL/token amounts
- **Holder distribution** — ranked list with percentage bars

### 👤 Profile (`profile.html`)

User profile page:
- Wallet address display
- Created tokens grid
- Held tokens with current values
- Activity history timeline
- Favorites list

## 🎨 Customization

### Color Scheme

Edit CSS variables in `styles.css` `:root`:

```css
:root {
  --green: #7bff69;           /* Primary accent */
  --green-dim: #5bcc4d;       /* Hover state */
  --red: #ff4d4d;             /* Sell / negative */
  --bg: #0e0e16;              /* Page background */
  --bg-secondary: #12121e;    /* Secondary background */
  --bg-card: #181825;         /* Card background */
  --bg-card-hover: #1e1e30;   /* Card hover */
  --border: #2a2a3e;          /* Border color */
  --text: #e2e2e2;            /* Primary text */
  --text-secondary: #8888a0;  /* Muted text */
}
```

### Fonts

Uses [Inter](https://fonts.google.com/specimen/Inter) from Google Fonts. Change the `<link>` tag in each HTML file to swap.

### Connecting Real Data

Replace mock data in `app.js` with API calls:

```javascript
// Replace mock data:
const MOCK_TOKENS = [ ... ];

// With your API:
const tokens = await fetch('https://your-api.com/tokens').then(r => r.json());
```

### Integrating Solana Wallets

Add wallet adapter for real blockchain interaction:

```html
<script src="https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js"></script>
<script>
  // Connect to Phantom, Solflare, etc.
  const provider = window.solana;
  await provider.connect();
  console.log('Connected:', provider.publicKey.toString());
</script>
```

## 🌐 Deployment

### Vercel (Recommended)

```bash
npm i -g vercel
vercel
```

Or use the one-click deploy button above. The included `vercel.json` handles routing and security headers.

### Netlify

```bash
netlify deploy --prod --dir=.
```

### GitHub Pages

1. Go to repo Settings → Pages
2. Source: "Deploy from a branch"
3. Branch: `main`, folder: `/ (root)`
4. Save — live at `https://username.github.io/solana-launchpad-ui`

### Any Static Host

Upload all files to any web server. No build step required.

## 🔧 Tech Stack

| Technology | Purpose |
|-----------|---------|
| HTML5 | Semantic markup |
| CSS3 | Custom properties, Grid, Flexbox, animations |
| Vanilla JS | DOM manipulation, mock data, interactions |
| Google Fonts | Inter typeface |
| Vercel | Hosting & CDN |

**Zero dependencies. No npm. No build tools. No frameworks.**

## 🗺️ Roadmap

- [ ] Real-time WebSocket token feed
- [ ] Wallet adapter integration (Phantom, Solflare, Backpack)
- [ ] Live bonding curve chart with D3.js
- [ ] Token search with autocomplete
- [ ] Dark/Light theme toggle
- [ ] i18n / multi-language support
- [ ] PWA support (service worker, offline mode)
- [ ] Token creation wizard with step-by-step flow

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repo
2. Create your branch (`git checkout -b feature/cool-feature`)
3. Commit changes (`git commit -m 'Add cool feature'`)
4. Push (`git push origin feature/cool-feature`)
5. Open a Pull Request

## 📜 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.

## 🔗 Related Projects

- [Pump SDK](https://github.com/nirholas/pump-fun-sdk) — TypeScript SDK for the Pump protocol on Solana
- [pump.fun](https://pump.fun) — The original Solana token launchpad

## 🙏 Acknowledgments

- Inspired by [pump.fun](https://pump.fun) — the original Solana token launchpad
- Part of the [Pump SDK](https://github.com/nirholas/pump-fun-sdk) ecosystem
- Built with 💚 for the Solana community

---

<div align="center">

**[Live Demo](https://solana-launchpad-ui.vercel.app)** · **[Pump SDK](https://github.com/nirholas/pump-fun-sdk)** · **[Report Issue](https://github.com/nirholas/solana-launchpad-ui/issues)**

Made with 💚 by [@nirholas](https://github.com/nirholas)

**If this helped you, give it a ⭐ — it helps others find it!**

</div>
