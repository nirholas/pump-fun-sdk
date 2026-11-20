# Example 04: Sell Tokens

> Quote the SOL a token amount returns after fees, then build slippage-protected sell instructions from explicit bonding curve state.

## What you'll build

The sell side of the canonical bonding curve flow, structured the same way as [example 03](./03-buy-tokens.md): a network step that reads state, and a pure compute step that quotes the trade and builds instructions.

Selling has one wrinkle buying does not. The on-chain sell instruction has a representable-amount limit, and the SDK checks your amount against it before building anything, so an unrepresentable sell is rejected in your process rather than aborting on-chain after your tokens already moved. This example prints that bound and explains exactly what it does and does not protect you from.

The example lives in [`../../examples/04-sell-tokens.ts`](../../examples/04-sell-tokens.ts).

## Prerequisites

- Node.js 18 or newer, with `npm install` already run.
- Network access with WebSocket support, for the token discovery helper.

Optional configuration:

```bash
export PUMP_RPC_URL=https://your-endpoint    # default: public mainnet RPC
export MINT=<mint address>                   # skip discovery, use this token
export PUMP_WALLET=/path/to/keypair.json     # default: ephemeral keypair
```

You do not need to hold the token. The example builds a sell for a wallet that may hold nothing and prints it; it never signs or sends.

## Walkthrough

### Step 1: Quote the proceeds

```ts
export function quoteSellSol({
  global,
  feeConfig,
  bondingCurve,
  amount,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  bondingCurve: BondingCurve;
  amount: BN;
}): BN {
  return getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    amount,
  });
}
```

Sell direction: tokens in, SOL out. The returned lamport amount is net, with the protocol fee and the creator fee already deducted, so it is what arrives in the seller's wallet.

`amount` is token base units as a `BN` (6 decimals, so 100 tokens is `new BN(100_000_000)`), and the result is lamports as a `BN`. Both sides stay integer. A sell quote for a large position runs well past the range where a JavaScript number is exact, which is why `BN` is not optional here.

One consequence of integer math shows up in the sample output below: a genuinely tiny sell can quote zero. The fee is rounded up with a ceiling division, so for dust amounts the fee can meet or exceed the gross proceeds, and the SDK clamps the net to zero rather than returning a negative. That is correct behavior, not a bug, and it is worth handling explicitly in a real exit path.

### Step 2: Build the sell instructions

```ts
export async function buildSellInstructions({
  global,
  bondingCurveAccountInfo,
  bondingCurve,
  mint,
  user,
  amount,
  solAmount,
  slippage,
  tokenProgram = TOKEN_PROGRAM_ID,
  cashback = false,
}: {
  global: Global;
  bondingCurveAccountInfo: AccountInfo<Buffer>;
  bondingCurve: BondingCurve;
  mint: PublicKey;
  user: PublicKey;
  amount: BN;
  solAmount: BN;
  slippage: number;
  tokenProgram?: PublicKey;
  cashback?: boolean;
}): Promise<TransactionInstruction[]> {
  return await PUMP_SDK.sellInstructions({
    global,
    bondingCurveAccountInfo,
    bondingCurve,
    mint,
    user,
    amount,
    solAmount,
    slippage,
    tokenProgram,
    cashback,
  });
}
```

Compared to `buyInstructions`, one parameter is gone and one is new.

Gone: `associatedUserAccountInfo`. A seller must already hold the token, so the token account necessarily exists and there is nothing to create.

New: `cashback`, an opt-in that routes the trade through the cashback volume accumulator. It defaults to `false`. See [`../27-cashback-social-fees.md`](../27-cashback-social-fees.md).

`sellInstructions` does three things before it returns:

1. Validates the amount against `maxSafeSellAmount` for the curve's current reserves, throwing `SellOverflowError` if it does not fit.
2. Prepends `extendAccount` when the raw curve account is on an older, smaller layout.
3. Applies `slippage` as a **minimum acceptable SOL out**: the quoted amount minus `slippage` percent.

That third point is the mirror of the buy case. On a buy, slippage bounds what you pay. On a sell, it floors what you receive.

### Step 3: Fetch state, with the same tradability gate as example 03

```ts
  const curveInfo = await connection.getAccountInfo(bondingCurvePda(mint));
  const decoded = curveInfo ? PUMP_SDK.decodeBondingCurveNullable(curveInfo) : null;

  let bondingCurve: BondingCurve;
  let bondingCurveAccountInfo: AccountInfo<Buffer>;

  if (curveInfo && decoded && !decoded.complete && !decoded.virtualTokenReserves.isZero()) {
    heading("Live bonding curve state");
    bondingCurve = decoded;
    bondingCurveAccountInfo = curveInfo;
```

