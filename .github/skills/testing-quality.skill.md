# Testing & Quality — Multi-Language Test Infrastructure

## Skill Description

Write, run, and maintain the multi-language test infrastructure spanning Rust (Cargo Test + Criterion), TypeScript (Jest + ts-jest), Bash (ShellCheck + integration scripts), and Python (fuzz testing). Covers unit tests, integration tests, security tests, performance tests, benchmarks, stress tests, and fuzzing.

## Context

The project has test suites across four languages testing a safety-critical application (crypto key generation). Test reliability and coverage are paramount — a single bug could compromise private keys. Tests must verify cryptographic correctness, security properties, performance characteristics, and cross-implementation compatibility.

## Key Files

### Rust Tests
- `rust/tests/integration_tests.rs` — keypair generation, file I/O, pattern matching
- `rust/tests/security_tests.rs` — file permissions, memory zeroization, path validation
- `rust/tests/performance_tests.rs` — generation rate, multi-thread scaling
- `rust/benches/generation_bench.rs` — Criterion benchmarks

### TypeScript Tests
- `typescript/tests/` — Jest test suite for the TS vanity generator
- `typescript/jest.config.js` — Jest configuration with ts-jest
- `typescript/tsconfig.test.json` — TypeScript config for tests

### SDK Tests
- `tests/` directory at project root — cross-cutting test suites
- Root `package.json` — Jest configuration for SDK tests

### Shell Tests
- `tests/cli/test_generation.sh` — CLI generation tests
- `tests/cli/test_verification.sh` — CLI verification tests
- `tests/integration/test_keypair_validity.sh` — keypair validity
- `tests/integration/test_output_compatibility.sh` — Rust/TS output compatibility
- `tests/integration/test_security_properties.sh` — security property verification

### Fuzz Tests
- `tests/fuzz/fuzz_file_operations.py` — file I/O fuzzing
- `tests/fuzz/fuzz_validation.py` — input validation fuzzing

### Performance Tests
- `tests/benchmarks/compare_implementations.sh` — Rust vs TypeScript comparison
- `tests/benchmarks/scaling_test.sh` — thread count scaling
- `tests/stress/long_running.sh` — endurance tests
- `tests/stress/rapid_generation.sh` — rapid generation cycles

### Test Data
- `tests/fixtures/invalid-inputs.txt` — invalid input test vectors
- `tests/fixtures/README.md` — fixture documentation

### Test Orchestration
- `scripts/test-rust.sh` — 10-step Rust test runner
- `docs/run-all-tests.sh` — full test suite runner
- `Makefile` — `make test`, `make lint`, `make test-gen`, `make test-verify`

## Key Concepts

### Rust Testing Structure

**Unit tests** (inline in source files):
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_valid_base58_pattern() { ... }
}
```

**Integration tests** (`rust/tests/`):
```rust
// tests/integration_tests.rs
use solana_vanity::{VanityGenerator, MatchTarget, VanityGeneratorConfig};

#[test]
fn test_prefix_generation() {
    let target = MatchTarget::prefix("A", false).unwrap();
    let config = VanityGeneratorConfig { threads: 1, ..Default::default() };
    let gen = VanityGenerator::new(target, config).unwrap();
    let result = gen.generate().unwrap();
    assert!(result.public_key().starts_with("A"));
}
```

**Security tests:**
```rust
#[test]
fn test_file_permissions() {
    let addr = generate_test_address();
    write_keypair_file(&addr, &path).unwrap();
    let metadata = fs::metadata(&path).unwrap();
    assert_eq!(metadata.permissions().mode() & 0o777, 0o600);
}

#[test]
fn test_path_traversal_rejection() {
    assert!(secure_write_file(Path::new("/etc/test"), &[]).is_err());
}
```

**Benchmarks** (Criterion):
```rust
fn bench_keypair_generation(c: &mut Criterion) {
    c.bench_function("keypair_gen", |b| {
        b.iter(|| Keypair::new())
    });
}
```

**Test orchestration** (`test-rust.sh`):
```bash
# 10 iterations each with --test-threads=1 for determinism
for i in $(seq 1 10); do
    cargo test --release -- --test-threads=1
    cargo test --release --test integration_tests -- --test-threads=1
    cargo test --release --test security_tests -- --test-threads=1
