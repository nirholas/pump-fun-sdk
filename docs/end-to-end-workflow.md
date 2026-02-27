# End-to-End Workflow

A complete walkthrough covering the full token lifecycle: create → buy → graduate → migrate → AMM trade → fee sharing → claim rewards.

## Prerequisites

```typescript
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import {
  OnlinePumpSdk,
  PUMP_SDK,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
  bondingCurveMarketCap,
  bondingCurvePda,
  canonicalPumpPoolPda,
  isCreatorUsingSharingConfig,
} from "@pump-fun/pump-sdk";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const sdk = new OnlinePumpSdk(connection);
const wallet = Keypair.fromSecretKey(/* your funded wallet */);
```

---

## Step 1: Create a Token

Create a new token on the bonding curve. The token starts with virtual reserves that define its initial price.

```typescript
const mint = Keypair.generate();

const createIx = await PUMP_SDK.createV2Instruction({
  mint: mint.publicKey,
  name: "My Token",
  symbol: "MTK",
  uri: "https://example.com/metadata.json",
  creator: wallet.publicKey,
  user: wallet.publicKey,
  mayhemMode: false,
});

const tx = new Transaction().add(createIx);
const sig = await sendAndConfirmTransaction(connection, tx, [wallet, mint]);
console.log("Token created:", sig);
```

> **Tip:** You can combine creation with an initial buy in Step 2 for a single atomic transaction.

---

## Step 2: Buy Tokens

Buy tokens on the bonding curve. The price increases as more tokens are purchased.

```typescript
const global = await sdk.fetchGlobal();
const feeConfig = await sdk.fetchFeeConfig();
const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } =
  await sdk.fetchBuyState(mint.publicKey, wallet.publicKey);

const solAmount = new BN(0.5 * 1e9); // 0.5 SOL

const tokenAmount = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply,
  bondingCurve,
  amount: solAmount,
});

console.log("Buying", tokenAmount.toString(), "tokens for 0.5 SOL");

const buyIxs = await PUMP_SDK.buyInstructions({
  global,
  bondingCurveAccountInfo,
  bondingCurve,
  associatedUserAccountInfo,
  mint: mint.publicKey,
  user: wallet.publicKey,
  solAmount,
  amount: tokenAmount,
  slippage: 2, // 2% slippage tolerance
  tokenProgram: TOKEN_PROGRAM_ID,
});

const buyTx = new Transaction().add(...buyIxs);
await sendAndConfirmTransaction(connection, buyTx, [wallet]);
```

### Or: Create + Buy Atomically

Skip Step 1 and combine both in one transaction:

```typescript
const atomicIxs = await PUMP_SDK.createV2AndBuyInstructions({
  global,
  mint: mint.publicKey,
  name: "My Token",
  symbol: "MTK",
  uri: "https://example.com/metadata.json",
  creator: wallet.publicKey,
  user: wallet.publicKey,
  amount: tokenAmount,
  solAmount,
  mayhemMode: false,
});

const atomicTx = new Transaction().add(...atomicIxs);
await sendAndConfirmTransaction(connection, atomicTx, [wallet, mint]);
```

---

## Step 3: Check Price & Market Cap

Monitor the token's price and market cap as trading happens:

```typescript
// Re-fetch the latest bonding curve state
const { bondingCurve: latestCurve } = await sdk.fetchBuyState(
  mint.publicKey,
  wallet.publicKey,
);

// Current market cap in lamports
const mcap = bondingCurveMarketCap({
  mintSupply: latestCurve.tokenTotalSupply,
  virtualSolReserves: latestCurve.virtualSolReserves,
  virtualTokenReserves: latestCurve.virtualTokenReserves,
});

console.log("Market cap:", mcap.toNumber() / 1e9, "SOL");

// Check if graduated
console.log("Graduated:", latestCurve.complete);
```

---

## Step 4: Sell Tokens

Sell some or all tokens back to the bonding curve:

```typescript
const { bondingCurveAccountInfo: sellAccountInfo, bondingCurve: sellCurve } =
  await sdk.fetchSellState(mint.publicKey, wallet.publicKey);

const sellAmount = new BN(1_000_000); // amount of tokens to sell

const solOut = getSellSolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply: sellCurve.tokenTotalSupply,
  bondingCurve: sellCurve,
  amount: sellAmount,
});

console.log("Selling", sellAmount.toString(), "tokens for", solOut.toString(), "lamports");

const sellIxs = await PUMP_SDK.sellInstructions({
  global,
  bondingCurveAccountInfo: sellAccountInfo,
  bondingCurve: sellCurve,
  mint: mint.publicKey,
  user: wallet.publicKey,
  amount: sellAmount,
  solAmount: solOut,
  slippage: 1,
  tokenProgram: TOKEN_PROGRAM_ID,
  mayhemMode: false,
});

const sellTx = new Transaction().add(...sellIxs);
await sendAndConfirmTransaction(connection, sellTx, [wallet]);
```

---

## Step 5: Graduation & Migration

When all `realTokenReserves` are bought, the bonding curve completes and the token is ready for migration to an AMM pool.

