# Solana Wallet — Key Generation, Vanity Addresses & Security

## Skill Description

Generate Solana wallets and vanity addresses securely using only official Solana Labs libraries — with Ed25519 key generation, memory zeroization, file permission hardening, and offline-only operation across Rust, TypeScript, and Shell implementations.

## Context

This toolkit generates Solana Ed25519 keypairs using ONLY official Solana Labs cryptographic libraries. No third-party crypto dependencies are permitted. Keys are output in Solana CLI-compatible JSON format. The toolkit supports vanity address generation (custom prefix/suffix patterns) with multi-threaded search in Rust and single-threaded async search in TypeScript.

## Key Files

### Rust Implementation
- `rust/src/main.rs` — CLI binary with clap-derived arg parser
- `rust/src/generator.rs` — `VanityGenerator` struct, Rayon parallel generation (100K+ keys/sec)
- `rust/src/matcher.rs` — `MatchTarget` enum, `OptimizedMatcher` with pre-lowercased patterns
- `rust/src/output.rs` — `GeneratedAddress`, `write_keypair_file`, `verify_keypair_file`
- `rust/src/security.rs` — `SecureBytes` (zeroize-on-drop), RNG verification, path validation
- `rust/src/config.rs` — `GeneratorConfig`, Base58 validation, difficulty estimation
- `rust/src/lib.rs` — Library root with `generate_with_prefix`, `generate_with_suffix`

### TypeScript Implementation
- `typescript/src/index.ts` — CLI entry point with hand-rolled arg parser
- `typescript/src/lib/generator.ts` — `VanityGenerator` class, async with event-loop yields
- `typescript/src/lib/matcher.ts` — `AddressMatcher` class with normalized patterns
- `typescript/src/lib/output.ts` — `saveKeypair`, `verifyKeypairFile`, `loadKeypair`
- `typescript/src/lib/security.ts` — `clearSensitiveData`, permission checks, root detection
- `typescript/src/lib/validation.ts` — Base58 validation, `estimateAttempts`, difficulty tables
- `typescript/src/lib/types.ts` — `VanityError` class with typed error enum

### Shell Scripts
- `scripts/generate-vanity.sh` — Production `solana-keygen grind` wrapper with GPG encryption
- `scripts/batch-generate.sh` — Parallel batch generator with `--resume` and job control
- `scripts/verify-keypair.sh` — 7-point keypair verification with JSON output mode
- `scripts/utils.sh` — Shared library (logging, Base58 validation, cross-platform stat)

### Verification Tools
- `tools/verify-keypair.ts` — 9-point TypeScript verifier with sign-and-verify test
- `tools/check-file-permissions.sh` — Keypair file permission scanner
- `tools/audit-dependencies.sh` — Multi-ecosystem dependency auditor

## Approved Cryptographic Libraries

| Implementation | Library | Version | Maintainer |
|----------------|---------|---------|------------|
| Rust | `solana-sdk` | 1.18 | Solana Labs |
| TypeScript | `@solana/web3.js` | ^1.91+ | Solana Labs |
| Shell | `solana-keygen` | CLI | Solana Labs |
| MCP Server | `@solana/web3.js` + `tweetnacl` | ^1.98+ | Solana Labs / dchest |

**No other cryptographic dependencies are permitted for key generation.**

## Key Format

Solana CLI-compatible JSON array of 64 bytes:
```json
[174,47,154,16,202,193,206,113,199,190,53,133,169,175,31,56,...]
```
- Bytes 0–31: Ed25519 secret key seed
- Bytes 32–63: Public key (derived from seed)

Load with: `solana config set --keypair keypair.json`

All three implementations (Rust, TypeScript, Shell) produce identical output format.

## Solana Address Format

- **Algorithm**: Ed25519 (twisted Edwards curve)
- **Encoding**: Base58 (alphabet: `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`)
- **Length**: 32–44 characters (typically 43–44)
- **Excluded chars**: `0` (zero), `O` (uppercase O), `I` (uppercase I), `l` (lowercase L)

### Base58 Case Sensitivity

Base58 is case-sensitive. There are 58 characters total (33 lowercase/digit + 25 uppercase). Case-insensitive matching reduces the effective alphabet to ~34 unique characters, making patterns easier to find but less precise.

## Vanity Address Difficulty

| Prefix Length | Case-Sensitive ($58^n$) | Case-Insensitive ($34^n$) | Estimated Time (100K keys/sec) |
|---------------|------------------------|--------------------------|-------------------------------|
| 1 char | 58 | 34 | Instant |
| 2 chars | 3,364 | 1,156 | < 1 sec |
| 3 chars | 195,112 | 39,304 | ~2 sec |
| 4 chars | 11.3M | 1.3M | ~2 min |
| 5 chars | 656M | 45M | ~2 hours |
| 6 chars | 38B | 1.5B | ~4 days |
| 7 chars | 2.2T | 52B | ~250 days |
| 8 chars | 128T | 1.8T | ~40 years |

