# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.30.0] — 2026-03-06

### Added

- **Platform enum** — Type-safe `Platform` enum (`Pump`, `X`, `GitHub`) with `SUPPORTED_SOCIAL_PLATFORMS`, `stringToPlatform()`, and `platformToString()` helpers for social fee sharing
- **Social fee PDA validation** — `createSocialFeePdaInstruction` now validates platform against `SUPPORTED_SOCIAL_PLATFORMS` and explicitly provides `socialFeePda` account
- **`normalizeSocialShareholders()`** — Resolves social handles (userId + platform) to PDAs and collects any that need on-chain creation
- **`updateSharingConfigWithSocialRecipients()`** — Wrapper that creates missing social fee PDAs then updates fee shares in a single instruction batch
- **`createSharingConfigWithSocialRecipients()`** — Wrapper that creates fee sharing config + resolves social recipients in one call

### Changed

- `createSocialFeePdaInstruction` and `claimSocialFeePdaInstruction` now accept `Platform` enum instead of raw `number`
- Synced with upstream `@pump-fun/pump-sdk@1.30.0` (npm)

## [1.29.0] — 2026-03-06

### Added

- **Bonding Curve V2 PDA** — `bondingCurveV2Pda(mint)` derives the new required `bonding-curve-v2` PDA (seeds: `["bonding-curve-v2", mint]`, program: Pump)
- **Pool V2 PDA** — `poolV2Pda(baseMint)` derives the new required `pool-v2` PDA (seeds: `["pool-v2", base_mint]`, program: PumpAMM)
- **Cashback support for AMM instructions** — `ammBuyInstruction`, `ammBuyExactQuoteInInstruction`, and `ammSellInstruction` now accept an optional `cashback` parameter

### Changed

- **Bonding Curve buy/buyExactSolIn** — appends `bonding_curve_v2` (readonly) as a required remaining account
- **Bonding Curve sell** — appends `bonding_curve_v2` (readonly) after optional `user_volume_accumulator` for cashback coins
- **PumpAMM buy** — appends `pool_v2` (readonly); for cashback coins also prepends `user_volume_accumulator_wsol_ata` (mutable)
- **PumpAMM buyExactQuoteIn** — appends `pool_v2` (readonly); for cashback coins also prepends `user_volume_accumulator_wsol_ata` (mutable)
- **PumpAMM sell** — appends `pool_v2` (readonly); for cashback coins also prepends `user_volume_accumulator_wsol_ata` (mutable) and `user_volume_accumulator` (mutable)

### Fixed

- Compliance with Pump program upgrade requiring `bonding_curve_v2` and `pool_v2` accounts on all buy/sell instructions

## [1.28.0]

### Added

- **DeFi agents** (`packages/defi-agents/`) — 43 production-ready AI agent definitions with 18-language i18n support, covering trading, analytics, risk management, and portfolio strategies
- **Plugin.delivery** (`packages/plugin.delivery/`) — AI Plugin Index for SperaxOS function-call plugins and tools
- **19 tutorials** (`tutorials/`) — step-by-step guides from token creation to CoinGecko integration, covering the full SDK surface
- **Social fee PDAs** — `createSocialFeePdaInstruction`, `claimSocialFeePdaInstruction`, `fetchSocialFeePda`, `decodeSocialFeePdaAccount` for platform-based fee collection (userId + platform identifiers)
- **Social fee events** — `SocialFeePdaCreatedEvent`, `SocialFeePdaClaimedEvent` exported from state
- **WebSocket relay server** (`websocket-server/`) — PumpFun API → SolanaMonitor → WebSocket relay → browsers; deployed on Railway (`pump-fun-websocket-production.up.railway.app`)
- **PumpEventMonitor** (`telegram-bot/src/pump-event-monitor.ts`) — Anchor event decoder for graduation, whale trades, and fee distribution events via WebSocket or HTTP polling
- **Live trades dashboard** (`website/live.html`) — real-time token launch + trade feed with volume charts, buy/sell ratio, whale alerts, top tokens, and demo mode
- **PumpOS Pump-Store** — 169 installable apps including bonding-curve-calc, fee-tier-explorer, token-launch-sim, migration-tracker, token-incentives, creator-fee-sharing, pump-sdk-reference, smart-money, alpha terminal, and more
- **Lair-TG** (`lair-tg/`) — unified Telegram bot platform for DeFi intelligence, wallet management, and token launching
- **Standalone live pages** (`live/`) — `index.html` (token launches) and `trades.html` (trade feed) with separate Vercel deployment
- **AMM trade events** — `AmmBuyEvent`, `AmmSellEvent`, `DepositEvent`, `WithdrawEvent`, `CreatePoolEvent` exported from state
- **Fee sharing events** — `CreateFeeSharingConfigEvent`, `UpdateFeeSharesEvent`, `ResetFeeSharingConfigEvent`, `RevokeFeeSharingAuthorityEvent`, `TransferFeeSharingAuthorityEvent`
- **Graduation/whale/fee formatters** (`telegram-bot/src/formatters.ts`) — rich HTML notification formatting for graduation events, whale trades, and fee distributions
- **Analytics module** (`src/analytics.ts`) — price impact, graduation progress, token price, bonding curve summary
- **Telegram bot REST API** — scalable HTTP API with auth, rate limiting, SSE streaming, webhooks
  - `GET /api/v1/health` — health check (no auth)
  - `GET /api/v1/openapi` — OpenAPI 3.0 spec (no auth)
  - `GET /api/v1/status` — detailed monitor/watch/claim stats
  - `GET /api/v1/claims` — paginated claim history with filtering
  - `GET /api/v1/claims/stream` — real-time SSE claim stream
  - `CRUD /api/v1/watches` — per-client watch management
