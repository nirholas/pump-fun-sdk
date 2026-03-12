# Agent Task 30: Create .env.example + Security + License Files

## Context

We're building **PumpKit** (`/workspaces/pump-fun-sdk/pumpkit/`). Read `pumpkit/docs/deployment.md` for env var reference.

## Task

Create project-level files that every open-source repo needs:

### 1. `pumpkit/LICENSE`
MIT License, copyright PumpKit contributors.

### 2. `pumpkit/SECURITY.md`
Security policy:
- How to report vulnerabilities (email or GitHub Security Advisories)
- What counts as a security issue
- PumpKit security model (bots are read-only monitors — no private keys handled)
- Dependencies and update policy

### 3. `pumpkit/packages/monitor/.env.example`
Complete example with ALL env vars from monitor-bot.md spec. Every line should have a comment.

```bash
# === Required ===
TELEGRAM_BOT_TOKEN=           # Get from @BotFather on Telegram

# === Solana RPC ===
SOLANA_RPC_URL=               # Primary RPC: Helius, QuickNode, etc.
# ...etc
```

### 4. `pumpkit/packages/tracker/.env.example`
Complete example with all tracker bot env vars.

### 5. `pumpkit/CODE_OF_CONDUCT.md`
Standard Contributor Covenant v2.1.

### 6. `pumpkit/.editorconfig`
Standard config: UTF-8, LF line endings, 2-space indent for TS/JSON, 4-space for MD.

### 7. `pumpkit/.nvmrc`
```
20
```

### 8. `pumpkit/.node-version`
```
20
```

## Requirements

- .env.example files should be comprehensive — include every env var from the docs
- Security guidelines should be reasonable for an open-source bot framework
- License should be MIT (matching the main repo)

## Do NOT

- Don't include actual secrets or tokens
- Don't modify existing files
