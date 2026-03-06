# Tutorial 10: Working with Pump PDAs

> Derive every Program Derived Address used in the Pump protocol.

## What are PDAs?

Program Derived Addresses (PDAs) are deterministic addresses derived from seeds and a program ID. Every Pump account — bonding curves, pools, vaults — lives at a PDA. The SDK exports functions to derive them all.

## All PDA Functions

```typescript
import {
  bondingCurvePda,
  canonicalPumpPoolPda,
  pumpPoolAuthorityPda,
  creatorVaultPda,
  feeSharingConfigPda,
  userVolumeAccumulatorPda,
  getGlobalParamsPda,
  getMayhemStatePda,
  getSolVaultPda,
  getTokenVaultPda,
  // Pre-computed constants:
  GLOBAL_PDA,
  PUMP_FEE_CONFIG_PDA,
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
} from "@pump-fun/pump-sdk";
import { PublicKey } from "@solana/web3.js";
```

## Core PDAs

### Bonding Curve

Every token has a bonding curve account:

```typescript
const mint = new PublicKey("YOUR_MINT");

const bondingCurve = bondingCurvePda(mint);
console.log("Bonding curve:", bondingCurve.toBase58());
// Seeds: ["bonding-curve", mint]
// Program: Pump (6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P)
```

### AMM Pool (Graduated Tokens)

```typescript
const pool = canonicalPumpPoolPda(mint);
console.log("AMM pool:", pool.toBase58());
// Seeds: ["pool", mint]
// Program: PumpAMM (pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA)

const poolAuthority = pumpPoolAuthorityPda(mint);
console.log("Pool authority:", poolAuthority.toBase58());
// Seeds: ["pool-authority", mint]
// Program: Pump
```

## Fee PDAs

### Fee Sharing Config

```typescript
const sharingConfig = feeSharingConfigPda(mint);
console.log("Sharing config:", sharingConfig.toBase58());
// Seeds: ["sharing-config", mint]
// Program: PumpFees (pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ)
```

### Creator Vault

```typescript
const vault = creatorVaultPda(sharingConfig);
console.log("Creator vault:", vault.toBase58());
// Seeds: ["creator-vault", sharingConfigAddress]
```

## Volume Tracking PDAs

### User Volume Accumulator

```typescript
const user = new PublicKey("USER_WALLET");
const userVolume = userVolumeAccumulatorPda(user);
console.log("User volume accumulator:", userVolume.toBase58());
// Seeds: ["user-volume-accumulator", user]
```

## Mayhem Mode PDAs

```typescript
const globalParams = getGlobalParamsPda();
console.log("Global params:", globalParams.toBase58());

const solVault = getSolVaultPda();
console.log("SOL vault:", solVault.toBase58());

const mayhemState = getMayhemStatePda(mint);
console.log("Mayhem state:", mayhemState.toBase58());

const tokenVault = getTokenVaultPda(mint);
console.log("Token vault:", tokenVault.toBase58());
```

## Pre-Computed Global Constants

These PDAs are the same for every user — they're computed once:

```typescript
import { GLOBAL_PDA, PUMP_FEE_CONFIG_PDA, GLOBAL_VOLUME_ACCUMULATOR_PDA } from "@pump-fun/pump-sdk";

console.log("Global:", GLOBAL_PDA.toBase58());
console.log("Fee config:", PUMP_FEE_CONFIG_PDA.toBase58());
console.log("Volume accumulator:", GLOBAL_VOLUME_ACCUMULATOR_PDA.toBase58());
```

## Building an Account Explorer

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import {
  bondingCurvePda,
  canonicalPumpPoolPda,
  feeSharingConfigPda,
  PUMP_SDK,
} from "@pump-fun/pump-sdk";

async function exploreToken(mint: PublicKey) {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const pdas = {
    bondingCurve: bondingCurvePda(mint),
    pool: canonicalPumpPoolPda(mint),
    feeConfig: feeSharingConfigPda(mint),
  };

  // Check which accounts exist
  const accounts = await connection.getMultipleAccountsInfo(
    Object.values(pdas)
  );

  const results: Record<string, string> = {};
  const keys = Object.keys(pdas);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const account = accounts[i];
    results[key] = account
      ? `EXISTS (${account.data.length} bytes, ${account.lamports} lamports)`
      : "NOT FOUND";
  }

  console.table(results);

  // Decode if bonding curve exists
  if (accounts[0]) {
    const bc = PUMP_SDK.decodeBondingCurve(accounts[0]);
    console.log("Bonding curve state:");
    console.log("  Complete:", bc.complete);
    console.log("  Creator:", bc.creator.toBase58());
    console.log("  Real SOL:", bc.realSolReserves.toString());
  }
}

exploreToken(new PublicKey("YOUR_MINT"));
```

## What's Next?

- [Tutorial 11: Building a Trading Bot](./11-trading-bot.md)
- [Tutorial 12: Offline SDK vs Online SDK](./12-offline-vs-online.md)
