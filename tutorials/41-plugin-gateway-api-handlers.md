# Tutorial 41: Plugin Gateway — Building & Deploying API Handlers

> Create serverless API handlers for the Plugin Delivery gateway — 17 existing plugins, schema validation, and edge function deployment.

## Prerequisites

- Node.js 18+
- Familiarity with Vercel Edge Functions (or any edge runtime)

```bash
cd packages/plugin.delivery && npm install
```

## Architecture

The Plugin Gateway routes AI agent requests to serverless API handlers:

```
AI Chat (Claude, GPT, etc.)
    │
    ▼
Plugin Delivery Gateway
    │
    ├── /api/pump-fun-sdk/*     → Pump SDK queries
    ├── /api/coingecko/*        → Price data
    ├── /api/dexscreener/*      → DEX analytics
    ├── /api/defillama/*        → TVL + yields
    ├── /api/contract-scanner/* → Smart contract analysis
    ├── /api/phishing-detector/*→ Scam detection
    ├── /api/sanctions-check/*  → OFAC compliance
    └── ... (17 total)
```

## Step 1: Existing Plugin Handlers

The gateway ships with 17 ready-to-use handlers:

| Handler | Endpoint | What It Does |
|---------|----------|-------------|
| `pump-fun-sdk` | `/api/pump-fun-sdk/*` | Token quotes, bonding curves, fees |
| `coingecko` | `/api/coingecko/price` | Token prices + market cap |
| `dexscreener` | `/api/dexscreener/*` | DEX pair analytics |
| `defillama` | `/api/defillama/*` | TVL and yield data |
| `contract-scanner` | `/api/contract-scanner/*` | Smart contract analysis |
| `phishing-detector` | `/api/phishing-detector/*` | Scam URL detection |
| `sanctions-check` | `/api/sanctions-check/*` | OFAC address screening |
| `address-labels` | `/api/address-labels/*` | Known address labeling |
| `audit-checker` | `/api/audit-checker/*` | Protocol audit status |
| `gas-estimator` | `/api/gas-estimator/*` | Transaction cost estimation |
| `ens-lookup` | `/api/ens-lookup/*` | ENS/SNS name resolution |
| `beefy` | `/api/beefy/*` | Beefy Finance vaults |
| `lido` | `/api/lido/*` | Lido staking data |
| `oneinch` | `/api/oneinch/*` | 1inch swap quotes |
| `thegraph` | `/api/thegraph/*` | Subgraph queries |
| `grants-finder` | `/api/grants-finder/*` | Web3 grants discovery |
| `gateway` | `/api/gateway/*` | Gateway meta-routes |

## Step 2: Anatomy of a Handler

Every handler follows the Edge Function pattern:

```typescript
// api/coingecko/price.ts
export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  // 1. Validate request method
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // 2. Parse input
  const { ids, vs_currencies = "usd" } = await req.json();

  if (!ids) {
    return new Response(
      JSON.stringify({ error: "ids parameter required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 3. Call external API
  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", ids);
  url.searchParams.set("vs_currencies", vs_currencies);
  url.searchParams.set("include_24hr_change", "true");
  url.searchParams.set("include_market_cap", "true");

  const response = await fetch(url.toString());
  const data = await response.json();

  // 4. Return formatted result
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}
```

## Step 3: Create a Custom Handler

Build a new handler for your own data source:

```typescript
// api/my-plugin/analytics.ts
export const config = { runtime: "edge" };

interface AnalyticsRequest {
  mint: string;
  timeframe?: "1h" | "24h" | "7d";
}

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body: AnalyticsRequest = await req.json();

  if (!body.mint) {
    return new Response(
      JSON.stringify({ error: "mint address required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const timeframe = body.timeframe || "24h";

  // Your analytics logic here
  const analytics = {
    mint: body.mint,
    timeframe,
    trades: 1234,
    volumeSol: 567.89,
    uniqueTraders: 89,
    priceChange: 0.15,
    timestamp: Date.now(),
  };

  return new Response(JSON.stringify(analytics), {
    headers: { "Content-Type": "application/json" },
  });
}
```

