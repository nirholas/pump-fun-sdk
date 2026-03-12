# Pump SDK Ecosystem

> Everything in the box — what's built, what it does, and where to find the docs.

## Core SDK

**Directory:** `src/` · **Language:** TypeScript · **Package:** `@nirholas/pump-sdk`

The foundation of the project. Builds `TransactionInstruction[]` for every operation on the Pump protocol — token creation, buying, selling, migration, fee sharing, token incentives, and analytics.

### Two Modes

| Class | Mode | What It Does |
|-------|------|-------------|
| `PumpSdk` / `PUMP_SDK` | Offline | Builds instructions without a network connection. Pure functions, no RPC calls. Use the `PUMP_SDK` singleton. |
| `OnlinePumpSdk` | Online | Extends `PumpSdk` with RPC fetchers. Reads on-chain state, then builds instructions. Requires a `Connection`. |

### Key Operations

| Operation | Method | Description |
|-----------|--------|-------------|
| Create token | `createV2Instruction()` | Launch a new token on the bonding curve |
| Buy tokens | `buyInstructions()` | Purchase tokens from the bonding curve |
| Sell tokens | `sellInstructions()` | Sell tokens back to the bonding curve |
| Create + buy | `createV2AndBuyInstructions()` | Atomic token creation with initial purchase |
| Migrate | `migrateInstruction()` | Graduate a completed bonding curve to PumpAMM |
| Fee sharing | `createFeeSharingConfig()` | Set up creator fee distribution to shareholders |
| Claims | `claimCreatorFees()` | Claim accumulated creator fees |
| Token incentives | `claimTokenIncentives()` | Claim volume-based token rewards |

### Analytics (Offline)

| Function | What It Computes |
|----------|-----------------|
| `calculateBuyPriceImpact()` | Price impact of a buy in basis points |
| `calculateSellPriceImpact()` | Price impact of a sell in basis points |
| `getGraduationProgress()` | How close a token is to graduating (0-100%) |
| `getTokenPrice()` | Current buy/sell price per token + market cap |
| `getBondingCurveSummary()` | Full snapshot: price, progress, reserves, market cap |
| `bondingCurveMarketCap()` | Market cap from virtual reserves |

### On-Chain Programs

| Program | ID | Purpose |
|---------|----|---------|
| Pump | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve operations (create, buy, sell, fees) |
| PumpAMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Graduated AMM pool operations (buy, sell, LP) |
| PumpFees | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing and distribution |

### Documentation

- [Getting Started](./getting-started.md) — installation, first transaction
- [API Reference](./api-reference.md) — every function, type, and constant
- [Architecture](./architecture.md) — module layout and design decisions
- [Bonding Curve Math](./bonding-curve-math.md) — constant-product AMM formulas, price mechanics
- [Analytics Guide](./analytics.md) — price impact, graduation progress, token pricing
- [Fee Sharing](./fee-sharing.md) — creator fee distribution setup
- [Fee Tiers](./fee-tiers.md) — tiered fee schedule based on supply
- [Token Incentives](./token-incentives.md) — volume-based reward system
- [Mayhem Mode](./mayhem-mode.md) — alternate PDA routing mode
- [Examples](./examples.md) — 20+ code examples
- [End-to-End Workflow](./end-to-end-workflow.md) — complete token lifecycle
- [Migration Guide](./MIGRATION.md) — upgrading between versions
- [Troubleshooting](./TROUBLESHOOTING.md) — common issues and fixes

---

## Telegram Bot

**Directory:** `telegram-bot/` · **Language:** TypeScript · **Framework:** grammY

Full-featured Telegram bot that monitors PumpFun on-chain activity and sends real-time notifications. Also includes a REST API with webhooks.

### Bot Features

| Feature | Description |
|---------|-------------|
| **Fee claim monitoring** | Watches wallets for creator fee and cashback claim events |
| **CTO alerts** | Detects Creator Takeover (fee redirection) events |
| **Token launch tracking** | Real-time detection of new PumpFun tokens |
| **Graduation alerts** | Notifies when tokens complete their bonding curve |
| **Whale trade alerts** | Configurable SOL threshold for large buy/sell detection |
| **Fee distribution alerts** | Tracks creator fee distributions to shareholders |
| **REST API** | Full CRUD API with auth, rate limiting, SSE streaming |
| **Webhooks** | HMAC-signed webhook delivery with retry logic |

### 13 Bot Commands

