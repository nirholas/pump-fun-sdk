# Testing Guide

How to run tests across the Pump SDK, Rust vanity generator, TypeScript vanity generator, and shell scripts.

## Overview

The project has multiple test suites covering different components:

| Component | Framework | Location | Language |
|-----------|-----------|----------|----------|
| Core SDK | Jest | `npm test` (root) | TypeScript |
| TypeScript vanity gen | Jest | `typescript/` | TypeScript |
| Rust vanity gen | Cargo test | `rust/` | Rust |
| Shell scripts | Bash | `tests/cli/` | Bash |
| Integration tests | Bash | `tests/integration/` | Bash |
| Benchmarks | Bash | `tests/benchmarks/` | Bash |
| Stress tests | Bash | `tests/stress/` | Bash |
| Fuzz tests | Python | `tests/fuzz/` | Python |

---

## Core SDK Tests

### Run All Tests

```bash
npm test
```

### Run in Watch Mode

```bash
npx jest --watch
```

### Run a Specific Test File

```bash
npx jest src/bondingCurve.test.ts
```

### Run with Coverage

```bash
npx jest --coverage
```

### Configuration

The SDK uses Jest with `ts-jest`. See `jest.config.ts` at the project root (or `package.json` scripts).

---

## TypeScript Vanity Generator Tests

```bash
cd typescript
npm install
npm test
```

### Test Files

| Test | Purpose |
|------|---------|
| `tests/generator.test.ts` | Key generation correctness |
| `tests/matcher.test.ts` | Prefix/suffix pattern matching |
| `tests/validation.test.ts` | Input validation and error handling |
| `tests/security.test.ts` | Zeroization and key material safety |
| `tests/integration.test.ts` | End-to-end generation flows |

Configuration: `typescript/jest.config.js` and `typescript/tsconfig.test.json`.

---

## Rust Vanity Generator Tests

### Unit & Integration Tests

```bash
cd rust
cargo test
```

### Run with Output

```bash
cargo test -- --nocapture
```

### Test Files

| Test | Purpose |
|------|---------|
| `tests/integration_tests.rs` | Full generation pipeline |
| `tests/performance_tests.rs` | Speed and throughput |
| `tests/security_tests.rs` | Key material handling |

### Benchmarks

```bash
cargo bench
```

Benchmark files are in `rust/benches/generation_bench.rs`.

---

## Shell Script Tests

### CLI Tests

```bash
# Test vanity address generation
bash tests/cli/test_generation.sh

# Test keypair verification
bash tests/cli/test_verification.sh
```

### Integration Tests

```bash
# Test keypair validity
bash tests/integration/test_keypair_validity.sh

# Test output format compatibility
bash tests/integration/test_output_compatibility.sh

# Test security properties
bash tests/integration/test_security_properties.sh
```

### Stress Tests

```bash
# Long-running stability test
bash tests/stress/long_running.sh

# Rapid generation burst test
bash tests/stress/rapid_generation.sh
```

---

## Benchmarks

### Compare Implementations

Compare the Rust and TypeScript vanity generators:

```bash
bash tests/benchmarks/compare_implementations.sh
```

### Scaling Test

Test how performance scales with prefix length:

```bash
bash tests/benchmarks/scaling_test.sh
```

---

## Fuzz Testing

Python-based fuzz tests for edge cases:

```bash
# Fuzz input validation
python3 tests/fuzz/fuzz_validation.py

# Fuzz file operations
python3 tests/fuzz/fuzz_file_operations.py
```

Fuzz test fixtures are in `tests/fixtures/`:
- `invalid-inputs.txt` — list of malformed inputs to test
- `README.md` — fixture format documentation

---

## Run All Tests at Once

A convenience script runs every test suite:

```bash
bash docs/run-all-tests.sh
```

Or use the Makefile:

```bash
make test
```

---

## Writing New Tests

### SDK Tests (TypeScript / Jest)

1. Create a file named `*.test.ts` in `src/` or a `__tests__/` directory
2. Import from the SDK:

```typescript
import {
  getBuyTokenAmountFromSolAmount,
  newBondingCurve,
  bondingCurveMarketCap,
} from "../src";
import BN from "bn.js";

describe("bonding curve math", () => {
  it("returns 0 for 0 input", () => {
    const result = getBuyTokenAmountFromSolAmount({
      global: mockGlobal,
      feeConfig: null,
      mintSupply: null,
      bondingCurve: null,
      amount: new BN(0),
    });
    expect(result.eq(new BN(0))).toBe(true);
  });
});
```

3. Run: `npm test`

### Rust Tests

Add tests to existing test files or create new ones in `rust/tests/`:

```rust
#[test]
fn test_my_feature() {
    // Test code here
    assert!(result.is_ok());
}
```

Run: `cd rust && cargo test`

---

## Security Tests

Security-focused tests are spread across components:

| File | What it verifies |
|------|-----------------|
| `rust/tests/security_tests.rs` | Key material zeroization, file permissions |
| `typescript/tests/security.test.ts` | Key cleanup, no memory leaks |
| `tests/integration/test_security_properties.sh` | File permissions, no key exposure |

See [SECURITY.md](../SECURITY.md) and [security/SECURITY_CHECKLIST.md](../security/SECURITY_CHECKLIST.md) for the full security audit checklist.

## Related

- [Contributing](../CONTRIBUTING.md) — How to submit changes
- [Architecture](./architecture.md) — SDK design overview
- [API Reference](./api-reference.md) — Function signatures to test against
