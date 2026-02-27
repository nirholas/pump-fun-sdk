# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
- Discussion templates — Ideas, Q&A, Show & Tell
- Issue template config with contact links
- Documentation improvement issue template
- Question issue template
- .all-contributorsrc for contributor tracking
- Comprehensive CONTRIBUTING.md with code style, commit conventions, testing guide
- Upgraded SECURITY.md with full security policy
- Upgraded PR template with detailed checklist

### Changed

- Telegram bot version bumped to 1.1.0
- `TELEGRAM_BOT_TOKEN` now optional in API-only mode
- Railway `healthcheckPath` set to `/api/v1/health`
- Dockerfile: added OCI labels, `EXPOSE 3000`, `HEALTHCHECK`, `API_PORT` env

### Fixed

- Fixed missing `errorsEncountered` in token launch monitor state initialization
- Fixed missing `description` field in `TokenLaunchEvent` construction
- Fixed `.well-known/agent.json` PumpFees program ID mismatch
- Fixed all docs incorrectly describing website as "Next.js" (it's static HTML/CSS/JS)

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

