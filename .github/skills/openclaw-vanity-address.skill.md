# OpenClaw Vanity Address — Custom Solana Address Generation

## Skill Description

Generate Solana keypairs with custom Base58 prefix and/or suffix patterns using the MCP `generate_vanity` tool, with time estimation via `estimate_vanity_time`, backed by both a high-performance Rust generator (100K+ keys/sec) and a TypeScript reference implementation.

## Context

Vanity addresses are Solana keypairs whose Base58 public key starts or ends with a user-chosen pattern (e.g., an address starting with "PUMP"). This is a brute-force search — keypairs are generated and checked until a match is found. The MCP server provides a TypeScript implementation (~15K keys/sec, single-threaded), while the Rust binary achieves 100K+ keys/sec using Rayon parallel iterators. Both use only official Solana Labs cryptographic libraries.

## Key Files

- [mcp-server/src/tools/index.ts](mcp-server/src/tools/index.ts) — `generate_vanity` and `estimate_vanity_time` tool handlers
- [mcp-server/src/utils/validation.ts](mcp-server/src/utils/validation.ts) — `PrefixSchema`, `SuffixSchema` for Base58 validation
- [rust/src/main.rs](rust/src/main.rs) — Rust CLI entry point
- [rust/src/generator.rs](rust/src/generator.rs) — Rayon-based parallel keypair generation
- [rust/src/matcher.rs](rust/src/matcher.rs) — Base58 pattern matching logic
- [rust/src/security.rs](rust/src/security.rs) — Secure file output with `0600` permissions
- [typescript/src/](typescript/src/) — TypeScript vanity generator (educational reference)
- [scripts/generate-vanity.sh](scripts/generate-vanity.sh) — Bash wrapper for Rust binary

## MCP Tools

### estimate_vanity_time

Estimate how long a pattern will take to find:

```typescript
// Input
{
  prefix?: string,          // Base58 prefix to match (max 6 chars)
  suffix?: string,          // Base58 suffix to match
  caseInsensitive?: boolean // Case-insensitive matching (default: false)
}

// Output
{
  estimatedAttempts: number,   // Expected number of keypairs to generate
  estimatedTimeSeconds: number, // Time at ~15K keys/sec (TypeScript)
  difficulty: string,           // "easy" | "moderate" | "hard" | "very hard"
  pattern: string               // The combined pattern description
}
```

**Difficulty scale:**
- 1-2 chars: Easy (seconds)
- 3 chars: Moderate (minutes)
- 4 chars: Hard (hours)
- 5+ chars: Very hard (days+)

### generate_vanity

Generate a keypair matching the specified pattern:

```typescript
// Input
{
  prefix?: string,          // Base58 prefix (max 6 chars)
  suffix?: string,          // Base58 suffix
  caseInsensitive?: boolean, // Case-insensitive matching
  timeout?: number,         // Max seconds (1-300, default: 60)
  saveId?: string           // Session ID to store the keypair
}

// Output
{
  publicKey: string,        // Matching Base58 public key
  privateKey: string,       // Base58 secret key
  keypairArray: string,     // JSON array (Solana CLI format)
  pattern: string,          // Pattern that was matched
  attempts: number,         // Keypairs generated before match
  timeMs: number,           // Time taken in milliseconds
  savedAs?: string          // Session ID if saveId provided
}
```

## Base58 Alphabet

Valid characters for prefix/suffix patterns:

```
123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
```

Note: `0`, `O`, `I`, and `l` are **NOT** valid Base58 characters. Patterns containing these characters will never match.

## Rust Generator (Production)

For high-throughput generation, use the Rust binary:

```bash
# Generate with prefix
cargo run --release -- --prefix PUMP

# Generate with suffix
cargo run --release -- --suffix cool

# Case-insensitive matching
cargo run --release -- --prefix pump --case-insensitive

# Output to file with secure permissions
cargo run --release -- --prefix PUMP --output keypair.json
```

Performance: 100K+ keys/sec using all CPU cores via Rayon parallel iterators.

### Rust Architecture

```
main.rs → Config parsing
  └─ generator.rs → Rayon parallel generation loop
       ├─ matcher.rs → Base58 pattern matching
       └─ security.rs → File output (mode 0600) + zeroization
```

## TypeScript Generator (Educational)

Single-threaded async implementation with event-loop yielding:

```typescript
import { generateVanityAddress } from './vanity';

const result = await generateVanityAddress({
  prefix: 'PUMP',
  caseInsensitive: true,
  timeout: 60000,  // ms
});
```

Yields to the event loop via `setTimeout(0)` every 1000 iterations to prevent blocking.

## Security Model

1. **Official crypto only** — `Keypair.generate()` from `@solana/web3.js` (TS), `solana_sdk::signer::keypair` (Rust)
2. **Memory zeroization** — Secret keys zeroed after file write (Rust) or on shutdown (MCP)
3. **File permissions** — Keypair files written with mode `0600` (owner read/write only)
4. **No network** — All generation is fully offline
5. **Timeout protection** — MCP tool enforces 1-300 second timeout to prevent runaway searches

## Patterns to Follow

- Always call `estimate_vanity_time` before `generate_vanity` so the user knows what to expect
- Use case-insensitive matching to dramatically reduce search time
- Keep patterns to 4 characters or fewer for reasonable generation times in TypeScript
- Use the Rust generator for 5+ character patterns
- Save generated vanity keypairs with `saveId` for use in subsequent operations
- Validate that patterns contain only valid Base58 characters before searching

## Common Pitfalls

- Using `0`, `O`, `I`, or `l` in patterns — these are not valid Base58 characters
- Setting timeout too low for difficult patterns — the search returns empty
- Expecting TypeScript performance to match Rust — TypeScript is ~100x slower
- Forgetting that vanity generation blocks the Node.js event loop without yielding
- Not saving the keypair (`saveId`) — if lost, the vanity address cannot be recovered
- Patterns longer than 6 characters — effectively impossible to find in reasonable time
