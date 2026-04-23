# Tutorial 23: Mayhem Mode Trading

> Create and trade tokens using Pump's Mayhem Mode — Token-2022, separate vault routing, different fee recipients, and supply-based fee tiers.

> **Breaking change — 2026-04-28:** Mayhem mode buys and sells are subject to the same trailing fee-recipient requirement as regular trades. Upgrade to `@nirholas/pump-sdk@^1.32.0` — handled automatically. See **[Tutorial 45: Breaking Fee Recipient Upgrade](./45-breaking-fee-recipient-upgrade.md)**.

## Prerequisites

- Node.js 18+
- `@nirholas/pump-sdk` installed
- Understanding of [Tutorial 01](./01-create-token.md) (basic token creation)

```bash
npm install @nirholas/pump-sdk @solana/web3.js bn.js
```

## What Is Mayhem Mode?

Mayhem Mode is an alternative token creation path on Pump. When enabled:

| Feature | Standard Mode | Mayhem Mode |
|---------|---------------|-------------|
| Token Program | `TOKEN_PROGRAM_ID` | `TOKEN_2022_PROGRAM_ID` |
| Vault routing | Standard Pump vaults | Separate Mayhem program vaults |
| Fee recipients | `global.feeRecipient` + pool | `global.reservedFeeRecipient` + pool |
| Fee tier supply baseline | Fixed `ONE_BILLION_SUPPLY` (1B × 10⁶) | Actual `bondingCurve.tokenTotalSupply` |
| PDAs | Standard Pump PDAs | Mayhem-specific PDAs under `MAYHEM_PROGRAM_ID` |
| Immutable | — | Set at creation, **cannot be changed** |

**Key point:** Mayhem Mode is set at token creation and cannot be toggled afterward. The flag lives on the bonding curve as `bondingCurve.isMayhemMode`.

## Step 1: Check Protocol Status Before Creating

Before creating a Mayhem token, verify the protocol has Mayhem Mode enabled:

```typescript
import { Connection } from "@solana/web3.js";
import { OnlinePumpSdk } from "@nirholas/pump-sdk";

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);

const global = await onlineSdk.fetchGlobal();

if (!global.mayhemModeEnabled) {
  throw new Error("Mayhem Mode is currently disabled at the protocol level");
}

console.log("Mayhem Mode enabled:", global.mayhemModeEnabled);
console.log("Mayhem fee recipients:", [
  global.reservedFeeRecipient.toBase58(),
  ...global.reservedFeeRecipients.map((r) => r.toBase58()),
]);
```

## Step 2: Create a Mayhem Mode Token

```typescript
import { Keypair, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { PUMP_SDK } from "@nirholas/pump-sdk";

const creator = Keypair.generate(); // Your funded wallet
const mint = Keypair.generate();

// Enable Mayhem Mode at creation — IRREVERSIBLE
const createIx = await PUMP_SDK.createV2Instruction({
  mint: mint.publicKey,
  name: "Mayhem Token",
  symbol: "MAYHEM",
  uri: "https://example.com/metadata.json",
  creator: creator.publicKey,
  user: creator.publicKey,
  mayhemMode: true,   // <-- activates Token-2022 + mayhem vault routing
  cashback: false,
});

const { blockhash } = await connection.getLatestBlockhash();
const tx = new VersionedTransaction(
  new TransactionMessage({
    payerKey: creator.publicKey,
    recentBlockhash: blockhash,
    instructions: [createIx],
  }).compileToV0Message(),
);
tx.sign([creator, mint]);
const sig = await connection.sendTransaction(tx);
console.log("Created mayhem token:", sig);
```

## Step 3: Create + Buy in One Transaction

`createV2AndBuyInstructions` atomically creates the token and buys a position in a single transaction — no separate buy step needed:

```typescript
import { PUMP_SDK, OnlinePumpSdk } from "@nirholas/pump-sdk";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";

const onlineSdk = new OnlinePumpSdk(connection);
const global = await onlineSdk.fetchGlobal();

const solToSpend = new BN(500_000_000); // 0.5 SOL for the initial buy
const expectedTokens = new BN("50000000000"); // quote this from getBuyTokenAmountFromSolAmount

const ixs = await PUMP_SDK.createV2AndBuyInstructions({
  global,
  mint: mint.publicKey,
  name: "Mayhem Token",
  symbol: "MAYHEM",
  uri: "https://example.com/metadata.json",
  creator: creator.publicKey,
  user: creator.publicKey,
  solAmount: solToSpend,
  amount: expectedTokens,     // token amount output (1% slippage is applied internally)
  mayhemMode: true,
  cashback: false,
});

// ixs contains: [createV2, extendAccount, createATA (Token-2022), buy]
const { blockhash } = await connection.getLatestBlockhash();
const tx = new VersionedTransaction(
  new TransactionMessage({
    payerKey: creator.publicKey,
    recentBlockhash: blockhash,
    instructions: ixs,
  }).compileToV0Message(),
);
tx.sign([creator, mint]);
const sig = await connection.sendTransaction(tx);
console.log("Created and bought mayhem token:", sig);
```

## Step 4: Understand the PDA Differences

Mayhem Mode uses a separate program for vault derivation. The SDK exports all four PDA helpers:

```typescript
import {
  getGlobalParamsPda,
  getMayhemStatePda,
  getSolVaultPda,
  getTokenVaultPda,
  MAYHEM_PROGRAM_ID,
} from "@nirholas/pump-sdk";

// Protocol-level config under the Mayhem program
const globalParams = getGlobalParamsPda();
// Seeds: ["global-params"] under MAYHEM_PROGRAM_ID

// Per-token state for this mint
const mayhemState = getMayhemStatePda(mint.publicKey);
// Seeds: ["mayhem-state", mint.toBuffer()] under MAYHEM_PROGRAM_ID

// Shared SOL vault (one per protocol, not per token)
const solVault = getSolVaultPda();
// Seeds: ["sol-vault"] under MAYHEM_PROGRAM_ID

// Token vault = solVault's ATA for this mint, using TOKEN_2022_PROGRAM_ID
const tokenVault = getTokenVaultPda(mint.publicKey);
// = getAssociatedTokenAddressSync(mint, solVault, true, TOKEN_2022_PROGRAM_ID)

console.log("Mayhem Program:", MAYHEM_PROGRAM_ID.toBase58());
console.log("Global Params:", globalParams.toBase58());
console.log("Mayhem State:", mayhemState.toBase58());
console.log("SOL Vault:", solVault.toBase58());
console.log("Token Vault:", tokenVault.toBase58());
```

These accounts are passed automatically by `createV2Instruction` when `mayhemMode: true`. You only need to derive them manually for inspection or custom instruction building.

## Step 5: Quote a Buy — Fee-Aware

`getBuyTokenAmountFromSolAmount` respects the mayhem flag via the `bondingCurve` it receives. Pass all required fields — do not use a partial signature:

```typescript
import {
  getBuyTokenAmountFromSolAmount,
  OnlinePumpSdk,
} from "@nirholas/pump-sdk";
import BN from "bn.js";

const onlineSdk = new OnlinePumpSdk(connection);

const [global, feeConfig, bondingCurve] = await Promise.all([
  onlineSdk.fetchGlobal(),
  onlineSdk.fetchFeeConfig(),
  onlineSdk.fetchBondingCurve(mint.publicKey),
]);

const solToSpend = new BN(100_000_000); // 0.1 SOL

const tokensOut = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply,
  bondingCurve,
  amount: solToSpend,
});

console.log(`0.1 SOL → ${tokensOut.toString()} tokens`);
console.log(`Mayhem mode: ${bondingCurve.isMayhemMode}`);
```

## Step 6: Buy a Mayhem Token

