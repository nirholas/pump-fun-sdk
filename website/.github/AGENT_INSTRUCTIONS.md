# Agent Instructions for lyraOS/PumpOS Development

## Repository Structure

This workspace contains two repositories:

1. **lyraOS** (`/workspaces/lyraOS`) - Original NovaOS fork
   - Branch: `main` - Original lyraOS (non-Lair)
   - Branch: `pump-rebrand` - Pump-branded version

2. **PumpOS** (`/workspaces/PumpOS`) - Production deployment
   - Branch: `main` - Live at pump-fun-sdk.vercel.app
   - This is the production repository

## Git Identity (MANDATORY — Run First)

Before ANY git operation in every session, configure identity in each repo:

```bash
git config user.name "nirholas"
git config user.email "nirholas@users.noreply.github.com"
```

Do not skip this — every commit and push must use this identity.

## Deployment Rules

### ⚠️ CRITICAL: Where to Push Changes

**Lair-Related Changes** (branding, Pump apps, Pump features):
- ✅ Push to: `lyraOS/pump-rebrand` branch
- ✅ Push to: `PumpOS/main` branch
- ❌ DO NOT push to: `lyraOS/main` branch

**Non-Pump Changes** (core OS features, bug fixes, generic improvements):
- ✅ Push to: `lyraOS/main` branch
- ✅ Push to: `lyraOS/pump-rebrand` branch (merge from main)
- ✅ Push to: `PumpOS/main` branch (merge from pump-rebrand)

### What is "Lair-Related"?

**Lair-Related** (requires dual push):
- Files containing "Lair" branding
- `appdata/pumpai.html` (Pump AI)
- `appdata/pumpbot.html`, `appdata/pumpdocs.html`
- `newtab.html` (Pump shortcuts)
- `assets/logo.svg` references
- Settings with Pump links (Twitter/X, etc.)
- Store apps with Pump branding

**Non-Lair** (lyraOS main only):
- Core system scripts (`script.js`, `system32.js`, `scripts/*`)
- Security fixes
- Performance improvements
- Bug fixes in window management, file system, etc.
- Generic apps that work for any OS

## Workflow for Changes

### For Pump-Related Changes:

```bash
# 1. Make changes in lyraOS
cd /workspaces/lyraOS
git checkout pump-rebrand
# ... make changes ...
git add .
git commit -m "Your message"
git push origin pump-rebrand

# 2. Copy same changes to PumpOS
cd /workspaces/PumpOS
# ... apply same changes ...
git add .
git commit -m "Same message"
git push origin main
```

### For Non-Pump Changes:

```bash
# 1. Make changes in lyraOS main
cd /workspaces/lyraOS
git checkout main
# ... make changes ...
git add .
git commit -m "Your message"
git push origin main

# 2. Merge to pump-rebrand
git checkout pump-rebrand
git merge main
git push origin pump-rebrand

# 3. Apply to PumpOS
cd /workspaces/PumpOS
# ... apply changes ...
git add .
git commit -m "Same message"
git push origin main
```

## Verification Checklist

Before completing any task:

- [ ] Identified if changes are Pump-related or generic
- [ ] Pushed to correct branch(es)
- [ ] If Pump-related: Both `lyraOS/pump-rebrand` AND `PumpOS/main` are updated
- [ ] Verified commits with `git log --oneline -3` in both repos
- [ ] Confirmed files are identical between repos (if applicable)

## Key Files Reference

**Always sync between lyraOS/pump-rebrand ↔ PumpOS/main:**
- `appdata/pumpai.html` (Pump AI)
- `appdata/store.html` (if Pump branding changes)
- `appdata/settings.html` (if Pump links change)
- `appdata/browser.html` (if newtab changes)
- `newtab.html` (Pump shortcuts)
- Any files in `appdata/lair*.html`

**Production Deployment:**
- PumpOS/main → pump-fun-sdk.vercel.app (automatic)
- Changes pushed to PumpOS go live immediately

## Common Mistakes to Avoid

❌ Pushing Pump branding to `lyraOS/main`
❌ Forgetting to push to PumpOS when making Pump changes
❌ Only updating one repo when both need updates
❌ Pushing directly to production without testing

## Notes

- lyraOS is the development/testing repository
- PumpOS is the production repository (pump-fun-sdk.vercel.app)
- Always keep PumpOS and lyraOS/pump-rebrand in sync for Pump features
- Test changes in lyraOS before pushing to PumpOS
