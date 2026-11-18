# Example 02: Create and Buy in One Transaction

> Launch a token and make the creator's first buy atomically, with the dev-buy size known from pure math before a lamport is spent.

## What you'll build

A four-instruction bundle that creates a token and buys into it in the same transaction:

1. `createV2` launches the token.
2. `extendAccount` resizes the bonding curve account to the current layout.
3. `createAssociatedTokenAccountIdempotent` gives the buyer somewhere to receive tokens.
4. `buy` executes the dev buy.

Because all four land or none of them do, there is no window between "the token exists" and "the creator holds some of it" for anyone else to buy into. That is the whole reason this bundle exists.

You will also quote the dev buy before building anything. A brand-new bonding curve has completely known reserves, so the number of tokens 0.5 SOL buys is arithmetic, not a guess.

The example lives in [`../../examples/02-create-and-buy.ts`](../../examples/02-create-and-buy.ts).

## Prerequisites

- Node.js 18 or newer, with `npm install` already run in this repository.
- Network access. Unlike [example 01](./01-create-token.md), this one reads live `Global` and `FeeConfig` accounts from mainnet so the quote reflects the real launch parameters and fee tiers in effect today.

Optional configuration:

```bash
export PUMP_RPC_URL=https://your-endpoint   # default: public mainnet RPC
export PUMP_WALLET=/path/to/keypair.json    # default: ephemeral keypair
```

The public RPC is rate limited but sufficient here: the example makes two account reads.

No funds are required. Nothing is signed and nothing is sent.

## Walkthrough

### Step 1: Quote the dev buy on a curve that does not exist yet

```ts
export function quoteDevBuy({
  global,
  feeConfig,
  creator,
  solAmount,
  mayhemMode = false,
  cashback = false,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  creator: PublicKey;
  solAmount: BN;
  mayhemMode?: boolean;
  cashback?: boolean;
}): BN {
  const bondingCurve = {
    ...newBondingCurve(global),
    creator,
    isMayhemMode: mayhemMode,
    isCashbackCoin: cashback,
  };
  return getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: global.tokenTotalSupply,
    bondingCurve,
    amount: solAmount,
  });
}
```

The trick is `newBondingCurve(global)`. Every Pump token launches with identical reserves, and those reserves are stored in the `Global` account: `initialVirtualSolReserves`, `initialVirtualTokenReserves`, `initialRealTokenReserves`, `tokenTotalSupply`. `newBondingCurve` reads them and hands back the exact curve state your token will have the instant it exists.

So the quote is not an approximation of the dev buy. It is the same computation the on-chain program will run, on the same inputs, and it will produce the same result as long as your transaction is the first one to touch the curve. In a create-and-buy bundle it always is.

Three details are worth pausing on.

**`creator` is spread onto the simulated curve.** Creator fees are charged on the dev buy just like any other trade, and the quote has to know who the creator is to compute them. Omitting this would overstate your token allocation.

**`solAmount` is a `BN`, and so is the return value.** Every amount in this SDK is a `BN` from bn.js, never a JavaScript `number`. SOL is in lamports (1 SOL = 1,000,000,000 lamports) and Pump tokens are in 6-decimal base units (1 token = 1,000,000 units). Both exceed what a float represents exactly, and financial math on a float silently loses the low bits. `new BN(500_000_000)` for half a SOL, never `0.5`.

**`feeConfig` may be `null`.** When it is, the SDK falls back to the flat fee rates in `Global` instead of the tiered fee program schedule. Passing the live config, as this example does, gets you the tier that actually applies at your token's market cap.

### Step 2: Build the bundle

```ts
export async function buildCreateAndBuyInstructions({
  global,
  mint,
  name,
  symbol,
  uri,
  creator,
  user,
  solAmount,
  devBuyTokens,
  mayhemMode = false,
  cashback = false,
}: {
  global: Global;
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  creator: PublicKey;
  user: PublicKey;
  solAmount: BN;
  devBuyTokens: BN;
  mayhemMode?: boolean;
  cashback?: boolean;
}): Promise<TransactionInstruction[]> {
  return await PUMP_SDK.createV2AndBuyInstructions({
    global,
    mint,
    name,
    symbol,
    uri,
    creator,
    user,
    amount: devBuyTokens,
    solAmount,
    mayhemMode,
    cashback,
  });
}
```

