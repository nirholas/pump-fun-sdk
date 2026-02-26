# Security Practices — Cryptographic Safety, Memory Zeroization & Hardened I/O

## Skill Description

Implement and audit security practices across all layers: cryptographic key handling, memory zeroization, secure file I/O, input validation, privilege management, and dependency auditing — across Rust, TypeScript, and Bash codebases.

## Context

This project deals with Solana private keys — high-value cryptographic material. Security failures can lead to immediate, irreversible fund loss. The codebase implements defense-in-depth across three languages with formal security audits, automated checking, and documented threat models.

## Key Files

### Security Implementations
- `rust/src/security.rs` — Rust security layer (zeroize, RNG, file permissions, privilege checks)
- `typescript/src/lib/security.ts` — TypeScript security utilities (best-effort clearing, checks)
- `mcp-server/src/utils/crypto.ts` — MCP server crypto helpers (zeroize, ID generation)
- `mcp-server/src/utils/validation.ts` — Zod-based input validation schemas
- `scripts/utils.sh` — shell security utilities (permissions, secure delete)

### Security Audits
- `security/SECURITY_CHECKLIST.md` — 60+ item pre-release checklist
- `security/audit-cli.md` — formal CLI script audit (PASS)
- `security/audit-rust.md` — formal Rust audit (PASS, zero vulnerabilities)
- `security/audit-typescript.md` — formal TypeScript audit (PASS with notes)
- `SECURITY.md` — responsible disclosure policy

### Security Tests
- `rust/tests/security_tests.rs` — Rust security test suite
- `tests/security/` — cross-language security tests
- `tools/audit-dependencies.sh` — dependency vulnerability scanner
- `tools/check-file-permissions.sh` — file permission scanner

## Key Concepts

### Memory Zeroization

**Rust (strongest guarantees):**
```rust
// SecureBytes wrapper with automatic zeroization on drop
struct SecureBytes(Vec<u8>);
impl Drop for SecureBytes {
    fn drop(&mut self) { self.0.zeroize(); }
}

// RAII guard for borrowed slices
struct ZeroizeGuard<'a>(&'a mut [u8]);
impl Drop for ZeroizeGuard<'_> {
    fn drop(&mut self) { self.0.zeroize(); }
}

// Debug impl never prints key material
impl fmt::Debug for SecureBytes {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "[REDACTED]")
    }
}
```

**TypeScript (best-effort, documented limitation):**
```typescript
function clearSensitiveData(data: Uint8Array): void {
    data.fill(0);                    // Zero out
    crypto.getRandomValues(data);    // Random fill (prevent optimizer removal)
    data.fill(0);                    // Zero again
}
// Note: JavaScript GC may retain copies — documented risk
```

**MCP Server (shutdown zeroization):**
```typescript
// On SIGINT/SIGTERM, zeroize all session keypairs
for (const [id, keypair] of state.generatedKeypairs) {
    zeroize(keypair.secretKey);
}
```

### RNG Quality Verification

Before generating any keypair, the Rust implementation verifies RNG quality:
```rust
fn verify_rng_quality() -> Result<()> {
    let keypairs: Vec<Keypair> = (0..10).map(|_| Keypair::new()).collect();
    // Check: no duplicate keypairs
    // Check: each public key has ≥ 10 unique Base58 characters (entropy)
}
```

### Keypair Integrity Verification

Post-generation sign-and-verify test:
```rust
fn verify_keypair_integrity(keypair: &Keypair) -> Result<()> {
    let message = b"solana-vanity-verification-test";
    let signature = keypair.sign_message(message);
    assert!(signature.verify(&keypair.pubkey().to_bytes(), message));
}
```

### Secure File I/O

**File creation (Rust):**
```rust
fn secure_write_file(path: &Path, data: &[u8]) -> Result<()> {
    // 1. Validate path (reject /etc/, /usr/, /sys/)
    // 2. Create parent directories
    // 3. Open with mode 0o600 (owner read/write only)
    // 4. Write data
    // 5. Flush + sync
    // 6. Verify file size matches data length
}
```

**File permission validation:**
- Rust: `(mode & 0o077) == 0` (no group/other access)
- Bash: `stat -c %a` (Linux) or `stat -f %Lp` (macOS), expect `600`
- TypeScript: `fs.statSync(path).mode & 0o077 === 0`

