---
name: pump-security
description: "Defense-in-depth security across Rust, TypeScript, and Bash for the Pump SDK — cryptographic key handling, memory zeroization, secure file I/O, input validation, privilege management, dependency auditing, and a 60+ item security checklist."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
---

# Security Practices — Cryptographic Safety, Memory Zeroization & Hardened I/O

Defense-in-depth security across Rust, TypeScript, and Bash: key handling, memory zeroization, secure file I/O, input validation, privilege management, and dependency auditing.

## Memory Zeroization

### Rust
```rust
use zeroize::Zeroize;

struct SecureBytes(Vec<u8>);

impl Drop for SecureBytes {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}
```

### TypeScript
```typescript
try {
    // ... use secretKey
} finally {
    secretKey.fill(0);
    // Best-effort: GC may have copied the buffer
}
```

### Shell
```bash
shred -u "$keypair_file" 2>/dev/null || rm -P "$keypair_file"
```

## RNG Quality

| Language | Source | Verification |
|----------|--------|-------------|
| Rust | `OsRng` | Verify via `solana-sdk` internals |
| TypeScript | `crypto.getRandomValues` | Node.js built-in CSPRNG |
| Shell | `solana-keygen` | Delegates to Rust `OsRng` |

## Keypair Integrity Verification

1. Re-derive public key from secret key
2. Compare derived key with stored public key
3. Sign a test message with the keypair
4. Verify the signature with the public key
5. Validate Base58 encoding roundtrip

## Secure File I/O

- Set permissions to `0o600` before writing content (race-free on Unix)
- Use `O_CREAT | O_EXCL` to prevent overwrites
- Write to temp file + atomic rename for crash safety
- Never write secret keys to stdout unless explicitly requested

## Input Validation

| Input | Validation |
|-------|-----------|
| Base58 address | Regex: `^[1-9A-HJ-NP-Za-km-z]{32,44}$` |
| File paths | Reject `..`, prevent traversal |
| Tool inputs | Zod schemas in MCP server |
| Shell arguments | Quoted variables, no eval |

## Security Checklist Summary (60+ items)

Key categories:
- Cryptographic library allowlist
- Memory zeroization in all code paths
- File permission enforcement
- Input validation and sanitization
- Error message information leakage prevention
- Dependency auditing (`cargo audit`, `npm audit`)
- No network calls during key generation
- Secret key never in logs, error messages, or telemetry

## Attack Vectors to Test

| Vector | Defense |
|--------|---------|
| Weak RNG | Only CSPRNG (OsRng / crypto.getRandomValues) |
| Memory dump | Zeroize on drop/finally |
| File permission leak | 0o600 enforcement |
| Path traversal | Input validation |
| Shell injection | Quoted variables, no eval |
| Dependency supply chain | cargo audit, npm audit |

## Patterns to Follow

- Always use approved crypto libraries: `solana-sdk`, `@solana/web3.js`, `solana-keygen`
- Zeroize key material in all code paths (success, error, early return)
- Set file permissions before writing content
- Validate all inputs at the boundary (CLI args, API inputs, file paths)
- Never log or display secret keys
- Run dependency audits in CI

## Common Pitfalls

- JavaScript `fill(0)` is best-effort — GC may relocate buffers
- Rust `String` types may leave copies in memory — use `Vec<u8>` with `Zeroize`
- `chmod` after `write` has a race window — prefer `fchmod` or umask
- Error messages must not include secret key material
- `cargo audit` may miss recently disclosed CVEs — supplement with manual review
