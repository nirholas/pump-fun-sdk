# Agent Task 01: Set Up Monorepo Structure

## Context

We're building **PumpKit** — an open-source framework for building PumpFun Telegram bots on Solana. The project lives at `/workspaces/pump-fun-sdk/pumpkit/`. Read `pumpkit/README.md` and `pumpkit/docs/architecture.md` for the full picture.

## Task

Set up the Turborepo monorepo scaffolding inside `/workspaces/pump-fun-sdk/pumpkit/`. Do NOT create any source code — just the infrastructure files.

### Create these files:

1. **`pumpkit/turbo.json`** — Turborepo config with pipelines for `build`, `dev`, `typecheck`, `lint`, `test`

2. **`pumpkit/package.json`** — Root package.json:
   - Name: `pumpkit`
   - Private: true
   - Workspaces: `["packages/*"]`
   - Scripts: `build`, `dev`, `typecheck`, `lint`, `test` (via turbo)
   - DevDependencies: `turbo`, `typescript@^5.7`, `@types/node@^22`, `tsx@^4`, `eslint`

3. **`pumpkit/tsconfig.base.json`** — Shared TS config:
   - Target: ES2022, Module: Node16, moduleResolution: Node16
   - Strict: true, `noUncheckedIndexedAccess: true`, `noUnusedLocals: true`
   - ES module output

4. **`pumpkit/packages/core/package.json`** — `@pumpkit/core`:
   - Version: 0.1.0
   - Type: module
   - Main: `dist/index.js`, Types: `dist/index.d.ts`
   - Dependencies: `grammy@^1.35.0`, `@solana/web3.js@^1.98.0`, `bs58@^6.0.0`, `dotenv@^16.4.7`, `better-sqlite3@^11.7.0`
   - DevDeps: `@types/better-sqlite3`
   - Scripts: `build`, `dev`, `typecheck`

5. **`pumpkit/packages/core/tsconfig.json`** — Extends `../../tsconfig.base.json`, outDir: `dist`, rootDir: `src`

6. **`pumpkit/packages/monitor/package.json`** — `@pumpkit/monitor`:
   - Version: 0.1.0
   - Type: module
   - Dependencies: `@pumpkit/core@workspace:*`, `grammy@^1.35.0`, `dotenv@^16.4.7`
   - Scripts: `build`, `dev`, `start`

7. **`pumpkit/packages/monitor/tsconfig.json`** — Extends base, references `../core`

8. **`pumpkit/packages/tracker/package.json`** — `@pumpkit/tracker`:
   - Version: 0.1.0
   - Dependencies: `@pumpkit/core@workspace:*`, `grammy@^1.35.0`, `dotenv@^16.4.7`, `better-sqlite3@^11.7.0`, `canvas@^3.1.0`
   - DevDeps: `@types/better-sqlite3`

9. **`pumpkit/packages/tracker/tsconfig.json`** — Extends base, references `../core`

10. **`pumpkit/.gitignore`** — Standard Node + dist + data + .env

11. **`pumpkit/.eslintrc.json`** — Basic ESLint config for TypeScript

### Verification

After creating all files, run `cd pumpkit && cat turbo.json` to verify the structure is correct.

## Do NOT

- Don't create any `src/` files or actual TypeScript code
- Don't install dependencies (npm install)
- Don't modify anything outside `pumpkit/`
