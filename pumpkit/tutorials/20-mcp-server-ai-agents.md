# Tutorial 20: MCP Server for AI Agents

> Expose the Pump SDK as 53 AI tools via the Model Context Protocol — let Claude, GPT, and Cursor trade tokens with natural language.

## Prerequisites

- Node.js 18+
- `@nirholas/pump-sdk` installed
- An MCP-compatible AI client (Claude Desktop, Cursor, or any MCP host)

```bash
npm install @nirholas/pump-sdk @solana/web3.js @modelcontextprotocol/sdk bn.js bs58
```

## What Is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) is a JSON-RPC 2.0 standard that lets AI models call external tools. Instead of pasting code into a chat, you expose SDK functions as callable tools — the AI agent can then create tokens, check prices, and manage fees by calling your server directly.

## Architecture

```
┌────────────────┐       JSON-RPC 2.0        ┌──────────────────┐
│  AI Client     │ ◄──── (stdio / HTTP) ────► │  MCP Server      │
│  (Claude, GPT) │                            │  (Pump SDK tools)│
└────────────────┘                            └────────┬─────────┘
                                                       │
                                              ┌────────▼─────────┐
                                              │  Pump SDK        │
                                              │  + Solana RPC    │
                                              └──────────────────┘
```

## Step 1: Create the Server Skeleton

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk, PUMP_SDK } from "@nirholas/pump-sdk";
import BN from "bn.js";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  "confirmed"
);
const onlineSdk = new OnlinePumpSdk(connection);

const server = new Server(
  { name: "pump-sdk-mcp", version: "1.0.0" },
  {
    capabilities: {
      tools: { listChanged: true },
      resources: { subscribe: false, listChanged: true },
      prompts: { listChanged: true },
    },
  }
);
```

## Step 2: Define Tool Schemas

Register tools that the AI agent can discover and call:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_token_price",
      description: "Get the current price and market cap of a Pump token from its bonding curve",
      inputSchema: {
        type: "object",
        properties: {
          mint: { type: "string", description: "Token mint address (base58)" },
        },
        required: ["mint"],
      },
    },
    {
      name: "quote_buy",
      description: "Quote how many tokens you'd receive for a given SOL amount",
      inputSchema: {
        type: "object",
        properties: {
          mint: { type: "string", description: "Token mint address" },
          solAmount: { type: "string", description: "SOL amount in lamports (use BN string)" },
        },
        required: ["mint", "solAmount"],
      },
    },
    {
      name: "get_graduation_progress",
      description: "Check how close a token is to graduating from the bonding curve to PumpAMM",
      inputSchema: {
        type: "object",
        properties: {
          mint: { type: "string", description: "Token mint address" },
        },
        required: ["mint"],
      },
    },
    {
      name: "get_creator_fees",
      description: "Check unclaimed creator fees across both Pump and PumpAMM programs",
      inputSchema: {
        type: "object",
        properties: {
          creator: { type: "string", description: "Creator wallet address" },
        },
        required: ["creator"],
      },
    },
    {
      name: "get_fee_sharing_config",
      description: "Get the fee sharing configuration and shareholders for a token",
      inputSchema: {
        type: "object",
        properties: {
          mint: { type: "string", description: "Token mint address" },
        },
        required: ["mint"],
      },
    },
  ],
}));
```

## Step 3: Implement Tool Handlers

