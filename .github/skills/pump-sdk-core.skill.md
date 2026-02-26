# Pump SDK Core — Instruction Building & On-Chain Interaction

## Skill Description

Build, extend, and maintain the core Pump SDK — an offline-first TypeScript SDK that constructs Solana `TransactionInstruction`s for token creation, buying, selling, migration, and creator fee collection across three on-chain programs (Pump, PumpAMM, PumpFees) plus the Mayhem program.

## Context

The SDK is published as `@pump-fun/pump-sdk` (npm) and powers the Pump protocol — a Solana-based token launchpad with bonding curve pricing, automatic AMM migration after graduation, tiered fees, and creator fee sharing. The codebase uses Anchor for IDL-based instruction building and supports both Token (SPL) and Token-2022 token programs.

## Key Files

- `src/sdk.ts` — `PumpSdk` class with all instruction builders and account decoders
- `src/onlineSdk.ts` — `OnlinePumpSdk` class extending offline SDK with live RPC fetches
- `src/index.ts` — barrel re-export module defining the public API surface
- `src/state.ts` — TypeScript interfaces for all on-chain account state
- `src/pda.ts` — Program Derived Address derivation for all programs
- `src/idl/pump.ts`, `src/idl/pump_amm.ts`, `src/idl/pump_fees.ts` — Anchor IDL definitions

## Key Concepts

### Architecture

- **Offline SDK (`PumpSdk`)**: Builds instructions without a live connection. Uses Anchor `Program` instances initialized with a dummy keypair and connection. Exported as a singleton `PUMP_SDK`.
- **Online SDK (`OnlinePumpSdk`)**: Wraps `PumpSdk` with a real `Connection` for fetching account state via `getMultipleAccountsInfo`. Provides "BothPrograms" methods that aggregate data across bonding curve (Pump) and AMM (PumpAMM) programs.
- **Three program IDs**: `PUMP_PROGRAM_ID`, `PUMP_AMM_PROGRAM_ID`, `PUMP_FEE_PROGRAM_ID`, plus `MAYHEM_PROGRAM_ID` for mayhem-mode tokens.

### Instruction Builder Pattern

Every instruction method returns `TransactionInstruction[]` (not transactions), allowing callers to compose them into transactions freely. Methods follow a naming convention:
- `*Instruction` — single instruction
- `*Instructions` — multiple instructions (e.g., ATA creation + buy)

### Account Decoders

The SDK decodes raw `AccountInfo<Buffer>` into typed interfaces using the Anchor coder:
- `decodeGlobal`, `decodeBondingCurve`, `decodeFeeConfig`, `decodeSharingConfig`, etc.
- Nullable variants (e.g., `decodeBondingCurveNullable`) handle missing or undersized accounts gracefully.

### Token Lifecycle

1. **Create** (`createV2Instruction`) — mint a new token with Token-2022, optional mayhem mode
2. **Buy** (`buyInstructions`) — purchase tokens from the bonding curve with slippage protection
3. **Sell** (`sellInstructions`) — sell tokens back to the bonding curve
4. **Migrate** (`migrateInstruction`) — graduate a token from bonding curve to AMM pool
5. **Collect fees** (`collectCoinCreatorFeeInstructions`) — withdraw accumulated creator fees

### Slippage Calculation

```
maxSolCost = solAmount + (solAmount × slippage × 10 / 1000)
minSolReceived = solAmount - (solAmount × slippage × 10 / 1000)
```

### Fee Recipient Selection

The SDK randomly selects from `global.feeRecipients[]` (normal mode) or `global.reservedFeeRecipients[]` (mayhem mode) to distribute protocol fees.

## Patterns to Follow

- Always return `TransactionInstruction[]` from instruction builders, never full `Transaction` objects
- Use `getMultipleAccountsInfo` to batch RPC calls (2–3 accounts per call)
- Support both Token (SPL) and Token-2022 programs via `tokenProgram` parameter
- Handle account extension (`extendAccountInstruction`) for bonding curves that need more space
- Validate shareholder arrays: max 10 shareholders, shares must total 10,000 bps, no duplicates, no zero shares
- Use typed error classes from `src/errors.ts` for validation failures
- Keep the offline SDK connection-free; all RPC calls belong in `OnlinePumpSdk`

## Common Pitfalls

- Circular dependency between `sdk.ts` and `onlineSdk.ts` — `sdk.ts` imports `OFFLINE_PUMP_PROGRAM` from `onlineSdk.ts` and vice versa
- Buy instruction passes `{ 0: true }` as a flags argument — this is intentional, not a bug
- `BONDING_CURVE_NEW_SIZE = 151` — accounts may need extension before certain operations
- `BondingCurve.complete === true` means the token has graduated to AMM — bonding curve operations will fail
- The `createInstruction` (v1) is deprecated in favor of `createV2Instruction` (Token-2022)

## Testing

- Unit tests in `tests/` directory using Jest with `ts-jest`
- Test against devnet using `new Connection("https://api.devnet.solana.com", "confirmed")`
- Mock Anchor programs for offline SDK tests; use real connections for online SDK integration tests
