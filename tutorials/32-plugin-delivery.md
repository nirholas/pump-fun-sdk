# Tutorial 32: Building Plugins with Plugin Delivery

> Create, publish, and integrate AI-compatible plugins for the Pump SDK using the Plugin Delivery marketplace framework.

## Prerequisites

- Node.js 18+
- TypeScript knowledge
- Familiarity with REST APIs

```bash
npm install @sperax/plugin-sdk
```

## What Is Plugin Delivery?

Plugin Delivery is an AI plugin marketplace that lets you package SDK functions as discoverable, callable plugins. Each plugin exposes functions with typed schemas that any AI model or client app can invoke.

**17 built-in plugins** include: pump-fun-sdk, coingecko, dexscreener, 1inch, ens-lookup, gas-estimator, and more.

## Plugin Architecture

```
┌──────────────┐     Discovery      ┌──────────────────┐
│  AI Client   │ ◄────────────────► │  Plugin Registry  │
│  (GPT, etc.) │     (manifest)     │  (JSON index)     │
└──────┬───────┘                    └──────────────────┘
       │
       │  Function Call
       ▼
┌──────────────┐     HTTP/Edge      ┌──────────────────┐
│  Gateway     │ ◄────────────────► │  Plugin Handler   │
│  (router)    │                    │  (your code)      │
└──────────────┘                    └──────────────────┘
```

## Step 1: Define a Plugin Manifest

```json
{
  "name": "pump-token-analytics",
  "description": "Real-time Pump token analytics — prices, graduation progress, fee info",
  "version": "1.0.0",
  "functions": [
    {
      "name": "getTokenPrice",
      "description": "Get current buy/sell price and market cap for a Pump token",
      "parameters": {
        "type": "object",
        "properties": {
          "mint": {
            "type": "string",
            "description": "Token mint address (Base58)"
          }
        },
        "required": ["mint"]
      }
    },
    {
      "name": "getGraduationProgress",
      "description": "Check how close a token is to graduating from bonding curve to AMM",
      "parameters": {
        "type": "object",
        "properties": {
          "mint": {
            "type": "string",
            "description": "Token mint address"
          }
        },
        "required": ["mint"]
      }
    },
    {
      "name": "quoteBuy",
      "description": "Quote how many tokens you receive for a SOL amount",
      "parameters": {
        "type": "object",
        "properties": {
          "mint": { "type": "string", "description": "Token mint address" },
          "solAmount": { "type": "number", "description": "SOL amount (e.g., 0.5)" }
        },
        "required": ["mint", "solAmount"]
      }
    },
    {
      "name": "getCreatorFees",
      "description": "Check unclaimed creator fees for a wallet",
      "parameters": {
        "type": "object",
        "properties": {
          "creator": { "type": "string", "description": "Creator wallet address" }
        },
        "required": ["creator"]
      }
    }
  ],
  "ui": {
    "mode": "default"
  }
}
```

### UI Modes

| Mode | Rendering | Best For |
|------|-----------|----------|
| `default` | AI formats JSON response | Data APIs (prices, quotes) |
| `markdown` | Pre-formatted markdown | Reports, documentation |
| `standalone` | React/HTML in iframe | Dashboards, interactive UIs |
| `openapi` | Auto-generated from spec | Wrapping existing APIs |

## Step 2: Implement Function Handlers

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import {
  OnlinePumpSdk,
  getTokenPrice,
  getGraduationProgress,
  getBuyTokenAmountFromSolAmount,
} from "@pump-fun/pump-sdk";
import BN from "bn.js";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "confirmed"
);
const onlineSdk = new OnlinePumpSdk(connection);

type FunctionHandler = (params: Record<string, any>) => Promise<any>;

