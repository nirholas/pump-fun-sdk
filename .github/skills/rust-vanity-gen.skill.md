# Rust Vanity Generator — High-Performance Parallel Address Mining

## Skill Description

Build and optimize the high-performance Rust vanity address generator — a multi-threaded CLI tool using `rayon` and `solana-sdk` for parallel Base58 pattern matching with prefix, suffix, and combined matching support, achieving 100K+ keys/second with production-grade security.

## Context

The Rust implementation (`solana-vanity`) is the highest-performance vanity address generator in the toolkit. It leverages Rayon's data-parallel `par_iter` for multi-threaded key generation across all CPU cores. Uses `solana-sdk` for Ed25519 key generation and outputs Solana CLI-compatible JSON keypair files. Production-hardened with memory zeroization, file permission enforcement, and RNG quality verification.

## Key Files

- `rust/src/main.rs` — CLI entry point, `clap::Parser` args, generation orchestration, dry-run mode
- `rust/src/generator.rs` — `VanityGenerator` struct, Rayon parallel generation with `find_any`
- `rust/src/matcher.rs` — `MatchTarget` enum, `OptimizedMatcher` with pre-lowercased patterns, `MatchStatistics`
- `rust/src/output.rs` — `GeneratedAddress`, `write_keypair_file`, `verify_keypair_file`, `write_report`
- `rust/src/security.rs` — `SecureBytes` (zeroize-on-drop), `ZeroizeGuard`, RNG quality verification, path validation
- `rust/src/config.rs` — `GeneratorConfig`, base58 validation, difficulty estimation
- `rust/src/lib.rs` — Library root with convenience functions and re-exports
- `rust/Cargo.toml` — Crate config with LTO release profile
- `rust/benches/generation_bench.rs` — Criterion benchmarks
- `rust/tests/integration_tests.rs` — Integration tests
- `rust/tests/security_tests.rs` — File permission, zeroization, path traversal tests
- `rust/tests/performance_tests.rs` — Generation rate, thread scaling tests

## CLI Options

```
solana-vanity [OPTIONS]

Options:
  -p, --prefix <PREFIX>      Match address start (Base58 chars only)
  -s, --suffix <SUFFIX>      Match address end (Base58 chars only)
  -i, --ignore-case          Case-insensitive matching
  -t, --threads <NUM>        Thread count (default: all CPUs)
  -o, --output <FILE>        Output path (default: <ADDRESS>.json)
  -c, --count <NUM>          Generate N addresses (sequential)
  -v, --verbose              Detailed progress output
  -q, --quiet                Minimal output (pubkey only)
      --verify               Post-generation keypair verification
      --dry-run              Difficulty estimate + benchmark (no generation)
      --report               Generate .txt report alongside JSON
      --overwrite            Overwrite existing output files
```

## Core Architecture

```
main() → run()
  ├─ validate args
  ├─ warn_if_elevated()
  ├─ MatchTarget::new() → validate_prefix/suffix()
  │
  ├─ [--dry-run mode]
  │   └─ benchmark_generation_rate() → print probability table
  │
  └─ [generation mode]
      └─ generate_addresses() (loop over --count)
          └─ generate_single_address()
              ├─ VanityGenerator::new(target, config)
              │   └─ verify_rng_quality()
              ├─ Ctrl+C handler thread (AtomicBool propagation)
              ├─ generator.generate_with_callback(progress_fn)
              ├─ write_keypair_file() → secure_write_file(0o600)
              ├─ [--report] write_report()
              └─ [--verify] verify_keypair_file()
```

## Core Types

### VanityGenerator

```rust
pub struct VanityGenerator {
    config: VanityGeneratorConfig,
    matcher: OptimizedMatcher,
    cancelled: Arc<AtomicBool>,
    attempts: Arc<AtomicU64>,
}

pub struct VanityGeneratorConfig {
    pub threads: usize,
    pub verify_keypairs: bool,       // default: true
    pub progress_interval: Duration,
}
```

### MatchTarget

```rust
pub enum MatchTarget {
    Prefix { pattern: String, case_insensitive: bool },
    Suffix { pattern: String, case_insensitive: bool },
    Both { prefix: String, suffix: String, case_insensitive: bool },
}
```

Constructed via fallible constructors: `MatchTarget::prefix()`, `MatchTarget::suffix()`, `MatchTarget::both()` — each validates against Base58.

### OptimizedMatcher

Pre-computes lowercased patterns for case-insensitive matching:

```rust
pub struct OptimizedMatcher {
    target: MatchTarget,
    lowered_patterns: Option<(String, String)>,  // pre-lowercased for CI mode
}

impl OptimizedMatcher {
    pub fn matches(&self, address: &str) -> bool {
        match (&self.target, &self.lowered_patterns) {
            (MatchTarget::Prefix { .. }, Some((p, _))) => {
                address[..p.len()].to_lowercase() == *p
            },
            (MatchTarget::Prefix { pattern, .. }, None) => {
                address.starts_with(pattern)
            },
            // ... similar for Suffix, Both
        }
    }
}
```

### GeneratedAddress

