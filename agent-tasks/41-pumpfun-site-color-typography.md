# Task 41: PumpFun Site — Color Scheme, Typography & Dark Theme Refinement

## Context

You are working in the `pump-fun-sdk` repository. The `pumpfun-site/` directory is a static token launchpad UI (pure HTML/CSS/JS). The site uses a dark theme but the colors and text styles don't precisely match pump.fun's dark mode. This task is about fine-tuning the visual palette.

**Files to modify:**
- `pumpfun-site/styles.css` (~1196 lines) — CSS custom properties and global type styles

**DO NOT** modify `app.js` or HTML files.

## Objective

Update the CSS custom properties and global styles to more closely match pump.fun's dark theme. This is purely a CSS task.

## Design Reference (pump.fun)

Pump.fun's dark theme colors (approximated from screenshots):
- Background: `#12121a` (very dark blue-black)
- Card background: `#1a1a2e` (slightly lighter)
- Border: `#2a2a3e` (subtle purple-gray)
- Text primary: `#e8e8f0` (warm white)
- Text secondary: `#8888a0` (muted lavender-gray)
- Green/accent: `#00e676` (bright green, slightly more blue than pure green)
- Negative/red: `#ff4d6a` (pinkish-red)
- Link/blue: `#6c8fff` (periwinkle blue)
- Warning/gold: `#ffd740`
- Font family: Inter / system-ui with -apple-system fallback

## Requirements

### 1. Update CSS Custom Properties (`:root` block)

Find and update the existing `:root` variables to:

```css
:root {
  /* Colors */
  --bg: #12121a;
  --bg-card: #1a1a2e;
  --bg-hover: #222240;
  --border: #2a2a3e;
  --text: #e8e8f0;
  --text-secondary: #8888a0;
  --green: #00e676;
  --red: #ff4d6a;
  --blue: #6c8fff;
  --gold: #ffd740;

  /* Typography */
  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;

  /* Spacing */
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 16px;
  --radius-xl: 20px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.2);
  --shadow: 0 4px 12px rgba(0,0,0,0.3);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.4);
}
```

### 2. Global Typography

```css
body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4, h5, h6 {
  line-height: 1.2;
  letter-spacing: -0.01em;
}

a {
  color: var(--blue);
  text-decoration: none;
  transition: color 0.15s;
}
a:hover {
  color: var(--green);
}

code, kbd, samp {
  font-family: var(--font-mono);
  font-size: 0.9em;
}
```

### 3. Update All Color References

Search the CSS for hardcoded color values and replace with variables:
- `#7bff69` → `var(--green)` (wherever used as accent)
- `#ff4d4d` → `var(--red)`
- `#0e0e16` → `var(--bg)`
- Any hardcoded gray/border colors → use appropriate variable

### 4. Add Inter Font Import

At the top of `styles.css`, add:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
```

Or use a fallback approach with `@font-face` if you prefer no external requests.

### 5. Button Refinement

Standardize button styles across the site:

```css
/* Base button reset */
button {
  font-family: var(--font);
  font-size: 14px;
}

/* Standard button variants */
.btn-primary {
  background: var(--green);
  color: var(--bg);
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius);
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-primary:hover { opacity: 0.85; }

.btn-secondary {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
  padding: 10px 20px;
  border-radius: var(--radius);
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s;
}
.btn-secondary:hover { border-color: var(--green); }

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: none;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color 0.15s;
}
.btn-ghost:hover { color: var(--text); }
```

### 6. Input Refinement

```css
input, select, textarea {
  font-family: var(--font);
}
input::placeholder, textarea::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}
```

### 7. Card Refinement

Add subtle depth to cards:

```css
.coin-card, .trade-panel, .holders-section, .thread-section {
  box-shadow: var(--shadow-sm);
}
```

### 8. Verification

- All text should render in Inter (or system fallback)
- Background should be `#12121a` (very dark blue-black)
- Cards should be slightly lighter than background
- Green accent should be `#00e676`
- Red should be `#ff4d6a`
- No hardcoded color values should remain (all should use CSS variables)
- Buttons should have consistent hover/active states
- All existing layouts should remain intact — only colors and typography change

## Anti-Patterns

- Do NOT change any HTML
- Do NOT modify `app.js`
- Do NOT change layout/spacing (only colors and fonts)
- Do NOT remove any existing CSS classes — only update their values
- Do NOT add npm dependencies
- If the existing `:root` variables had different names, update all references throughout the file
