# Tests

Cross-language test suites for the Pump SDK vanity generators and shell scripts. Covers unit tests, integration tests, benchmarks, fuzz testing, and stress testing.

## Structure

```
tests/
├── benchmarks/          Performance benchmarks
│   ├── compare_implementations.sh   — Rust vs TypeScript speed comparison
│   └── scaling_test.sh              — Thread scaling / throughput tests
├── cli/                 CLI command tests
│   ├── test_generation.sh           — Vanity address generation tests
│   └── test_verification.sh         — Keypair verification tests
├── integration/         Cross-component integration tests
│   ├── test_keypair_validity.sh     — Keypair cryptographic validity
│   ├── test_output_compatibility.sh — Cross-language output format compat
│   └── test_security_properties.sh  — File permissions, zeroization, etc.
├── fixtures/            Test data and fixtures
│   ├── README.md                    — Fixture documentation
│   └── invalid-inputs.txt           — Invalid input test cases
├── fuzz/                Fuzz testing (Python)
│   ├── fuzz_file_operations.py      — File I/O edge cases
│   └── fuzz_validation.py           — Input validation fuzzing
└── stress/              Load and endurance tests
    ├── long_running.sh              — Extended duration test runs
    └── rapid_generation.sh          — Burst generation under load
```

## Running Tests

### All tests

```bash
bash docs/run-all-tests.sh
```

### By category

```bash
# CLI tests
bash tests/cli/test_generation.sh
bash tests/cli/test_verification.sh

# Integration tests
bash tests/integration/test_keypair_validity.sh
bash tests/integration/test_output_compatibility.sh
bash tests/integration/test_security_properties.sh

# Benchmarks
bash tests/benchmarks/compare_implementations.sh
bash tests/benchmarks/scaling_test.sh

# Fuzz tests (requires Python 3)
python3 tests/fuzz/fuzz_validation.py
python3 tests/fuzz/fuzz_file_operations.py

# Stress tests
bash tests/stress/rapid_generation.sh
bash tests/stress/long_running.sh
```

### Rust tests

```bash
cd rust && cargo test
# or use the helper script:
bash scripts/test-rust.sh
```

### TypeScript SDK tests

```bash
npx jest
```

## Test Categories

| Category | Purpose | Language |
|----------|---------|----------|
| **CLI** | Validates shell script behavior, flags, and output | Bash |
| **Integration** | Cross-language compatibility, keypair validity, security properties | Bash |
| **Benchmarks** | Performance comparison (Rust vs TS), thread scaling | Bash |
| **Fuzz** | Edge-case discovery for input validation and file operations | Python |
| **Stress** | Endurance and burst-load testing | Bash |
| **Fixtures** | Shared test data (invalid inputs, expected outputs) | Data |

## Requirements

- Bash 4+
- `solana-keygen` (for CLI and integration tests)
- Python 3 (for fuzz tests)
- Rust toolchain (for `cargo test`)
- Node.js 20+ (for Jest / TypeScript tests)