`/start` · `/help` · `/watch` · `/unwatch` · `/list` · `/status` · `/cto` · `/alerts` · `/monitor` · `/stopmonitor` · `/price` · `/fees` · `/quote`

### Documentation

- [telegram-bot/README.md](../telegram-bot/README.md) — full setup, all commands, REST API reference, webhook docs, env vars
- [Tutorial 18: Telegram Bot](../tutorials/18-telegram-bot.md) — hands-on integration guide

---

## Channel Bot

**Directory:** `channel-bot/` · **Language:** TypeScript · **Framework:** grammY

Read-only Telegram channel feed that broadcasts PumpFun activity. No commands — it just posts events to a channel.

### Feeds (Individually Toggleable)

| Feed | Env Variable | Default |
|------|-------------|---------|
| Fee claims | `FEED_CLAIMS` | `true` |
| Token launches | `FEED_LAUNCHES` | `true` |
| Graduations | `FEED_GRADUATIONS` | `true` |
| Whale trades | `FEED_WHALES` | `true` |
| Fee distributions | `FEED_FEE_DISTRIBUTIONS` | `true` |

### Documentation

- [channel-bot/README.md](../channel-bot/README.md) — setup, Docker deployment, env vars, architecture

---

## WebSocket Relay Server

**Directory:** `websocket-server/` · **Language:** TypeScript

Real-time token launch relay. Polls the PumpFun API and subscribes to Solana RPC logs, then broadcasts parsed events to browser clients over WebSocket.

### Features

| Feature | Description |
|---------|-------------|
| Dual data source | PumpFun API polling + Solana RPC WebSocket |
| Event types | `token-launch`, `status`, `heartbeat` |
| Backfill | Sends 50 recent launches to new connections |
| Deduplication | Rolling set of 5,000 mints |
| Health check | `GET /health` endpoint |
| Built-in dashboard | Served at `GET /` |

### Documentation

- [websocket-server/README.md](../websocket-server/README.md) — full WebSocket protocol, message schemas, env vars, deployment

---

## Live Dashboards

**Directory:** `live/` · **Language:** HTML/CSS/JavaScript (self-contained)

Three browser-based dashboards — no build step, no dependencies. Each is a single HTML file.

| Dashboard | File | Description |
|-----------|------|-------------|
| Token Launch Monitor | `index.html` | Matrix-style real-time feed of new PumpFun tokens |
| Trade Analytics | `trades.html` | Multi-event trade feed with whale detection, charts, sound alerts |
| Vanity Address Generator | `vanity.html` | Client-side Solana vanity address generator (keys never leave browser) |

### Documentation

- [live/README.md](../live/README.md) — features, setup, deployment, architecture notes

---

## Rust Vanity Generator

**Directory:** `rust/` · **Language:** Rust · **Speed:** ~100K+ keys/sec

Multi-threaded Solana vanity address generator using `rayon` + official `solana-sdk`. Production-grade with secure file handling.

### Features

- Prefix and suffix matching
- Case-sensitive and case-insensitive modes
- Progress reporting with ETA
- File output with `0600` permissions
- Memory zeroization of key material

### Documentation

- [rust/README.md](../rust/README.md) — CLI usage, benchmarks, security model
- [security/audit-rust.md](../security/audit-rust.md) — security audit
- [Tutorial 13: Vanity Addresses](../tutorials/13-vanity-addresses.md)

---

## TypeScript Vanity Generator

**Directory:** `typescript/` · **Language:** TypeScript · **Speed:** ~1K keys/sec

Educational reference implementation using `@solana/web3.js`. Includes both CLI and library API.

### Features

- Prefix and suffix matching
- CLI tool + importable library
- File verification utilities
- Solana CLI-compatible output format
- Full test suite (Jest)

### Documentation

- [typescript/README.md](../typescript/README.md) — CLI + library API, examples
- [security/audit-typescript.md](../security/audit-typescript.md) — security audit

---

## x402 Payment Protocol

**Directory:** `x402/` · **Language:** TypeScript

HTTP 402 micropayment protocol for Solana USDC. Gate any API behind automated payments — the client detects a 402 response, signs a USDC transfer, and retries with payment proof.

### Components

| Module | Export | Description |
|--------|--------|-------------|
| Server | `x402Paywall()` | Express middleware — returns 402 with payment instructions |
| Client | `X402Client` | Auto-paying HTTP client — handles 402 → pay → retry |
| Facilitator | `X402Facilitator` | Verifies and settles payments on-chain |
| Utilities | `usdcToBaseUnits()`, `encodePayment()`, etc. | Conversion and encoding helpers |

