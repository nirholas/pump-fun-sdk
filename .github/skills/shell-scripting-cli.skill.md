# Shell Scripting & CLI Tools — Production Bash Scripts for Solana Operations

## Skill Description

Write, maintain, and extend production-quality Bash scripts for Solana vanity address generation, keypair verification, batch operations, dependency auditing, and test orchestration, following security-hardened patterns with proper error handling and cross-platform compatibility.

## Context

The project includes a comprehensive set of Bash scripts that wrap the Solana CLI (`solana-keygen grind`), the Rust binary, and Node.js tooling. These scripts are designed for production use on Linux/macOS, with proper input validation, secure file handling, colored terminal output, and cross-platform `stat` support.

## Key Files

### Core Scripts (`scripts/`)
- `scripts/generate-vanity.sh` (491 lines) — single-address vanity generator wrapping `solana-keygen grind`
- `scripts/batch-generate.sh` (563 lines) — parallel batch generator with resume support
- `scripts/verify-keypair.sh` (459 lines) — 7-point keypair verification tool
- `scripts/test-rust.sh` (74 lines) — 10-step Rust test orchestrator
- `scripts/utils.sh` (548 lines) — shared library (logging, validation, file ops)

### Audit & Security Tools (`tools/`)
- `tools/audit-dependencies.sh` (212 lines) — multi-ecosystem dependency auditor
- `tools/check-file-permissions.sh` (121 lines) — keypair file permission scanner
- `tools/verify-keypair.ts` (436 lines) — TypeScript keypair verifier with sign-and-verify

### Build System
- `Makefile` (213 lines) — GNU Make targets for install, generate, verify, test, lint, clean

## Key Concepts

### Shared Utilities (`utils.sh`)

All scripts source `utils.sh` for consistent behavior:

**Constants:**
- `BASE58_CHARS="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"`
- Exit codes: `EXIT_SUCCESS=0`, `EXIT_ERROR=1`, `EXIT_INVALID_INPUT=2`
- Color codes auto-disabled when not a TTY

**Logging:**
```bash
log_error "message"   # Red, always shown
log_warn "message"    # Yellow, always shown
log_info "message"    # Blue, respects QUIET
log_success "message" # Green, respects QUIET
log_debug "message"   # Dim, only when VERBOSE
log_step N "message"  # Numbered step indicator
```

**Validation:**
```bash
is_valid_base58() {
  local char
  for ((i=0; i<${#1}; i++)); do
    char="${1:$i:1}"
    [[ "$BASE58_CHARS" == *"$char"* ]] || return 1
  done
  return 0
}
```

**File Security:**
- `set_secure_permissions()` — `chmod 600`
- `check_secure_permissions()` — cross-platform stat (Darwin uses `-f %Lp`, Linux uses `-c %a`)
- `secure_delete()` — `shred` → `gshred` → `dd if=/dev/urandom` fallback chain

**System Detection:**
- `get_cpu_cores()` — `nproc` → `sysctl -n hw.ncpu` → `/proc/cpuinfo` fallback

### Vanity Generation (`generate-vanity.sh`)

Production wrapper around `solana-keygen grind`:
- Full Base58 character validation per-character
- Automatic timestamped backups (`--backup`)
- Optional GPG encryption (`--encrypt`)
- Thread control (`--threads`)
- Both prefix and suffix support (`--starts-with`, `--ends-with`, `--starts-and-ends-with`)
- File permissions set to 600 immediately after generation
- Progress feedback with timing

### Batch Generation (`batch-generate.sh`)

Parallel batch operations:
- Reads prefixes from a file (one per line, optional `Prefix:count` format)
- `--jobs` flag for parallel execution
- Structured output directory: `batch_output/<prefix>/`
- `--resume` skips already-generated prefixes
- `--encrypt` for GPG encryption of all generated files
- Summary report at completion
- Proper job control (`wait`, `kill` on interrupt)

### Keypair Verification (`verify-keypair.sh`)

7-point verification:
1. File exists and is readable
2. Secure permissions (600 or 400)
3. Valid JSON structure
4. 64-byte array format
5. Public key derivation correctness
6. Prefix match (optional)
7. Suffix match (optional)

Supports `--json` output for scripting, associative array tracking (`declare -A CHECKS`).

### TypeScript Verifier (`verify-keypair.ts`)

9-point verification including sign-and-verify:
```typescript
const message = Buffer.from("verification-test");
const signature = nacl.sign.detached(message, keypair.secretKey);
const isValid = nacl.sign.detached.verify(message, signature, keypair.publicKey.toBytes());
```

### Dependency Auditing (`audit-dependencies.sh`)

Multi-ecosystem audit:
- **Rust**: `cargo audit` (CVEs), `cargo outdated` (staleness)
- **TypeScript**: `npm audit --audit-level=high`, `npm outdated`
- **Shell security**: scans for `curl | sh`, `eval`, unquoted variables, hardcoded secrets
- **License compliance**: `cargo license`, `npx license-checker --summary`

### Makefile Targets

| Target | Purpose |
|--------|---------|
| `make setup` | Install Solana CLI + dependencies |
| `make generate` | Interactive vanity generation |
| `make verify` | Verify a keypair file |
| `make batch` | Batch generation |
| `make quick` | 2-char prefix test |
| `make test` | Full lint + generation + verification |
| `make lint` | ShellCheck on all scripts |
| `make clean` | Secure deletion + confirmation prompt |
| `make help` | Colored help summary |

### Test Orchestration (`test-rust.sh`)

Sequential 10-step test suite:
```bash
1. cargo fmt --check
2. cargo clippy -D warnings
3. cargo build --release
4. cargo test (unit, 10x, --test-threads=1)
5. cargo test integration_tests (10x)
6. cargo test security_tests (10x)
7. cargo test performance_tests
8. cargo bench
9. Dry-run test
10. Real address generation test
```

## Patterns to Follow

- Always start scripts with `set -euo pipefail` for strict error handling
- Source `utils.sh` for consistent logging, validation, and file operations
- Use cross-platform stat commands (Darwin vs Linux)
- Validate all user input character-by-character against the Base58 alphabet
- Set file permissions to 600 using `chmod` immediately after writing keypair files
- Use `shred` with fallback chain for secure deletion
- Support `--json` output for scriptability
- Use color codes but auto-disable when not a TTY (`[[ -t 1 ]]`)
- Quote all variables: `"$var"` not `$var`
- Use `[[ ]]` for conditionals, not `[ ]`
- Trap signals for cleanup: `trap cleanup EXIT INT TERM`

## Common Pitfalls

- macOS uses `stat -f %Lp` while Linux uses `stat -c %a` — always check `$OSTYPE`
- `shred` is not available on macOS — use `gshred` (from coreutils) or `dd` fallback
- `nproc` is not available on macOS — use `sysctl -n hw.ncpu` fallback
- Base58 excludes `0`, `O`, `I`, `l` — scripts must reject these characters
- GPG encryption requires `gpg` in PATH — check availability before offering `--encrypt`
- Job control (`wait`, background processes) behaves differently in subshells
- `umask 077` affects all files created in the session — set it at the start of generation scripts