const handlers: Record<string, FunctionHandler> = {
  async getTokenPrice({ mint }) {
    const mintPk = new PublicKey(mint);
    const [global, bc, feeConfig] = await Promise.all([
      onlineSdk.fetchGlobal(),
      onlineSdk.fetchBondingCurve(mintPk),
      onlineSdk.fetchFeeConfig(),
    ]);

    const price = getTokenPrice({
      global,
      feeConfig,
      mintSupply: bc.tokenTotalSupply,
      bondingCurve: bc,
    });

    return {
      mint,
      buyPriceSol: price.buyPricePerToken.toNumber() / 1e9,
      sellPriceSol: price.sellPricePerToken.toNumber() / 1e9,
      marketCapSol: price.marketCap.toNumber() / 1e9,
      isGraduated: price.isGraduated,
    };
  },

  async getGraduationProgress({ mint }) {
    const mintPk = new PublicKey(mint);
    const [global, bc] = await Promise.all([
      onlineSdk.fetchGlobal(),
      onlineSdk.fetchBondingCurve(mintPk),
    ]);

    const progress = getGraduationProgress(global, bc);

    return {
      mint,
      progressPercent: progress.progressBps / 100,
      isGraduated: progress.isGraduated,
      tokensRemaining: progress.tokensRemaining.toString(),
      solAccumulated: progress.solAccumulated.toNumber() / 1e9,
    };
  },

  async quoteBuy({ mint, solAmount }) {
    const mintPk = new PublicKey(mint);
    const lamports = new BN(Math.floor(solAmount * 1e9));
    const [global, bc, feeConfig] = await Promise.all([
      onlineSdk.fetchGlobal(),
      onlineSdk.fetchBondingCurve(mintPk),
      onlineSdk.fetchFeeConfig(),
    ]);

    const tokensOut = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: bc.tokenTotalSupply,
      bondingCurve: bc,
      amount: lamports,
    });

    return {
      mint,
      solIn: solAmount,
      tokensOut: tokensOut.toString(),
      effectivePrice: lamports.toNumber() / tokensOut.toNumber(),
    };
  },

  async getCreatorFees({ creator }) {
    const creatorPk = new PublicKey(creator);
    const balance = await onlineSdk.getCreatorVaultBalanceBothPrograms(creatorPk);

    return {
      creator,
      unclaimedLamports: balance.toString(),
      unclaimedSol: balance.toNumber() / 1e9,
    };
  },
};
```

## Step 3: Create the Plugin Server

```typescript
import express from "express";
import manifest from "./manifest.json";

const app = express();
app.use(express.json());

// Serve the plugin manifest
app.get("/manifest.json", (req, res) => {
  res.json(manifest);
});

// Handle function calls
app.post("/functions/:name", async (req, res) => {
  const { name } = req.params;
  const handler = handlers[name];

  if (!handler) {
    res.status(404).json({ error: `Function '${name}' not found` });
    return;
  }

  try {
    const result = await handler(req.body);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List available functions
app.get("/functions", (req, res) => {
  res.json({
    functions: manifest.functions.map((f: any) => ({
      name: f.name,
      description: f.description,
    })),
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", plugin: manifest.name, version: manifest.version });
});

const PORT = parseInt(process.env.PORT || "3001", 10);
app.listen(PORT, () => {
  console.log(`Plugin server running on port ${PORT}`);
  console.log(`Manifest: http://localhost:${PORT}/manifest.json`);
});
```

## Step 4: Build a Standalone UI Plugin

For interactive dashboards, use `standalone` mode:

```json
{
  "name": "pump-dashboard",
  "ui": {
    "mode": "standalone",
    "url": "https://your-dashboard.vercel.app",
    "height": 600
  }
}
```

The standalone UI communicates with the host via the client SDK:

```typescript
import { speraxOS } from "@sperax/plugin-sdk/client";

// Trigger a function call from the UI
async function fetchPrice(mint: string) {
  const result = await speraxOS.triggerFunctionCall({
    name: "getTokenPrice",
    arguments: { mint },
  });
  return result;
}

// Listen for events from the host
speraxOS.onMessage((message) => {
  console.log("Message from host:", message);
});
```

## Step 5: Register in the Plugin Marketplace

Add your plugin to the registry:

```typescript
// Register via API
const response = await fetch("https://plugin.delivery/api/plugins", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    manifestUrl: "https://your-server.com/manifest.json",
    category: "defi",
    tags: ["pump-fun", "solana", "analytics"],
  }),
});
```

## Step 6: Consume Plugins from Client Code

```typescript
// Discover and call plugins
async function callPlugin(
  pluginUrl: string,
  functionName: string,
  params: Record<string, any>
) {
  // 1. Fetch manifest
  const manifest = await fetch(`${pluginUrl}/manifest.json`).then((r) =>
    r.json()
  );

  // 2. Validate function exists
  const fn = manifest.functions.find((f: any) => f.name === functionName);
  if (!fn) throw new Error(`Function ${functionName} not found in plugin`);

  // 3. Call the function
  const result = await fetch(`${pluginUrl}/functions/${functionName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then((r) => r.json());

  return result;
}

// Usage
const price = await callPlugin(
  "https://pump-analytics.vercel.app",
  "getTokenPrice",
  { mint: "So11111111111111111111111111111111111111112" }
);
```

## Deployment

### Vercel Edge Functions

```bash
cd your-plugin
npx vercel
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

## Next Steps

- See [Tutorial 20](./20-mcp-server-ai-agents.md) for MCP integration (different protocol)
- See [Tutorial 25](./25-defi-agents-integration.md) for agent definitions
- See [Tutorial 28](./28-analytics-price-quotes.md) for analytics functions to expose
