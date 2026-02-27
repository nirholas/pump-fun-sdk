# Tutorial 6: Token Migration to PumpAMM

> Understanding what happens when a token graduates from the bonding curve to the PumpAMM pool.

## What is Migration?

When enough SOL has been deposited into a bonding curve, the token "graduates" — it migrates from the bonding curve to a constant-product AMM pool (PumpAMM). This happens automatically when the bonding curve fills up.

After migration:
- `bondingCurve.complete === true`
- Trading happens on the PumpAMM pool instead of the bonding curve
- The token becomes tradeable on standard DEX interfaces

## Detecting Graduation

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);
const mint = new PublicKey("YOUR_TOKEN_MINT_ADDRESS");

const bondingCurve = await onlineSdk.fetchBondingCurve(mint);

if (bondingCurve.complete) {
  console.log("Token has graduated to PumpAMM!");
  console.log("Bonding curve is now closed.");
} else {
  console.log("Token is still on the bonding curve.");
  console.log("Real SOL collected:", bondingCurve.realSolReserves.toString());
}
```

## Understanding the Migration Instruction

Migration is triggered by a permissioned authority. The SDK provides `migrateInstruction`:

```typescript
import { PUMP_SDK } from "@pump-fun/pump-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Only the withdraw authority can call this
const migrateIx = await PUMP_SDK.migrateInstruction({
  withdrawAuthority: withdrawAuthorityPubkey,
  mint: mintPubkey,
  user: userPubkey,
  tokenProgram: TOKEN_PROGRAM_ID,
});
```

### What Happens During Migration

1. Remaining tokens from the bonding curve are moved to a PumpAMM pool
2. Collected SOL is deposited as the other side of the AMM pair
3. `bondingCurve.complete` is set to `true`
4. A new pool account is created at the canonical PDA

## PDA Addresses for Graduated Tokens

```typescript
import { canonicalPumpPoolPda, pumpPoolAuthorityPda, bondingCurvePda } from "@pump-fun/pump-sdk";

const mint = new PublicKey("YOUR_MINT");

// The bonding curve (still exists, but complete = true)
const bc = bondingCurvePda(mint);

// The AMM pool address
const pool = canonicalPumpPoolPda(mint);

// The pool authority (owns the pool's token accounts)
const poolAuth = pumpPoolAuthorityPda(mint);

console.log("Bonding curve:", bc.toBase58());
console.log("AMM pool:", pool.toBase58());
console.log("Pool authority:", poolAuth.toBase58());
```

## Trading Post-Migration

After migration, use the PumpAMM SDK (`@pump-fun/pump-swap-sdk`) for trading:

```typescript
import { OnlinePumpAmmSdk } from "@pump-fun/pump-swap-sdk";

const ammSdk = new OnlinePumpAmmSdk(connection);
// Use the AMM SDK for buy/sell operations on graduated tokens
```

## Building a Token State Checker

```typescript
import { OnlinePumpSdk, bondingCurvePda } from "@pump-fun/pump-sdk";
import { Connection, PublicKey } from "@solana/web3.js";

async function getTokenState(mint: PublicKey) {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const onlineSdk = new OnlinePumpSdk(connection);

  try {
    const bc = await onlineSdk.fetchBondingCurve(mint);

    if (bc.complete) {
      return {
        state: "graduated",
        message: "Trading on PumpAMM pool",
        creator: bc.creator.toBase58(),
      };
    }

    if (bc.virtualTokenReserves.isZero()) {
      return {
        state: "migrated",
        message: "Fully migrated, bonding curve empty",
      };
    }

    return {
      state: "active",
      message: "Trading on bonding curve",
      realSolReserves: bc.realSolReserves.toString(),
      realTokenReserves: bc.realTokenReserves.toString(),
      creator: bc.creator.toBase58(),
    };
  } catch {
    return { state: "not_found", message: "Token not found on Pump" };
  }
}

const state = await getTokenState(new PublicKey("YOUR_MINT"));
console.log(state);
```

## What's Next?

- [Tutorial 7: Set Up Fee Sharing](./07-fee-sharing.md)
- [Tutorial 10: Working with PDAs](./10-working-with-pdas.md)
