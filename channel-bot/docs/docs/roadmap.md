# Roadmap

> Where PumpKit is headed. Community input welcome — [open a discussion](https://github.com/nirholas/pumpkit/discussions).

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Done | Shipped and available |
| 🚧 In Progress | Actively being worked on |
| 📋 Planned | Scoped and scheduled |
| 💡 Exploring | Under research |

---

## Phase 1 — Foundation ✅

| Feature | Status | Details |
|---------|--------|---------|
| Monorepo setup | ✅ Done | Turborepo with 6 packages |
| `@pumpkit/core` | ✅ Done | Shared utilities: logger, config, health, shutdown, types |
| `@pumpkit/monitor` | ✅ Done | All-in-one PumpFun monitor (claims, launches, graduations, whales, CTO) |
| `@pumpkit/tracker` | ✅ Done | Group call-tracking bot with leaderboards and PNL cards |
| `@pumpkit/channel` | ✅ Done | Read-only Telegram channel feed for token events |
| `@pumpkit/claim` | ✅ Done | Fee claim tracker by token CA or X handle |
| Documentation | ✅ Done | 20+ docs, 30 tutorials, example dashboards |
| Railway deployment | ✅ Done | Dockerfiles and configs for all bots |

## Phase 2 — npm Publishing 🚧

| Feature | Status | Details |
|---------|--------|---------|
| npm organization | 🚧 In Progress | `@pumpkit` scope on npm registry |
| Package versioning | 📋 Planned | Semantic versioning with changesets |
| CI/CD publish pipeline | 📋 Planned | GitHub Actions → npm on release tag |
| Package README badges | 📋 Planned | npm version, downloads, license badges |
| Peer dependency alignment | 📋 Planned | Shared versions across packages |

## Phase 3 — Frontend UI 📋

| Feature | Status | Details |
|---------|--------|---------|
| `@pumpkit/web` | 📋 Planned | React dashboard for bot monitoring |
| Claim feed viewer | 📋 Planned | Real-time claim activity feed in browser |
| Bot status dashboard | 📋 Planned | Health, uptime, message counts per bot |
| Token analytics | 📋 Planned | Charts for bonding curve progress, market cap, trade volume |
| Configuration UI | 💡 Exploring | Web-based bot config editor (env vars, channels, thresholds) |

## Phase 4 — Ecosystem Growth 💡

| Feature | Status | Details |
|---------|--------|---------|
| Plugin system | 💡 Exploring | Custom event handlers and formatters as plugins |
| Multi-chain support | 💡 Exploring | Extend tracker bot beyond Solana |
| Alert routing | 💡 Exploring | Discord, Slack, webhooks in addition to Telegram |
| Hosted bots | 💡 Exploring | One-click bot deployment without self-hosting |
| AI-powered insights | 💡 Exploring | GPT/Claude-based token analysis in claim cards |
