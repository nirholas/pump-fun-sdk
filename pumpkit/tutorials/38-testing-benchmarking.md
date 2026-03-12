# Tutorial 38: Testing & Benchmarking Vanity Generators

> Run CLI tests, integration tests, fuzz tests, stress tests, and benchmark Rust vs TypeScript performance — the complete test suite.

## Prerequisites

- Node.js 18+, Rust toolchain, Python 3.8+
- Solana CLI (`solana-keygen`)

```bash
# Verify tools are available
which solana-keygen cargo node python3
```

## Test Suite Structure

```
tests/
├── benchmarks/
│   ├── compare_implementations.sh   # Rust vs TS vs CLI speed
│   └── scaling_test.sh              # Multi-prefix scaling
├── cli/
│   ├── test_generation.sh           # Key generation via CLI
│   └── test_verification.sh         # Keypair verification
├── integration/
│   ├── test_keypair_validity.sh     # Cryptographic correctness
│   ├── test_output_compatibility.sh # Cross-language format match
│   └── test_security_properties.sh  # Security invariants
├── fuzz/
│   ├── fuzz_validation.py           # Input validation edge cases
│   └── fuzz_file_operations.py      # File handling edge cases
├── stress/
│   ├── rapid_generation.sh          # Burst generation
│   └── long_running.sh              # Endurance testing
└── fixtures/
    ├── README.md
    └── invalid-inputs.txt           # Known-bad inputs
```

## Step 1: CLI Generation Tests

Test that `solana-keygen grind`, Rust, and TypeScript all produce valid keypairs:

```bash
bash tests/cli/test_generation.sh
```

What it verifies:
- Keypair file is created at expected path
- JSON array has exactly 64 bytes
- Each byte is 0-255
- `solana-keygen pubkey` can extract the public key
- Public key matches the requested prefix

```bash
# Example: manual CLI generation test
PREFIX="ab"
solana-keygen grind --starts-with "${PREFIX}:1" --no-bip39-passphrase

# Verify the output
FILE=$(ls ${PREFIX}*.json | head -1)
PUBKEY=$(solana-keygen pubkey "$FILE")
echo "$PUBKEY" | grep -q "^${PREFIX}" && echo "PASS: Prefix match" || echo "FAIL: Prefix mismatch"
```

## Step 2: Integration Tests — Keypair Validity

Verify cryptographic correctness of generated keypairs:

```bash
bash tests/integration/test_keypair_validity.sh
```

### Checks Performed

```bash
# 1. Public key extraction
solana-keygen pubkey keypair.json

# 2. Keypair verification (solana-keygen)
solana-keygen verify <PUBKEY> keypair.json

# 3. JSON structure validation
jq 'length == 64 and all(. >= 0 and . <= 255)' keypair.json

# 4. Message signing + verification
# Signs a test message, verifies signature matches public key
```

### Cross-Language Output Compatibility

Verify Rust and TypeScript generators produce identical output formats:

```bash
bash tests/integration/test_output_compatibility.sh
```

This ensures:
- Both generators output JSON arrays of 64 integers
- Byte values are in valid range (0-255)
- Generated keypairs are loadable by `@solana/web3.js` and `solana-sdk`
- Public keys derived from the same secret key match across languages

## Step 3: Security Property Tests

Verify security invariants hold across all generators:

```bash
bash tests/integration/test_security_properties.sh
```

| Property | Test |
|----------|------|
| No duplicate keys | Generate N keys, verify all public keys are unique |
| Proper permissions | Generated files have `0600` permissions |
| No key reuse | Same prefix generates different keys each run |
| Entropy quality | Keys pass basic randomness checks |
| Clean shutdown | No key material left in temp files |

## Step 4: Python Fuzz Testing

Test input validation with adversarial inputs:

```bash
python3 tests/fuzz/fuzz_validation.py
```

### Fuzz Test Categories

