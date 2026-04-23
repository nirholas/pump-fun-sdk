# Tutorial 11: Building a Trading Bot

> Build a bot that monitors Pump tokens and executes trades based on bonding curve conditions.

> **Breaking change — 2026-04-28:** Every buy and sell instruction built by this bot now requires a new trailing fee-recipient account. Upgrade to `@nirholas/pump-sdk@^1.32.0` before cutover — the SDK handles it automatically. See **[Tutorial 45: Breaking Fee Recipient Upgrade](./45-breaking-fee-recipient-upgrade.md)**.

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
} from "@nirholas/pump-sdk";
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

### Buy Execution

```typescript
async function executeBuy(mint: PublicKey, solAmount: BN): Promise<string | null> {
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

### Sell Execution

```typescript
async function executeSell(mint: PublicKey, tokenAmount: BN): Promise<string | null> {
  const sellState = await onlineSdk.fetchSellState(mint, wallet.publicKey);
  const global = await onlineSdk.fetchGlobal();
  const feeConfig = await onlineSdk.fetchFeeConfig();

  const solOut = getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply: sellState.bondingCurve.tokenTotalSupply,
    bondingCurve: sellState.bondingCurve,
    amount: tokenAmount,
  });

  if (solOut.isZero()) {
    console.log("Would receive 0 SOL — skipping");
    return null;
  }

  const sellIxs = await PUMP_SDK.sellInstructions({
    global: sellState.global,
    bondingCurveAccountInfo: sellState.bondingCurveAccountInfo,
    bondingCurve: sellState.bondingCurve,
    mint,
    user: wallet.publicKey,
    amount: tokenAmount,
    slippage: 0.05,
    tokenProgram: sellState.tokenProgram,
  });

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: sellIxs,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([wallet]);
  return connection.sendTransaction(tx);
}
```

### AMM Sell (Graduated Tokens)

When a token graduates, route sells through the AMM:

```typescript
import { canonicalPumpPoolPda } from "@nirholas/pump-sdk";

async function executeAmmSell(mint: PublicKey, tokenAmount: BN): Promise<string | null> {
  const pool = canonicalPumpPoolPda(mint);

  const sellIx = await PUMP_SDK.ammSellInstruction({
    user: wallet.publicKey,
    pool,
    mint,
    baseAmountIn: tokenAmount,
    minQuoteAmountOut: new BN(1), // Set a real minimum in production
  });

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: [sellIx],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([wallet]);
  return connection.sendTransaction(tx);
}
```

## Step 5: Track Positions

Prevent re-buying tokens you already hold:

```typescript
const positions = new Map<string, BN>(); // mint → token amount

async function refreshPosition(mint: PublicKey): Promise<BN> {
  const balance = await onlineSdk.getTokenBalance(mint, wallet.publicKey);
  positions.set(mint.toBase58(), balance);
  return balance;
}

function hasPosition(mint: PublicKey): boolean {
  const balance = positions.get(mint.toBase58());
  return balance !== undefined && balance.gtn(0);
}
```

## Step 6: Run the Bot Loop

```typescript
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

      // Refresh position for this token
      await refreshPosition(mint);

      const signal = evaluateToken(snapshot, config);
      console.log(`[${mint.toBase58().slice(0, 8)}...] ${signal.action}: ${signal.reason}`);

      try {
        if (signal.action === "buy" && signal.amount && !hasPosition(mint)) {
          const sig = await executeBuy(mint, signal.amount);
          console.log(`  → Bought! Tx: ${sig}`);
        } else if (signal.action === "buy" && hasPosition(mint)) {
          console.log(`  → Already holding — skip`);
        }

        if (signal.action === "sell" && hasPosition(mint)) {
          const balance = positions.get(mint.toBase58())!;
          if (snapshot.complete) {
            const sig = await executeAmmSell(mint, balance);
            console.log(`  → Sold on AMM! Tx: ${sig}`);
          } else {
            const sig = await executeSell(mint, balance);
            console.log(`  → Sold on curve! Tx: ${sig}`);
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  → Trade failed: ${message}`);
        // Don't retry immediately — wait for next loop cycle
      }
    }

    await sleep(10_000);
  }
}

runBot([
  new PublicKey("MINT_1"),
  new PublicKey("MINT_2"),
]);
```

## Running the Bot

```bash
# Install dependencies
npm install @nirholas/pump-sdk @solana/web3.js bn.js

# Run with ts-node or tsx
npx tsx bot.ts

# Or with environment-loaded wallet
WALLET_PATH=~/.config/solana/devnet.json npx tsx bot.ts
```

Load a real wallet from file instead of `Keypair.generate()`:

```typescript
import fs from "fs";

const walletData = JSON.parse(fs.readFileSync(process.env.WALLET_PATH!, "utf-8"));
const wallet = Keypair.fromSecretKey(Uint8Array.from(walletData));
```

## Safety Considerations

- **Always set slippage** — volatile tokens can move fast
- **Use spending limits** — cap your total SOL exposure per token and globally
- **Track positions** — avoid re-buying tokens you already hold (see Step 5)
- **Check `complete` before trading** — graduated tokens need AMM instructions, not bonding curve
- **Handle errors gracefully** — RPC calls can fail; never retry the same tx in a tight loop
- **Respect RPC rate limits** — dedicated endpoints (Helius, Quicknode) are strongly recommended for bots
- **Never hardcode private keys** — use environment variables or secure keystores
- **Test on devnet first** — validate your strategy before using real SOL

## What's Next?

- [Tutorial 12: Offline SDK vs Online SDK](./12-offline-vs-online.md)
- [Tutorial 24: Cross-Program Trading](./24-cross-program-trading.md) — Full bonding curve → AMM lifecycle

