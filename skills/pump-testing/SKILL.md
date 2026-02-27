---
name: pump-testing
description: "Multi-language test infrastructure for the Pump SDK — Rust unit/integration/security/performance tests, TypeScript Jest tests, Python fuzz tests, shell test orchestration, Criterion benchmarks, and CI quality gates."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
---

# Testing & Quality — Multi-Language Test Infrastructure

Comprehensive test infrastructure spanning Rust, TypeScript, Python, and Bash with CI quality gates.

## Test Matrix

| Language | Framework | Directory | Focus |
|----------|-----------|-----------|-------|
| Rust | `cargo test` | `rust/tests/` | Unit, integration, security |
| Rust | Criterion | `rust/benches/` | Performance benchmarks |
| TypeScript | Jest | `typescript/tests/` | Unit, integration |
| TypeScript | Jest | `tests/` | SDK tests |
| Python | Custom | `tests/fuzz/` | Fuzzing |
| Bash | Custom | `tests/cli/` | CLI integration |

## Running Tests

```bash
# Rust
cargo test                            # All tests
cargo test --test integration_tests   # Integration only
cargo test --test security_tests      # Security only
cargo test --test performance_tests   # Performance only
cargo bench                           # Criterion benchmarks

# TypeScript
npx jest                              # All Jest tests
npx jest --coverage                   # With coverage

# Shell
bash scripts/test-rust.sh             # Full Rust test orchestration
bash docs/run-all-tests.sh            # Run everything
```

## Test Orchestration (test-rust.sh — 10 Steps)

1. Check Rust toolchain
2. Run `cargo fmt --check`
3. Run `cargo clippy`
4. Run unit tests
5. Run integration tests
6. Run security tests
7. Run performance tests
8. Run benchmarks
9. Build release binary
10. Verify binary output

## Quality Gates

| Gate | Threshold |
|------|-----------|
| Rust tests | All pass |
| TypeScript tests | All pass |
| `cargo clippy` | No warnings |
| `cargo fmt` | Formatted |
| Coverage | >70% |

## Stress / Benchmark Tests

```bash
# Rust benchmarks
cargo bench --bench generation_bench

# Stress tests
tests/stress/       # Long-running stability tests
tests/benchmarks/   # SDK benchmark tests
```

## Patterns to Follow

- Write tests alongside implementation — not as an afterthought
- Test edge cases: zero amounts, null accounts, maximum values
- Test roundtrip consistency: buy→sell should approximate original (minus fees)
- Use transaction simulation for on-chain behavior verification
- Mock Anchor programs for offline SDK tests

## Common Pitfalls

- Devnet RPC may be rate-limited — use retries in integration tests
- `cargo bench` requires release profile — debug builds give misleading numbers
- Jest `ts-jest` may need explicit `tsconfig.test.json`
- Python fuzz tests may run indefinitely — set timeouts
