# MCP Server — Model Context Protocol for Solana Wallet Operations

## Skill Description

Build and extend the MCP (Model Context Protocol) server that exposes Solana wallet operations to AI assistants. Implements tools, resources, and prompts following the MCP 2024-11-05 specification over stdio transport.

## Context

The `solana-wallet-toolkit` MCP server enables AI assistants (like Claude) to generate keypairs, create vanity addresses, sign/verify messages, and validate addresses through a structured protocol. It uses JSON-RPC 2.0 over stdin/stdout, keeps keypairs in session memory with automatic zeroization on shutdown, and provides guided prompts for multi-step workflows.

## Key Files

- `mcp-server/src/index.ts` — CLI entry point (shebang `#!/usr/bin/env node`)
- `mcp-server/src/server.ts` — `SolanaWalletMCPServer` class, server state, lifecycle
- `mcp-server/src/handlers/tools.ts` — tool listing and dispatch
- `mcp-server/src/handlers/resources.ts` — resource listing and reading
- `mcp-server/src/handlers/prompts.ts` — prompt listing and retrieval
- `mcp-server/src/handlers/sampling.ts` — server-initiated LLM sampling helpers
- `mcp-server/src/tools/index.ts` — tool implementations (47 tools)
- `mcp-server/src/resources/config.ts` — server config resource
- `mcp-server/src/resources/keypair.ts` — keypair resource (public key only)
- `mcp-server/src/resources/address.ts` — address validation resource
- `mcp-server/src/resources/subscriptions.ts` — subscription stubs
- `mcp-server/src/prompts/index.ts` — prompt implementations (3 prompts)
- `mcp-server/src/types/index.ts` — all TypeScript interfaces
- `mcp-server/src/utils/validation.ts` — Zod schemas for input validation
- `mcp-server/src/utils/crypto.ts` — zeroize, ID generation, hex conversion
- `mcp-server/README.md` — setup and usage documentation
- `server.json` — MCP server manifest (package registration)

## Key Concepts

### Server Architecture

```
index.ts (#!/usr/bin/env node)
  └─ SolanaWalletMCPServer (server.ts)
       ├─ StdioServerTransport (stdin/stdout JSON-RPC 2.0)
       ├─ ServerState
       │   ├─ initialized: boolean
       │   ├─ clientCapabilities: object
       │   └─ generatedKeypairs: Map<string, {publicKey, secretKey}>
       ├─ handlers/
       │   ├─ tools.ts      → ListTools / CallTool
       │   ├─ resources.ts  → ListResources / ReadResource
       │   ├─ prompts.ts    → ListPrompts / GetPrompt
       │   └─ sampling.ts   → Server→Client LLM requests
       ├─ tools/index.ts    (7 implementations)
       ├─ resources/*.ts    (3 URI types)
       ├─ prompts/index.ts  (3 prompts)
       └─ utils/            (validation, crypto)
```

### Advertised Capabilities

```json
{
  "tools": { "listChanged": true },
  "resources": { "subscribe": false, "listChanged": true },
  "prompts": { "listChanged": true }
}
```

### Tools (7)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `generate_keypair` | Generate a new Solana Ed25519 keypair | `saveId?` |
| `generate_vanity` | Find a keypair matching prefix/suffix | `prefix?`, `suffix?`, `caseInsensitive`, `timeout` (1–300s), `saveId?` |
| `sign_message` | Sign a message with a stored or provided keypair | `message`, `keypairId?` or `privateKey?` |
| `verify_signature` | Verify an Ed25519 signature | `message`, `signature`, `publicKey` |
| `validate_address` | Check if a string is a valid Solana address | `address` |
| `estimate_vanity_time` | Estimate generation time for a pattern | `prefix?`, `suffix?`, `caseInsensitive` |
| `restore_keypair` | Restore a keypair from a private key | `privateKey?`, `seedPhrase?` (deferred), `saveId?` |

