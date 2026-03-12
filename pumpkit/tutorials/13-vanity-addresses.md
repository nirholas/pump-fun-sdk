# Tutorial 13: Generating Vanity Addresses

> Create Solana addresses with custom prefixes or suffixes using the Pump vanity generators.

## Overview

The Pump SDK repository includes three vanity address generators:

| Generator | Language | Speed | Use Case |
|-----------|----------|-------|----------|
| **Rust** (`rust/`) | Rust | ~100K+ keys/sec | Production |
| **TypeScript** (`typescript/`) | TypeScript | ~1K keys/sec | Educational |
| **Shell** (`scripts/`) | Bash + solana-keygen | ~10K keys/sec | Quick CLI |

## Option 1: Rust Generator (Fastest)

### Build

```bash
cd rust/
cargo build --release
```

### Generate a Vanity Address

```bash
# Address starting with "pump"
./target/release/pump-vanity --prefix pump

# Address ending with "SDK"
./target/release/pump-vanity --suffix SDK

# Case-insensitive match
./target/release/pump-vanity --prefix pump --case-insensitive

# Set timeout
./target/release/pump-vanity --prefix pump --timeout 120
```

### Output

The generator outputs a JSON keypair file compatible with `solana-keygen`:

```
Found vanity address: pumpXyz...
Keypair saved to: pumpXyz....json
Time: 2.3s
Attempts: 234,567
Rate: 101,985 keys/sec
```

### Security

- Uses official `solana-sdk` for key generation
- Multi-threaded with `rayon` for parallelism  
- Zeroizes key material after writing
- Sets file permissions to `0600`

## Option 2: Shell Scripts (Quick CLI)

### Generate

```bash
cd scripts/

# Generate a vanity address
./generate-vanity.sh --prefix pump

# Batch generate multiple addresses
./batch-generate.sh --prefix pump --count 5

# Verify a generated keypair
./verify-keypair.sh keypair.json
```

### How It Works

The shell scripts wrap `solana-keygen grind`, the official Solana CLI tool:

```bash
# Under the hood:
solana-keygen grind --starts-with pump:1
```

## Option 3: TypeScript Generator (Educational)

The TypeScript generator in `typescript/` demonstrates how vanity generation works using `@solana/web3.js`:

```typescript
import { Keypair } from "@solana/web3.js";

function generateVanityAddress(prefix: string, timeout: number = 60): Keypair | null {
  const start = Date.now();
  let attempts = 0;

  while (Date.now() - start < timeout * 1000) {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();
    attempts++;

    if (address.startsWith(prefix)) {
      console.log(`Found after ${attempts} attempts`);
      return keypair;
    }
  }

  console.log(`Timeout after ${attempts} attempts`);
  return null;
}

const result = generateVanityAddress("AB");
if (result) {
  console.log("Address:", result.publicKey.toBase58());
}
```

## Using the MCP Server

The MCP server exposes vanity generation as tools for AI agents:

```json
{
  "tool": "generate_vanity",
  "arguments": {
    "prefix": "pump",
    "caseInsensitive": true,
    "timeout": 60
  }
}
```

Or estimate how long it'll take:

```json
{
  "tool": "estimate_vanity_time",
  "arguments": {
    "prefix": "pump"
  }
}
```

## Difficulty Estimation

Each Base58 character added to the prefix/suffix increases difficulty by ~58x:

| Prefix Length | Avg Attempts | Time (100K/sec) |
|--------------|-------------|-----------------|
| 1 char | ~58 | Instant |
| 2 chars | ~3,364 | <1 sec |
| 3 chars | ~195,112 | ~2 sec |
| 4 chars | ~11M | ~2 min |
| 5 chars | ~656M | ~2 hours |
| 6 chars | ~38B | ~4 days |

## Security Best Practices

1. **Only use official crypto**: `solana-sdk` (Rust), `@solana/web3.js` (TS), `solana-keygen` (CLI)
2. **Never use third-party vanity generators** — they could steal your keys
3. **Zeroize key material** after saving to file
4. **Set file permissions** to `0600` (owner read/write only)
5. **No network calls** during key generation
6. **Verify keypairs** after generation: `solana-keygen verify <pubkey> keypair.json`

## What's Next?

- [Tutorial 14: x402 Paywalled APIs](./14-x402-paywalled-apis.md)
- [Tutorial 15: Decoding On-Chain Accounts](./15-decoding-accounts.md)
