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
- [Migration Guide](./migration.md) — upgrading between versions
- [Troubleshooting](./troubleshooting.md) — common issues and fixes

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

---

## Live Dashboards

**Directory:** `live/` · **Language:** HTML/CSS/JavaScript (self-contained)

Three browser-based dashboards — no build step, no dependencies. Each is a single HTML file.

| Dashboard | File | Description |
|-----------|------|-------------|
| Token Launch Monitor | `index.html` | Matrix-style real-time feed of new PumpFun tokens |
| Trade Analytics | `trades.html` | Multi-event trade feed with whale detection, charts, sound alerts |
| Vanity Address Generator | `vanity.html` | Client-side Solana vanity address generator (keys never leave browser) |

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

---

## Tutorials

**Directory:** `tutorials/` · **Count:** 19 hands-on guides

Progressive tutorials from "create your first token" to building monitoring systems and payment protocols.

| # | Tutorial | Difficulty |
|---|---------|------------|
| 01 | Create Your First Token | Beginner |
| 02 | Buy Tokens from a Bonding Curve | Beginner |
| 03 | Sell Tokens | Beginner |
| 04 | Create and Buy Atomically | Beginner |
| 05 | Bonding Curve Math | Intermediate |
| 06 | Token Migration to PumpAMM | Intermediate |
| 07 | Fee Sharing Setup | Intermediate |
| 08 | Token Incentives | Intermediate |
| 09 | Fee System Deep Dive | Intermediate |
| 10 | Working with PDAs | Intermediate |
| 11 | Building a Trading Bot | Advanced |
| 12 | Offline SDK vs Online SDK | Intermediate |
| 13 | Generating Vanity Addresses | Beginner |
| 14 | x402 Paywalled APIs | Advanced |
| 15 | Decoding On-Chain Accounts | Intermediate |
| 16 | Monitoring Claims | Intermediate |
| 17 | Build a Monitoring Website | Advanced |
| 18 | Telegram Bot | Advanced |
| 19 | CoinGecko Integration | Intermediate |

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

---

## Security

**Directory:** `security/`

| Document | Coverage |
|----------|----------|
| SECURITY_CHECKLIST.md | 60+ item security checklist |
| audit-rust.md | Rust vanity generator audit |
| audit-typescript.md | TypeScript vanity generator audit |
| audit-cli.md | Shell script audit |

### Key Rules

1. **ONLY** official Solana Labs crypto: `solana-sdk`, `@solana/web3.js`, `solana-keygen`
2. Zeroize all key material after use
3. File permissions `0600` for keypair files
4. No network calls during key generation

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
