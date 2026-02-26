# Security Checklist

A comprehensive security checklist for the Solana Vanity Address Generator before release.

## Before Release

### Code Review
- [ ] All code reviewed by at least one other person
- [ ] No hardcoded secrets or test keys
- [ ] No debug logging in production code
- [ ] All TODO/FIXME items resolved
- [ ] No commented-out code with sensitive operations

### Input Validation
- [ ] All user inputs validated
- [ ] Invalid Base58 characters rejected (0, O, I, l)
- [ ] Path traversal prevented
- [ ] Shell injection prevented (CLI scripts)
- [ ] Reasonable length limits enforced (max prefix/suffix length)
- [ ] Unicode handling is secure
- [ ] Whitespace is properly handled

### Output Security
- [ ] File permissions set to 0600 (owner read/write only)
- [ ] No secret keys in logs
- [ ] No secret keys in error messages
- [ ] Output format verified (JSON array of 64 bytes)
- [ ] File integrity verified after write
- [ ] Existing files not overwritten without explicit flag

### Cryptographic Safety
- [ ] Using official Solana libraries only (`solana-sdk`, `@solana/web3.js`)
- [ ] No custom cryptography implementations
- [ ] RNG quality verified (uses CSPRNG)
- [ ] Keypair validity verified after generation
- [ ] Public key derivation is correct (Ed25519)
- [ ] Generated addresses can sign and verify

### Memory Safety
- [ ] Rust: No unsafe code without justification
- [ ] Rust: Zeroization implemented via `zeroize` crate
- [ ] TypeScript: Sensitive data cleared where possible
- [ ] No memory leaks in long-running operations
- [ ] SecureBytes wrapper used for sensitive data (Rust)
- [ ] Debug output never reveals secrets

### Dependencies
- [ ] `cargo audit` passes (Rust)
- [ ] `npm audit` passes (TypeScript)
- [ ] All dependencies are necessary (no unused deps)
- [ ] Dependencies are from trusted sources
- [ ] Dependency versions are pinned appropriately
- [ ] No known vulnerabilities in dependency tree

### Testing
- [ ] All tests pass consistently (10+ runs)
- [ ] Edge cases tested
- [ ] Error conditions tested
- [ ] Fuzz testing completed
- [ ] Performance benchmarks recorded
- [ ] Cross-implementation compatibility verified
- [ ] Security-specific tests pass

### Documentation
- [ ] Security considerations documented
- [ ] Secure usage instructions provided
- [ ] Known limitations documented
- [ ] Warning about running as root
- [ ] File permission requirements documented

---

## Security Test Commands

### Run All Security Checks

```bash
# Run comprehensive security tests
./run-all-tests.sh 10

# Rust-specific checks
cd rust
cargo audit
cargo clippy -- -D warnings
cargo test --release

# TypeScript-specific checks
cd typescript
npm audit
npm run lint
npm test
```

### Verify Generated Keypairs

```bash
# Verify a keypair is valid
./tools/verify-keypair.sh /path/to/keypair.json

# Check file permissions
./tools/check-file-permissions.sh

# Test with solana-keygen
solana-keygen pubkey /path/to/keypair.json
```

---

## Security Contacts

For security vulnerabilities, please:
1. DO NOT open a public issue
2. Email security concerns privately
3. Allow 90 days for fix before disclosure

---

## Audit History

| Date | Auditor | Scope | Result |
|------|---------|-------|--------|
| 2026-01-19 | Agent 4 | CLI Scripts | ✅ PASS |
| 2026-01-19 | Agent 4 | Rust Implementation | ✅ PASS |
| 2026-01-19 | Agent 4 | TypeScript Implementation | ✅ PASS |

---

## Critical Security Findings to Verify

### 1. Secret Key Exposure
- [ ] Search all code for potential key logging
- [ ] Verify error messages don't contain keys
- [ ] Check debug output redacts secrets
- [ ] Test verbose mode doesn't leak keys

### 2. File Permission Vulnerabilities
- [ ] Test on different systems (Linux, macOS)
- [ ] Verify umask doesn't override permissions
- [ ] Test in containers/restricted environments
- [ ] Verify permissions before AND after write

### 3. Input Injection
- [ ] Test shell injection in CLI (`; rm -rf /`)
- [ ] Test path traversal (`../../../etc/passwd`)
- [ ] Test command substitution (`$(whoami)`)
- [ ] Test variable expansion (`${HOME}`)

### 4. Cryptographic Issues
- [ ] Verify RNG uses system CSPRNG
- [ ] Verify correct library usage
- [ ] Test keypair can sign/verify messages
- [ ] Verify public key matches expected derivation

### 5. Memory Issues
- [ ] Rust: grep for `unsafe` blocks
- [ ] Check for memory leaks with valgrind (Rust)
- [ ] Verify zeroization on drop
- [ ] Test long-running operations for leaks
