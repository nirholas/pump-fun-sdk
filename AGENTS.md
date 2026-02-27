# Pump SDK — Agent Development Guidelines

> Official community PumpFun SDK for creating, buying, and selling tokens on the Solana blockchain. Bonding curve pricing, AMM migration, tiered fees, creator fee sharing, token incentives, and vanity address generation.

## Project Overview

The Pump SDK (`@pump-fun/pump-sdk`) is a TypeScript SDK for the Pump protocol — a Solana-based token launchpad. It provides offline-first instruction builders for token creation, buying, selling, migration, and fee management across three on-chain programs.

The repository also includes:
- **Rust vanity address generator** — multi-threaded, 100K+ keys/sec with rayon + solana-sdk
- **TypeScript vanity generator** — educational reference implementation with @solana/web3.js
- **MCP server** — Model Context Protocol server for AI agent integration (47 tools)
- **Telegram bot** — PumpFun activity monitor with 9 commands (fee claims, CTO alerts, whale trades, graduation)
- **WebSocket relay server** — Real-time token launch broadcasting to browser clients
- **Live dashboards** — Standalone browser UIs for token launches and trade analytics
- **x402 payment protocol** — HTTP 402 micropayments with Solana USDC
- **Lair-TG** — unified Telegram bot platform for DeFi intelligence
- **Shell scripts** — production Bash wrappers for solana-keygen
- **Tutorials** — 19 hands-on guides covering the full SDK
- **Documentation site** — PumpOS web desktop with 169 Pump-Store apps

## Architecture

| Component | Directory | Language |
|-----------|-----------|----------|
| Core SDK | `src/` | TypeScript |
| Rust vanity generator | `rust/` | Rust |
| TypeScript vanity generator | `typescript/` | TypeScript |
| MCP server | `mcp-server/` | TypeScript |
| Telegram bot | `telegram-bot/` | TypeScript |
| WebSocket relay | `websocket-server/` | TypeScript |
| Live dashboards | `live/` | HTML/JS |
| x402 payment protocol | `x402/` | TypeScript |
| Lair-TG | `lair-tg/` | TypeScript |
| Website (PumpOS) | `website/` | HTML/CSS/JS |
| Tutorials | `tutorials/` | Markdown |
| Shell scripts | `scripts/` | Bash |
| Test suites | `tests/` | Mixed |
| Documentation | `docs/` | Markdown |
| Security audits | `security/` | Markdown |
| Agent skills | `skills/` | Markdown |
| Agent prompts | `prompts/` | Markdown |
| Audit & verification tools | `tools/` | Mixed |

## On-Chain Programs

| Program | ID | Purpose |
|---------|-----|---------|
| Pump | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve operations |
| PumpAMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Graduated AMM pools |
| PumpFees | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing |

## SDK Design

- **`PumpSdk`** (offline) — Builds `TransactionInstruction[]` without a connection. Singleton: `PUMP_SDK`
- **`OnlinePumpSdk`** (online) — Extends offline SDK with RPC fetchers for account state
- All instruction methods return `TransactionInstruction[]`, never `Transaction` objects

## Agent Skill Files

See `.github/skills/` for 28 detailed skill documents covering every domain:
- `pump-sdk-core.skill.md` — Core SDK patterns
- `bonding-curve.skill.md` / `bonding-curve-math.skill.md` — AMM math
- `token-lifecycle.skill.md` — Create, trade, migrate
- `fee-system.skill.md` / `fee-sharing.skill.md` — Fee system
- `token-incentives.skill.md` — Volume-based rewards
- `solana-program-architecture.skill.md` — PDAs and accounts
- `solana-wallet.skill.md` — Key generation security
- `rust-vanity-gen.skill.md` / `rust-vanity-generator.skill.md` — Rust generator
- `typescript-vanity-generator.skill.md` — TypeScript generator
- `mcp-server.skill.md` — MCP integration
- `shell-scripting-cli.skill.md` — Bash scripts
- `security-practices.skill.md` — Security hardening

## Well-Known Files

- `.well-known/ai-plugin.json` — AI plugin manifest
- `.well-known/agent.json` — Agent capabilities and configuration
- `.well-known/skills.json` — Skills registry
- `.well-known/security.txt` — Security contact information
- `llms.txt` — LLM context (quick reference)
- `llms-full.txt` — LLM context (comprehensive)

## Security Rules

1. **ONLY** official Solana Labs crypto libraries: `solana-sdk`, `@solana/web3.js`, `solana-keygen`
2. Zeroize all key material after use
3. Set keypair file permissions to `0600`
4. No network calls for key generation
5. See `security/SECURITY_CHECKLIST.md` for 60+ item checklist

### Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** after the command completes, whether it succeeds or fails — never leave terminals open
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal

## Contributing

- Follow the existing code style
- Test changes before submitting PRs
- Update documentation when adding features
- See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines

