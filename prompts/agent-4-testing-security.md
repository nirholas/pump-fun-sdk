# Agent 4: Testing & Security Audit

## Role
You are a senior security engineer and QA specialist with expertise in cryptographic applications. Your task is to comprehensively test all implementations, perform security audits, and create integration tests that verify the entire system works correctly and securely.

## Project Context
- Repository: `/workspaces/solana-vanity-address`
- Implementations to audit: CLI scripts, Rust project, TypeScript project
- Security Level: CRITICAL - This generates cryptocurrency private keys
- Goal: Ensure all implementations are secure, correct, and production-ready

## Your Deliverables

### 1. Security Audit Reports

#### `security/audit-cli.md`
Comprehensive security review of CLI scripts:
- Input validation completeness
- File permission handling
- Secure deletion practices
- Error message information leakage
- Shell injection vulnerabilities
- Environment variable handling

#### `security/audit-rust.md`
Comprehensive security review of Rust implementation:
- Memory safety analysis
- Zeroization verification
- RNG quality verification
- Dependency audit (cargo audit)
- Unsafe code review
- Error handling completeness

#### `security/audit-typescript.md`
Comprehensive security review of TypeScript implementation:
- Input validation completeness
- Dependency audit (npm audit)
- File permission handling
- Memory handling (best effort in JS)
- Prototype pollution prevention
- Code injection prevention

### 2. Cross-Implementation Test Suite (`tests/integration/`)

#### `tests/integration/test_output_compatibility.sh`
```bash
#!/bin/bash
# Verify all implementations produce compatible output

# Generate with CLI
solana-keygen grind --starts-with ab:1 --no-outfile > /tmp/cli-key.json

# Generate with Rust
./rust/target/release/solana-vanity --prefix ab --output /tmp/rust-key.json

# Generate with TypeScript
node typescript/dist/index.js --prefix ab --output /tmp/ts-key.json

# Verify all can be loaded by solana-keygen
for key in cli rust ts; do
  solana-keygen pubkey /tmp/${key}-key.json || exit 1
done

# Verify format is identical (array of numbers)
# ...
```

#### `tests/integration/test_keypair_validity.sh`
```bash
#!/bin/bash
# Test that generated keypairs are cryptographically valid

# For each implementation:
# 1. Generate a keypair
# 2. Sign a message
# 3. Verify the signature
# 4. Confirm public key derivation is correct
```

#### `tests/integration/test_security_properties.sh`
```bash
#!/bin/bash
# Test security properties across all implementations

# File permissions
test_file_permissions() {
  # Generate keypair
  # Verify file has 0o600 permissions
}

# Input validation
test_input_validation() {
  # Try invalid Base58 characters (0, O, I, l)
  # Verify rejection
}

# Error handling
test_error_handling() {
  # Verify errors don't leak sensitive information
}
```

### 3. Fuzz Testing (`tests/fuzz/`)

#### `tests/fuzz/fuzz_validation.py`
```python
#!/usr/bin/env python3
"""Fuzz test input validation across all implementations"""

import subprocess
import random
import string

# Generate random inputs including edge cases
test_cases = [
    "",                          # Empty
    "0",                         # Invalid Base58
    "O",                         # Invalid Base58
    "I",                         # Invalid Base58
    "l",                         # Invalid Base58
    "a" * 100,                   # Very long
    "🚀",                        # Unicode
    "../../../etc/passwd",       # Path traversal
    "; rm -rf /",               # Shell injection
    "${HOME}",                   # Variable expansion
    "$(whoami)",                 # Command substitution
    # ... more edge cases
]

def fuzz_implementation(cmd_template, test_case):
    """Run implementation with test case, verify proper rejection"""
    pass

# Run against all implementations
```

#### `tests/fuzz/fuzz_file_operations.py`
```python
#!/usr/bin/env python3
"""Fuzz test file operations"""

# Test various file paths:
# - Paths with spaces
# - Paths with special characters
# - Symlinks
# - Non-writable directories
# - Existing files
# - /dev/null
# - Very long paths
```

### 4. Performance Benchmarks (`tests/benchmarks/`)

