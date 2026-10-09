# API Reference

> Complete reference for the public classes, functions, types, and constants exported by `@nirholas/pump-sdk`, grouped by module.

The SDK surface is defined by `src/index.ts`. Two classes do the heavy lifting: `PumpSdk` (offline instruction building and account/event decoding) and `OnlinePumpSdk` (RPC fetching plus high-level trading conveniences). Around them sit pure-function modules: bonding curve math, fees, PDAs, analytics, token incentives, vanity mint generation, and RPC fallback.

---

## Constants

### Program IDs

| Constant | Value | Description |
|----------|-------|-------------|
| `PUMP_PROGRAM_ID` | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Main Pump program |
| `PUMP_AMM_PROGRAM_ID` | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | AMM program for graduated tokens |
| `PUMP_FEE_PROGRAM_ID` | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing program |
| `MAYHEM_PROGRAM_ID` | `MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e` | Mayhem mode program |

### Other Constants

| Constant | Type | Value | Description |
|----------|------|-------|-------------|
| `PUMP_SDK` | `PumpSdk` | | Pre-built offline SDK singleton |
| `BONDING_CURVE_NEW_SIZE` | `number` | `166` | Byte size of a bonding curve account since the October 2026 upgrade (alias of `BONDING_CURVE_SIZE`) |
| `BONDING_CURVE_SIZE` / `BONDING_CURVE_INITIALIZE_SIZE` | `number` | `166` / `49` | Current and original bonding curve sizes. Older curves are grown by the program on their first new-style trade, and the decoder reads any length from 49 up |
| `GLOBAL_SIZE` | `number` | `1088` | Pump `Global` size (adds `maxCurveDepth`) |
| `FEE_CONFIG_INITIALIZE_SIZE` / `FEE_CONFIG_POST_STABLE_SIZE` / `FEE_CONFIG_CURRENT_SIZE` | `number` | `2512` / `4073` / `4097` | The three PumpFees `FeeConfig` layouts the decoder accepts |
| `POOL_SIZE` | `number` | `287` | PumpSwap `Pool` size (adds `protocolFees` / `creatorFees`) |
| `AMM_GLOBAL_CONFIG_SIZE` | `number` | `949` | PumpSwap `GlobalConfig` size |
| `PUMP_TOKEN_MINT` | `PublicKey` | `pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn` | PUMP token mint (token incentive rewards) |
| `MAX_SHAREHOLDERS` | `number` | `10` | Maximum number of fee sharing shareholders |
| `CANONICAL_POOL_INDEX` | `number` | `0` | Default AMM pool index |
| `ONE_BILLION_SUPPLY` | `BN` | `1_000_000_000_000_000` | 1B token supply at 6 decimals, used in fee math |
| `INITIAL_REAL_TOKEN_RESERVES` | `BN` | `793_100_000_000_000` | Standard initial real token reserves of a curve |
| `BREAKING_FEE_RECIPIENTS` | `PublicKey[]` | 8 addresses | Fee recipients required by the 2026-04-28 upgrade |
| `BREAKING_FEE_RECIPIENT_WSOL_ATAS` | `ReadonlyMap<string, PublicKey>` | | Pre-computed WSOL ATA per breaking fee recipient |
| `BASE58_ALPHABET` | `string` | 58 chars | Valid characters for vanity patterns |
| `MAX_VANITY_PATTERN_LENGTH` | `number` | `6` | Hard cap for `generateVanityMint` patterns |

### Pre-computed PDAs

| Constant | Description |
|----------|-------------|
| `GLOBAL_PDA` | Pump global config account |
| `AMM_GLOBAL_PDA` | *Deprecated* alias. Derived from the `global_config` seed, so it equals `AMM_GLOBAL_CONFIG_PDA` (it used a seed with no account behind it before 3.0.0) |
| `AMM_GLOBAL_CONFIG_PDA` | AMM global config account |
| `AMM_FEE_CONFIG_PDA` | AMM fee config account (PumpFees) |
| `PUMP_FEE_CONFIG_PDA` | Pump fee configuration account |
| `GLOBAL_VOLUME_ACCUMULATOR_PDA` | Pump volume tracker |
| `AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA` | AMM volume tracker |
| `PUMP_EVENT_AUTHORITY_PDA` | Pump event authority |
| `PUMP_AMM_EVENT_AUTHORITY_PDA` | AMM event authority |
| `PUMP_FEE_EVENT_AUTHORITY_PDA` | Fee event authority |
| `QUOTE_CONTROL_PDA` | Pump `QuoteControl` account (seed `quote-control`): the quote mints admitted beyond `Global.whitelistedQuoteMints` |

---

## Classes

### `PumpSdk`

Offline instruction builder and decoder. Does not require a Solana connection. Use the pre-built `PUMP_SDK` singleton instead of constructing your own instance.

#### Account Decoders

These methods decode raw `AccountInfo<Buffer>` data into typed objects.

| Method | Returns |
|--------|---------|
| `decodeGlobal(accountInfo)` | `Global` |
| `decodeFeeConfig(accountInfo)` | `FeeConfig` |
| `decodeBondingCurve(accountInfo)` | `BondingCurve` |
| `decodeBondingCurveNullable(accountInfo)` | `BondingCurve \| null` |
| `decodeGlobalVolumeAccumulator(accountInfo)` | `GlobalVolumeAccumulator` |
| `decodeUserVolumeAccumulator(accountInfo)` | `UserVolumeAccumulator` |
| `decodeUserVolumeAccumulatorNullable(accountInfo)` | `UserVolumeAccumulator \| null` |
| `decodeSharingConfig(accountInfo)` | `SharingConfig` |
| `decodePool(accountInfo)` | `Pool` |
| `decodeAmmGlobalConfig(accountInfo)` | `AmmGlobalConfig` |
| `decodeFeeProgramGlobal(accountInfo)` | `FeeProgramGlobal` |
| `decodeSocialFeePdaAccount(accountInfo)` | `SocialFeePda` |
| `decodeQuoteControl(accountInfo)` | `QuoteControl` |
| `decodeQuoteControlNullable(accountInfo)` | `QuoteControl \| null` |

#### Event Decoders

