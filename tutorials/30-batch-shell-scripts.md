# Tutorial 30: Batch Vanity Address Generation with Shell Scripts

> Automate vanity Solana address generation at scale using production-ready Bash scripts with security-first defaults.

## Prerequisites

- Linux or macOS
- `solana-keygen` installed (`solana-install init`)
- Bash 4+

```bash
# Verify solana-keygen is available
solana-keygen --version
```

## What's Included

The `scripts/` directory provides four production scripts:

| Script | Purpose |
|--------|---------|
| `generate-vanity.sh` | Generate a single vanity address |
| `batch-generate.sh` | Generate many addresses from a prefix file |
| `verify-keypair.sh` | Verify a generated keypair is valid |
| `utils.sh` | Shared utilities (validation, security, estimation) |

## Step 1: Generate a Single Vanity Address

```bash
cd scripts

# Generate an address starting with "Sol"
./generate-vanity.sh Sol

# Case-insensitive matching
./generate-vanity.sh -i Pay

# Match both prefix and suffix
./generate-vanity.sh -s App My
# → Finds: My...App

# Generate 3 addresses
./generate-vanity.sh -c 3 Pump

# Specify output directory
./generate-vanity.sh -o ./keys Token

# Encrypt with GPG
./generate-vanity.sh -e Secret
```

### Full Options

```
USAGE: ./generate-vanity.sh [OPTIONS] <prefix>

OPTIONS:
  -s, --suffix <str>     Also match suffix
  -c, --count <n>        Number of addresses (default: 1)
  -o, --output <dir>     Output directory (default: current)
  -t, --threads <n>      Thread count (default: all cores)
  -i, --ignore-case      Case-insensitive matching
  -e, --encrypt          Encrypt output with GPG
  -b, --backup           Create timestamped backup
  -v, --verbose          Verbose output
  -q, --quiet            Minimal output
```

## Step 2: Batch Generate from a Prefix File

Create a prefix file with one prefix per line, optionally with a count:

```bash
# prefixes.txt
Sol
Pay:3
Dex:2
App
Token:5
```

Run the batch generator:

```bash
# Basic batch generation
./batch-generate.sh prefixes.txt

# Parallel jobs for speed
./batch-generate.sh -j 4 prefixes.txt

# Custom output with encryption
./batch-generate.sh -o ./vanity-keys -e prefixes.txt

# Resume from a failed batch
./batch-generate.sh -r prefixes.txt

# Case-insensitive for all prefixes
./batch-generate.sh -i prefixes.txt
```

### Output Structure

```
batch_output/
├── Sol/
│   └── SoL7x...json
├── Pay/
│   ├── PAYq2...json
│   ├── PayAB...json
│   └── paYcd...json
├── Dex/
│   ├── DexP1...json
│   └── DeXq2...json
├── App/
│   └── APpR3...json
├── Token/
│   ├── Token...json
│   └── ...
└── batch_report.txt
```

The `batch_report.txt` contains timing data, success/failure counts, and generation statistics.

## Step 3: Verify Generated Keypairs

Always verify keypairs after generation:

```bash
# Basic verification
./verify-keypair.sh ./keys/SoL7x.json

# Verify prefix matches
./verify-keypair.sh -p Sol ./keys/SoL7x.json

# Verify both prefix and suffix
./verify-keypair.sh -p Sol -s xyz ./keys/SoL7x.json

# JSON output (for automation)
./verify-keypair.sh -j ./keys/SoL7x.json

# Quiet mode (exit code only)
./verify-keypair.sh -q ./keys/SoL7x.json && echo "VALID" || echo "INVALID"
```

### Verification Checks

The script runs 7 security checks:

1. File exists and is readable
2. File permissions are `0600` or `0400` (secure)
3. Valid JSON format
4. Valid keypair (64-byte array)
5. Public key is derivable from secret key
6. Prefix matches (if specified)
7. Suffix matches (if specified)

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All checks passed |
| `1` | Verification failed |
| `2` | System error (file not found, etc.) |

