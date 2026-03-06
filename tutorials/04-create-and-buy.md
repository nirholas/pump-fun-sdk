# Tutorial 4: Create and Buy in One Transaction

> Launch a token and make the first purchase atomically — no frontrunning.

## Why Atomic Create + Buy?

When you create a token and buy separately, someone could frontrun your buy. By combining both operations into a single transaction, your first purchase is guaranteed to execute at the initial bonding curve price.

## Prerequisites

```bash
npm install @pump-fun/pump-sdk @solana/web3.js bn.js
```

## Using `createV2AndBuyInstructions`

The SDK provides a dedicated method that combines token creation and buying:

```typescript
import { Connection, Keypair, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { PUMP_SDK, OnlinePumpSdk, getBuyTokenAmountFromSolAmount, newBondingCurve } from "@pump-fun/pump-sdk";
import BN from "bn.js";

async function createAndBuy() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const onlineSdk = new OnlinePumpSdk(connection);
  const creator = Keypair.generate(); // Use your funded keypair
  const mint = Keypair.generate();

  // Fetch global state to calculate initial price
  const global = await onlineSdk.fetchGlobal();
  const feeConfig = await onlineSdk.fetchFeeConfig();

  // Calculate tokens at initial bonding curve price
  const solToSpend = new BN(500_000_000); // 0.5 SOL
  const initialBondingCurve = newBondingCurve(global);

  const tokensOut = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: null,        // null = use initial supply
    bondingCurve: null,      // null = use initial bonding curve
    amount: solToSpend,
  });

  console.log(`Creating token and buying ${tokensOut.toString()} tokens for 0.5 SOL`);

  // Build the combined instructions
  const instructions = await PUMP_SDK.createV2AndBuyInstructions({
    global,
    feeConfig,
    mint: mint.publicKey,
    name: "Launch Token",
    symbol: "LAUNCH",
    uri: "https://example.com/metadata.json",
    creator: creator.publicKey,
    user: creator.publicKey,
    amount: tokensOut,
    solAmount: solToSpend,
    slippage: 0.01,           // 1% slippage (tight since we're first)
    mayhemMode: false,
    cashback: false,
  });

  // Send as a single atomic transaction
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: creator.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([creator, mint]); // Both must sign

  const signature = await connection.sendTransaction(tx);
  console.log("Created + bought!", signature);
  console.log("Mint:", mint.publicKey.toBase58());
}

createAndBuy();
```

## Using `newBondingCurve` for Price Preview

Since the token doesn't exist yet, you can't fetch its bonding curve. Use `newBondingCurve(global)` to create a virtual bonding curve representing the initial state:

```typescript
import { newBondingCurve, bondingCurveMarketCap } from "@pump-fun/pump-sdk";

const initial = newBondingCurve(global);
console.log("Initial virtual SOL reserves:", initial.virtualSolReserves.toString());
console.log("Initial virtual token reserves:", initial.virtualTokenReserves.toString());
console.log("Initial real token reserves:", initial.realTokenReserves.toString());

// Calculate initial market cap
const marketCap = bondingCurveMarketCap({
  mintSupply: initial.tokenTotalSupply,
  virtualSolReserves: initial.virtualSolReserves,
  virtualTokenReserves: initial.virtualTokenReserves,
});
console.log("Initial market cap:", marketCap.toString(), "lamports");
```

## Slippage Tips

Since you're the first buyer on an atomic create-and-buy, you can use very tight slippage:

| Scenario | Recommended Slippage |
|----------|---------------------|
| Create + buy (first buyer) | 0.01 (1%) |
| Buy on active curve | 0.05 (5%) |
| Buy on volatile token | 0.10 (10%) |

## What's Next?

- [Tutorial 5: Bonding Curve Math Deep Dive](./05-bonding-curve-math.md)
- [Tutorial 7: Set Up Fee Sharing](./07-fee-sharing.md)