### Resources (3 URI patterns)

| URI | Type | Returns |
|-----|------|---------|
| `solana://config` | Static | Server version, capabilities, session stats, security policy |
| `solana://keypair/{id}` | Dynamic | Public key + metadata for a saved keypair (never exposes private key) |
| `solana://address/{pubkey}` | Dynamic | Address validation, Ed25519 curve check, session match |

### Prompts (3)

| Prompt | Purpose | Arguments |
|--------|---------|-----------|
| `create_wallet` | Guided wallet creation workflow | `type?` ("standard" or "vanity") |
| `security_audit` | Security best practices checklist | None |
| `batch_generate` | Generate multiple keypairs | `count` (max 100) |

### Session State Management

Keypairs are stored in an in-memory `Map<string, {publicKey, secretKey}>`:
- `saveId` parameter on generation tools persists the keypair to session
- Resources can query saved keypairs by ID
- On shutdown (`SIGINT`/`SIGTERM`), all secret keys are zeroized from memory

### Input Validation (Zod Schemas)

```typescript
const base58Schema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]+$/);
const solanaAddressSchema = z.string().min(32).max(44).regex(base58Pattern);
const prefixSchema = z.string().max(6).regex(base58Pattern);
const privateKeySchema = z.string().min(64).max(128);
```

### Crypto Operations

- **Keypair generation**: `Keypair.generate()` from `@solana/web3.js`
- **Signing**: `nacl.sign.detached(message, secretKey)` from `tweetnacl`
- **Verification**: `nacl.sign.detached.verify(message, signature, publicKey)`
- **Vanity generation**: Single-threaded loop with `setTimeout(0)` yields (~15K keys/sec)

### Security Model

- Secret keys are returned in tool results but **never logged** to stderr
- All logging goes to stderr (stdout reserved for MCP protocol)
- `zeroize()` fills `Uint8Array` with zeros on shutdown
- Resources never expose private keys — only public keys and metadata
- Seed phrase recovery is intentionally NOT implemented (directs to Solana CLI)

### Server Manifest (`server.json`)

```json
{
  "package_name": "io.github.nirholas/solana-wallet-toolkit",
  "version": "0.1.0",
  "transport": { "type": "stdio", "command": "npx", "args": ["-y", "..."] },
  "environment_variables": [
    { "name": "SOLANA_RPC_URL", "required": false },
    { "name": "SOLANA_PRIVATE_KEY", "required": false, "secret": true }
  ]
}
```

## Patterns to Follow

- All tool handlers validate args with Zod schemas before processing
- Return `{ isError: true }` on validation/execution errors, with descriptive text content
- Use `text` content type for all tool results (JSON-formatted strings)
- Log to stderr only — stdout is the MCP protocol channel
- Register handlers in `server.ts` during construction, not lazily
- Use dynamic imports in handlers to keep tool implementations modular
- Resource URIs follow `solana://` scheme with path-based routing
- Prompts return `messages` arrays with `user` role — they guide, not execute

## Common Pitfalls

- stdout contamination — any `console.log` breaks the MCP protocol; use `console.error` for logging
- Vanity generation blocks the event loop — must yield with `setTimeout(0)` periodically
- `saveId` is optional — tools must work without it (keypair returned but not persisted)
- Subscription handlers are stubbed — don't rely on `subscribe` capability
- The sampling module exists but is not wired into the main handler registration
- `timeout` for vanity generation defaults to 60 seconds but can be set up to 300
- Seed phrase recovery returns an error message directing users to the Solana CLI

## Testing

- Test tools individually via simulated `CallToolRequest` objects
- Test resource URI routing with valid/invalid/malformed URIs
- Validate Zod schemas accept valid input and reject edge cases
- Test session state persistence across multiple tool calls
- Test shutdown zeroization by inspecting memory after SIGINT
- Integration test: connect a real MCP client to the server over stdio

