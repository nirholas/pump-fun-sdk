---
applyTo: "*.html"
---

# HTML Structure Skill

## Page Template

Every page follows this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>pump.fun — [page name]</title>
  <meta name="description" content="...">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="header">...</header>
  <main class="main">...</main>
  <script src="app.js"></script>
</body>
</html>
```

## Shared Header

The header/nav is **repeated in each HTML file** (no server-side includes). When modifying navigation, update ALL 4 pages:
- `index.html`
- `create.html`
- `token.html`
- `profile.html`

## Semantic HTML

Use proper elements:
- `<header>` for site header
- `<nav>` for navigation
- `<main>` for primary content
- `<section>` for distinct content sections
- `<article>` for self-contained content (token cards)
- `<button>` for interactive actions (not `<div onclick>`)
- `<a>` for navigation links

## Accessibility

- All images: `alt` attribute
- Interactive elements: `aria-label` when text isn't visible
- Form inputs: associated `<label>` elements
- Color contrast: minimum 4.5:1 ratio
- Keyboard navigation: focusable elements in logical order