`createV2AndBuyInstructions` takes both sides of the trade: `solAmount` is what you are spending, `amount` is the token quantity you expect for it. The pair is what gives the on-chain program something to check. If the curve is not where you thought it was, the buy fails rather than filling at an unexpected price.

Note that this builder needs `global` passed in. It is a method on the offline `PUMP_SDK` singleton, so it does no fetching of its own. The caller owns the network step, which is exactly what makes this function testable with fixtures.

### Step 3: Fetch live state and quote

```ts
export async function main(): Promise<void> {
  const online = new OnlinePumpSdk(getConnection());
  const wallet = loadWallet();
  const mint = Keypair.generate();
  const devBuySol = new BN(500_000_000); // 0.5 SOL
```

`OnlinePumpSdk` is the online half of the SDK. It wraps a `Connection`, fetches and decodes on-chain accounts, and delegates all instruction building to `PumpSdk` internally. You never need both objects; construct the online one and it gives you the offline surface too.

```ts
  const [global, feeConfig] = await Promise.all([
    online.fetchGlobal(),
    online.fetchFeeConfig(),
  ]);

  heading("Dev-buy quote (offline math, live global state)");
  const devBuyTokens = quoteDevBuy({
    global,
    feeConfig,
    creator: wallet.publicKey,
    solAmount: devBuySol,
  });
  row("Initial virtual SOL", formatSol(global.initialVirtualSolReserves));
  row("Initial virtual tokens", formatTokens(global.initialVirtualTokenReserves));
  row("Tokens received", formatTokens(devBuyTokens));
```

Two accounts, fetched in parallel, and that is the entire network footprint of this example. Everything after this line is arithmetic.

The two reserve numbers printed here are the constant-product invariant's starting point: 30 SOL of virtual reserves against 1,073,000,000 virtual tokens. Neither is real liquidity. They are the offset that gives the curve its opening price and makes the first buy cost something rather than being free. [`../05-bonding-curve-math.md`](../05-bonding-curve-math.md) derives the whole formula.

`formatSol` and `formatTokens` come from [`../../examples/_lib/format.ts`](../../examples/_lib/format.ts). They divide the `BN` down for display only; the underlying value never leaves integer arithmetic.

### Step 4: Build and inspect the four instructions

```ts
  const ixs = await buildCreateAndBuyInstructions({
    global,
    mint: mint.publicKey,
    name: "Example Coin",
    symbol: "XMPL",
    uri: "https://example.com/metadata.json",
    creator: wallet.publicKey,
    user: wallet.publicKey,
    solAmount: devBuySol,
    devBuyTokens,
  });

  heading("Instruction bundle");
  const labels = [
    "createV2 (launch the token)",
    "extendAccount (resize curve account)",
    "createAssociatedTokenAccount (buyer ATA)",
    "buy (the dev buy)",
  ];
  ixs.forEach((ix, i) => {
    row(`${i + 1}. ${labels[i] ?? "instruction"}`, "");
    row("   Program", ix.programId.toBase58());
    row("   Accounts / data bytes", `${ix.keys.length} / ${ix.data.length}`);
  });
  row("Pump program instructions", ixs.filter((ix) => ix.programId.equals(PUMP_PROGRAM_ID)).length);
```

Three of the four instructions belong to the Pump program. The odd one out is the associated token account creation, which belongs to the SPL Associated Token Account program (`ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`).

Why each instruction is there:

