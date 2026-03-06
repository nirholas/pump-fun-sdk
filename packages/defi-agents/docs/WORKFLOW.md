# 🔄 Complete Development Workflow

> Comprehensive guide to the entire agent lifecycle: from creation → translation → build → deployment

---

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Reference](#quick-reference)
- [Architecture](#architecture)
- [Full Workflow](#full-workflow)
- [Local Development](#local-development)
- [CI/CD Pipeline](#cicd-pipeline)
- [Domain Management](#domain-management)
- [For Contributors](#for-contributors)
- [For Fork Maintainers](#for-fork-maintainers)

---

## Overview

This repository uses an automated workflow that takes agent definitions and:

1. ✅ Translates them to 18 languages
2. ✅ Builds a CDN-ready index
3. ✅ Deploys to GitHub Pages
4. ✅ Preserves custom domains automatically

**Key Principle:** Submit in English, everything else is automatic.

---

## Quick Reference

### For Contributors

```bash
# 1. Create agent
echo '{ ... }' > src/my-agent.json

# 2. Submit PR
git add src/my-agent.json
git commit -m "feat: Add My Agent"
git push

# Done! CI handles translation + deployment
```

### For Maintainers

```bash
# Setup
git clone https://github.com/yourusername/defi-agents
cd defi-agents
bun install
echo "OPENAI_API_KEY=sk-xxx" > .env

# Development cycle
bun run format # Translate agents
bun run build  # Build public index
bun run test   # Validate everything

# Deploy (automatic on push to main)
git push origin main
```

---

## Architecture

### Directory Structure

```
defi-agents/
├── CNAME                          # Your custom domain (optional)
├── .env                           # Local environment variables (gitignored)
│   └── OPENAI_API_KEY=sk-xxx
│
├── src/                           # 📝 Agent source files (English only)
│   ├── agent-1.json
│   ├── agent-2.json
│   └── sperax-dashboard.json
│
├── locales/                       # 🌍 18-language translations (auto-generated)
│   ├── agent-1/
│   │   ├── index.json             # en-US (default)
│   │   ├── index.zh-CN.json       # Chinese
│   │   ├── index.es-ES.json       # Spanish
│   │   └── ... (18 total)
│   └── agent-2/
│       └── ... (18 files)
│
├── public/                        # 🚀 Build output (gitignored, generated)
│   ├── CNAME                      # Copied from root during build
│   ├── index.json                 # Main agent index
│   ├── index.zh-CN.json           # Localized indexes
│   ├── agent-1.json               # Individual agents
│   ├── agent-1.zh-CN.json         # Localized agents
│   └── schema/
│       └── speraxAgentSchema_v1.json
│
├── .github/workflows/
│   └── release.yml                # CI/CD automation
│
└── scripts/
    ├── commands/
    │   ├── format.ts              # Translation engine
    │   └── build.ts               # Build engine
    └── builders/
        └── agent-builder.ts       # Includes CNAME copy logic
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT CYCLE                         │
└─────────────────────────────────────────────────────────────┘

1. CREATE AGENT
   └─ Write src/agent-name.json (English only)

2. TRANSLATE (bun run format)
   ├─ Validate JSON schema
   ├─ Generate missing fields (category, examples)
   ├─ Call OpenAI API (GPT-4)
   ├─ Translate to 18 languages
   └─ Create locales/agent-name/*.json (18 files)

3. BUILD (bun run build)
   ├─ Merge src + locales
   ├─ Generate public index files
   ├─ Copy CNAME to public/ (if exists)
   └─ Create CDN-ready distribution

4. DEPLOY (automatic on push)
   ├─ GitHub Actions triggers
   ├─ Runs format → build
   ├─ Deploys public/ to gh-pages branch
   └─ GitHub Pages serves at your domain

┌─────────────────────────────────────────────────────────────┐
│                      LIVE WEBSITE                            │
└─────────────────────────────────────────────────────────────┘
   https://yourdomain.com/index.json
   └─ Agents available in 18 languages
```

---

## Full Workflow

### Step 1: Create Agent Source

Create a new agent in `src/`:

```bash
# Create agent file
touch src/my-defi-agent.json
```

```json
{
  "author": "your-github-username",
  "config": {
    "systemRole": "You are a DeFi expert specializing in...",
    "openingMessage": "Hello! I can help you with...",
    "openingQuestions": ["What's the best yield strategy?", "How do I minimize impermanent loss?"]
  },
  "createdAt": "2024-12-21",
  "examples": [
    {
      "role": "user",
      "content": "Explain DeFi yield farming"
    },
    {
      "role": "assistant",
      "content": "Yield farming is..."
    }
  ],
  "homepage": "https://github.com/nirholas/AI-Agents-Library",
  "identifier": "my-defi-agent",
  "meta": {
    "title": "My DeFi Agent",
    "description": "Expert DeFi advisor for yield optimization",
    "avatar": "🌾",
    "tags": ["defi", "yield", "optimization"],
    "category": "trading"
  },
  "schemaVersion": 1
}
```

### Step 2: Run Translation

```bash
# Set API key (first time only)
echo "OPENAI_API_KEY=sk-your-key" > .env

# Run translation
bun run format
```

**What happens:**

- ✅ Validates JSON structure
- ✅ Calls OpenAI GPT-4 for translation
- ✅ Creates `locales/my-defi-agent/` with 18 files
- ✅ Takes \~2-5 minutes depending on agent complexity

**Output:**

```
locales/
  my-defi-agent/
    ├── index.json        # en-US (default)
    ├── index.ar.json     # Arabic
    ├── index.zh-CN.json  # Simplified Chinese
    └── ... (18 total)
```

### Step 3: Build Public Index

```bash
bun run build
```

**What happens:**

- ✅ Merges `src/` + `locales/`
- ✅ Generates `public/index.json` with all agents
- ✅ Creates localized indexes (index.zh-CN.json, etc.)
- ✅ Copies CNAME from root to public/ (if exists)
- ✅ Generates schema files

**Output:**

```
public/
  ├── CNAME                    # Your custom domain
  ├── index.json               # Main index (en-US)
  ├── index.zh-CN.json         # Chinese index
  ├── my-defi-agent.json       # Your agent (en-US)
  ├── my-defi-agent.zh-CN.json # Your agent (Chinese)
  └── ... (58 agents × 18 languages = 1,044 files)
```

### Step 4: Test Locally (Optional)

```bash
# Serve locally to test
npx serve public

# Open http://localhost:3000/index.json
```

### Step 5: Commit and Push

```bash
# Add source + translations
git add src/ locales/

# Commit (do NOT add public/ - it's gitignored)
git commit -m "feat: Add My DeFi Agent"

# Push to trigger CI/CD
git push origin main
```

### Step 6: Automatic Deployment

GitHub Actions automatically:

1. ✅ Runs `bun run format` (translates)
2. ✅ Runs `bun run build` (builds)
3. ✅ Deploys `public/` to `gh-pages` branch
4. ✅ GitHub Pages serves your site

**Live in \~5 minutes at:**

- Default: `https://yourusername.github.io/defi-agents/index.json`
- Custom: `https://yourdomain.com/index.json`

---

## Local Development

### First-Time Setup

```bash
# 1. Clone repository
git clone https://github.com/yourusername/defi-agents
cd defi-agents

# 2. Install dependencies
bun install

# 3. Configure OpenAI API key
echo "OPENAI_API_KEY=sk-xxx" > .env
```

### Development Commands

```bash
# Format & translate agents
bun run format

# Build public distribution
bun run build

# Run tests
bun run test

# Validate translations
bun run i18n:validate

# Clean invalid translations
bun run i18n:clean

# Lint markdown docs
bun run lint:md

# Format all code
bun run prettier

# Full release pipeline (format + build + update README)
bun run awesome
```

### Typical Development Loop

```bash
# 1. Create or edit agent
vim src/my-agent.json

# 2. Translate
bun run format

# 3. Build
bun run build

# 4. Test
bun run test

# 5. Commit
git add src/ locales/
git commit -m "feat: Add my agent"

# 6. Push (triggers CI/CD)
git push origin main
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

**File:** `.github/workflows/release.yml`

**Triggers:** Every push to `main` branch

**Steps:**

1. **Checkout** - Fetch repository
2. **Install Bun** - Setup runtime
3. **Install Dependencies** - `bun install`
4. **Run Tests** - Validate agents
5. **Format & Translate** - `bun run format` (uses OPENAI_API_KEY secret)
6. **Update README** - `bun run awesome`
7. **Lint & Prettier** - Code formatting
8. **Commit Changes** - Auto-commit translations
9. **Deploy to GitHub Pages** - Deploy `public/` to `gh-pages` branch

### Required Secrets

Set in **Repository Settings → Secrets and variables → Actions:**

- `OPENAI_API_KEY` - OpenAI API key for translations (**required**)
- `OPENAI_PROXY_URL` - Custom OpenAI endpoint (optional)
- `GITHUB_TOKEN` - Automatically provided by GitHub

### Build Process Details

The build step (`bun run build`) calls `agent-builder.ts` which:

1. **Builds Schema**
   - Generates JSON schema from Zod definitions
   - Writes to `schema/` and `public/schema/`

2. **Builds Agents** (for each of 18 languages)
   - Reads `src/*.json` (English source)
   - Reads `locales/agent-name/index.[locale].json`
   - Merges source + translation
   - Writes to `public/agent-name.[locale].json`

3. **Generates Indexes** (for each of 18 languages)
   - Collects all agents
   - Extracts metadata
   - Calculates tag frequencies
   - Writes to `public/index.[locale].json`

4. **Copies CNAME**
   - Checks if `CNAME` exists in root
   - Copies to `public/CNAME` (if exists)
   - Ensures custom domain persists

**Code Reference:** `scripts/builders/agent-builder.ts`

```typescript
run = async () => {
  this.buildSchema(); // Generate schema
  await this.buildFullLocaleAgents(); // Build all languages
  this.copyCNAME(); // Copy CNAME
};
```

---

## Domain Management

### Option 1: Use Default GitHub Pages Domain

**For:** Personal projects, testing, forks

```bash
# Delete CNAME file
rm CNAME
git add CNAME
git commit -m "Use default GitHub Pages domain"
git push
```

**Your site:** `https://username.github.io/defi-agents/`

### Option 2: Use Custom Domain

**For:** Production, branded deployments

```bash
# 1. Update CNAME file
echo "yourdomain.com" > CNAME
git add CNAME
git commit -m "Set custom domain"
git push

# 2. Configure DNS (in your domain registrar)
# Add CNAME record: yourdomain.com → username.github.io

# 3. Enable HTTPS in GitHub
# Settings → Pages → Enforce HTTPS (after DNS propagates)
```

**Your site:** `https://yourdomain.com/`

### CNAME Handling Details

**Why it works:**

1. CNAME file is stored in repository root
2. Build process (`agent-builder.ts`) copies it to `public/CNAME`
3. GitHub Actions deploys `public/` directory (including CNAME)
4. GitHub Pages reads `CNAME` and serves site at custom domain

**For forks:**

- Original repo has `sperax.click` in CNAME
- Fork maintainer updates CNAME to `their-domain.com`
- Build automatically copies their CNAME
- Their domain works without any code changes

**Implementation:** `scripts/builders/agent-builder.ts`

```typescript
copyCNAME = () => {
  const cnamePath = resolve(root, 'CNAME');
  const publicCNAMEPath = resolve(publicDir, 'CNAME');

  if (existsSync(cnamePath)) {
    copyFileSync(cnamePath, publicCNAMEPath);
    Logger.success('CNAME 文件已复制到 public 目录');
  }
};
```

---

## For Contributors

### Submitting a New Agent

1. **Fork the repository**
2. **Create agent:** `src/your-agent.json`
3. **Submit PR** (translation happens in CI)

**You do NOT need to:**

- ❌ Translate manually
- ❌ Run `bun run format` locally
- ❌ Create locale files
- ❌ Build the public index

**CI will automatically:**

- ✅ Translate to 18 languages
- ✅ Build and deploy
- ✅ Update the marketplace

### PR Review Process

1. Maintainer reviews `src/your-agent.json`
2. If approved, PR is merged to main
3. CI runs format + build + deploy
4. Agent appears at marketplace within 5 minutes

---

## For Fork Maintainers

### Initial Setup

```bash
# 1. Fork on GitHub
# Click "Fork" button

# 2. Clone your fork
git clone https://github.com/yourusername/defi-agents
cd defi-agents

# 3. Set up custom domain (optional)
echo "yourdomain.com" > CNAME
# Or delete CNAME for default GitHub Pages URL

# 4. Configure GitHub secrets
# Go to Settings → Secrets → Actions
# Add: OPENAI_API_KEY

# 5. Enable GitHub Pages
# Settings → Pages → Source: gh-pages branch

# 6. Push to trigger first deployment
git add CNAME # or git rm CNAME
git commit -m "Configure domain"
git push origin main
```

### Maintaining Your Fork

**Keep agents in sync with upstream:**

```bash
# Add upstream remote
git remote add upstream https://github.com/nirholas/defi-agents

# Sync with upstream
git fetch upstream
git merge upstream/main

# Rebuild with your agents
bun run format
bun run build

# Push
git push origin main
```

**Add your own agents:**

```bash
# Create agent
vim src/my-custom-agent.json

# Commit and push (CI handles rest)
git add src/my-custom-agent.json
git commit -m "feat: Add my custom agent"
git push origin main
```

---

## Summary

**Complete Lifecycle:**

```
Developer → Create agent.json → Push to GitHub
                ↓
         GitHub Actions CI/CD
                ↓
    format (translate to 18 languages)
                ↓
    build (generate public index + copy CNAME)
                ↓
    deploy (push to gh-pages branch)
                ↓
         GitHub Pages CDN
                ↓
    Live at your domain in 18 languages
```

**Key Files:**

- `src/*.json` - Source agents (English)
- `locales/*/index.*.json` - Translations (18 languages)
- `public/` - Build output (gitignored, generated)
- `CNAME` - Custom domain (optional)
- `.github/workflows/release.yml` - CI/CD automation
- `scripts/builders/agent-builder.ts` - Build logic

**Key Commands:**

- `bun run format` - Translate agents
- `bun run build` - Build index (includes CNAME copy)
- `bun run test` - Validate everything
- `git push origin main` - Trigger deployment

---

## Related Documentation

- **[I18N Workflow](./I18N_WORKFLOW.md)** - Translation system details
- **[Deployment Guide](./DEPLOYMENT.md)** - Domain setup, DNS config
- **[Contributing](./CONTRIBUTING.md)** - Agent submission guidelines
- **[Agent Guide](./AGENT_GUIDE.md)** - Writing effective agents
- **[API Reference](./API.md)** - Using the agent index
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues

---

**Questions?** Open an issue or check the [FAQ](./FAQ.md).

---

## Alternative: Vercel Deployment

If GitHub Actions are disabled or you prefer Vercel's features (CORS control, analytics, rate limiting):

### Quick Setup

1. **Import to Vercel:** [vercel.com/new](https://vercel.com/new)
2. **Configure build:**
   - Build Command: `bun run build`
   - Output Directory: `public`
3. **Add environment variable:** `OPENAI_API_KEY`
4. **Deploy!**

### Manual Local Build for Vercel

```bash
# Install
bun install

# Translate agents (requires OpenAI API key)
export OPENAI_API_KEY=sk-your-key
bun run format

# Build
bun run build

# Or use the convenience script
./scripts/local-release.sh
```

### When to Use Vercel vs GitHub Pages

| Use Case | Recommendation |
|----------|---------------|
| GitHub Actions enabled | GitHub Pages (automatic) |
| GitHub Actions disabled | Vercel |
| Need CORS control | Vercel |
| Need rate limiting | Vercel |
| Need analytics | Vercel |
| Simple, free hosting | Either works |

See [Deployment Guide](./DEPLOYMENT.md) for complete details.

