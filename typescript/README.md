# Solana Vanity Address Generator (TypeScript)

A TypeScript implementation of a Solana vanity address generator using the official `@solana/web3.js` library. This educational tool generates cryptographically secure Solana keypairs where the public address matches your desired prefix and/or suffix pattern.

## ⚠️ Security Notice

This tool generates **private keys** for cryptocurrency wallets. Please understand:

- **Never share** your generated keypair files with anyone
- **Store backups** in secure locations
- **Never commit** keypair files to version control
- The keypair file contains your **private key** - losing it means losing access to your funds

## Features

- 🔐 **Secure Generation**: Uses `@solana/web3.js` Keypair.generate() with cryptographically secure randomness
- 🎯 **Prefix & Suffix Matching**: Find addresses that start and/or end with your pattern
- 🔠 **Case Insensitive**: Optional case-insensitive matching
- 📁 **Solana CLI Compatible**: Output format works with `solana config set --keypair`
- 🔒 **Secure File Permissions**: Keypair files created with 0600 permissions
- ✅ **File Verification**: Verifies written files for integrity
- 📊 **Progress Reporting**: Real-time feedback on generation progress

## Installation

```bash
# Clone the repository
git clone https://github.com/hippopotomonstrosesquippedaliophobi/solana-vanity-address.git
cd solana-vanity-address/typescript

# Install dependencies
npm install

# Build the project
npm run build
```

## Quick Start

### CLI Usage

```bash
# Generate an address starting with "So"
npm start -- --prefix So

# Generate an address ending with "na"
npm start -- --suffix na

# Case-insensitive matching
npm start -- --prefix sol --ignore-case

# Both prefix and suffix
npm start -- --prefix So --suffix na

# Specify output file
npm start -- --prefix So --output my-keypair.json

# Show all options
npm start -- --help
```

### Programmatic Usage

```typescript
import { VanityGenerator, saveKeypair } from 'solana-vanity-ts';

async function main() {
  // Create a generator
  const generator = new VanityGenerator({
    prefix: 'So',
    onProgress: (attempts, rate) => {
      console.log(`${attempts} attempts, ${rate}/sec`);
    },
  });

  // Generate the address
  const result = await generator.generate();

  console.log(`Found: ${result.publicKey}`);
  console.log(`Attempts: ${result.attempts}`);

  // Save securely
  await saveKeypair(result.secretKey, `${result.publicKey}.json`);
}

main();
```

## CLI Options

| Option | Short | Description |
|--------|-------|-------------|
| `--prefix <string>` | `-p` | Address prefix to search for (Base58 characters) |
| `--suffix <string>` | `-s` | Address suffix to search for (Base58 characters) |
| `--ignore-case` | `-i` | Enable case-insensitive matching |
| `--output <file>` | `-o` | Output file path (default: `<address>.json`) |
| `--max-attempts <n>` | `-m` | Maximum attempts before giving up |
| `--verbose` | `-v` | Show detailed progress |
| `--overwrite` | | Overwrite existing output file |
| `--security-check` | | Run security checks before generation |
| `--help` | `-h` | Show help |
| `--version` | `-V` | Show version |

### Additional Commands

```bash
# Show information about vanity addresses
npm start -- info

# Validate a pattern
npm start -- validate "Sol"
```

## Base58 Character Set

Solana addresses use Base58 encoding. Valid characters are:

```
123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
```

**Excluded characters** (to avoid confusion):
- `0` (zero)
- `O` (uppercase O)
- `I` (uppercase I)
- `l` (lowercase L)

## Difficulty Estimates

Finding a vanity address becomes exponentially harder with each additional character:

| Characters | Expected Attempts | Est. Time (~15K/sec) |
|------------|------------------|----------------------|
| 1 | 58 | < 1 second |
| 2 | 3,364 | < 1 second |
| 3 | 195,112 | ~13 seconds |
| 4 | 11,316,496 | ~12 minutes |
| 5 | 656,356,768 | ~12 hours |
| 6 | 38,068,692,544 | ~29 days |

