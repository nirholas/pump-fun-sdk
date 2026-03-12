# Mayhem Mode

Mayhem mode is an alternate operating mode that routes token vaults and fees through the Mayhem program instead of the standard Pump program. It's set per-token at creation time and cannot be changed afterward.

## Overview

When a token is created with `mayhemMode: true`, the on-chain program derives a separate set of PDAs, fee recipients, and token vaults from the Mayhem program ID. The bonding curve math and trading mechanics remain identical — only the account routing changes.

### When to Use Mayhem Mode

- **Separate fee accounting** — mayhem tokens use `reservedFeeRecipient` / `reservedFeeRecipients` from the global state, keeping fee collection separate from standard tokens
- **Alternate vault routing** — tokens are held in vaults derived from the Mayhem program ID, providing isolation from standard Pump vaults
- **Token-2022 support** — mayhem mode uses `TOKEN_2022_PROGRAM_ID` for token vaults instead of the standard SPL Token program

### When NOT to Use Mayhem Mode

- If you don't need separate fee routing, use `mayhemMode: false` (the default)
- Mayhem mode cannot be toggled after token creation — choose carefully
- Most standard PumpFun use cases don't require mayhem mode

## Enabling Mayhem Mode

Set `mayhemMode: true` when creating a token:

```typescript
import { PUMP_SDK } from "@nirholas/pump-sdk";

const instruction = await PUMP_SDK.createV2Instruction({
  mint: mint.publicKey,
  name: "My Token",
  symbol: "MTK",
  uri: "https://example.com/metadata.json",
  creator: wallet.publicKey,
  user: wallet.publicKey,
  mayhemMode: true, // ← enables mayhem mode
});
```

> **Note:** Mayhem mode must be set at creation time. You cannot switch a token between normal and mayhem mode after it's created.

## How It Works

### Fee Recipients

In normal mode, fee recipients are drawn from:
- `global.feeRecipient`
- `global.feeRecipients` (array)

In mayhem mode, fee recipients are drawn from:
- `global.reservedFeeRecipient`
- `global.reservedFeeRecipients` (array)

```typescript
import { getFeeRecipient } from "@nirholas/pump-sdk";

// Normal mode — picks from standard fee recipients
const recipient = getFeeRecipient(global, false);

// Mayhem mode — picks from reserved fee recipients
const mayhemRecipient = getFeeRecipient(global, true);
```

The `getFeeRecipient` function is called internally by the SDK when building buy/sell instructions. You only need to call it directly if you're building custom transaction logic.

### Token Vaults

Mayhem mode tokens use vaults derived from the Mayhem program instead of the standard Pump program:

| Aspect | Normal Mode | Mayhem Mode |
|--------|-------------|-------------|
| Token vault | Standard bonding curve ATA | `getTokenVaultPda(mint)` — Mayhem program |
| SOL vault | Standard Pump SOL vault | `getSolVaultPda()` — Mayhem program |
| Token program | `TOKEN_PROGRAM_ID` | `TOKEN_2022_PROGRAM_ID` |
| Mayhem state | Not used | `getMayhemStatePda(mint)` — per-token |
| Global params | Not used | `getGlobalParamsPda()` — shared |

### Program Derived Addresses

Mayhem mode introduces four additional PDAs, all derived from the Mayhem program ID (`MYH2mwFDd7oGCfBFCGMhrNzNBhrDMPRi4iJsGf6G96y`):

```typescript
import {
  getGlobalParamsPda,
  getMayhemStatePda,
  getSolVaultPda,
  getTokenVaultPda,
  MAYHEM_PROGRAM_ID,
} from "@nirholas/pump-sdk";

// Mayhem global configuration (shared across all mayhem tokens)
const globalParams = getGlobalParamsPda();
// Seeds: ["global-params"] → MAYHEM_PROGRAM_ID

// Per-token mayhem state (unique per mint)
const mayhemState = getMayhemStatePda(mint);
// Seeds: ["mayhem-state", mint.toBuffer()] → MAYHEM_PROGRAM_ID

// Shared SOL vault (holds SOL reserves for all mayhem tokens)
const solVault = getSolVaultPda();
// Seeds: ["sol-vault"] → MAYHEM_PROGRAM_ID

// Per-token vault (Token-2022 ATA of the SOL vault for this mint)
const tokenVault = getTokenVaultPda(mint);
```

### How the SDK Handles Mayhem Mode Internally

When you call `createV2Instruction` or `buyInstructions`/`sellInstructions`, the SDK automatically:

1. Reads the `mayhemMode` parameter (from your input or from the bonding curve state)
2. Includes the Mayhem program ID and PDAs in the instruction accounts
3. Selects the correct fee recipient (`reserved` vs `standard`)
4. Uses the appropriate token program for vault operations

You don't need to manually construct mayhem-specific accounts — the SDK does it for you.

## Detection

You can check if a bonding curve was created in mayhem mode by reading the `isMayhemMode` field:

```typescript
const bondingCurve = await sdk.fetchBondingCurve(mint);

if (bondingCurve.isMayhemMode) {
  console.log("This token uses mayhem mode");
  // The SDK handles this automatically for buy/sell instructions
}
```

You can also check the global state to see if mayhem mode is enabled at the protocol level:

```typescript
const global = await sdk.fetchGlobal();

if (global.mayhemModeEnabled) {
  console.log("Mayhem mode is enabled globally");
}
```

## Impact on Other Operations

### Buy and Sell

When buying or selling mayhem mode tokens, pass the bonding curve state (which carries `isMayhemMode`) — the SDK routes accounts correctly:

```typescript
// This works identically for both normal and mayhem tokens
const buyIxs = await PUMP_SDK.buyInstructions({
  global,
  bondingCurveAccountInfo,
  bondingCurve, // Contains isMayhemMode — SDK reads it internally
  associatedUserAccountInfo,
  mint,
  user,
  amount: tokenAmount,
  solAmount,
  slippage: 1,
  tokenProgram,
});
```

### Fee Sharing

Fee sharing (shareholders, distributions) works the same way for mayhem tokens. The fee collection routing is different but the distribution mechanism is identical.

### Migration

When a mayhem token graduates and migrates to PumpAMM, the migration instruction handles the transition from mayhem vaults to the AMM pool. No special handling is required.

## Related

- [Fee Sharing Guide](./fee-sharing.md) — creator fee distribution
- [Architecture](./architecture.md) — SDK module layout
- [API Reference](./api-reference.md) — full PDA function signatures

The `isMayhemMode` flag is set at creation time based on `global.mayhemModeEnabled` and stored permanently in the bonding curve account.

## Fee Calculations in Mayhem Mode

Mayhem mode slightly alters how `mintSupply` is passed to fee calculations. In normal mode, `ONE_BILLION_SUPPLY` (1,000,000,000,000,000) is used as the mint supply for fee tier computation. In mayhem mode, the actual `mintSupply` from the bonding curve is used instead:

```typescript
// Internal to fees.ts — you don't call this directly
const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
  global,
  feeConfig,
  mintSupply: isMayhemMode ? mintSupply : ONE_BILLION_SUPPLY,
  virtualSolReserves,
  virtualTokenReserves,
});
```

This means mayhem mode tokens may fall into different [fee tiers](./fee-tiers.md) than normal mode tokens at the same reserve levels.

## Program ID

| Constant | Address |
|----------|---------|
| `MAYHEM_PROGRAM_ID` | `MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e` |

```typescript
import { MAYHEM_PROGRAM_ID } from "@nirholas/pump-sdk";
```

## Related

- [Architecture](./architecture.md) — SDK design and program overview
- [Bonding Curve Math](./bonding-curve-math.md) — Price calculation formulas
- [Fee Tiers](./fee-tiers.md) — Market-cap-based fee rates
- [API Reference](./api-reference.md) — Full function signatures

