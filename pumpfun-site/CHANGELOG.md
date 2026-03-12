# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] — 2025-03-12

### Added

- **Board page** (`index.html`) — token grid with tabs (Terminal, Trending, Top, New, Graduating, Graduated), King of the Hill banner, activity ticker
- **Create page** (`create.html`) — token creation form with image upload, social links, mayhem mode, creator fee sharing
- **Trade page** (`token.html`) — SVG price chart, buy/sell panel with quick amounts and slippage control, thread/comments, transaction table, holder distribution
- **Profile page** (`profile.html`) — user portfolio, created/held tokens, activity history, favorites
- **Dark theme** with neon green accent and CSS custom properties
- **Responsive design** — mobile-first with breakpoints at 480px, 768px, 1024px
- **Activity ticker** — scrolling horizontal trade feed
- **Bonding curve progress bars** on token cards
- **Fade-in animations** with staggered card entrance
- **Skeleton loading** shimmer CSS class
- **Vercel deployment config** with security headers (CSP, X-Frame-Options, nosniff)
- **Mock data** — realistic token data for development and demos
- Zero dependencies — pure HTML, CSS, vanilla JavaScript
