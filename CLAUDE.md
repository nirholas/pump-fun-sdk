# Pump SDK — Claude Code Instructions

> Unofficial community PumpFun SDK for creating, buying, and selling tokens on the Solana blockchain. Bonding curve pricing, AMM migration, tiered fees, creator fee sharing, token incentives, and vanity address generation.

## Project Overview

The Pump SDK (`@pump-fun/pump-sdk`) is a TypeScript SDK for the Pump protocol on Solana. It provides:
- **Offline SDK (`PumpSdk`)** — Builds `TransactionInstruction[]` without a connection (singleton: `PUMP_SDK`)
- **Online SDK (`OnlinePumpSdk`)** — Extends offline SDK with RPC fetchers
- **Rust vanity generator** — 100K+ keys/sec multi-threaded generator
- **TypeScript vanity generator** — Educational reference implementation
- **MCP server** — Model Context Protocol for AI agent integration (53 tools)
- **Telegram bot** — PumpFun activity monitor (9 commands: fee claims, CTO alerts, whale trades, graduation)
- **WebSocket relay server** — Real-time token launch broadcasting to browser clients
- **Live dashboards** — Standalone browser UIs for token launches and trade analytics
- **x402 payment protocol** — HTTP 402 micropayments with Solana USDC
- **Shell scripts** — Production Bash wrappers for solana-keygen
- **Tutorials** — 19 hands-on guides covering the full SDK

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/` | Core SDK (instruction builders, bonding curve math, social fees, PDAs, state, events) |
| `rust/` | Rust vanity generator (rayon + solana-sdk) |
| `typescript/` | TypeScript vanity generator (@solana/web3.js) |
| `mcp-server/` | MCP server (53 tools — quoting, trading, fees, analytics, wallet) |
| `telegram-bot/` | PumpFun activity monitor (9 commands — fee claims, CTO, whale, graduation) |
| `websocket-server/` | WebSocket relay — PumpFun API to browser clients |
| `live/` | Standalone live dashboards — token launches + trades analytics |
| `x402/` | x402 payment protocol (HTTP 402 USDC micropayments) |
| `lair-tg/` | Lair — unified Telegram bot platform for DeFi intelligence |
| `tutorials/` | 19 hands-on tutorial guides |
| `scripts/` | Bash scripts (generate, verify, batch) |
| `docs/` | API reference, architecture, guides |
| `tests/` | Cross-language test suites |
| `website/` | PumpOS web desktop with 169 Pump-Store apps |
| `security/` | Security audits and checklists |
| `skills/` | Agent skill documents |
| `prompts/` | Agent prompt templates |

## Security Rules

1. **ONLY** official Solana Labs crypto: `solana-sdk`, `@solana/web3.js`, `solana-keygen`
2. Zeroize all key material after use
3. File permissions `0600` for keypairs
4. No network calls for key generation

## Critical Patterns

- All amounts use `BN` (bn.js) — never JavaScript `number` for financial math
- Instruction builders return `TransactionInstruction[]`, never `Transaction` objects
- `createInstruction` (v1) is deprecated — use `createV2Instruction`
- `BondingCurve.complete === true` means graduated to AMM
- Shares must total exactly 10,000 BPS
- Use `BothPrograms` methods to aggregate across Pump + PumpAMM

### Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** after the command completes, whether it succeeds or fails — never leave terminals open
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal

