# Tutorial 24: Cross-Program Trading (Pump → PumpAMM)

> Handle the full token lifecycle — trade on the bonding curve, detect graduation, and seamlessly transition to AMM pool trading.

> **Breaking change — 2026-04-28:** Both bonding curve and AMM buys/sells now require new trailing fee-recipient accounts. AMM instructions require two new accounts (readonly recipient + mutable WSOL ATA). Upgrade to `@nirholas/pump-sdk@^1.32.0` before cutover — the SDK handles both automatically. See **[Tutorial 45: Breaking Fee Recipient Upgrade](./45-breaking-fee-recipient-upgrade.md)**.

## Prerequisites

- Node.js 18+
- `@nirholas/pump-sdk` installed
- Understanding of [Tutorial 02](./02-buy-tokens.md) (buying) and [Tutorial 06](./06-migration.md) (migration)

```bash
npm install @nirholas/pump-sdk @solana/web3.js bn.js
```

## The Two Programs

Pump tokens live on **two different programs** depending on their lifecycle stage:

```
┌────────────────────────────────────────────────────────────────┐
│                    Token Lifecycle                              │
│                                                                │
│  ┌─────────────┐    graduation     ┌──────────────────┐       │
│  │ Pump Program │ ──────────────► │ PumpAMM Program   │       │
│  │ (bonding     │  (automatic)    │ (constant-product  │       │
│  │  curve)      │                 │  AMM pool)         │       │
│  └─────────────┘                  └──────────────────┘        │
│                                                                │
│  Program ID:                       Program ID:                 │
│  6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ  pAMMBay6oceH9fJKBRHGP5D4bD │
└────────────────────────────────────────────────────────────────┘
```

**Before graduation:** Trade via `buyInstructions` / `sellInstructions` (Pump program)
**After graduation:** Trade via AMM pool instructions (PumpAMM program)

## Step 1: Check Token Status

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk, bondingCurveGraduationProgress } from "@nirholas/pump-sdk";
import BN from "bn.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);

const mint = new PublicKey("YOUR_TOKEN_MINT");

async function getTokenPhase(mint: PublicKey): Promise<"bonding-curve" | "amm" | "unknown"> {
  try {
    const bc = await onlineSdk.fetchBondingCurve(mint);

    if (bc.complete) {
      return "amm"; // Graduated — trade on PumpAMM
    }

    const progress = bondingCurveGraduationProgress({
      realSolReserves: bc.realSolReserves,
      realTokenReserves: bc.realTokenReserves,
    });

    console.log(`Bonding curve progress: ${(progress * 100).toFixed(1)}%`);
    return "bonding-curve";
  } catch {
    return "unknown";
  }
}
```

## Step 2: Trade on the Bonding Curve (Pre-Graduation)

```typescript
import {
  PUMP_SDK,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
} from "@nirholas/pump-sdk";

async function buyOnBondingCurve(mint: PublicKey, user: PublicKey, solAmount: BN) {
  const bc = await onlineSdk.fetchBondingCurve(mint);

  if (bc.complete) {
    throw new Error("Token has graduated — use AMM trading instead");
  }

  // Quote the trade
  const feeConfig = await onlineSdk.fetchFeeConfig();
  const tokensOut = getBuyTokenAmountFromSolAmount(
    solAmount,
    bc.virtualSolReserves,
    bc.virtualTokenReserves,
    feeConfig
  );

  console.log(`Buy quote: ${solAmount.toString()} lamports → ${tokensOut.toString()} tokens`);

  // Build instructions
  const buyIxs = await onlineSdk.buyInstructions({
    mint,
    user,
    solAmount,
    slippageBps: 500, // 5%
  });

  return buyIxs;
}

async function sellOnBondingCurve(mint: PublicKey, user: PublicKey, tokenAmount: BN) {
  const bc = await onlineSdk.fetchBondingCurve(mint);

  if (bc.complete) {
    throw new Error("Token has graduated — use AMM trading instead");
  }

  const solOut = getSellSolAmountFromTokenAmount(
    tokenAmount,
    bc.virtualSolReserves,
    bc.virtualTokenReserves
  );

  console.log(`Sell quote: ${tokenAmount.toString()} tokens → ${solOut.toString()} lamports`);

  const sellIxs = await onlineSdk.sellInstructions({
    mint,
    user,
    tokenAmount,
    slippageBps: 500,
  });

  return sellIxs;
}
```

## Step 3: Detect Graduation

Monitor for the `complete` flag to know when to switch programs:

```typescript
async function watchForGraduation(
  mint: PublicKey,
  pollIntervalMs: number = 5000
): Promise<void> {
  console.log(`Watching ${mint.toBase58()} for graduation...`);

  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      try {
        const bc = await onlineSdk.fetchBondingCurve(mint);

        if (bc.complete) {
          clearInterval(interval);
          console.log("Token graduated! Switching to AMM trading.");
          resolve();
        } else {
          const progress = bondingCurveGraduationProgress({
            realSolReserves: bc.realSolReserves,
            realTokenReserves: bc.realTokenReserves,
          });
          console.log(`Progress: ${(progress * 100).toFixed(1)}%`);
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, pollIntervalMs);
  });
}
```

## Step 4: Trade on PumpAMM (Post-Graduation)

After graduation, the token trades in a constant-product AMM pool:

```typescript
async function buyOnAmm(mint: PublicKey, user: PublicKey, solAmount: BN) {
  // For graduated tokens, use the AMM buy method
  const buyIxs = await onlineSdk.ammBuyInstructions({
    mint,
    user,
    solAmount,
    slippageBps: 500,
  });

  return buyIxs;
}

