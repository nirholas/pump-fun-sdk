# AMM Trading Guide

> Buy, sell, deposit, and withdraw on graduated PumpAMM pools, with both low-level instruction builders and one-call online wrappers.

**Program:** PumpAMM (`pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`)

---

## Overview

When a token's bonding curve reaches 100% and graduates, it migrates to the PumpAMM, a constant-product AMM pool. The SDK provides full instruction builders for trading and liquidity management on these pools.

### Bonding Curve vs AMM

| Phase | Program | Price Model | Liquidity |
|-------|---------|-------------|-----------|
| Pre-graduation | Pump | Bonding curve (virtual reserves) | Single-sided (SOL only) |
| Post-graduation | PumpAMM | Constant product (x·y=k) | Two-sided (SOL + token) |

Check graduation status:

```typescript
const bondingCurve = await onlineSdk.fetchBondingCurve(mint);
if (bondingCurve.complete) {
  // Token has graduated: use AMM methods
}

// Or check whether the canonical pool account exists (works even if the
// bonding curve account is gone):
const graduated = await onlineSdk.isGraduated(mint);
```

---

## The easy path: online wrappers

`OnlinePumpSdk` fetches the pool state and computes slippage for you. For most applications these are the methods to use:

```typescript
import { OnlinePumpSdk } from "@nirholas/pump-sdk";
import BN from "bn.js";

const sdk = new OnlinePumpSdk(connection);

// Quote first (no instructions built)
const quote = await sdk.ammQuoteBuy({ mint, user, quoteAmountIn: new BN(100_000_000) });
console.log("tokens out:", quote.tokensOut.toString(), "fees:", quote.feesLamports.toString());

// Buy 0.1 SOL worth with 5% slippage
const buyIxs = await sdk.ammBuyInstructions({
  mint, user,
  solAmount: new BN(100_000_000),
  slippageBps: 500,
});

// Sell 1M raw token units with 5% slippage
const sellIxs = await sdk.ammSellInstructions({
  mint, user,
  tokenAmount: new BN(1_000_000),
  slippageBps: 500,
});
```

If you don't want to care whether a token has graduated at all, `routedBuyInstructions` / `routedSellInstructions` pick the bonding curve or the AMM automatically.

The rest of this page covers the low-level `PUMP_SDK` builders, which build a single instruction from explicit amounts.

> **2026-04-28 upgrade:** every AMM buy/sell instruction must end with one of 8 designated fee recipient accounts plus that recipient's WSOL ATA. All SDK builders append these automatically; only hand-rolled instructions need `buildAmmBreakingFeeRecipientAccounts()` / `patchAmmInstruction()`.

---

## Trading

### Buy (Specify Token Output)

Buy a specific amount of tokens, with a maximum SOL you're willing to spend.

```typescript
import { PUMP_SDK } from "@nirholas/pump-sdk";
import BN from "bn.js";

const ix = await PUMP_SDK.ammBuyInstruction({
  user: walletPublicKey,
  pool: poolAddress,           // Pool PDA for this token
  mint: tokenMint,
  baseAmountOut: new BN(1_000_000),    // Tokens to receive
  maxQuoteAmountIn: new BN(100_000),   // Max SOL (lamports) to spend
  cashback: false,                      // Optional: earn cashback
  protocolFeeRecipient,                 // From AmmGlobalConfig.protocolFeeRecipients
});
```

`protocolFeeRecipient` defaults to the system program for offline testing; pass a real recipient from `fetchAmmGlobalConfig()` for a transaction that will land.

### Buy (Specify SOL Input)

Spend an exact amount of SOL, with a minimum token output.

```typescript
const ix = await PUMP_SDK.ammBuyExactQuoteInInstruction({
  user: walletPublicKey,
  pool: poolAddress,
  mint: tokenMint,
  quoteAmountIn: new BN(100_000),       // Exact SOL (lamports) to spend
  minBaseAmountOut: new BN(900_000),    // Minimum tokens to receive
  cashback: false,
});
```

### Sell

Sell tokens for SOL with a minimum output guarantee.

```typescript
const ix = await PUMP_SDK.ammSellInstruction({
  user: walletPublicKey,
  pool: poolAddress,
  mint: tokenMint,
  baseAmountIn: new BN(1_000_000),      // Tokens to sell
  minQuoteAmountOut: new BN(90_000),    // Minimum SOL (lamports) to receive
  cashback: false,
  protocolFeeRecipient,                 // From AmmGlobalConfig.protocolFeeRecipients
});
```

### PumpSwap v2 trades

