# Solana Launchpad UI — Agent Guidelines

> Static token launchpad UI template inspired by pump.fun. Zero dependencies — pure HTML/CSS/JS.

## Project Overview

This is a **static design template** for a Solana token launchpad. It displays mock data and has no blockchain integration. The purpose is to provide a starting point for developers building token launchpads.

## Architecture

| File | Purpose |
|------|---------|
| `index.html` | Board page — token grid, tabs, King of the Hill banner, activity ticker |
| `create.html` | Token creation form — metadata, image upload, social links |
| `token.html` | Token detail — SVG chart, buy/sell panel, holders, thread, transactions |
| `profile.html` | User profile — portfolio, created tokens, activity history |
| `styles.css` | Complete stylesheet — dark theme, responsive, CSS custom properties, animations |
| `app.js` | Mock data arrays, DOM interactions, tab switching, card rendering |
| `vercel.json` | Vercel deployment config with security headers |

## Critical Rules

1. **ZERO DEPENDENCIES** — No npm, no CDN scripts, no build tools, no frameworks
2. **Vanilla JS only** — ES6+ features are fine, but no external libraries
3. **CSS custom properties** — Always use `:root` variables, never hardcode colors
4. **Mobile-first** — Base styles for small screens, `@media` for larger
5. **Mock data** — All data lives in `app.js`, no real API calls
6. **Semantic HTML** — Use `<nav>`, `<main>`, `<section>`, `<article>`, etc.
7. **Accessible** — ARIA labels, alt text, keyboard navigation

## Design System

### Colors
- Primary: `--green: #7bff69` (neon green)
- Negative: `--red: #ff4d4d`
- Background: `--bg: #0e0e16` (near-black)
- Cards: `--bg-card: #181825`
- Text: `--text: #e2e2e2`

### Typography
- Font: Inter (Google Fonts)
- Weights: 400, 500, 600, 700, 800, 900

### Breakpoints
- Mobile: `< 480px`
- Tablet: `768px`
- Desktop: `1024px`

## Related Projects

- [Pump SDK](https://github.com/nirholas/pump-fun-sdk) — TypeScript SDK for the Pump protocol on Solana
