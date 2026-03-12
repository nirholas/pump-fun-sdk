# Task 36: PumpFun Site — Footer Redesign & Global Polish

## Context

You are working in the `pump-fun-sdk` repository. The `pumpfun-site/` directory is a static token launchpad UI (pure HTML/CSS/JS, zero dependencies). The site has a basic footer, but pump.fun's footer is more structured with policy links and social icons.

**Files to modify:**
- `pumpfun-site/styles.css` (~1196 lines) — footer and global styles
- `pumpfun-site/index.html` (~143 lines)  
- `pumpfun-site/token.html` (~508 lines)  
- `pumpfun-site/create.html` (~193 lines)  
- `pumpfun-site/profile.html` (~164 lines)  

**DO NOT** modify `app.js`.

## Objective

1. Redesign the footer to match pump.fun's layout
2. Add global UI polish: scrollbar styling, selection color, focus styles, loading skeleton states

## Requirements

### 1. Footer HTML (all 4 pages)

Replace the current `<footer>` block on all pages with:

```html
<footer class="footer">
  <div class="footer-inner">
    <div class="footer-links">
      <a href="#">Privacy Policy</a>
      <a href="#">Terms of Use</a>
      <a href="#">Fees</a>
      <a href="#">Docs</a>
      <a href="#">Blog</a>
    </div>
    <div class="footer-social">
      <a href="#" title="X / Twitter" class="footer-social-link">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </a>
      <a href="#" title="Telegram" class="footer-social-link">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
      </a>
    </div>
    <div class="footer-copy">
      <span>&copy; 2025 Launchpad</span>
    </div>
  </div>
</footer>
```

### 2. Footer CSS

```css
.footer {
  border-top: 1px solid var(--border);
  padding: 24px 0;
  margin-top: 48px;
}
.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.footer-links {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}
.footer-links a {
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s;
}
.footer-links a:hover {
  color: var(--text);
}
.footer-social {
  display: flex;
  gap: 12px;
}
.footer-social-link {
  color: var(--text-secondary);
  transition: color 0.2s;
  display: flex;
  align-items: center;
}
.footer-social-link:hover {
  color: var(--green);
}
.footer-copy {
  width: 100%;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 8px;
}

@media (max-width: 640px) {
  .footer-inner { flex-direction: column; text-align: center; }
  .footer-links { justify-content: center; }
  .footer-social { justify-content: center; }
}
```

### 3. Custom Scrollbar

```css
/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: var(--bg);
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
```

### 4. Selection Color

```css
::selection {
  background: rgba(123, 255, 105, 0.3);
  color: var(--text);
}
```

### 5. Focus Styles

```css
/* Accessible focus ring */
:focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 2px;
}
button:focus:not(:focus-visible),
a:focus:not(:focus-visible) {
  outline: none;
}
```

### 6. Loading Skeleton

Add a skeleton loading animation for use when content is loading:

```css
.skeleton {
  background: linear-gradient(90deg, var(--bg-card) 25%, rgba(255,255,255,0.05) 50%, var(--bg-card) 75%);
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: 6px;
}
@keyframes skeleton-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.skeleton-text {
  height: 14px;
  margin-bottom: 8px;
}
.skeleton-img {
  aspect-ratio: 1;
  width: 100%;
}
```

### 7. Smooth Page Transitions

```css
/* Smooth scroll for same-page links */
html {
  scroll-behavior: smooth;
}

/* Fade-in animation for main content */
.main {
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 8. Button Hover Improvements

Update existing button hover states for consistency:

```css
/* Primary action buttons */
.btn-primary, .btn-buy, .sidebar-create-btn {
  transition: background 0.2s, transform 0.1s;
}
.btn-primary:active, .btn-buy:active, .sidebar-create-btn:active {
  transform: scale(0.98);
}
```

### 9. Verification

- Footer should appear consistently on all 4 pages
- Footer links should be horizontally spaced on desktop, stacked on mobile
- Social icons should show on hover
- Custom scrollbar should be visible on Chromium browsers
- Selection highlight should be green-tinted
- Focus styles should use green outline ring
- Skeleton class should animate when applied to elements

## Anti-Patterns

- Do NOT modify `app.js`
- Do NOT add npm dependencies
- Do NOT remove existing CSS variables — only add to them
- Do NOT change the dark theme colors
