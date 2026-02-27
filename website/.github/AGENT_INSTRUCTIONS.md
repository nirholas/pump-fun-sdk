# Agent Instructions for Pump SDK Website Development

## Repository Structure

This workspace is a single repository:

- **pump-fun-sdk** (`/workspaces/pump-fun-sdk`) — Main repository
  - `website/` — PumpOS web desktop (Next.js + vanilla HTML/CSS/JS)
  - `src/` — Core Pump SDK (TypeScript)
  - Branch: `main` — Production

## Git Identity (MANDATORY — Run First)

Before ANY git operation in every session, configure identity:

```bash
git config user.name "nirholas"
git config user.email "nirholas@users.noreply.github.com"
```

Do not skip this — every commit and push must use this identity.

## Key Files Reference

**Website core:**
- `website/index.html` — Main PumpOS desktop
- `website/newtab.html` — New tab with Pump shortcuts
- `website/appdata/` — Built-in app HTML files
- `website/Pump-Store/` — Store apps and database
- `website/scripts/` — System scripts (kernel, widgets, etc.)
- `website/libs/` — Shared components

**Branding:**
- All branding uses "Pump SDK" / "PumpOS"
- App names use `pump` prefix (e.g., `pumpai`, `pumpbot`, `pumpdocs`)
- No references to previous branding ("Pump"/"PumpOS") should exist

## Deployment

- Changes pushed to `main` deploy automatically
- Test changes locally before pushing

## Common Mistakes to Avoid

❌ Introducing old branding references
❌ Pushing directly to production without testing
❌ Breaking app references in store database
