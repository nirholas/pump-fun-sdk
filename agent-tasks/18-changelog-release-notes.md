# Task 18 — Prepare CHANGELOG + Release Notes for v1.31.0

> **Status:** COMPLETED
> **Scope:** CHANGELOG.md, docs/release-notes/v1.31.0.md, package.json version bump
> **Priority:** MED

## Objective

Prepare the CHANGELOG entry and detailed release notes for v1.31.0 based on all commits since v1.30.0 (2026-03-06).

## Deliverables

1. **CHANGELOG.md** — New `[1.31.0] - 2026-03-12` section following Keep a Changelog format with Added/Changed/Fixed/Removed categories
2. **docs/release-notes/v1.31.0.md** — Detailed release notes with highlights, breaking changes analysis, per-component tables, and upgrade guide
3. **package.json** — Version bumped from `1.30.0` → `1.31.0`

## Summary of Changes (113 commits, 555 files)

### Core SDK
- Token program auto-detection in `fetchBuyState` / `fetchSellState`
- Convenience `buyInstructions()` / `sellInstructions()` wrappers on `OnlinePumpSdk`

### New Components
- **Lair-TG** — Unified Telegram bot platform scaffold
- **PumpKit expansion** — @pumpkit/web dashboard, 26 tutorials, CI, Fee Distribution Monitor
- **PumpOS Website** — Full HTML/CSS/JS web desktop
- **Outsiders Bot** — Core functionality and documentation

### Bot Enhancements
- Channel-bot: graduation events, token disambiguation, enriched feeds
- Claim-bot: ClaimMonitor, RpcClaimMonitor, GitHub social fee claims, social-fee-index

### Infrastructure
- X/Twitter migration to GraphQL API (xactions)
- Integration tests, formatting tests, health/logger tests
- Documentation: governance, adopters, migration, FAQ, roadmap, vision
