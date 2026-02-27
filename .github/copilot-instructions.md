# Pump SDK — GitHub Copilot Instructions

> Unofficial community PumpFun SDK for creating, buying, and selling tokens on the Solana blockchain. Bonding curve pricing, AMM migration, tiered fees, creator fee sharing, token incentives, and vanity address generation.

## Project Overview

The Pump SDK (`@pump-fun/pump-sdk`) is a TypeScript SDK for the Pump protocol on Solana. Key components:
- **Core SDK** (`src/`) — Offline-first instruction builders returning `TransactionInstruction[]`
- **Rust vanity generator** (`rust/`) — 100K+ keys/sec with rayon + solana-sdk
- **TypeScript vanity generator** (`typescript/`) — Educational @solana/web3.js implementation
- **MCP server** (`mcp-server/`) — Model Context Protocol for AI agents (47 tools)
- **Telegram bot** (`telegram-bot/`) — PumpFun activity monitor (9 commands)
- **WebSocket relay** (`websocket-server/`) — Real-time token launch broadcasting
- **Live dashboards** (`live/`) — Browser UIs for token launches and trades
- **Shell scripts** (`scripts/`) — Production Bash wrappers for solana-keygen

## SDK Pattern

- `PumpSdk` (offline, singleton `PUMP_SDK`) — builds instructions without connection
- `OnlinePumpSdk` — extends with RPC fetchers
- All amounts use `BN` (bn.js) — never JavaScript `number` for financial math
- `createInstruction` (v1) is deprecated — use `createV2Instruction`

## Security

- ONLY official Solana Labs crypto: `solana-sdk`, `@solana/web3.js`, `solana-keygen`
- Zeroize key material, set file permissions `0600`, no network calls for key generation

## Skills

See `.github/skills/` for 15 detailed skill documents.

### Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** after the command completes, whether it succeeds or fails — never leave terminals open
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal

