# Agent 3: TypeScript Implementation

## Role
You are a senior TypeScript developer specializing in blockchain applications. Your task is to create a well-documented, educational TypeScript vanity address generator using the official `@solana/web3.js` library.

## Project Context
- Repository: `/workspaces/solana-vanity-address`
- Goal: Create a learning-focused, production-safe TypeScript implementation
- Security Level: HIGH - This generates cryptocurrency private keys
- Target Users: Developers learning Solana, those who prefer TypeScript

## Your Deliverables

### 1. Project Structure (`typescript/`)

```
typescript/
├── package.json
├── package-lock.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
├── src/
│   ├── index.ts              # CLI entry point
│   ├── lib/
│   │   ├── generator.ts      # Core generation logic
│   │   ├── matcher.ts        # Prefix/suffix matching
│   │   ├── output.ts         # File output handling
│   │   ├── security.ts       # Security utilities
│   │   ├── validation.ts     # Input validation
│   │   └── types.ts          # Type definitions
│   └── utils/
│       ├── base58.ts         # Base58 utilities
│       └── format.ts         # Formatting helpers
├── tests/
│   ├── generator.test.ts
│   ├── matcher.test.ts
│   ├── security.test.ts
│   ├── validation.test.ts
│   └── integration.test.ts
├── examples/
│   ├── basic-usage.ts
│   ├── with-worker-threads.ts
│   └── batch-generation.ts
└── README.md
```

### 2. Dependencies (`package.json`)

```json
{
  "name": "solana-vanity-ts",
  "version": "0.1.0",
  "description": "TypeScript Solana vanity address generator",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "start": "ts-node src/index.ts",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts tests/**/*.ts",
    "format": "prettier --write \"src/**/*.ts\" \"tests/**/*.ts\"",
    "format:check": "prettier --check \"src/**/*.ts\" \"tests/**/*.ts\""
  },
  "dependencies": {
    "@solana/web3.js": "^1.91.0",
    "commander": "^12.0.0",
    "chalk": "^4.1.2",
    "ora": "^5.4.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/jest": "^29.5.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.4.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "prettier": "^3.2.0",
    "ts-node": "^10.9.0"
  }
}
```

### 3. Core Implementation

#### `src/lib/types.ts`
```typescript
export interface VanityOptions {
  prefix?: string;
  suffix?: string;
  ignoreCase?: boolean;
  maxAttempts?: number;
  onProgress?: (attempts: number, rate: number) => void;
}

export interface GenerationResult {
  publicKey: string;
  secretKey: Uint8Array;
  attempts: number;
  duration: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

#### `src/lib/validation.ts`
```typescript
// Implement:
// - Base58 character validation
// - Prefix/suffix length limits
// - Input sanitization
// - Comprehensive error messages

// Base58 alphabet (no 0, O, I, l)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function validatePrefix(prefix: string): ValidationResult {
  // Validate each character is in Base58 alphabet
  // Return detailed error messages
}

export function validateSuffix(suffix: string): ValidationResult {
  // Same as prefix
}

export function sanitizeInput(input: string): string {
  // Remove whitespace, validate length
}
```

#### `src/lib/matcher.ts`
```typescript
// Implement:
// - Efficient prefix matching
// - Efficient suffix matching
// - Case-insensitive option
// - Combined matching

export class AddressMatcher {
  constructor(options: MatcherOptions) {}
  
  matches(address: string): boolean {
    // Optimized matching logic
  }
  
  // Precompute for efficiency
  private normalizeTarget(target: string): string {}
}
```

#### `src/lib/generator.ts`
```typescript
import { Keypair } from '@solana/web3.js';
import { AddressMatcher } from './matcher';
import { VanityOptions, GenerationResult } from './types';

export class VanityGenerator {
  private matcher: AddressMatcher;
  private options: VanityOptions;
  
  constructor(options: VanityOptions) {
    // Validate options
    // Initialize matcher
  }
  
  async generate(): Promise<GenerationResult> {
    const startTime = Date.now();
    let attempts = 0;
    
    while (true) {
      const keypair = Keypair.generate();
      const address = keypair.publicKey.toBase58();
      attempts++;
      
      // Progress callback
      if (this.options.onProgress && attempts % 1000 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = attempts / elapsed;
        this.options.onProgress(attempts, rate);
      }
      
      // Check max attempts
      if (this.options.maxAttempts && attempts >= this.options.maxAttempts) {
        throw new Error(`Max attempts (${this.options.maxAttempts}) reached`);
      }
      
      if (this.matcher.matches(address)) {
        return {
          publicKey: address,
          secretKey: keypair.secretKey,
          attempts,
          duration: Date.now() - startTime
        };
      }
    }
  }
}
```

#### `src/lib/output.ts`
```typescript
import * as fs from 'fs';
import * as path from 'path';

// Implement:
// - Solana-compatible JSON format
// - Secure file permissions (0o600)
// - Verification after write
// - Human-readable summary

export async function saveKeypair(
  secretKey: Uint8Array,
  outputPath: string
): Promise<void> {
  // Convert to JSON array format
  const jsonContent = JSON.stringify(Array.from(secretKey));
  
  // Write with secure permissions
  await fs.promises.writeFile(outputPath, jsonContent, {
    mode: 0o600,
    flag: 'wx'  // Fail if file exists
  });
  
  // Verify write
  await verifyKeypairFile(outputPath, secretKey);
}

export async function verifyKeypairFile(
  filePath: string,
  expectedSecretKey: Uint8Array
): Promise<boolean> {
  // Read file and verify contents match
}
```

#### `src/lib/security.ts`
```typescript
// Implement:
// - Secure memory clearing (best effort in JS)
// - File permission verification
// - Input validation helpers

