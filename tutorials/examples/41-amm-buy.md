# AMM Buy

> Quote a buy on a graduated token's PumpSwap pool, decompose the quote into fees and price impact, and build the swap instructions without sending anything.

## What you'll build

Everything in examples 11 through 16 happens on a bonding curve. Once a token graduates, that curve is closed and trading moves to a PumpAMM pool. This example is the same instinct applied on the other side of that line: quote first, understand the quote, then build instructions.

Three parts:

1. **Find a graduated token, live.** No hardcoded mint. The example listens to the AMM program's log stream and picks a real pool with real liquidity.
2. **Quote and interpret.** `ammQuoteBuy` returns tokens out, fees, and both pool reserves. From those four numbers, with integer math only, this example derives effective price, spot price, fee load in basis points, and the premium the fill sits above spot.
3. **Build the instructions and stop.** `ammBuyInstructions` returns a `TransactionInstruction[]` including wSOL wrapping and ATA creation. The example prints them and never signs or sends. Broadcasting is always your separate, explicit step.

## Prerequisites

- Node 18 or newer, `npm install` run.
- **Network access.** This is the first example in this set that reads mainnet. It uses a `logsSubscribe` WebSocket, so the endpoint must support subscriptions. The public mainnet RPC works but is rate limited; `PUMP_RPC_URL=https://your-endpoint` upgrades it.
- **No funded wallet needed.** With no `PUMP_WALLET` or `PUMP_WALLET_SECRET` set, `loadWallet()` generates an ephemeral keypair. The quote and the instruction build only need a public key to resolve the buyer's token accounts. Nothing is signed.

Optional overrides:

| Env var | Effect |
|---------|--------|
| `PUMP_RPC_URL` | RPC endpoint (default: public mainnet) |
| `GRADUATED_MINT` | Skip discovery and use this mint |
| `PUMP_WALLET` | Path to a solana-keygen JSON keypair |

Because this reads live state, **your output will differ from the sample below.** Different mint, different reserves, different price. The structure and the relationships between the numbers are what to check.

## Walkthrough

### 1. Imports

```ts
import { OnlinePumpSdk, type AmmBuyQuote } from "@nirholas/pump-sdk";
import BN from "bn.js";

import { getConnection } from "./_lib/connection";
import { formatSol, formatTokens, heading, row } from "./_lib/format";
import { findGraduatedMint } from "./_lib/discovery";
import { loadWallet } from "./_lib/wallet";
```

`OnlinePumpSdk` is the online half of the SDK: it fetches account state and delegates the arithmetic to the offline `PumpSdk`. Per the architecture rule, you instantiate one or the other, never both.

```ts
/** 1 whole Pump token = 1e6 raw units (6 decimals). */
const TOKEN_UNITS = new BN(1_000_000);
```

The decimal scale, as a `BN`, because it is about to be used as a multiplier in price math.

### 2. Finding a graduated token without hardcoding one

```ts
  heading("Finding a graduated token");
  const { mint } = await findGraduatedMint(connection);
  row("Mint", mint.toBase58());
```

`findGraduatedMint` lives in [`examples/_lib/discovery.ts`](../../examples/_lib/discovery.ts) and its header comment explains why it is written the way it is. The short version: hardcoding a mint rots, and polling recent transactions burns a public RPC's rate limit against a program doing roughly a hundred transactions a second, most of them failed slippage bots. So it listens instead.

The strategy has three stages:

1. **`GRADUATED_MINT` override**, if set. Deterministic runs when you need them.
2. **Watch for `complete` / `completePumpAmmMigration` events** for 8 seconds. A freshly graduated mint has a canonical pool moments later. Completions only stream every minute or two, so this pass is deliberately short.
3. **Sweep live AMM transactions.** Grab a few signatures off the AMM program's log stream, fetch each transaction, and decode any account owned by the AMM program as a `Pool`. Any live AMM transaction names its pool, so this always finds one.

One filter is load-bearing in both stages:

```ts
// A pool mid-migration exists before liquidity lands; skip until
// LP tokens prove the deposit completed.
if (!state.lpSupply.isZero()) return { mint, pool, state };
```

A pool account exists during migration, before liquidity is deposited. Quoting against it would divide by empty reserves. `lpSupply` is the evidence that the deposit actually completed, and checking it is the difference between an example that works and one that fails intermittently on freshly graduated tokens.

### 3. Interpreting the quote

```ts
export interface AmmBuyQuoteBreakdown {
  /** Lamports paid per whole token at this fill (input / output). */
  effectivePriceLamports: BN;
  /** Pool spot price in lamports per whole token (quoteReserve / baseReserve). */
  spotPriceLamports: BN;
  /** Total fees as basis points of the SOL spent. */
  feeBpsOfInput: BN;
  /** How far the effective price sits above spot, in basis points. */
  premiumOverSpotBps: BN;
}
```

```ts
export function interpretAmmBuyQuote(quote: AmmBuyQuote): AmmBuyQuoteBreakdown {
  if (quote.tokensOut.isZero()) {
    throw new Error("Quote returned zero tokens out; input too small to fill");
  }
  if (quote.poolBaseAmount.isZero() || quote.poolQuoteAmount.isZero()) {
    throw new Error(
      "Pool reserves are empty; this pool has no liquidity to price against",
    );
  }
```

Two guards before any division, each with a message that names the actual condition. "Division by zero" would be true and useless; "input too small to fill" tells the caller what to change. Errors handled at the boundary, where live data enters.

```ts
  const effectivePriceLamports = quote.solSpent
    .mul(TOKEN_UNITS)
    .div(quote.tokensOut);
  const spotPriceLamports = quote.poolQuoteAmount
    .mul(TOKEN_UNITS)
    .div(quote.poolBaseAmount);
  const feeBpsOfInput = quote.feesLamports.muln(10_000).div(quote.solSpent);
```

Two prices and a fee ratio, all integer.

- **Effective price**: what you actually paid per whole token, `solSpent * 1e6 / tokensOut`. The `TOKEN_UNITS` multiply is the scale-before-divide move again: without it, a per-base-unit price rounds to zero on most tokens.
- **Spot price**: the pool's marginal price, `quoteReserve * 1e6 / baseReserve`. What the price would be for an infinitesimal trade.
- **Fee load**: `fees * 10000 / solSpent`, basis points of the input. Multiply by 10,000 first, divide last.

### 4. The cross-multiplication trick

```ts
  // effective/spot = (solSpent/tokensOut) / (poolQuote/poolBase); comparing
  // via cross-multiplication avoids the per-token prices rounding to zero
  // on micro-cap pools.
  const crossEffective = quote.solSpent.mul(quote.poolBaseAmount);
  const crossSpot = quote.poolQuoteAmount.mul(quote.tokensOut);
  const premiumOverSpotBps = crossEffective
    .sub(crossSpot)
    .muln(10_000)
    .div(crossSpot);
```

This is the most instructive piece of integer discipline in the example.

The premium is the ratio of two ratios: `(solSpent/tokensOut) / (poolQuote/poolBase)`. The obvious implementation divides `effectivePriceLamports` by `spotPriceLamports`. It works on the pool in the sample run below, where both prices are in the hundreds of lamports. It fails badly on a pool where the per-token price is under a lamport: both prices truncate toward zero, and a ratio of two truncated small integers is noise. If both round to 0, you get a division by zero on a pool that is perfectly healthy.

Cross-multiplication removes every intermediate division. `a/b > c/d` if and only if `a*d > c*b` for positive values, so comparing `solSpent * poolBase` against `poolQuote * tokensOut` gives the same answer with no precision lost. Both products are large, so the basis-point division at the end has plenty of significant digits to work with.

