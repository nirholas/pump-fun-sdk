# Pump Fun MCP Server

> Model Context Protocol server for the Pump SDK — 55 tools for token creation, trading, fees, analytics, and wallet management on Solana.

## Overview

The MCP server exposes the full [Pump Fun SDK](https://github.com/nicholasb4711/pump-fun-sdk) as an AI-agent-compatible service using the [Model Context Protocol](https://modelcontextprotocol.io/) (v2024-11-05). Any MCP-compatible client (Claude Desktop, Cursor, VS Code Copilot, custom agents) can call these tools to interact with the Pump protocol on Solana.

## Architecture

```
Client (Claude, Cursor, etc.)
    │ JSON-RPC over stdio
    ▼
┌─────────────────────────────┐
│   MCP Server (this package) │
│                             │
│  ┌─────────────────┐        │
│  │ Tool Handlers   │ 55 tools│
│  │ Resource Handlers│ 4 URIs │
│  │ Prompt Handlers  │ 5 flows│
│  └─────────────────┘        │
│           │                 │
│  ┌─────────────────┐        │
│  │  OnlinePumpSdk  │ lazy   │
│  └─────────────────┘        │
└──────────────┬──────────────┘
               │ RPC
               ▼
         Solana Mainnet
```

## Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| **Wallet** | 7 | Generate keypairs, vanity addresses, sign/verify messages, validate addresses |
| **Quoting** | 8 | Buy/sell quotes, price impact, market cap, bonding curve summary, graduation progress |
| **Trading** | 6 | Build buy/sell/create/migrate instructions, AMM swaps |
| **Fees** | 8 | Fee tiers, breakdowns, creator vault, distribution, shareholder management |
| **Analytics** | 7 | Bonding curve analysis, token info, creator profiles, graduation status |
| **AMM** | 5 | Pool info, reserves, pricing, deposit/withdraw liquidity |
| **Social Fees** | 6 | Fee sharing configuration, shareholder management, vault operations |
| **Metadata** | 4 | Token metadata, off-chain URI resolution, mint details |
| **Token Incentives** | 4 | Unclaimed tokens, current day earnings, volume stats, claim instructions |

## Resources

| URI | Description |
|-----|-------------|
| `solana://programs` | Pump protocol program IDs |
| `solana://config` | SDK version and configuration |
| `solana://keypair/{id}` | Generated keypair (public info only) |
| `solana://address/{pubkey}` | Address validation and type info |

## Prompts

| Name | Description |
|------|-------------|
| `create_token` | Step-by-step token creation workflow |
| `buy_token` | Buy tokens on bonding curve or AMM |
| `setup_fee_sharing` | Configure fee sharing with shareholders |
| `check_portfolio` | Analyze wallet's PumpFun portfolio |
| `graduation_check` | Check token graduation status and progress |

## Quick Start

### Install

```bash
cd mcp-server
npm install
npm run build
```

### Configure in Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pump-fun": {
      "command": "node",
      "args": ["/path/to/pump-fun-sdk/mcp-server/dist/index.js"],
      "env": {
        "SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com"
      }
    }
  }
}
```

### Configure in VS Code / Cursor

```json
{
  "mcp": {
    "servers": {
      "pump-fun": {
        "command": "node",
        "args": ["./mcp-server/dist/index.js"],
        "env": {
          "SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com"
        }
      }
    }
  }
}
```

### Development

```bash
npm run dev    # Run with tsx (hot reload)
npm run lint   # Type-check without emitting
npm test       # Run vitest
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |

## Security

- **Key zeroization**: All keypair material is zeroized on server shutdown and after each operation
- **Private keys never exposed**: Resource reads for keypairs only return public keys
- **Ed25519 signing**: Uses `@noble/curves/ed25519` (audited, pure JS)
- **Input validation**: All tool inputs validated with Zod schemas
- **Lazy SDK**: RPC connection only created when an SDK tool is actually called
- **No persistent storage**: Keypairs exist only in server memory for the session duration

## Project Structure

```
mcp-server/
├── src/
│   ├── index.ts              # Entry point (#!/usr/bin/env node)
│   ├── server.ts             # SolanaWalletMCPServer class
│   ├── types.ts              # ToolResult, ResourceResult, PromptResult, ServerState
│   ├── handlers/
│   │   ├── tools.ts          # ListTools + CallTool handlers
│   │   ├── resources.ts      # ListResources + ReadResource handlers
│   │   └── prompts.ts        # ListPrompts + GetPrompt handlers
│   ├── tools/
│   │   ├── index.ts          # ALL_TOOLS registry (55 tools)
│   │   ├── quoting.ts        # Buy/sell quotes, price impact
│   │   ├── trading.ts        # Instruction builders
│   │   ├── fees.ts           # Fee tiers, distribution
│   │   ├── analytics.ts      # Bonding curve, graduation
│   │   ├── wallet.ts         # Keypair generation, signing
│   │   ├── amm.ts            # AMM pool operations
│   │   ├── social-fees.ts    # Fee sharing
│   │   ├── token-incentives.ts
│   │   └── metadata.ts       # Token metadata
│   ├── resources/
│   │   ├── index.ts          # Resource router
│   │   └── keypair.ts        # Keypair resources
│   ├── prompts/
│   │   └── index.ts          # 5 prompt templates
│   └── utils/
│       ├── validation.ts     # Zod schemas
│       └── formatting.ts     # BN/SOL formatters
├── package.json
└── tsconfig.json
```

## License

MIT
