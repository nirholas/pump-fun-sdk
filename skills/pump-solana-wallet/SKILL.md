---
name: pump-solana-wallet
description: "Secure Solana wallet generation using official Solana Labs libraries — Ed25519 keypairs, memory zeroization, vanity address generation, offline-only operation, and multi-language implementations (Rust, TypeScript, Bash)."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
    requires:
      bins:
        - solana-keygen
---

# Solana Wallet — Key Generation & Security

Secure Solana wallet generation using official Solana Labs libraries with Ed25519 keys, memory zeroization, and offline-only operation. Three implementations: Rust (production), TypeScript (educational), and Bash (wrappers).

## Approved Crypto Libraries

| Context | Library | Role |
|---------|---------|------|
| Rust | `solana-sdk` | `Keypair::new()`, `Signer` trait, Base58 encoding |
| TypeScript | `@solana/web3.js` | `Keypair.generate()`, `Keypair.fromSecretKey()` |
| Shell | `solana-keygen` | `grind` (vanity), `new` (random), `verify` |
| MCP Server | `@solana/web3.js` | Session keypair management in `SolanaWalletMCPServer` |

## Address Format

- 32-byte Ed25519 public key encoded as Base58
- Length: 32–44 characters (typically 43–44)
- Case-sensitive alphabet: `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`

## Vanity Address Difficulty

| Prefix Length | Expected Attempts | Time (100K/sec) |
|---------------|-------------------|-----------------|
| 1 char | ~58 | < 1 sec |
| 2 chars | ~3,364 | < 1 sec |
| 3 chars | ~195,112 | ~2 sec |
| 4 chars | ~11.3M | ~2 min |
| 5 chars | ~656M | ~2 hours |

## Security Model (6 Defense Layers)

1. **CSPRNG only** — `OsRng` (Rust), `crypto.getRandomValues` (Node.js)
2. **Official libraries** — No third-party crypto
3. **Memory zeroization** — `Zeroize` trait (Rust), `buffer.fill(0)` (TypeScript)
4. **File permissions** — `0o600` owner-only
5. **Offline operation** — No network calls during key generation
6. **Post-generation verification** — Re-derive public key from secret and compare

## Memory Zeroization by Language

| Language | Mechanism |
|----------|-----------|
| Rust | `Zeroize` trait + `Drop` impl, `zeroize_on_drop` |
| TypeScript | `secretKey.fill(0)` + `Buffer.alloc(0)` (best-effort, GC may relocate) |
| Shell | `shred -u` or `rm -P` for file cleanup |

## Patterns to Follow

- ONLY use `solana-sdk`, `@solana/web3.js`, or `solana-keygen` for crypto operations
- Zero all key material as soon as it is no longer needed
- Set file permissions to `0o600` immediately after writing keypair files
- Never make network calls during key generation
- Verify every generated keypair: re-derive public key from secret and compare

## Common Pitfalls

- JavaScript GC may copy/relocate buffers — `fill(0)` is best-effort, not guaranteed
- `solana-keygen` output is [u8; 64] JSON array (32-byte secret + 32-byte public)
- Base58 is NOT the same as Base64 — Solana uses a specific alphabet without `0OIl`
- Vanity matching must use raw Base58 — case-sensitive, no regex anchoring errors
