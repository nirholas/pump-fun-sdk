# Rust Vanity Address Generator — High-Performance Multi-Threaded Keypair Generation

## Skill Description

Build, optimize, and extend the `solana-vanity` Rust binary — a production-grade, multi-threaded Solana vanity address generator that produces Ed25519 keypairs matching user-specified prefix/suffix patterns, with security-hardened file output compatible with the Solana CLI.

## Context

The Rust vanity generator is the high-performance implementation in the toolkit, achieving 100K+ keys/second using Rayon's parallel iterator framework. It generates Solana keypairs whose Base58-encoded public key starts with, ends with, or contains specific character patterns. Output files are Solana CLI-compatible JSON arrays of 64 bytes.

## Key Files

- `rust/src/main.rs` — CLI entry point (clap-derived argument parser)
- `rust/src/generator.rs` — core multi-threaded generation engine
- `rust/src/matcher.rs` — pattern matching (prefix/suffix/both, case-insensitive)
- `rust/src/config.rs` — validation, Base58 constants, difficulty estimation
- `rust/src/security.rs` — secure file I/O, memory zeroization, RNG verification
- `rust/src/output.rs` — keypair serialization, reports, verification
- `rust/src/lib.rs` — library root with convenience functions
- `rust/Cargo.toml` — crate configuration with release optimizations
- `rust/benches/generation_bench.rs` — Criterion benchmarks
- `rust/tests/` — integration, performance, and security tests

## Key Concepts

### Architecture

```
main.rs (CLI)
  ├─ config.rs (validation & estimation)
  ├─ generator.rs (Rayon thread pool)
  │   ├─ matcher.rs (pattern matching)
  │   └─ security.rs (RNG verify, keypair integrity)
  └─ output.rs (file I/O, reports)
```

### CLI Arguments

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --prefix` | Match address start | — |
| `-s, --suffix` | Match address end | — |
| `-i, --ignore-case` | Case-insensitive matching | false |
| `-t, --threads` | Thread count | all CPUs |
| `-o, --output` | Output file path | `<ADDRESS>.json` |
| `-c, --count` | Generate N addresses | 1 |
| `-v, --verbose` | Detailed progress | false |
| `-q, --quiet` | Minimal output (pubkey only) | false |
| `--verify` | Post-generation key verification | false |
| `--dry-run` | Difficulty estimate only | false |
| `--report` | Generate `.txt` report | false |
| `--overwrite` | Overwrite existing files | false |

### Generation Engine

The hot loop uses Rayon's `par_iter` with early termination:

```rust
(0..usize::MAX)
    .into_par_iter()
    .find_any(|_| {
        let keypair = Keypair::new();
        let address = keypair.pubkey().to_string();
        if matcher.matches(&address) {
            // Store result, signal completion
            return true;
        }
        false
    });
```

Key design decisions:
- `find_any` (not `find_first`) — returns the first match found by any thread, not the lowest index
- `AtomicBool` cancel flag for Ctrl+C propagation via a dedicated signal handler thread
- `AtomicU64` attempt counter with `Relaxed` ordering for progress reporting
- Result stored in `Arc<Mutex<Option<GeneratedAddress>>>`

### Pattern Matching

The `OptimizedMatcher` pre-computes lowercased patterns for case-insensitive matching:

```rust
match &self.target {
    MatchTarget::Prefix(p) => address.starts_with(p),
    MatchTarget::Suffix(s) => address.ends_with(s),
    MatchTarget::Both(p, s) => address.starts_with(p) && address.ends_with(s),
}
```

For case-insensitive: lowercases only the address slice (not the full address) against the pre-lowercased pattern.

### Difficulty Estimation

Expected attempts for a pattern of length $n$:
- Case-sensitive: $58^n$ (Base58 alphabet size)
- Case-insensitive: $34^n$ (unique case-folded characters)

50% success probability: $58^n \times \ln(2)$

### Security Features

| Feature | Implementation |
|---------|---------------|
| Memory zeroization | `SecureBytes` wrapper with `zeroize` on `Drop` |
| RAII cleanup | `ZeroizeGuard` for `&mut [u8]` slices |
| RNG quality check | Generates 10 keypairs, checks for duplicates and low entropy |
| Keypair integrity | Sign-and-verify test message after generation |
| File permissions | `OpenOptions::mode(0o600)` before write (Unix only) |
| Path validation | Rejects system dirs (`/etc/`, `/usr/`, `/sys/`) |
| Privilege warning | Detects `euid == 0` and warns |
| Debug safety | `GeneratedAddress::fmt` prints `[REDACTED]` for secret key |

### Output Format

Solana CLI-compatible JSON array of 64 bytes (32 secret + 32 public):
```json
[42,15,201,...64 numbers total...]
```

### Release Profile

```toml
[profile.release]
lto = true           # Link-time optimization
codegen-units = 1    # Single codegen unit for better optimization
strip = true         # Strip debug symbols
panic = "abort"      # No unwinding overhead
```

## Patterns to Follow

- Use `thiserror` for error types, not manual `impl Display`
- All cryptographic operations use `solana-sdk` (`Keypair::new()`) — never roll custom crypto
- Use `rayon` thread pools — never spawn raw `std::thread` for generation
- File writes go through `secure_write_file` in `security.rs` — never use `std::fs::write` directly
- Progress reporting uses `AtomicU64` with `Relaxed` ordering — no need for `SeqCst`
- Always verify RNG quality before starting generation
- The `--dry-run` flag should benchmark keys/sec and display a probability table

## Common Pitfalls

- Base58 validity: characters `0`, `O`, `I`, `l` are NOT in the Base58 alphabet — validate all input patterns
- `find_any` may return after other threads have done extra work — don't assume exact attempt counts
- `MAX_PREFIX_LENGTH = 8` and `MAX_SUFFIX_LENGTH = 8` — patterns longer than this are computationally infeasible
- File permission checks are Unix-only — Windows doesn't support `mode(0o600)`
- The `shred` command for secure deletion may not be available on all systems
- Benchmark results vary significantly between debug and release builds — always benchmark in release mode

## Testing

- Unit tests: `cargo test` (run with `--test-threads=1` for deterministic output)
- Integration tests: `rust/tests/integration_tests.rs`
- Security tests: `rust/tests/security_tests.rs` (file permissions, zeroization, path validation)
- Performance tests: `rust/tests/performance_tests.rs`
- Benchmarks: `cargo bench` (Criterion framework)
- Orchestrated by `scripts/test-rust.sh` which runs all test categories with 10 iterations each
