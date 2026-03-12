# Task 11 — Deployment Guides for All Services

> **Priority:** MED  
> **Scope:** Write comprehensive deployment guides for every deployable service in the Pump SDK ecosystem  
> **Output:** Updated `docs/deployment.md`, missing `.env.example` files, missing `railway.json`

## Objective

Expand the existing `docs/deployment.md` from a basic quickstart into a production-ready deployment manual covering every service: Telegram bots (telegram-bot, channel-bot, claim-bot, outsiders-bot), trading systems (swarm-bot, swarm), infrastructure (websocket-server, dashboard, mcp-server), and static sites (live dashboards, PumpOS website, plugin delivery).

## Deliverables

### 1. Rewrite `docs/deployment.md`

- Per-service sections with:
  - Platform options (Railway / Docker / bare Node.js / Vercel)
  - Step-by-step Railway deployment
  - Docker build + run commands
  - Complete environment variable tables (required vs optional, defaults, descriptions)
  - Health check endpoints and verification commands
  - Persistent storage / volume requirements
  - Scaling notes and resource estimates
- Cross-service topics:
  - Docker Compose for local multi-service development
  - RPC provider comparison and recommendations
  - Production security checklist
  - Monitoring and alerting setup
  - Troubleshooting common deployment issues

### 2. Create Missing Config Files

- `websocket-server/.env.example` — PORT, SOLANA_RPC_WS, SOLANA_RPC_URL, ENABLE_CLAIMS, CLAIM_POLL_INTERVAL
- `mcp-server/.env.example` — SOLANA_RPC_URL, SOLANA_RPC_URLS
- `swarm-bot/railway.json` — Dockerfile builder, V2 runtime, restart policy, env vars

### 3. Add Coverage for Missing Services

- **outsiders-bot** — No Dockerfile or railway.json; document Node.js deployment
- **swarm** — Orchestrator deployment with bot fleet management
- **dashboard** — Unified control panel deployment
- **mcp-server** — CLI tool integration (Claude Desktop, VS Code, Cursor)

## Services Inventory

| Service | Dockerfile | railway.json | .env.example | Port |
|---------|-----------|-------------|-------------|------|
| telegram-bot | ✅ | ✅ | ✅ | 3000 |
| channel-bot | ✅ | ✅ | ✅ | 3000 |
| claim-bot | ✅ | ✅ | ✅ | — |
| outsiders-bot | ❌ | ❌ | ✅ | — |
| swarm-bot | ✅ | ❌ | ✅ | 3100 |
| swarm | ❌ | ❌ | ✅ | 4000 |
| dashboard | ❌ | ❌ | ✅ | 8080 |
| websocket-server | ✅ | ✅ | ❌ | 3099 |
| mcp-server | ❌ | ❌ | ❌ | — |

## Acceptance Criteria

- [ ] Every deployable service has its own section in `docs/deployment.md`
- [ ] All `.env.example` files exist for services that use env vars
- [ ] `swarm-bot/railway.json` exists with proper config
- [ ] Docker Compose example for local multi-service dev
- [ ] Production checklist is comprehensive
- [ ] Health check commands work for each service
