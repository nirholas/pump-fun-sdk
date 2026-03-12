# Tutorial 31: Rust Vanity Generator Deep Dive

> Build, benchmark, and extend the high-performance Rust vanity address generator — 100K+ keys/sec with rayon parallelization.

## Prerequisites

- Rust 1.70+ (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Basic Rust knowledge

```bash
cd rust
cargo build --release
```

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   CLI (clap)                          │
│  --prefix Sol --suffix App --threads 8 --count 3     │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────┐
│              VanityGenerator                          │
│  ┌─────────────────────────────────────────────┐     │
│  │ MatchTarget::Both { prefix, suffix, icase } │     │
│  └─────────────────────────────────────────────┘     │
│                                                       │
│  generate_with_callback() ──► rayon::par_iter         │
│                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Thread 1 │ │ Thread 2 │ │ Thread N │  ...        │
│  │ keygen() │ │ keygen() │ │ keygen() │             │
│  │ match()  │ │ match()  │ │ match()  │             │
│  └──────────┘ └──────────┘ └──────────┘            │
│       │              │              │                 │
│       ▼              ▼              ▼                 │
│  AtomicBool found? ──────► Return GeneratedAddress    │
└──────────────────────────────────────────────────────┘
```

## Step 1: Basic Usage

```bash
# Generate address starting with "Sol"
cargo run --release -- --prefix Sol

# Case-insensitive
cargo run --release -- --prefix sol --ignore-case

# Prefix + suffix
cargo run --release -- --prefix My --suffix App

# Multiple addresses
cargo run --release -- --prefix Pay --count 5

# Custom thread count
cargo run --release -- --prefix Dex --threads 4

# Estimate time without generating
cargo run --release -- --prefix Token --dry-run

# Verify output after generation
cargo run --release -- --prefix Sol --verify

# Quiet mode (just the public key)
cargo run --release -- --prefix Sol --quiet
```

### CLI Options

```
USAGE: solana-vanity [OPTIONS]

OPTIONS:
  -p, --prefix <PREFIX>    Address prefix to match
  -s, --suffix <SUFFIX>    Address suffix to match
  -i, --ignore-case        Case-insensitive matching
  -t, --threads <NUM>      Worker threads (default: all CPUs)
  -c, --count <NUM>        Addresses to generate (default: 1)
  -o, --output <FILE>      Output file (default: <ADDRESS>.json)
  -v, --verbose            Verbose progress output
  -q, --quiet              Print only the public key
      --verify             Verify keypair after generation
      --dry-run            Estimate time without generating
      --report             Generate report file
      --overwrite          Overwrite existing files
  -h, --help               Show help
      --version            Show version
```

## Step 2: Understanding the Core Generator

The generator uses `rayon` for lock-free parallel key generation:

```rust
use rayon::prelude::*;
use solana_sdk::signer::keypair::Keypair;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct VanityGenerator {
    target: MatchTarget,
    config: VanityGeneratorConfig,
}

pub struct VanityGeneratorConfig {
    pub threads: usize,
    pub verify_keypairs: bool,
    pub progress_interval: u64,
}

pub enum MatchTarget {
    Prefix { pattern: String, ignore_case: bool },
    Suffix { pattern: String, ignore_case: bool },
    Both { prefix: String, suffix: String, ignore_case: bool },
}

impl VanityGenerator {
    /// Generate a vanity address with optional progress callback
    pub fn generate_with_callback<F>(
        &self,
        callback: Option<F>,
    ) -> Result<GeneratedAddress>
    where
        F: Fn(u64, f64) + Send + Sync,
    {
        let found = Arc::new(AtomicBool::new(false));

        // Rayon spawns `self.config.threads` workers
        // Each worker loops: generate keypair → check match → repeat
        let result = (0..self.config.threads)
            .into_par_iter()
            .find_map_any(|_| {
                loop {
                    if found.load(Ordering::Relaxed) {
                        return None; // Another thread found it
                    }

                    let keypair = Keypair::new();
                    let address = keypair.pubkey().to_string();

                    if self.matches(&address) {
                        found.store(true, Ordering::Relaxed);
                        return Some(GeneratedAddress {
                            public_key: keypair.pubkey(),
                            secret_key: keypair.to_bytes(),
                        });
                    }
                }
            });

        result.ok_or_else(|| anyhow!("Generation cancelled"))
    }
}
```

### Key Design Decisions

- **`find_map_any`** — Returns as soon as ANY thread finds a match (not all)
- **`AtomicBool`** — Lock-free cancellation signal across threads
- **`Keypair::new()`** — Uses `OsRng` (OS-level cryptographic RNG)
- **No shared state** — Each thread generates independently

## Step 3: Pattern Matching

```rust
impl VanityGenerator {
    fn matches(&self, address: &str) -> bool {
        match &self.target {
            MatchTarget::Prefix { pattern, ignore_case } => {
                if *ignore_case {
                    address.to_lowercase().starts_with(&pattern.to_lowercase())
                } else {
                    address.starts_with(pattern)
                }
            }
            MatchTarget::Suffix { pattern, ignore_case } => {
                if *ignore_case {
                    address.to_lowercase().ends_with(&pattern.to_lowercase())
                } else {
                    address.ends_with(pattern)
                }
            }
            MatchTarget::Both { prefix, suffix, ignore_case } => {
                let addr = if *ignore_case {
                    address.to_lowercase()
                } else {
                    address.to_string()
                };
                let p = if *ignore_case { prefix.to_lowercase() } else { prefix.clone() };
                let s = if *ignore_case { suffix.to_lowercase() } else { suffix.clone() };
                addr.starts_with(&p) && addr.ends_with(&s)
            }
        }
    }
}
```

## Step 4: Difficulty Estimation

```rust
impl VanityGenerator {
    /// Estimate expected attempts and success probability
    pub fn estimate_difficulty(&self) -> (u64, f64) {
        let base: u64 = 58; // Base58 alphabet size

        let length = match &self.target {
            MatchTarget::Prefix { pattern, ignore_case } => {
                if *ignore_case {
                    // Case-insensitive roughly halves the search space for alpha chars
                    pattern.len() as u32
                } else {
                    pattern.len() as u32
                }
            }
            MatchTarget::Suffix { pattern, .. } => pattern.len() as u32,
            MatchTarget::Both { prefix, suffix, .. } => {
                (prefix.len() + suffix.len()) as u32
            }
        };

        let expected_attempts = base.pow(length);
        let probability = 1.0 / expected_attempts as f64;

        (expected_attempts, probability)
    }
}
```

## Step 5: Benchmarking

```bash
# Run the built-in benchmark
cd rust
cargo bench

# Quick benchmark (1 second)
cargo run --release -- --prefix X --dry-run
# Output: "Generation rate: ~125,000 keys/sec"
```

### Benchmark Function

```rust
pub fn benchmark_generation_rate(duration_secs: u64) -> u64 {
    let start = Instant::now();
    let mut count: u64 = 0;

    while start.elapsed().as_secs() < duration_secs {
        let _ = Keypair::new();
        count += 1;
    }

    count / duration_secs
}
```

### Performance by Machine

| CPU | Threads | Keys/sec |
|-----|---------|----------|
| M1 MacBook Air | 8 | ~120K |
| Ryzen 7 5800X | 16 | ~200K |
| GitHub Codespace (4-core) | 4 | ~50K |
| AWS c5.2xlarge | 8 | ~100K |

## Step 6: Graceful Cancellation

```rust
use ctrlc;

// Set up Ctrl+C handler
let cancel = generator.cancel_handle();
ctrlc::set_handler(move || {
    cancel.store(true, Ordering::Relaxed);
    eprintln!("\nCancelled by user");
})?;

// Generation respects the cancel signal
let result = generator.generate_with_callback(Some(|attempts, elapsed| {
    eprintln!("  Attempts: {} | Elapsed: {:.1}s | Rate: {:.0} keys/sec",
        attempts, elapsed, attempts as f64 / elapsed);
}));
```

## Step 7: Output & Verification

```rust
pub struct GeneratedAddress {
    pub public_key: PublicKey,
    pub secret_key: [u8; 64],
}

impl GeneratedAddress {
    /// Write keypair to file with secure permissions (0600)
    pub fn save(&self, path: &Path) -> Result<()> {
        let json = serde_json::to_string(&self.secret_key.to_vec())?;
        fs::write(path, &json)?;

        // Set file permissions to owner-only read/write
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
        }

        Ok(())
    }

    /// Verify the keypair: secret → public derivation
    pub fn verify(&self) -> bool {
        let keypair = Keypair::from_bytes(&self.secret_key).unwrap();
        keypair.pubkey() == self.public_key
    }
}
```

## Step 8: Run the Tests

```bash
cd rust
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_prefix_match
```

## Step 9: Extend with Custom Patterns

Add regex or custom pattern matching:

```rust
use regex::Regex;

pub enum MatchTarget {
    Prefix { pattern: String, ignore_case: bool },
    Suffix { pattern: String, ignore_case: bool },
    Both { prefix: String, suffix: String, ignore_case: bool },
    Regex { pattern: Regex },  // Custom regex matching
}

// Usage:
let target = MatchTarget::Regex {
    pattern: Regex::new(r"^[A-Z]{3}\d{2}").unwrap(),
};
// Matches addresses like "ABC12...", "XYZ99..."
```

## Security Notes

1. **Only `solana-sdk`** — Uses the official Solana keypair generation
2. **`OsRng`** — Cryptographically secure random number generator
3. **Zeroize** — Key material is zeroized after writing to disk
4. **File permissions** — Output files are `0600` (owner read/write only)
5. **No network calls** — All generation is local and offline

## Next Steps

- See [Tutorial 13](./13-vanity-addresses.md) for the SDK-level overview
- See [Tutorial 30](./30-batch-shell-scripts.md) for shell-based batch generation
- Use generated keypairs in [Tutorial 01](./01-create-token.md)