`fetchBuyState` auto-detects `TOKEN_2022_PROGRAM_ID` from the mint account's owner, so no explicit `tokenProgram` argument is needed:

```typescript
import { OnlinePumpSdk } from "@nirholas/pump-sdk";
import BN from "bn.js";

const onlineSdk = new OnlinePumpSdk(connection);

// Auto-detects Token-2022 from the mint account owner
const { bondingCurve, bondingCurveAccountInfo, associatedUserAccountInfo, tokenProgram } =
  await onlineSdk.fetchBuyState(mint.publicKey, buyer.publicKey);

if (bondingCurve.complete) {
  throw new Error("Token has graduated — use AMM methods");
}

const solToSpend = new BN(100_000_000); // 0.1 SOL

// Quote tokens out
const tokensOut = getBuyTokenAmountFromSolAmount({
  global: await onlineSdk.fetchGlobal(),
  feeConfig: await onlineSdk.fetchFeeConfig(),
  mintSupply: bondingCurve.tokenTotalSupply,
  bondingCurve,
  amount: solToSpend,
});

// Build instructions — tokenProgram from fetchBuyState is TOKEN_2022_PROGRAM_ID for mayhem tokens
const buyIxs = await onlineSdk.buyInstructions({
  bondingCurveAccountInfo,
  bondingCurve,
  associatedUserAccountInfo,
  mint: mint.publicKey,
  user: buyer.publicKey,
  solAmount: solToSpend,
  amount: tokensOut,
  slippage: 1,            // 1% slippage
  tokenProgram,           // already TOKEN_2022_PROGRAM_ID for mayhem
});

const { blockhash } = await connection.getLatestBlockhash();
const tx = new VersionedTransaction(
  new TransactionMessage({
    payerKey: buyer.publicKey,
    recentBlockhash: blockhash,
    instructions: buyIxs,
  }).compileToV0Message(),
);
tx.sign([buyer]);
const sig = await connection.sendTransaction(tx);
console.log("Bought mayhem token:", sig);
```

## Step 7: Sell a Mayhem Token

Selling mirrors buying — `fetchSellState` also auto-detects the token program:

```typescript
import { getSellSolAmountFromTokenAmount, OnlinePumpSdk } from "@nirholas/pump-sdk";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";

const onlineSdk = new OnlinePumpSdk(connection);

// Auto-detects Token-2022
const { bondingCurve, bondingCurveAccountInfo, tokenProgram } =
  await onlineSdk.fetchSellState(mint.publicKey, seller.publicKey);

const [global, feeConfig] = await Promise.all([
  onlineSdk.fetchGlobal(),
  onlineSdk.fetchFeeConfig(),
]);

const tokenAmount = new BN("5000000000"); // tokens to sell

// Quote SOL out
const solOut = getSellSolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply,
  bondingCurve,
  amount: tokenAmount,
});

console.log(`Selling ${tokenAmount} tokens → ${solOut.toString()} lamports`);

const sellIxs = await onlineSdk.sellInstructions({
  bondingCurveAccountInfo,
  bondingCurve,
  mint: mint.publicKey,
  user: seller.publicKey,
  amount: tokenAmount,
  solAmount: solOut,
  slippage: 1,
  tokenProgram,   // TOKEN_2022_PROGRAM_ID from fetchSellState
});

const { blockhash } = await connection.getLatestBlockhash();
const tx = new VersionedTransaction(
  new TransactionMessage({
    payerKey: seller.publicKey,
    recentBlockhash: blockhash,
    instructions: sellIxs,
  }).compileToV0Message(),
);
tx.sign([seller]);
const sig = await connection.sendTransaction(tx);
console.log("Sold mayhem token:", sig);
```

## Step 8: Fee Tier Differences

In standard mode, fee tiers are evaluated against a fixed supply of 1 billion tokens (`ONE_BILLION_SUPPLY = 1_000_000_000_000_000`). In Mayhem Mode, the **actual `bondingCurve.tokenTotalSupply`** is used. This changes the market-cap threshold that determines which fee tier applies.