#### `tests/benchmarks/compare_implementations.sh`
```bash
#!/bin/bash
# Compare performance across implementations

echo "=== Performance Comparison ==="
echo "Prefix: 'ab' (2 chars)"

# CLI
time solana-keygen grind --starts-with ab:1

# Rust
time ./rust/target/release/solana-vanity --prefix ab

# TypeScript
time node typescript/dist/index.js --prefix ab

# Generate report
```

#### `tests/benchmarks/scaling_test.sh`
```bash
#!/bin/bash
# Test performance scaling with prefix length

for len in 1 2 3 4; do
  prefix=$(head /dev/urandom | tr -dc 'a-km-zA-HJ-NP-Z1-9' | head -c $len)
  echo "Testing prefix: $prefix (length: $len)"
  
  # Time each implementation
  # Record results
done
```

### 5. Stress Tests (`tests/stress/`)

#### `tests/stress/long_running.sh`
```bash
#!/bin/bash
# Long-running stability test

# Run for extended period
# Monitor:
# - Memory usage
# - File descriptor leaks
# - CPU usage
# - Correct output
```

#### `tests/stress/rapid_generation.sh`
```bash
#!/bin/bash
# Generate many keypairs rapidly

# Test:
# - No file collisions
# - All files have correct permissions
# - All keypairs are valid
# - No corruption
```

### 6. Verification Tools (`tools/`)

#### `tools/verify-keypair.ts`
```typescript
#!/usr/bin/env ts-node
/**
 * Verify a keypair file is valid and matches expected properties
 */

import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

async function verifyKeypair(filePath: string, expectedPrefix?: string) {
  // 1. File exists and is readable
  // 2. File has correct permissions (0o600)
  // 3. File contains valid JSON
  // 4. JSON is array of 64 numbers (0-255)
  // 5. Can construct Keypair from data
  // 6. Public key derivation is correct
  // 7. Prefix matches (if specified)
  // 8. Can sign and verify a message
}
```

#### `tools/audit-dependencies.sh`
```bash
#!/bin/bash
# Audit all dependencies for vulnerabilities

echo "=== Rust Dependencies ==="
cd rust && cargo audit

echo "=== TypeScript Dependencies ==="
cd ../typescript && npm audit

echo "=== Shell Scripts ==="
# Check for use of vulnerable commands
grep -r "curl.*|.*sh" scripts/
grep -r "eval" scripts/
```

#### `tools/check-file-permissions.sh`
```bash
#!/bin/bash
# Verify all generated keypair files have correct permissions

find . -name "*.json" -exec stat -c "%a %n" {} \; | while read perm file; do
  if [[ "$perm" != "600" ]]; then
    echo "WARNING: $file has permissions $perm (should be 600)"
  fi
done
```

### 7. Comprehensive Test Runner (`run-all-tests.sh`)

```bash
#!/bin/bash
set -e

echo "=========================================="
echo "Solana Vanity Address - Comprehensive Test Suite"
echo "=========================================="

ITERATIONS=${1:-10}
FAILED=0

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log_pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
log_fail() { echo -e "${RED}✗ FAIL${NC}: $1"; FAILED=$((FAILED+1)); }

echo ""
echo "=== Building All Implementations ==="
cd rust && cargo build --release && cd ..
cd typescript && npm run build && cd ..

echo ""
echo "=== Running Tests ($ITERATIONS iterations each) ==="

# CLI Tests
echo ""
echo "--- CLI Script Tests ---"
for i in $(seq 1 $ITERATIONS); do
  if ./tests/cli/test_generation.sh; then
    log_pass "CLI generation test (run $i)"
  else
    log_fail "CLI generation test (run $i)"
  fi
done

# Rust Tests
echo ""
echo "--- Rust Tests ---"
for i in $(seq 1 $ITERATIONS); do
  if cd rust && cargo test && cd ..; then
    log_pass "Rust tests (run $i)"
  else
    log_fail "Rust tests (run $i)"
    cd ..
  fi
done

# TypeScript Tests
echo ""
echo "--- TypeScript Tests ---"
for i in $(seq 1 $ITERATIONS); do
  if cd typescript && npm test && cd ..; then
    log_pass "TypeScript tests (run $i)"
  else
    log_fail "TypeScript tests (run $i)"
    cd ..
  fi
done

# Integration Tests
echo ""
echo "--- Integration Tests ---"
for i in $(seq 1 $ITERATIONS); do
  if ./tests/integration/test_output_compatibility.sh; then
    log_pass "Output compatibility (run $i)"
  else
    log_fail "Output compatibility (run $i)"
  fi
done

# Security Tests
echo ""
echo "--- Security Tests ---"
./tests/integration/test_security_properties.sh

# Fuzz Tests
echo ""
echo "--- Fuzz Tests ---"
python3 tests/fuzz/fuzz_validation.py

# Dependency Audits
echo ""
echo "--- Dependency Audits ---"
./tools/audit-dependencies.sh

# Summary
echo ""
echo "=========================================="
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}$FAILED tests failed${NC}"
  exit 1
fi
```

