# Tools

Audit and verification utilities for maintaining project security and dependency health.

## Tools

### `audit-dependencies.sh`

Audits all project dependencies for known vulnerabilities across all package managers.

```bash
bash tools/audit-dependencies.sh
```

Checks npm (`npm audit`), Cargo (`cargo audit`), and reports pass/fail/warn for each.

### `check-file-permissions.sh`

Verifies that all keypair JSON files have correct permissions (`0600` — owner read/write only).

```bash
bash tools/check-file-permissions.sh           # Scans project root
bash tools/check-file-permissions.sh ./keys     # Scans specific directory
```

Finds all `*.json` keypair files and flags any with overly permissive access.

### `verify-keypair.ts`

TypeScript keypair verification utility. Validates that a Solana keypair file contains a valid key pair and that the public key matches the expected address.

```bash
npx tsx tools/verify-keypair.ts ./path/to/keypair.json
```

## When To Use

- **Before deployment** — run `audit-dependencies.sh` to catch vulnerable packages
- **After key generation** — run `check-file-permissions.sh` to verify file security
- **CI/CD pipelines** — integrate all three as pre-deploy checks
