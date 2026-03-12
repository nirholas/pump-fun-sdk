# CLI Guide

Command-line reference for Solana vanity address generation using `solana-keygen grind`.

---

## Overview

The `solana-keygen grind` command generates Solana keypairs with addresses matching a specified pattern. PumpKit includes production-ready Bash wrappers in `tools/` that add validation, security, and batch capabilities.

---

## Quick Start

```bash
# Generate an address starting with "Sol"
solana-keygen grind --starts-with Sol:1

# Generate case-insensitive match
solana-keygen grind --starts-with Sol:1 --ignore-case

# Generate using PumpKit wrapper (adds security + validation)
./tools/generate-vanity.sh Sol
```

---

## Base58 Characters

Solana addresses use Base58 encoding, which **excludes** four characters to avoid visual ambiguity:

| Character | Excluded? | Reason |
|-----------|-----------|--------|
| `0` (zero) | ❌ Excluded | Looks like `O` |
| `O` (capital O) | ❌ Excluded | Looks like `0` |
| `I` (capital I) | ❌ Excluded | Looks like `l` |
| `l` (lowercase L) | ❌ Excluded | Looks like `I` |

**Valid characters:** `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`

---

## Command Reference

### `solana-keygen grind`

The core command for vanity generation.

#### Options

| Flag | Description | Example |
|------|-------------|---------|
| `--starts-with PREFIX:COUNT` | Match address start | `--starts-with Sol:1` |
| `--ends-with SUFFIX:COUNT` | Match address end | `--ends-with Pay:1` |
| `--starts-and-ends-with P:S:COUNT` | Match both | `--starts-and-ends-with Sol:Pay:1` |
| `--ignore-case` | Case-insensitive matching | Reduces search time ~2x per letter char |
| `--num-threads N` | Worker threads | Default: all cores |
| `--no-outfile` | Print to stdout only | **Insecure** — key shown on screen |

#### Examples

```bash
# Prefix only
solana-keygen grind --starts-with Pump:1

# Suffix only
solana-keygen grind --ends-with Fun:1

# Both prefix and suffix
solana-keygen grind --starts-and-ends-with Pump:Fun:1

# Multiple matches (find 5)
solana-keygen grind --starts-with Sol:5

# Limited threads
solana-keygen grind --starts-with Sol:1 --num-threads 4

# Case insensitive
solana-keygen grind --starts-with pump:1 --ignore-case
```

---

## Time Estimates

Generation time increases exponentially with pattern length:

| Length | Case-Sensitive | Case-Insensitive | Notes |
|--------|---------------|-------------------|-------|
| 1 char | < 1 second | < 1 second | Instant |
| 2 chars | < 1 second | < 1 second | Still fast |
| 3 chars | ~2 seconds | < 1 second | Common for vanity |
| 4 chars | ~2 minutes | ~30 seconds | Practical limit for most users |
| 5 chars | ~2 hours | ~30 minutes | Worth parallelizing |
| 6 chars | ~5 days | ~1 day | Use Rust generator instead |
| 7 chars | ~300 days | ~100 days | Impractical with solana-keygen |
| 8+ chars | Years | Years | Use Rust + GPU |

> These estimates assume 100K keys/second per core on modern hardware.

---

## PumpKit Script Wrappers

### `tools/generate-vanity.sh`

Production wrapper with validation, encryption, and backup.

```bash
# Basic usage
./tools/generate-vanity.sh Sol

# With options
./tools/generate-vanity.sh -c 5 -i -e Pay

# Full options
./tools/generate-vanity.sh [OPTIONS] <prefix>
  -s, --suffix <str>    Also match a suffix
  -c, --count <n>       Number of addresses (default: 1)
  -o, --output <dir>    Output directory (default: .)
  -t, --threads <n>     Thread count (default: all cores)
  -i, --ignore-case     Case-insensitive matching
  -e, --encrypt         Encrypt output with GPG
  -b, --backup          Create timestamped backup
  -n, --no-outfile      Print to stdout (INSECURE)
```

