# Security Policy

## Overview

pump-fun-sdk is an unofficial community PumpFun SDK for the Pump protocol on Solana. It handles bonding curve trading, fee management, keypair generation, and AI agent integration. Security is foundational — not optional.

---

## Reporting a Vulnerability

If you discover a security issue, please report it responsibly:

1. **Do NOT** open a public issue
2. **Use GitHub's private security advisory**: Go to the [Security tab](https://github.com/nirholas/pump-fun-sdk/security/advisories) → "Report a vulnerability"
3. **Or email**: Contact the maintainer directly via GitHub profile
4. **Include**:
   - Steps to reproduce the vulnerability
   - Potential impact assessment
   - Suggested fix (if you have one)
5. **Allow** reasonable time (up to 90 days) for a fix before disclosure

We take every report seriously and will respond within 48 hours.

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x (latest) | ✅ Active |
| < 1.0 | ❌ Not supported |

---

## Security Principles

### 1. Official Libraries Only

We use **ONLY** official Solana Labs cryptographic libraries:

| Language | Library | Source |
|----------|---------|--------|
| Rust | `solana-sdk` | [github.com/solana-labs/solana](https://github.com/solana-labs/solana) |
| TypeScript | `@solana/web3.js` | [github.com/solana-labs/solana-web3.js](https://github.com/solana-labs/solana-web3.js) |
| Shell | `solana-keygen` | Official Solana CLI |

**No third-party cryptographic code is used. Ever.**

### 2. Key Material Handling

- Private keys are **zeroized from memory** after use
- Keypair files are created with **0600 permissions** (owner read/write only)
- Private keys are **never logged**, printed, or written to stdout
- The MCP server never exposes private keys through resources

### 3. Input Validation

- All public key inputs are validated as proper Base58
- Vanity patterns are validated against the Base58 character set
- BN amounts are bounds-checked to prevent overflow
- Slippage parameters are validated for reasonable ranges

### 4. No Network During Key Generation

Key generation is fully offline. No network calls are made during:
- Keypair creation
- Vanity address searching
- Key file writing
- Signature creation

---

## Security Audits

Internal security audits are documented in the `security/` directory:

| Audit | Scope | Document |
|-------|-------|----------|
| CLI Operations | Shell scripts, file I/O | [audit-cli.md](security/audit-cli.md) |
| Rust Generator | Key generation, memory safety | [audit-rust.md](security/audit-rust.md) |
| TypeScript Generator | Key generation, file permissions | [audit-typescript.md](security/audit-typescript.md) |
| Full Checklist | 60+ item security checklist | [SECURITY_CHECKLIST.md](security/SECURITY_CHECKLIST.md) |

---

## CI/CD Security

- **npm audit** runs on every PR and weekly
- **cargo audit** checks Rust dependencies for known vulnerabilities
- **CodeQL** performs static analysis on TypeScript code
- **Dependency review** blocks PRs that introduce high-severity vulnerabilities
- **Keypair detection** prevents accidental commit of private key files

---

## Best Practices for Users

1. **Never commit keypair files** to version control
2. **Store backups** of keypair files in secure, offline locations
3. **Test on devnet** before mainnet
4. **Review transactions** before signing
5. **Keep dependencies updated** — run `npm audit` regularly
6. **Use the security checklist** in `security/SECURITY_CHECKLIST.md`

---

## Scope

The following are in scope for security reports:

- Core SDK (`src/`)
- Rust vanity generator (`rust/`)
- TypeScript vanity generator (`typescript/`)
- MCP server (`mcp-server/`)
- Shell scripts (`scripts/`)
- CI/CD configurations

The following are out of scope:

- Third-party dependencies (report upstream)
- The Pumpfun on-chain programs themselves
- Phishing or social engineering attacks

---

## Acknowledgments

We appreciate security researchers who help keep pump-fun-sdk safe. Reporters of valid vulnerabilities will be credited in [ACKNOWLEDGMENTS.md](ACKNOWLEDGMENTS.md) (with permission).

