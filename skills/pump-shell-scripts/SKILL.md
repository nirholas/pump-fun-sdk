---
name: pump-shell-scripts
description: "Production-quality Bash scripts for Solana vanity generation, keypair verification, batch operations, dependency auditing, and test orchestration — with security-hardened patterns including file permissions, input validation, and cleanup traps."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
    requires:
      bins:
        - bash
        - solana-keygen
---

# Shell Scripting & CLI Tools — Production Bash Scripts

Production-quality Bash scripts for vanity generation, keypair verification, batch operations, dependency auditing, and test orchestration with security-hardened patterns.

## Scripts Overview

| Script | Purpose |
|--------|---------|
| `scripts/utils.sh` | Shared library (colors, logging, validation, cleanup) |
| `scripts/generate-vanity.sh` | Vanity address generation via solana-keygen |
| `scripts/batch-generate.sh` | Parallel batch generation |
| `scripts/verify-keypair.sh` | 7-point keypair verification |
| `scripts/test-rust.sh` | 10-step Rust test orchestration |
| `tools/audit-dependencies.sh` | Dependency security audit |
| `tools/check-file-permissions.sh` | File permission validation |
| `tools/verify-keypair.ts` | TypeScript 9-point verifier |

## Keypair Verification (7 Points)

```bash
verify_keypair() {
    # 1. File exists
    # 2. Valid JSON array
    # 3. Exactly 64 bytes
    # 4. File permissions are 0600
    # 5. solana-keygen verify passes
    # 6. Public key matches filename
    # 7. Re-derive public key from secret matches
}
```

## Security Patterns

```bash
# Cleanup trap
trap 'cleanup_temp_files' EXIT ERR INT TERM

# File permissions
chmod 600 "$keypair_file"

# Input validation
validate_base58() {
    [[ "$1" =~ ^[1-9A-HJ-NP-Za-km-z]+$ ]] || die "Invalid Base58"
}

# No shell injection
# Use "$var" (quoted) everywhere, never $var
```

## Makefile Integration

| Target | Description |
|--------|-------------|
| `make test-rust` | Run Rust test suite |
| `make bench` | Run Criterion benchmarks |
| `make generate` | Generate a vanity address |
| `make verify` | Verify a keypair file |
| `make audit` | Audit dependencies |

## Patterns to Follow

- Source `scripts/utils.sh` in all scripts for shared utilities
- Use `set -euo pipefail` at the top of every script
- Quote all variable expansions: `"$var"` not `$var`
- Use `trap` for cleanup of temporary files
- Validate all user input (Base58, paths, integers)
- Set `chmod 600` on any keypair file immediately after creation

## Common Pitfalls

- `solana-keygen verify` expects the address as the first argument, not the file
- `shred` is not available on all systems — check with `command -v`
- `mktemp` patterns differ between macOS and Linux
- `read -r` is essential to prevent backslash interpretation
- Always use `[[ ]]` over `[ ]` for conditionals
