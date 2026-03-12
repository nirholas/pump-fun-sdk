---
applyTo: "*.css"
---

# CSS & Theming Skill

## Design System

This project uses a dark theme with neon green accent, inspired by pump.fun.

### CSS Custom Properties

All colors are defined in `:root` in `styles.css`. NEVER hardcode hex values — always use `var(--name)`.

| Variable | Value | Usage |
|----------|-------|-------|
| `--green` | `#7bff69` | Primary accent, buy buttons, positive values |
| `--green-dim` | `#5bcc4d` | Hover states for green elements |
| `--red` | `#ff4d4d` | Sell buttons, negative values, warnings |
| `--bg` | `#0e0e16` | Page background |
| `--bg-secondary` | `#12121e` | Secondary backgrounds (ticker, etc.) |
| `--bg-card` | `#181825` | Card backgrounds |
| `--bg-card-hover` | `#1e1e30` | Card hover state |
| `--border` | `#2a2a3e` | Borders and dividers |
| `--border-hover` | `#3a3a5e` | Border hover state |
| `--text` | `#e2e2e2` | Primary text |
| `--text-secondary` | `#8888a0` | Muted / secondary text |

### Responsive Approach

**Mobile-first.** Write base styles for small screens, then progressively enhance:

```css
/* Base: mobile */
.token-grid {
  grid-template-columns: 1fr;
}

/* Tablet */
@media (min-width: 768px) {
  .token-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .token-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### CSS Organization

Styles are organized by section with comment headers:

```
/* ================================================================
   SECTION NAME
   ================================================================ */
```

Keep this structure when adding new styles.

### Typography

- Font: Inter (Google Fonts)
- Use `rem` for font sizes, `px` for borders/shadows
- Font weights: 400 (body), 500 (labels), 600 (emphasis), 700 (headings), 800-900 (hero)

### Animations

- Use `transition` for interactive states (hover, focus)
- Use `@keyframes` for continuous/entrance animations
- Keep durations short: 0.2–0.3s for transitions, 0.3–0.5s for entrances
- Use `ease` or `ease-out` timing functions
