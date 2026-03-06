# Security Guide

A developer-facing guide to the security model, practices, and requirements for working with the Pump SDK.

## Core Principles

### 1. Official Crypto Only

Every cryptographic operation uses **official Solana Labs libraries** — no exceptions:

| Language | Library | Usage |
|----------|---------|-------|
| Rust | `solana-sdk` | Key generation, signing, Ed25519 |
| TypeScript | `@solana/web3.js` | `Keypair.generate()`, signing |
| Shell | `solana-keygen` | CLI key generation |

Never add third-party crypto packages. If you're reviewing a PR that introduces one, reject it.

### 2. Key Material Lifecycle

```
Generate → Use → Zeroize
         ↘ (Optional) Write to file with 0600
```

- **Generate** using CSPRNG only (`Keypair.generate()`, `solana_sdk::signer::keypair::Keypair::new`)
- **Use** immediately or store securely
- **Zeroize** from memory as soon as possible
- **Never** log, print, or return private keys through any API

### 3. Offline Key Generation

All key generation is fully offline. No network calls happen during:
- Keypair creation
- Vanity address searching
- Key file writing
- Signature creation

This eliminates an entire class of exfiltration attacks.

---

## SDK Security

### BN.js for All Financial Math

All token amounts and SOL values use `BN` (bn.js) — never JavaScript `number`:

```typescript
// ✅ Correct
const amount = new BN(1_000_000);
const solAmount = new BN(0.5 * 1e9);

// ❌ Wrong — precision loss
const amount = 1_000_000;
const solAmount = 500_000_000;
```

JavaScript `number` uses IEEE 754 doubles, which lose precision above `2^53`. Token operations routinely exceed this.

### Input Validation

The SDK validates:
- **Public keys** — must be valid Base58-encoded Ed25519 points
- **Vanity patterns** — must use valid Base58 characters (no `0`, `O`, `I`, `l`)
- **BN amounts** — bounds-checked to prevent overflow
- **Slippage** — validated for reasonable ranges (0–100%)
- **Fee shares** — must total exactly 10,000 BPS

### Transaction Safety

- Instruction builders return `TransactionInstruction[]`, never signed transactions
- Signing is always the caller's responsibility
- No private keys enter the SDK — only `PublicKey` references

---

## Vanity Generator Security

### Rust Implementation

The Rust generator uses several hardened patterns:

```rust
// SecureBytes wrapper zeroizes on drop
struct SecureBytes(Vec<u8>);
impl Drop for SecureBytes {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}
```

Key security measures:
- **`zeroize` crate** — memory is cleared when key material is dropped
- **No `unsafe` blocks** without explicit justification
- **File permissions** — `0600` set immediately on file creation
- **No debug output** of secret key bytes
- **Rayon threading** — each thread has independent CSPRNG state

### TypeScript Implementation

```typescript
// File permissions set on write
fs.writeFileSync(filepath, data, { mode: 0o600 });
```

- Uses `Keypair.generate()` from `@solana/web3.js` (CSPRNG-backed)
- Output files get `0600` permissions
- No key material in console output

### Shell Scripts

```bash
# Always set restrictive permissions
chmod 600 "$KEYPAIR_FILE"

# Validate inputs to prevent injection
if [[ ! "$PREFIX" =~ ^[1-9A-HJ-NP-Za-km-z]+$ ]]; then
    echo "Invalid Base58 characters"
    exit 1
fi
```

- Input sanitization prevents shell injection
- Path traversal is blocked
- `solana-keygen grind` runs fully offline

---

## MCP Server Security

The MCP server exposes SDK functionality to AI agents. Security constraints:

1. **No private key exposure** — tools accept public keys only
2. **Read-only resources** — account state is fetched but never modified
3. **No signing** — the server builds instructions; signing happens client-side
4. **Input validation** — all tool parameters are validated before use

---

## File Permissions

Every generated keypair file must have `0600` permissions:

```bash
# Verify permissions
ls -la keypair.json
# Should show: -rw------- (owner read/write only)

# Fix if needed
chmod 600 keypair.json
```

The `tools/check-file-permissions.sh` script audits all `.json` keypair files.

---

## Dependency Management

### Auditing

```bash
# TypeScript
npm audit

# Rust
cargo audit
```

Both run automatically in CI on every PR and weekly.

### Rules

- All dependencies must be from trusted sources
- Versions are pinned appropriately
- No unused dependencies
- High-severity vulnerabilities block PRs

---

## Security Testing

### Quick Check

```bash
# Run security-specific tests
cd rust && cargo test --test security_tests
cd typescript && npm test

# Check for secret key leaks in output
grep -r "secret\|private" src/ --include="*.ts" | grep -v "test\|spec\|\.d\.ts"

# Verify file permissions
./tools/check-file-permissions.sh
```

### Full Audit

The 60+ item [SECURITY_CHECKLIST.md](../security/SECURITY_CHECKLIST.md) covers:

| Category | Items |
|----------|-------|
| Code review | No hardcoded secrets, no debug logging |
| Input validation | Base58, path traversal, shell injection |
| Output security | File permissions, no key leaks |
| Cryptographic safety | Official libs, CSPRNG, Ed25519 |
| Memory safety | Zeroization, no leaks, SecureBytes |
| Dependencies | Audit, pin, minimize |
| Testing | Fuzz, edge cases, cross-implementation |

---

## Reporting Vulnerabilities

1. **Do NOT** open a public GitHub issue
2. Use [GitHub Security Advisories](https://github.com/nirholas/pump-fun-sdk/security/advisories)
3. Or contact the maintainer directly via GitHub profile
4. Allow up to 90 days for a fix before disclosure

See [SECURITY.md](../SECURITY.md) for the full policy.

---

## Related

- [SECURITY.md](../SECURITY.md) — Vulnerability reporting policy
- [SECURITY_CHECKLIST.md](../security/SECURITY_CHECKLIST.md) — 60+ item pre-release checklist
- [Testing Guide](./testing.md) — Security test commands
- [Architecture](./architecture.md) — System design overview