## Step 4: Batch Verify All Generated Keys

```bash
# Verify all keys in a directory
for keyfile in batch_output/**/*.json; do
  if ./verify-keypair.sh -q "$keyfile"; then
    echo "✓ $keyfile"
  else
    echo "✗ FAILED: $keyfile"
  fi
done
```

## Step 5: Understanding the Utility Functions

The `utils.sh` library provides shared functions:

```bash
source scripts/utils.sh

# Validate a Base58 prefix
validate_prefix "Sol"        # OK
validate_prefix "Sol0"       # ERROR: '0' is not valid Base58

# Check valid Base58 characters
is_valid_base58 "ABCdef"     # true
is_valid_base58 "0OIl"       # false (0, O, I, l are not Base58)

# Get invalid characters in a string
get_invalid_chars "Hello0"   # "0"

# Secure file operations
set_secure_permissions "./key.json"    # chmod 0600
check_secure_permissions "./key.json"  # returns 0 if secure

# System info
get_cpu_cores                 # e.g., 8

# Time estimation
estimate_time "Sol"           # Estimates based on prefix length
```

### Base58 Character Set

Valid Base58 characters (no `0`, `O`, `I`, `l`):

```
1 2 3 4 5 6 7 8 9
A B C D E F G H J K L M N P Q R S T U V W X Y Z
a b c d e f g h j k m n o p q r s t u v w x y z
```

## Step 6: Estimate Generation Time

Longer prefixes take exponentially longer:

| Prefix Length | Expected Attempts | Approximate Time (100K keys/sec) |
|--------------|-------------------|----------------------------------|
| 1 char | ~58 | Instant |
| 2 chars | ~3,364 | < 1 second |
| 3 chars | ~195,112 | ~2 seconds |
| 4 chars | ~11.3M | ~2 minutes |
| 5 chars | ~656M | ~2 hours |
| 6 chars | ~38B | ~4 days |

Case-insensitive mode (`-i`) cuts time roughly in half for alphabetic chars.

```bash
# Dry-run to estimate time
./generate-vanity.sh -v Sol
# Shows: "Estimated attempts: ~195,112"
```

## Step 7: Production Workflow

A complete workflow for launching a token with a vanity address:

```bash
#!/bin/bash
set -euo pipefail

PREFIX="Pump"
OUTPUT_DIR="./production-keys"
mkdir -p "$OUTPUT_DIR"

echo "Step 1: Generate vanity address..."
./scripts/generate-vanity.sh -o "$OUTPUT_DIR" -b "$PREFIX"

# Find the generated file
KEYFILE=$(find "$OUTPUT_DIR" -name "${PREFIX}*.json" -type f | head -1)
echo "Generated: $KEYFILE"

echo "Step 2: Verify keypair..."
./scripts/verify-keypair.sh -p "$PREFIX" -v "$KEYFILE"

echo "Step 3: Extract public key..."
PUBLIC_KEY=$(solana-keygen pubkey "$KEYFILE")
echo "Mint address: $PUBLIC_KEY"

echo "Step 4: Check permissions..."
ls -la "$KEYFILE"
# Should show: -rw------- (0600)

echo "Done! Use $PUBLIC_KEY as your token mint address."
```

## Security Best Practices

1. **Never share keypair files** — They contain your secret key
2. **Check permissions** — Always `0600` (owner read/write only)
3. **Use GPG encryption** (-e flag) for long-term storage
4. **Verify after generation** — Always run `verify-keypair.sh`
5. **Secure delete** — Use `shred` or `srm` to delete keypair files
6. **No network calls** — All generation happens locally, offline
7. **Only use `solana-keygen`** — Official Solana Labs tool, never third-party generators

## Next Steps

- See [Tutorial 13](./13-vanity-addresses.md) for SDK-level vanity generation
- See [Tutorial 31](./31-rust-vanity-deep-dive.md) for the high-performance Rust generator
- Use the generated keypair as a mint in [Tutorial 01](./01-create-token.md)