Decode Anchor CPI event data from transaction logs. Every event type in the [Types](#types) section has a matching `decode<EventName>(data: Buffer)` method, e.g. `decodeTradeEvent`, `decodeCreateEvent`, `decodeCompleteEvent`, `decodeAmmBuyEvent`, `decodeAmmSellEvent`, `decodeCreateFeeSharingConfigEvent`, `decodeSocialFeePdaClaimedEvent`, and so on across all three programs. The October 2026 upgrade added `decodePostCompleteBuyEvent` (a v3 buy that crossed the end of the curve), `decodeSweepBondingCurveFeeEvent` (pump `sweep_*_fee`) and `decodeSweepPoolFeeEvent` (pump-amm `sweep_*_fee`). Every event decoder accepts layouts longer than the one it knows, so a future field appended by pump does not break it. For decoding every event in a confirmed transaction in one call, use `OnlinePumpSdk.parseTransactionEvents(signature)` instead.

#### Token Creation

##### `createV2Instruction(params)`

Creates a new token on the bonding curve (Token-2022 mint).

```typescript
const ix = await PUMP_SDK.createV2Instruction({
  mint,                   // PublicKey - mint keypair public key (mint must sign the tx)
  name: "My Token",
  symbol: "MTK",
  uri: "https://example.com/metadata.json",
  creator,                // PublicKey - creator wallet
  user,                   // PublicKey - fee payer
  mayhemMode: false,      // boolean - enable mayhem mode
  creatorFeeBps,          // BN, optional - custom-pair creator fee
  holderReward: true,     // boolean, optional - distribute fees to holders
  quoteMint,              // PublicKey, optional - omit (or WSOL) for a SOL curve
  quoteTokenProgram,      // PublicKey, optional - token program that owns quoteMint
  pumpQuote,              // PumpQuoteAccounts, optional - when quoteMint is a pump coin
});
```

A non-SOL `quoteMint` appends the quote remaining accounts (`createV2QuoteRemainingAccounts`). The mint must be whitelisted on `Global`, listed in `QuoteControl`, or be a pump coin passed with `pumpQuote` (6063 `UnsupportedQuoteMint` otherwise). A pump-coin quote seeds the new curve from the quote coin's live price, stores `depth = quote.depth + 1` (at most `Global.maxCurveDepth`, 6105 `CurveDepthExceeded`) and cannot be mayhem mode. `OnlinePumpSdk.fetchPumpQuote(quoteMint)` resolves `pumpQuote` and the curve the math needs; `OnlinePumpSdk.createV2Instruction({ quoteMint })` does all of it for you.

New cashback launches are rejected. Existing cashback coins remain tradeable
and their accrued cashback remains claimable.

##### `createV2AndBuyInstructions(params)`

Creates a token and immediately buys in a single transaction. For a SOL curve it returns `[create_v2, create user ATA, buy]`. For a token quote it returns `create_v2`, the user's ATA, the buyback recipients' quote ATAs and a `buy_v3` (on a token quote `solAmount` is the amount of the quote token to spend). No `extend_account` is prepended: a new curve is created at full size.

```typescript
const ixs = await PUMP_SDK.createV2AndBuyInstructions({
  global,                 // Global - from fetchGlobal()
  mint, name, symbol, uri, creator, user,
  amount,                 // BN - token amount to buy
  solAmount,              // BN - SOL to spend (lamports)
  mayhemMode: false,
  holderReward: true,     // routes the first buy to the holder PDA vault
  quoteMint,              // optional, as in createV2Instruction
  quoteTokenProgram,      // optional
  pumpQuote,              // optional
});
```

##### `adminCtoInstruction(params)`

Builds the unified community-takeover instruction for a new creator, a custom
pair creator-fee change, or a permanent conversion to holder rewards.

##### `distributeFeeToHoldersInstruction(params)`

Builds a Pump.fun-authority-signed payout. Each recipient is paired with its
quote-token account automatically; SOL payouts mark the wallet writable.

##### `createInstruction(params)` *(deprecated)*

Legacy v1 creation (classic SPL token mint). Use `createV2Instruction` instead.

##### `createAndBuyInstructions(params)` *(deprecated)*

Legacy v1 create-and-buy. Use `createV2AndBuyInstructions` instead.

#### Buy / Sell

##### `buyInstructions(params)`

Builds instructions to buy tokens from a bonding curve, with an ATA-creation instruction first when `associatedUserAccountInfo` is `null`. Since 3.0.0 no `extend_account` is prepended: the program grows a pre-upgrade curve account on its first new-style trade. `bondingCurveAccountInfo` is still accepted for API compatibility. This is the v1 `buy`, which pays the protocol and creator fees out in the trade; see [v3 Curve Trades](#v3-curve-trades) for the instructions that leave them on the curve for a sweep.

```typescript
const ixs = await PUMP_SDK.buyInstructions({
  global,                     // Global
  bondingCurveAccountInfo,    // AccountInfo<Buffer>
  bondingCurve,               // BondingCurve
  associatedUserAccountInfo,  // AccountInfo<Buffer> | null
  mint,                       // PublicKey
  user,                       // PublicKey
  amount,                     // BN - token amount to receive
  solAmount,                  // BN - SOL to spend (lamports)
  slippage: 1,                // number - percent (1 = 1%)
  tokenProgram: TOKEN_PROGRAM_ID, // PublicKey - use the tokenProgram from fetchBuyState()
});
```

##### `sellInstructions(params)`

Builds instructions to sell tokens back to the bonding curve (no `extend_account` is prepended, as for `buyInstructions`). Runs `validateSellAmount` first and throws `SellOverflowError` if the amount would overflow the on-chain u64 math.

```typescript
const ixs = await PUMP_SDK.sellInstructions({
  global,
  bondingCurveAccountInfo,
  bondingCurve,
  mint,
  user,
  amount,                     // BN - token amount to sell
  solAmount,                  // BN - expected SOL out (lamports); slippage is applied below this
  slippage: 1,                // number - percent
  tokenProgram: TOKEN_PROGRAM_ID,
  cashback: false,            // optional
});
```

##### `buyExactSolInInstruction(params)`

Buy by specifying the exact SOL input rather than a token target.

```typescript
const ix = await PUMP_SDK.buyExactSolInInstruction({
  user, mint, creator,
  feeRecipient,           // PublicKey - use getFeeRecipient(global, mayhemMode)
  solAmount,              // BN - exact SOL to spend (lamports)
  minTokenAmount,         // BN - minimum tokens to receive (slippage floor)
  tokenProgram,           // optional, default TOKEN_PROGRAM_ID
});
```

##### `getBuyInstructionRaw(params)` / `getSellInstructionRaw(params)`

Low-level variants that build a single instruction without ATA management or account extension. Both append the mandatory breaking fee recipient trailing account.

#### v3 Curve Trades

`buy_v3`, `buy_exact_quote_in_v3` and `sell_v3` price exactly like `buy` / `sell`, but only the buyback slice of the protocol fee leaves in the trade. The rest of the protocol fee and the creator fee stay on the curve (`BondingCurve.protocolFees` / `creatorFee`) until a [fee sweep](#fee-sweeps) pays them out. They work for SOL and token-quoted curves (`bondingCurve.quoteMint`) and refuse cashback coins (`CashbackCoinNotSupportedError`, program error 6094). The full guide is `docs/pump-official/docs/instructions/TRADE_V3.md`.

A v3 buy past the remaining supply completes the curve and buys the rest from the pool the migration will create (a synthetic migration): `CompleteEvent` is followed by `PostCompleteBuyEvent`. Quote it with `getBuyV3QuoteAmountFromTokenAmount`, which needs the curve's base token balance (`fetchBuyState` returns it as `curveBaseTokenBalance`).

##### `buyV3Instructions(params)`

```typescript
const state = await sdk.fetchBuyState(mint, user);
const feeConfig = await sdk.fetchFeeConfig();
const global = await sdk.fetchGlobal();
const mintSupply = state.bondingCurve.tokenTotalSupply;

const quoteAmount = getBuyV3QuoteAmountFromTokenAmount({
  global, feeConfig, mintSupply,
  bondingCurve: state.bondingCurve,
  amount,                                   // BN - tokens to buy
  curveBaseTokenBalance: state.curveBaseTokenBalance,
});

const ixs = await PUMP_SDK.buyV3Instructions({
  bondingCurve: state.bondingCurve,
  associatedUserAccountInfo: state.associatedUserAccountInfo,
  mint, user, amount, quoteAmount,
  slippage: 1,                              // percent
  tokenProgram: state.tokenProgram,
  quoteTokenProgram: state.quoteTokenProgram,
  partialFill: false,                       // optional; only matters on a mayhem curve
  buybackFeeRecipient,                      // optional; a listed Global.buybackFeeRecipients wallet
});
```

On a token quote it also creates (idempotently) the buyback recipient's quote ATA, which the program never creates.

##### `buyExactQuoteInV3Instructions(params)`

Spends at most `quoteAmount` (fees included) and requires at least `amount` tokens less `slippage` percent, `amount` being the quote from `getBuyV3TokenAmountFromQuoteAmount`. Same parameters as `buyV3Instructions`.

##### `sellV3Instructions(params)`

Sells `amount` tokens for at least `quoteAmount` less `slippage` percent. On a token quote it first creates, when missing, the seller's quote ATA and the buyback recipient's.

```typescript
const ixs = await PUMP_SDK.sellV3Instructions({
  bondingCurve, mint, user,
  amount,                 // BN - tokens to sell
  quoteAmount,            // BN - expected quote out, net of fees
  slippage: 1,
  tokenProgram, quoteTokenProgram,
});
```

##### Raw v3 builders

`getBuyV3InstructionRaw({ user, mint, amount, quoteAmount, ... })`, `getBuyExactQuoteInV3InstructionRaw({ user, mint, spendableQuoteIn, minTokensOut, ... })` and `getSellV3InstructionRaw({ user, mint, amount, quoteAmount, ... })` build the single instruction with exact limits and no ATA handling. All take optional `tokenProgram`, `quoteMint` (`bondingCurve.quoteMint` can be passed as is; the zero key is SOL), `quoteTokenProgram` and `buybackFeeRecipient`; the buys also take `partialFill`. `tradeV3Accounts(params)` returns the named accounts they share.

#### Migration

##### `migrateInstruction(params)`

Migrates a graduated token from the bonding curve to its canonical AMM pool.

```typescript
const ix = await PUMP_SDK.migrateInstruction({
  withdrawAuthority,      // PublicKey - global.withdrawAuthority
  mint,
  user,
  tokenProgram: TOKEN_PROGRAM_ID,
});
```

#### Account Management

##### `extendAccountInstruction(params)`

Extends a bonding curve account to the current size (`BONDING_CURVE_NEW_SIZE`). Trades no longer need it, because the program grows an older curve on its first new-style trade. It remains available for tooling that wants an account at full size without trading. For PumpSwap, `ammExtendAccountInstruction` is still required before `deposit` / `withdraw` on a pool that has not been grown since the upgrade (see [AMM Trading](./amm-trading.md)).

```typescript
const ix = await PUMP_SDK.extendAccountInstruction({ account, user });
```

##### `setCreator(params)`

Sets the creator for a token mint (requires the set-creator authority).

```typescript
const ix = await PUMP_SDK.setCreator({ mint, setCreatorAuthority, creator });
```

#### Volume Accumulators

```typescript
const initIx = await PUMP_SDK.initUserVolumeAccumulator({ payer, user });
const syncIx = await PUMP_SDK.syncUserVolumeAccumulator(user);
const closeIx = await PUMP_SDK.closeUserVolumeAccumulator(user);
```

#### Creator Fees & Incentives

```typescript
// Collect bonding-curve creator fees for a creator wallet
const collectIx = await PUMP_SDK.collectCreatorFeeInstruction({ creator });

// Claim volume-based PUMP incentives
const claimIx = await PUMP_SDK.claimTokenIncentivesInstruction({
  user, payer,
  mint,          // optional, default PUMP_TOKEN_MINT
  tokenProgram,  // optional, default TOKEN_2022_PROGRAM_ID
});
```

#### Fee Sweeps

v3 curve trades and PumpSwap v2 trades leave the protocol and creator fees in the curve or pool. Four permissionless instructions pay them out; nothing moves when a bucket is empty. Each emits `SweepBondingCurveFeeEvent` or `SweepPoolFeeEvent`. Full guide: `docs/pump-official/docs/instructions/SWEEP_FEES.md`.

```typescript
// Pump curve: protocol fees to a Global fee recipient for the curve
await PUMP_SDK.sweepProtocolFeeInstruction({
  payer, mint,
  recipient: getFeeRecipient(global, bondingCurve.isMayhemMode),
  quoteMint: bondingCurve.quoteMint,      // the zero key is SOL
  quoteTokenProgram,                      // optional
});

// Pump curve: creator fees into creatorVaultPda(bondingCurve.creator)
await PUMP_SDK.sweepCreatorFeeInstruction({
  payer, mint, creator: bondingCurve.creator, quoteMint: bondingCurve.quoteMint,
});

// PumpSwap canonical pool: protocol fees to a listed GlobalConfig.protocolFeeRecipients wallet
await PUMP_SDK.ammSweepProtocolFeeInstruction({ payer, mint, recipient, quoteMint, quoteTokenProgram });

// PumpSwap canonical pool: creator fees into the coin creator vault of pool.coinCreator
await PUMP_SDK.ammSweepCreatorFeeInstruction({ payer, mint, coinCreator: pool.coinCreator, quoteMint });
```

A creator fee is only in the creator vault after a sweep, so put the creator sweep first, in the same transaction, in front of a claim (`collectCreatorFeeInstruction`, `ammCollectCoinCreatorFeeInstruction`) to include those fees. A nonzero creator bucket blocks the flows that change or pay out the creator until it is swept: `distributeCreatorFees`, `adminCtoInstruction`, `createFeeSharingConfig` and `updateFeeShares` fail with pump 6095 `CreatorFeesNotSwept`, pump-amm 6081 `CreatorFeesNotSwept` or pump-fees 6033 `PoolCreatorFeesNotSwept`. pump.fun runs the protocol sweeps itself, so integrators normally only call the creator sweeps. `OnlinePumpSdk.creatorFeeSweepInstructions(mint, payer)` returns exactly the sweeps a coin needs (or `[]`).

#### Fee Sharing

##### `createFeeSharingConfig(params)`

Creates a fee sharing configuration for a token.

```typescript
const ix = await PUMP_SDK.createFeeSharingConfig({
  creator,                // PublicKey - pays for and owns the config
  mint,
  pool: null,             // PublicKey | null - null on the bonding curve,
                          // canonicalPumpPoolPda(mint) after graduation
});
```

##### `updateFeeShares(params)`

Updates the shareholder distribution. Validates before building: at most `MAX_SHAREHOLDERS` (10) shareholders, shares summing to exactly 10,000 bps, no duplicates, no zero shares. Throws the typed errors listed in [Error Classes](#error-classes).

```typescript
const ix = await PUMP_SDK.updateFeeShares({
  authority,               // PublicKey - the config admin
  mint,
  currentShareholders,     // PublicKey[] - addresses currently on the config ([] on first setup)
  newShareholders,         // Shareholder[] - { address, shareBps }
});
```

##### `distributeCreatorFees(params)`

Distributes accumulated fees to shareholders.

```typescript
const ix = await PUMP_SDK.distributeCreatorFees({
  mint,
  sharingConfig,           // SharingConfig - decoded config account
  sharingConfigAddress,    // PublicKey - feeSharingConfigPda(mint)
});
```

Put `sweepCreatorFeeInstruction` (and, for a graduated coin, `ammSweepCreatorFeeInstruction`) in front of it when v3 or v2 trades left creator fees behind. `OnlinePumpSdk.buildDistributeCreatorFeesInstructions(mint, payer)` does that for you.

##### `getMinimumDistributableFee(params)`

Builds the simulation instruction that reports the minimum distributable fee. Prefer the `OnlinePumpSdk` method of the same name, which runs the simulation and returns the decoded result.

#### Fee Sharing Authority

```typescript
// Transfer admin control to a new address
const ix1 = await PUMP_SDK.transferFeeSharingAuthorityInstruction({ authority, mint, newAdmin });

// Permanently revoke authority (irreversible; adminRevoked becomes true)
const ix2 = await PUMP_SDK.revokeFeeSharingAuthorityInstruction({ authority, mint });
```

#### Social Fee PDAs

Platform-based fee routing keyed by `userId` + `Platform`. Only `Platform.GitHub` is currently in `SUPPORTED_SOCIAL_PLATFORMS`; other values throw.

```typescript
import { Platform } from "@nirholas/pump-sdk";

const createIx = await PUMP_SDK.createSocialFeePdaInstruction({
  payer,
  userId: "583231",          // numeric GitHub user id as a string
  platform: Platform.GitHub,
});

const claimIx = await PUMP_SDK.claimSocialFeePdaInstruction({
  recipient,
  socialClaimAuthority,
  userId: "583231",
  platform: Platform.GitHub,
});
```

Higher-level wrappers that resolve social handles inside a shareholder list and create any missing PDAs:

```typescript
const ixs = await PUMP_SDK.createSharingConfigWithSocialRecipients({ ... });
const ixs2 = await PUMP_SDK.updateSharingConfigWithSocialRecipients({
  authority, mint, currentShareholders,
  newShareholders: [
    { address: wallet, shareBps: 7000 },
    { userId: "583231", platform: Platform.GitHub, shareBps: 3000 },
  ],
});
```

#### Cashback

```typescript
const ix = await PUMP_SDK.claimCashbackInstruction({ user });      // Pump program
const ammIx = await PUMP_SDK.ammClaimCashbackInstruction({ user }); // PumpAMM program
```

#### AMM Instructions

Single-instruction builders for graduated PumpAMM pools. The `OnlinePumpSdk` AMM wrappers below are usually more convenient because they fetch the pool state and compute slippage for you.

##### `ammBuyInstruction(params)`

```typescript
const ix = await PUMP_SDK.ammBuyInstruction({
  user, pool, mint,
  baseAmountOut,           // BN - tokens to receive
  maxQuoteAmountIn,        // BN - max SOL to spend
  cashback: false,         // optional
  protocolFeeRecipient,    // optional PublicKey - from AmmGlobalConfig; required for a real trade
});
```

##### `ammBuyExactQuoteInInstruction(params)`

```typescript
const ix = await PUMP_SDK.ammBuyExactQuoteInInstruction({
  user, pool, mint,
  quoteAmountIn,           // BN - exact SOL to spend
  minBaseAmountOut,        // BN - min tokens to receive
  cashback: false,         // optional
});
```

##### `ammSellInstruction(params)`

```typescript
const ix = await PUMP_SDK.ammSellInstruction({
  user, pool, mint,
  baseAmountIn,            // BN - tokens to sell
  minQuoteAmountOut,       // BN - min SOL to receive
  cashback: false,         // optional
  protocolFeeRecipient,    // optional PublicKey
});
```

##### `ammDepositInstruction(params)` / `ammWithdrawInstruction(params)`

```typescript
const dep = await PUMP_SDK.ammDepositInstruction({
  user, pool, mint,
  maxBaseAmountIn, maxQuoteAmountIn, minLpTokenAmountOut,  // all BN
});

const wd = await PUMP_SDK.ammWithdrawInstruction({
  user, pool, mint,
  lpTokenAmountIn, minBaseAmountOut, minQuoteAmountOut,    // all BN
});
```

Deposits and withdrawals on a pool that has not been grown to `POOL_SIZE` since the October 2026 upgrade need `ammExtendAccountInstruction({ account: pool, user })` in front of them; trades grow the pool themselves.

##### PumpSwap v2 trades

`buy_v2`, `buy_exact_quote_in_v2` and `sell_v2` use the same prices and fee rates as the v1 instructions, but the protocol and creator fees stay in the pool (`Pool.protocolFees` / `creatorFees`) until `ammSweepProtocolFeeInstruction` / `ammSweepCreatorFeeInstruction` pay them out. Only the buyback slice leaves in the trade, into the quote ATA of a listed `GlobalConfig.buybackFeeRecipients` wallet (random by default). They take 17 fixed accounts (`ammTradeV2Accounts`) and no protocol fee recipient, creator vault or remaining accounts. They work on every pool, mayhem pools included, except cashback coin pools (pump-amm 6079 `CashbackCoinNotSupported`); use the v1 builders for those. The buyback recipient ATA is checked on every trade and never created, so add an idempotent ATA create in front when the quote is a pump coin.

```typescript
const buy = await PUMP_SDK.ammBuyV2Instruction({
  user, pool, mint,
  baseAmountOut,           // BN - exact tokens out
  maxQuoteAmountIn,        // BN - fees included
  quoteMint,               // optional, default WSOL
  baseTokenProgram,        // optional, default TOKEN_2022_PROGRAM_ID
  quoteTokenProgram,       // optional, default TOKEN_PROGRAM_ID
  buybackFeeRecipient,     // optional
});

const exactIn = await PUMP_SDK.ammBuyExactQuoteInV2Instruction({
  user, pool, mint, spendableQuoteIn, minBaseAmountOut,
});

const sell = await PUMP_SDK.ammSellV2Instruction({
  user, pool, mint, baseAmountIn, minQuoteAmountOut,
});
```

Pools a synthetic migration created carry a signed `Pool.virtualQuoteReserves` that the PumpSwap price adds to the quote vault balance (negative once real quote outgrows the virtual offset). The quote helpers take it through `poolQuoteTerms(pool)`; see `docs/pump-official/docs/NEGATIVE_VIRTUAL_QUOTE_RESERVES.md`.

##### `multiHopSwapInstruction(params)` / `multiHopSwapInstructions(params)`

PumpSwap `multi_hop_swap` routes an exact input through a chain of canonical pump pools and token-quoted pump curves, all buys or all sells, and refuses less than `minAmountOut` at the end. The protocol fee is charged once, at the leg trading the user's currency; the creator fee (and a pool's LP fee) once, at the leg trading the coin at the far end; middle hops charge nothing. Mayhem pools (6080) and mayhem curves (6108) cannot be hops. 16 fixed accounts plus 5 per hop, so routes longer than three hops need a v0 transaction with a lookup table.

```typescript
const hops: MultiHopHop[] = [
  // SOL -> Q on Q's canonical pool
  { venue: "pool", baseMint: q, quoteMint: NATIVE_MINT,
    baseTokenProgram: TOKEN_2022_PROGRAM_ID, quoteTokenProgram: TOKEN_PROGRAM_ID },
  // Q -> X on X's Q-quoted bonding curve
  { venue: "curve", baseMint: x, quoteMint: q,
    baseTokenProgram: TOKEN_2022_PROGRAM_ID, quoteTokenProgram: TOKEN_2022_PROGRAM_ID },
];

const ixs = await PUMP_SDK.multiHopSwapInstructions({
  user, hops, side: "buy",
  amountIn: new BN(100_000_000),   // lamports of SOL in
  minAmountOut,                    // BN - X tokens, after your slippage
});
```

`multiHopSwapInstructions` also creates the user's output account (and the WSOL account when SOL is an end), the buyback recipient's ATA for the user's currency, wraps SOL first and closes the WSOL account afterwards. `multiHopSwapInstruction` builds only the swap and expects those accounts to exist. Hops that do not chain throw `MultiHopDiscontinuousPathError` before anything is sent. `multiHopRouteEnds(hops, side)` and `multiHopHopAccounts(hop)` expose the route checks and per-hop accounts. Full guide: `docs/pump-official/docs/instructions/MULTI_HOP_SWAP.md`.

##### AMM creator & volume management

```typescript
await PUMP_SDK.ammCollectCoinCreatorFeeInstruction({ creator });
await PUMP_SDK.ammTransferCreatorFeesToPumpInstruction({ coinCreator });
await PUMP_SDK.ammSetCoinCreatorInstruction({ pool, mint });
await PUMP_SDK.ammMigratePoolCoinCreatorInstruction({ pool, mint });
await PUMP_SDK.ammSyncUserVolumeAccumulatorInstruction(user);
await PUMP_SDK.ammInitUserVolumeAccumulatorInstruction({ payer, user });
await PUMP_SDK.ammCloseUserVolumeAccumulatorInstruction(user);
await PUMP_SDK.ammClaimTokenIncentivesInstruction({ user, payer });
```

#### Admin Instructions

Restricted to program authorities; exposed for completeness. Pump program: `adminSetCreatorInstruction` (throws: the program retired it, use `adminCtoInstruction`), `setMaxCurveDepthInstruction({ authority, maxCurveDepth })` (how deep a pump-coin quote chain may go; 0 disables pump-coin quotes), the `QuoteControl` set (`initializeQuoteControlInstruction({ user })`, `setQuoteControlAdminInstruction({ authority, newAdmin })`, `addQuoteControlMintInstruction({ authority, quoteMint, initialVirtualQuoteReserves })`, `removeQuoteControlMintInstruction({ authority, quoteMint })`, `setQuoteControlMintReservesInstruction({ authority, quoteMint, initialVirtualQuoteReserves })`, `setQuoteControlReservesAdminInstruction({ authority, newReservesAdmin })`), `adminUpdateTokenIncentivesInstruction`, `adminSetIdlAuthorityInstruction`, `setMayhemVirtualParamsInstruction`, `toggleMayhemModeInstruction`, `toggleCashbackEnabledInstruction`, `toggleCreateV2Instruction`, `updateGlobalAuthorityInstruction`, `setReservedFeeRecipientsInstruction`, `setParamsInstruction`, `migrateBondingCurveCreatorInstruction`, `setMetaplexCreatorInstruction`. PumpAMM: `ammCreateConfigInstruction`, `ammUpdateAdminInstruction`, `ammUpdateFeeConfigInstruction`, `ammDisableInstruction`, `ammAdminUpdateTokenIncentivesInstruction`, `ammToggleCashbackEnabledInstruction`, `ammToggleMayhemModeInstruction`, `ammExtendAccountInstruction`, `ammSetReservedFeeRecipientsInstruction`. PumpFees: `setClaimRateLimitInstruction`, `setSocialClaimAuthorityInstruction`, `upsertFeeTiersInstruction`, `initializeFeeConfigInstruction`, `initializeFeeProgramGlobalInstruction`, `setFeeAuthorityInstruction`, `setFeeDisableFlagsInstruction`, `feesUpdateAdminInstruction`, `feesUpdateFeeConfigInstruction`. See `docs/admin-operations.md`.

Removed in 3.0.0 because the programs no longer declare the instructions: `ammAdminSetCoinCreatorInstruction` (pump-amm `admin_set_coin_creator`), `resetFeeSharingConfigInstruction` (pump-fees `reset_fee_sharing_config`) and `OnlinePumpSdk.adminSetCoinCreatorInstructions`. Use `adminCtoInstruction` for a creator change.

---

### `OnlinePumpSdk`

RPC-backed SDK. Fetches and decodes on-chain state, and wraps `PUMP_SDK` with high-level trading conveniences.

```typescript
const sdk = new OnlinePumpSdk(connection);

// Or with automatic RPC failover across multiple endpoints:
const sdk2 = OnlinePumpSdk.withFallback([
  "https://my-primary-rpc.com",
  "https://api.mainnet-beta.solana.com",
]);
```

#### State Fetchers

| Method | Returns | Description |
|--------|---------|-------------|
| `fetchGlobal()` | `Global` | Global configuration |
| `fetchFeeConfig()` | `FeeConfig` | Fee tier configuration |
| `fetchBondingCurve(mint)` | `BondingCurve` | Bonding curve state for a token |
| `fetchBuyState(mint, user, tokenProgram?)` | `{ bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo, tokenProgram, quoteMint, quoteTokenProgram, curveBaseTokenBalance }` | Everything a buy needs; auto-detects the token program from the mint owner. `associatedUserAccountInfo` is `null` when the user has no ATA yet. `curveBaseTokenBalance` prices a v3 buy that crosses the end of the curve |
| `fetchSellState(mint, user, tokenProgram?)` | `{ bondingCurveAccountInfo, bondingCurve, tokenProgram, quoteMint, quoteTokenProgram }` | Everything a sell needs; throws if the user has no token account |
| `fetchQuoteControl()` | `QuoteControl \| null` | The quote mints admitted beyond `Global.whitelistedQuoteMints`; `null` while uninitialized |
| `fetchQuoteTokenProgram(quoteMint)` | `PublicKey` | Token program that owns a quote mint (SOL resolves without an RPC call) |
| `fetchPumpQuote(quoteMint, { global? })` | `{ curve: PumpQuoteCurve, accounts: PumpQuoteAccounts } \| null` | A pump coin as a `create_v2` quote: its curve, `QuoteControl` and, once migrated, its pool reserves. `null` when the mint has no pump curve. Throws `QuotePoolNotFoundError` for a migrated coin with no pool |
| `fetchMultipleBondingCurves(mints)` | `Map<string, BondingCurve \| null>` | Batch fetch in one RPC call, keyed by mint base58 |
| `fetchGlobalVolumeAccumulator()` | `GlobalVolumeAccumulator` | Global volume tracking data |
| `fetchUserVolumeAccumulator(user)` | `UserVolumeAccumulator \| null` | User's volume data (null if not initialized) |
| `fetchUserVolumeAccumulatorTotalStats(user)` | `UserVolumeAccumulatorTotalStats` | Combined Pump + AMM volume stats |
| `getTokenBalance(mint, user, tokenProgram?)` | `BN` | Raw token balance, `BN(0)` if no account |
| `isGraduated(mint)` | `boolean` | Whether the canonical AMM pool account exists |

#### Trading Conveniences

These combine fetch + math + instruction building in one call.

| Method | Description |
|--------|-------------|
| `buyInstructions({...})` | Like `PUMP_SDK.buyInstructions` but fetches `Global` for you |
| `sellInstructions({...})` | Like `PUMP_SDK.sellInstructions` but fetches `Global` for you |
| `buyBySolAmount({ mint, user, solAmount, slippage })` | Computes the token output from the SOL budget, then builds buy instructions |
| `quoteBuy({ mint, user, solAmount })` | Full pre-trade buy quote: `BuyQuote` with tokens out, fees, price impact |
| `quoteSell({ mint, user, amount, tokenProgram? })` | Full pre-trade sell quote: `SellQuote` incl. `maxSafeAmount` and `willOverflow` |
| `sellByPercentage({ mint, user, percent, slippage, ... })` | Sell N% (0-100) of the current balance |
| `sellToTargetSol({ mint, user, targetSol, slippage, ... })` | Binary-search the token amount that nets ~`targetSol` lamports |
| `sellAllInstructions({ mint, user, slippage?, tokenProgram? })` | Sell the entire balance and close the ATA to reclaim rent |
| `sellChunked({ mint, user, totalAmount, slippage, sendTx, ... })` | Split an oversized sell into safe chunks; sends each via your `sendTx` callback and returns all signatures |
| `routedBuyInstructions({ mint, user, quoteAmountIn, slippage })` | Routes automatically: bonding curve if live, AMM pool if graduated |
| `routedSellInstructions({ mint, user, baseAmountIn, slippage, ... })` | Same auto-routing for sells |

Example:

```typescript
const quote = await sdk.quoteBuy({ mint, user, solAmount: new BN(1_000_000_000) });
console.log(quote.tokensOut.toString(), quote.priceImpactBps, quote.feesLamports.toString());

const ixs = await sdk.buyBySolAmount({ mint, user, solAmount: new BN(1_000_000_000), slippage: 1 });
```

#### Creator Fees

| Method | Returns | Description |
|--------|---------|-------------|
| `collectCoinCreatorFeeInstructions(creator, feePayer?)` | `TransactionInstruction[]` | Collect from both programs |
| `creatorFeeSweepInstructions(mint, payer)` | `TransactionInstruction[]` | The pump and pump-amm `sweep_creator_fee` instructions a coin needs before a distribution, CTO or fee-sharing change (`[]` when both buckets are empty) |
| `getCreatorVaultBalance(creator)` | `BN` | Balance in the Pump vault only |
| `getCreatorVaultBalanceBothPrograms(creator)` | `BN` | Combined Pump + AMM balance |

#### Token Incentives & Cashback

| Method | Returns | Description |
|--------|---------|-------------|
| `claimTokenIncentives(user, payer)` | `TransactionInstruction[]` | Claim from the Pump program |
| `claimTokenIncentivesBothPrograms(user, payer)` | `TransactionInstruction[]` | Claim from both programs |
| `getTotalUnclaimedTokens(user)` | `BN` | Unclaimed Pump rewards |
| `getTotalUnclaimedTokensBothPrograms(user)` | `BN` | Combined unclaimed rewards |
| `getCurrentDayTokens(user)` | `BN` | Current day's Pump rewards |
| `getCurrentDayTokensBothPrograms(user)` | `BN` | Combined current day rewards |
| `syncUserVolumeAccumulatorBothPrograms(user)` | `TransactionInstruction[]` | Sync volume accumulators on both programs |
| `claimCashbackInstructions(user)` | `TransactionInstruction[]` | Claim cashback (Pump) |
| `claimCashbackBothPrograms(user)` | `TransactionInstruction[]` | Claim cashback (Pump + AMM) |
| `adminUpdateTokenIncentives(startTime, endTime, dayNumber, tokenSupplyPerDay, secondsInADay?, mint?, tokenProgram?)` | `TransactionInstruction` | Admin: configure incentives (positional args, all times/amounts `BN`) |
| `adminUpdateTokenIncentivesBothPrograms(...)` | `TransactionInstruction[]` | Same, for both programs |

#### Fee Sharing

##### `getMinimumDistributableFee(mint, simulationSigner?)`

Simulates the check instruction and returns the decoded result. Handles graduated tokens automatically.

```typescript
const result = await sdk.getMinimumDistributableFee(mint);
// { minimumRequired: BN, distributableFees: BN, canDistribute: boolean, isGraduated: boolean }
```

##### `buildDistributeCreatorFeesInstructions(mint, payer?)`

Builds distribution instructions. When `payer` is given, the creator-fee sweeps the coin needs come first (`creatorFeeSweepInstructions`). For graduated tokens, the AMM `transferCreatorFeesToPump` consolidation step follows. A coin with un-swept creator fees on its curve throws when `payer` is omitted, because the distribution would fail on chain with 6095 `CreatorFeesNotSwept`.

```typescript
const { instructions, isGraduated } = await sdk.buildDistributeCreatorFeesInstructions(mint, payer);
```

##### Config fetchers and wrappers

| Method | Description |
|--------|-------------|
| `fetchSharingConfig(mint)` | Decoded `SharingConfig` (throws if missing) |
| `fetchSharingConfigNullable(mint)` | `SharingConfig \| null` |
| `fetchMultipleSharingConfigs(mints)` | Batch fetch |
| `createFeeSharingConfigInstructions({...})` | Online wrapper around `createFeeSharingConfig` |
| `updateFeeSharesInstructions({...})` | Online wrapper around `updateFeeShares` |
| `createSocialFeePdaInstructions({...})` / `claimSocialFeePdaInstructions({...})` | Online social-fee wrappers |
| `fetchSocialFeePda(userId, platform)` | Decoded `SocialFeePda` account |
| `migrateBondingCurveCreatorInstructions(mint)` / `setMetaplexCreatorInstructions(mint)` | Creator migration wrappers |

#### Analytics Fetchers

RPC wrappers around the pure functions in the analytics module.

```typescript
const summary = await sdk.fetchBondingCurveSummary(mint);   // BondingCurveSummary
const progress = await sdk.fetchGraduationProgress(mint);   // GraduationProgress
const price = await sdk.fetchTokenPrice(mint);              // TokenPriceInfo
const buyImpact = await sdk.fetchBuyPriceImpact(mint, new BN(1_000_000_000));   // PriceImpactResult
const sellImpact = await sdk.fetchSellPriceImpact(mint, new BN(1_000_000));     // PriceImpactResult
```

#### Event Parsing

##### `parseTransactionEvents(signature, commitment?)`

Fetches a confirmed transaction and decodes every Pump, PumpAMM, and PumpFees event from its logs into the `PumpEvent` discriminated union.

```typescript
const events = await sdk.parseTransactionEvents(signature);
for (const ev of events) {
  if (ev.type === "trade") {
    console.log(ev.data.isBuy ? "buy" : "sell", ev.data.solAmount.toString());
  }
}
```

#### AMM Methods

| Method | Description |
|--------|-------------|
| `fetchPool(mint)` | Canonical pool account for a graduated mint |
| `fetchPoolByAddress(poolAddress)` | Pool account by address |
| `fetchMultiplePools(mints)` | `Map<string, Pool \| null>` batch fetch |
| `fetchAmmGlobalConfig()` | `AmmGlobalConfig` |
| `fetchFeeProgramGlobal()` | `FeeProgramGlobal` |
| `ammBuyInstructions({ mint, user, solAmount, slippageBps? })` | Buy on the AMM; fetches pool state and computes slippage. Also accepts low-level `{ quoteAmountIn, minBaseAmountOut }` |
| `ammSellInstructions({ mint, user, tokenAmount, slippageBps? })` | Sell on the AMM. Also accepts `{ baseAmountIn, minQuoteAmountOut }` |
| `ammBuyBySolAmount({ mint, user, solAmount, slippage })` | Percent-slippage variant |
| `ammSellByTokenAmount({ mint, user, tokenAmount, slippage })` | Percent-slippage variant |
| `ammQuoteBuy({ mint, user, quoteAmountIn })` | `AmmBuyQuote` with pool reserves and fees |
| `ammQuoteSell({ mint, user, baseAmountIn })` | `AmmSellQuote` |
| `ammDepositInstructions({...})` / `ammWithdrawInstructions({...})` | Liquidity ops with pool state fetched for you |
| `quoteAmmDepositBaseIn({...})` / `quoteAmmDepositQuoteIn({...})` / `quoteAmmWithdraw({...})` | Deposit/withdraw quotes |
| `ammDepositAutocompleteFromBase({...})` / `ammDepositAutocompleteFromQuote({...})` / `ammWithdrawAutocomplete({...})` | Compute the matching side of a deposit/withdraw |
| `depositByBaseAmount({...})` / `depositByQuoteAmount({...})` / `withdrawByLpAmount({...})` | One-call liquidity operations |
| `getLpTokenBalance(mint, user)` / `fetchLpBalance(mint, user)` | LP token balance |

#### Online Creation & Migration

```typescript
const createIx = await sdk.createV2Instruction({ ... });        // fetches state as needed
const createAndBuy = await sdk.createV2AndBuyInstructions({ ... });

// Quote the new coin in a whitelisted, QuoteControl-listed or pump-coin mint.
// The token program and, for a pump coin, its quote accounts are resolved for you.
const quoted = await sdk.createV2AndBuyInstructions({
  mint, name, symbol, uri, creator, user,
  solAmount,              // on a token quote: the amount of quoteMint the first buy spends
  quoteMint,
});
const migrateIxs = await sdk.migrateInstructions({ ... });       // migration with fetched state
```

---

## Functions

### Bonding Curve Math

All pure and offline. Amounts are `BN`; SOL amounts are lamports; token amounts are raw units (6 decimals).

#### `getBuyTokenAmountFromSolAmount(params)`

Tokens received for a given SOL spend, fees included.

```typescript
const tokens = getBuyTokenAmountFromSolAmount({
  global,               // Global
  feeConfig,            // FeeConfig | null (null = flat global fees)
  mintSupply,           // BN | null (null for a token that doesn't exist yet)
  bondingCurve,         // BondingCurve | null (null for a new token)
  amount: solAmount,    // BN, lamports
});
```

#### `getBuySolAmountFromTokenAmount(params)`

SOL cost (fees included) to buy a given token amount. Same parameter shape, `amount` is the token amount.

#### `getSellSolAmountFromTokenAmount(params)`

Net SOL received (after fees) for selling a token amount. `mintSupply` and `bondingCurve` are required (non-null).

#### `getTokenAmountForTargetSol(params)`

Binary-searches the token amount to sell that yields approximately `targetSol` lamports after fees. Bounded by both `realTokenReserves` and `maxSafeSellAmount`, so the result is always safe for a single instruction.

```typescript
const amount = getTokenAmountForTargetSol({
  global, feeConfig, mintSupply, bondingCurve,
  targetSol,           // BN, lamports
});
```

#### `maxSafeSellAmount(virtualSolReserves)`

Largest token amount sellable in one instruction: `min(u64::MAX, floor(0.9 * u128::MAX / virtualSolReserves))`. The program widens the multiply to u128, so the token amount's own u64 field width is what binds on any real curve.

#### `validateSellAmount(amount, bondingCurve)`

Throws `SellOverflowError` when `amount` exceeds `maxSafeSellAmount`. Called automatically by `sellInstructions`.

#### `bondingCurveMarketCap(params)`

```typescript
const marketCap = bondingCurveMarketCap({
  mintSupply,             // BN
  virtualSolReserves,     // BN
  virtualTokenReserves,   // BN
}); // BN, lamports; throws if virtualTokenReserves is zero
```

#### `newBondingCurve(global, quoteMint?, quoteControl?, creatorFeeBps?, isHolderReward?, pumpQuote?)`

Creates the initial bonding curve state a brand-new token would have, from `Global` config. Used to quote a buy for a token that hasn't been created yet. The starting virtual quote reserves follow the quote mint: `Global.initialVirtualSolReserves` for SOL, `Global.initialVirtualQuoteReserves` for a whitelisted mint, the `QuoteControl` entry for a listed mint, and `pumpQuoteReserves` for a pump coin.

```typescript
const curve = newBondingCurve(global);
// {
//   virtualTokenReserves, virtualQuoteReserves, realTokenReserves,
//   realQuoteReserves: BN(0), tokenTotalSupply, complete: false,
//   creator: PublicKey.default,
//   isMayhemMode: global.mayhemModeEnabled,
//   isCashbackCoin: false,
//   quoteMint, creatorFeeBps, canEditCreatorFee: false, isHolderReward,
//   creatorFee: BN(0), protocolFees: BN(0), depth,
//   initialVirtualQuoteReserves, postCompleteBaseOut: BN(0), postCompleteQuoteIn: BN(0),
// }
```

#### `getStaticRandomFeeRecipient()`

Picks a random protocol fee recipient from the hardcoded list used by buy/sell instructions.

#### `getBuyV3QuoteAmountFromTokenAmount(params)`

What `buy_v3` charges for `amount` tokens, fees included: the cap to send as `quoteAmount` before slippage. Past the remaining supply the cost includes the post-completion leg bought from the pool-to-be; on a mayhem curve it stops at the remaining supply (send `partialFill` then). Zero on a complete or migrated curve. `feeConfig` is required because v3 always charges the `FeeConfig` schedule for the curve's quote mint.

```typescript
const cost = getBuyV3QuoteAmountFromTokenAmount({
  global, feeConfig, mintSupply, bondingCurve,
  amount,                   // BN - tokens
  curveBaseTokenBalance,    // BN - from fetchBuyState
});
```

#### `getBuyV3TokenAmountFromQuoteAmount(params)`

The tokens `buy_exact_quote_in_v3` buys for `amount` quote, fees included. Same parameters. Apply slippage to the result for `minTokensOut`.

#### `isBondingCurveMigrated(bondingCurve)`

`true` when the migration zeroed every reserve (pump `BondingCurve::is_migrated`).

#### `pumpQuoteAdmission(global, quote, quoteControl?)` / `pumpQuoteReserves(global, quote, quoteControl?)`

The checks and seed `create_v2` applies to a pump coin offered as a quote. `pumpQuoteAdmission` runs the depth gate (`CurveDepthExceededError`, 6105) and eligibility (`QuoteBondingCurveNotEligibleError`, 6100) from the quote coin's curve alone. `pumpQuoteReserves` returns the `virtualQuoteReserves` and `depth` the new curve gets: the reference graduation raise is bought on the quote coin's constant product (its pool once migrated, with the pool's signed virtual quote reserves added, or its curve before) and scaled back. It throws `QuoteCurveAwaitingMigrationError` (6107) for a complete but unmigrated quote and `QuoteReservesOutOfRangeError` (6104) when the result leaves the allowed range. `newBondingCurve(global, quoteMint, quoteControl, creatorFeeBps, isHolderReward, pumpQuote)` uses it to build the curve a pump-quoted launch starts from.

### Fee Functions

#### `getFee(params)`

Total fee (protocol + creator) for a trade amount. Creator fee applies only when the curve has a creator set (or the curve is new).

```typescript
const fee = getFee({
  global, feeConfig, mintSupply, bondingCurve,
  amount,                // BN, lamports (gross trade SOL)
  isNewBondingCurve,     // boolean
});
```

#### `computeFeesBps(params)`

Protocol and creator fee rates in basis points. Uses tiered fees from `feeConfig` when present, otherwise the flat global defaults.

```typescript
const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
  global, feeConfig, mintSupply,
  virtualSolReserves, virtualTokenReserves,
});
```

#### `calculateFeeTier(params)`

Select the fee tier for a market cap. Returns the full `Fees` object. Throws if `feeTiers` is empty.

```typescript
const fees = calculateFeeTier({ feeTiers, marketCap });
```

#### `getFeeRecipient(global, mayhemMode)`

Picks a random fee recipient from `Global` (`feeRecipient`/`feeRecipients`, or the reserved set in mayhem mode).

#### Quote mint fee schedules

| Function | Description |
|----------|-------------|
| `selectCurveFeeSchedule({ feeConfig, quoteMint, marketCap })` | The `Fees` a canonical curve or pool pays, chosen by quote mint like `FeeConfig::fees_for_quote_mint`: SOL-like quotes use `feeTiers`, listed stables `stableFeeTiers`, anything else `exoticFlatFees` (or `flatFees` while unset). `marketCap` is in the quote mint's base units |
| `isSolLikeQuoteMint(mint)` / `isStableQuoteMint(mint)` / `isExoticQuoteMint(mint)` | Quote mint classification; `SOL_LIKE_QUOTE_MINTS` and `STABLE_QUOTE_MINTS` hold the lists |
| `getStaticRandomFeeRecipientForBuyback()` | A random listed buyback recipient, for a v3 trade on a SOL curve |
| `getBuybackFeeRecipientForTokenQuote()` | The first listed buyback recipient, whose quote ATA v3 trades pay on a token quote |
| `poolQuoteTerms(pool)` | The pool fields PumpSwap quote math needs beyond reserves: signed `virtualQuoteReserves`, quote mint, mayhem flag and per-pool creator fee |

### Breaking Fee Recipient Helpers (2026-04-28 upgrade)

Every bonding curve buy/sell must carry one of 8 mutable trailing fee recipient accounts, and every AMM buy/sell must carry that recipient plus its WSOL ATA. `PUMP_SDK` builders do this automatically; these helpers exist for hand-rolled or legacy instructions.

| Function | Description |
|----------|-------------|
| `pickBreakingFeeRecipient()` | Random pick from the 8 recipients |
| `isBreakingFeeRecipient(pubkey)` | Membership check |
| `buildAmmBreakingFeeRecipientAccounts(feeRecipient?)` | The two trailing AMM accounts (recipient + WSOL ATA) |
| `validateBcInstruction(ix, kind)` | Validate a bonding curve buy/sell instruction's account layout (`"buy" \| "sell" \| "sell-cashback"`) |
| `validateAmmInstruction(ix, kind)` | Validate an AMM buy/sell layout (`"buy" \| "buy-cashback" \| "sell" \| "sell-cashback"`) |
| `patchBcInstruction(ix)` | Append the trailing recipient to a pre-upgrade instruction (idempotent, returns a new instruction) |
| `patchAmmInstruction(ix)` | Same for AMM instructions (appends recipient + ATA) |

### Analytics

Pure offline market analysis.

| Function | Returns | Description |
|----------|---------|-------------|
| `calculateBuyPriceImpact({ global, feeConfig, mintSupply, bondingCurve, solAmount })` | `PriceImpactResult` | Price impact of a buy in bps |
| `calculateSellPriceImpact({ global, feeConfig, mintSupply, bondingCurve, tokenAmount })` | `PriceImpactResult` | Price impact of a sell in bps |
| `getGraduationProgress(global, bondingCurve, feeConfig?)` | `GraduationProgress` | Progress to graduation incl. SOL needed |
| `bondingCurveGraduationProgress({ realSolReserves, realTokenReserves, initialRealTokenReserves? })` | `number` | Lightweight 0-1 progress using the standard initial reserves constant |
| `getTokenPrice({ global, feeConfig, mintSupply, bondingCurve })` | `TokenPriceInfo` | Buy/sell price per whole token + market cap |
| `getBondingCurveSummary({ global, feeConfig, mintSupply, bondingCurve })` | `BondingCurveSummary` | All-in-one summary |

### Token Incentives

```typescript
const unclaimed = totalUnclaimedTokens(globalVolumeAccumulator, userVolumeAccumulator, timestampSecs?);
const today = currentDayTokens(globalVolumeAccumulator, userVolumeAccumulator, timestampSecs?);
```

### Vanity Mint Generation

Grind a mint keypair whose address matches a prefix/suffix (pump.fun's UI uses mints ending in `pump`). CPU-bound; patterns are capped at `MAX_VANITY_PATTERN_LENGTH` (6). For longer patterns use the Rust generator in `rust/`.

```typescript
import { generateVanityMint, estimateVanityMintAttempts } from "@nirholas/pump-sdk";

const estimate = estimateVanityMintAttempts({ suffix: "pump" });

const { keypair, attempts, durationMs } = await generateVanityMint({
  suffix: "pump",
  caseInsensitive: false,
  onProgress: ({ attempts, attemptsPerSecond }) => {
    console.log(attempts, "attempts,", Math.round(attemptsPerSecond), "/s");
  },
});
// keypair.publicKey.toBase58() ends with "pump"; pass keypair as a signer to createV2
```

Throws `VanityMintPatternError` (invalid Base58 or too long) or `VanityMintMaxAttemptsError` (when `maxAttempts` is set and exhausted).

### RPC Fallback

| Function | Description |
|----------|-------------|
| `createFallbackConnection(endpoints, connectionConfig?, fallbackConfig?)` | A `Connection` that fails over across endpoints with backoff, health tracking, and cooldowns |
| `fetchWithFallback(...)` | Same failover strategy for plain HTTP fetches |
| `parseEndpoints(envValue, fallback)` | Parse a comma-separated endpoint list from an env var |

`FallbackConfig`: `maxRetriesPerEndpoint` (default 2), `baseDelayMs` (500), `timeoutMs` (10000), `cooldownMs` (60000). See [RPC Best Practices](./rpc-best-practices.md).

### PDA Helpers

| Function | Returns | Description |
|----------|---------|-------------|
| `bondingCurvePda(mint)` | `PublicKey` | Bonding curve account address |
| `bondingCurveV2Pda(mint)` | `PublicKey` | Bonding curve v2 account address |
| `creatorVaultPda(creator)` | `PublicKey` | Creator fee vault (Pump) |
| `ammCreatorVaultPda(creator)` | `PublicKey` | Creator fee vault (AMM) |
| `canonicalPumpPoolPda(mint)` | `PublicKey` | Canonical AMM pool for a graduated token |
| `poolV2Pda(baseMint)` | `PublicKey` | Pool v2 account address |
| `pumpPoolAuthorityPda(mint)` | `PublicKey` | Pool authority used during graduation |
| `feeSharingConfigPda(mint)` | `PublicKey` | Fee sharing config address |
| `userVolumeAccumulatorPda(user)` | `PublicKey` | User volume tracker (Pump) |
| `ammUserVolumeAccumulatorPda(user)` | `PublicKey` | User volume tracker (AMM) |
| `feeProgramGlobalPda()` | `PublicKey` | PumpFees global state |
| `socialFeePda(userId, platform)` | `PublicKey` | Social fee PDA |
| `getGlobalParamsPda()` | `PublicKey` | Mayhem global params |
| `getMayhemStatePda(mint)` | `PublicKey` | Mayhem state for a token |
| `getSolVaultPda()` | `PublicKey` | Mayhem SOL vault |
| `getTokenVaultPda(mint)` | `PublicKey` | Mayhem token vault ATA |
| `getEventAuthorityPda(programId)` | `PublicKey` | `__event_authority` PDA for any program |

### Program Constructors

| Function | Returns | Description |
|----------|---------|-------------|
| `getPumpProgram(connection)` | `Program<Pump>` | Anchor program instance |
| `getPumpAmmProgram(connection)` | `Program<PumpAmm>` | AMM program instance |
| `getPumpFeeProgram(connection)` | `Program<PumpFees>` | Fee program instance |

The raw IDLs are exported too: `PumpIdl` (`pumpIdl`), `PumpAmmIdl`, `PumpFeesIdl`, plus the `Pump`, `PumpAmm`, and `PumpFees` IDL types.

### Utilities

#### `isCreatorUsingSharingConfig({ mint, creator })`

Returns `true` when the on-chain creator address has been replaced with the fee-sharing config PDA. Pass `bondingCurve.creator` (ungraduated) or `pool.coinCreator` (graduated), not the human creator's wallet.

#### `isSharingConfigEditable({ sharingConfig })`

Returns `false` for legacy v1 configs and for v2 configs whose admin has been revoked.

#### `normalizeSocialShareholders({ newShareholders })`

Resolves `SocialShareholderInput` entries (wallet address, or `userId` + `platform`) into concrete `Shareholder`s, and returns the set of social PDAs that still need to be created.

#### Platform helpers

`Platform` enum (`Pump`, `X`, `GitHub`), `SUPPORTED_SOCIAL_PLATFORMS` (currently `[Platform.GitHub]`), `platformToString(platform)`, `stringToPlatform(value)`.

---

## Types

### Account State

#### `Global`

```typescript
interface Global {
  initialized: boolean;
  authority: PublicKey;
  feeRecipient: PublicKey;
  initialVirtualTokenReserves: BN;
  initialVirtualSolReserves: BN;
  initialRealTokenReserves: BN;
  tokenTotalSupply: BN;
  feeBasisPoints: BN;
  withdrawAuthority: PublicKey;
  enableMigrate: boolean;
  poolMigrationFee: BN;
  creatorFeeBasisPoints: BN;
  feeRecipients: PublicKey[];
  setCreatorAuthority: PublicKey;
  adminSetCreatorAuthority: PublicKey;
  createV2Enabled: boolean;
  whitelistPda: PublicKey;
  reservedFeeRecipient: PublicKey;
  mayhemModeEnabled: boolean;
  reservedFeeRecipients: PublicKey[];
  isCashbackEnabled: boolean;
  buybackFeeRecipients: PublicKey[];   // wallets the v3 trades pay the buyback slice to
  buybackBasisPoints: BN;
  initialVirtualQuoteReserves: BN;     // starting reserves for a whitelisted quote mint
  whitelistedQuoteMints: PublicKey[];
  creatorFeeConfigurable: boolean;
  maxConfigurableCreatorFeeBps: BN;
  holderRewardClaimAuthority: PublicKey;
  isHolderRewardEnabled: boolean;
  maxCurveDepth: number;               // u8; 0 disables pump-coin quotes
}
```

#### `BondingCurve`

The decoder reads every layout from the original 49 bytes up to the current 166 (`BONDING_CURVE_SIZE`); fields an older account does not carry decode as zero.

```typescript
interface BondingCurve {
  virtualTokenReserves: BN;
  virtualQuoteReserves: BN;          // denominated in quoteMint (lamports on a SOL curve)
  realTokenReserves: BN;
  realQuoteReserves: BN;
  tokenTotalSupply: BN;
  complete: boolean;                 // true = curve filled (migration may still be pending)
  creator: PublicKey;
  isMayhemMode: boolean;
  isCashbackCoin: boolean;
  quoteMint: PublicKey;              // PublicKey.default on a SOL curve
  creatorFeeBps: BN;
  canEditCreatorFee: boolean;
  isHolderReward: boolean;
  creatorFee: BN;                    // creator fees v3 trades left for sweep_creator_fee
  protocolFees: BN;                  // protocol fees v3 trades left for sweep_protocol_fee
  depth: number;                     // u8; pump-coin quote chain depth (0 for SOL and listed quotes)
  initialVirtualQuoteReserves: BN;
  postCompleteBaseOut: BN;           // tokens bought from the pool-to-be after completion
  postCompleteQuoteIn: BN;           // quote paid into the pool-to-be after completion
}
```

#### `QuoteControl`

```typescript
interface QuoteControl {
  admin: PublicKey;
  reservesAdmin: PublicKey;
  reserved: number[];
  mints: QuoteControlMint[];         // { mint, initialVirtualQuoteReserves }
}
```

#### `FeeConfig`

```typescript
interface FeeConfig {
  admin: PublicKey;
  flatFees: Fees;
  feeTiers: FeeTier[];
  stableFeeTiers?: FeeTier[];        // schedule for listed stable quotes
  exoticFlatFees?: Fees;             // schedule for pump-coin and QuoteControl quotes
}

interface FeeTier {
  marketCapLamportsThreshold: BN;
  fees: Fees;
}

interface Fees {
  lpFeeBps: BN;
  protocolFeeBps: BN;
  creatorFeeBps: BN;
}
```

### Fee Sharing

```typescript
interface Shareholder {
  address: PublicKey;
  shareBps: number;          // Basis points (sum must equal 10000)
}

interface SharingConfig {
  version: number;
  mint: PublicKey;
  admin: PublicKey;
  adminRevoked: boolean;
  shareholders: Shareholder[];
}

type SocialShareholderInput = {
  shareBps: number;
  address?: PublicKey;       // either a wallet address...
  userId?: string;           // ...or a social identity
  platform?: Platform;
};
```

### Volume & Incentives

```typescript
interface GlobalVolumeAccumulator {
  startTime: BN;
  endTime: BN;
  secondsInADay: BN;
  mint: PublicKey;
  totalTokenSupply: BN[];
  solVolumes: BN[];
}

interface UserVolumeAccumulator {
  user: PublicKey;
  needsClaim: boolean;
  totalUnclaimedTokens: BN;
  totalClaimedTokens: BN;
  currentSolVolume: BN;
  lastUpdateTimestamp: BN;
}

interface UserVolumeAccumulatorTotalStats {
  totalUnclaimedTokens: BN;
  totalClaimedTokens: BN;
  currentSolVolume: BN;
}
```

### Quotes

```typescript
interface BuyQuote {
  tokensOut: BN;             // expected tokens after all fees
  feesLamports: BN;          // total protocol + creator fees
  priceImpactBps: number;
  priceBefore: BN;           // spot price per token, lamports
  priceAfter: BN;
}

interface SellQuote {
  solOut: BN;                // net SOL after fees
  feesLamports: BN;
  priceImpactBps: number;
  priceBefore: BN;
  priceAfter: BN;
  maxSafeAmount: BN;         // largest single-tx sell without overflow
  willOverflow: boolean;     // amount > maxSafeAmount, use sellChunked
}

interface AmmBuyQuote {
  tokensOut: BN;
  solSpent: BN;
  feesLamports: BN;          // protocol + LP + creator
  poolBaseAmount: BN;
  poolQuoteAmount: BN;
}

interface AmmSellQuote {
  solOut: BN;
  tokensSold: BN;
  feesLamports: BN;
  poolBaseAmount: BN;
  poolQuoteAmount: BN;
}
```

### Analytics Types

```typescript
interface PriceImpactResult {
  priceBefore: BN;          // price per token before the trade (lamports)
  priceAfter: BN;           // price per token after the trade (lamports)
  impactBps: number;        // price impact in basis points (150 = 1.5%)
  outputAmount: BN;         // tokens received (buy) or SOL received (sell)
}

interface GraduationProgress {
  progressBps: number;      // 0-10000 bps complete
  isGraduated: boolean;
  tokensRemaining: BN;      // tokens left before graduation
  tokensTotal: BN;          // real tokens the curve started with
  solAccumulated: BN;       // SOL in real reserves
  solNeededToGraduate: BN;  // SOL cost to buy all remaining tokens
}

interface TokenPriceInfo {
  buyPricePerToken: BN;     // cost to buy 1 whole token (lamports)
  sellPricePerToken: BN;    // SOL received for selling 1 whole token
  marketCap: BN;            // lamports
  isGraduated: boolean;
}

interface BondingCurveSummary {
  marketCap: BN;
  progressBps: number;
  isGraduated: boolean;
  solNeededToGraduate: BN;
  buyPricePerToken: BN;
  sellPricePerToken: BN;
  realSolReserves: BN;
  realTokenReserves: BN;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
  protocolFeeBps: BN;       // current fee tier
  creatorFeeBps: BN;
  isMayhemMode: boolean;
}
```

### Vanity Types

```typescript
interface VanityMintOptions {
  prefix?: string;
  suffix?: string;              // "pump" matches pump.fun's convention
  caseInsensitive?: boolean;
  signal?: AbortSignal;
  maxAttempts?: number;
  onProgress?: (progress: VanityMintProgress) => void;
}

interface VanityMintResult {
  keypair: Keypair;
  attempts: number;
  durationMs: number;
}

interface VanityMintProgress {
  attempts: number;
  elapsedMs: number;
  attemptsPerSecond: number;
}
```

### Online SDK Result Types

```typescript
interface MinimumDistributableFeeResult extends MinimumDistributableFeeEvent {
  isGraduated: boolean;
}

interface DistributeCreatorFeeResult {
  instructions: TransactionInstruction[];
  isGraduated: boolean;
}

interface CalculatedFeesBps {
  protocolFeeBps: BN;
  creatorFeeBps: BN;
}

interface BreakingFeeValidation {
  valid: boolean;
  errors: string[];
}
```

### Trade and Route Types

```typescript
// Extra create_v2 accounts for a pump-coin quote (from OnlinePumpSdk.fetchPumpQuote)
interface PumpQuoteAccounts {
  pool?: { pool: PublicKey; baseVault: PublicKey; quoteVault: PublicKey };
}

// A pump coin offered as a quote, as pumpQuoteReserves reads it
interface PumpQuoteCurve {
  mint: PublicKey;
  bondingCurve: BondingCurve;
  pool?: { baseReserves: BN; quoteReserves: BN; virtualQuoteReserves: BN };
  quoteControl?: QuoteControl | null;
}

// One hop of a multi_hop_swap route
interface MultiHopHop {
  venue: "pool" | "curve";
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseTokenProgram: PublicKey;
  quoteTokenProgram: PublicKey;
}
type MultiHopSide = "buy" | "sell";
interface MintWithProgram { mint: PublicKey; tokenProgram: PublicKey }
```

### Events

Every on-chain Anchor event has a typed interface export: Pump (`TradeEvent`, `CreateEvent`, `CompleteEvent`, `CompletePumpAmmMigrationEvent`, `SetCreatorEvent`, `CollectCreatorFeeEvent`, `ClaimTokenIncentivesEvent`, `ClaimCashbackEvent`, `ExtendAccountEvent`, `PostCompleteBuyEvent`, `SweepBondingCurveFeeEvent`, volume accumulator events, admin events), PumpAMM (`AmmBuyEvent`, `AmmSellEvent`, `DepositEvent`, `WithdrawEvent`, `CreatePoolEvent`, `SweepPoolFeeEvent`, plus admin/config events; `AmmAdminSetCoinCreatorEvent` was removed with its instruction), and PumpFees (`CreateFeeSharingConfigEvent`, `UpdateFeeSharesEvent`, `ResetFeeSharingConfigEvent` (still decoded for historical transactions), `RevokeFeeSharingAuthorityEvent`, `TransferFeeSharingAuthorityEvent`, `SocialFeePdaCreatedEvent`, `SocialFeePdaClaimedEvent`, `DistributeCreatorFeesEvent`, `MinimumDistributableFeeEvent`, plus fee-admin events). See [Events Reference](./events-reference.md) for field-level detail.

`PumpEvent` is the discriminated union returned by `parseTransactionEvents`: `{ type: "trade", data: TradeEvent } | { type: "ammBuy", data: AmmBuyEvent } | ...` covering all decodable events across the three programs.

### AMM & Fee Program Types

```typescript
interface Pool {
  poolBump: number;
  index: number;
  creator: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  lpMint: PublicKey;
  poolBaseTokenAccount: PublicKey;
  poolQuoteTokenAccount: PublicKey;
  lpSupply: BN;
  coinCreator: PublicKey;
  isMayhemMode: boolean;
  isCashbackCoin: boolean;
  isHolderReward: boolean;
  virtualQuoteReserves: BN;          // signed; nonzero on a pool a synthetic migration created
  creatorFeeBps: BN;
  canEditCreatorFee: boolean;
  protocolFees: BN;                  // protocol fees v2 trades left for sweep_protocol_fee
  creatorFees: BN;                   // creator fees v2 trades left for sweep_creator_fee
}

interface AmmGlobalConfig {
  admin: PublicKey;
  lpFeeBasisPoints: BN;
  protocolFeeBasisPoints: BN;
  disableFlags: number;
  protocolFeeRecipients: PublicKey[];
  coinCreatorFeeBasisPoints: BN;
  adminSetCoinCreatorAuthority: PublicKey;
  whitelistPda: PublicKey;
  reservedFeeRecipient: PublicKey;
  mayhemModeEnabled: boolean;
  reservedFeeRecipients: PublicKey[];
  isCashbackEnabled: boolean;
  buybackFeeRecipients: PublicKey[];
  buybackBasisPoints: BN;
  boostAuthority: PublicKey;
  boostEnabled: boolean;
  creatorFeeConfigurable: boolean;
  maxConfigurableCreatorFeeBps: BN;
}

interface FeeProgramGlobal {
  bump: number;
  authority: PublicKey;
  disableFlags: number;
  socialClaimAuthority: PublicKey;
  claimRateLimit: BN;
}

interface SocialFeePda {
  bump: number;
  version: number;
  userId: string;
  platform: number;
  totalClaimed: BN;
  lastClaimed: BN;
}
```

---

## Error Classes

All errors extend `Error` and are exported from the package root.

| Error | When Thrown |
|-------|------------|
| `NoShareholdersError` | Empty shareholders array in `updateFeeShares` |
| `TooManyShareholdersError` | More than `MAX_SHAREHOLDERS` (10) shareholders |
| `ZeroShareError` | A shareholder has 0 bps or negative |
| `InvalidShareTotalError` | Shares don't sum to 10,000 bps |
| `DuplicateShareholderError` | Duplicate addresses in shareholders |
| `ShareCalculationOverflowError` | Share amount calculation would overflow |
| `PoolRequiredForGraduatedError` | Pool param missing for a graduated coin |
| `SellOverflowError` | Sell amount is wider than the on-chain u64 token field; split with `sellChunked` |
| `VanityError` / `VanityMintPatternError` / `VanityMintMaxAttemptsError` | Invalid or exhausted vanity mint grind |
| `CashbackDeprecatedError` | A launch asked for cashback, which `create_v2` rejects (pump 6082) |
| `HolderRewardDisabledError` | A holder-reward launch or conversion while `Global.isHolderRewardEnabled` is off |
| `UnsupportedQuoteMintError` | A quote mint no list admits (pump 6063), or the Token-2022 native mint |
| `CashbackCoinNotSupportedError` | A v3 curve trade on a cashback coin (pump 6094) |
| `QuoteBondingCurveNotEligibleError` | A pump coin that cannot be a quote: mayhem mode, or a depth-0 coin whose own quote no list admits (pump 6100) |
| `QuotePoolNotFoundError` | A migrated pump-coin quote with no canonical PumpSwap pool (pump 6102) |
| `QuoteReservesOutOfRangeError` | The seed a pump-coin quote yields is outside the allowed range (pump 6104) |
| `CurveDepthExceededError` | A pump-coin quote chain deeper than `Global.maxCurveDepth` (pump 6105) |
| `QuoteCurveAwaitingMigrationError` | A pump-coin quote whose curve completed but has not migrated (pump 6107) |
| `MultiHopDiscontinuousPathError` | `multi_hop_swap` hops that do not chain (pump 6098, pump-amm 6084) |

#### `getPumpProgramError(program, code)`

Resolves a failed transaction's `InstructionError: Custom(code)` to the error the program declares, from the bundled IDLs, including every code the October 2026 upgrade added (pump 6094 to 6108, pump-amm 6059 to 6087, pump-fees 6031 to 6034). `program` is `"pump"`, `"pumpAmm"`, `"pumpFees"` or a program id; the result is `{ program, code, name, msg? }`, or `undefined` for a code the program does not declare.

```typescript
getPumpProgramError("pump", 6095);
// { program: "pump", code: 6095, name: "CreatorFeesNotSwept", msg: ... }
getPumpProgramError(PUMP_AMM_PROGRAM_ID, 6084)?.name; // "MultiHopDiscontinuousPath"
```

See the [Error Reference](./errors.md) for causes and fixes.

---

## Related

- [Getting Started](./getting-started.md): first calls, offline and live
- [Architecture](./architecture.md): how the modules fit together
- [Bonding Curve Math](./bonding-curve-math.md) and [Fee Tiers](./fee-tiers.md): the math behind the quotes
- [AMM Trading](./amm-trading.md): graduated pool operations

Runnable examples: all 50 numbered examples under `examples/` exercise this API surface; run any with `npm run example NN`.
