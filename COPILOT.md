# Pump SDK — GitHub Copilot Instructions

> Community Pump program SDK for creating, buying, and selling tokens on the Solana blockchain. Bonding curve pricing, AMM migration, tiered fees, creator fee sharing, token incentives, and vanity address generation.

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `src/` | Core SDK — TypeScript instruction builders, state decoders, math |
| `rust/` | High-performance Rust vanity address generator (rayon + solana-sdk) |
| `typescript/` | TypeScript vanity address generator (@solana/web3.js) |
| `mcp-server/` | Model Context Protocol server for AI agent integration |
| `scripts/` | Production Bash scripts wrapping solana-keygen |
| `tools/` | Verification and audit utilities |
| `tests/` | Cross-language test suites |
| `docs/` | API reference, architecture, guides |
| `security/` | Security audits and checklists |
| `website/` | Next.js documentation site |
| `x402/` | x402 payment protocol integration |
| `prompts/` | Agent prompt templates |

## Three On-Chain Programs

| Program | ID | Purpose |
|---------|-----|---------|
| Pump | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve (create/buy/sell tokens) |
| PumpAMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Graduated token AMM pools |
| PumpFees | `FeesoLMvuSJeJdhTpaLMjdiEE9NtNzx5bVHUvgWe7XjB` | Fee sharing and distribution |

## SDK Architecture

- **Offline SDK (`PumpSdk`)** — Builds `TransactionInstruction[]` without a connection. Exported as singleton `PUMP_SDK`.
- **Online SDK (`OnlinePumpSdk`)** — Extends offline SDK with RPC fetchers. Uses `getMultipleAccountsInfo` for batching.
- **Both return `TransactionInstruction[]`**, never `Transaction` objects — callers compose transactions.

## Key Patterns

### Instruction Building
```typescript
import { PUMP_SDK, OnlinePumpSdk } from "@pump-fun/pump-sdk";

// Offline (no connection needed)
const ix = await PUMP_SDK.createV2Instruction({ mint, name, symbol, uri, creator, user });

// Online (needs connection)
const sdk = new OnlinePumpSdk(connection);
const ixs = await sdk.buyInstructions({ global, bondingCurve, mint, user, solAmount, amount, slippage });
```

### Bonding Curve Math
```typescript
import { getBuyTokenAmountFromSolAmount, getSellSolAmountFromTokenAmount } from "@pump-fun/pump-sdk";

const tokens = getBuyTokenAmountFromSolAmount({ global, feeConfig, mintSupply, bondingCurve, amount });
const sol = getSellSolAmountFromTokenAmount({ global, feeConfig, mintSupply, bondingCurve, amount });
```

### BN Arithmetic
All token/SOL amounts use `BN` (bn.js). Never use JavaScript `number` for financial math.

## Security Rules

1. **NEVER** add non-official cryptographic dependencies
2. Approved crypto: `solana-sdk` (Rust), `@solana/web3.js` (TS), `solana-keygen` (CLI)
3. Zeroize all key material after use
4. Set keypair file permissions to `0600`
5. No network calls for key generation (offline only)

## Skill Files

See `.github/skills/` for detailed agent skill documents covering:
- SDK core, bonding curve math, token lifecycle, fee system, fee sharing
- Token incentives, Solana program architecture, security practices
- Rust/TypeScript vanity generators, shell scripting, MCP server

## Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** after the command completes, whether it succeeds or fails — never leave terminals open
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal

## Testing

```bash
# TypeScript SDK
cd typescript && npm test

# Rust
cd rust && cargo test

# Integration
./docs/run-all-tests.sh
```

## Common Pitfalls

- `createInstruction` (v1) is deprecated — use `createV2Instruction` (Token-2022)
- `BondingCurve.complete === true` means graduated — bonding curve trading will fail
- `BONDING_CURVE_NEW_SIZE = 151` — accounts may need extension before migration
- Buy instruction passes `{ 0: true }` flags — this is intentional, not a bug
- Shares must total exactly 10,000 BPS (not 100 or 1,000,000)
- Circular dependency between `sdk.ts` and `onlineSdk.ts` — handle imports carefully
