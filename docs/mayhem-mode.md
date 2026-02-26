# Mayhem Mode

Mayhem mode is an alternate operating mode that routes token vaults and fees through the Mayhem program instead of the standard Pump program.

## Overview

When a token is created with `mayhemMode: true`, it uses a different set of fee recipients, token vaults, and PDAs derived from the Mayhem program. This mode is activated per-token at creation time and cannot be changed after.

## Enabling Mayhem Mode

Set `mayhemMode: true` when creating a token:

```typescript
import { PUMP_SDK } from "@pump-fun/pump-sdk";

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
import { getFeeRecipient } from "@pump-fun/pump-sdk";

// Normal mode — picks from standard fee recipients
const recipient = getFeeRecipient(global, false);

// Mayhem mode — picks from reserved fee recipients
const mayhemRecipient = getFeeRecipient(global, true);
```

### Token Vaults

Mayhem mode tokens use vaults derived from the Mayhem program instead of the standard Pump program:

| Normal Mode | Mayhem Mode |
|-------------|-------------|
| Standard bonding curve token vault | `getTokenVaultPda(mint)` — Mayhem program vault |
| Standard SOL vault | `getSolVaultPda()` — Mayhem program vault |
| TOKEN_PROGRAM_ID | TOKEN_2022_PROGRAM_ID |

### Program Derived Addresses

Mayhem mode introduces four additional PDAs:

```typescript
import {
  getGlobalParamsPda,
  getMayhemStatePda,
  getSolVaultPda,
  getTokenVaultPda,
} from "@pump-fun/pump-sdk";

// Mayhem global configuration
const globalParams = getGlobalParamsPda();
// Seeds: ["global-params"] → MAYHEM_PROGRAM_ID

// Per-token mayhem state
const mayhemState = getMayhemStatePda(mint);
// Seeds: ["mayhem-state", mint] → MAYHEM_PROGRAM_ID

// Shared SOL vault
const solVault = getSolVaultPda();
// Seeds: ["sol-vault"] → MAYHEM_PROGRAM_ID

// Per-token vault (Token-2022 ATA of SOL vault)
const tokenVault = getTokenVaultPda(mint);
```

## Detection

You can check if a bonding curve was created in mayhem mode:

```typescript
const bondingCurve = sdk.decodeBondingCurve(accountInfo);

if (bondingCurve.isMayhemMode) {
  console.log("This token uses mayhem mode");
}
```

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
import { MAYHEM_PROGRAM_ID } from "@pump-fun/pump-sdk";
```

## Related

- [Architecture](./architecture.md) — SDK design and program overview
- [Bonding Curve Math](./bonding-curve-math.md) — Price calculation formulas
- [Fee Tiers](./fee-tiers.md) — Market-cap-based fee rates
- [API Reference](./api-reference.md) — Full function signatures
