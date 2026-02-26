# Test Fixtures

This directory contains test fixtures for the Solana Vanity Address Generator test suite.

## ⚠️ SECURITY WARNING

**DO NOT USE THESE KEYPAIRS FOR REAL FUNDS!**

The keypairs in this directory are for **testing purposes only**. They are:
- Publicly known (committed to version control)
- Potentially compromised
- Not generated with proper entropy for production use

**Never** transfer real SOL or tokens to addresses derived from these keypairs.

## Contents

### `invalid-inputs.txt`
A list of invalid input patterns that should be rejected by all implementations. Each line contains an invalid pattern with a comment explaining why it's invalid.

### `valid-keypairs/`
Pre-generated valid keypair files for testing. These are used to verify that:
- Keypair files can be parsed correctly
- Public key derivation works
- Signature verification works

#### `test-keypair-1.json`
- Public Key: `16GH5Ro4Wd8wQNJZq4qJdJn3hZqDiErDPHCqZgJ3Ehx`
- Generated for testing purposes only

#### `test-keypair-2.json`
- Public Key: `1HVgXXYJ8nLDTaJxK6vLJQ3rPwWzmHmJHZqSVaAQJnz`
- Generated for testing purposes only

## Usage in Tests

### Loading test keypairs (TypeScript)
```typescript
import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';

const keypairData = JSON.parse(fs.readFileSync('tests/fixtures/valid-keypairs/test-keypair-1.json', 'utf-8'));
const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
```

### Loading test keypairs (Rust)
```rust
use solana_sdk::signer::keypair::Keypair;
use std::fs;

let keypair_data: Vec<u8> = serde_json::from_str(
    &fs::read_to_string("tests/fixtures/valid-keypairs/test-keypair-1.json")?
)?;
let keypair = Keypair::from_bytes(&keypair_data)?;
```

### Loading test keypairs (CLI)
```bash
solana-keygen pubkey tests/fixtures/valid-keypairs/test-keypair-1.json
```

## Adding New Fixtures

When adding new test fixtures:

1. **Never** commit real keypairs
2. Generate keypairs specifically for testing
3. Document the public key and purpose
4. Add to `.gitignore` any keypairs generated during test runs