**Secure deletion:**
```bash
secure_delete() {
    shred -vfz -n 3 "$file" 2>/dev/null ||    # GNU shred
    gshred -vfz -n 3 "$file" 2>/dev/null ||   # macOS coreutils
    dd if=/dev/urandom of="$file" bs=1024 count=$(stat -c%s "$file" 2>/dev/null) # fallback
    rm -f "$file"
}
```

### Input Validation

**Base58 alphabet enforcement:**
- Valid: `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`
- Invalid (excluded): `0` (zero), `O` (uppercase O), `I` (uppercase I), `l` (lowercase L)
- Character-by-character validation in all three languages

**Path traversal prevention (Rust):**
```rust
fn validate_path(path: &Path) -> Result<()> {
    let canonical = path.canonicalize()?;
    for forbidden in ["/etc", "/usr", "/sys", "/proc", "/dev"] {
        if canonical.starts_with(forbidden) { return Err(...); }
    }
}
```

**Zod schemas (MCP server):**
```typescript
const solanaAddressSchema = z.string().min(32).max(44).regex(/^[1-9A-HJ-NP-Za-km-z]+$/);
const prefixSchema = z.string().max(6).regex(/^[1-9A-HJ-NP-Za-km-z]+$/);
```

**Shell injection prevention:**
- All variables double-quoted: `"$var"`
- No `eval` usage
- No `curl | sh` patterns
- `set -euo pipefail` at script start

### Privilege Management

```rust
fn warn_if_elevated() {
    if nix::unistd::geteuid().is_root() {
        eprintln!("WARNING: Running as root is not recommended");
    }
}
```

```typescript
function isRunningAsRoot(): boolean {
    return process.getuid?.() === 0;
}
```

### Error Message Security

Error messages never contain:
- Private key material
- Full file paths to sensitive files (internal paths are acceptable)
- RPC endpoint URLs with credentials
- Seed phrases or mnemonics

### Dependency Auditing

Multi-language automated audit:
```bash
# Rust
cargo audit                    # CVE database check
cargo outdated                 # Version freshness

# TypeScript
npm audit --audit-level=high   # npm advisory check
npm outdated                   # Version freshness

# Shell
grep -r 'curl.*|.*sh' .       # Pipe-to-shell detection
grep -r 'eval ' .             # eval usage detection
```

## Security Checklist Summary (60+ Items)

### Code Review
- [ ] No hardcoded private keys or secrets
- [ ] All cryptographic operations use official Solana libraries
- [ ] No custom crypto implementations

### Input Validation
- [ ] Base58 character validation on all user input
- [ ] Path traversal prevention
- [ ] Shell injection prevention
- [ ] Unicode normalization/rejection

### Output Security
- [ ] File permissions set to 600
- [ ] Private keys never in log output
- [ ] Debug trait prints `[REDACTED]`

### Memory Safety
- [ ] Rust: `zeroize` on all key material, no `unsafe` blocks
- [ ] TypeScript: best-effort clearing documented
- [ ] RAII guards for temporary key buffers

### Attack Vectors to Test
```
; rm -rf /
$(whoami)
../../../etc/passwd
0OIl (invalid Base58)
<script>alert(1)</script>
```

## Patterns to Follow

- Defense-in-depth: validate at input, during processing, and at output
- Never log, print, or serialize private keys outside of intentional tool results
- Always set file permissions before writing key material (not after)
- Use official Solana libraries for all crypto — never implement Ed25519 manually
- Document memory-clearing limitations (JavaScript GC) rather than hiding them
- Verify generated keypairs with sign-and-verify before saving
- Warn on elevated privileges but don't block execution
- Use typed error classes, never expose key material in error messages

## Common Pitfalls

- Setting `chmod 600` after writing creates a window where the file is world-readable
- JavaScript's `Uint8Array.fill(0)` may be optimized away by the engine — follow with random fill
- Rust's `String::from()` copies data — the original buffer still needs zeroization
- `console.log` in the MCP server would leak data to stdout (the protocol channel)
- `shred` doesn't work on all filesystems (journaled, copy-on-write, SSD with TRIM)
- Base58 validation must check each character individually — regex alone may miss edge cases
