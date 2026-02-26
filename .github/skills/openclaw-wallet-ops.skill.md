# OpenClaw Wallet Operations — Keypair Generation, Signing & Validation

## Skill Description

Generate Solana Ed25519 keypairs, sign and verify messages, validate addresses, and manage session-based key storage through MCP tools — using only official Solana Labs cryptographic libraries with full memory zeroization on shutdown.

## Context

Wallet operations are the foundation of every on-chain interaction. This skill package covers secure keypair lifecycle management: generation, persistence, signing, verification, validation, and cleanup. All cryptographic operations use `@solana/web3.js` (Keypair, PublicKey) and `tweetnacl` (Ed25519 sign/verify). Secret keys are held in session memory and zeroized on server shutdown.

## Key Files

- [mcp-server/src/tools/index.ts](mcp-server/src/tools/index.ts) — Tool implementations for keypair operations
- [mcp-server/src/server.ts](mcp-server/src/server.ts) — Session state and shutdown zeroization
- [mcp-server/src/utils/validation.ts](mcp-server/src/utils/validation.ts) — Zod schemas for input validation
- [mcp-server/src/utils/crypto.ts](mcp-server/src/utils/crypto.ts) — Zeroize helper and hex conversion
- [mcp-server/src/resources/keypair.ts](mcp-server/src/resources/keypair.ts) — Keypair resource (public key only)
- [mcp-server/src/resources/address.ts](mcp-server/src/resources/address.ts) — Address validation resource

## Available Tools

### generate_keypair

Create a new Solana Ed25519 keypair using `Keypair.generate()`:

```typescript
// Input
{ saveId?: string }

// Output
{
  publicKey: string,      // Base58 public key
  privateKey: string,     // Base58 secret key (64 bytes)
  keypairArray: string,   // JSON array format (Solana CLI compatible)
  savedAs?: string        // Session ID if saveId provided
}
```

### sign_message

Sign a UTF-8 message with a stored or provided keypair:

```typescript
// Input
{
  message: string,         // UTF-8 message to sign
  keypairId?: string,      // Use a session-stored keypair
  privateKey?: string      // Or provide a Base58 private key directly
}

// Output
{
  signature: string,       // Base58 encoded Ed25519 signature
  publicKey: string,       // Signer's public key
  message: string          // Original message
}
```

### verify_signature

Verify an Ed25519 signature against a message and public key:

```typescript
// Input
{
  message: string,         // Original UTF-8 message
  signature: string,       // Base58 encoded signature
  publicKey: string        // Base58 public key of alleged signer
}

// Output
{
  valid: boolean,          // Signature verification result
  publicKey: string,
  message: string
}
```

### validate_address

Check if a string is a valid Solana address (Base58, 32-44 chars, on Ed25519 curve):

```typescript
// Input
{ address: string }

// Output
{
  valid: boolean,
  address: string,
  isOnCurve: boolean,      // Whether the key is on the Ed25519 curve
  matchesSession: boolean  // Whether it matches any session keypair
}
```

### restore_keypair

Restore a keypair from a Base58 private key:

```typescript
// Input
{
  privateKey: string,      // Base58 encoded secret key
  saveId?: string          // Optional session ID to store under
}

// Output
{
  publicKey: string,
  privateKey: string,
  savedAs?: string
}
```

## Session State

Keypairs are stored in an in-memory `Map<string, {publicKey, secretKey}>`:

```typescript
interface ServerState {
  initialized: boolean;
  clientCapabilities: object;
  generatedKeypairs: Map<string, { publicKey: Uint8Array; secretKey: Uint8Array }>;
}
```

- `saveId` parameter on generation tools persists the keypair
- Resources query saved keypairs by ID (public key only — never private)
- Shutdown zeroizes all `secretKey` arrays with `.fill(0)`

## Security Invariants

1. **Official libraries only** — `Keypair.generate()` from `@solana/web3.js`, `nacl.sign` from `tweetnacl`
2. **Memory zeroization** — All `Uint8Array` secret keys zeroed on `SIGINT`/`SIGTERM`
3. **No logging of secrets** — Private keys never written to stderr
4. **Resource isolation** — `solana://keypair/{id}` returns public key only
5. **Input validation** — All inputs validated with Zod schemas before processing

## Patterns to Follow

- Always validate Base58 encoding with regex before attempting decode
- Return `{ isError: true }` with descriptive messages on validation failures
- Use `text` content type for all tool results (JSON-formatted strings)
- Zeroize any temporary secret key material after use, not just on shutdown
- Prefer `saveId` for multi-step workflows so agents can reference keypairs later

## Common Pitfalls

- Providing both `keypairId` and `privateKey` to sign_message — only one should be used
- Forgetting that restore_keypair does NOT support seed phrases (defers to Solana CLI)
- Assuming `isOnCurve` means the address is a wallet — PDAs are valid addresses but not on curve
- Not zeroing temporary `Uint8Array` buffers created during signing operations