```rust
pub struct GeneratedAddress {
    keypair: Keypair,
    attempts: u64,
    time_ms: u128,
}

impl fmt::Debug for GeneratedAddress {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "GeneratedAddress {{ pubkey: {}, secret: [REDACTED] }}", self.public_key())
    }
}
```

### SecureBytes

```rust
pub struct SecureBytes(Vec<u8>);

impl Drop for SecureBytes {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

impl fmt::Debug for SecureBytes {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "[REDACTED]")
    }
}
```

## Generation Engine Details

The hot loop uses Rayon's `par_iter` with early termination:

```rust
let result: Arc<Mutex<Option<GeneratedAddress>>> = Arc::new(Mutex::new(None));

pool.install(|| {
    (0..usize::MAX).into_par_iter().find_any(|_| {
        if self.cancelled.load(Ordering::Relaxed) { return true; }
        
        let keypair = Keypair::new();  // solana-sdk CSPRNG
        self.attempts.fetch_add(1, Ordering::Relaxed);
        
        let address = keypair.pubkey().to_string();
        if self.matcher.matches(&address) {
            if self.config.verify_keypairs {
                verify_keypair_integrity(&keypair).expect("keypair verification failed");
            }
            *result.lock().unwrap() = Some(GeneratedAddress::new(keypair, attempts, time));
            return true;
        }
        false
    });
});
```

**Design decisions:**
- `find_any` (not `find_first`) — returns first match found by any thread
- `AtomicBool` with `Relaxed` ordering for cancellation (no ordering guarantees needed)
- `AtomicU64` with `Relaxed` ordering for attempt counter (exact count not critical)
- Result stored in `Arc<Mutex<Option>>` — only written once on match
- Dedicated Ctrl+C handler thread propagates signal via the atomic cancel flag

## Difficulty & Estimation

Expected attempts for pattern of length $n$:
- Case-sensitive: $58^n$
- Case-insensitive: $34^n$
- 50% success probability: $58^n \times \ln(2)$

```rust
pub fn estimate_attempts(&self) -> u64 {
    let base = if case_insensitive { 34u64 } else { 58u64 };
    base.pow(pattern_length as u32)
}

pub fn estimate_time_seconds(&self, rate: f64) -> f64 {
    self.estimate_attempts() as f64 * 2.0_f64.ln() / rate
}
```

## Dependencies

| Crate | Version | Purpose | Security Role |
|-------|---------|---------|---------------|
| `solana-sdk` | 1.18 | Ed25519 key generation | Official crypto |
| `rayon` | 1.10 | Thread pool parallelism | Non-crypto |
| `clap` | 4 | CLI argument parsing (derive) | Non-crypto |
| `serde` / `serde_json` | — | JSON serialization | Non-crypto |
| `zeroize` | 1.3 | Memory clearing | Security hygiene |
| `thiserror` | — | Error type derivation | Non-crypto |
| `num_cpus` | — | CPU core detection | Non-crypto |
| `ctrlc` | — | Signal handling | Non-crypto |
| `nix` | — | Unix file permissions, euid check | Security hygiene |

## Release Profile

```toml
[profile.release]
lto = true            # Link-time optimization (cross-crate inlining)
codegen-units = 1     # Single codegen unit (better optimization, slower build)
strip = true          # Strip debug symbols
panic = "abort"       # No unwinding overhead (smaller binary)
```

## Testing

```bash
# Full test suite (10 iterations each)
./scripts/test-rust.sh

# Individual test categories
cd rust
cargo test --release                              # Unit tests
cargo test --release --test integration_tests     # Integration
cargo test --release --test security_tests        # Security
cargo test --release --test performance_tests     # Performance
cargo bench                                       # Criterion benchmarks

# Functional test
cargo run --release -- -p A --dry-run             # Difficulty estimate
cargo run --release -- -p A -o /tmp/test.json     # Real generation
```

## Patterns to Follow

- Use `thiserror` for error types, not manual `impl Display`
- All cryptographic operations use `solana-sdk` (`Keypair::new()`) — never custom crypto
- Use Rayon thread pools — never spawn raw `std::thread` for generation
- File writes go through `secure_write_file` — never use `std::fs::write` directly
- Progress reporting uses `AtomicU64` with `Relaxed` ordering
- Always verify RNG quality before starting generation
- `--dry-run` should benchmark keys/sec and display a probability table
- Use `#[inline]` on hot-path matching functions
- Pre-compute lowercased patterns in `OptimizedMatcher::new()`

## Common Pitfalls

- Base58 validity: characters `0`, `O`, `I`, `l` are NOT in the alphabet — validate all patterns
- `find_any` may return after other threads have done extra work — don't assume exact attempt counts
- `MAX_PREFIX_LENGTH = 8` and `MAX_SUFFIX_LENGTH = 8` — longer patterns are computationally infeasible
- File permission checks are Unix-only — Windows doesn't support `mode(0o600)`
- `shred` for secure deletion may not be available on all systems
- Benchmark results vary significantly between debug and release builds — always benchmark in release
- Not checking `is_valid_base58_char()` before searching wastes compute time
- Using `Mutex` instead of atomics for hot-path counters creates contention
- Case-insensitive matching changes effective alphabet from 58 to ~34 unique characters
