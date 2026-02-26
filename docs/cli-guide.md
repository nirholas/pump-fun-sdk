# Solana Vanity Address CLI Guide

A comprehensive guide to generating custom Solana wallet addresses using the official Solana CLI tools.

## Table of Contents

- [Overview](#overview)
- [Installation Prerequisites](#installation-prerequisites)
- [Command Reference](#command-reference)
- [Performance Estimates](#performance-estimates)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

A **vanity address** is a cryptocurrency wallet address that contains a custom prefix, suffix, or both. For example, you might want an address that starts with `SOL` or `MyApp`. The Solana CLI provides the `solana-keygen grind` command to generate these addresses through brute-force searching.

### What is Base58?

Solana uses **Base58** encoding for addresses, which includes:
- **Uppercase letters**: `A-H`, `J-N`, `P-Z` (excludes `I`, `O`)
- **Lowercase letters**: `a-k`, `m-z` (excludes `l`)
- **Numbers**: `1-9` (excludes `0`)

**Invalid characters**: `0` (zero), `O` (capital o), `I` (capital i), `l` (lowercase L)

These characters are excluded to prevent visual confusion.

---

## Installation Prerequisites

### System Requirements

- **Operating System**: Linux, macOS, or Windows with WSL2
- **CPU**: Multi-core recommended (more cores = faster generation)
- **Memory**: 1GB minimum
- **Disk Space**: 500MB for Solana CLI tools

### Installing Solana CLI

#### Linux / macOS

```bash
# Install the Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Add to PATH (add to ~/.bashrc or ~/.zshrc for persistence)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify installation
solana --version
solana-keygen --version
```

#### macOS (Homebrew Alternative)

```bash
brew install solana
```

#### Windows (WSL2)

```bash
# First, ensure WSL2 is installed with Ubuntu
wsl --install -d Ubuntu

# Then follow Linux installation steps inside WSL
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
```

### Version Requirements

- **Minimum**: Solana CLI v1.16.0
- **Recommended**: Latest stable release

```bash
# Check your version
solana --version

# Update to latest
solana-install update
```

### Verification Steps

```bash
# Verify solana-keygen is accessible
which solana-keygen

# Test basic functionality
solana-keygen new --no-bip39-passphrase --no-outfile

# Should output a public key - this confirms the tool works
```

---

## Command Reference

### `solana-keygen grind`

The main command for generating vanity addresses.

```bash
solana-keygen grind [OPTIONS]
```

### Options

#### `--starts-with <PREFIX>`

Generate an address starting with the specified prefix.

```bash
# Generate address starting with "SOL"
solana-keygen grind --starts-with SOL:1

# The ":1" means generate 1 matching keypair
# Multiple prefixes can be specified
solana-keygen grind --starts-with SOL:1 --starts-with ABC:2
```

#### `--ends-with <SUFFIX>`

Generate an address ending with the specified suffix.

```bash
# Generate address ending with "pay"
solana-keygen grind --ends-with pay:1
```

#### `--starts-and-ends-with <PREFIX:SUFFIX>`

Generate an address with both a specific prefix and suffix.

```bash
# Generate address starting with "My" and ending with "App"
solana-keygen grind --starts-and-ends-with My:App:1
```

#### `--ignore-case`

Perform case-insensitive matching (increases success rate ~64x for each letter).

```bash
# Match "sol", "Sol", "SOL", "soL", etc.
solana-keygen grind --starts-with sol:1 --ignore-case
```

#### `--num-threads <NUM>`

Specify the number of CPU threads to use (default: all available).

```bash
# Use 4 threads
solana-keygen grind --starts-with ABC:1 --num-threads 4

# Check available threads
nproc  # Linux
sysctl -n hw.ncpu  # macOS
```

#### `--no-outfile`

Output the keypair to stdout instead of saving to a file.

```bash
# Print to stdout (JSON format)
solana-keygen grind --starts-with AB:1 --no-outfile
```

**⚠️ Warning**: This displays the secret key! Use only for testing or piping to secure storage.

#### `--use-mnemonic`

Generate a mnemonic phrase alongside the keypair.

```bash
solana-keygen grind --starts-with AB:1 --use-mnemonic
```

### Output File Naming

By default, keypairs are saved with the following naming convention:

```
<PUBLIC_KEY>.json
```

For example: `SOLabcXYZ123...789.json`

The file contains a JSON array of 64 bytes representing the secret key.

### Examples

```bash
# Simple 2-character prefix
solana-keygen grind --starts-with AB:1

# Case-insensitive 3-character prefix
solana-keygen grind --starts-with sol:1 --ignore-case

# Generate 5 addresses with same prefix
solana-keygen grind --starts-with My:5

# Specific prefix and suffix
solana-keygen grind --starts-and-ends-with Pay:Now:1

# Multiple different prefixes
solana-keygen grind --starts-with SOL:1 --starts-with PAY:1 --starts-with DEX:1

# Maximum performance (all cores, case insensitive)
solana-keygen grind --starts-with abcd:1 --ignore-case --num-threads $(nproc)
```

---

## Performance Estimates

### Time Estimates by Prefix Length

Vanity address generation time grows **exponentially** with prefix length. Each additional character multiplies the average time by ~58 (the Base58 alphabet size).

| Prefix Length | Avg. Combinations | Estimated Time (8 cores) | With `--ignore-case` |
|---------------|-------------------|--------------------------|----------------------|
| 1 char        | ~58               | < 1 second               | < 1 second           |
| 2 chars       | ~3,364            | < 1 second               | < 1 second           |
| 3 chars       | ~195,112          | 1-5 seconds              | < 1 second           |
| 4 chars       | ~11.3 million     | 30 sec - 2 min           | 1-5 seconds          |
| 5 chars       | ~656 million      | 10-30 minutes            | 30 sec - 2 min       |
| 6 chars       | ~38 billion       | 8-24 hours               | 15-45 minutes        |
| 7 chars       | ~2.2 trillion     | 2-4 weeks                | 12-36 hours          |
| 8 chars       | ~128 trillion     | 1-3 years                | 2-6 weeks            |

**Note**: Times are estimates and vary based on CPU speed and luck.

### CPU Core Scaling

Performance scales nearly linearly with CPU cores:

| Cores | Relative Speed |
|-------|---------------|
| 1     | 1x            |
| 2     | ~2x           |
| 4     | ~4x           |
| 8     | ~7.5x         |
| 16    | ~14x          |
| 32    | ~27x          |

```bash
# Check your CPU core count
nproc                    # Linux
sysctl -n hw.ncpu        # macOS
cat /proc/cpuinfo | grep processor | wc -l  # Linux alternative
```

### Case Sensitivity Impact

Using `--ignore-case` dramatically reduces search time:

- Each letter has 2 case variants (upper/lower)
- A 4-letter prefix with `--ignore-case`: 2^4 = 16x faster
- Numbers and some letters have no case variants

### Optimization Tips

1. **Use all available cores**: Default behavior, but verify with `--num-threads`
2. **Use `--ignore-case`**: When case doesn't matter
3. **Choose efficient characters**: Some characters appear more frequently
4. **Start with shorter prefixes**: Test with 2-3 chars first
5. **Consider suffix matching**: Sometimes suffix is easier

---

## Security Best Practices

### ⚠️ Critical Security Rules

1. **NEVER share your secret key** - Anyone with the secret key controls the wallet
2. **NEVER upload keypair files** to cloud storage, GitHub, or any online service
3. **NEVER send keypair files** via email, chat, or any electronic communication
4. **NEVER generate keys** on shared or compromised systems

### File Permissions

Always set restrictive permissions on keypair files:

```bash
# Set owner-only read/write (recommended)
chmod 600 <keypair-file>.json

# Verify permissions
ls -la <keypair-file>.json
# Should show: -rw------- 1 user user ...

# Alternatively, owner read-only
chmod 400 <keypair-file>.json
```

### Secure Storage Recommendations

1. **Encrypted Storage**
   ```bash
   # Encrypt with GPG
   gpg --symmetric --cipher-algo AES256 keypair.json
   
   # Decrypt when needed
   gpg --decrypt keypair.json.gpg > keypair.json
   ```

2. **Hardware Security**
   - Store on encrypted USB drives
   - Consider hardware wallets for high-value addresses
   - Keep offline backups in secure physical locations

3. **Backup Strategy**
   - Create multiple encrypted backups
   - Store in geographically separate locations
   - Test restoration periodically

### Verification After Generation

Always verify your keypair after generation:

```bash
# Extract public key from keypair file
solana-keygen pubkey <keypair-file>.json

# Verify it matches the filename and your expected prefix
# The output should start with your chosen prefix

# Verify the keypair is valid
solana-keygen verify <PUBLIC_KEY> <keypair-file>.json
```

### Secure Deletion

When deleting test or temporary keypair files:

```bash
# Secure deletion (Linux)
shred -vfz -n 5 <keypair-file>.json

# macOS (install coreutils for gshred)
brew install coreutils
gshred -vfz -n 5 <keypair-file>.json

# Alternative: overwrite then delete
dd if=/dev/urandom of=<keypair-file>.json bs=1024 count=1 2>/dev/null
rm -f <keypair-file>.json
```

### Environment Security Checklist

Before generating vanity addresses:

- [ ] Using a trusted, non-shared computer
- [ ] Operating system is up-to-date
- [ ] No screen sharing or remote access active
- [ ] Antivirus/malware scan completed
- [ ] Working directory has restricted access
- [ ] Network connection is secure (or disconnected for maximum security)

---

## Troubleshooting

### Common Issues

#### "command not found: solana-keygen"

```bash
# Add Solana to PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Add to shell config for persistence
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

#### "Invalid character in prefix"

Ensure your prefix only contains valid Base58 characters:
- Valid: `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`
- Invalid: `0`, `O`, `I`, `l`

```bash
# This will fail - contains "0" (zero)
solana-keygen grind --starts-with A0B:1

# Use this instead
solana-keygen grind --starts-with AOB:1  # "O" is valid
```

#### Generation Taking Too Long

- Reduce prefix length
- Use `--ignore-case` flag
- Check CPU usage with `htop` or `top`
- Try a different prefix with more common starting characters

#### Permission Denied Errors

```bash
# Fix file permissions
chmod 600 <keypair-file>.json

# Fix directory permissions
chmod 700 <directory>
```

#### Out of Memory

```bash
# Limit threads to reduce memory usage
solana-keygen grind --starts-with ABC:1 --num-threads 2
```

### Getting Help

```bash
# View help for grind command
solana-keygen grind --help

# General keygen help
solana-keygen --help

# Check Solana documentation
# https://docs.solana.com/cli/wallets/file-system
```

---

## Quick Reference Card

```bash
# Basic generation
solana-keygen grind --starts-with <PREFIX>:1

# Case-insensitive
solana-keygen grind --starts-with <PREFIX>:1 --ignore-case

# With suffix
solana-keygen grind --ends-with <SUFFIX>:1

# Both prefix and suffix
solana-keygen grind --starts-and-ends-with <PREFIX>:<SUFFIX>:1

# Verify after generation
solana-keygen pubkey <file>.json
solana-keygen verify <PUBKEY> <file>.json

# Secure the file
chmod 600 <file>.json
```

---

## Additional Resources

- [Solana CLI Documentation](https://docs.solana.com/cli)
- [Solana Cookbook - Vanity Addresses](https://solana.com/cookbook/wallets/generate-vanity-address)
- [Base58 Encoding](https://en.wikipedia.org/wiki/Binary-to-text_encoding#Base58)

---

*This documentation is part of the Solana Vanity Address Toolkit. Always prioritize security when handling cryptocurrency private keys.*
