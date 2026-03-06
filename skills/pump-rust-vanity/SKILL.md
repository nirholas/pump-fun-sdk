---
name: pump-rust-vanity
description: "Production-grade multi-threaded Rust vanity address generator for Solana — 100K+ keys/sec using Rayon parallel iterators with solana-sdk, Base58 pattern matching, prefix/suffix support, security-hardened file output, and Criterion benchmarks."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
    requires:
      bins:
        - cargo
---

# Rust Vanity Generator — High-Performance Solana Address Mining

Production-grade Rust binary achieving 100K+ keys/sec using Rayon parallel iterators with security-hardened file output and Solana CLI compatibility.

## Architecture

```
CLI Args ──► VanityConfig ──► VanityGenerator
                                    │
                              Rayon par_iter
                              ┌─────┼─────┐
                            Thread Thread Thread ...
                              │     │     │
                           Keypair::new() per iteration
                              │     │     │
                           Base58 encode + match
                              │     │     │
                              └─────┼─────┘
                                    │
                              AtomicBool found
                                    │
                              SecureOutput (0o600)
```

## CLI Arguments

| Argument | Description |
|----------|-------------|
| `--prefix` | Required Base58 prefix to match |
| `--suffix` | Optional Base58 suffix |
| `--output` | Output file path (default: stdout) |
| `--threads` | Number of threads (default: all CPUs) |

## Core Types

```rust
struct VanityConfig {
    prefix: String,
    suffix: Option<String>,
    output: Option<PathBuf>,
    threads: Option<usize>,
}

struct GeneratedAddress {
    keypair: Keypair,
    address: String,
    attempts: u64,
}
```

## Generation Engine

```rust
fn generate(config: &VanityConfig) -> Result<GeneratedAddress> {
    let found = AtomicBool::new(false);
    let result = (0..num_cpus::get())
        .into_par_iter()
        .find_map_any(|_| {
            let mut attempts = 0u64;
            loop {
                if found.load(Ordering::Relaxed) { return None; }
                attempts += 1;
                let keypair = Keypair::new();
                let address = keypair.pubkey().to_string();
                if matches_pattern(&address, &config) {
                    found.store(true, Ordering::Relaxed);
                    return Some(GeneratedAddress { keypair, address, attempts });
                }
            }
        });
    result.ok_or_else(|| anyhow!("No match found"))
}
```

## Security Features

| Feature | Implementation |
|---------|---------------|
| CSPRNG | `OsRng` via `solana-sdk` |
| Memory cleanup | `Zeroize` trait on secret key bytes |
| File permissions | `0o600` via `std::fs::set_permissions` |
| No network | Pure offline operation |

## Dependencies

| Crate | Purpose |
|-------|---------|
| `solana-sdk` | Keypair generation, Base58, signing |
| `rayon` | Data-parallel iteration |
| `clap` | CLI argument parsing |
| `anyhow` | Error handling |
| `criterion` | Benchmarking |

## Testing

```bash
cargo test                            # Unit + integration tests
cargo test --test security_tests      # Security-focused tests
cargo bench                           # Criterion benchmarks
```

## Patterns to Follow

- Only use `solana-sdk` for cryptographic operations
- Use `Zeroize` on all key material
- Set file permissions to `0o600` immediately after writing
- Use `AtomicBool` for cross-thread termination signaling
- Use `find_map_any` for early termination on first match

## Common Pitfalls

- Base58 is case-sensitive — `pump` ≠ `Pump`
- Longer prefixes grow exponentially harder (~58× per character)
- `Keypair::new()` uses OS entropy — do not seed with user input
- `rayon` thread pool size should match CPU cores for optimal throughput