The principle generalizes: **when comparing two ratios in integer math, cross-multiply instead of dividing each one.** It is exact, it is cheap, and it does not care how small the underlying prices are.

The premium bundles two costs that a trader experiences differently: the fees the pool charges, and the price impact of moving along the curve. Subtract `feeBpsOfInput` from `premiumOverSpotBps` and what remains is roughly the impact of your own size.

### 5. Quoting

```ts
  const solAmount = new BN(100_000_000); // 0.1 SOL

  heading("Quote: ammQuoteBuy");
  const quote = await sdk.ammQuoteBuy({
    mint,
    user: wallet.publicKey,
    quoteAmountIn: solAmount,
  });
```

`ammQuoteBuy` resolves the canonical pool PDA, fetches the swap state, and runs the AMM's own `buyQuoteInput` math with zero slippage. It returns an `AmmBuyQuote`:

| Field | Meaning |
|-------|---------|
| `tokensOut` | Tokens received after all AMM fees, raw units |
| `solSpent` | Lamports in (echoes your input) |
| `feesLamports` | Protocol plus LP plus creator fees deducted |
| `poolBaseAmount` | Pool token reserve at quote time |
| `poolQuoteAmount` | Pool SOL reserve at quote time |

The pool reserves come back with the quote, which is what makes the spot-price comparison possible without a second fetch. The bonding curve fee model is not the same as the AMM's: the AMM adds an LP fee, since a pool has liquidity providers and a bonding curve does not.

### 6. Building instructions, and stopping

```ts
  heading("Instructions: ammBuyInstructions (not sent)");
  const ixs = await sdk.ammBuyInstructions({
    mint,
    user: wallet.publicKey,
    solAmount,
    slippageBps: 100, // 1%
  });
  row("Instruction count", ixs.length);
  for (const [i, ix] of ixs.entries()) {
    row(
      `  ix[${i}]`,
      `${ix.programId.toBase58()} keys=${ix.keys.length} data=${ix.data.length}B`,
    );
  }
```

`ammBuyInstructions` returns `TransactionInstruction[]`, never a `Transaction`. That is a deliberate SDK-wide contract: the caller composes, sets compute budget and priority fees, picks a blockhash, and signs. The SDK does not make those choices for you.

`slippageBps: 100` is 1%. The method also accepts the low-level `{ quoteAmountIn, minBaseAmountOut }` form when you have computed the floor yourself.

The instruction list is not a single swap. It includes wSOL account setup, the funding transfer, the sync, the destination ATA, the swap against the AMM program, and the cleanup close. Every one of those is required for a buy that works from a wallet holding only native SOL, and hand-rolling the set is where most integrations break. The same applies to the 2026-04-28 fee-recipient upgrade: every AMM buy must carry the correct trailing fee recipient plus its quote-mint ATA, and going through `OnlinePumpSdk` gets that right for you.

Nothing is signed and nothing is sent. The example prints what it built and stops, which is the rule for every example in this directory that constructs a spend.

## Run it

```bash
npm run example 41
```

Real output from one run of this repository against mainnet:

```
Finding a graduated token
-------------------------
Mint                         9XaEDAjicJYXgbudDKYEbUWgSvrSyN244Kz712eMpump
Buyer                        6RSPDY2tqkF2W7s8UKp3qWHszDuyNQp5ETxw4FURwLoS

Quote: ammQuoteBuy
------------------
SOL in                       0.1000 SOL
Tokens out                   136,443.15 tokens
Fees                         0.001185 SOL
Pool base reserve            144,809,091.31 tokens
Pool quote reserve           104.7741 SOL

Quote interpretation
--------------------
Spot price                   723 lamports/token
Effective price              732 lamports/token
Fee load                     118 bps of input
Premium over spot            129 bps (fees + price impact)

Instructions: ammBuyInstructions (not sent)
-------------------------------------------
Instruction count            6
  ix[0]                      ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL keys=6 data=1B
  ix[1]                      11111111111111111111111111111111 keys=2 data=12B
  ix[2]                      TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA keys=1 data=1B
  ix[3]                      ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL keys=6 data=1B
  ix[4]                      pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA keys=27 data=25B
  ix[5]                      TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA keys=3 data=1B
```

