# Tutorial 37: Security Auditing & Keypair Verification

> Run dependency audits, verify keypair integrity with 9 automated checks, and scan file permissions — the complete security toolkit.

## Prerequisites

- Node.js 18+, Rust toolchain (for cargo audit)
- Repository cloned locally

```bash
cd /path/to/pump-fun-sdk
```

## The Security Tools

```
tools/
├── verify-keypair.ts          # 9-check keypair verification
├── audit-dependencies.sh      # npm + cargo vulnerability scanner
├── check-file-permissions.sh  # Finds keypairs with wrong permissions
└── README.md
```

## Step 1: Keypair Verification (9 Checks)

The most important tool — verifies a keypair file is valid, secure, and functional:

```typescript
import { verifyKeypair } from "../tools/verify-keypair";

// Basic verification
const result = await verifyKeypair("./my-keypair.json");

console.log(`Passed: ${result.passed}`);
console.log(`Public key: ${result.publicKey}`);

for (const check of result.checks) {
  console.log(`${check.passed ? "✅" : "❌"} ${check.name}: ${check.message}`);
}
```

### The 9 Checks

| # | Check | What It Verifies |
|---|-------|-----------------|
| 1 | File exists | File is readable at the given path |
| 2 | Permissions | File permissions are exactly `0600` (owner read/write only) |
| 3 | Valid JSON | Contents parse as JSON |
| 4 | Array format | JSON is an array of exactly 64 numbers, each 0-255 |
| 5 | Keypair construction | `Keypair.fromSecretKey()` succeeds |
| 6 | Public key derivation | Derived public key matches expected bytes |
| 7 | Prefix match | Public key starts with expected prefix (optional) |
| 8 | Suffix match | Public key ends with expected suffix (optional) |
| 9 | Sign & verify | Signs a message and verifies the signature |

### With Prefix/Suffix Validation

For vanity-generated keypairs, verify the address matches:

```typescript
// Verify a vanity keypair with prefix "Pump"
const result = await verifyKeypair(
  "./Pump7x9abc.json",
  "Pump",     // expectedPrefix
  undefined   // expectedSuffix (optional)
);

if (!result.passed) {
  const failures = result.checks.filter((c) => !c.passed);
  console.error("FAILED checks:", failures.map((f) => f.name));
}
```

### Run from CLI

```bash
npx ts-node tools/verify-keypair.ts ./my-keypair.json
npx ts-node tools/verify-keypair.ts ./vanity.json Pump
npx ts-node tools/verify-keypair.ts ./vanity.json Pump SDK
```

## Step 2: Dependency Vulnerability Scanning

Scan both Rust and TypeScript dependencies for known vulnerabilities:

```bash
bash tools/audit-dependencies.sh
```

### What It Checks

**Rust dependencies (cargo audit):**
```bash
# Installs cargo-audit if missing, then runs:
cargo audit
# Also checks license compliance:
cargo-license --json
```

**TypeScript dependencies (npm audit):**
```bash
npm audit --audit-level=high
# License check:
npx license-checker --summary
```

**Shell script static analysis:**
- Detects `curl | sh` patterns (remote code execution risk)
- Flags `eval` usage (command injection risk)
- Finds unquoted variables (word splitting risk)
- Scans for hardcoded secrets or API keys

### Example Output

```
=== Dependency Audit Report ===

[Rust] cargo audit ............ ✅ PASS (0 vulnerabilities)
[Rust] license check .......... ✅ PASS (all MIT/Apache-2.0)
[Node] npm audit .............. ✅ PASS (0 high/critical)
[Node] license check .......... ✅ PASS
[Shell] static analysis ....... ✅ PASS (0 issues)

Summary: 5/5 checks passed
```

## Step 3: File Permission Scanner

Find keypair files with insecure permissions:

```bash
bash tools/check-file-permissions.sh
```

### How It Works

1. Scans for all `.json` files in the project
2. Reads each file with `jq` to check if it looks like a keypair (array of 64 numbers)
3. Skips known non-keypair files (`package.json`, `tsconfig.json`, etc.)
4. For actual keypairs, verifies permissions are exactly `600`

```bash
# Example output:
Scanning for keypair files...
Checked 127 JSON files, found 3 keypairs

✅ ./keys/vanity1.json ........... 600
❌ ./keys/vanity2.json ........... 644  ← INSECURE!
✅ ./keys/vanity3.json ........... 600

1 keypair(s) with insecure permissions!
```

### Fix Insecure Permissions

```bash
# Fix a single file
chmod 600 ./keys/vanity2.json

# Fix all keypair files at once
find . -name "*.json" -exec bash -c '
  if jq -e "if type == \"array\" and length == 64 then true else false end" "$1" > /dev/null 2>&1; then
    chmod 600 "$1"
    echo "Fixed: $1"
  fi
' _ {} \;
```

## Step 4: Automated Security Pipeline

Combine all tools into one script:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== Pump SDK Security Audit ==="
echo ""

FAILURES=0

# 1. Dependency audit
echo "--- Dependency Vulnerabilities ---"
if bash tools/audit-dependencies.sh; then
  echo "✅ Dependencies clean"
else
  echo "❌ Vulnerability found!"
  FAILURES=$((FAILURES + 1))
fi
echo ""

# 2. File permissions
echo "--- Keypair Permissions ---"
if bash tools/check-file-permissions.sh; then
  echo "✅ All keypairs secured"
else
  echo "❌ Insecure keypair permissions!"
  FAILURES=$((FAILURES + 1))
fi
echo ""

# 3. Verify all keypair files
echo "--- Keypair Integrity ---"
for kp in $(find . -path ./node_modules -prune -o -name "*.json" -print); do
  if jq -e 'if type == "array" and length == 64 then true else false end' "$kp" > /dev/null 2>&1; then
    if npx ts-node tools/verify-keypair.ts "$kp" > /dev/null 2>&1; then
      echo "  ✅ $kp"
    else
      echo "  ❌ $kp FAILED verification!"
      FAILURES=$((FAILURES + 1))
    fi
  fi
done
echo ""

# Summary
if [ "$FAILURES" -eq 0 ]; then
  echo "🟢 All security checks passed"
  exit 0
else
  echo "🔴 $FAILURES check(s) failed"
  exit 1
fi
```

## Step 5: CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
name: Security Audit
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 6 * * 1' # Weekly Monday 6am

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo install cargo-audit
      - run: npm ci
      - run: bash tools/audit-dependencies.sh
      - run: bash tools/check-file-permissions.sh
```

## Security Checklist Summary

| Category | Tool | Frequency |
|----------|------|-----------|
| Dependencies | `audit-dependencies.sh` | Every PR + weekly |
| File permissions | `check-file-permissions.sh` | Every PR |
| Keypair integrity | `verify-keypair.ts` | After generation |
| Sign/verify test | `verify-keypair.ts` check #9 | After generation |
| Prefix validation | `verify-keypair.ts` check #7 | After vanity generation |

## Next Steps

- See [Tutorial 13](./13-vanity-addresses.md) for generating keypairs to verify
- See [Tutorial 30](./30-batch-shell-scripts.md) for batch generation with built-in verification
- See [Tutorial 38](./38-testing-benchmarking.md) for the full test suite