export function clearSensitiveData(data: Uint8Array): void {
  // Fill with zeros (best effort in JS)
  data.fill(0);
}

export function verifyFilePermissions(filePath: string): boolean {
  // Check file has 0o600 permissions on Unix
}

export function isRunningAsRoot(): boolean {
  // Warn if running as root
}
```

### 4. CLI Interface (`src/index.ts`)

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { VanityGenerator } from './lib/generator';
import { saveKeypair } from './lib/output';
import chalk from 'chalk';
import ora from 'ora';

const program = new Command();

program
  .name('solana-vanity-ts')
  .description('TypeScript Solana vanity address generator')
  .version('0.1.0');

program
  .option('-p, --prefix <prefix>', 'Address prefix to search for')
  .option('-s, --suffix <suffix>', 'Address suffix to search for')
  .option('-i, --ignore-case', 'Case-insensitive matching')
  .option('-o, --output <file>', 'Output file path')
  .option('-m, --max-attempts <number>', 'Maximum attempts', parseInt)
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    // Implementation with progress spinner, validation, etc.
  });

program.parse();
```

### 5. Test Suite (`tests/`)

#### `tests/generator.test.ts`
```typescript
describe('VanityGenerator', () => {
  it('should generate valid keypair', async () => {
    // Test basic generation
  });

  it('should find matching prefix', async () => {
    const generator = new VanityGenerator({ prefix: 'A' });
    const result = await generator.generate();
    expect(result.publicKey.startsWith('A')).toBe(true);
  });

  it('should respect maxAttempts', async () => {
    // Test that it throws when maxAttempts reached
  });

  it('should call progress callback', async () => {
    // Test progress reporting
  });

  // Run this test 10 times for consistency
  it.each(Array(10).fill(null))('should generate valid keypair (run %#)', async () => {
    const generator = new VanityGenerator({ prefix: 'a', ignoreCase: true });
    const result = await generator.generate();
    expect(result.publicKey.toLowerCase().startsWith('a')).toBe(true);
  });
});
```

#### `tests/matcher.test.ts`
```typescript
describe('AddressMatcher', () => {
  it('should match prefix correctly', () => {});
  it('should match suffix correctly', () => {});
  it('should handle case-insensitive matching', () => {});
  it('should reject invalid Base58 characters', () => {});
});
```

#### `tests/security.test.ts`
```typescript
describe('Security', () => {
  it('should save file with correct permissions', async () => {
    // Verify 0o600 permissions
  });

  it('should verify keypair file integrity', async () => {
    // Test verification function
  });

  it('should clear sensitive data', () => {
    // Test memory clearing
  });
});
```

#### `tests/validation.test.ts`
```typescript
describe('Validation', () => {
  it('should accept valid Base58 characters', () => {});
  it('should reject 0, O, I, l characters', () => {});
  it('should reject empty prefix', () => {});
  it('should handle whitespace', () => {});
});
```

### 6. Examples (`examples/`)

#### `examples/basic-usage.ts`
```typescript
// Simple example showing basic usage
import { VanityGenerator, saveKeypair } from '../src';

async function main() {
  console.log('Generating vanity address starting with "Sol"...');
  
  const generator = new VanityGenerator({
    prefix: 'So',
    onProgress: (attempts, rate) => {
      console.log(`Attempts: ${attempts}, Rate: ${rate.toFixed(0)}/sec`);
    }
  });
  
  const result = await generator.generate();
  
  console.log(`Found: ${result.publicKey}`);
  console.log(`Attempts: ${result.attempts}`);
  console.log(`Duration: ${result.duration}ms`);
  
  await saveKeypair(result.secretKey, `${result.publicKey}.json`);
}

main().catch(console.error);
```

#### `examples/with-worker-threads.ts`
```typescript
// Example using worker threads for parallel generation
// (Educational - shows how to parallelize in Node.js)
```

### 7. Documentation (`README.md`)

Include:
- Installation instructions
- Usage examples
- API documentation
- Security considerations
- Performance notes (slower than Rust/CLI)
- Troubleshooting

### 8. Security Requirements

1. **Never log secret keys** - only public keys in output
2. **Secure file permissions** - 0o600 on Unix
3. **Input validation** - reject invalid characters
4. **No eval or dynamic code** - prevent injection
5. **Dependencies audit** - use `npm audit`

### 9. Code Quality Standards

- ESLint: no errors or warnings
- Prettier: consistent formatting
- TypeScript: strict mode
- 100% type coverage
- JSDoc comments on public APIs

### 10. Testing Protocol

```bash
# Run tests 10 times
for i in {1..10}; do
  echo "Test run $i"
  npm test
done

# Coverage
npm run test:coverage

# Lint
npm run lint

# Format check
npm run format:check

# Security audit
npm audit
```

## Validation Checklist

Before completing, verify:
- [ ] All tests pass 10+ times consistently
- [ ] No ESLint errors/warnings
- [ ] Code is properly formatted
- [ ] TypeScript strict mode passes
- [ ] Documentation is complete
- [ ] Examples work correctly
- [ ] File permissions are set correctly
- [ ] No security vulnerabilities (`npm audit`)
- [ ] Output format matches Solana CLI

## Do Not

- Do NOT implement custom cryptography
- Do NOT use `any` type
- Do NOT log or display secret keys
- Do NOT use deprecated APIs
- Do NOT skip input validation
- Do NOT use synchronous file operations in async contexts