```typescript
import { computeFeesBps, ONE_BILLION_SUPPLY } from "@nirholas/pump-sdk";

const [global, feeConfig, bondingCurve] = await Promise.all([
  onlineSdk.fetchGlobal(),
  onlineSdk.fetchFeeConfig(),
  onlineSdk.fetchBondingCurve(mint.publicKey),
]);

// Standard mode: market cap computed at the fixed 1B-token baseline
const standardFees = computeFeesBps({
  global,
  feeConfig,
  mintSupply: ONE_BILLION_SUPPLY,
  virtualSolReserves: bondingCurve.virtualSolReserves,
  virtualTokenReserves: bondingCurve.virtualTokenReserves,
});

// Mayhem mode: market cap computed at the actual minted supply
const mayhemFees = computeFeesBps({
  global,
  feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply,
  virtualSolReserves: bondingCurve.virtualSolReserves,
  virtualTokenReserves: bondingCurve.virtualTokenReserves,
});

console.log("Standard protocol fee (bps):", standardFees.protocolFeeBps.toString());
console.log("Standard creator fee  (bps):", standardFees.creatorFeeBps.toString());
console.log("Mayhem  protocol fee (bps):", mayhemFees.protocolFeeBps.toString());
console.log("Mayhem  creator fee  (bps):", mayhemFees.creatorFeeBps.toString());
```

`getFee` (used internally by buy/sell instructions) branches on `bondingCurve.isMayhemMode` to pick the right baseline automatically — you only need to call `computeFeesBps` directly when building quotes or analytics.

## Step 9: Detect Mayhem Mode On-Chain

Read the `isMayhemMode` flag directly off the decoded bonding curve — this is authoritative and requires no account-owner inspection:

```typescript
import { OnlinePumpSdk } from "@nirholas/pump-sdk";
import { PublicKey } from "@solana/web3.js";

async function isMayhemToken(
  onlineSdk: OnlinePumpSdk,
  mintAddress: PublicKey,
): Promise<boolean> {
  const bc = await onlineSdk.fetchBondingCurve(mintAddress);
  return bc.isMayhemMode;
}

// Example: inspect a live token
const isMayhem = await isMayhemToken(onlineSdk, mint.publicKey);
console.log("Is Mayhem token:", isMayhem);
```

## Step 10: Bonding Curve Summary and Graduation Progress

`fetchBondingCurveSummary` returns price, fees, and graduation progress in one call. For mayhem tokens it passes `bondingCurve.tokenTotalSupply` to `computeFeesBps` automatically:

```typescript
import { OnlinePumpSdk } from "@nirholas/pump-sdk";

const onlineSdk = new OnlinePumpSdk(connection);

// All in one call — handles mayhem fee logic internally
const summary = await onlineSdk.fetchBondingCurveSummary(mint.publicKey);
console.log("Market cap (lamports):", summary.marketCap.toString());
console.log("Protocol fee (bps):  ", summary.protocolFeeBps.toString());
console.log("Creator fee (bps):   ", summary.creatorFeeBps.toString());

// How far to graduation (0–10 000 bps)
const progress = await onlineSdk.fetchGraduationProgress(mint.publicKey);
console.log(`Graduation: ${progress.progressBps / 100}%`);
console.log("Real SOL raised:", progress.realSolReserves.toString());
console.log("SOL needed to graduate:", progress.solNeededToGraduate.toString());
```

## Step 11: Mayhem + Cashback Combo

Mayhem Mode and cashback are independent flags — both can be enabled together. Cashback adds a `userVolumeAccumulator` account to remaining accounts on sell:

