---
name: pump-build-release
description: "Build and release pipeline for the Pump SDK — tsup TypeScript builds, Cargo release profiles, semantic release with commitizen, npm publishing, linting, Makefile targets, Vercel deployment, and MCP server distribution."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
---

# Build & Release — SDK Build Pipeline & Publishing

Build and release the Pump SDK ecosystem: tsup TypeScript builds, Cargo release profiles, semantic release, npm publishing, and deployment.

## SDK Build Pipeline (TypeScript)

```bash
npx tsup src/index.ts --format cjs,esm --dts
```

Output: `dist/index.cjs`, `dist/index.mjs`, `dist/index.d.ts`

## Rust Release Profile

```toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true
```

## Semantic Release with Commitizen

Commit format: `type(scope): description`

| Type | Effect |
|------|--------|
| `feat:` | Minor version bump |
| `fix:` | Patch version bump |
| `feat!:` or `BREAKING CHANGE:` | Major version bump |
| `chore:`, `docs:`, `style:` | No release |

## Makefile Targets

| Target | Description |
|--------|-------------|
| `make build` | Build SDK + Rust binary |
| `make test` | Run all tests |
| `make bench` | Run benchmarks |
| `make lint` | Run all linters |
| `make clean` | Clean build artifacts |
| `make release` | Build release binary |

## Linting

| Tool | Language | Config |
|------|----------|--------|
| ESLint/tsup | TypeScript | `tsconfig.json` |
| `cargo clippy` | Rust | Default warnings |
| `cargo fmt` | Rust | `rustfmt.toml` |
| ShellCheck | Bash | Default rules |

## npm Publishing

```bash
npm publish --access public
# Package: @pump-fun/pump-sdk
```

## Vercel Website Deployment

```bash
# website/ directory — static HTML/CSS/JS
vercel --prod
```

## MCP Server Distribution

```bash
npm publish --access public
# Package: @pump-fun/mcp-server
# Usage: npx -y @pump-fun/mcp-server
```

## Patterns to Follow

- Use conventional commits for automated changelog generation
- Run `cargo clippy` and `cargo fmt` before every Rust commit
- Build TypeScript with both CJS and ESM output
- Test release builds before publishing
- Pin dependencies with lockfiles

## Common Pitfalls

- `tsup` may not pick up all type exports — verify `.d.ts` output
- `cargo build --release` takes significantly longer than debug builds
- npm `prepublishOnly` scripts should run tests and lint
- Vercel deployment requires matching Node.js version
