# Contributing to pump-fun-sdk

Thanks for your interest in contributing! Every contribution helps — from fixing typos to building major features.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Commit Messages](#commit-messages)
- [Testing](#testing)
- [Security](#security)
- [Community](#community)

---

## Quick Start

```bash
# 1. Fork and clone
git clone https://github.com/<YOUR_USERNAME>/pump-fun-sdk.git
cd pump-fun-sdk

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Run tests
npm test

# 5. Create a branch
git checkout -b feat/my-feature

# 6. Make changes, commit, push, and open a PR
```

---

## Ways to Contribute

| Type | How |
|------|-----|
| 🐛 **Report bugs** | [Open a bug report](https://github.com/nirholas/pump-fun-sdk/issues/new?template=bug_report.md) |
| 💡 **Suggest features** | [Open a feature request](https://github.com/nirholas/pump-fun-sdk/issues/new?template=feature_request.md) |
| 📖 **Improve docs** | Fix typos, add examples, clarify explanations |
| 🔧 **Submit code** | Bug fixes, new features, performance improvements |
| 🧪 **Add tests** | More coverage is always welcome |
| 🔒 **Security audit** | Review code for vulnerabilities ([see SECURITY.md](SECURITY.md)) |
| ⭐ **Star the repo** | Helps others discover the project |
| 📢 **Spread the word** | Tweet, blog, talk about pump-fun-sdk |

---

## Development Setup

### Prerequisites

- **Node.js 18+** — [Install](https://nodejs.org/)
- **Rust 1.70+** — [Install](https://rustup.rs/) (for vanity generator)
- **Git** — [Install](https://git-scm.com/)

### TypeScript SDK

```bash
npm install        # Install deps
npm run build      # Build to dist/
npm run dev        # Watch mode
npm test           # Run tests
npm run lint       # Lint
npm run lint:fix   # Auto-fix lint issues
```

### Rust Vanity Generator

```bash
cd rust
cargo build --release    # Build
cargo test               # Test
cargo clippy             # Lint
cargo fmt                # Format
cargo bench              # Benchmark
```

### MCP Server

```bash
cd mcp-server
npm install
npm run build
npm start
```

---

## Project Structure

```
pump-fun-sdk/
├── src/                    # Core TypeScript SDK
│   ├── sdk.ts              # PumpSdk — 30+ instruction builders, 14 decoders
│   ├── onlineSdk.ts        # OnlinePumpSdk — fetcher + BothPrograms aggregators
│   ├── bondingCurve.ts     # Bonding curve math
│   ├── analytics.ts        # Price impact, graduation %, token price, summaries
│   ├── fees.ts             # Fee tier calculation
│   ├── state.ts            # 35+ on-chain account & event types
│   ├── pda.ts              # PDA derivations (incl. socialFeePda)
│   ├── tokenIncentives.ts  # Volume-based rewards
│   ├── errors.ts           # Custom errors
│   └── idl/                # Anchor IDLs (pump, pump_amm, pump_fees)
├── rust/                   # Rust vanity address generator
├── typescript/             # TypeScript vanity generator
├── mcp-server/             # MCP server — 53 tools for AI agents
├── telegram-bot/           # Telegram bot + REST API (claims, CTO, launches)
├── websocket-server/       # WebSocket relay (PumpFun API → browsers)
├── website/                # PumpOS web desktop with 169 Pump-Store apps
├── x402/                   # x402 payment protocol (HTTP 402 USDC micropayments)
├── live/                   # Standalone live dashboard pages
├── tutorials/              # 19 hands-on tutorial guides
├── scripts/                # Shell scripts
├── tests/                  # Test suites
├── docs/                   # Documentation
├── security/               # Security audits & checklists
├── skills/                 # 28 agent skill documents
├── prompts/                # Agent prompt templates
├── tools/                  # Verification & audit utilities
└── .github/                # GitHub templates, workflows
```

---

## Code Style

### TypeScript

- Use `const` over `let` where possible
- Use `BN` (bn.js) for all financial amounts — never JavaScript `number`
- Instruction builders return `TransactionInstruction[]`, never `Transaction`
- Functions should be pure where possible
- Use explicit types — avoid `any`
- Follow existing formatting (enforced by ESLint)

### Rust

- Follow `rustfmt` defaults
- Use `clippy` with `-D warnings`
- Zeroize sensitive data (private keys, seeds)
- Document public items with `///` doc comments

### Naming

- **Files**: `camelCase.ts`, `snake_case.rs`
- **Functions**: `camelCase` in TS, `snake_case` in Rust
- **Types/Interfaces**: `PascalCase` in both
- **Constants**: `SCREAMING_SNAKE_CASE` in both

---

## Pull Request Process

1. **Check existing issues** — Is someone already working on this?
2. **Fork and branch** — Create a feature branch from `main`
3. **Write code** — Follow the code style above
4. **Add tests** — Cover new functionality
5. **Update docs** — If you added or changed public API
6. **Test locally** — `npm test` and `npm run build` must pass
7. **Commit** — Follow commit message conventions below
8. **Push and open PR** — Fill out the PR template
9. **Respond to reviews** — Address feedback promptly

### PR Requirements

- [ ] Builds without errors
- [ ] Tests pass
- [ ] No lint warnings
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow conventions
- [ ] PR description explains what and why

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `chore` | Build process, CI, dependencies |
| `security` | Security-related changes |

### Scopes

`sdk`, `bonding-curve`, `fees`, `pda`, `state`, `online-sdk`, `rust`, `typescript`, `mcp`, `scripts`, `docs`, `ci`

### Examples

```
feat(sdk): add createV2AndBuyInstructions method
fix(bonding-curve): handle zero virtual reserves
docs: add fee sharing guide
security(rust): zeroize keypair on drop
test(fees): add tiered fee calculation tests
chore(ci): add Rust clippy to CI pipeline
```

---

## Testing

### TypeScript

```bash
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm test -- --coverage      # Coverage report
```

### Rust

```bash
cd rust
cargo test                  # Unit + integration tests
cargo test -- --nocapture   # Show output
```

### Shell Scripts

```bash
bash tests/cli/test_generation.sh
bash tests/cli/test_verification.sh
bash tests/integration/test_keypair_validity.sh
```

### What to Test

- **Bonding curve math** — Edge cases: zero reserves, max amounts, overflow
- **Fee calculations** — All tier boundaries, mayhem mode
- **PDA derivations** — Known addresses for known inputs
- **Instruction building** — Account ordering, data serialization
- **Error handling** — Invalid inputs, missing accounts
- **Security** — Key zeroization, file permissions, input validation

---

## Security

**Critical rules for contributions:**

1. **ONLY** official Solana Labs crypto libraries — no third-party key generation
2. **Zeroize** all key material after use
3. **Never** log private keys or seeds
4. **Set file permissions** to `0600` for keypair files
5. **No network calls** during key generation
6. **Validate all inputs** — especially public keys and amounts

See [SECURITY.md](SECURITY.md) and [security/SECURITY_CHECKLIST.md](security/SECURITY_CHECKLIST.md) for the complete checklist.

---

## Community

- **GitHub Issues** — Bug reports and feature requests
- **GitHub Discussions** — Questions, ideas, show & tell
- **X (Twitter)** — [@nichxbt](https://x.com/nichxbt)

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful, inclusive, and constructive.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

*Thank you for helping make pump-fun-sdk better. Every contribution matters.*