- **Telegram bot token launch monitor** — real-time detection of new PumpFun token launches with `/monitor` and `/stopmonitor` commands
- **CTO (creator takeover) alerts** — detect creator fee redirection events
- **Telegram bot pump event monitor** — `PumpEventMonitor` class for on-chain event tracking via Anchor discriminator matching
  - **Graduation alerts** — notifications when a token completes its bonding curve or migrates to PumpAMM pool
  - **Whale trade alerts** — configurable SOL threshold for large buy/sell notifications with visual bonding curve progress bar
  - **Fee distribution alerts** — tracks `DistributeCreatorFees` events with shareholder breakdown and share percentages
  - **Cashback coin flag** — token launch notifications now show whether cashback is enabled
  - New env vars: `ENABLE_GRADUATION_ALERTS`, `ENABLE_TRADE_ALERTS`, `WHALE_THRESHOLD_SOL`, `ENABLE_FEE_DISTRIBUTION_ALERTS`
- **HMAC-SHA256 webhook signatures** — `X-PumpFun-Signature` header for webhook payload verification
- **Request logging** — method, path, status, duration for all API requests
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options`, `X-Request-Id` on all API responses
- **Graceful API shutdown** — connection draining with 10s force-close timeout
- **Docker HEALTHCHECK** — `wget`-based health probe against `/api/v1/health`
- **PumpOS web desktop** — static HTML/CSS/JS website with app launcher, widgets, and wallet connect
- **Solana wallet app** — in-browser wallet management in PumpOS Store
- **`tsup` build config** — CJS + ESM dual builds with sourcemaps and `.d.ts`
- ROADMAP.md — public roadmap with quarterly milestones
- VISION.md — project vision and principles
- GOVERNANCE.md — BDFL governance model
- SUPPORT.md — how to get help
- FAQ.md — frequently asked questions
- ADOPTERS.md — who's using pump-fun-sdk
- ACKNOWLEDGMENTS.md — credits and thanks
- docs/TROUBLESHOOTING.md — common issues and fixes
- docs/MIGRATION.md — version upgrade guide
- GitHub Actions CI workflow — build, test, lint across Node 18/20/22
- GitHub Actions release workflow — npm publish and Rust binary releases
- GitHub Actions security workflow — npm audit, cargo audit, CodeQL, dependency review
- GitHub Actions stale issue management
- **x402 payment protocol** (`x402/`) — HTTP 402 micropayments with Solana USDC, `x402Paywall()` server middleware and `X402Client` auto-pay client
- **MCP server expanded to 53 tools** — quoting, building TXs, fees, analytics, AMM ops, social fees, wallet; deploys to Railway, Cloudflare Workers, or Vercel
- **28 agent skill documents** (`skills/`) — covering every domain from SDK core to security
- Discussion templates — Ideas, Q&A, Show & Tell
- Issue template config with contact links
- Documentation improvement issue template
- Question issue template
- .all-contributorsrc for contributor tracking
- Comprehensive CONTRIBUTING.md with code style, commit conventions, testing guide
- Upgraded SECURITY.md with full security policy
- Upgraded PR template with detailed checklist

### Changed

- Live page WebSocket endpoints updated — removed public Solana RPCs, now uses PumpPortal + Railway relay server
- Telegram bot version bumped to 1.1.0
- `TELEGRAM_BOT_TOKEN` now optional in API-only mode
- Railway `healthcheckPath` set to `/api/v1/health`
- Dockerfile: added OCI labels, `EXPOSE 3000`, `HEALTHCHECK`, `API_PORT` env
- SolanaMonitor refactored to use PumpFun API for real-time token launches

### Fixed

- Fixed missing `errorsEncountered` in token launch monitor state initialization
- Fixed missing `description` field in `TokenLaunchEvent` construction
- Fixed `.well-known/agent.json` PumpFees program ID mismatch
- Fixed all docs incorrectly describing website as "Next.js" (it's static HTML/CSS/JS)
- Removed 'Transfer' keyword from Telegram bot WS filter (matched every tx)
- Fixed WebSocket multi-endpoint failover for live dashboard
- Fixed `$btnConnect is not defined` ReferenceError in live token launch monitor — added missing button element and DOM ref
- Fixed relay message type mismatch — `'launch'` → `'token-launch'` to match actual relay server output

## [1.0.0] - 2026-02-11

### Added

- Initial release
- Core TypeScript SDK (`PumpSdk` and `OnlinePumpSdk`)
- Bonding curve math — buy/sell quoting, market cap calculation
- Fee system — tiered fees based on market cap, creator fees
- Fee sharing — distribute creator fees to up to 10 shareholders
- Token incentives — volume-based reward calculation and claiming
- PDA derivation utilities for all three programs
- Full TypeScript state types for on-chain accounts
- Rust vanity address generator with Rayon multi-threading
- TypeScript vanity address generator with programmatic API
- MCP server for AI agent wallet operations
- Shell scripts for batch generation and verification
- Security audits for CLI, Rust, and TypeScript
- Comprehensive test suite (unit, integration, fuzz, stress, benchmark)
- Documentation: getting started, architecture, API reference, examples
- GitHub templates: bug report, feature request, PR template
- CI/CD configuration