50% probability of success: $58^n \times \ln(2)$ attempts.

## Security Model

### Defense in Depth

```
Layer 1: Input Validation   — Base58 char check, path traversal prevention, length limits
Layer 2: Crypto Integrity   — RNG quality verification, sign-and-verify post-generation
Layer 3: Memory Safety      — Zeroization (Rust: guaranteed; TS: best-effort)
Layer 4: File Permissions   — 0o600 set before/at write, verified after
Layer 5: Privilege Checks   — Root/elevated detection with warnings
Layer 6: Audit Trail        — Formal security audits, checklists, automated scanning
```

### Memory Zeroization by Language

| Language | Mechanism | Guarantee Level |
|----------|-----------|----------------|
| Rust | `zeroize` crate, `SecureBytes` wrapper, `ZeroizeGuard` RAII | Strong (compiler-respecting) |
| TypeScript | `fill(0)` → `getRandomValues` → `fill(0)` | Best-effort (GC may retain copies) |
| Bash | Not applicable (delegates to solana-keygen) | N/A |

### Post-Generation Verification

**Rust** — `verify_keypair_integrity`:
1. Sign a test message with the keypair
2. Verify the signature against the public key
3. Confirm the public key matches the announced address

**TypeScript** — `verifyKeypairFile`:
1. Re-read the saved JSON file
2. Reconstruct the Keypair from bytes
3. Compare reconstructed public key to expected address

**Shell** — `verify-keypair.sh`:
1. File exists and is readable
2. Permissions are 600/400
3. Valid JSON structure
4. 64-byte array format
5. Public key derivation correctness
6. Optional prefix/suffix match

## Key Generation Flows

### Rust (Multi-Threaded)
```
main() → validate args → warn_if_elevated()
    → MatchTarget::new() → validate_pattern()
    → VanityGenerator::new(target, config)
        → verify_rng_quality()
        → build Rayon thread pool (N threads)
    → generate_with_callback(progress_fn)
        → (0..MAX).into_par_iter().find_any(|| {
              Keypair::new() → pubkey.to_string() → matcher.matches()
          })
    → write_keypair_file() → secure_write_file(mode 0600)
    → optional: verify_keypair_file(), write_report()
    → zeroize all key material
```

### TypeScript (Single-Threaded Async)
```
main() → parseArgs() → validateVanityInput()
    → new VanityGenerator(options)
        → new AddressMatcher()
    → generator.generate()
        → while (attempts < max) {
              Keypair.generate() → publicKey.toBase58() → matcher.matches()
              if (attempts % 10000 === 0) await setImmediate(); // yield
          }
    → saveKeypair(secretKey, path) → writeFile + chmod 600
    → optional: verifyKeypairFile()
    → clearSensitiveData(secretKey)
```

### Shell (solana-keygen Wrapper)
```
generate-vanity.sh → source utils.sh
    → validate Base58 chars (character-by-character)
    → estimate difficulty → display to user
    → solana-keygen grind --starts-with <prefix> --threads N
    → chmod 600 <output>
    → optional: --backup (timestamped copy), --encrypt (GPG)
    → verify-keypair.sh <output>
```

## Patterns to Follow

- NEVER add non-official cryptographic dependencies
- Always zeroize key material after use (language-appropriate method)
- Maintain Solana CLI output format compatibility (JSON array of 64 u8s)
- Set file permissions to `0600` before or at the point of write (never after)
- Verify RNG quality before generation (Rust implementation)
- Verify generated keypair integrity via sign-and-verify before saving
- Validate all input patterns against Base58 alphabet character-by-character
- Warn but do not block execution when running as root/elevated
- Test across all implementations (Rust, TypeScript, Shell) for format compatibility

## Common Pitfalls

- Not zeroizing keypair bytes from memory after saving
- Writing keypair files with default permissions (world-readable) before calling chmod
- Using non-official Ed25519 implementations (e.g., tweetnacl for key generation instead of @solana/web3.js)
- Case sensitivity in vanity matching — Base58 IS case-sensitive by default
- Characters `0`, `O`, `I`, `l` are NOT in the Base58 alphabet — must be rejected in input
- JavaScript's GC may retain copies of key material — best-effort clearing is documented, not guaranteed
- `shred` for secure deletion is not available on all systems (macOS needs `gshred`)
- Difficulty scales exponentially: each additional character multiplies search time by 58x
- Prefix + suffix combined difficulty is multiplicative, not additive