async function sellOnAmm(mint: PublicKey, user: PublicKey, tokenAmount: BN) {
  const sellIxs = await onlineSdk.ammSellInstructions({
    mint,
    user,
    tokenAmount,
    slippageBps: 500,
  });

  return sellIxs;
}
```

## Step 5: Unified Trading Function

Build a single function that handles both phases:

```typescript
import { TransactionInstruction } from "@solana/web3.js";

async function smartBuy(
  mint: PublicKey,
  user: PublicKey,
  solAmount: BN
): Promise<TransactionInstruction[]> {
  const phase = await getTokenPhase(mint);

  switch (phase) {
    case "bonding-curve":
      console.log("Trading on bonding curve (Pump program)");
      return buyOnBondingCurve(mint, user, solAmount);

    case "amm":
      console.log("Trading on AMM pool (PumpAMM program)");
      return buyOnAmm(mint, user, solAmount);

    default:
      throw new Error(`Cannot determine token phase for ${mint.toBase58()}`);
  }
}

async function smartSell(
  mint: PublicKey,
  user: PublicKey,
  tokenAmount: BN
): Promise<TransactionInstruction[]> {
  const phase = await getTokenPhase(mint);

  switch (phase) {
    case "bonding-curve":
      return sellOnBondingCurve(mint, user, tokenAmount);

    case "amm":
      return sellOnAmm(mint, user, tokenAmount);

    default:
      throw new Error(`Cannot determine token phase for ${mint.toBase58()}`);
  }
}
```

## Step 6: Cross-Program Fee Collection

Creator fees accumulate in **separate vaults** for each program. Use `BothPrograms` methods to aggregate:

```typescript
// Check total unclaimed fees across both programs
const totalFees = await onlineSdk.getCreatorVaultBalanceBothPrograms(creator.publicKey);
console.log(`Total unclaimed fees: ${totalFees.toNumber() / 1e9} SOL`);

// Claim token incentives from both programs
const claimIxs = await onlineSdk.claimTokenIncentivesBothPrograms(user.publicKey);
console.log(`Claim instructions: ${claimIxs.length}`);

// Check unclaimed volume-based rewards across both programs
const unclaimed = await onlineSdk.getTotalUnclaimedTokensBothPrograms(user.publicKey);
console.log(`Unclaimed reward tokens: ${unclaimed.toString()}`);

// Sync volume accumulators for both programs
const syncIxs = await onlineSdk.syncUserVolumeAccumulatorBothPrograms(user.publicKey);
```

## Step 7: Full Lifecycle Example

```typescript
import { Keypair, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

async function fullLifecycleDemo() {
  const wallet = Keypair.generate(); // Your funded wallet
  const mint = new PublicKey("EXISTING_TOKEN_MINT");

  // 1. Check current phase
  const phase = await getTokenPhase(mint);
  console.log(`Token is in phase: ${phase}`);

  // 2. Buy some tokens (works regardless of phase)
  const solToSpend = new BN(50_000_000); // 0.05 SOL
  const buyIxs = await smartBuy(mint, wallet.publicKey, solToSpend);

  // 3. Build and send transaction
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: buyIxs,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([wallet]);
  const sig = await connection.sendTransaction(tx, { skipPreflight: false });
  console.log(`Buy transaction: ${sig}`);

  // 4. Later: Sell tokens (auto-detects program)
  const tokenAmount = new BN("500000");
  const sellIxs = await smartSell(mint, wallet.publicKey, tokenAmount);

  // 5. Collect any creator fees from both programs
  const fees = await onlineSdk.getCreatorVaultBalanceBothPrograms(wallet.publicKey);
  if (fees.gt(new BN(0))) {
    console.log(`Collecting ${fees.toNumber() / 1e9} SOL in creator fees`);
  }
}

fullLifecycleDemo().catch(console.error);
```

## Key Concepts

| Concept | Bonding Curve (Pump) | AMM Pool (PumpAMM) |
|---------|---------------------|---------------------|
| Pricing | Virtual reserves curve | Constant-product xy=k |
| `complete` flag | `false` | `true` |
| Buy method | `buyInstructions()` | `ammBuyInstructions()` |
| Sell method | `sellInstructions()` | `ammSellInstructions()` |
| Creator fees | `creatorVaultPda()` | `ammCreatorVaultPda()` |
| Volume tracking | `userVolumeAccumulatorPda()` | `ammUserVolumeAccumulatorPda()` |

## Next Steps

- See [Tutorial 11](./11-trading-bot.md) for building an automated bot around this pattern
- See [Tutorial 06](./06-migration.md) for how migration itself works
- See [Tutorial 09](./09-fee-system.md) for fee tier differences between programs
