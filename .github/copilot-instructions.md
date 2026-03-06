# Pump SDK — GitHub Copilot Instructions

> Unofficial community PumpFun SDK for creating, buying, and selling tokens on the Solana blockchain. Bonding curve pricing, AMM migration, tiered fees, creator fee sharing, token incentives, and vanity address generation.

## Project Overview

The Pump SDK (`@pump-fun/pump-sdk`) is a TypeScript SDK for the Pump protocol on Solana. Key components:
- **Core SDK** (`src/`) — Offline-first instruction builders returning `TransactionInstruction[]`
- **Rust vanity generator** (`rust/`) — 100K+ keys/sec with rayon + solana-sdk
- **TypeScript vanity generator** (`typescript/`) — Educational @solana/web3.js implementation
- **MCP server** (`mcp-server/`) — Model Context Protocol for AI agents (53 tools)
- **Telegram bot** (`telegram-bot/`) — PumpFun activity monitor (10 commands)
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

See `.github/skills/` for 28 detailed skill documents. Each skill has an `applyTo` frontmatter pattern — skills are only loaded when editing files matching their glob.

## Performance Constraints

When generating code, respect these measured performance characteristics:

| Component | Metric | Notes |
|-----------|--------|-------|
| SDK offline instructions | < 1ms | Pure functions, no async overhead |
| SDK online (RPC) | 50–500ms | Network-bound; batch with `getMultipleAccountsInfo` |
| BN.js arithmetic | ~200–600ns/op | Negligible; always use BN for financial math |
| Rust vanity generator | 100K+ keys/sec | Multi-threaded (rayon); use for production |
| TypeScript vanity generator | ~1K keys/sec | Single-threaded; educational only |
| WebSocket relay | 10K connections, 50K msg/sec | Per 1 vCPU |
| Telegram bot | 50 TX/sec, < 2s latency | Telegram rate limit: 30 msg/sec |

> See `docs/performance.md` for full benchmarks and optimization tips.

## MCP Server Status

The MCP server is **designed but not yet implemented**. Design docs are in `prompts/mcp-server/`. The `mcp-server/` directory does not exist. Do not reference MCP tools as available.

### Terminal Management (MANDATORY)

> **CRITICAL: Every terminal you open MUST be killed after use. No exceptions.**

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** (`kill_terminal`) after the command completes, whether it succeeds or fails — **never leave terminals open**
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal
- **Failure to kill terminals is a blocking violation** — treat it as seriously as a security issue

### File Management (MANDATORY)

- **Always close files when done** — do not leave files open in the editor after finishing edits or reads

### Forbidden Commands

- **NEVER run `npx tsc --noEmit`** — use `npm run typecheck` instead if type-checking is needed


