# Submitting Your Plugin to the Marketplace

This guide explains how to list your plugin in the SperaxOS Plugin Marketplace so it can be discovered and used by the community.

---

## ⚠️ CRITICAL: Required Files

> **BUILD WILL FAIL** if you don't create both files:
>
> 1. `src/your-plugin.json` - Plugin definition
> 2. `locales/your-plugin.en-US.json` - **REQUIRED** locale file
>
> Then run `bun run format` to auto-generate other locales.

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Submission Methods](#submission-methods)
- [Plugin Entry Format](#plugin-entry-format)
- [Locale Files](#locale-files)
- [Submission Steps](#submission-steps)
- [Review Process](#review-process)
- [Important Notes](#important-notes)
- [After Submission](#after-submission)

---

## Overview

The SperaxOS Plugin Marketplace is a curated registry of plugins available to all SperaxOS users. Submitting your plugin makes it discoverable in the plugin store and allows users to install it with one click.

**Repository:** [github.com/nirholas/plugin.delivery](https://github.com/nirholas/plugin.delivery)

---

## Prerequisites

Before submitting, ensure:

1. ✅ Your plugin is **functional and tested**
2. ✅ Your plugin server is **deployed and accessible** (e.g., on Vercel)
3. ✅ Your `manifest.json` is **publicly accessible** via HTTPS
4. ✅ Your plugin has a **unique identifier** (not already in use)
5. ✅ You have **tested with SperaxOS** by adding as a custom plugin

---

## Submission Methods

### Method 1: Pull Request (Recommended)

Submit a PR to add your plugin definition to the repository.

### Method 2: GitHub Issue

Open an issue with the "Plugin Submission" template and provide your plugin details.

---

## Plugin Entry Format

Your plugin entry should be a JSON file in the `src/` directory:

```json
{
  "author": "YourName",
  "createdAt": "2025-01-01",
  "homepage": "https://github.com/yourname/your-plugin",
  "identifier": "your-plugin-identifier",
  "manifest": "https://your-plugin.vercel.app/manifest.json",
  "meta": {
    "avatar": "🔌",
    "description": "A brief description of what your plugin does",
    "tags": ["utility", "search"],
    "title": "Your Plugin Name",
    "category": "tools"
  },
  "schemaVersion": 1
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `author` | string | Yes | Your name or organization |
| `createdAt` | string | Yes | Creation date (YYYY-MM-DD format) |
| `homepage` | string | Yes | Plugin homepage or repository URL |
| `identifier` | string | Yes | Unique plugin ID (lowercase, hyphens) |
| `manifest` | string | Yes | URL to your manifest.json |
| `meta.avatar` | string | Yes | Emoji or image URL for the plugin icon |
| `meta.description` | string | Yes | Brief description (under 200 chars) |
| `meta.tags` | string[] | Yes | Categorization tags |
| `meta.title` | string | Yes | Display name |
| `meta.category` | string | Yes | Primary category |
| `schemaVersion` | number | Yes | Always use `1` |

### Available Categories

| Category | Use For |
|----------|---------|
| `stocks-finance` | Financial, crypto, trading plugins |
| `web-search` | Search engines, web crawlers |
| `tools` | Utilities, productivity |
| `media-generate` | Image, video, audio generation |
| `science-education` | Learning, research, academic |
| `gaming-entertainment` | Games, fun, entertainment |
| `lifestyle` | Travel, weather, personal |
| `social` | Social media, communication |

---

## Locale Files

For multi-language support, create locale files in the `locales/` directory:

### Structure

```
locales/
├── your-plugin.en-US.json
├── your-plugin.zh-CN.json
├── your-plugin.ja-JP.json
└── ... (other locales)
```

### Locale File Format

```json
{
  "meta": {
    "title": "Your Plugin Name",
    "description": "A brief description in this language",
    "tags": ["utility", "search"]
  }
}
```

### Supported Locales

- `en-US` - English (United States) **required**
- `zh-CN` - Chinese (Simplified)
- `zh-TW` - Chinese (Traditional)
- `ja-JP` - Japanese
- `ko-KR` - Korean
- `de-DE` - German
- `fr-FR` - French
- `es-ES` - Spanish
- `it-IT` - Italian
- `pt-BR` - Portuguese (Brazil)
- `ru-RU` - Russian
- `ar` - Arabic
- `bg-BG` - Bulgarian
- `fa-IR` - Persian
- `nl-NL` - Dutch
- `pl-PL` - Polish
- `tr-TR` - Turkish
- `vi-VN` - Vietnamese

> **Tip:** You only need to provide `en-US`. The build system can auto-generate other locales using AI translation (requires `OPENAI_API_KEY`).

---

## Submission Steps

### Step 1: Fork the Repository

```bash
# Fork via GitHub UI, then clone your fork
git clone https://github.com/YOUR_USERNAME/plugin.delivery.git
cd plugin.delivery
```

### Step 2: Create Plugin Entry

Create a new file `src/your-plugin.json`:

```bash
touch src/your-plugin.json
```

Add your plugin definition (see [Plugin Entry Format](#plugin-entry-format)).

### Step 3: Create Locale File (REQUIRED - BUILD WILL FAIL WITHOUT THIS)

⚠️ **This step is mandatory. The build breaks without the locale file.**

Create the required English locale file:

```bash
touch locales/your-plugin.en-US.json
```

Add your locale content (copy `title`, `description`, `tags` from your plugin's `meta`):

```json
{
  "meta": {
    "title": "Your Plugin Name",
    "description": "A brief description of your plugin",
    "tags": ["utility"]
  }
}
```

### Step 4: Generate Other Locales

Run the format command to auto-generate all other language translations:

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-key-here"

# Generate all locale files
bun run format
```

This will create `your-plugin.ar.json`, `your-plugin.zh-CN.json`, etc.

### Step 5: Validate Your Submission

```bash
# Build the index to verify everything works
bun run build
```

### Step 6: Commit and Push

```bash
git add src/your-plugin.json locales/your-plugin.*.json
git commit -m "feat: add your-plugin to marketplace"
git push origin main
```

### Step 7: Open Pull Request

1. Go to [github.com/nirholas/plugin.delivery](https://github.com/nirholas/plugin.delivery)
2. Click "Compare & pull request"
3. Fill in the PR template with:
   - Plugin name and description
   - Link to plugin homepage
   - Brief explanation of functionality
4. Submit the pull request

---

## Review Process

After submission, your plugin will be reviewed for:

1. **Functionality** - Plugin must work correctly
2. **Security** - No malicious code or data collection
3. **Quality** - Reasonable code quality and UX
4. **Relevance** - Adds value to the ecosystem
5. **Uniqueness** - Not a duplicate of existing plugins

### Review Timeline

- Initial review: 1-3 business days
- Feedback (if needed): Via PR comments
- Merge (if approved): Within 1 week

---

## Important Notes

### What Gets Accepted

✅ Functional plugins that work as described
✅ Plugins that add value to the ecosystem
✅ Well-documented plugins with clear descriptions
✅ Plugins from any author (you don't have to be the original creator)

### What May Be Rejected

❌ Non-functional or broken plugins
❌ Duplicate plugins (same functionality as existing)
❌ Malicious or harmful plugins
❌ Plugins violating terms of service
❌ Low-quality or spammy submissions

### Plugin Maintenance

- Plugins must remain **functional** to stay listed
- If a plugin becomes **unavailable or unmaintained**, we may:
  - Redirect to a fork
  - Remove from the index
- Plugin authors are encouraged to:
  - Respond to issues
  - Keep dependencies updated
  - Fix reported bugs

### Corrections and Removals

If you need to:

- **Update your plugin** - Submit a PR with changes
- **Remove your plugin** - Open an issue requesting removal
- **Report incorrect info** - Open an issue with corrections

---

## After Submission

Once your plugin is merged:

1. **Build runs automatically** - The CI/CD pipeline builds the index
2. **Plugin appears in store** - Usually within minutes of deployment
3. **Users can install** - Via the SperaxOS Plugin Store
4. **Analytics** - Track usage through your own analytics (if implemented)

### Updating Your Plugin

To update an already-listed plugin:

1. Update your `src/your-plugin.json` file
2. Update locale files if descriptions changed
3. Submit a PR with the changes
4. Changes deploy automatically after merge

---

## Reference Plugins

Learn from these official reference implementations:

| Plugin | Type | Description | Repository |
|--------|------|-------------|------------|
| **CoinGecko** | OpenAPI | Cryptocurrency data | `public/openai/coingecko/` |
| **DeFiLlama** | OpenAPI | DeFi analytics | `public/defillama/` |
| **Search Engine** | Default | Web search | Templates: `templates/default/` |
| **Markdown Demo** | Markdown | Formatted output | Templates: `templates/markdown/` |
| **Interactive Widget** | Standalone | Full interaction | Templates: `templates/standalone/` |

---

## Getting Help

- **Documentation:** This guide and related docs
- **GitHub Issues:** [github.com/nirholas/plugin.delivery/issues](https://github.com/nirholas/plugin.delivery/issues)
- **Twitter/X:** [@nichxbt](https://x.com/nichxbt)

---

## Next Steps

- [Quick Start Guide](./QUICK_START.md) - Build your first plugin
- [Plugin Manifest Reference](./PLUGIN_MANIFEST.md) - Complete manifest documentation
- [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md) - Full development documentation
