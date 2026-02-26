# Agent Instructions for lyraOS/LairOS Development

## Repository Structure

This workspace contains two repositories:

1. **lyraOS** (`/workspaces/lyraOS`) - Original NovaOS fork
   - Branch: `main` - Original lyraOS (non-Lair)
   - Branch: `lair-rebrand` - Lair-branded version

2. **LairOS** (`/workspaces/LairOS`) - Production deployment
   - Branch: `main` - Live at lair2.vercel.app
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

**Lair-Related Changes** (branding, Lair apps, Lair features):
- ✅ Push to: `lyraOS/lair-rebrand` branch
- ✅ Push to: `LairOS/main` branch
- ❌ DO NOT push to: `lyraOS/main` branch

**Non-Lair Changes** (core OS features, bug fixes, generic improvements):
- ✅ Push to: `lyraOS/main` branch
- ✅ Push to: `lyraOS/lair-rebrand` branch (merge from main)
- ✅ Push to: `LairOS/main` branch (merge from lair-rebrand)

### What is "Lair-Related"?

**Lair-Related** (requires dual push):
- Files containing "Lair" branding
- `appdata/lairai.html` (Lair AI)
- `appdata/lairbot.html`, `appdata/lairdocs.html`
- `newtab.html` (Lair shortcuts)
- `assets/logo.svg` references
- Settings with Lair links (Twitter/X, etc.)
- Store apps with Lair branding

**Non-Lair** (lyraOS main only):
- Core system scripts (`script.js`, `system32.js`, `scripts/*`)
- Security fixes
- Performance improvements
- Bug fixes in window management, file system, etc.
- Generic apps that work for any OS

## Workflow for Changes

### For Lair-Related Changes:

```bash
# 1. Make changes in lyraOS
cd /workspaces/lyraOS
git checkout lair-rebrand
# ... make changes ...
git add .
git commit -m "Your message"
git push origin lair-rebrand

# 2. Copy same changes to LairOS
cd /workspaces/LairOS
# ... apply same changes ...
git add .
git commit -m "Same message"
git push origin main
```

### For Non-Lair Changes:

```bash
# 1. Make changes in lyraOS main
cd /workspaces/lyraOS
git checkout main
# ... make changes ...
git add .
git commit -m "Your message"
git push origin main

# 2. Merge to lair-rebrand
git checkout lair-rebrand
git merge main
git push origin lair-rebrand

# 3. Apply to LairOS
cd /workspaces/LairOS
# ... apply changes ...
git add .
git commit -m "Same message"
git push origin main
```

## Verification Checklist

Before completing any task:

- [ ] Identified if changes are Lair-related or generic
- [ ] Pushed to correct branch(es)
- [ ] If Lair-related: Both `lyraOS/lair-rebrand` AND `LairOS/main` are updated
- [ ] Verified commits with `git log --oneline -3` in both repos
- [ ] Confirmed files are identical between repos (if applicable)

## Key Files Reference

**Always sync between lyraOS/lair-rebrand ↔ LairOS/main:**
- `appdata/lairai.html` (Lair AI)
- `appdata/store.html` (if Lair branding changes)
- `appdata/settings.html` (if Lair links change)
- `appdata/browser.html` (if newtab changes)
- `newtab.html` (Lair shortcuts)
- Any files in `appdata/lair*.html`

**Production Deployment:**
- LairOS/main → lair2.vercel.app (automatic)
- Changes pushed to LairOS go live immediately

## Common Mistakes to Avoid

❌ Pushing Lair branding to `lyraOS/main`
❌ Forgetting to push to LairOS when making Lair changes
❌ Only updating one repo when both need updates
❌ Pushing directly to production without testing

## Notes

- lyraOS is the development/testing repository
- LairOS is the production repository (lair2.vercel.app)
- Always keep LairOS and lyraOS/lair-rebrand in sync for Lair features
- Test changes in lyraOS before pushing to LairOS
