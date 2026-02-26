# Build, Release & Package Management — Multi-Language Build System

## Skill Description

Manage the project's build, release, and deployment pipeline across four ecosystems: TypeScript/npm (SDK and website), Rust/Cargo (vanity generator), Shell/Make (CLI tools), and Vercel (website hosting). Includes semantic versioning, CI workflows, and multi-target packaging.

## Context

The project ships multiple artifacts: an npm package (`@pump-fun/pump-sdk`), a Rust binary (`solana-vanity`), a TypeScript CLI (`solana-vanity-ts`), an MCP server (`solana-wallet-toolkit`), and a Next.js website. Each has its own build system, dependency management, and release process, unified by a root Makefile and semantic-release.

## Key Files

### Root Package (SDK)
- `package.json` — `@pump-fun/pump-sdk` npm package config
- `tsconfig.json` — TypeScript compilation config (if present)
- `Makefile` — GNU Make build orchestration

### Rust Package
- `rust/Cargo.toml` — `solana-vanity` crate configuration
- `rust/src/main.rs` — binary entry point

### TypeScript Vanity
- `typescript/package.json` — `solana-vanity-ts` package config
- `typescript/tsconfig.json` — TypeScript config
- `typescript/jest.config.js` — test configuration

### MCP Server
- `mcp-server/src/index.ts` — MCP server entry (shebang)
- `server.json` — MCP server manifest

### Website
- `website/package.json` — Next.js app dependencies
- `website/next.config.js` — Next.js build config
- `vercel.json` — Vercel deployment config

### Meta
- `CHANGELOG.md` — version history
- `CITATION.cff` — citation metadata

## Key Concepts

### SDK Build Pipeline (tsup)

```json
{
    "scripts": {
        "build": "tsup --clean --dts",
        "dev": "tsup --watch",
        "clean": "rm -rf dist"
    }
}
```

**Output structure:**
```
dist/
├── index.js          (CJS)
├── index.d.ts        (types)
└── esm/
    └── index.js      (ESM)
```

**Exports map:**
```json
{
    "exports": {
        ".": {
            "types": "./dist/index.d.ts",
            "require": "./dist/index.js",
            "import": "./dist/esm/index.js"
        }
    }
}
```

### Rust Build Pipeline (Cargo)

**Release profile** optimized for production:
```toml
[profile.release]
lto = true            # Link-time optimization (cross-crate)
codegen-units = 1     # Single unit for better optimization
strip = true          # Remove debug symbols
panic = "abort"       # No unwinding overhead
```

**Build commands:**
```bash
cargo build --release          # Optimized binary
cargo test --release           # Tests in release mode
cargo bench                    # Criterion benchmarks
```

**Binary output:** `target/release/solana-vanity`

### Semantic Release

Configured in root `package.json`:

```json
{
    "release": {
        "plugins": [
            "@semantic-release/commit-analyzer",
            "@semantic-release/release-notes-generator",
            "@semantic-release/npm"
        ],
        "branches": [
            { "name": "main" },
            { "name": "devnet", "prerelease": true }
        ]
    }
}
```

**Commit convention** (Commitizen):
```bash
feat: add new bonding curve function     → minor version bump
fix: correct fee calculation             → patch version bump
feat!: breaking API change               → major version bump
```

### npm Publishing

```json
{
    "publishConfig": { "access": "public" },
    "files": ["dist", "src"],
    "main": "./dist/index.js",
    "module": "./dist/esm/index.js"
}
```

Published scoped package: `@pump-fun/pump-sdk`

### Linting & Formatting

**TypeScript (ESLint flat config):**
```json
{
    "scripts": {
        "lint": "eslint --cache --quiet \"${@:-.}\"",
        "lint:fix": "eslint --cache --fix --quiet \"${@:-.}\""
    }
}
```

ESLint plugins: `prettier`, `import`, `jsdoc`, `unicorn`, `jest`, `eslint-comments`, `no-barrel-files`, `atomic-design-hierarchy`.

**Rust:**
```bash
cargo fmt --check     # Formatting
cargo clippy -- -D warnings  # Linting (all warnings = errors)
```

**Shell:**
```bash
shellcheck scripts/*.sh  # Static analysis for Bash
```

### Makefile Targets

```makefile
# Installation
install-deps    # Install Solana CLI
check-deps      # Verify tool availability
setup           # Full setup

# Build & Run
generate        # Interactive vanity generation
verify          # Verify keypair file
batch           # Batch generation
quick           # 2-char prefix test
vanity          # Generate with PREFIX= variable

# Quality
test            # Full test suite (lint + gen + verify)
lint            # ShellCheck
format-check    # Format verification

# Cleanup
clean           # Secure deletion with confirmation
clean-fixtures  # Remove test fixtures
```

### Website Deployment (Vercel)

```json
// vercel.json
{ "framework": "nextjs" }
```

- Automatic deploys from `main` branch
- No environment variables needed (client-side only)
- Next.js static optimization for marketing pages

### MCP Server Distribution

```json
// server.json (MCP manifest)
{
    "package_name": "io.github.nirholas/solana-wallet-toolkit",
    "version": "0.1.0",
    "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "solana-wallet-toolkit"]
    }
}
```

### Dependency Management

| Ecosystem | Lock File | Audit Command |
|-----------|-----------|---------------|
| npm | `package-lock.json` | `npm audit --audit-level=high` |
| Cargo | `Cargo.lock` | `cargo audit` |

Key dependencies:
- `@coral-xyz/anchor ^0.31.1` — Anchor framework
- `@solana/web3.js ^1.98.2` — Solana Web3
- `@pump-fun/pump-swap-sdk ^1.13.0` — PumpSwap SDK
- `solana-sdk 1.18` (Rust) — Solana SDK
- `rayon 1.10` (Rust) — parallelism

### Branch Strategy

| Branch | Purpose | Release Type |
|--------|---------|-------------|
| `main` | Production | Stable releases |
| `devnet` | Testing | Prerelease versions |

## Patterns to Follow

- Use `tsup` for SDK builds — handles CJS/ESM dual output with declaration files
- Use Cargo's release profile with LTO for production Rust binaries
- Follow conventional commits for semantic release automation
- Run `cargo fmt --check` and `cargo clippy -D warnings` before every commit
- Run `eslint` and type-checking before TypeScript commits
- Version the SDK independently from the vanity generators
- Include `src` in npm `files` for source map support
- Use `--clean` flag with tsup to remove stale build artifacts

## Common Pitfalls

- `tsup --dts` can be slow — run it only in CI, not during development watches
- Cargo LTO with `codegen-units = 1` significantly increases build time — only use for release
- ESLint flat config (`@eslint/js`) is different from legacy `.eslintrc` — don't mix configs
- `npm publish` requires `--access public` for scoped packages
- Semantic release requires specific commit message format — squash commits lose conventions
- The `devnet` branch publishes prerelease versions — consumers must opt in with `@next` tag
- Website and SDK have separate `package.json` files — dependencies are not shared