- **`extendAccount`** exists because the bonding curve account layout grew over the protocol's life. `BONDING_CURVE_NEW_SIZE` is 151 bytes; accounts created under an older layout are smaller and must be resized before the current program can write them. On a fresh launch this is cheap insurance, and the SDK includes it so you never have to reason about which layout a curve is on.
- **`createAssociatedTokenAccountIdempotent`** is idempotent by design: if the account already exists the instruction succeeds and does nothing. That makes it safe to include unconditionally, which is simpler and cheaper than reading the account first to find out.
- **`buy`** carries 18 accounts. That count is larger than a naive buy would need because of the 2026-04-28 fee recipient upgrade: every bonding curve trade now carries a mutable trailing fee recipient account. The SDK picks one for you. Hand-rolling a buy instruction without it produces a transaction the program rejects. See [`https://github.com/pump-fun/pump-public-docs/blob/main/docs/BREAKING_FEE_RECIPIENT.md`](https://github.com/pump-fun/pump-public-docs/blob/main/docs/BREAKING_FEE_RECIPIENT.md).

### Step 5: Stop before sending

```ts
  heading("Next step (not performed here)");
  console.log(
    "Put all four instructions in ONE transaction, sign with the wallet AND",
  );
  console.log(
    "the mint keypair, then send. Atomicity means nobody can buy before you.",
  );
```

The emphasis on ONE transaction is the entire security property. Split across two transactions, a bot watching the mempool sees your create land and buys into the fresh curve at the lowest price on it, ahead of your own buy. In one transaction the sequence is atomic and there is no gap to exploit.

The same two signers as example 01 apply: the payer wallet and the mint keypair.

## Run it

```bash
npm run example 02
```

Real output from a run of this example:

```
Launch parameters
-----------------
Name                         Example Coin
Symbol                       XMPL
Mint (new keypair)           Gj6ZQz6XtdWmHE9mzzqBjP2eGQb6gbcVfDnZAAFvM8W5
Creator / buyer              8agt7WYF35egM5snaL9oBEj8XgiFx4pYcy2GzsyGE6ka
Dev buy                      0.5000 SOL

Dev-buy quote (offline math, live global state)
-----------------------------------------------
Initial virtual SOL          30.0000 SOL
Initial virtual tokens       1,073,000,000.00 tokens
Tokens received              17,376,518.16 tokens

Instruction bundle
------------------
1. createV2 (launch the token) 
   Program                   6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
   Accounts / data bytes     16 / 103
2. extendAccount (resize curve account) 
   Program                   6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
   Accounts / data bytes     5 / 8
3. createAssociatedTokenAccount (buyer ATA) 
   Program                   ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL
   Accounts / data bytes     6 / 1
4. buy (the dev buy)         
   Program                   6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
   Accounts / data bytes     18 / 25
Pump program instructions    3

Next step (not performed here)
------------------------------
Put all four instructions in ONE transaction, sign with the wallet AND
the mint keypair, then send. Atomicity means nobody can buy before you.
```

Reading the numbers: 0.5 SOL bought about 17.38 million tokens out of a 1 billion supply, roughly 1.7% of the token, for half a SOL. That ratio is a property of the opening curve, not of this particular run. The mint and wallet addresses differ every run; the quote will only move if the protocol changes its launch parameters or fee tiers.

## Going further

**Related examples**

- [`01-create-token.md`](./01-create-token.md) is the launch instruction on its own, fully offline.
- [`03-buy-tokens.md`](./03-buy-tokens.md) buys into a curve that already exists, where reserves have to be fetched instead of derived.
- [`05-buy-by-sol-amount.md`](./05-buy-by-sol-amount.md) shows the one-call online equivalent, `buyBySolAmount`.

**Related long-form tutorials**

- [`../04-create-and-buy.md`](../04-create-and-buy.md) covers the same bundle with transaction assembly and sending.
- [`../05-bonding-curve-math.md`](../05-bonding-curve-math.md) derives the pricing formula behind `getBuyTokenAmountFromSolAmount`.
- [`../09-fee-system.md`](../09-fee-system.md) explains protocol, creator, and tiered fees.

**Reference documentation**

- [`https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_PROGRAM_README.md`](https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_PROGRAM_README.md) is the canonical protocol specification for create, buy, and sell.
- [`https://github.com/pump-fun/pump-public-docs/blob/main/docs/BREAKING_FEE_RECIPIENT.md`](https://github.com/pump-fun/pump-public-docs/blob/main/docs/BREAKING_FEE_RECIPIENT.md) explains the trailing fee recipient accounts.
- [`../../docs/api-reference.md`](../../docs/api-reference.md) for full method signatures.

**SDK methods used here**

| Symbol | What it does |
|---|---|
| `PUMP_SDK.createV2AndBuyInstructions` | Builds the four-instruction create-and-buy bundle |
| `newBondingCurve(global)` | Derives the curve state a token launches with |
| `getBuyTokenAmountFromSolAmount` | Quotes tokens out for a SOL budget, fees included |
| `OnlinePumpSdk.fetchGlobal` | Reads the protocol `Global` account |
| `OnlinePumpSdk.fetchFeeConfig` | Reads the tiered fee program config |

**Offline tests**

The exported functions are covered by [`../../examples/__tests__/02-08-lifecycle.test.ts`](../../examples/__tests__/02-08-lifecycle.test.ts), which asserts among other things that the mint appears as a signer somewhere in the bundle.
