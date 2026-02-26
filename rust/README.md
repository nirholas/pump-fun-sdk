# Solana Vanity Address Generator (Rust)

A high-performance, secure vanity address generator for Solana written in Rust.

## Features

- 🔐 **Secure**: Uses only the official Solana SDK for cryptographic operations
- ⚡ **Fast**: Multi-threaded generation using Rayon
- 🛡️ **Safe**: Automatic memory zeroization for sensitive data
- 📦 **Compatible**: Output format matches Solana CLI (`solana-keygen`)
- ✅ **Validated**: Comprehensive test suite with security tests

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/hippopotomonstrosesquippedaliophobi/solana-vanity-address.git
cd solana-vanity-address/rust

# Build release version
cargo build --release

# The binary will be at ./target/release/solana-vanity
```

### Prerequisites

- Rust 1.70 or later
- Cargo

## Usage

### Basic Usage

```bash
# Generate an address starting with "ABC"
solana-vanity --prefix ABC

# Generate an address ending with "XYZ"
solana-vanity --suffix XYZ

# Generate an address with both prefix and suffix
solana-vanity --prefix AB --suffix 99
```

### Options

```
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
    --report                    Generate a human-readable report file
```

### Examples

```bash
# Generate with case-insensitive matching
solana-vanity --prefix abc --ignore-case

# Use specific number of threads
solana-vanity --prefix AB --threads 8

# Generate multiple addresses
solana-vanity --prefix A --count 5

# Save to specific file
solana-vanity --prefix ABC --output my-vanity-key.json

# Estimate generation time without actually generating
solana-vanity --prefix ABCD --dry-run

# Generate with verification
solana-vanity --prefix AB --verify

# Verbose output
solana-vanity --prefix AB --verbose
```

## Output Format

The generated keypair is saved in JSON format compatible with the Solana CLI:

```json
[214,83,249,...]
```

This is a 64-byte array containing the full Ed25519 keypair (32 bytes private key + 32 bytes public key).

### Using with Solana CLI

```bash
# Verify the keypair
solana-keygen verify <PUBLIC_KEY> <KEYPAIR_FILE>

# Check balance
solana balance <PUBLIC_KEY>

# Use for transactions
solana transfer --keypair <KEYPAIR_FILE> <RECIPIENT> <AMOUNT>
```

## Security

### Cryptographic Security

- **Official SDK Only**: All key generation uses the official `solana-sdk` crate
- **No Custom Crypto**: We never implement our own cryptographic primitives
- **RNG Verification**: System RNG quality is verified before generation
- **Keypair Verification**: Each generated keypair is verified for correctness

### Memory Security

- **Zeroization**: All sensitive data is zeroized when no longer needed
- **No Logging Secrets**: Secret keys are never logged or printed
- **Redacted Debug**: Debug output shows `[REDACTED]` for sensitive data

### File Security

- **Restricted Permissions**: Output files are created with mode 0600 (Unix)
- **Atomic Writes**: Files are written atomically where possible
- **Integrity Verification**: File size is verified after writing

### Best Practices

1. **Don't run as root**: Generate keys as a regular user
2. **Secure storage**: Store generated keys in a secure location
3. **Backup keys**: Create secure backups of important keys
4. **Verify keys**: Use `--verify` to confirm keypair validity

## Pattern Constraints

### Valid Characters

Solana addresses use Base58 encoding. Valid characters are:
```
123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
```

**Invalid characters** (not in Base58):
- `0` (zero)
- `O` (uppercase O)
- `I` (uppercase I)
- `l` (lowercase L)

### Difficulty Estimation

The time to find an address grows exponentially with pattern length:

| Prefix Length | Expected Attempts | Estimated Time* |
|--------------|-------------------|-----------------|
| 1 character  | ~40               | <1 second       |
| 2 characters | ~2,300            | <1 second       |
| 3 characters | ~140,000          | ~1 second       |
| 4 characters | ~8 million        | ~1 minute       |
| 5 characters | ~460 million      | ~1 hour         |
| 6 characters | ~27 billion       | ~3 days         |

*Times are approximate and depend on hardware.

Use `--dry-run` to get an estimate for your specific pattern and hardware.

## Development

### Building

```bash
# Debug build
cargo build

# Release build (optimized)
cargo build --release

# Run tests
cargo test

# Run clippy lints
cargo clippy -- -D warnings

# Format code
cargo fmt
```

### Running Tests

```bash
# Run all tests
cargo test

# Run specific test file
cargo test --test integration_tests
cargo test --test security_tests
cargo test --test performance_tests

# Run with output
cargo test -- --nocapture

# Run tests multiple times
for i in {1..10}; do cargo test; done
```

### Benchmarks

```bash
# Run benchmarks
cargo bench

# Run specific benchmark
cargo bench -- keypair_generation
```

## Library Usage

The crate can also be used as a library:

```rust
use solana_vanity::{VanityGenerator, MatchTarget, VanityGeneratorConfig};

// Generate an address starting with "ABC"
let target = MatchTarget::prefix("ABC", false)?;
let generator = VanityGenerator::with_target(target)?;
let address = generator.generate()?;

println!("Found: {}", address.public_key());

// Save the keypair
use solana_vanity::output::write_keypair_file;
use std::path::Path;

write_keypair_file(&address, Path::new("my-key.json"))?;
```

### Convenience Functions

```rust
use solana_vanity::{generate_with_prefix, generate_with_suffix};

// Simple prefix generation
let address = generate_with_prefix("AB", 0)?; // 0 = auto-detect threads

// Simple suffix generation
let address = generate_with_suffix("99", 4)?; // 4 threads
```

## License

MIT OR Apache-2.0

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass
2. Code is formatted with `cargo fmt`
3. No clippy warnings
4. Security-sensitive changes are carefully reviewed

## Acknowledgments

- [Solana Labs](https://github.com/solana-labs) for the Solana SDK
- [Rayon](https://github.com/rayon-rs/rayon) for parallel iteration
- [Zeroize](https://github.com/RustCrypto/utils/tree/master/zeroize) for secure memory handling