## Step 4: Plugin Manifest

Every plugin needs a manifest that describes its API to AI agents:

```typescript
import { z } from "zod";

// The manifest schema (from Plugin SDK)
const manifest = {
  identifier: "my-analytics-plugin",
  type: "default", // "default" | "markdown" | "standalone"

  meta: {
    title: "Token Analytics",
    description: "Real-time Pump token analytics",
    avatar: "📊",
    tags: ["defi", "analytics", "pump"],
  },

  author: "your-name",

  api: [
    {
      name: "getTokenAnalytics",
      description: "Get trading analytics for a Pump token by mint address",
      parameters: {
        type: "object",
        properties: {
          mint: {
            type: "string",
            description: "The token mint address",
          },
          timeframe: {
            type: "string",
            enum: ["1h", "24h", "7d"],
            description: "Analytics timeframe (default: 24h)",
          },
        },
        required: ["mint"],
      },
      url: "https://your-domain.vercel.app/api/my-plugin/analytics",
    },
  ],

  // Optional: system role for the AI
  systemRole:
    "You are a DeFi analytics assistant. Use the getTokenAnalytics tool to fetch real-time trading data for Pump tokens.",

  // Optional: settings schema for user configuration
  settings: {
    type: "object",
    properties: {
      apiKey: { type: "string", description: "Your API key" },
    },
  },
};
```

### Plugin Types

| Type | Behavior |
|------|----------|
| `default` | AI calls API → formats JSON response as text |
| `markdown` | API returns Markdown → rendered directly |
| `standalone` | Embeds an iframe with interactive UI |
| `openapi` | Auto-generates tools from OpenAPI spec |

## Step 5: Plugin SDK — Schema Validation

Use the SDK to validate manifests and read settings:

```typescript
import {
  pluginManifestSchema,
  getPluginSettingsFromRequest,
  createHeadersWithPluginSettings,
} from "@pump-fun/plugin-delivery-sdk";

// Validate a manifest
const result = pluginManifestSchema.safeParse(manifest);
if (!result.success) {
  console.error("Invalid manifest:", result.error.issues);
}

// Read settings from incoming request (in handler)
export default async function handler(req: Request) {
  // Plugin settings are passed via X-Sperax-Plugin-Settings header
  const settings = getPluginSettingsFromRequest<{ apiKey: string }>(req);

  if (!settings?.apiKey) {
    return new Response(
      JSON.stringify({ error: "API key required in plugin settings" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Use the API key...
}

// Client-side: send settings with request
const headers = createHeadersWithPluginSettings(
  { apiKey: "my-key-123" },
  { "Content-Type": "application/json" }
);
```

## Step 6: Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd packages/plugin.delivery
vercel deploy

# Or link to a project
vercel link
vercel deploy --prod
```

### Environment Variables

```bash
# Set secrets for your handlers
vercel env add COINGECKO_API_KEY
vercel env add RPC_URL
```

## Step 7: Register Your Plugin

Make your plugin discoverable by adding it to the gateway:

```typescript
// packages/plugin.delivery/src/registry.ts
export const plugins = [
  // ... existing plugins
  {
    identifier: "my-analytics-plugin",
    manifestUrl: "https://your-domain.vercel.app/manifest.json",
    category: "analytics",
  },
];
```

## Templates

The gateway provides 6 starter templates:

| Template | Use Case |
|----------|----------|
| `basic` | Minimal JSON API handler |
| `default` | Standard plugin with manifest |
| `markdown` | Returns formatted Markdown |
| `openapi` | Auto-generates from OpenAPI spec |
| `settings` | Plugin with user configuration |
| `standalone` | Interactive iframe UI |

## Next Steps

- See [Tutorial 32](./32-plugin-delivery.md) for plugin manifest basics
- See [Tutorial 43](./43-standalone-plugin-artifacts.md) for interactive iframe plugins
- See [Tutorial 36](./36-x402-facilitator-service.md) for paywalling plugin APIs