Same three conditions as the buy example: the account exists, it decodes as a bonding curve, and it has not graduated. A `complete` curve cannot be sold on at all; the token lives in a PumpAMM pool at that point and needs the AMM sell path instead.

```ts
    try {
      // fetchSellState additionally requires the seller's token account to
      // exist (you cannot sell tokens you do not hold).
      const state = await online.fetchSellState(mint, wallet.publicKey);
      bondingCurveAccountInfo = state.bondingCurveAccountInfo;
      row("Seller token account", "exists");
    } catch {
      row("Seller token account", "missing (this wallet holds none; building anyway)");
    }
```

`fetchSellState` throws when the seller has no associated token account, which is the right behavior for production code: a sell from a wallet with no position is a caller bug worth surfacing loudly.

The example catches it because the whole point is to demonstrate instruction building without requiring you to hold a random token discovered thirty seconds ago. The instruction it builds is byte-identical to the one a real holder would build; it simply would not execute successfully.

The fallback branch, for a mint with no active curve, is the same `newBondingCurve(global)` plus synthetic account info used in example 03. Real launch-state reserves, real code path, no mocks.

### Step 4: Bound the amount before quoting

```ts
  const maxSafe = maxSafeSellAmount(bondingCurve.virtualSolReserves);
  const amount = BN.min(new BN(100_000_000), maxSafe); // up to 100 tokens
  const slippage = 1; // percent
```

`maxSafeSellAmount` is the largest token amount a single sell instruction can carry against these reserves. Its definition, from [`../../src/bondingCurve.ts`](../../src/bondingCurve.ts):

```
min( u64::MAX,  floor(0.9 * u128::MAX / virtualSolReserves) )
```

Two bounds, and the smaller wins.

The **u64 bound** is the on-chain width of a token amount field. Nothing wider than `u64::MAX` can be expressed as a sell amount at all.

The **u128 bound** comes from the intermediate product `amount * virtualSolReserves` inside the sell formula. The deployed program widens that multiply to u128, so the product only overflows past `u128::MAX`; the `0.9` factor leaves a ten percent margin so reserve drift between your quote and your landing slot cannot push a previously safe amount over the line.

At mainnet reserve sizes the u128 bound sits many orders of magnitude above `u64::MAX`, so in practice the u64 width is what binds, and the printed limit is `u64::MAX` in token base units. That is about 18.4 quadrillion tokens, roughly 18 million times a Pump token's entire 1 billion supply.

**Which means ordinary sells never approach this limit.** An earlier version of the SDK derived the bound from `u64::MAX` instead, and it rejected the great majority of real sells: sampling live mainnet trade events, 344 of 417 landed sells (83 percent) exceeded that old limit, some by more than two thousand times. Do not carry the old mental model forward. A normal position, however large in human terms, does not need chunking for arithmetic reasons.

`BN.min` here is defensive rather than necessary: 100 tokens is nowhere near the bound. It is the pattern worth copying, because it is exactly what a general exit routine should do with an amount it did not choose itself.

### Step 5: Quote, floor, and report

```ts
  heading("Quote");
  const solOut = quoteSellSol({ global, feeConfig, bondingCurve, amount });
  row("Sell", formatTokens(amount));
  row("SOL received (after fees)", formatSol(solOut));
  row("Max safe single-tx sell", formatTokens(maxSafe));

  heading("Slippage");
  const minSolOut = solOut.sub(solOut.muln(slippage * 100).divn(10_000));
  console.log(`slippage: ${slippage} sets the floor: the sell aborts rather than`);
  console.log(`return less than ${formatSol(minSolOut)} for these tokens.`);
```

`minSolOut` is written out here for the same reason `maxSpend` was in example 03: it is the arithmetic the SDK performs internally, made visible. Percent scaled to basis points, applied with integer `BN` operations, rounding against you.

### Step 6: Build and inspect

```ts
  const ixs = await buildSellInstructions({
    global,
    bondingCurveAccountInfo,
    bondingCurve,
    mint,
    user: wallet.publicKey,
    amount,
    solAmount: solOut,
    slippage,
  });

  heading("Sell instructions");
  row("Instruction count", ixs.length);
  ixs.forEach((ix, i) => {
    const kind = ix.programId.equals(PUMP_PROGRAM_ID) ? "pump" : "other";
    row(`${i + 1}. ${kind}`, `${ix.keys.length} accounts, ${ix.data.length} data bytes`);
  });
```

One instruction on a current-layout curve: the sell itself, with 16 accounts. That is two fewer than a buy, because a sell needs no associated token account creation and no rent payer path.

### On intermittent AnchorError 6024

This deserves its own note, because it is the single most misdiagnosed failure in Pump trading.

