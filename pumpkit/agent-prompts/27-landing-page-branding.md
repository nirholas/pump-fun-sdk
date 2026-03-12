# Agent Task 27: Create Landing Page Content + Branding

## Context

We're building **PumpKit** (`/workspaces/pump-fun-sdk/pumpkit/`). Read `pumpkit/README.md` for the project overview.

We need marketing/landing page content for the PumpKit brand.

## Task

Create these files under `/workspaces/pump-fun-sdk/pumpkit/branding/`:

### 1. `landing-page.md`
Full landing page copy for pumpkit.dev (or wherever we host):

**Hero Section:**
- Headline: catchy, developer-focused
- Subheadline: What PumpKit does in one sentence
- CTA buttons: Get Started, View on GitHub

**Problem Section:**
- What problem does PumpKit solve?
- Why do developers need this?
- Pain points of building PumpFun bots from scratch

**Features Section (6 cards):**
- Telegram Bot Framework
- Real-Time Monitoring (6 event types)
- Call Tracking + Leaderboards
- REST API + Webhooks
- Production Ready (Docker, Railway)
- Open Source

**How It Works (3 steps):**
1. Install @pumpkit/core
2. Pick monitors + configure
3. Deploy to Railway

**Code Example:**
- Show the simplest possible bot (~20 lines)

**Pre-Built Bots Section:**
- Monitor Bot features
- Tracker Bot features

**Tech Stack:**
- Grammy, Solana, TypeScript, SQLite, Docker

**Community/Contributing:**
- GitHub, open source, MIT license

### 2. `taglines.md`
10 tagline options:
- "Build PumpFun Telegram bots in minutes"
- "The framework behind PumpFun monitoring"
- (8 more creative options)

### 3. `social-copy.md`
Ready-to-post copy for:
- Twitter/X announcement (280 chars)
- GitHub repo description (one line)
- npm package description (one line)
- Discord/Telegram announcement (paragraph)

### 4. `llms.txt`
An `llms.txt` file for the PumpKit project (for AI discovery):
- Project name, description, links
- Quick overview of what PumpKit is
- Key URLs

### 5. `ai-plugin.json`
`.well-known/ai-plugin.json` manifest for AI agent discoverability.

## Requirements

- Professional but approachable tone
- Developer-focused (not user-focused)
- Emphasize: "ship a bot in hours, not weeks"
- Real code examples, not mockups
- No hype — factual claims backed by actual features

## Do NOT

- Don't create actual HTML/CSS (just content in Markdown)
- Don't create logos or images (just describe them)