done
```

### TypeScript Testing (Jest)

**Config** (`jest.config.js`):
```javascript
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts'],
};
```

**Test patterns:**
```typescript
describe('VanityGenerator', () => {
    it('should generate address with prefix', async () => {
        const result = await generateVanityAddress({ prefix: 'A' });
        expect(result.publicKey.startsWith('A')).toBe(true);
    });

    it('should throw on invalid characters', () => {
        expect(() => new VanityGenerator({ prefix: '0' }))
            .toThrow(VanityError);
    });
});
```

### SDK Testing (Jest)

Root-level Jest configuration in `package.json`:
```json
{
    "scripts": { "test": "jest" },
    "devDependencies": {
        "jest": "^29.7.0",
        "ts-jest": "^29.3.2"
    }
}
```

### Shell Test Patterns

```bash
#!/bin/bash
set -euo pipefail

test_keypair_generation() {
    local output
    output=$(./scripts/generate-vanity.sh -p "A" -o /tmp/test-key.json)
    [[ -f /tmp/test-key.json ]] || { echo "FAIL: file not created"; return 1; }
    
    local perms
    perms=$(stat -c %a /tmp/test-key.json)
    [[ "$perms" == "600" ]] || { echo "FAIL: permissions $perms != 600"; return 1; }
    
    echo "PASS: keypair generation"
}
```

### Fuzzing (Python)

```python
# tests/fuzz/fuzz_validation.py
import random
import subprocess

def fuzz_prefix():
    """Generate random strings including invalid characters"""
    chars = string.printable
    for _ in range(1000):
        length = random.randint(0, 20)
        prefix = ''.join(random.choice(chars) for _ in range(length))
        result = subprocess.run(['./target/release/solana-vanity', '-p', prefix, '--dry-run'],
                              capture_output=True)
        # Should never crash, only error gracefully
        assert result.returncode in [0, 1]
```

### Cross-Implementation Compatibility

```bash
# tests/integration/test_output_compatibility.sh
# Verify Rust and TypeScript produce identical output format
rust_output=$(./target/release/solana-vanity -p A -o /tmp/rust-key.json && cat /tmp/rust-key.json)
ts_output=$(npx ts-node typescript/src/index.ts -p A -o /tmp/ts-key.json && cat /tmp/ts-key.json)

# Both should be JSON arrays of 64 integers
jq 'length' /tmp/rust-key.json  # should be 64
jq 'length' /tmp/ts-key.json    # should be 64
```

### Performance Testing

```bash
# tests/benchmarks/scaling_test.sh
for threads in 1 2 4 8; do
    rate=$(./target/release/solana-vanity -p AAAAAA --dry-run -t $threads 2>&1 | grep "keys/sec")
    echo "Threads: $threads, Rate: $rate"
done
```

## Patterns to Follow

- Run Rust tests with `--test-threads=1` for deterministic output
- Run 10 iterations of each test category to catch flaky tests
- Always test in release mode (`--release`) for accurate performance numbers
- Security tests must verify: file permissions, path traversal rejection, memory zeroization
- Use fixtures for invalid input test vectors (`tests/fixtures/invalid-inputs.txt`)
- Fuzz tests should never cause crashes — only graceful errors
- Cross-implementation tests verify output format compatibility (JSON array of 64 u8s)
- Use `set -euo pipefail` in all shell test scripts
- Clean up test artifacts after each test run
- Benchmark in release mode only — debug builds are 10x+ slower

## Common Pitfalls

- Jest async tests must await promises — forgetting `await` causes false passes
- Rust `#[test]` functions run in parallel by default — use `--test-threads=1` for tests with shared state
- Shell tests may fail in CI without a TTY — disable color output when `[[ ! -t 1 ]]`
- Performance benchmarks are meaningless in debug mode or on CI with shared resources
- Fuzz tests can run indefinitely — always set iteration limits
- Cross-platform file permission tests fail on Windows — skip with OS detection
- Criterion benchmarks require `cargo bench`, not `cargo test` — they're separate binaries

## Quality Gates

| Gate | Command | Pass Criteria |
|------|---------|--------------|
| Rust format | `cargo fmt --check` | No formatting diffs |
| Rust lint | `cargo clippy -- -D warnings` | Zero warnings |
| Rust build | `cargo build --release` | Zero errors |
| Rust tests | `cargo test --release` (10x) | All pass, all iterations |
| TS typecheck | `npx tsc --noEmit` | Zero errors |
| TS lint | `npm run lint` | Zero errors |
| TS tests | `npm test` | All pass |
| Shell lint | `shellcheck scripts/*.sh` | Zero warnings |
| SDK build | `npm run build` | Zero errors |
| SDK tests | `npm test` | All pass |
