---
name: pump-sdk-typescript
description: Write TypeScript that builds Pump protocol instructions on Solana with @nirholas/pump-sdk, covering OnlinePumpSdk, PUMP_SDK, bonding curve quotes, routed buys and creator fee collection. Use when adding Pump trading or token creation to an app.
---

# @nirholas/pump-sdk in TypeScript

Install the package and its peers:

```
npm install @nirholas/pump-sdk @solana/web3.js @solana/spl-token @coral-xyz/anchor bn.js
```

The SDK builds `TransactionInstruction[]`. It never signs or sends; you put the instructions in a transaction, sign with your own wallet and send. It covers three on-chain programs (Pump, PumpAMM, PumpFees).

## Two entry points

- `PUMP_SDK` (class `PumpSdk`): offline builders and decoders, no connection needed.
- `new OnlinePumpSdk(connection)`: the same plus live RPC fetches. Use this by default.

## Read state

```ts
import { Connection, PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk } from "@nirholas/pump-sdk";

const sdk = new OnlinePumpSdk(new Connection(process.env.SOLANA_RPC_URL!));
const summary = await sdk.fetchBondingCurveSummary(new PublicKey(mint));
console.log(summary.marketCap.toString(), summary.isGraduated, summary.progressBps / 100);
```

`BondingCurve.complete === true` means the token graduated to the AMM and curve trades fail.

## Build a buy

`buyBySolAmount` computes the expected token output for you:

```ts
const ixs = await sdk.buyBySolAmount({ mint, user, solAmount, slippage: 1 }); // BN lamports
```

`routedBuyInstructions({ mint, user, quoteAmountIn, slippage })` picks the bonding curve or the AMM pool depending on graduation. The matching sell builders are `sellInstructions` and `routedSellInstructions`. `slippage` is a percent in the instruction math of `src/sdk.ts` (`1` means 1 percent), even though some JSDoc says decimal; quote first and check.

Lower level: `fetchBuyState(mint, user)` returns `bondingCurveAccountInfo`, `bondingCurve`, `associatedUserAccountInfo` and `tokenProgram`; spread it into `sdk.buyInstructions({ ...state, mint, user, amount, solAmount, slippage })`. Use `getBuyTokenAmountFromSolAmount`, `getSellSolAmountFromTokenAmount` and `bondingCurveMarketCap` from the package root for offline quotes.

## Create a token and collect fees

`PUMP_SDK.createV2Instruction({ mint, name, symbol, uri, creator, user, mayhemMode, ... })` creates a Token-2022 token (`createInstruction` v1 is deprecated). `uri` points at the metadata JSON. `sdk.collectCoinCreatorFeeInstructions(creator, feePayer?)` collects creator fees from both programs, and `sdk.getCreatorVaultBalanceBothPrograms(creator)` reads the balance first.

## Rules

- Confirm the mint, amount and network with the user before any transaction is signed or sent.
- Fee sharing allows at most 10 shareholders whose shares total 10,000 bps, with no duplicates or zero shares.
- Read `src/index.ts` for the exported surface and `src/sdk.ts` / `src/onlineSdk.ts` for exact parameters before relying on a method not listed here.
