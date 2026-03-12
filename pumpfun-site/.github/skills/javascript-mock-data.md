---
applyTo: "*.js"
---

# JavaScript & Mock Data Skill

## Architecture

All JavaScript is in a single `app.js` file:

1. **Mock data arrays** — at the top of the file
2. **DOM utility functions** — query helpers, formatting
3. **Page-specific logic** — card rendering, tab switching
4. **Event listeners** — attached at bottom

## Mock Data Pattern

Token data uses this shape:

```javascript
{
  name: "TokenName",
  ticker: "TICKER",
  image: "🟢",           // Emoji as placeholder
  marketCap: "$123.4K",
  change: "+12.3%",
  curveProgress: 65,      // Bonding curve %
  creator: "wallet_short",
  createdAgo: "2h ago",
  description: "...",
}
```

## Rules

- **No external libraries** — no jQuery, no lodash, no axios, no D3
- **ES6+ features** — `const/let`, arrow functions, template literals, destructuring
- **DOM manipulation** — use `document.querySelector`, `createElement`, `textContent`
- **No `innerHTML` with user data** — prevents XSS. Use `textContent` for text, `createElement` for structure
- **Event delegation** — prefer attaching listeners to parent containers

## Formatting Functions

When displaying financial data:
- Market cap: `$123.4K`, `$1.2M`, `$45.6B`
- Percentages: `+12.3%` (green) or `-5.2%` (red)
- SOL amounts: `1.234 SOL`
- Time: relative (`2h ago`, `5m ago`)

## Tab Switching Pattern

```javascript
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelector('.tab.active')?.classList.remove('active');
    tab.classList.add('active');
    // Filter/sort tokens based on tab
  });
});
```
