# Examples

Practical code examples for common Pump SDK operations.

## Table of Contents

- [Create and Buy in One Transaction](#create-and-buy-in-one-transaction)
- [Buy with Slippage Protection](#buy-with-slippage-protection)
- [Sell Tokens](#sell-tokens)
- [Check Token Price](#check-token-price)
- [Read Bonding Curve State](#read-bonding-curve-state)
- [Collect Creator Fees](#collect-creator-fees)
- [Set Up Fee Sharing](#set-up-fee-sharing)
- [Track Trading Volume Rewards](#track-trading-volume-rewards)
- [Migrate a Graduated Token](#migrate-a-graduated-token)
- [Decode Account Data](#decode-account-data)

---

## Create and Buy in One Transaction

Launch a token and buy into it atomically:

```typescript
import { Connection, Keypair, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import BN from "bn.js";
import {
  OnlinePumpSdk,
  PUMP_SDK,
  getBuyTokenAmountFromSolAmount,
} from "@pump-fun/pump-sdk";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const sdk = new OnlinePumpSdk(connection);
const wallet = Keypair.generate(); // your funded wallet

const mint = Keypair.generate();
const global = await sdk.fetchGlobal();
const feeConfig = await sdk.fetchFeeConfig();
const solAmount = new BN(0.5 * 1e9); // 0.5 SOL

const tokenAmount = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,
  mintSupply: null,
  bondingCurve: null, // null = new token
  amount: solAmount,
});

const instructions = await PUMP_SDK.createV2AndBuyInstructions({
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

const tx = new Transaction().add(...instructions);
const sig = await sendAndConfirmTransaction(connection, tx, [wallet, mint]);
console.log("Created & bought:", sig);
```

## Buy with Slippage Protection

```typescript
const mint = new PublicKey("token-mint-address");
const user = wallet.publicKey;
const solAmount = new BN(0.1 * 1e9); // 0.1 SOL

const global = await sdk.fetchGlobal();
const feeConfig = await sdk.fetchFeeConfig();
const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } =
  await sdk.fetchBuyState(mint, user);

const tokenAmount = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply,
  bondingCurve,
  amount: solAmount,
});

const instructions = await PUMP_SDK.buyInstructions({
  global,
  bondingCurveAccountInfo,
  bondingCurve,
  associatedUserAccountInfo,
  mint,
  user,
  solAmount,
  amount: tokenAmount,
  slippage: 2, // 2% slippage tolerance
});

const tx = new Transaction().add(...instructions);
await sendAndConfirmTransaction(connection, tx, [wallet]);
```

## Sell Tokens

```typescript
import { getSellSolAmountFromTokenAmount } from "@pump-fun/pump-sdk";

const sellAmount = new BN(1_000_000); // tokens to sell

const global = await sdk.fetchGlobal();
const feeConfig = await sdk.fetchFeeConfig();
const { bondingCurveAccountInfo, bondingCurve } = await sdk.fetchSellState(mint, user);

const solReceived = getSellSolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply,
  bondingCurve,
  amount: sellAmount,
});

console.log("Expected SOL:", solReceived.toNumber() / 1e9);

const instructions = await PUMP_SDK.sellInstructions({
  global,
  bondingCurveAccountInfo,
  bondingCurve,
  mint,
  user,
  amount: sellAmount,
  solAmount: solReceived,
  slippage: 1,
});

const tx = new Transaction().add(...instructions);
await sendAndConfirmTransaction(connection, tx, [wallet]);
```

## Check Token Price

Quote prices without executing a trade:

```typescript
import {
  OnlinePumpSdk,
  getBuyTokenAmountFromSolAmount,
  getBuySolAmountFromTokenAmount,
  getSellSolAmountFromTokenAmount,
  bondingCurveMarketCap,
} from "@pump-fun/pump-sdk";

const sdk = new OnlinePumpSdk(connection);
const global = await sdk.fetchGlobal();
const feeConfig = await sdk.fetchFeeConfig();
const bondingCurve = await sdk.fetchBondingCurve(mint);

// How many tokens for 1 SOL?
const tokensFor1Sol = getBuyTokenAmountFromSolAmount({
  global, feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply,
  bondingCurve,
  amount: new BN(1e9),
});
console.log("Tokens per SOL:", tokensFor1Sol.toString());

// How much SOL for 1M tokens?
const costFor1M = getBuySolAmountFromTokenAmount({
  global, feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply,
  bondingCurve,
  amount: new BN(1_000_000),
});
console.log("Cost for 1M tokens:", costFor1M.toNumber() / 1e9, "SOL");

// Current market cap
const mcap = bondingCurveMarketCap({
  mintSupply: bondingCurve.tokenTotalSupply,
  virtualSolReserves: bondingCurve.virtualSolReserves,
  virtualTokenReserves: bondingCurve.virtualTokenReserves,
});
console.log("Market cap:", mcap.toNumber() / 1e9, "SOL");
```

## Read Bonding Curve State

```typescript
const bondingCurve = await sdk.fetchBondingCurve(mint);

console.log("Token reserves:", bondingCurve.virtualTokenReserves.toString());
console.log("SOL reserves:", bondingCurve.virtualSolReserves.toString());
console.log("Creator:", bondingCurve.creator.toBase58());
console.log("Graduated:", bondingCurve.complete);
console.log("Mayhem mode:", bondingCurve.isMayhemMode);
```

## Collect Creator Fees

```typescript
// Check balance first
const balance = await sdk.getCreatorVaultBalanceBothPrograms(creator);
console.log("Fees to collect:", balance.toNumber() / 1e9, "SOL");

if (balance.gt(new BN(0))) {
  const instructions = await sdk.collectCoinCreatorFeeInstructions(creator);
  const tx = new Transaction().add(...instructions);
  await sendAndConfirmTransaction(connection, tx, [wallet]);
  console.log("Fees collected!");
}
```

## Set Up Fee Sharing

```typescript
import {
  PUMP_SDK,
  isCreatorUsingSharingConfig,
  feeSharingConfigPda,
} from "@pump-fun/pump-sdk";

// 1. Create config
const createIx = await PUMP_SDK.createFeeSharingConfig({
  creator: wallet.publicKey,
  mint,
});

// 2. Set shareholders
const updateIx = await PUMP_SDK.updateFeeShares({
  authority: wallet.publicKey,
  mint,
  currentShareholders: [],
  newShareholders: [
    { address: new PublicKey("addr-A"), shareBps: 7000 }, // 70%
    { address: new PublicKey("addr-B"), shareBps: 3000 }, // 30%
  ],
});

const tx = new Transaction().add(createIx, updateIx);
await sendAndConfirmTransaction(connection, tx, [wallet]);

// 3. Later, distribute accumulated fees
const { instructions } = await sdk.buildDistributeCreatorFeesInstructions(mint);
const distTx = new Transaction().add(...instructions);
await sendAndConfirmTransaction(connection, distTx, [wallet]);
```

## Track Trading Volume Rewards

```typescript
// Initialize tracking (one-time)
const initIx = await PUMP_SDK.initUserVolumeAccumulator({
  payer: wallet.publicKey,
  user: wallet.publicKey,
});

// Check rewards
const unclaimed = await sdk.getTotalUnclaimedTokensBothPrograms(user);
const today = await sdk.getCurrentDayTokensBothPrograms(user);
console.log("Unclaimed:", unclaimed.toString());
console.log("Today:", today.toString());

// Claim
if (unclaimed.gt(new BN(0))) {
  const claimIxs = await sdk.claimTokenIncentivesBothPrograms(user, wallet.publicKey);
  const tx = new Transaction().add(...claimIxs);
  await sendAndConfirmTransaction(connection, tx, [wallet]);
}
```

## Migrate a Graduated Token

When a token completes its bonding curve, migrate it to the AMM:

```typescript
const bondingCurve = await sdk.fetchBondingCurve(mint);

if (bondingCurve.complete) {
  const global = await sdk.fetchGlobal();
  const ix = await PUMP_SDK.migrateInstruction({
    withdrawAuthority: global.withdrawAuthority,
    mint,
    user: wallet.publicKey,
  });

  const tx = new Transaction().add(ix);
  await sendAndConfirmTransaction(connection, tx, [wallet]);
  console.log("Token migrated to AMM!");
}
```

## Decode Account Data

Use the offline SDK to decode raw account data:

```typescript
import { PUMP_SDK, bondingCurvePda, GLOBAL_PDA } from "@pump-fun/pump-sdk";

// Fetch and decode a bonding curve
const bcAddress = bondingCurvePda(mint);
const bcInfo = await connection.getAccountInfo(bcAddress);
if (bcInfo) {
  const bc = PUMP_SDK.decodeBondingCurve(bcInfo);
  console.log("Reserves:", bc.virtualSolReserves.toString());
}

// Decode global config
const globalInfo = await connection.getAccountInfo(GLOBAL_PDA);
if (globalInfo) {
  const global = PUMP_SDK.decodeGlobal(globalInfo);
  console.log("Fee bps:", global.feeBasisPoints.toString());
}
```
