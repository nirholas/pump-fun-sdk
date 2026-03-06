# Plugin Templates

Official starter templates for building SperaxOS plugins.

## Available Templates

| Template | Type | Description | Difficulty |
|----------|------|-------------|------------|
| [basic](./basic/) | Default | Full-featured template with testing & CI | ⭐⭐⭐ Advanced |
| [default](./default/) | Default | Backend + optional UI | ⭐⭐ Intermediate |
| [openapi](./openapi/) | OpenAPI | Auto-generated from spec | ⭐⭐ Intermediate |
| [markdown](./markdown/) | Markdown | Rich text output | ⭐ Beginner |
| [standalone](./standalone/) | Standalone | Full React app in chat | ⭐⭐⭐ Advanced |
| [settings](./settings/) | Default | User preferences/API keys | ⭐⭐ Intermediate |

## Quick Start

### 1. Copy Template

```bash
# Default plugin (recommended starting point)
cp -r templates/default my-plugin

# OpenAPI plugin (if you have an OpenAPI spec)
cp -r templates/openapi my-plugin

# Markdown plugin (for formatted text output)
cp -r templates/markdown my-plugin

# Standalone plugin (interactive frontend-only)
cp -r templates/standalone my-plugin

# Settings plugin (API key authentication)
cp -r templates/settings my-plugin

# Basic plugin (full-featured template with all features)
cp -r templates/basic my-plugin
```

### 2. Install Dependencies

```bash
cd my-plugin
pnpm install
```

### 3. Update Configuration

1. Edit `public/manifest-dev.json` with your plugin details
2. Update `package.json` name and description
3. Implement your API logic in `api/` folder

### 4. Start Development

```bash
pnpm dev
```

Server runs at http://localhost:3400

### 5. Test in SperaxOS

1. Open SperaxOS
2. Go to Plugin Settings
3. Add custom plugin: `http://localhost:3400/manifest-dev.json`
4. Start chatting!

## Choosing a Template

```
Need AI to summarize results?
├── YES → Do you have an OpenAPI spec?
│         ├── YES → openapi template
│         ├── NO → Need API key authentication?
│         │        ├── YES → settings template
│         │        └── NO → default template
│
└── NO → Is output pre-formatted Markdown?
          ├── YES → markdown template
          └── NO → Need user interaction?
                    ├── YES → standalone template
                    └── NO → default template
```

## Template Features

### Default Template
- Complete example (clothes recommendation)
- Backend API with Edge Runtime
- Optional frontend UI in iframes
- Gateway for local development
- Production and dev manifests

### OpenAPI Template
- OpenAPI 3.0 spec file (`openapi.json`)
- Example endpoints (greet, calculate)
- Automatic parameter validation
- No separate API definitions needed

### Markdown Template
- Returns Markdown directly (no JSON)
- No AI summarization step
- Fast response times
- Example: time/date display

### Standalone Template
- React + Next.js + Ant Design
- Full SDK integration
- State management with hooks
- Programmatic AI triggers
- No backend required

### Settings Template
- Settings schema in manifest
- API key authentication example
- Server-side settings retrieval
- Error handling for invalid settings

### Basic Template (Advanced)
- Production-ready template
- ESLint + Prettier + Vitest
- Semantic release
- Complete documentation
- GitHub Actions workflows

## Template Contents

Each template includes:

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `public/manifest-dev.json` | Development manifest (with gateway) |
| `public/manifest.json` | Production manifest |
| `api/gateway.ts` | Local gateway for development |
| `api/*.ts` | API endpoint implementations |
| `tsconfig.json` | TypeScript configuration |
| `vercel.json` | Deployment configuration |
| `.gitignore` | Standard ignores |
| `README.md` | Template documentation |

## Deployment

All templates are configured for Vercel deployment:

```bash
# Deploy to Vercel
vercel --prod
```

Then update `public/manifest.json`:
1. Remove the `gateway` field
2. Update all `url` fields to production URLs

## External Resources

- [@sperax/plugin-sdk](https://www.npmjs.com/package/@sperax/plugin-sdk) - Plugin SDK
- [@sperax/chat-plugins-gateway](https://www.npmjs.com/package/@sperax/chat-plugins-gateway) - Gateway package
- [CoinGecko Plugin](../src/coingecko.json) - Real-world example
- [Plugin Development Guide](../docs/PLUGIN_DEVELOPMENT_GUIDE.md) - Full documentation

