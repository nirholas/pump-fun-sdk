# Scripts

Production Bash wrappers for Solana vanity address generation and keypair management. All scripts use `solana-keygen` from the official Solana CLI — no third-party crypto libraries.

## Scripts

### `generate-vanity.sh`

Generate a Solana vanity address with a specific prefix or suffix.

```bash
./scripts/generate-vanity.sh --prefix pump --output ./keys
./scripts/generate-vanity.sh --suffix fun --count 3 --encrypt
```

**Features**: Input validation, secure file permissions (`0600`), progress feedback, automatic backup, optional GPG encryption.

### `batch-generate.sh`

Generate multiple vanity addresses from a list of prefixes.

```bash
echo -e "pump\nfun\nsol" > prefixes.txt
./scripts/batch-generate.sh prefixes.txt --output ./batch_output
```

**Features**: Read prefixes from file, parallel generation with job control, progress tracking, summary report.

### `verify-keypair.sh`

Verify a generated keypair is valid and matches expected patterns.

```bash
./scripts/verify-keypair.sh ./keys/pumpXYZ.json --prefix pump
```

**Features**: Loads keypair from JSON, verifies public key derivation, confirms prefix/suffix match, checks file permissions, outputs verification report.

### `test-rust.sh`

Run the Rust vanity generator test suite.

```bash
./scripts/test-rust.sh
```

### `publish-clawhub.sh`

Deployment helper script for publishing.

```bash
./scripts/publish-clawhub.sh
```

### `utils.sh`

Shared utility functions sourced by other scripts. Provides:
- Color output helpers
- Input validation
- Permission checking
- Common configuration

## Security

All scripts follow the project security rules:

1. **Only official Solana Labs tools** — uses `solana-keygen` exclusively
2. **File permissions** — keypair files set to `0600` (owner read/write only)
3. **No network calls** — key generation is fully offline
4. **Key zeroization** — sensitive data cleared from memory after use
5. **GPG encryption** — optional at-rest encryption for generated keys

## Requirements

- Bash 4+
- `solana-keygen` (from [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools))
- `gpg` (optional, for encryption)
