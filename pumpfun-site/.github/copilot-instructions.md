# Solana Launchpad UI — Copilot Instructions

## Project Overview

Static token launchpad UI template inspired by pump.fun. **Zero dependencies** — pure HTML, CSS, vanilla JavaScript with mock data.

## Architecture

| File | Purpose |
|------|---------|
| `index.html` | Board — token grid, tabs, King of the Hill, activity ticker |
| `create.html` | Token creation form |
| `token.html` | Token detail — chart, buy/sell, holders, thread |
| `profile.html` | User profile — portfolio, activity |
| `styles.css` | All styles — dark theme, responsive, animations |
| `app.js` | Mock data, DOM interactions, tab switching |
| `vercel.json` | Deployment config with security headers |

## Rules

- **No dependencies.** Do not add npm packages, CDN scripts, or build tools. This is intentionally vanilla.
- **No frameworks.** No React, Vue, Svelte, etc.
- **CSS custom properties.** Use `:root` variables for colors, not hardcoded hex values.
- **Mobile-first.** Write base styles for mobile, then add `@media` queries for wider viewports.
- **Semantic HTML.** Use proper elements (`<nav>`, `<main>`, `<section>`, `<article>`, etc.)
- **Accessible.** Include ARIA labels, alt text, keyboard navigation.
- **Mock data only.** No real API calls. All data is in `app.js` arrays.

## Color Palette

```css
--green: #7bff69       /* Primary accent (buy, positive) */
--red: #ff4d4d         /* Sell, negative */
--bg: #0e0e16          /* Page background */
--bg-card: #181825     /* Card background */
--text: #e2e2e2        /* Primary text */
--text-secondary: #8888a0  /* Muted text */
```

## Responsive Breakpoints

| Breakpoint | Target |
|-----------|--------|
| `< 480px` | Mobile phone |
| `480–768px` | Large phone / small tablet |
| `768–1024px` | Tablet |
| `> 1024px` | Desktop |

## File Organization

- All CSS in `styles.css` — organized by section with comment headers
- All JS in `app.js` — mock data arrays at top, DOM logic below
- Each HTML page is self-contained (shared header/nav repeated)
