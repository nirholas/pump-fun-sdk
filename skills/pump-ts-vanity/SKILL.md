---
name: Pump TypeScript Vanity Generator
description: >
  Educational single-threaded TypeScript vanity address generator for Solana using
  @solana/web3.js with async iteration, event-loop yielding, streaming generator API,
  and best-effort memory zeroization.
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
---

# TypeScript Vanity Generator — Educational Reference Implementation

Single-threaded TypeScript vanity address generator using @solana/web3.js with async iteration, event-loop yielding, and streaming generator API.

## Architecture

```
CLI / Library API
        │
   VanityGenerator
        │
   async generator loop
        │
   Keypair.generate() per iteration
        │
   AddressMatcher.matches()
        │
   yield on match / yield progress
```

## Library API (3 Usage Patterns)

```typescript
// 1. Async generator (streaming)
for await (const result of generateVanityAddress({ prefix: 'pump' })) {
    console.log(result.address);
    break; // stop after first match
}

// 2. First match (promise)
const result = await findVanityAddress({ prefix: 'pump' });

// 3. Batch generation
const results = await findVanityAddresses({ prefix: 'So', count: 5 });
```

## Event-Loop Yielding

```typescript
async function* generateVanityAddress(config: VanityConfig) {
    let attempts = 0;
    while (true) {
        attempts++;
        if (attempts % 1000 === 0) {
            await new Promise(resolve => setImmediate(resolve));
        }
        const keypair = Keypair.generate();
        const address = keypair.publicKey.toBase58();
        if (matcher.matches(address)) {
            yield { keypair, address, attempts };
        }
    }
}
```

Yields to the event loop every 1,000 iterations to prevent blocking.

## Performance Comparison

| Feature | Rust | TypeScript |
|---------|------|-----------|
| Speed | 100K+ keys/sec | ~5K keys/sec |
| Parallelism | Rayon (multi-core) | Single-threaded |
| Memory safety | Zeroize trait | Best-effort fill(0) |
| Use case | Production | Educational/prototyping |

## Best-Effort Security

```typescript
// Zeroize secret key after use
const secretKey = keypair.secretKey;
try {
    // ... use keypair
} finally {
    secretKey.fill(0);
}
```

JavaScript's garbage collector may copy/relocate buffers, so `fill(0)` is best-effort.

## Patterns to Follow

- Use `@solana/web3.js` `Keypair.generate()` — never custom RNG
- Yield to event loop periodically in async generators
- Call `secretKey.fill(0)` after use (best-effort zeroization)
- Validate Base58 patterns before starting generation
- Use `setImmediate` or `setTimeout(0)` for yielding, not `process.nextTick`

## Common Pitfalls

- Single-threaded — orders of magnitude slower than Rust for long prefixes
- GC may relocate buffers before `fill(0)` — no guaranteed memory cleanup in JS
- Base58 is case-sensitive — validate user input patterns
- `Keypair.generate()` returns 64-byte array (32 secret + 32 public)