If your sells land most of the time and fail occasionally at sizes that usually work, **that is slippage, not arithmetic width**. A width limit is a pure function of `(amount, reserves)`: it would fail every single time at that size, deterministically. Intermittency rules it out. What actually happened is that other trades moved the curve between your quote and your landing slot, the sell could no longer produce your `minSolOutput`, and the program aborted. Your tokens moved earlier in that same transaction, so the abort rolls them back, but you still paid the fee.

Chunking does not fix it. What fixes it: quote as close to send time as possible, give yourself more slippage headroom, and add priority fee so your transaction lands in a nearer slot.

`SellOverflowError`, by contrast, is thrown in your process before anything is built, and it is rare and deterministic. See [`../../docs/errors.md`](../../docs/errors.md) and [`../../docs/TROUBLESHOOTING.md`](../../docs/TROUBLESHOOTING.md).

## Run it

```bash
npm run example 04
```

Real output from a run of this example:

```
Setup
-----
Mint                         8axwjJuK87f2vbHR4fqFh9FaamaQYSMGkobLJfEhpump
Wallet                       Hq5rQvGPpksavVvpfw4EHETQcKC9T86MTVEyMR1ddzXx

Live bonding curve state
------------------------
Virtual SOL reserves         62.0919 SOL
Virtual token reserves       518,424,969.39 tokens
Seller token account         missing (this wallet holds none; building anyway)

Quote
-----
Sell                         100.00 tokens
SOL received (after fees)    0.0000 SOL
Max safe single-tx sell      18,446,744,073,709.55 tokens

Slippage
--------
slippage: 1 sets the floor: the sell aborts rather than
return less than 0.0000 SOL for these tokens.

Sell instructions
-----------------
Instruction count            1
1. pump                      16 accounts, 24 data bytes

Next step (not performed here)
------------------------------
Compose, sign, send. This example never broadcasts a transaction.
```

Three things to read out of this.

**`SOL received: 0.0000 SOL`** is the dust case from step 1, not a failure. One hundred tokens out of a 518-million-token curve is worth a few hundred lamports gross, the ceiling-rounded fee eats it, and the net clamps to zero. `formatSol` shows four decimals, so anything under 0.00005 SOL renders as zero anyway.

**`Max safe single-tx sell: 18,446,744,073,709.55 tokens`** is `u64::MAX` divided by the token's 1e6 base unit scale. With 62 SOL of virtual reserves, the u128 product bound works out around 4.9e21 tokens, so the u64 width is the smaller of the two and wins. This is the expected reading for any realistic curve.

**`Seller token account: missing`** is the expected path for an ephemeral wallet. Set `PUMP_WALLET` to a wallet that holds the discovered mint and this line reads `exists` instead.

Your run will select a different mint and different reserves. The instruction count and account count are stable for a current-layout curve.

## Going further

**Related examples**

- [`06-sell-by-percentage.md`](./06-sell-by-percentage.md) turns "sell half" into a token amount.
- [`07-sell-all.md`](./07-sell-all.md) exits the whole position and closes the token account.
- [`08-sell-to-target-sol.md`](./08-sell-to-target-sol.md) solves for the tokens needed to raise a target amount of SOL.
- [`03-buy-tokens.md`](./03-buy-tokens.md) is the buy-side mirror of this flow.

**Related long-form tutorials**

- [`../03-sell-tokens.md`](../03-sell-tokens.md) covers signing and sending the sell.
- [`../33-error-handling-patterns.md`](../33-error-handling-patterns.md) covers the typed error surface.
- [`../05-bonding-curve-math.md`](../05-bonding-curve-math.md) derives the sell formula.

**Reference documentation**

- [`../../docs/errors.md`](../../docs/errors.md) for `SellOverflowError` and the AnchorError table.
- [`../../docs/TROUBLESHOOTING.md`](../../docs/TROUBLESHOOTING.md) for the intermittent 6024 diagnosis.
- [`https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_PROGRAM_README.md`](https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_PROGRAM_README.md) for the on-chain sell specification.

**SDK methods used here**

| Symbol | What it does |
|---|---|
| `PUMP_SDK.sellInstructions` | Builds sell instructions, with the amount pre-flight |
| `getSellSolAmountFromTokenAmount` | Quotes net SOL out for a token amount |
| `maxSafeSellAmount(virtualSolReserves)` | Largest amount one sell instruction can carry |
| `validateSellAmount(amount, curve)` | Throws `SellOverflowError` when the amount is unrepresentable |
| `OnlinePumpSdk.fetchSellState` | Fetches curve state and asserts the seller's token account exists |

**Offline tests**

The exported functions are covered by [`../../examples/__tests__/02-08-lifecycle.test.ts`](../../examples/__tests__/02-08-lifecycle.test.ts).