```python
# The fuzzer tests these input categories against all generators:

test_cases = [
    # Invalid Base58 characters (must be rejected)
    ("0abc", "Zero (not in Base58)", True),
    ("Oabc", "Capital O (not in Base58)", True),
    ("Iabc", "Capital I (not in Base58)", True),
    ("labc", "Lowercase L (not in Base58)", True),

    # Valid Base58 prefixes (must be accepted)
    ("Pump", "Valid prefix", False),
    ("abc", "Simple valid prefix", False),

    # Edge cases
    ("a" * 44, "Max length Base58 address", True),
    ("a" * 100, "Impossibly long prefix", True),

    # Injection attacks (all must be rejected)
    ("../../../etc/passwd", "Path traversal", True),
    ("; rm -rf /", "Shell injection", True),
    ("$(whoami)", "Command substitution", True),
    ("${PATH}", "Variable expansion", True),
    ("' OR 1=1 --", "SQL injection", True),

    # Unicode and special characters
    ("中文abc", "CJK characters", True),
    ("αβγ", "Greek characters", True),
    ("\x00abc", "Null byte", True),
    ("\nabc", "Newline", True),
]
```

### File Operation Fuzzing

```bash
python3 tests/fuzz/fuzz_file_operations.py
```

Tests edge cases in file I/O:
- Writing to read-only directories
- Paths with special characters
- Symlink following
- Race conditions in file creation

## Step 5: Benchmarking — Rust vs TypeScript vs CLI

Compare performance across all three implementations:

```bash
bash tests/benchmarks/compare_implementations.sh
```

### What It Measures

```bash
# Configuration
ITERATIONS=3
TEST_PREFIX="ab"  # 2-char prefix for consistent comparison

# Tests each implementation:
# 1. solana-keygen grind (CLI)
# 2. Rust vanity generator (cargo run)
# 3. TypeScript vanity generator (npx ts-node)

# Measures:
# - Wall clock time per key
# - Average across iterations
# - Keys/second throughput
```

### Expected Results

| Implementation | Speed | Notes |
|---------------|-------|-------|
| Rust generator | 100K+ keys/sec | Multi-threaded (rayon) |
| CLI (`solana-keygen grind`) | ~50K keys/sec | Multi-threaded (built-in) |
| TypeScript generator | ~1K keys/sec | Single-threaded; educational |

### Scaling Test

Test how performance changes with prefix length:

```bash
bash tests/benchmarks/scaling_test.sh
```

```bash
# Tests prefixes of increasing length:
# "a"    → ~instant
# "ab"   → fast
# "abc"  → seconds
# "abcd" → minutes
# Each additional character ≈ 58x harder
```

## Step 6: Stress Tests

### Rapid Burst Generation

```bash
bash tests/stress/rapid_generation.sh
```

Generates many keys in rapid succession to test:
- Memory leaks
- File handle exhaustion
- Disk I/O bottlenecks
- Thread pool stability (Rust)

### Long-Running Endurance

```bash
bash tests/stress/long_running.sh
```

Runs the generator continuously to detect:
- Memory growth over time
- Performance degradation
- System resource exhaustion

## Step 7: Run All Tests

```bash
# Run the complete test suite
bash docs/run-all-tests.sh

# Or run categories individually:
bash tests/cli/test_generation.sh
bash tests/cli/test_verification.sh
bash tests/integration/test_keypair_validity.sh
bash tests/integration/test_output_compatibility.sh
bash tests/integration/test_security_properties.sh
python3 tests/fuzz/fuzz_validation.py
python3 tests/fuzz/fuzz_file_operations.py
bash tests/benchmarks/compare_implementations.sh
```

## Step 8: Writing New Tests

Follow the existing pattern:

```bash
#!/usr/bin/env bash
set -euo pipefail

PASSED=0
FAILED=0

# Helper
assert_eq() {
  local expected="$1" actual="$2" label="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "  PASS: $label"
    PASSED=$((PASSED + 1))
  else
    echo "  FAIL: $label (expected: $expected, got: $actual)"
    FAILED=$((FAILED + 1))
  fi
}

# Your test
echo "Testing: my feature"
RESULT=$(my-command --flag)
assert_eq "expected_output" "$RESULT" "My test case"

# Summary
echo ""
echo "Results: $PASSED passed, $FAILED failed"
[[ "$FAILED" -eq 0 ]] && exit 0 || exit 1
```

## Next Steps

- See [Tutorial 37](./37-security-auditing-verification.md) for security audit tools