```typescript
import { PUMP_SDK, OnlinePumpSdk } from "@nirholas/pump-sdk";

// Create with both flags enabled
const createIx = await PUMP_SDK.createV2Instruction({
  mint: mint.publicKey,
  name: "Mayhem Cashback Token",
  symbol: "MCASH",
  uri: "https://example.com/metadata.json",
  creator: creator.publicKey,
  user: creator.publicKey,
  mayhemMode: true,
  cashback: true,
});

// Sell with cashback: SDK adds userVolumeAccumulator to remaining accounts
const { bondingCurve, bondingCurveAccountInfo, tokenProgram } =
  await onlineSdk.fetchSellState(mint.publicKey, seller.publicKey);

const [global, feeConfig] = await Promise.all([
  onlineSdk.fetchGlobal(),
  onlineSdk.fetchFeeConfig(),
]);

const tokenAmount = new BN("1000000000");
const solOut = getSellSolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply,
  bondingCurve,
  amount: tokenAmount,
});

const sellIxs = await onlineSdk.sellInstructions({
  bondingCurveAccountInfo,
  bondingCurve,
  mint: mint.publicKey,
  user: seller.publicKey,
  amount: tokenAmount,
  solAmount: solOut,
  slippage: 1,
  tokenProgram,       // TOKEN_2022_PROGRAM_ID
  cashback: true,     // appends userVolumeAccumulator to remaining accounts
});
```

## Step 12: Fee Recipient Routing

Mayhem tokens draw their fee recipient from a different pool than standard tokens. The SDK resolves this inside `buyInstruction` and `sellInstructions` automatically — no caller action required. For reference:

```typescript
import { getFeeRecipient } from "@nirholas/pump-sdk";

const global = await onlineSdk.fetchGlobal();

// Standard token: picks randomly from [feeRecipient, ...feeRecipients]
const standardRecipient = getFeeRecipient(global, false);

// Mayhem token: picks randomly from [reservedFeeRecipient, ...reservedFeeRecipients]
const mayhemRecipient = getFeeRecipient(global, true);

console.log("Standard recipient:", standardRecipient.toBase58());
console.log("Mayhem   recipient:", mayhemRecipient.toBase58());
```

The buy and sell instruction builders call `getFeeRecipient(global, bondingCurve.isMayhemMode)` internally, so the correct recipient is always selected without manual intervention.

## When to Use Mayhem Mode

**Use Mayhem Mode when:**
- You want Token-2022 features (transfer hooks, confidential transfers, etc.)
- You want fee tiers evaluated against the token's actual supply rather than the fixed 1B baseline
- You're building on top of the separate Mayhem vault infrastructure

**Use Standard Mode when:**
- You want maximum wallet and DEX compatibility
- You want predictable fee tier behavior anchored to the fixed 1B supply baseline
- You don't need Token-2022 extensions

## Important Caveats

1. **Immutable** — `isMayhemMode` cannot be changed after the bonding curve is created
2. **Token-2022 everywhere** — all ATAs for mayhem tokens must be derived with `TOKEN_2022_PROGRAM_ID`; pass the `tokenProgram` returned by `fetchBuyState` / `fetchSellState` to avoid this mistake
3. **Different fee recipients** — fees route to `reservedFeeRecipient` / `reservedFeeRecipients` on `Global`, not the standard `feeRecipient` pool
4. **Protocol gate** — check `global.mayhemModeEnabled` before attempting to create; the instruction will fail on-chain if the flag is off
5. **PDA derivation** — vault PDAs are under `MAYHEM_PROGRAM_ID`, not the standard Pump program; use the exported helpers
6. **Breaking fee-recipient upgrade** — since 2026-04-28, every mayhem buy/sell carries a trailing mutable fee-recipient account; this is handled automatically by `PUMP_SDK.*` and `OnlinePumpSdk`

## Next Steps

- See [Tutorial 27](./27-cashback-social-fees.md) for the full cashback system
- See [Tutorial 09](./09-fee-system.md) for understanding fee tiers in depth
- See [Tutorial 45](./45-breaking-fee-recipient-upgrade.md) for the 2026-04-28 breaking fee-recipient upgrade
