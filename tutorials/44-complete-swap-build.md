# Tutorial 44: Complete Swap Build — Buy & Sell from Scratch

> A single, working end-to-end script you can copy, fund, and run. Covers every step: fetching state, computing quotes with slippage, building instructions, sending the transaction, and — critically — handling the u64 sell overflow that bites popular tokens (see [issue #6](https://github.com/nirholas/pump-fun-sdk/issues/6)).

**What you'll build:**

1. A `Swap` class that can buy and sell any Pump bonding-curve token.
2. Safe-by-default sells: it refuses to broadcast a sell that would overflow, and offers `sellAll()` that chunks large positions automatically.
3. A small CLI harness so you can drive it from the terminal.

**Expected time:** 15–20 minutes.

---

## 1. Why you need this guide

There are three places beginners get hurt:

| Pitfall | Symptom | Fix in this tutorial |
|---------|---------|----------------------|
| Using `number` instead of `BN` | Silent precision loss on 64-bit amounts | All amounts are `BN` |
| Missing slippage | "Slippage exceeded" or fills at unexpected price | Explicit `slippageBps` arg with a sane default |
| u64 sell overflow | Sell fails ~25% of the time on popular tokens (error 6024) | `maxSafeSellAmount` + `sellChunked` |

The third one is subtle and will not show up in a devnet test where reserves are tiny. On mainnet, once `virtualSolReserves` grows past ~3e9 lamports and your wallet holds ~6e12+ raw token units, every sell is one coin-flip away from failure. The SDK now refuses these sells pre-flight with a `SellOverflowError` so your transaction never leaves the client.

---

## 2. Install

```bash
npm install @nirholas/pump-sdk @solana/web3.js @solana/spl-token bn.js
```

You'll also want a funded keypair. Devnet faucet works for testing buys; sells need a position first.

```bash
solana-keygen new --outfile ./keys/trader.json
solana airdrop 2 $(solana-keygen pubkey ./keys/trader.json) -u devnet
```

---

## 3. The `Swap` class

Drop this into `swap.ts`:

```typescript
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  PUMP_SDK,
  OnlinePumpSdk,
  SellOverflowError,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
  maxSafeSellAmount,
} from "@nirholas/pump-sdk";
import BN from "bn.js";

export interface SwapConfig {
  rpcUrl: string;
  trader: Keypair;
  /** Slippage tolerance in basis points (100 = 1%). */
  slippageBps?: number;
  /** Priority fee in micro-lamports per CU. */
  priorityFeeMicroLamports?: number;
  /** Compute unit limit for each transaction. */
  computeUnitLimit?: number;
}

export class Swap {
  private readonly connection: Connection;
  private readonly sdk: OnlinePumpSdk;
  private readonly trader: Keypair;
  private readonly slippageBps: number;
  private readonly priorityFee: number;
  private readonly cuLimit: number;

  constructor(cfg: SwapConfig) {
    this.connection = new Connection(cfg.rpcUrl, "confirmed");
    this.sdk = new OnlinePumpSdk(this.connection);
    this.trader = cfg.trader;
    this.slippageBps = cfg.slippageBps ?? 100; // 1%
    this.priorityFee = cfg.priorityFeeMicroLamports ?? 50_000;
    this.cuLimit = cfg.computeUnitLimit ?? 400_000;
  }

  /** Buy `solLamports` worth of `mint` at the current bonding-curve price. */
  async buy(mint: PublicKey, solLamports: BN): Promise<string> {
    const [buyState, global, feeConfig] = await Promise.all([
      this.sdk.fetchBuyState(mint, this.trader.publicKey),
      this.sdk.fetchGlobal(),
      this.sdk.fetchFeeConfig(),
    ]);

    // Quote: how many tokens will we receive?
    const expectedTokens = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: buyState.bondingCurve.tokenTotalSupply,
      bondingCurve: buyState.bondingCurve,
      amount: solLamports,
    });

    const ixs = await PUMP_SDK.buyInstructions({
      global,
      bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
      bondingCurve: buyState.bondingCurve,
      associatedUserAccountInfo: buyState.associatedUserAccountInfo,
      mint,
      user: this.trader.publicKey,
      solAmount: solLamports,
      amount: expectedTokens,
      slippage: this.slippageBps / 100, // SDK takes percent, not bps
      tokenProgram: TOKEN_PROGRAM_ID,
    });

    return this.send(ixs);
  }

  /** Sell `amount` raw token units of `mint` back to the bonding curve. */
  async sell(mint: PublicKey, amount: BN): Promise<string> {
    const [sellState, global, feeConfig] = await Promise.all([
      this.sdk.fetchSellState(mint, this.trader.publicKey),
      this.sdk.fetchGlobal(),
      this.sdk.fetchFeeConfig(),
    ]);

    const expectedSol = getSellSolAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply: sellState.bondingCurve.tokenTotalSupply,
      bondingCurve: sellState.bondingCurve,
      amount,
    });

    // PUMP_SDK.sellInstructions will throw SellOverflowError if the amount
    // would overflow the on-chain u64 multiply — caught below.
    const ixs = await PUMP_SDK.sellInstructions({
      global,
      bondingCurveAccountInfo: sellState.bondingCurveAccountInfo,
      bondingCurve: sellState.bondingCurve,
      mint,
      user: this.trader.publicKey,
      amount,
      solAmount: expectedSol,
      slippage: this.slippageBps / 100,
      tokenProgram: TOKEN_PROGRAM_ID,
    });

    return this.send(ixs);
  }

  /**
   * Sell `totalAmount` (or all held tokens) in chunks sized to stay under the
   * u64 overflow limit. State is refetched between chunks so reserves stay
   * current as earlier chunks land.
   *
   * Returns the signatures of every chunk in submission order.
   */
  async sellChunked(mint: PublicKey, totalAmount: BN): Promise<string[]> {
    return this.sdk.sellChunked({
      mint,
      user: this.trader.publicKey,
      totalAmount,
      slippage: this.slippageBps / 100,
      tokenProgram: TOKEN_PROGRAM_ID,
      sendTx: (ixs) => this.send(ixs),
    });
  }

  /**
   * Convenience: reads the current max safe chunk without sending anything.
   * Useful for UIs that want to show "you can sell at most X in one click".
   */
  async maxSafeSell(mint: PublicKey): Promise<BN> {
    const state = await this.sdk.fetchSellState(mint, this.trader.publicKey);
    return maxSafeSellAmount(state.bondingCurve.virtualSolReserves);
  }

  // ── plumbing ─────────────────────────────────────────────────────

  private async send(ixs: TransactionInstruction[]): Promise<string> {
    const withBudget: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: this.cuLimit }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: this.priorityFee }),
      ...ixs,
    ];

    const { blockhash } = await this.connection.getLatestBlockhash("confirmed");
    const msg = new TransactionMessage({
      payerKey: this.trader.publicKey,
      recentBlockhash: blockhash,
      instructions: withBudget,
    }).compileToV0Message();

    const tx = new VersionedTransaction(msg);
    tx.sign([this.trader]);

    const sig = await this.connection.sendTransaction(tx, { maxRetries: 3 });
    await this.connection.confirmTransaction(sig, "confirmed");
    return sig;
  }
}
```

A few notes on the code:

- **`slippage` is percent, not bps.** The SDK's `buyInstructions` / `sellInstructions` take `slippage: 1` to mean "1%". We keep the more conventional bps on the public API and convert at the boundary.
- **We use `fetchBuyState` / `fetchSellState`.** These are the batched `getMultipleAccounts` helpers — one RPC call instead of three.
- **Priority fees + CU limit are separate ixs.** Without them you're at the mercy of mainnet congestion.
- **`sellChunked` fetches fresh state per chunk.** This is mandatory: the reserves change as each chunk lands, and the max safe size changes with them.

---

## 4. Drive it from a CLI

`cli.ts`:

```typescript
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import BN from "bn.js";
import { SellOverflowError } from "@nirholas/pump-sdk";
import { Swap } from "./swap";

const RPC = process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";
const KEY_PATH = process.env.KEY_PATH ?? "./keys/trader.json";

function loadKey(): Keypair {
  return Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(KEY_PATH, "utf8"))),
  );
}

async function main() {
  const [cmd, mintStr, amountStr] = process.argv.slice(2);
  if (!cmd || !mintStr || !amountStr) {
    console.error("Usage: ts-node cli.ts <buy|sell|sell-all> <mint> <amount>");
    process.exit(1);
  }

  const swap = new Swap({
    rpcUrl: RPC,
    trader: loadKey(),
    slippageBps: 100, // 1%
  });
  const mint = new PublicKey(mintStr);

  try {
    if (cmd === "buy") {
      const sig = await swap.buy(mint, new BN(amountStr));
      console.log("buy  ", sig);
    } else if (cmd === "sell") {
      const sig = await swap.sell(mint, new BN(amountStr));
      console.log("sell ", sig);
    } else if (cmd === "sell-all") {
      const sigs = await swap.sellChunked(mint, new BN(amountStr));
      sigs.forEach((s, i) => console.log(`chunk ${i}`, s));
    } else {
      throw new Error(`unknown cmd: ${cmd}`);
    }
  } catch (e) {
    if (e instanceof SellOverflowError) {
      console.error(
        `too big: sell ≤ ${e.maxSafeAmount.toString()} per tx, ` +
          `or use 'sell-all' to chunk automatically`,
      );
      process.exit(2);
    }
    throw e;
  }
}

main();
```

Run it:

```bash
# Buy 0.1 SOL of MINT
ts-node cli.ts buy <MINT> 100000000

# Sell 1M raw token units
ts-node cli.ts sell <MINT> 1000000

# Sell a whole position safely, chunked
ts-node cli.ts sell-all <MINT> 6325344957752
```

---

## 5. What actually happens on a sell overflow

The on-chain pump program does (simplified):

```rust
let sol_out = amount
    .checked_mul(virtual_sol_reserves)?   // ← u64 * u64, u64 result
    .checked_div(virtual_token_reserves.checked_add(amount)?)?;
```

When `amount * virtualSolReserves > u64::MAX` (about `1.84e19`), `checked_mul` returns `None` and the program aborts with AnchorError 6024 (`Overflow`) at `programs/pump/src/lib.rs:764`.

The trap: this happens **after** `TransferChecked` has already moved your tokens out of your wallet. The tx reverts, your tokens come back, you pay the priority fee, and nothing tells you why until you dig into the logs.

The SDK now catches this pre-flight:

```typescript
// inside PUMP_SDK.sellInstructions
validateSellAmount(amount, bondingCurve);
// → throws SellOverflowError(amount, virtualSolReserves, maxSafeAmount)
```

And `maxSafeSellAmount(reserves) = floor(0.9 * u64::MAX / reserves)` — the 10% safety margin absorbs reserve drift between quoting and execution.

---

## 6. Testing your integration locally

Unit tests for your own code:

```typescript
import { makeBondingCurve } from "@nirholas/pump-sdk/dist/__tests__/fixtures"; // if exported
import BN from "bn.js";
import { SellOverflowError, validateSellAmount } from "@nirholas/pump-sdk";

describe("overflow guard", () => {
  it("throws on the issue #6 amount", () => {
    const bc = makeBondingCurve({ virtualSolReserves: new BN("5000000000000000") });
    expect(() => validateSellAmount(new BN("6325344957752"), bc))
      .toThrow(SellOverflowError);
  });
});
```

Integration test on devnet:

1. Create a token with `PUMP_SDK.createV2Instruction`.
2. Buy a small amount with `swap.buy(mint, new BN(50_000_000))`.
3. Sell it with `swap.sell(mint, balance)`.
4. Verify balance ≈ 0.

See `tests/integration/test-online-sdk-buy-sell.ts` in the repo for a working example.

---

## 7. Next steps

- **[Tutorial 5 — Bonding Curve Math](05-bonding-curve-math.md)** — understand what `getBuyTokenAmountFromSolAmount` is actually computing.
- **[Tutorial 12 — Offline vs Online SDK](12-offline-vs-online.md)** — when to use `PUMP_SDK` vs `new OnlinePumpSdk()`.
- **[Tutorial 33 — Error Handling Patterns](33-error-handling-patterns.md)** — `SellOverflowError` is one of several typed errors; catch them at the right layer.
- **[Tutorial 24 — Cross-Program Trading](24-cross-program-trading.md)** — what to do when a token has graduated to the AMM.
