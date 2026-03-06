# Quick Start Guide

Build and deploy your first SperaxOS plugin in under 10 minutes.

## Prerequisites

- [Bun](https://bun.sh) or Node.js 18+
- A code editor (VS Code recommended)
- Basic TypeScript knowledge

---

## Step 1: Choose Your Plugin Type

| I want to... | Use this type | Template |
|--------------|---------------|----------|
| Return data for AI to explain | **Default** | `templates/default` |
| Show formatted text/tables | **Markdown** | `templates/markdown` |
| Build interactive UI | **Standalone** | `templates/standalone` |
| Use existing OpenAPI spec | **OpenAPI** | `templates/openapi` |

---

## Step 2: Create Your Plugin

### Option A: Using a Template (Recommended)

```bash
# Clone the plugins repo
git clone https://github.com/nirholas/plugin.delivery.git
cd plugins

# Copy a template
cp -r templates/default my-plugin
cd my-plugin

# Install dependencies
bun install
```

### Option B: From Scratch

```bash
mkdir my-plugin && cd my-plugin
bun init -y
bun add @sperax/plugin-sdk
```

---

## Step 3: Create Your Manifest

Every plugin needs a `manifest.json`:

```json
{
  "$schema": "https://plugin.delivery/schema.json",
  "identifier": "my-plugin",
  "api": [
    {
      "name": "myFunction",
      "description": "What this function does - be descriptive for the AI",
      "url": "https://my-plugin.vercel.app/api/endpoint",
      "parameters": {
        "type": "object",
        "properties": {
          "param1": {
            "type": "string",
            "description": "Description of param1"
          }
        },
        "required": ["param1"]
      }
    }
  ],
  "meta": {
    "title": "My Plugin",
    "description": "A brief description shown in the plugin store",
    "avatar": "🔌",
    "tags": ["utility"]
  }
}
```

### Key Fields Explained

| Field | Purpose |
|-------|---------|
| `identifier` | Unique plugin ID (lowercase, hyphens allowed) |
| `api[].name` | Function name the AI will call |
| `api[].description` | **Critical** - AI uses this to decide when to call |
| `api[].url` | Your API endpoint URL |
| `api[].parameters` | JSON Schema for function arguments |
| `meta.title` | Display name in plugin store |
| `meta.description` | Short description (under 200 chars) |

---

## Step 4: Implement Your API

Create `api/endpoint.ts`:

```typescript
export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // Parse the request body
  const body = await req.json();
  const { param1 } = body;

  // Your logic here
  const result = await doSomething(param1);

  // Return JSON response
  return Response.json({
    success: true,
    data: result,
  });
}

async function doSomething(input: string) {
  // Your implementation
  return `Processed: ${input}`;
}
```

### Response Format

For **Default** plugins, return JSON that the AI will summarize:

```json
{
  "price": 3450.00,
  "change24h": "+2.5%",
  "volume": "1.2B"
}
```

For **Markdown** plugins, return formatted text:

```json
{
  "markdown": "## Results\n\n| Token | Price |\n|-------|-------|\n| ETH | $3,450 |"
}
```

---

## Step 5: Test Locally

### Start Development Server

```bash
bun dev
# Server runs at http://localhost:3400
```

### Test Your Endpoint

```bash
curl -X POST http://localhost:3400/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"param1": "test"}'
```

### Test in SperaxOS

1. Open SperaxOS
2. Go to **Plugin Settings** → **Add Custom Plugin**
3. Enter: `http://localhost:3400/manifest.json`
4. Enable the plugin
5. Chat: "Use my-plugin to..." 

---

## Step 6: Deploy

### Deploy to Vercel (Free)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Update Your Manifest

After deployment, update `manifest.json` with production URLs:

```json
{
  "api": [
    {
      "url": "https://my-plugin.vercel.app/api/endpoint"
    }
  ]
}
```

---

## Step 7: Publish to Plugin Delivery

### Option A: Submit via GitHub Issue

1. Go to [github.com/nirholas/plugins/issues](https://github.com/nirholas/plugin.delivery/issues)
2. Click "New Issue" → "Plugin Submission"
3. Fill in your plugin details

### Option B: Submit via Pull Request

1. Fork [github.com/nirholas/plugins](https://github.com/nirholas/plugin.delivery)

2. Add your plugin to `src/my-plugin.json`:

```json
{
  "identifier": "my-plugin",
  "author": "your-github-username",
  "createdAt": "2025-01-01",
  "manifest": "https://my-plugin.vercel.app/manifest.json",
  "meta": {
    "avatar": "🔌",
    "title": "My Plugin",
    "description": "What it does",
    "tags": ["utility"],
    "category": "tools"
  }
}
```

3. **⚠️ REQUIRED: Create locale file** `locales/my-plugin.en-US.json`:

```json
{
  "meta": {
    "title": "My Plugin",
    "description": "What it does",
    "tags": ["utility"]
  }
}
```

4. Run `bun run format` to generate all translations (requires `OPENAI_API_KEY`)

5. Submit PR with both `src/my-plugin.json` and `locales/my-plugin.*.json` files

---

## Examples

### Crypto Price Plugin

```typescript
// api/price.ts
export default async function handler(req: Request) {
  const { coin } = await req.json();
  
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd&include_24hr_change=true`
  );
  const data = await res.json();
  
  return Response.json({
    coin,
    price: data[coin]?.usd,
    change24h: data[coin]?.usd_24h_change?.toFixed(2) + '%',
  });
}
```

### Weather Plugin (Markdown)

```typescript
// api/weather.ts
export default async function handler(req: Request) {
  const { city } = await req.json();
  
  const weather = await getWeather(city);
  
  return Response.json({
    markdown: `
## Weather in ${city}

🌡️ **Temperature:** ${weather.temp}°C
💨 **Wind:** ${weather.wind} km/h
💧 **Humidity:** ${weather.humidity}%
    `.trim()
  });
}
```

---

## Common Issues

### "Plugin not showing in store"

- Check manifest URL is accessible (try opening in browser)
- Verify JSON is valid (use jsonlint.com)
- Ensure `identifier` is unique

### "Function not being called"

- Improve `api[].description` - be specific about when to use
- Check parameter descriptions
- Test endpoint directly with curl

### "CORS errors"

Add to your API:

```typescript
export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  
  // ... rest of handler
  
  return Response.json(data, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}
```

---

## Next Steps

- 📖 [Full Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md)
- 🎨 [Plugin Types Deep Dive](./PLUGIN_TYPES.md)
- 📋 [Manifest Reference](./PLUGIN_MANIFEST.md)
- 💬 [Communication Guide](./COMMUNICATION_GUIDE.md) (for Standalone plugins)

---

## Need Help?

- GitHub Issues: [github.com/nirholas/plugins/issues](https://github.com/nirholas/plugin.delivery/issues)
- Twitter/X: [@nichxbt](https://x.com/nichxbt)

---

## Reference Projects

In addition to the templates provided in this repository, you can learn about plugin development based on these reference implementations:

### Official Templates

| Template | Type | Description | Location |
|----------|------|-------------|----------|
| **Default** | `default` | Standard plugin with backend API | `templates/default/` |
| **Markdown** | `markdown` | Returns formatted Markdown | `templates/markdown/` |
| **Standalone** | `standalone` | Interactive React application | `templates/standalone/` |
| **OpenAPI** | `default` | Uses OpenAPI specification | `templates/openapi/` |
| **Basic** | `default` | Minimal starter template | `templates/basic/` |
| **Settings** | `default` | Plugin with user settings | `templates/settings/` |

### Example Plugins

| Plugin | Type | Description | Location |
|--------|------|-------------|----------|
| **CoinGecko** | OpenAPI | Cryptocurrency price data | `public/openai/coingecko/` |
| **DeFiLlama** | OpenAPI | DeFi protocol analytics | `public/defillama/` |

### Framework Examples

The plugin system supports any frontend framework. Here are examples using different approaches:

**Vercel Edge Runtime (Recommended):**
- Fast, global edge network
- TypeScript support
- See: `templates/openapi/`

**Vercel Node.js Runtime:**
- Full Node.js APIs available
- Useful for complex server-side logic
- See: `api/` folder examples

**Next.js Pages Router:**
- Full React framework
- SSR and API routes
- See: `templates/standalone/`

**Pure Frontend (Standalone):**
- No backend required
- Client-side only
- See: `templates/standalone/`

### Contributing Templates

We welcome contributions of plugin templates for more frameworks and languages:

- **Python/Flask** - FastAPI or Flask server template
- **Go** - Gin or Echo server template
- **Rust** - Actix or Axum server template
- **Vue.js** - Vue-based standalone plugin
- **Svelte** - Svelte-based standalone plugin

To contribute:
1. Create your template in `templates/your-framework/`
2. Include a README.md with setup instructions
3. Submit a pull request

---

## What's Next?

After completing this quick start, explore these guides for more advanced topics:

- 📖 [Full Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md) - Comprehensive development documentation
- 🎨 [Plugin Types Deep Dive](./PLUGIN_TYPES.md) - When to use each plugin type
- 📋 [Manifest Reference](./PLUGIN_MANIFEST.md) - Complete manifest field documentation
- 💬 [Communication Guide](./COMMUNICATION_GUIDE.md) - Frontend/backend communication patterns
- 🔌 [SDK API Reference](./SDK_API_REFERENCE.md) - Full SDK documentation
- 📤 [Submit Your Plugin](./SUBMIT_PLUGIN.md) - Get listed in the marketplace
