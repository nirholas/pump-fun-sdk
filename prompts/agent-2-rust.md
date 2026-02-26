# Agent 2: Rust Implementation

## Role
You are a senior Rust developer specializing in cryptographic applications and Solana development. Your task is to create a high-performance, secure vanity address generator using the official Solana SDK.

## Project Context
- Repository: `/workspaces/solana-vanity-address`
- Goal: Create a production-grade Rust vanity address generator
- Security Level: CRITICAL - This generates cryptocurrency private keys
- Performance Target: Faster than single-threaded, close to `solana-keygen grind`

## Your Deliverables

### 1. Rust Project Structure (`rust/`)

```
rust/
├── Cargo.toml
├── Cargo.lock
├── src/
│   ├── main.rs           # CLI entry point
│   ├── lib.rs            # Library exports
│   ├── generator.rs      # Core generation logic
│   ├── matcher.rs        # Prefix/suffix matching
│   ├── output.rs         # File output handling
│   ├── security.rs       # Security utilities
│   └── config.rs         # Configuration handling
├── tests/
│   ├── integration_tests.rs
│   ├── security_tests.rs
│   └── performance_tests.rs
├── benches/
│   └── generation_bench.rs
└── README.md
```

### 2. Dependencies (`Cargo.toml`)

Use ONLY official/trusted crates:
```toml
[package]
name = "solana-vanity"
version = "0.1.0"
edition = "2021"

[dependencies]
solana-sdk = "1.18"        # Official Solana SDK
clap = { version = "4", features = ["derive"] }  # CLI parsing
rayon = "1.8"              # Parallel iteration
zeroize = "1.7"            # Secure memory wiping
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
indicatif = "0.17"         # Progress bars
num_cpus = "1.16"

[dev-dependencies]
criterion = "0.5"
tempfile = "3"

[[bench]]
name = "generation_bench"
harness = false
```

### 3. Core Implementation

#### `src/generator.rs`
```rust
// Implement:
// - VanityGenerator struct with configurable options
// - Multi-threaded generation using rayon
// - Atomic counter for attempts
// - Graceful shutdown on Ctrl+C
// - Progress reporting callback
```

Key requirements:
- Use `solana_sdk::signer::keypair::Keypair`
- Use `solana_sdk::signature::Signer` trait
- Thread-safe attempt counting
- Memory-safe keypair handling
- Zeroize sensitive data on drop

#### `src/matcher.rs`
```rust
// Implement:
// - Prefix matching (case-sensitive and insensitive)
// - Suffix matching
// - Combined prefix+suffix matching
// - Base58 character validation
// - Match statistics tracking
```

Key requirements:
- Validate against Base58 alphabet (no 0, O, I, l)
- Efficient string comparison
- Precompute match targets for speed

#### `src/security.rs`
```rust
// Implement:
// - Secure file writing with proper permissions
// - Memory zeroization for keypairs
// - Secure random number verification
// - File integrity verification
```

Key requirements:
- Set file permissions to 0o600 on Unix
- Use `zeroize` crate for sensitive data
- Verify RNG quality on startup
- No logging of secret keys

#### `src/output.rs`
```rust
// Implement:
// - JSON keypair format (Solana-compatible)
// - Human-readable output
// - Verification report generation
```

Output format must match Solana CLI:
```json
[214,83,249,...]  // 64-byte secret key array
```

### 4. CLI Interface (`src/main.rs`)

```
solana-vanity [OPTIONS]

OPTIONS:
    -p, --prefix <PREFIX>       Find address starting with PREFIX
    -s, --suffix <SUFFIX>       Find address ending with SUFFIX
    -i, --ignore-case           Case-insensitive matching
    -t, --threads <NUM>         Number of threads (default: all CPUs)
    -o, --output <FILE>         Output file (default: <ADDRESS>.json)
    -c, --count <NUM>           Number of addresses to generate (default: 1)
    -v, --verbose               Verbose output
    -q, --quiet                 Minimal output
    --verify                    Verify output after generation
    --dry-run                   Estimate time without generating
```

### 5. Test Suite

#### `tests/integration_tests.rs`
```rust
#[test]
fn test_prefix_generation_2_char() {
    // Generate with 2-char prefix, verify it matches
    // Run 10+ iterations
}

#[test]
fn test_case_insensitive_matching() {
    // Test --ignore-case flag
}

#[test]
fn test_keypair_validity() {
    // Verify generated keypair can sign/verify
}

#[test]
fn test_output_file_format() {
    // Verify JSON format matches Solana CLI
}

#[test]
fn test_file_permissions() {
    // Verify output file has 0o600 permissions
}
```

#### `tests/security_tests.rs`
```rust
#[test]
fn test_memory_zeroization() {
    // Verify sensitive data is zeroized after use
}

#[test]
fn test_invalid_prefix_rejected() {
    // Test that invalid Base58 chars are rejected
}

#[test]
fn test_rng_quality() {
    // Basic RNG quality check
}
```

### 6. Benchmarks (`benches/generation_bench.rs`)

```rust
use criterion::{criterion_group, criterion_main, Criterion};

fn bench_keypair_generation(c: &mut Criterion) {
    // Benchmark raw keypair generation speed
}

fn bench_prefix_matching(c: &mut Criterion) {
    // Benchmark prefix comparison speed
}

fn bench_parallel_scaling(c: &mut Criterion) {
    // Benchmark 1, 2, 4, 8 thread performance
}
```

### 7. Security Requirements

1. **Cryptographic Safety**
   - Use only `solana_sdk` for key generation
   - Never implement custom crypto
   - Verify keypair validity after generation

2. **Memory Safety**
   - Zeroize all sensitive data on drop
   - No secret keys in logs/errors
   - No secret keys in stack traces

3. **File Safety**
   - Unix: permissions 0o600
   - Atomic file writes
   - Verify file integrity

4. **Input Validation**
   - Validate Base58 characters
   - Reject empty prefixes
   - Limit prefix length reasonably

### 8. Code Quality Standards

- `cargo clippy` - no warnings
- `cargo fmt` - formatted
- Documentation for all public items
- Error handling with `thiserror`
- No `unwrap()` in production code (use `expect()` with context or `?`)

### 9. Testing Protocol

Run comprehensive tests:
```bash
# Unit tests (10 iterations)
for i in {1..10}; do cargo test; done

# Integration tests
for i in {1..10}; do cargo test --test integration_tests; done

# Security tests
for i in {1..10}; do cargo test --test security_tests; done

# Benchmarks
cargo bench

# Clippy
cargo clippy -- -D warnings

# Format check
cargo fmt -- --check
```

## Validation Checklist

Before completing, verify:
- [ ] All tests pass 10+ times consistently
- [ ] No clippy warnings
- [ ] Code is formatted
- [ ] Documentation is complete
- [ ] Security measures are implemented
- [ ] Output format matches Solana CLI
- [ ] Memory is properly zeroized
- [ ] File permissions are correct
- [ ] Error handling is comprehensive
- [ ] Benchmarks show expected performance

## Do Not

- Do NOT implement custom cryptography
- Do NOT use unsafe code without justification
- Do NOT log or display secret keys
- Do NOT use deprecated Solana APIs
- Do NOT skip input validation
- Do NOT use `.unwrap()` without careful consideration
