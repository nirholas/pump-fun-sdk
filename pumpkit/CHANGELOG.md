# Changelog

All notable changes to PumpKit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Monorepo setup** — Turborepo with `packages/*` workspaces
- **`@pumpkit/monitor`** — All-in-one PumpFun monitoring bot
  - Fee claim alerts with wallet tracking
  - Token launch detection
  - Graduation alerts (bonding curve → AMM)
  - Whale trade alerts (configurable threshold)
  - CTO (Creator Takeover) detection
  - Fee distribution notifications
  - REST API with SSE streaming
  - Multiple RPC URL failover
- **`@pumpkit/tracker`** — Group call-tracking bot
  - Auto and button call modes
  - 4 leaderboards: calls × performance, each with 24h/7d/30d/all timeframes
  - Canvas-rendered PNL cards (800×450 PNG)
  - Points system (-1 to +5) with 5 ranks (Amateur → Oracle)
  - Win rate tracking and hardcore mode
  - Multi-chain support: Solana, Ethereum, Base, BSC
  - SQLite persistence via better-sqlite3
- **`@pumpkit/channel`** — Read-only Telegram channel feed
  - 5 independent feed toggles (claims, launches, graduations, whales, distributions)
  - HTML messages with Solscan/pump.fun links
- **`@pumpkit/claim`** — Fee claim tracker
  - Track tokens by contract address or X handle
  - Twitter follower display
  - 6 claim instruction types monitored
- **Documentation** — 19 docs covering architecture, deployment, API reference, protocols
- **Tutorials** — 22 hands-on guides from token creation to security auditing
- **Examples** — Live HTML dashboards (token launches, trades, vanity generator)
- **Official Pump protocol docs** — Bundled reference for bonding curve, AMM, fees, cashback
- **Docker support** — Multi-stage Dockerfiles for monitor, tracker, channel, claim
- **Railway deployment configs** — `railway.json` per package