### `tools/batch-generate.sh`

Batch generation from a prefix file.

```bash
# Using a prefix file
./tools/batch-generate.sh prefixes.txt

# Prefix file format:
# Sol
# Pay:3
# App
# Dex:2

# With parallel jobs
./tools/batch-generate.sh -j 4 -o ./keys prefixes.txt
```

### `tools/utils.sh`

Shared utility functions sourced by other scripts:
- `is_valid_base58()` — Validate Base58 strings
- `validate_prefix()` — Validate prefix with error messages
- `set_secure_permissions()` — Set file permissions to 600
- `secure_delete()` — Overwrite then delete sensitive files
- `encrypt_with_gpg()` — GPG symmetric encryption
- `estimate_time()` — Time estimation for pattern length
- `check_solana_keygen()` — Verify dependencies

### `tools/test-rust.sh`

Test suite for the Rust vanity generator:
- Cargo fmt/clippy checks
- Release build
- Unit tests (10 iterations)
- Integration tests (10 iterations)
- Security tests (10 iterations)
- Performance tests + benchmarks

---

## Security Best Practices

### File Permissions

```bash
# Keypair files should be owner-only
chmod 600 my-keypair.json

# Verify permissions
ls -la my-keypair.json
# Should show: -rw------- 1 user user ...
```

### GPG Encryption

```bash
# Encrypt a keypair
gpg --symmetric --cipher-algo AES256 my-keypair.json

# Decrypt when needed
gpg --decrypt my-keypair.json.gpg > my-keypair.json
chmod 600 my-keypair.json
```

### Secure Deletion

```bash
# Linux: use shred
shred -vfz -n 3 my-keypair.json && rm -f my-keypair.json

# macOS: use gshred (from coreutils)
gshred -vfz -n 3 my-keypair.json && rm -f my-keypair.json

# Fallback: overwrite with random data
dd if=/dev/urandom of=my-keypair.json bs=1 count=$(wc -c < my-keypair.json)
rm -f my-keypair.json
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `solana-keygen: command not found` | Install Solana CLI: `sh -c "$(curl -sSfL https://release.solana.com/stable/install)"` |
| Invalid Base58 characters | Check for 0, O, I, l in your pattern |
| Generation too slow | Use `--ignore-case`, reduce pattern length, or use Rust generator |
| Permission denied | Run `chmod +x tools/*.sh` |
| GPG not found | Install: `sudo apt install gnupg` (Linux) or `brew install gnupg` (macOS) |

---

## Quick Reference Card

```
┌─────────────────────────────────────────────┐
│  Solana Vanity Address Quick Reference      │
├─────────────────────────────────────────────┤
│  Basics:                                     │
│    solana-keygen grind --starts-with X:1     │
│    ./tools/generate-vanity.sh X              │
│                                              │
│  Options:                                    │
│    --ignore-case     Faster matching         │
│    --num-threads N   Control parallelism     │
│    --ends-with X:1   Suffix matching         │
│                                              │
│  Security:                                   │
│    chmod 600 *.json  Secure permissions      │
│    --encrypt         GPG encryption          │
│    shred -vfz file   Secure delete           │
│                                              │
│  Valid Base58:                                │
│    123456789ABCDEFGHJKLMNPQRSTUVWXYZ         │
│    abcdefghijkmnopqrstuvwxyz                 │
│  (No: 0, O, I, l)                            │
└─────────────────────────────────────────────┘
```

---

## Related

- [Tutorial 13: Vanity Addresses](../tutorials/13-vanity-addresses.md) — Vanity generation overview
- [Tutorial 30: Batch Shell Scripts](../tutorials/30-batch-shell-scripts.md) — Shell scripting guide
- [Tutorial 31: Rust Vanity Deep Dive](../tutorials/31-rust-vanity-deep-dive.md) — Rust generator internals