**Your run will show a different mint, a different buyer (the ephemeral keypair is new each time), and different pool numbers.** Discovery picks whatever is trading. What should hold in any run:

- **Effective price above spot, always.** 732 against 723 here. Buying moves the pool against you; a fill at or below spot would mean something is wrong with the quote.
- **Premium above fee load, always.** 129 bps versus 118 bps. The 11 bps gap is price impact from 0.1 SOL against a 104.77 SOL pool, which is a small trade in a deep pool. The same 0.1 SOL against a 1 SOL pool would show a premium many times the fee load.
- **Fee load around 118 bps.** Roughly 1.2% for protocol, LP, and creator fees combined, which is the AMM's schedule rather than the bonding curve's.
- **Six instructions for one buy.** ATA creation, a System transfer of 12 bytes of data (the wSOL funding), a token sync, the destination ATA, the 27-account swap against `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`, and a close. That 27-account list is the fee-recipient trailing accounts among others, and it is exactly the part you do not want to assemble by hand.
- **Sanity check the arithmetic yourself.** 0.1 SOL for 136,443.15 tokens is 100,000,000 / 136,443.15, about 733 lamports per token, which matches the reported effective price to truncation.

If discovery times out, the error names the fix: point `PUMP_RPC_URL` at an endpoint that supports `logsSubscribe`, or pass `GRADUATED_MINT=<address>` to skip the stream entirely.

## Going further

**Related documentation**

- [AMM Trading](../../docs/amm-trading.md): the full PumpSwap surface, including sells, deposits, and withdrawals.
- [PumpSwap protocol README](https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_SWAP_README.md): the canonical spec for pool state and swap instructions.
- [Breaking fee-recipient upgrade](https://github.com/pump-fun/pump-public-docs/blob/main/docs/BREAKING_FEE_RECIPIENT.md): the trailing accounts every AMM buy and sell must carry since 2026-04-28.
- [Tutorial 34: AMM Liquidity Operations](../34-amm-liquidity-operations.md): the liquidity-provider side of the same pools.
- [Tutorial 6: Token Migration to PumpAMM](../06-migration.md): how a token gets from a bonding curve to a pool.

**Related examples**

- [Example 13: Market Cap Along the Curve](./13-market-cap.md): the graduation edge this example picks up from.
- [Example 11: Buy Quotes, Fully Offline](./11-buy-quote-offline.md): the same quote-first discipline on the bonding curve, with no network.
- [Example 12: Sell Quotes and Fee Impact](./12-sell-quote-offline.md): decomposing a quote into gross, fee, and net.

**SDK surface used**

| Symbol | Role |
|--------|------|
| `OnlinePumpSdk.ammQuoteBuy` | Pre-trade quote with exact on-chain AMM math |
| `OnlinePumpSdk.ammBuyInstructions` | Swap instructions incl. wSOL wrapping and ATA creation |
| `AmmBuyQuote` | `tokensOut`, `solSpent`, `feesLamports`, both pool reserves |
| `canonicalPumpPoolPda` | Pool address derivation used by both methods |

**Things to try next**

1. Quote 0.01, 0.1, 1, and 10 SOL against the same pool and plot `premiumOverSpotBps`. Fee load stays flat; the impact term grows with size. That is the AMM's depth, measured.
2. Compare `ammQuoteBuy` against `ammQuoteSell` for the same notional and see the round-trip cost of entering and exiting immediately: roughly twice the fee load plus twice the impact.
3. Compose the printed instructions into a `VersionedTransaction`, simulate it with `connection.simulateTransaction`, and read the compute units consumed. Simulation exercises the whole path without spending anything.