### 8. Security Checklist (`security/SECURITY_CHECKLIST.md`)

```markdown
# Security Checklist

## Before Release

### Code Review
- [ ] All code reviewed by at least one other person
- [ ] No hardcoded secrets or test keys
- [ ] No debug logging in production code
- [ ] All TODO/FIXME items resolved

### Input Validation
- [ ] All user inputs validated
- [ ] Invalid Base58 characters rejected
- [ ] Path traversal prevented
- [ ] Shell injection prevented
- [ ] Reasonable length limits enforced

### Output Security
- [ ] File permissions set to 0600
- [ ] No secret keys in logs
- [ ] No secret keys in error messages
- [ ] Output format verified

### Cryptographic Safety
- [ ] Using official Solana libraries only
- [ ] No custom cryptography
- [ ] RNG quality verified
- [ ] Keypair validity verified after generation

### Memory Safety
- [ ] Rust: No unsafe code without justification
- [ ] Rust: Zeroization implemented
- [ ] TypeScript: Sensitive data cleared where possible
- [ ] No memory leaks in long-running operations

### Dependencies
- [ ] cargo audit passes (Rust)
- [ ] npm audit passes (TypeScript)
- [ ] All dependencies are necessary
- [ ] Dependencies are from trusted sources

### Testing
- [ ] All tests pass consistently (10+ runs)
- [ ] Edge cases tested
- [ ] Error conditions tested
- [ ] Fuzz testing completed
- [ ] Performance benchmarks recorded

### Documentation
- [ ] Security considerations documented
- [ ] Secure usage instructions provided
- [ ] Known limitations documented
```

### 9. Test Data and Fixtures

#### `tests/fixtures/valid-keypairs/`
Pre-generated valid keypairs for testing (DO NOT USE IN PRODUCTION):
```
test-keypair-1.json  # Known valid keypair for testing
test-keypair-2.json
```

#### `tests/fixtures/invalid-inputs.txt`
```
0abc        # Contains invalid '0'
Oabc        # Contains invalid 'O'
Iabc        # Contains invalid 'I'
labc        # Contains invalid 'l'
            # Empty line
   abc      # Leading whitespace
abc   	    # Trailing whitespace
abc def     # Space in middle
```

### 10. CI/CD Configuration (`.github/workflows/test.yml`)

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Solana CLI
        run: |
          sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
          echo "$HOME/.local/share/solana/install/active_release/bin" >> $GITHUB_PATH
      
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd rust && cargo fetch
          cd ../typescript && npm ci
      
      - name: Run comprehensive tests
        run: ./run-all-tests.sh 10
      
      - name: Security audit
        run: |
          cd rust && cargo audit
          cd ../typescript && npm audit
```

## Validation Checklist

Before completing, verify:
- [ ] All implementations pass all tests 10+ times
- [ ] Security audits completed for each implementation
- [ ] Cross-implementation compatibility verified
- [ ] Fuzz testing completed
- [ ] Performance benchmarks recorded
- [ ] No security vulnerabilities found
- [ ] All tools work correctly
- [ ] Documentation is complete
- [ ] CI/CD pipeline works

## Critical Security Findings to Check

1. **Secret Key Exposure**
   - Search all code for potential key logging
   - Verify error messages don't contain keys
   - Check debug output

2. **File Permission Vulnerabilities**
   - Test on different systems
   - Verify umask doesn't override

3. **Input Injection**
   - Test shell injection in CLI
   - Test path traversal
   - Test command substitution

4. **Cryptographic Issues**
   - Verify RNG quality
   - Verify correct library usage
   - No custom crypto

5. **Memory Issues**
   - Rust: check for unsafe
   - Check for memory leaks
   - Verify zeroization
