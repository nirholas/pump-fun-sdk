# TypeScript Vanity Address Generator — Educational Reference Implementation

## Skill Description

Build and maintain the TypeScript vanity address generator — a single-threaded, educational reference implementation of the Solana vanity address generator using `@solana/web3.js`, with async iteration, event-loop yielding, and identical output format to the Rust version.

## Context

The TypeScript implementation (`solana-vanity-ts`) serves as an accessible, educational counterpart to the high-performance Rust generator. It achieves ~15–20K keys/second (single-threaded) and is designed for readability, testability, and integration with Node.js tooling. Output format is identical to the Rust version and the Solana CLI.

## Key Files

- `typescript/src/index.ts` — CLI entry point (hand-rolled arg parser)
- `typescript/src/lib/generator.ts` — `VanityGenerator` class with async generation
- `typescript/src/lib/matcher.ts` — `AddressMatcher` class
- `typescript/src/lib/validation.ts` — Base58 validation, difficulty estimation
- `typescript/src/lib/output.ts` — keypair file save/load/verify
- `typescript/src/lib/security.ts` — security checks, best-effort memory clearing
- `typescript/src/lib/types.ts` — type definitions, `VanityError` class
- `typescript/src/utils/base58.ts` — Base58 alphabet, probability helpers
- `typescript/src/utils/format.ts` — number/duration/rate formatters
- `typescript/src/lib/index.ts` — library barrel export
- `typescript/package.json` — `solana-vanity-ts` package config

## Key Concepts

### Architecture

```
src/index.ts (CLI)
  ├─ lib/generator.ts (VanityGenerator class)
  │   ├─ lib/matcher.ts (AddressMatcher)
  │   └─ lib/validation.ts (input validation)
  ├─ lib/output.ts (file I/O)
  ├─ lib/security.ts (security checks)
  └─ utils/ (base58, formatting)
```

### CLI Interface

| Flag | Description |
|------|-------------|
| `-p, --prefix` | Prefix pattern |
| `-s, --suffix` | Suffix pattern |
| `-i, --ignore-case` | Case-insensitive matching |
| `-o, --output` | Output file path |
| `-m, --max-attempts` | Maximum attempt cap |
| `-v, --verbose` | Detailed progress |
| `--no-verify` | Skip file verification |
| `--overwrite` | Overwrite existing files |
| `--security-check` | Pre-generation security checks |
| `info` | Display Base58 info + difficulty table |
| `validate <pattern>` | Validate a pattern |

### Generation Engine

Single-threaded async loop with event-loop yielding:

```typescript
async generate(): Promise<GenerationResult> {
  while (attempts < maxAttempts) {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();
    
    if (this.matcher.matches(address)) {
      return { publicKey: address, secretKey: keypair.secretKey, attempts, duration };
    }
    
    if (attempts % 1000 === 0) this.reportProgress();
    if (attempts % 10000 === 0) await new Promise(r => setImmediate(r)); // yield
  }
  throw new VanityError(VanityErrorType.MAX_ATTEMPTS_REACHED);
}
```

Key design decisions:
- `setImmediate` every 10K iterations prevents blocking the event loop
- Progress callback every 1K iterations for UI responsiveness
- `maxAttempts` cap instead of signal-based cancellation
- `async` generator variant (`createVanityGenerator`) for streaming results

### Library API

Three ways to use the generator programmatically:

```typescript
// 1. One-shot
const result = await generateVanityAddress({ prefix: "Sol" });

// 2. Multiple
await generateMultipleVanityAddresses({ prefix: "A" }, 5, (result, i) => { ... });

// 3. AsyncGenerator (streaming)
for await (const result of createVanityGenerator({ prefix: "B" })) { ... }
```

### Address Matching

`AddressMatcher` pre-normalizes patterns for case-insensitive matching:

```typescript
matches(address: string): boolean {
  const addr = this.ignoreCase ? address.toLowerCase() : address;
  if (this.prefix && !addr.startsWith(this.normalizedPrefix)) return false;
  if (this.suffix && !addr.endsWith(this.normalizedSuffix)) return false;
  return true;
}
```

### Input Validation

- `MAX_PATTERN_LENGTH = 6` (stricter than Rust's 8)
- Validates each character against `BASE58_ALPHABET`
- `estimateAttempts(prefix?, suffix?, ignoreCase?)` — $58^n$ (case-sensitive) or $34^n$ (case-insensitive)
- Returns structured `ValidationResult` with error array

### File Output

```typescript
async function saveKeypair(secretKey: Uint8Array, outputPath: string, options?: OutputOptions): Promise<void> {
  // Check existence (unless --overwrite)
  // Create directories
  // Write JSON array format: [byte0, byte1, ..., byte63]
  // Set permissions to 0o600
  // Optionally verify by re-reading
}
```

### Security (Best-Effort in JavaScript)

JavaScript's garbage collector prevents guaranteed memory clearing, but the implementation uses best-effort:

```typescript
function clearSensitiveData(data: Uint8Array): void {
  data.fill(0);                          // Zero out
  crypto.getRandomValues(data);          // Random fill
  data.fill(0);                          // Zero again
}
```

Additional checks:
- Root/elevated privilege detection (`process.getuid() === 0`)
- VM/container detection (Docker, cgroup)
- File permission verification (`stat.mode & 0o077 === 0`)
- SSH without TTY detection

### Error Handling

Typed errors via `VanityError` class:

| Error Type | When Thrown |
|-----------|------------|
| `INVALID_CHARACTERS` | Non-Base58 characters in pattern |
| `INPUT_TOO_LONG` | Pattern exceeds 6 characters |
| `MAX_ATTEMPTS_REACHED` | Exceeded attempt limit |
| `FILE_ERROR` | File I/O failure |
| `FILE_EXISTS` | Output file exists (without --overwrite) |
| `VERIFICATION_FAILED` | Post-write verification failed |
| `NO_PATTERN_SPECIFIED` | Neither prefix nor suffix given |

## Differences from Rust Implementation

| Aspect | TypeScript | Rust |
|--------|-----------|------|
| Performance | ~15–20K keys/sec | ~100K+ keys/sec |
| Parallelism | Single-threaded + yields | Multi-threaded (Rayon) |
| Max pattern | 6 characters | 8 characters |
| Memory security | Best-effort fill/random/fill | `zeroize` crate, RAII guards |
| Cancellation | `maxAttempts` cap | `AtomicBool` + signal handler |
| CLI parser | Hand-rolled `process.argv` | `clap` derive |
| Crypto source | `@solana/web3.js` | `solana-sdk` |

## Patterns to Follow

- Always yield to the event loop (`setImmediate`) in the generation loop — never block for more than a few ms
- Use `Uint8Array` for all key material, never convert to string
- Report progress via callbacks, not console output (library-friendly)
- File permissions must be set to `0o600` immediately after write
- Validate all user input with `validateVanityInput` before starting generation
- Document the memory-clearing limitation clearly for security-conscious users

## Testing

- Jest test suite: `typescript/tests/`
- `npm test` runs all tests via `ts-jest`
- Test both the library API and CLI arg parser
- Test file output format matches Solana CLI expectations
- Test Base58 validation edge cases

