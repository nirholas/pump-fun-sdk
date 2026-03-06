# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x.x (latest) | :white_check_mark: Active security updates |
| < 1.0.0 | :x: No longer supported |

---

## Reporting a Vulnerability

**Do NOT report security vulnerabilities through public GitHub issues.**

To report a vulnerability, please email:

**security@pump.fun** (or open a [private security advisory](https://github.com/nirholas/pump-fun-sdk/security/advisories/new) on GitHub)

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected version(s)
- Potential impact assessment
- Suggested fix (if you have one)

### Response Timeline

| Stage | Expected Time |
|-------|---------------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 1 week |
| Patch development | Varies by severity |
| Public disclosure | After fix is released |

We follow [responsible disclosure](https://en.wikipedia.org/wiki/Responsible_disclosure). We will credit reporters in the changelog (unless you prefer anonymity).

---

## Scope

### In Scope

- Vulnerabilities in the `src/` SDK code
- Instruction building logic that could produce malicious transactions
- Private key exposure risks
- Dependency vulnerabilities in production packages
- PDA derivation correctness (wrong accounts could lead to fund loss)
- Fee calculation errors that could cause financial loss

### Out of Scope

- Vulnerabilities in the Pump.fun on-chain programs themselves (report to Pump.fun directly)
- Issues in the Rust or TypeScript vanity generators (these are offline tools)
- Social engineering attacks
- Denial of service against RPC endpoints

---

## Security Considerations

### Private Key Handling

The SDK **never handles private keys** directly. All instruction builders return `TransactionInstruction[]` — signing is always external to the SDK. However, applications using the SDK should:

- **Never log or transmit private keys**
- **Use hardware wallets** for production signing
- **Zeroize key material** after use (fill key arrays with zeros)
- **Set file permissions to `0600`** for any keypair files

### RPC Trust

`OnlinePumpSdk` trusts the RPC endpoint to return correct account data. A malicious RPC could return fabricated state, causing the SDK to build instructions with incorrect parameters. Mitigations:

- **Use trusted RPC providers** (official Solana endpoints, reputable third-party providers)
- **Validate critical state** before executing high-value transactions
- **Compare state** from multiple RPC endpoints for high-value operations
- **Sign transactions offline** after verifying instruction contents

### Financial Math

All financial calculations use `BN` (bn.js) for arbitrary-precision arithmetic. **Never** convert to JavaScript `number` for intermediate calculations:

```typescript
// DANGEROUS — precision loss above 2^53
const amount = Number(bnValue); // DON'T

// SAFE — arbitrary precision
const amount = bnValue.mul(otherBn); // DO
```

### Slippage Protection

Always set appropriate slippage when building buy/sell instructions. The SDK computes slippage-adjusted bounds, but setting slippage to 0 or 1.0 (100%) exposes you to front-running:

```typescript
// DANGEROUS — no slippage protection
slippage: 1.0  // accepts any price

// RECOMMENDED — 1-5% for most trades
slippage: 0.05  // 5% maximum price movement
```

### Fee Sharing Validation

The SDK validates fee sharing configurations client-side before building instructions:

- Shareholders: 1–10
- Share BPS: each > 0
- Total: exactly 10,000 BPS (100%)
- No duplicate addresses

These checks prevent common configuration errors. However, the on-chain program performs its own validation — the SDK checks are a convenience, not a security boundary.

### Dependency Supply Chain

The SDK depends only on well-established, audited packages:

| Dependency | Source | Trust |
|-----------|--------|-------|
| `@solana/web3.js` | Solana Labs | Official |
| `@solana/spl-token` | Solana Labs | Official |
| `@coral-xyz/anchor` | Coral/Anchor | Official |
| `bn.js` | indutny | Widely used, audited |
| `@pump-fun/pump-swap-sdk` | Pump.fun | Official |

**No third-party crypto libraries are used.** All cryptographic operations go through official Solana Labs packages.

### What the SDK Does NOT Do

- **Does not generate keypairs** — Use `@solana/web3.js` `Keypair.generate()` or `solana-keygen`
- **Does not sign transactions** — Signing is your application's responsibility
- **Does not send transactions** — RPC submission is external
- **Does not store state** — All state is fetched fresh from RPC
- **Does not make network calls** (in `PumpSdk` mode) — Fully offline

---

## Security Checklist for SDK Users

- [ ] Use `BN` for all financial amounts — never JavaScript `number`
- [ ] Set slippage to a reasonable value (1–10%) — never 100%
- [ ] Check `bondingCurve.complete` before choosing bonding curve vs AMM instructions
- [ ] Verify fee sharing shares total exactly 10,000 BPS
- [ ] Use trusted RPC endpoints
- [ ] Never log private keys or mnemonics
- [ ] Zeroize key material after use
- [ ] Keep dependencies updated (`npm audit`)
- [ ] Review transaction instructions before signing