**Note**: These are statistical averages. Actual time may vary.

## API Reference

### VanityGenerator

```typescript
import { VanityGenerator } from 'solana-vanity-ts';

const generator = new VanityGenerator({
  prefix?: string;      // Address prefix to match
  suffix?: string;      // Address suffix to match
  ignoreCase?: boolean; // Case-insensitive matching (default: false)
  maxAttempts?: number; // Maximum attempts before giving up
  onProgress?: (attempts: number, rate: number) => void;
});

// Generate an address
const result = await generator.generate();
// result.publicKey - The matching address (string)
// result.secretKey - The secret key (Uint8Array)
// result.attempts  - Number of attempts made
// result.duration  - Time taken in milliseconds
```

### saveKeypair

```typescript
import { saveKeypair } from 'solana-vanity-ts';

await saveKeypair(secretKey, outputPath, {
  overwrite?: boolean; // Overwrite existing file (default: false)
  verify?: boolean;    // Verify file after writing (default: true)
});
```

### Validation Functions

```typescript
import {
  validatePrefix,
  validateSuffix,
  isValidBase58Char,
  estimateAttempts,
} from 'solana-vanity-ts';

// Validate a prefix
const result = validatePrefix('Sol');
if (!result.valid) {
  console.log(result.errors);
}

// Check a single character
const isValid = isValidBase58Char('S'); // true
const isInvalid = isValidBase58Char('0'); // false

// Estimate difficulty
const attempts = estimateAttempts('Sol'); // 195112
```

## Examples

See the [examples/](./examples/) directory:

- **[basic-usage.ts](./examples/basic-usage.ts)** - Simple generation example
- **[with-worker-threads.ts](./examples/with-worker-threads.ts)** - Parallel generation using worker threads
- **[batch-generation.ts](./examples/batch-generation.ts)** - Generate multiple addresses

Run examples with:

```bash
npx ts-node examples/basic-usage.ts
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Check formatting
npm run format:check

# Format code
npm run format

# Type check
npm run typecheck
```

### Building

```bash
# Build TypeScript
npm run build

# Clean build artifacts
npm run clean
```

## Performance

The TypeScript implementation achieves approximately **15,000-20,000 attempts per second** on modern hardware.

For faster generation, consider:
1. Using the **Rust CLI implementation** (100,000+ attempts/sec)
2. Using **worker threads** for parallel generation (see examples)
3. Reducing pattern length

## Security Best Practices

1. **Run on trusted hardware** - Don't generate keys on shared or public computers
2. **Verify integrity** - Check that saved files match generated keys
3. **Secure storage** - Use encrypted storage for keypair files
4. **Minimal permissions** - Files are created with 0600 (owner read/write only)
5. **Clear memory** - Use `clearSensitiveData()` to zero out secret keys after use

```typescript
import { clearSensitiveData } from 'solana-vanity-ts';

// After using the secret key
clearSensitiveData(result.secretKey);
```

## Troubleshooting

### "Invalid character" error

Your pattern contains characters not in the Base58 alphabet. Check for:
- Zero (`0`) - use `o` instead
- Uppercase O (`O`) - use `o` instead
- Uppercase I (`I`) - use `i` instead
- Lowercase L (`l`) - use `L` instead

### "File already exists" error

The output file already exists. Either:
- Choose a different output path with `--output`
- Use `--overwrite` to replace the existing file

### Generation is taking too long

Longer patterns take exponentially longer. Consider:
- Shortening your pattern
- Using case-insensitive matching (`--ignore-case`)
- Using the Rust implementation for better performance

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Acknowledgments

- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/) - Official Solana JavaScript API
- [Commander.js](https://github.com/tj/commander.js/) - CLI framework
- [Chalk](https://github.com/chalk/chalk) - Terminal string styling