### Documentation

- [x402/README.md](../x402/README.md) — full API reference, protocol flow, security model
- [Tutorial 14: x402 Paywalled APIs](../tutorials/14-x402-paywalled-apis.md)

---

## Shell Scripts

**Directory:** `scripts/` · **Language:** Bash

Production wrappers around `solana-keygen` for secure vanity address generation.

| Script | Purpose |
|--------|---------|
| `generate-vanity.sh` | Generate a single vanity address with security hardening |
| `batch-generate.sh` | Batch generate from a list of prefixes |
| `verify-keypair.sh` | Validate a keypair file matches expected pattern |
| `test-rust.sh` | Run the Rust test suite |
| `utils.sh` | Shared utility functions |
| `publish-clawhub.sh` | Package publishing helper |

### Documentation

- [docs/cli-guide.md](./cli-guide.md) — comprehensive CLI reference for vanity generation
- [Tutorial 13: Vanity Addresses](../tutorials/13-vanity-addresses.md)
- [security/audit-cli.md](../security/audit-cli.md) — CLI security audit

---

## Tutorials

**Directory:** `tutorials/` · **Count:** 19 hands-on guides

Progressive tutorials from "create your first token" to building monitoring systems and payment protocols.

| # | Tutorial | Difficulty |
|---|---------|------------|
| 01 | [Create Your First Token](../tutorials/01-create-token.md) | Beginner |
| 02 | [Buy Tokens from a Bonding Curve](../tutorials/02-buy-tokens.md) | Beginner |
| 03 | [Sell Tokens](../tutorials/03-sell-tokens.md) | Beginner |
| 04 | [Create and Buy Atomically](../tutorials/04-create-and-buy.md) | Beginner |
| 05 | [Bonding Curve Math](../tutorials/05-bonding-curve-math.md) | Intermediate |
| 06 | [Token Migration to PumpAMM](../tutorials/06-migration.md) | Intermediate |
| 07 | [Fee Sharing Setup](../tutorials/07-fee-sharing.md) | Intermediate |
| 08 | [Token Incentives](../tutorials/08-token-incentives.md) | Intermediate |
| 09 | [Fee System Deep Dive](../tutorials/09-fee-system.md) | Intermediate |
| 10 | [Working with PDAs](../tutorials/10-working-with-pdas.md) | Intermediate |
| 11 | [Building a Trading Bot](../tutorials/11-trading-bot.md) | Advanced |
| 12 | [Offline SDK vs Online SDK](../tutorials/12-offline-vs-online.md) | Intermediate |
| 13 | [Generating Vanity Addresses](../tutorials/13-vanity-addresses.md) | Beginner |
| 14 | [x402 Paywalled APIs](../tutorials/14-x402-paywalled-apis.md) | Advanced |
| 15 | [Decoding On-Chain Accounts](../tutorials/15-decoding-accounts.md) | Intermediate |
| 16 | [Monitoring Claims](../tutorials/16-monitoring-claims.md) | Intermediate |
| 17 | [Build a Monitoring Website](../tutorials/17-monitoring-website.md) | Advanced |
| 18 | [Telegram Bot](../tutorials/18-telegram-bot.md) | Advanced |
| 19 | [CoinGecko Integration](../tutorials/19-coingecko-integration.md) | Intermediate |

---

## Test Suites

**Directory:** `tests/` + component-level tests

| Suite | Framework | Command | What It Tests |
|-------|-----------|---------|--------------|
| Core SDK | Jest | `npm test` | Bonding curve math, PDAs, fee calculations, instruction builders |
| TypeScript vanity gen | Jest | `cd typescript && npm test` | Key generation, pattern matching, security |
| Rust vanity gen | Cargo | `cd rust && cargo test` | Generation pipeline, performance, security |
| Shell scripts | Bash | `bash tests/cli/test_generation.sh` | Vanity generation, keypair verification |
| Integration | Bash | `bash tests/integration/test_keypair_validity.sh` | Cross-component compatibility |
| Stress | Bash | `bash tests/stress/long_running.sh` | Stability under load |
| Fuzz | Python | `python3 tests/fuzz/fuzz_validation.py` | Edge cases and malformed inputs |
| Benchmarks | Bash | `bash tests/benchmarks/compare_implementations.sh` | Rust vs TypeScript performance |

