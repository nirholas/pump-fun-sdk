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
} from "@nirholas/pump-sdk";
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
const vault = creatorVaultPda(creator);
console.log("Creator vault:", vault.toBase58());
// Seeds: ["creator-vault", creator]
// Program: Pump
```

### AMM Creator Vault

After graduation, creator fees accumulate in a separate AMM vault:

```typescript
import { ammCreatorVaultPda } from "@nirholas/pump-sdk";

const ammVault = ammCreatorVaultPda(creator);
console.log("AMM creator vault:", ammVault.toBase58());
// Seeds: ["creator-vault", creator]
// Program: PumpAMM
```

### Fee Program Global

```typescript
import { feeProgramGlobalPda } from "@nirholas/pump-sdk";

const feeGlobal = feeProgramGlobalPda();
console.log("Fee program global:", feeGlobal.toBase58());
// Program: PumpFees
```

## Social Fee PDAs

Social fee PDAs link off-chain user identities (e.g., Telegram user IDs) to on-chain fee accounts:

```typescript
import { socialFeePda } from "@nirholas/pump-sdk";

const userId = "user123";
const platform = 1; // platform identifier (e.g., 1 = Telegram)
const socialPda = socialFeePda(userId, platform);
console.log("Social fee PDA:", socialPda.toBase58());
// Seeds: ["social-fee", userId, platform]
// Program: PumpFees
```

## Volume Tracking PDAs

### User Volume Accumulator

```typescript
const user = new PublicKey("USER_WALLET");
const userVolume = userVolumeAccumulatorPda(user);
console.log("User volume accumulator:", userVolume.toBase58());
// Seeds: ["user-volume-accumulator", user]
// Program: Pump
```

### AMM User Volume Accumulator

Volume on the AMM is tracked separately:

```typescript
import { ammUserVolumeAccumulatorPda } from "@nirholas/pump-sdk";

const ammUserVolume = ammUserVolumeAccumulatorPda(user);
console.log("AMM volume accumulator:", ammUserVolume.toBase58());
// Seeds: ["user-volume-accumulator", user]
// Program: PumpAMM
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
import {
  GLOBAL_PDA,
  AMM_GLOBAL_PDA,
  PUMP_FEE_CONFIG_PDA,
  AMM_FEE_CONFIG_PDA,
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
  AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA,
  AMM_GLOBAL_CONFIG_PDA,
  PUMP_EVENT_AUTHORITY_PDA,
  PUMP_AMM_EVENT_AUTHORITY_PDA,
  PUMP_FEE_EVENT_AUTHORITY_PDA,
} from "@nirholas/pump-sdk";

console.log("Pump global:", GLOBAL_PDA.toBase58());
console.log("AMM global:", AMM_GLOBAL_PDA.toBase58());
console.log("Fee config:", PUMP_FEE_CONFIG_PDA.toBase58());
console.log("AMM fee config:", AMM_FEE_CONFIG_PDA.toBase58());
console.log("Volume accumulator:", GLOBAL_VOLUME_ACCUMULATOR_PDA.toBase58());
console.log("AMM volume accumulator:", AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA.toBase58());
console.log("AMM global config:", AMM_GLOBAL_CONFIG_PDA.toBase58());
```

## V2 PDAs (v1.29.0+)

V2 PDAs use updated seed derivation. These are required for new tokens created after the V2 upgrade:

```typescript
import { bondingCurveV2Pda, poolV2Pda } from "@nirholas/pump-sdk";

const mint = new PublicKey("YOUR_MINT");

const bcV2 = bondingCurveV2Pda(mint);
console.log("Bonding curve V2:", bcV2.toBase58());
// Seeds: ["bonding-curve-v2", mint]
// Program: Pump

const poolV2 = poolV2Pda(mint);
console.log("Pool V2:", poolV2.toBase58());
// Seeds: ["pool-v2", mint]
// Program: PumpAMM
```

> **Note:** V1 PDAs (`bondingCurvePda`, `canonicalPumpPoolPda`) still work for tokens created before V2. Use V2 for new tokens.

## Building an Account Explorer

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import {
  bondingCurvePda,
  canonicalPumpPoolPda,
  feeSharingConfigPda,
  PUMP_SDK,
} from "@nirholas/pump-sdk";

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