```typescript
// Check if graduated
const { bondingCurve: currentCurve } = await sdk.fetchBuyState(
  mint.publicKey,
  wallet.publicKey,
);

if (currentCurve.complete) {
  console.log("Token has graduated! Migrating to AMM...");

  const global = await sdk.fetchGlobal();
  const migrateIx = await PUMP_SDK.migrateInstruction({
    withdrawAuthority: global.withdrawAuthority,
    mint: mint.publicKey,
    user: wallet.publicKey,
  });

  const migrateTx = new Transaction().add(migrateIx);
  await sendAndConfirmTransaction(connection, migrateTx, [wallet]);

  // The AMM pool address is deterministic
  const poolAddress = canonicalPumpPoolPda(mint.publicKey);
  console.log("AMM pool:", poolAddress.toBase58());
}
```

After migration, the token trades on the PumpAMM program with pool-based swaps.

---

## Step 6: Collect Creator Fees

Trading generates fees for the token creator. Collect them from both programs:

```typescript
// Check how much has accumulated
const balance = await sdk.getCreatorVaultBalanceBothPrograms(wallet.publicKey);
console.log("Creator fees available:", balance.toNumber() / 1e9, "SOL");

// Collect
if (balance.gtn(0)) {
  const collectIxs = await sdk.collectCoinCreatorFeeInstructions(wallet.publicKey);
  const collectTx = new Transaction().add(...collectIxs);
  await sendAndConfirmTransaction(connection, collectTx, [wallet]);
  console.log("Fees collected!");
}
```

---

## Step 7: Set Up Fee Sharing (Optional)

Split creator fees among multiple shareholders:

```typescript
// Create fee sharing config
const configIx = await PUMP_SDK.createFeeSharingConfig({
  creator: wallet.publicKey,
  mint: mint.publicKey,
  pool: null,  // null for bonding curve tokens
  // For graduated tokens, use:
  // pool: canonicalPumpPoolPda(mint.publicKey),
});

const configTx = new Transaction().add(configIx);
await sendAndConfirmTransaction(connection, configTx, [wallet]);

// Set shareholders (must total 10,000 bps = 100%)
const shareholderIx = await PUMP_SDK.updateFeeShares({
  authority: wallet.publicKey,
  mint: mint.publicKey,
  currentShareholders: [],  // PublicKey[] — empty on first setup
  newShareholders: [
    { address: wallet.publicKey, shareBps: 7000 },     // 70%
    { address: new PublicKey("..."), shareBps: 3000 },  // 30%
  ],
});

const shareTx = new Transaction().add(shareholderIx);
await sendAndConfirmTransaction(connection, shareTx, [wallet]);
```

### Distribute Accumulated Fees

```typescript
const result = await sdk.getMinimumDistributableFee(mint.publicKey);

if (result.canDistribute) {
  const { instructions } = await sdk.buildDistributeCreatorFeesInstructions(
    mint.publicKey,
  );
  const distTx = new Transaction().add(...instructions);
  await sendAndConfirmTransaction(connection, distTx, [wallet]);
  console.log("Fees distributed to shareholders!");
}
```

---

## Step 8: Set Up & Claim Volume Rewards (Optional)

Earn token incentives based on trading volume:

```typescript
// One-time: Initialize volume tracking
const initIx = await PUMP_SDK.initUserVolumeAccumulator({
  payer: wallet.publicKey,
  user: wallet.publicKey,
});
const initTx = new Transaction().add(initIx);
await sendAndConfirmTransaction(connection, initTx, [wallet]);

// After some trading, check rewards
const rewards = await sdk.getTotalUnclaimedTokensBothPrograms(wallet.publicKey);
console.log("Unclaimed rewards:", rewards.toString());

const todayRewards = await sdk.getCurrentDayTokensBothPrograms(wallet.publicKey);
console.log("Today's rewards:", todayRewards.toString());

// Claim rewards
if (rewards.gtn(0)) {
  const claimIxs = await sdk.claimTokenIncentivesBothPrograms(
    wallet.publicKey,
    wallet.publicKey,
  );
  const claimTx = new Transaction().add(...claimIxs);
  await sendAndConfirmTransaction(connection, claimTx, [wallet]);
  console.log("Rewards claimed!");
}

// When done, close to reclaim rent
const closeIx = await PUMP_SDK.closeUserVolumeAccumulator(wallet.publicKey);
```

---

## Full Lifecycle Summary

```
1. createV2Instruction()           → Token on bonding curve
2. buyInstructions()               → Buy tokens, price increases
3. bondingCurveMarketCap()         → Monitor price & market cap
4. sellInstructions()              → Sell tokens, price decreases
5. migrateInstruction()            → Graduate to AMM pool
6. collectCoinCreatorFeeInstructions()  → Collect creator fees
7. createFeeSharingConfig()        → Set up fee sharing
8. claimTokenIncentivesBothPrograms()   → Claim volume rewards
```

Each step builds `TransactionInstruction[]` — you combine them into transactions and sign with your wallet.

---

## Related

- [Getting Started](./getting-started.md) — Quick start guide
- [Bonding Curve Math](./bonding-curve-math.md) — Price calculation formulas
- [Fee Sharing](./fee-sharing.md) — Shareholder setup details
- [Token Incentives](./token-incentives.md) — Volume reward mechanics
- [Examples](./examples.md) — More code samples
- [Troubleshooting](./TROUBLESHOOTING.md) — Common issues and fixes
