# Development Guide

> Set up your local environment for PumpKit development.

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | ≥ 20.0 | Runtime |
| npm | ≥ 9.0 | Package manager (workspaces) |
| TypeScript | 5.7+ | Language (installed via devDeps) |
| Git | Any | Version control |

Optional for specific packages:

| Requirement | Package | Purpose |
|-------------|---------|---------|
| Canvas deps | `@pumpkit/tracker` | PNL card generation (libcairo, libpango) |
| SQLite | `@pumpkit/tracker` | Database (better-sqlite3, native addon) |

## Setup

```bash
git clone https://github.com/nirholas/pumpkit.git
cd pumpkit
npm install
```

This installs all workspace dependencies across all packages in one shot.

## Project Structure

```
pumpkit/
├── packages/
│   ├── core/        @pumpkit/core — shared framework (bot, monitor, solana, formatters)
│   ├── monitor/     @pumpkit/monitor — all-in-one monitoring bot
│   ├── tracker/     @pumpkit/tracker — group call-tracking bot
│   ├── channel/     @pumpkit/channel — read-only channel feed
│   └── claim/       @pumpkit/claim — fee claim tracker
├── docs/            documentation and guides
├── tutorials/       hands-on step-by-step guides
├── examples/        HTML dashboard examples
├── agent-prompts/   sequenced implementation tasks
├── turbo.json       Turborepo pipeline config
├── tsconfig.base.json  shared TypeScript config
└── package.json     root workspace config
```

## Development Commands

```bash
# Run a specific bot in watch mode
npm run dev --workspace=@pumpkit/monitor
npm run dev --workspace=@pumpkit/tracker

# Build all packages
npm run build

# Type-check all packages
npm run typecheck

# Lint all packages
npm run lint

# Clean all build outputs
npm run clean
```

## Turborepo

PumpKit uses [Turborepo](https://turbo.build/) for monorepo orchestration. The pipeline is defined in `turbo.json`:

- `build` — Compiles TypeScript (`tsc`) for each package
- `dev` — Runs in watch mode (`tsx watch`)
- `typecheck` — Type checks without emitting (`tsc --noEmit`)
- `lint` — Runs ESLint
- `clean` — Removes `dist/` and `node_modules/`

Tasks respect dependency order — `@pumpkit/monitor` waits for `@pumpkit/core` to build first.

## TypeScript Configuration

All packages extend `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

Each package overrides `outDir`, `rootDir`, and adds specific `include`/`exclude` patterns.

## Environment Variables

Each package has a `.env.example` file. Copy it to `.env` before running:

```bash
cp packages/monitor/.env.example packages/monitor/.env
cp packages/tracker/.env.example packages/tracker/.env
```

### Common Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | — | From [@BotFather](https://t.me/BotFather) |
| `SOLANA_RPC_URL` | No | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |
| `SOLANA_WS_URL` | No | Derived from RPC URL | WebSocket endpoint |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |

### Monitor-Specific

| Variable | Default | Description |
|----------|---------|-------------|
| `POLL_INTERVAL_SECONDS` | `60` | How often to poll for claims |
| `ENABLE_LAUNCH_MONITOR` | `false` | Monitor new token launches |
| `ENABLE_GRADUATION_ALERTS` | `true` | Alert on bonding curve graduations |
| `ENABLE_TRADE_ALERTS` | `false` | Alert on trades |
| `WHALE_THRESHOLD_SOL` | `10` | Minimum SOL to trigger whale alert |
| `ALLOWED_USER_IDS` | — | Comma-separated Telegram user IDs |

### Tracker-Specific

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PATH` | `data/tracker.db` | SQLite database path |
| `ATH_POLL_INTERVAL` | `30000` | ATH check interval (ms) |
| `DEXSCREENER_API` | `https://api.dexscreener.com` | Price data source |

## Adding a New Package

1. Create directory: `packages/my-bot/`
2. Add `package.json` with `"name": "@pumpkit/my-bot"`
3. Add `tsconfig.json` extending `../../tsconfig.base.json`
4. Add `src/index.ts` entry point
5. Add `.env.example` with required variables
6. Add `Dockerfile` for deployment
7. Update root `turbo.json` if custom pipeline needed

## Canvas Dependencies (Tracker)

The tracker bot uses `canvas` for PNL card generation. On Linux:

```bash
# Ubuntu/Debian
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# Alpine (Docker)
apk add --no-cache build-base cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev
```

On macOS:

```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

## Debugging

### Bot Not Responding

1. Check `TELEGRAM_BOT_TOKEN` is valid — test with `curl https://api.telegram.org/bot<TOKEN>/getMe`
2. Check the bot isn't already running elsewhere (Telegram only allows one polling instance)
3. Check logs for connection errors

### RPC Errors

1. Verify `SOLANA_RPC_URL` is reachable: `curl <RPC_URL> -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'`
2. Public endpoints are rate-limited — use a paid provider for production
3. Set `SOLANA_RPC_URLS` with comma-separated fallbacks

### SQLite Issues (Tracker)

1. Ensure `better-sqlite3` native addon compiled: `npm rebuild better-sqlite3`
2. Check `DB_PATH` directory exists and is writable
3. If schema changed, delete the database to let it recreate

## Code Style

- **TypeScript strict mode** — no implicit `any`, no unchecked index access
- **ES modules** — `import`/`export`, `.js` extension in relative imports
- **grammy** for Telegram — not Telegraf or node-telegram-bot-api
- **HTML** for Telegram messages — not Markdown (HTML gives more control)
- **Leveled logging** — use `log.info/warn/error/debug`, never `console.log`
- **Graceful shutdown** — every entry point handles `SIGINT`/`SIGTERM`
- **BN.js** for financial amounts — never JavaScript `number`
