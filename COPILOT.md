# Pump SDK — GitHub Copilot Instructions

> Official community PumpFun SDK for creating, buying, and selling tokens on the Solana blockchain. Bonding curve pricing, AMM migration, tiered fees, creator fee sharing, token incentives, and vanity address generation.

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
| `website/` | PumpOS web desktop (static HTML/CSS/JS) |
| `x402/` | x402 payment protocol integration |
| `tutorials/` | 19 hands-on tutorial guides |
| `telegram-bot/` | PumpFun activity monitor bot (fee claims, CTO, whale, graduation) |
| `websocket-server/` | WebSocket relay — PumpFun API to browser clients |
| `live/` | Real-time token launch + trades dashboards |
| `lair-tg/` | Lair — unified Telegram bot platform for DeFi intelligence |
| `prompts/` | Agent prompt templates |

## Three On-Chain Programs

| Program | ID | Purpose |
|---------|-----|---------|
| Pump | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve (create/buy/sell tokens) |
| PumpAMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Graduated token AMM pools |
| PumpFees | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing and distribution |

## SDK Architecture

- **Offline SDK (`PumpSdk`)** — Builds `TransactionInstruction[]` without a connection. Exported as singleton `PUMP_SDK`.
- **Online SDK (`OnlinePumpSdk`)** — Extends offline SDK with RPC fetchers. Uses `getMultipleAccountsInfo` for batching.
- **Both return `TransactionInstruction[]`**, never `Transaction` objects — callers compose transactions.

## Key Patterns

### Instruction Building
```typescript
import { PUMP_SDK, OnlinePumpSdk } from "@pump-fun/pump-sdk";

// Offline (no connection needed)
const ix = await PUMP_SDK.createV2Instruction({ mint, name, symbol, uri, creator, user, mayhemMode: false });

// Online (needs connection for state fetching, offline SDK for instruction building)
const sdk = new OnlinePumpSdk(connection);
const global = await sdk.fetchGlobal();
const { bondingCurve, bondingCurveAccountInfo, associatedUserAccountInfo } = await sdk.fetchBuyState(mint, user);
const ixs = await PUMP_SDK.buyInstructions({
  global, bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo,
  mint, user, solAmount, amount, slippage: 1, tokenProgram: TOKEN_PROGRAM_ID,
});
```

### Bonding Curve Math
```typescript
import { getBuyTokenAmountFromSolAmount, getSellSolAmountFromTokenAmount } from "@pump-fun/pump-sdk";

const tokens = getBuyTokenAmountFromSolAmount({ global, feeConfig, mintSupply, bondingCurve, amount });
const sol = getSellSolAmountFromTokenAmount({ global, feeConfig, mintSupply, bondingCurve, amount });
```

### BN Arithmetic
All token/SOL amounts use `BN` (bn.js). Never use JavaScript `number` for financial math.

## Official Pump Protocol Docs

**Canonical protocol specs** from pump-fun/pump-public-docs are in `docs/pump-official/`. Read these before modifying on-chain code:

| Task | Read This File |
|------|---------------|
| Bonding curve buy/sell/create, Global/BondingCurve state | `docs/pump-official/PUMP_PROGRAM_README.md` |
| Creator fees on bonding curve | `docs/pump-official/PUMP_CREATOR_FEE_README.md` |
| AMM pool swap/deposit/withdraw, Pool/GlobalConfig state | `docs/pump-official/PUMP_SWAP_README.md` |
| PumpSwap SDK methods & autocomplete helpers | `docs/pump-official/PUMP_SWAP_SDK_README.md` |
| Creator fees on AMM pools | `docs/pump-official/PUMP_SWAP_CREATOR_FEE_README.md` |
| Dynamic fee tiers, market-cap-based fee calculation | `docs/pump-official/FEE_PROGRAM_README.md` |
| Cashback rewards, UserVolumeAccumulator PDA | `docs/pump-official/PUMP_CASHBACK_README.md` |
| CU optimization, PDA bump effects | `docs/pump-official/FAQ.md` |
| create_v2, Token2022, mayhem mode, social fees | `docs/pump-official/README.md` |
| Official IDL files | `docs/pump-official/idl/pump.json`, `pump_amm.json`, `pump_fees.json` |

## Security Rules

1. **NEVER** add non-official cryptographic dependencies
2. Approved crypto: `solana-sdk` (Rust), `@solana/web3.js` (TS), `solana-keygen` (CLI)
3. Zeroize all key material after use
4. Set keypair file permissions to `0600`
5. No network calls for key generation (offline only)

## Skill Files

See `.github/skills/` for detailed agent skill documents. Each skill has an `applyTo` frontmatter pattern — skills are only loaded when editing files matching their glob.

Domains covered: SDK core, bonding curve math, token lifecycle, fee system, fee sharing, token incentives, Solana program architecture, security practices, Rust/TypeScript vanity generators, shell scripting, MCP server.

## Performance Constraints

| Component | Metric | Notes |
|-----------|--------|-------|
| SDK offline instructions | < 1ms | Pure functions, no async |
| SDK online (RPC) | 50–500ms | Batch with `getMultipleAccountsInfo` |
| Rust vanity | 100K+ keys/sec | Multi-threaded; use for production |
| TS vanity | ~1K keys/sec | Educational only |
| WebSocket relay | 10K conn, 50K msg/sec | Per vCPU |

> Full benchmarks: `docs/performance.md`

## MCP Server Status

The MCP server is **implemented** in `mcp-server/`. It provides 55 tools, 4 resources, and 5 prompts via MCP v2024-11-05. See `mcp-server/README.md`.

## Terminal Management (MANDATORY)

> **CRITICAL: Every terminal you open MUST be killed after use. No exceptions.**

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** (`kill_terminal`) after the command completes, whether it succeeds or fails — **never leave terminals open**
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal
- **Failure to kill terminals is a blocking violation** — treat it as seriously as a security issue

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


