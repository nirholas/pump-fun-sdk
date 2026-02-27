---
name: pump-mcp-server
description: "Model Context Protocol server exposing 47 tools, 3 resource types, and 3 prompts for AI agent consumption — quoting, building transactions, fee management, analytics, AMM operations, social fees, wallet operations over stdio transport."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
---

# MCP Server — Model Context Protocol for Solana Wallet Operations

Model Context Protocol server exposing tools, resources, and prompts for AI agent consumption over stdio transport with session keypair management.

## Architecture

```
AI Agent (Claude, etc.)
        │
    stdio transport
        │
   SolanaWalletMCPServer
        │
   ┌────┼────────┬──────────┐
   │    │        │          │
  Tools Resources Prompts  Session
   │    │        │        State
   7    3        3         │
  tools types   prompts  Keypair
```

## Tools (7)

| Tool | Description |
|------|-------------|
| `generate_keypair` | Generate a new random Solana keypair |
| `generate_vanity` | Generate vanity address with prefix/suffix |
| `estimate_vanity_time` | Estimate time for vanity pattern |
| `validate_address` | Validate a Solana Base58 address |
| `sign_message` | Sign a message with session keypair |
| `verify_signature` | Verify a signed message |
| `restore_keypair` | Restore keypair from secret key bytes |

## Resources (3)

| URI Pattern | Description |
|-------------|-------------|
| `solana://keypair/current` | Current session keypair info |
| `solana://keypair/{id}` | Specific keypair by ID |
| `solana://address/{address}` | Address validation details |

## Prompts (3)

| Prompt | Description |
|--------|-------------|
| `generate-wallet` | Guide user through wallet generation |
| `vanity-address` | Guide vanity address generation with difficulty estimate |
| `security-review` | Review security of wallet operations |

## Session State Management

```typescript
class SolanaWalletMCPServer {
    private sessionKeypair: Keypair | null = null;

    generateKeypair(): KeypairInfo {
        if (this.sessionKeypair) {
            this.sessionKeypair.secretKey.fill(0); // zeroize old
        }
        this.sessionKeypair = Keypair.generate();
        return this.getKeypairInfo();
    }
}
```

## Security Model

- Session keypair is zeroized when replaced or server shuts down
- No network calls for key generation
- All crypto uses `@solana/web3.js` only
- Zod schemas validate all tool inputs
- Secret key bytes are never logged or exposed in resources

## Patterns to Follow

- Validate all inputs with Zod schemas before processing
- Zeroize secret keys when replaced or on shutdown
- Return structured JSON for all tool responses
- Use descriptive error messages for validation failures
- Keep session state minimal — one active keypair at a time

## Common Pitfalls

- Session keypair is ephemeral — lost when server restarts
- `generate_vanity` is single-threaded — long prefixes will be slow
- `sign_message` requires an active session keypair — `generate_keypair` first
- Resource URIs are case-sensitive
