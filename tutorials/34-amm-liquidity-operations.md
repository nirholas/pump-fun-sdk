# Tutorial 34: AMM Liquidity Operations

> Provide liquidity, deposit, withdraw, and trade on graduated PumpAMM pools — LP tokens, price impact, and coin-creator fees.

## Prerequisites

- Node.js 18+
- `@pump-fun/pump-sdk` installed
- A graduated token (bonding curve complete)

```bash
npm install @pump-fun/pump-sdk @solana/web3.js bn.js
```

## Architecture

When a token's bonding curve reaches its SOL cap, it "graduates" to PumpAMM — a full AMM pool with LP tokens:

```
┌─────────────┐    graduation    ┌──────────────┐
│   Pump       │ ─────────────► │   PumpAMM     │
│ BondingCurve │                │     Pool       │
│ complete=true│                │ base + quote   │
└─────────────┘                │ LP tokens      │
                               └──────────────┘
```

**PumpAMM Program**: `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`

## Step 1: Fetch Pool State

```typescript
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import BN from "bn.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const sdk = new OnlinePumpSdk(connection);

const mint = new PublicKey("YourGraduatedTokenMint...");

// Fetch pool by mint
const pool = await sdk.fetchPool(mint);

console.log("Pool state:", {
  creator: pool.creator.toBase58(),
  baseMint: pool.baseMint.toBase58(),   // Token mint
  quoteMint: pool.quoteMint.toBase58(), // WSOL
  lpMint: pool.lpMint.toBase58(),
  lpSupply: pool.lpSupply.toString(),
  coinCreator: pool.coinCreator.toBase58(),
  isMayhemMode: pool.isMayhemMode,
  isCashbackCoin: pool.isCashbackCoin,
  poolBump: pool.poolBump,
  index: pool.index,
});

// Or fetch pool by its address directly
const poolByAddr = await sdk.fetchPoolByAddress(poolAddress);
```

## Step 2: AMM Buy (Trade SOL → Token)

```typescript
const user = Keypair.generate();

// Standard buy — specify max SOL to spend
const buyIxs = await sdk.ammBuyInstruction({
  user: user.publicKey,
  mint,
  bondingCurveSolAmountToSpend: new BN(100_000_000), // 0.1 SOL
  slippageBps: 500, // 5%
});

console.log(`Buy: ${buyIxs.length} instructions`);

// Exact quote buy — spend exactly this much SOL
const exactBuyIxs = await sdk.ammBuyExactQuoteInInstruction({
  user: user.publicKey,
  mint,
  exactQuoteIn: new BN(50_000_000), // Exactly 0.05 SOL
  slippageBps: 300, // 3%
});
```

## Step 3: AMM Sell (Trade Token → SOL)

```typescript
const sellIxs = await sdk.ammSellInstruction({
  user: user.publicKey,
  mint,
  tokenAmountToSell: new BN("1000000000"), // 1 token (9 decimals)
  slippageBps: 500,
});

console.log(`Sell: ${sellIxs.length} instructions`);
```

## Step 4: Deposit Liquidity

Add liquidity to earn LP tokens:

```typescript
const depositIxs = await sdk.ammDepositInstruction({
  user: user.publicKey,
  pool: poolAddress,
  mint,
  maxBaseAmountIn: new BN("10000000000"),   // Max 10 tokens
  maxQuoteAmountIn: new BN(1_000_000_000),  // Max 1 SOL
  minLpTokenAmountOut: new BN(1),           // Min LP tokens to receive
});

console.log(`Deposit: ${depositIxs.length} instructions`);

// Tip: Calculate expected LP tokens first
// LP tokens = proportional to share of pool reserves
```

## Step 5: Withdraw Liquidity

Burn LP tokens to reclaim base + quote tokens:

```typescript
const withdrawIxs = await sdk.ammWithdrawInstruction({
  user: user.publicKey,
  pool: poolAddress,
  mint,
  lpTokenAmountIn: new BN("500000"),         // LP tokens to burn
  minBaseAmountOut: new BN("1000000000"),     // Min tokens to receive
  minQuoteAmountOut: new BN(100_000_000),     // Min SOL to receive
});

console.log(`Withdraw: ${withdrawIxs.length} instructions`);
```

## Step 6: Coin Creator Operations

The original token creator can claim fees and manage their role:

```typescript
const coinCreator = Keypair.generate(); // Original creator

// Collect accumulated coin-creator fees
const collectIxs = await sdk.ammCollectCoinCreatorFeeInstruction({
  creator: coinCreator.publicKey,
  mint,
});

// Migrate coin-creator role to a new address
const migrateIxs = await sdk.ammMigratePoolCoinCreatorInstruction({
  creator: coinCreator.publicKey,
  mint,
  newCreator: newCreatorAddress,
});

// Set coin creator on the pool
const setIxs = await sdk.ammSetCoinCreatorInstruction({
  creator: coinCreator.publicKey,
  mint,
});
```

## Step 7: Pool Events

Listen for deposit/withdraw events:

```typescript
import { EventParser, BorshCoder } from "@coral-xyz/anchor";

// DepositEvent fields:
// - pool, user, baseMint, quoteMint, lpMint
// - baseAmountDeposited, quoteAmountDeposited, lpTokensMinted

// WithdrawEvent fields:
// - pool, user, baseMint, quoteMint, lpMint
// - baseAmountWithdrawn, quoteAmountWithdrawn, lpTokensBurned

connection.onLogs(pumpAmmProgramId, (logs) => {
  for (const event of parser.parseLogs(logs.logs)) {
    switch (event.name) {
      case "DepositEvent":
        console.log("Deposit:", {
          base: event.data.baseAmountDeposited.toString(),
          quote: event.data.quoteAmountDeposited.toString(),
          lp: event.data.lpTokensMinted.toString(),
        });
        break;
      case "WithdrawEvent":
        console.log("Withdraw:", {
          base: event.data.baseAmountWithdrawn.toString(),
          quote: event.data.quoteAmountWithdrawn.toString(),
          lp: event.data.lpTokensBurned.toString(),
        });
        break;
    }
  }
});
```

## Step 8: Full Lifecycle Example

```typescript
async function ammLifecycle(
  sdk: OnlinePumpSdk,
  user: PublicKey,
  mint: PublicKey
) {
  // 1. Check token is graduated
  const bc = await sdk.fetchBondingCurve(mint);
  if (!bc.complete) {
    throw new Error("Token not yet graduated — trade on bonding curve");
  }

  // 2. Fetch pool
  const pool = await sdk.fetchPool(mint);
  const poolAddress = pool.address;

  // 3. Buy tokens on AMM
  const buyIxs = await sdk.ammBuyInstruction({
    user,
    mint,
    bondingCurveSolAmountToSpend: new BN(500_000_000), // 0.5 SOL
    slippageBps: 500,
  });

  // 4. Deposit liquidity
  const depositIxs = await sdk.ammDepositInstruction({
    user,
    pool: poolAddress,
    mint,
    maxBaseAmountIn: new BN("5000000000"),
    maxQuoteAmountIn: new BN(500_000_000),
    minLpTokenAmountOut: new BN(1),
  });

  // 5. Later: withdraw
  const withdrawIxs = await sdk.ammWithdrawInstruction({
    user,
    pool: poolAddress,
    mint,
    lpTokenAmountIn: new BN("250000"),
    minBaseAmountOut: new BN(1),
    minQuoteAmountOut: new BN(1),
  });

  return { buyIxs, depositIxs, withdrawIxs };
}
```

## Pool State Reference

| Field | Type | Description |
|-------|------|-------------|
| `poolBump` | `number` | PDA bump seed |
| `index` | `number` | Pool index |
| `creator` | `PublicKey` | Initial pool creator |
| `baseMint` | `PublicKey` | Token mint (the launched token) |
| `quoteMint` | `PublicKey` | Quote mint (WSOL) |
| `lpMint` | `PublicKey` | LP token mint |
| `lpSupply` | `BN` | Total LP tokens outstanding |
| `coinCreator` | `PublicKey` | Original coin creator (fee recipient) |
| `isMayhemMode` | `boolean` | Created in Mayhem Mode |
| `isCashbackCoin` | `boolean` | Has cashback enabled |

## Next Steps

- See [Tutorial 24](./24-cross-program-trading.md) for unified cross-program trading
- See [Tutorial 07](./07-fee-sharing.md) for fee configuration on these pools
- See [Tutorial 29](./29-event-parsing-analytics.md) for full event parsing
