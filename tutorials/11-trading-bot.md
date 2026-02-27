# Tutorial 11: Building a Trading Bot

> Build a bot that monitors Pump tokens and executes trades based on bonding curve conditions.

## Architecture

```
                  ┌──────────────┐
                  │  Solana RPC   │
                  └──────┬───────┘
                         │
               ┌─────────▼──────────┐
               │   OnlinePumpSdk    │
               │  (fetch state)     │
               └─────────┬──────────┘
                         │
               ┌─────────▼──────────┐
               │  Trading Logic     │
               │  (price checks,    │
               │   slippage calc)   │
               └─────────┬──────────┘
                         │
               ┌─────────▼──────────┐
               │    PUMP_SDK        │
               │  (build + sign tx) │
               └─────────┬──────────┘
                         │
               ┌─────────▼──────────┐
               │  Send Transaction  │
               └────────────────────┘
```

## Step 1: Set Up the Bot

```typescript
import { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import {
  OnlinePumpSdk,
  PUMP_SDK,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
  bondingCurveMarketCap,
} from "@pump-fun/pump-sdk";
import BN from "bn.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);
const wallet = Keypair.generate(); // Your funded wallet
```

## Step 2: Monitor Token State

```typescript
interface TokenSnapshot {
  mint: PublicKey;
  marketCapLamports: BN;
  pricePerToken: number;
  realSolReserves: BN;
  realTokenReserves: BN;
  complete: boolean;
}

async function getTokenSnapshot(mint: PublicKey): Promise<TokenSnapshot | null> {
  try {
    const bc = await onlineSdk.fetchBondingCurve(mint);

    if (bc.complete || bc.virtualTokenReserves.isZero()) {
      return { mint, marketCapLamports: new BN(0), pricePerToken: 0,
               realSolReserves: bc.realSolReserves,
               realTokenReserves: bc.realTokenReserves, complete: true };
    }

    const marketCap = bondingCurveMarketCap({
      mintSupply: bc.tokenTotalSupply,
      virtualSolReserves: bc.virtualSolReserves,
      virtualTokenReserves: bc.virtualTokenReserves,
    });

    const price = bc.virtualSolReserves.toNumber() / bc.virtualTokenReserves.toNumber();

    return {
      mint,
      marketCapLamports: marketCap,
      pricePerToken: price,
      realSolReserves: bc.realSolReserves,
      realTokenReserves: bc.realTokenReserves,
      complete: false,
    };
  } catch {
    return null;
  }
}
```

## Step 3: Define Trading Strategy

```typescript
interface TradeSignal {
  action: "buy" | "sell" | "hold";
  reason: string;
  amount?: BN;
}

function evaluateToken(
  snapshot: TokenSnapshot,
  config: {
    maxMarketCapSol: number;
    minMarketCapSol: number;
    buyAmountLamports: number;
  }
): TradeSignal {
  if (snapshot.complete) {
    return { action: "hold", reason: "Token graduated — use AMM" };
  }

  const marketCapSol = snapshot.marketCapLamports.toNumber() / 1e9;

  // Buy if under target market cap
  if (marketCapSol < config.maxMarketCapSol && marketCapSol > config.minMarketCapSol) {
    return {
      action: "buy",
      reason: `Market cap ${marketCapSol.toFixed(2)} SOL is in target range`,
      amount: new BN(config.buyAmountLamports),
    };
  }

  // Sell if over target
  if (marketCapSol > config.maxMarketCapSol * 2) {
    return {
      action: "sell",
      reason: `Market cap ${marketCapSol.toFixed(2)} SOL exceeds 2x target`,
    };
  }

  return { action: "hold", reason: `Market cap ${marketCapSol.toFixed(2)} SOL — no action` };
}
```

## Step 4: Execute Trades

```typescript
async function executeBuy(mint: PublicKey, solAmount: BN) {
  const buyState = await onlineSdk.fetchBuyState(mint, wallet.publicKey);
  const global = await onlineSdk.fetchGlobal();
  const feeConfig = await onlineSdk.fetchFeeConfig();

  const tokensOut = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: buyState.mintSupply,
    bondingCurve: buyState.bondingCurve,
    amount: solAmount,
  });

  if (tokensOut.isZero()) {
    console.log("Would receive 0 tokens — skipping");
    return null;
  }

  const buyIxs = await PUMP_SDK.buyInstructions({
    global: buyState.global,
    bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
    bondingCurve: buyState.bondingCurve,
    associatedUserAccountInfo: buyState.associatedUserAccountInfo,
    mint,
    user: wallet.publicKey,
    amount: tokensOut,
    solAmount,
    slippage: 0.05,
    tokenProgram: buyState.tokenProgram,
  });

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: buyIxs,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([wallet]);
  return connection.sendTransaction(tx);
}
```

## Step 5: Run the Bot Loop

```typescript
async function runBot(mints: PublicKey[]) {
  const config = {
    maxMarketCapSol: 50,    // Target range ceiling
    minMarketCapSol: 1,     // Target range floor
    buyAmountLamports: 100_000_000, // 0.1 SOL per buy
  };

  console.log("Starting trading bot...");
  console.log(`Monitoring ${mints.length} tokens`);

  while (true) {
    for (const mint of mints) {
      const snapshot = await getTokenSnapshot(mint);
      if (!snapshot) continue;

      const signal = evaluateToken(snapshot, config);
      console.log(`[${mint.toBase58().slice(0, 8)}...] ${signal.action}: ${signal.reason}`);

      if (signal.action === "buy" && signal.amount) {
        try {
          const sig = await executeBuy(mint, signal.amount);
          console.log(`  → Bought! Tx: ${sig}`);
        } catch (err) {
          console.error(`  → Buy failed:`, err);
        }
      }
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, 10_000));
  }
}

runBot([
  new PublicKey("MINT_1"),
  new PublicKey("MINT_2"),
]);
```

## Safety Considerations

- **Always set slippage** — volatile tokens can move fast
- **Use spending limits** — cap your total exposure
- **Check `complete` before trading** — graduated tokens need the AMM
- **Handle errors gracefully** — RPC calls can fail
- **Never hardcode private keys** — use environment variables or secure keystores

## What's Next?

- [Tutorial 12: Offline SDK vs Online SDK](./12-offline-vs-online.md)
- [Tutorial 13: Generating Vanity Addresses](./13-vanity-addresses.md)
