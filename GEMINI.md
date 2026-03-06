# Pump SDK — Gemini Instructions

> Unofficial community PumpFun SDK for creating, buying, and selling tokens on the Solana blockchain. Bonding curve pricing, AMM migration, tiered fees, creator fee sharing, token incentives, and vanity address generation.

## Project Overview

The Pump SDK (`@pump-fun/pump-sdk`) is a TypeScript SDK for the Pump protocol on Solana. It provides:
- **Offline SDK (`PumpSdk`)** — Builds `TransactionInstruction[]` without a connection (singleton: `PUMP_SDK`)
- **Online SDK (`OnlinePumpSdk`)** — Extends offline SDK with RPC fetchers
- **Rust vanity generator** — 100K+ keys/sec multi-threaded generator
- **TypeScript vanity generator** — Educational reference implementation
- **MCP server** — Model Context Protocol for AI agent integration (53 tools)
- **Telegram bot** — PumpFun activity monitor (10 commands: fee claims, CTO alerts, whale trades, graduation)
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
| `telegram-bot/` | PumpFun activity monitor (10 commands — fee claims, CTO, whale, graduation) |
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

## On-Chain Programs

| Program | ID | Purpose |
|---------|-----|---------|
| Pump | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve operations |
| PumpAMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Graduated AMM pools |
| PumpFees | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing |

## Official Pump Protocol Docs

**Canonical protocol specs** from pump-fun/pump-public-docs are in `docs/pump-official/`. Read these before modifying on-chain code:

| Task | Read This File |
|------|---------------|
| Bonding curve buy/sell/create, Global/BondingCurve state | `docs/pump-official/PUMP_PROGRAM_README.md` |
| Creator fees on bonding curve | `docs/pump-official/PUMP_CREATOR_FEE_README.md` |
| AMM pool swap/deposit/withdraw, Pool/GlobalConfig state | `docs/pump-official/PUMP_SWAP_README.md` |
| PumpSwap SDK methods & autocomplete helpers | `docs/pump-official/PUMP_SWAP_SDK_README.md` |
| Creator fees on AMM pools | `docs/pump-official/PUMP_SWAP_CREATOR_FEE_README.md` |
| Dynamic fee tiers, market-cap-based fee calculation | `docs/pump-official/FEE_PROGRAM_README.md` |
| Cashback rewards, UserVolumeAccumulator PDA | `docs/pump-official/PUMP_CASHBACK_README.md` |
| CU optimization, PDA bump effects | `docs/pump-official/FAQ.md` |
| create_v2, Token2022, mayhem mode, social fees | `docs/pump-official/README.md` |
| Official IDL files | `docs/pump-official/idl/pump.json`, `pump_amm.json`, `pump_fees.json` |

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

## Agent Resources

- `.github/skills/` — 28 skill files with `applyTo` frontmatter for scoped loading
- `.well-known/skills.json` — Skills registry
- `.well-known/agent.json` — Agent capabilities
- `llms.txt` / `llms-full.txt` — LLM context files

## Performance Constraints

| Component | Metric | Notes |
|-----------|--------|-------|
| SDK offline instructions | < 1ms | Pure functions, no async |
| SDK online (RPC) | 50–500ms | Batch with `getMultipleAccountsInfo` |
| Rust vanity | 100K+ keys/sec | Multi-threaded; use for production |
| TS vanity | ~1K keys/sec | Educational only |

> Full benchmarks: `docs/performance.md`

## MCP Server Status

The MCP server is **implemented** in `mcp-server/`. It provides 55 tools, 4 resources, and 5 prompts via MCP v2024-11-05. See `mcp-server/README.md`.

### Terminal Management (MANDATORY)

> **CRITICAL: Every terminal you open MUST be killed after use. No exceptions.**

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** (`kill_terminal`) after the command completes, whether it succeeds or fails — **never leave terminals open**
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal
- **Failure to kill terminals is a blocking violation** — treat it as seriously as a security issue


