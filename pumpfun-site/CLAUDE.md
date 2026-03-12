# Solana Launchpad UI — Claude Instructions

> Static token launchpad frontend. Zero dependencies. Pure HTML/CSS/JS.

## Behavior Rules

- **No dependencies.** Never add npm packages, CDN scripts, or build tools.
- **No frameworks.** No React, Vue, Svelte, Angular. Vanilla only.
- **Read before editing.** Always read the file before modifying.
- **Use CSS variables.** Never hardcode hex colors — use `var(--green)`, `var(--bg)`, etc.
- **Mobile-first.** Base CSS is for mobile. Add `@media (min-width: ...)` for larger screens.
- **Mock data only.** Token data is in `app.js` arrays. No real API calls.

## File Layout

```
index.html     → Board (token grid, tabs, ticker)
create.html    → Create token form
token.html     → Token detail (chart, trading, holders)
profile.html   → User profile
styles.css     → All styles (dark theme, responsive, animations)
app.js         → Mock data + DOM logic
vercel.json    → Deployment config
```

## CSS Custom Properties

```css
--green: #7bff69           /* Primary accent */
--green-dim: #5bcc4d       /* Hover */
--red: #ff4d4d             /* Sell/negative */
--bg: #0e0e16              /* Background */
--bg-secondary: #12121e    /* Alt background */
--bg-card: #181825         /* Card */
--bg-card-hover: #1e1e30   /* Card hover */
--border: #2a2a3e          /* Borders */
--text: #e2e2e2            /* Primary text */
--text-secondary: #8888a0  /* Muted text */
```

## Common Pitfalls

1. **Adding npm packages** — FORBIDDEN. Zero dependencies is the whole point.
2. **Hardcoding colors** — Use CSS variables from `:root`.
3. **Desktop-first CSS** — Write mobile base styles, expand with media queries.
4. **Breaking the nav** — Header markup is repeated in each HTML file. Change all 4.
5. **Real API calls** — This is a static template. Use mock data only.