### Documentation

- [docs/testing.md](./testing.md) — how to run every test suite

---

## Security

**Directory:** `security/`

| Document | Coverage |
|----------|----------|
| [SECURITY_CHECKLIST.md](../security/SECURITY_CHECKLIST.md) | 60+ item security checklist |
| [audit-rust.md](../security/audit-rust.md) | Rust vanity generator audit |
| [audit-typescript.md](../security/audit-typescript.md) | TypeScript vanity generator audit |
| [audit-cli.md](../security/audit-cli.md) | Shell script audit |
| [docs/security.md](./security.md) | Security practices overview |

### Key Rules

1. **ONLY** official Solana Labs crypto: `solana-sdk`, `@solana/web3.js`, `solana-keygen`
2. Zeroize all key material after use
3. File permissions `0600` for keypair files
4. No network calls during key generation

---

## Quick Reference

### Install the SDK

```bash
npm install @nirholas/pump-sdk @solana/web3.js @coral-xyz/anchor bn.js
```

### Run Each Component

```bash
# Core SDK tests
npm test

# WebSocket relay server
cd websocket-server && npm install && npm start

# Telegram bot
cd telegram-bot && cp .env.example .env && npm install && npm run dev

# Channel bot
cd channel-bot && cp .env.example .env && npm install && npm run dev

# Live dashboards
npx serve live/

# Rust vanity generator
cd rust && cargo run -- --prefix SOL --output key.json

# TypeScript vanity generator
cd typescript && npm install && npx ts-node src/cli.ts --prefix SOL

# x402 payment server example
cd x402 && npm install && npx ts-node examples/server.ts
```

---

## DeFi Agents

**Directory:** `packages/defi-agents/` · **Count:** 43 agents · **Languages:** 18

Production-ready AI agent definitions for DeFi workflows, compatible with SperaxOS and any function-calling LLM platform.

### Agent Categories

| Category | Count | Examples |
|----------|-------|---------|
| Master Agent | 1 | Sperax Portfolio (recommended starting point) |
| Sperax Ecosystem | 7 | USD Management, Staking Optimizer, Governance, Bridge |
| SperaxOS Specialists | 16 | Portfolio Tracker, Yield Farming, Gas Optimizer, NFT Analyst |
| General DeFi | 8+ | Token Researcher, Whale Tracker, Airdrop Hunter |
| Crypto News | 3+ | News Aggregator, Sentiment Analyzer |

### API

```
GET https://nirholas.github.io/AI-Agents-Library/index.json    # Agent registry
GET https://nirholas.github.io/AI-Agents-Library/{id}.en-US.json  # Agent definition
```

### Documentation

- [packages/defi-agents/README.md](../packages/defi-agents/README.md) — full agent catalog, API endpoints, adding new agents
- [Tutorial 25: DeFi Agents Integration](../tutorials/25-defi-agents-integration.md)

---

## Plugin Delivery Platform

**Directory:** `packages/plugin.delivery/` · **Runtime:** Vercel Edge Functions

AI plugin index and API gateway for SperaxOS function-calling plugins. Includes 40+ API endpoints across 12 plugin categories.

### Plugin Types

| Type | Description | Example |
|------|-------------|---------|
| Default | JSON → AI formats response | DeFiLlama analytics |
| Markdown | Pre-formatted text response | Crypto news |
| Standalone | React/HTML in iframe | Charts, dashboards |
| OpenAPI | Auto-generated from spec | CoinGecko, 1inch |

### Active Plugins

| Plugin | Endpoints | Status |
|--------|-----------|--------|
| pump-fun-sdk | 6 | ✅ Working |
| coingecko | 2 | ✅ Working |
| defillama | 5 | ✅ Working |
| dexscreener | 4 | ✅ Working |
| beefy | 1 | ✅ Working |
| lido | 1 | ✅ Working |
| oneinch | 1 | ✅ Working |
| thegraph | 3 | ✅ Working |
| address-labels | 2 | 🚧 Stub |
| audit-checker | 2 | 🚧 Stub |
| contract-scanner | 2 | 🚧 Stub |
| ens-lookup | 3 | 🚧 Stub |
| gas-estimator | 2 | 🚧 Stub |
| grants-finder | 2 | 🚧 Stub |
| phishing-detector | 2 | 🚧 Stub |
| sanctions-check | 1 | 🚧 Stub |