```typescript
import {
  getBuyTokenAmountFromSolAmount,
  bondingCurveMarketCap,
  bondingCurveGraduationProgress,
} from "@nirholas/pump-sdk";

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "get_token_price": {
      const mint = new PublicKey(args.mint as string);
      const bc = await onlineSdk.fetchBondingCurve(mint);

      if (bc.complete) {
        return {
          content: [{ type: "text", text: JSON.stringify({
            status: "graduated",
            message: "Token has graduated to PumpAMM. Use AMM pool for pricing.",
            complete: true,
          }) }],
        };
      }

      const marketCap = bondingCurveMarketCap({
        mintSupply: bc.tokenTotalSupply,
        virtualSolReserves: bc.virtualSolReserves,
        virtualTokenReserves: bc.virtualTokenReserves,
      });

      const price = bc.virtualSolReserves.toNumber() / bc.virtualTokenReserves.toNumber();

      return {
        content: [{ type: "text", text: JSON.stringify({
          mint: mint.toBase58(),
          priceLamportsPerToken: price,
          marketCapLamports: marketCap.toString(),
          realSolReserves: bc.realSolReserves.toString(),
          realTokenReserves: bc.realTokenReserves.toString(),
          complete: bc.complete,
        }) }],
      };
    }

    case "quote_buy": {
      const mint = new PublicKey(args.mint as string);
      const solAmount = new BN(args.solAmount as string);
      const bc = await onlineSdk.fetchBondingCurve(mint);
      const feeConfig = await onlineSdk.fetchFeeConfig();

      const tokensOut = getBuyTokenAmountFromSolAmount(
        solAmount,
        bc.virtualSolReserves,
        bc.virtualTokenReserves,
        feeConfig
      );

      return {
        content: [{ type: "text", text: JSON.stringify({
          solIn: solAmount.toString(),
          tokensOut: tokensOut.toString(),
          pricePerToken: solAmount.toNumber() / tokensOut.toNumber(),
        }) }],
      };
    }

    case "get_graduation_progress": {
      const mint = new PublicKey(args.mint as string);
      const bc = await onlineSdk.fetchBondingCurve(mint);

      const progress = bondingCurveGraduationProgress({
        realSolReserves: bc.realSolReserves,
        realTokenReserves: bc.realTokenReserves,
      });

      return {
        content: [{ type: "text", text: JSON.stringify({
          mint: mint.toBase58(),
          complete: bc.complete,
          progressPercent: progress,
        }) }],
      };
    }

    case "get_creator_fees": {
      const creator = new PublicKey(args.creator as string);
      const balance = await onlineSdk.getCreatorVaultBalanceBothPrograms(creator);

      return {
        content: [{ type: "text", text: JSON.stringify({
          creator: creator.toBase58(),
          unclaimedLamports: balance.toString(),
          unclaimedSol: balance.toNumber() / 1e9,
        }) }],
      };
    }

    case "get_fee_sharing_config": {
      const mint = new PublicKey(args.mint as string);
      const config = await onlineSdk.fetchFeeSharingConfig(mint);

      return {
        content: [{ type: "text", text: JSON.stringify({
          mint: mint.toBase58(),
          shareholders: config.shareholders.map((s: any) => ({
            address: s.address.toBase58(),
            shareBps: s.shareBps,
            sharePercent: s.shareBps / 100,
          })),
        }) }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});
```

## Step 4: Start the Server

```typescript
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Pump SDK MCP server running on stdio");
}

main().catch(console.error);
```

## Step 5: Configure Your AI Client

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pump-sdk": {
      "command": "npx",
      "args": ["tsx", "path/to/your/mcp-server.ts"],
      "env": {
        "SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "pump-sdk": {
      "command": "npx",
      "args": ["tsx", "./mcp-server.ts"],
      "env": {
        "SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com"
      }
    }
  }
}
```

## Step 6: Talk to Your Agent

Once connected, you can ask your AI client natural language questions:

- *"What's the current price of token `So11...abc`?"*
- *"How close is this token to graduating?"*
- *"How much in unclaimed creator fees does wallet `ABC...xyz` have?"*
- *"Quote buying 0.5 SOL worth of token `MINT...123`"*

The AI will call your MCP tools automatically and format the results.

## Extending: Add Write Tools

For tools that build transactions (buy, sell, create), return the serialized instructions rather than auto-signing:

```typescript
{
  name: "build_buy_instructions",
  description: "Build buy instructions for a Pump token (returns base64-encoded instructions)",
  inputSchema: {
    type: "object",
    properties: {
      mint: { type: "string", description: "Token mint address" },
      user: { type: "string", description: "Buyer wallet address" },
      solAmount: { type: "string", description: "SOL to spend in lamports" },
      slippageBps: { type: "number", description: "Slippage tolerance in basis points (e.g. 500 = 5%)" },
    },
    required: ["mint", "user", "solAmount"],
  },
}
```

This keeps the server stateless and non-custodial — the user signs transactions in their own wallet.

## Best Practices

1. **Never store private keys** in the MCP server — return unsigned instructions
2. **Validate all inputs** — parse PublicKeys and BN amounts before calling SDK
3. **Rate limit** RPC calls to avoid throttling
4. **Use descriptive tool names** — AI models pick tools based on the `description` field
5. **Return structured JSON** — makes it easy for the AI to parse and present results

## Next Steps

- Add AMM pool tools for graduated tokens
- Add fee sharing management tools
- Add token incentive tracking tools
- Deploy to Railway or Cloudflare Workers for remote access
- See [Tutorial 25](./25-defi-agents-integration.md) for pre-built agent definitions
