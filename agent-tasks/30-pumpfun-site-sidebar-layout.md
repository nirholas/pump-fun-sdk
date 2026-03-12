# Task 30: PumpFun Site — Sidebar Navigation Layout

## Context

You are working in the `pump-fun-sdk` repository. The `pumpfun-site/` directory is a static token launchpad UI (pure HTML/CSS/JS, zero dependencies). It currently uses a **top navigation bar** but needs to be redesigned to use a **left sidebar** layout like the real pump.fun.

**Files to modify:**
- `pumpfun-site/styles.css` (~1196 lines) — all styling
- `pumpfun-site/index.html` (~143 lines) — board/home page
- `pumpfun-site/token.html` (~508 lines) — token detail page
- `pumpfun-site/create.html` (~193 lines) — token creation form
- `pumpfun-site/profile.html` (~164 lines) — user profile

**DO NOT** modify `app.js` — it handles data fetching and wallet connection.

## Objective

Replace the top `<header>` navigation with a **persistent left sidebar** on all 4 pages, matching the pump.fun layout from the screenshots. The sidebar should be fixed on the left, with the main content area taking the remaining width.

## Design Reference (pump.fun)

The real pump.fun sidebar contains:
- **Logo** at top left (green circle icon + "Pump.fun" text)
- **Nav links** (vertical, icon + text):
  - 🏠 Home
  - 📺 Live
  - 👤 Profile
  - 💬 Chat
  - 🖥️ Terminal
  - ☰ More
- **"+ Create" button** — prominent green button
- **"Pump app" QR code section** — can skip or show a placeholder
- **Holdings section** at bottom — shows "Holdings" with a gear icon

## Requirements

### 1. HTML Structure (all 4 pages)

Replace the existing `<header class="header">` and `<div class="mobile-nav">` blocks with:

```html
<!-- Sidebar -->
<aside class="sidebar">
  <div class="sidebar-top">
    <a href="index.html" class="sidebar-logo">
      <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="16" fill="url(#lg)" />
        <path d="M12 24 L18 8 L24 24 L18 19 Z" fill="#0e0e16" />
        <defs><linearGradient id="lg" x1="0" y1="0" x2="36" y2="36"><stop offset="0%" stop-color="#7bff69"/><stop offset="100%" stop-color="#00d4ff"/></linearGradient></defs>
      </svg>
      <span>launch<span class="logo-accent">pad</span></span>
    </a>
  </div>

  <nav class="sidebar-nav">
    <a href="index.html" class="sidebar-link active">🏠 <span>Home</span></a>
    <a href="token.html" class="sidebar-link">📈 <span>Trade</span></a>
    <a href="profile.html" class="sidebar-link">👤 <span>Profile</span></a>
    <a href="#" class="sidebar-link">💬 <span>Chat</span></a>
  </nav>

  <a href="create.html" class="sidebar-create-btn">+ Create coin</a>

  <div class="sidebar-bottom">
    <div class="sidebar-holdings">
      <span>Holdings</span>
      <span>⚙️</span>
    </div>
  </div>
</aside>
```

Set the correct `active` class per page (index=Home, token=Trade, create=none, profile=Profile).

Keep the **search bar** and **wallet button** — move them to a slim **top bar** inside the main content area:

```html
<div class="topbar">
  <div class="topbar-search">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <input type="text" placeholder="Search for coins..." aria-label="Search tokens">
    <span class="topbar-shortcut">⌘ K</span>
  </div>
  <a href="create.html" class="topbar-create">+ Create</a>
  <button class="btn-wallet">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><circle cx="18" cy="16" r="1"/></svg>
    <span>Sign in</span>
  </button>
</div>
```

### 2. CSS Layout

Add these styles to `styles.css`:

- `.sidebar` — fixed left, `width: 220px`, full height, `background: var(--bg)`, border-right, `z-index: 100`, flex column
- `.sidebar-logo` — flex, align items center, gap 8px, padding 20px 16px
- `.sidebar-nav` — flex column, padding 8px
- `.sidebar-link` — flex, gap 12px, padding 10px 16px, border-radius 8px, color text-secondary, hover: bg-card
- `.sidebar-link.active` — color white, background var(--bg-card)
- `.sidebar-create-btn` — green background button, margin 16px, padding 12px, border-radius 12px, text-align center, font-weight 700
- `.sidebar-bottom` — margin-top auto, padding 16px, border-top
- `.topbar` — flex, align-items center, gap 12px, padding 12px 24px, border-bottom
- `.topbar-search` — flex-1, same style as current `.header-search` but wider
- `.topbar-shortcut` — small gray pill showing keyboard shortcut

**Body layout:** `body { display: flex; }` and `.main { margin-left: 220px; flex: 1; }`

Remove or update these old classes: `.header`, `.header-inner`, `.nav`, `.nav-link`, `.mobile-toggle`, `.mobile-nav`

### 3. Mobile Responsive

At `≤768px`:
- Sidebar collapses to icons only (width ~60px), hide `<span>` text
- Or hide sidebar entirely and show a bottom tab bar (like mobile pump.fun)
- Topbar search should still be visible

### 4. What to Remove

- Delete the `<header class="header">` block from all 4 pages
- Delete the `<div class="mobile-nav" id="mobileNav">` block from all 4 pages
- Delete `.header`, `.header-inner`, `.nav`, `.nav-link`, `.mobile-toggle`, `.mobile-nav` CSS (or leave as fallback)

### 5. Verification

After changes, all 4 pages should:
- Show the sidebar on the left
- Show the topbar with search + wallet at the top of the content area
- Active nav link should be highlighted
- The footer should still appear at the bottom of the content area
- No horizontal scrollbar
- Mobile should be usable

## Anti-Patterns

- Do NOT add any npm dependencies — this is pure HTML/CSS/JS
- Do NOT modify `app.js`
- Do NOT break existing wallet connection (the `.btn-wallet` elements are targeted by `updateWalletButtons()` in app.js)
- Do NOT change the `<script>` tags at the bottom of any page