### Documentation

- [packages/plugin.delivery/README.md](../packages/plugin.delivery/README.md) — plugin creation guide, all 4 types, deployment

---

## Learning Paths

### 🟢 Beginner: "I want to launch a token"

1. [Getting Started](./getting-started.md) → Install SDK, connect to devnet
2. [Tutorial 01: Create Token](../tutorials/01-create-token.md) → Launch your first token
3. [Tutorial 02: Buy Tokens](../tutorials/02-buy-tokens.md) → Purchase from bonding curve
4. [Tutorial 03: Sell Tokens](../tutorials/03-sell-tokens.md) → Sell back to curve
5. [Tutorial 04: Create and Buy](../tutorials/04-create-and-buy.md) → Atomic launch + buy

### 🟡 Intermediate: "I want to understand the math and fees"

1. [Tutorial 05: Bonding Curve Math](../tutorials/05-bonding-curve-math.md) → Price mechanics
2. [Tutorial 09: Fee System](../tutorials/09-fee-system.md) → How fees work
3. [Tutorial 07: Fee Sharing](../tutorials/07-fee-sharing.md) → Split fees between shareholders
4. [Tutorial 08: Token Incentives](../tutorials/08-token-incentives.md) → Volume rewards
5. [Tutorial 10: Working with PDAs](../tutorials/10-working-with-pdas.md) → Program-derived addresses

### 🔴 Advanced: "I want to build trading infrastructure"

1. [Tutorial 11: Trading Bot](../tutorials/11-trading-bot.md) → Automated trading
2. [Tutorial 16: Monitoring Claims](../tutorials/16-monitoring-claims.md) → Track fee events
3. [Tutorial 18: Telegram Bot](../tutorials/18-telegram-bot.md) → Bot with notifications
4. [Tutorial 22: Channel Bot](../tutorials/22-channel-bot-setup.md) → Broadcast feed
5. [Tutorial 14: x402 Paywalled APIs](../tutorials/14-x402-paywalled-apis.md) → Monetize your API

### 🤖 AI Developer: "I want to integrate with AI agents"

1. [Tutorial 20: MCP Server](../tutorials/20-mcp-server-ai-agents.md) → AI agent integration
2. [Tutorial 25: DeFi Agents](../tutorials/25-defi-agents-integration.md) → Agent definitions
3. [Tutorial 29: Event Parsing](../tutorials/29-event-parsing-analytics.md) → Analytics pipeline
4. [Prompt Templates](../prompts/README.md) → Ready-to-use AI prompts

---

## Component Dependencies

```
                    ┌─────────────────┐
                    │   Core SDK      │
                    │   (src/)        │
                    └────┬──┬──┬─────┘
                         │  │  │
            ┌────────────┘  │  └────────────┐
            ▼               ▼               ▼
     ┌─────────────┐ ┌──────────┐ ┌────────────────┐
     │ Telegram Bot │ │ Channel  │ │ MCP Server     │
     │              │ │ Bot      │ │ (53 tools)     │
     └──────────────┘ └──────────┘ └────────────────┘
            │               │
            ▼               ▼
     ┌─────────────┐ ┌──────────┐
     │ REST API    │ │ @pump    │
     │ + Webhooks  │ │ funclaims│
     └─────────────┘ └──────────┘

     ┌──────────────┐ ┌──────────┐ ┌────────────────┐
     │ WebSocket    │ │ Live     │ │ Vanity Gens    │
     │ Relay        │◄│ Dash-    │ │ (Rust + TS)    │
     │              │ │ boards   │ │                │
     └──────────────┘ └──────────┘ └────────────────┘

     ┌──────────────┐ ┌──────────┐ ┌────────────────┐
     │ x402 Payments│ │ DeFi     │ │ Plugin         │
     │              │ │ Agents   │ │ Delivery       │
     └──────────────┘ └──────────┘ └────────────────┘
```

**Key connections:**
- **Core SDK** is the foundation — everything imports from it
- **Telegram Bot** and **Channel Bot** both monitor on-chain events but serve different audiences (interactive vs broadcast)
- **WebSocket Relay** feeds the **Live Dashboards** with real-time data
- **MCP Server** wraps the Core SDK for AI assistants
- **DeFi Agents** and **Plugin Delivery** are independent packages that reference the SDK's API endpoints
- **Vanity Generators** (Rust + TypeScript) are standalone — no SDK dependency