The October 2026 upgrade added `buy_v2`, `buy_exact_quote_in_v2` and `sell_v2`. Prices and fee rates match the v1 instructions above; the difference is where the fees go. The protocol and creator fees stay in the pool (`Pool.protocolFees` / `Pool.creatorFees`) until a permissionless sweep pays them out, and only the buyback slice leaves during the trade, into the quote ATA of one of the `AmmGlobalConfig.buybackFeeRecipients` wallets (picked at random when you do not pass one). That makes the account list a fixed 17 accounts with no protocol fee recipient, creator vault or remaining accounts.

```typescript
// Exact tokens out, fees included in the cap
const buy = await PUMP_SDK.ammBuyV2Instruction({
  user: walletPublicKey,
  pool: poolAddress,
  mint: tokenMint,
  baseAmountOut: new BN(1_000_000),
  maxQuoteAmountIn: new BN(110_000),
  quoteMint,            // optional, default WSOL; pass the pool's quote mint for pump-coin quoted pools
  quoteTokenProgram,    // optional, default TOKEN_PROGRAM_ID (TOKEN_2022_PROGRAM_ID for a pump-coin quote)
});

// Exact quote in
const exactIn = await PUMP_SDK.ammBuyExactQuoteInV2Instruction({
  user: walletPublicKey, pool: poolAddress, mint: tokenMint,
  spendableQuoteIn: new BN(100_000),
  minBaseAmountOut: new BN(900_000),
});

// Sell
const sell = await PUMP_SDK.ammSellV2Instruction({
  user: walletPublicKey, pool: poolAddress, mint: tokenMint,
  baseAmountIn: new BN(1_000_000),
  minQuoteAmountOut: new BN(90_000),
});
```

Rules to know:

- v2 trades work on every pool, mayhem pools included, except pools of cashback coins, which fail with pump-amm 6079 `CashbackCoinNotSupported`. Use the v1 builders for those.
- The buyback recipient's quote ATA is checked on every trade and never created. It already exists for WSOL; when the quote is a pump coin, put an idempotent ATA create for it in front of the trade.
- Creator fees from v2 trades only reach the creator vault after a sweep (see [Sweeping pool fees](#sweeping-pool-fees)).

Full program guide: [PUMP_SWAP_TRADE_V2.md](./pump-official/docs/instructions/PUMP_SWAP_TRADE_V2.md).

### Multi-hop swaps

`multi_hop_swap` routes an exact input through a chain of canonical pump pools and pump-coin quoted bonding curves in one instruction. Every hop trades the same way (`side: "buy"` walks up a quote chain, `side: "sell"` walks down), and the whole route refuses to finish below `minAmountOut`. The protocol fee is charged once, on the leg that trades the user's currency; the creator fee (and a pool's LP fee) once, on the leg that trades the coin at the far end. Middle hops are fee-free.

```typescript
import { PUMP_SDK, type MultiHopHop } from "@nirholas/pump-sdk";
import { NATIVE_MINT, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

// SOL -> Q on Q's pool, then Q -> X on X's Q-quoted bonding curve
const hops: MultiHopHop[] = [
  { venue: "pool", baseMint: q, quoteMint: NATIVE_MINT,
    baseTokenProgram: TOKEN_2022_PROGRAM_ID, quoteTokenProgram: TOKEN_PROGRAM_ID },
  { venue: "curve", baseMint: x, quoteMint: q,
    baseTokenProgram: TOKEN_2022_PROGRAM_ID, quoteTokenProgram: TOKEN_2022_PROGRAM_ID },
];

const ixs = await PUMP_SDK.multiHopSwapInstructions({
  user: walletPublicKey,
  hops,
  side: "buy",
  amountIn: new BN(100_000_000),   // 0.1 SOL
  minAmountOut,                    // X tokens, after your slippage
});
```

- **Chaining:** on a buy, each hop's `quoteMint` must be the previous hop's `baseMint`; on a sell, each hop's `baseMint` must be the previous hop's `quoteMint`. The SDK checks this before building and throws `MultiHopDiscontinuousPathError` (the program's 6084 `MultiHopDiscontinuousPath`).
- **Not allowed as hops:** mayhem pools (pump-amm 6080) and mayhem curves (pump 6108).
- **Accounts:** 16 fixed plus 5 per hop. Routes longer than three hops need a v0 transaction with an address lookup table.
- `multiHopSwapInstructions` also creates the output ATA, the buyback recipient ATA for the user's currency, and wraps and unwraps SOL when SOL is an end of the route. `multiHopSwapInstruction` builds only the swap.

Full program guide: [MULTI_HOP_SWAP.md](./pump-official/docs/instructions/MULTI_HOP_SWAP.md).

### Pools from a synthetic migration

A pool created by a synthetic migration (a pump-coin quoted curve that completed) carries a signed `Pool.virtualQuoteReserves` that the price adds to the quote vault balance. It turns negative once real quote outgrows the virtual offset, so read it as a signed `BN`. The online quote helpers include it; when you price a pool yourself, pass `poolQuoteTerms(pool)` (virtual quote reserves, quote mint, mayhem flag, creator fee rate) along with the reserves, or the pool is priced as a plain SOL pool. See [NEGATIVE_VIRTUAL_QUOTE_RESERVES.md](./pump-official/docs/NEGATIVE_VIRTUAL_QUOTE_RESERVES.md).

---

## Liquidity Provision

Pool accounts grew to `POOL_SIZE` (287 bytes) in the October 2026 upgrade. Trades grow a pool themselves; deposits and withdrawals do not, so on a pool nobody has traded since the upgrade put `PUMP_SDK.ammExtendAccountInstruction({ account: poolAddress, user: walletPublicKey })` in front of them.

### Deposit (Add Liquidity)

Provide both tokens and SOL to earn LP tokens.

```typescript
const ix = await PUMP_SDK.ammDepositInstruction({
  user: walletPublicKey,
  pool: poolAddress,
  mint: tokenMint,
  maxBaseAmountIn: new BN(1_000_000),    // Max tokens to deposit
  maxQuoteAmountIn: new BN(100_000),     // Max SOL to deposit
  minLpTokenAmountOut: new BN(50_000),   // Minimum LP tokens to receive
});
```

### Withdraw (Remove Liquidity)

Burn LP tokens to receive tokens and SOL back.

```typescript
const ix = await PUMP_SDK.ammWithdrawInstruction({
  user: walletPublicKey,
  pool: poolAddress,
  mint: tokenMint,
  lpTokenAmountIn: new BN(50_000),       // LP tokens to burn
  minBaseAmountOut: new BN(900_000),     // Minimum tokens to receive
  minQuoteAmountOut: new BN(80_000),     // Minimum SOL to receive
});
```

### Liquidity helpers (online)

The online SDK removes the guesswork from balanced deposits and withdrawals:

```typescript
// Given a token amount, compute the matching SOL and expected LP tokens
const depQuote = await sdk.ammDepositAutocompleteFromBase({ mint, user, base: baseAmount, slippage: 1 });

// Or start from a SOL amount
const depQuote2 = await sdk.ammDepositAutocompleteFromQuote({ mint, user, quote: quoteAmount, slippage: 1 });

// One-call deposit/withdraw with slippage handled
const depIxs = await sdk.depositByBaseAmount({ mint, user, baseAmount, slippage: 1 });
const wdIxs = await sdk.withdrawByLpAmount({ mint, user, lpAmount, slippage: 1 });

// LP balance
const lpBalance = await sdk.getLpTokenBalance(mint, user);
```

---

## Creator Fee Management

### Collect Creator Fees

Token creators collect accumulated trading fees from the AMM pool.

```typescript
const ix = await PUMP_SDK.ammCollectCoinCreatorFeeInstruction({
  creator: creatorWallet,
});
```

### Transfer Creator Fees to Pump

Move creator fees from the AMM pool back to the Pump program for distribution.

```typescript
const ix = await PUMP_SDK.ammTransferCreatorFeesToPumpInstruction({
  coinCreator: creatorWallet,
});
```

### Sweeping pool fees

v2 trades leave the protocol and creator fees in the pool. Two permissionless instructions pay them out, and nothing moves when a bucket is empty:

```typescript
// Pool.creatorFees -> the coin creator vault
const creatorSweep = await PUMP_SDK.ammSweepCreatorFeeInstruction({
  payer: walletPublicKey,
  mint: tokenMint,
  coinCreator: pool.coinCreator,
  quoteMint: pool.quoteMint,             // optional, default WSOL
});

// Pool.protocolFees -> a listed protocol fee recipient (pump.fun runs these itself)
const protocolSweep = await PUMP_SDK.ammSweepProtocolFeeInstruction({
  payer: walletPublicKey,
  mint: tokenMint,
  recipient: globalConfig.protocolFeeRecipients[0],
  quoteMint: pool.quoteMint,
});
```

Put the creator sweep first, in the same transaction, in front of `adminCtoInstruction`, `createFeeSharingConfig` (pump-amm 6081 `CreatorFeesNotSwept` while fees wait) and `updateFeeShares` (pump-fees 6033 `PoolCreatorFeesNotSwept`). In front of `ammCollectCoinCreatorFeeInstruction` or `ammTransferCreatorFeesToPumpInstruction` it makes the claim include the waiting fees. `onlineSdk.creatorFeeSweepInstructions(mint, payer)` returns exactly the sweeps a coin needs (curve and pool), or `[]`. Each sweep emits `SweepPoolFeeEvent` (`decodeSweepPoolFeeEvent`). See [SWEEP_FEES.md](./pump-official/docs/instructions/SWEEP_FEES.md).

### Set Coin Creator

Set the creator for an AMM pool based on bonding curve metadata.

```typescript
const ix = await PUMP_SDK.ammSetCoinCreatorInstruction({
  pool: poolAddress,
  mint: tokenMint,
});
```

### Migrate Pool Coin Creator

Update the pool's creator based on the fee sharing config.

```typescript
const ix = await PUMP_SDK.ammMigratePoolCoinCreatorInstruction({
  pool: poolAddress,
  mint: tokenMint,
});
```

---

## Volume Tracking

### Sync User Volume Accumulator

Sync a user's volume tracking data between the Pump and PumpAMM programs.

```typescript
const ix = await PUMP_SDK.ammSyncUserVolumeAccumulatorInstruction(userPublicKey);
```

### Claim AMM Cashback

Claim cashback earned from AMM trading volume.

```typescript
const ix = await PUMP_SDK.ammClaimCashbackInstruction({
  user: walletPublicKey,
});
```

---

## AMM Events

All AMM events can be decoded from transaction logs:

```typescript
const buyEvent = PUMP_SDK.decodeAmmBuyEvent(eventData);
const sellEvent = PUMP_SDK.decodeAmmSellEvent(eventData);
const depositEvent = PUMP_SDK.decodeDepositEvent(eventData);
const withdrawEvent = PUMP_SDK.decodeWithdrawEvent(eventData);
const createPoolEvent = PUMP_SDK.decodeCreatePoolEvent(eventData);
```

### AmmBuyEvent Fields

| Field | Type | Description |
|-------|------|-------------|
| `baseAmountOut` | `BN` | Tokens received |
| `quoteAmountIn` | `BN` | SOL spent (before fees) |
| `userQuoteAmountIn` | `BN` | SOL spent (after fees) |
| `lpFee` | `BN` | Fee to LP providers |
| `protocolFee` | `BN` | Fee to protocol |
| `coinCreatorFee` | `BN` | Fee to token creator |
| `cashback` | `BN` | Cashback earned |
| `pool` | `PublicKey` | Pool address |
| `user` | `PublicKey` | Buyer address |

### AmmSellEvent Fields

| Field | Type | Description |
|-------|------|-------------|
| `baseAmountIn` | `BN` | Tokens sold |
| `quoteAmountOut` | `BN` | SOL received (before fees) |
| `userQuoteAmountOut` | `BN` | SOL received (after fees) |
| `lpFee` | `BN` | Fee to LP providers |
| `protocolFee` | `BN` | Fee to protocol |
| `coinCreatorFee` | `BN` | Fee to token creator |
| `cashback` | `BN` | Cashback earned |

---

## Finding Pool Addresses

Use the `OnlinePumpSdk` to look up pool addresses:

```typescript
import { OnlinePumpSdk } from "@nirholas/pump-sdk";

const onlineSdk = new OnlinePumpSdk(connection);
const pool = await onlineSdk.fetchPool(mint);
```

Or derive the canonical pool PDA offline:

```typescript
import { canonicalPumpPoolPda } from "@nirholas/pump-sdk";

const poolAddress = canonicalPumpPoolPda(mint);
```

For many tokens at once, `fetchMultiplePools(mints)` batches the lookups into a single RPC call and returns a `Map<mintBase58, Pool | null>` (`null` = not graduated).

---

## Slippage Protection

All AMM methods include slippage parameters:

- **Buy:** `maxQuoteAmountIn` caps the SOL spent
- **Buy exact:** `minBaseAmountOut` guarantees minimum tokens
- **Sell:** `minQuoteAmountOut` guarantees minimum SOL
- **Deposit:** `minLpTokenAmountOut` guarantees minimum LP tokens
- **Withdraw:** `minBaseAmountOut` + `minQuoteAmountOut` guarantee minimums

Set these based on your slippage tolerance. For a 1% slippage:

```typescript
const slippageBps = 100; // 1%
const minOutput = expectedOutput.mul(new BN(10000 - slippageBps)).div(new BN(10000));
```

The online wrappers (`ammBuyInstructions`, `ammSellInstructions`) accept `slippageBps` directly and compute the min/max bounds from a live pool quote.

---

## Runnable examples

AMM & Advanced examples 41-50 cover pool inspection, AMM quotes, buys, sells, and liquidity operations. Run them with `npm run example 41` and up.

## Related

- [Bonding Curve Math](./bonding-curve-math.md): pre-graduation pricing
- [Fee Tiers](./fee-tiers.md): fee structure across tiers
- [Cashback](./cashback.md): cashback system
- [Events Reference](./events-reference.md): complete event catalog
- [Tutorial 34](../tutorials/34-amm-liquidity-operations.md): step-by-step AMM liquidity guide
