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
| `BONDING_CURVE_NEW_SIZE` | `number` | `151` | Byte size of new bonding curve accounts |
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
| `AMM_GLOBAL_PDA` | AMM global state account |
| `AMM_GLOBAL_CONFIG_PDA` | AMM global config account |
| `AMM_FEE_CONFIG_PDA` | AMM fee config account (PumpFees) |
| `PUMP_FEE_CONFIG_PDA` | Pump fee configuration account |
| `GLOBAL_VOLUME_ACCUMULATOR_PDA` | Pump volume tracker |
| `AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA` | AMM volume tracker |
| `PUMP_EVENT_AUTHORITY_PDA` | Pump event authority |
| `PUMP_AMM_EVENT_AUTHORITY_PDA` | AMM event authority |
| `PUMP_FEE_EVENT_AUTHORITY_PDA` | Fee event authority |

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

#### Event Decoders

Decode Anchor CPI event data from transaction logs. Every event type in the [Types](#types) section has a matching `decode<EventName>(data: Buffer)` method, e.g. `decodeTradeEvent`, `decodeCreateEvent`, `decodeCompleteEvent`, `decodeAmmBuyEvent`, `decodeAmmSellEvent`, `decodeCreateFeeSharingConfigEvent`, `decodeSocialFeePdaClaimedEvent`, and so on across all three programs. For decoding every event in a confirmed transaction in one call, use `OnlinePumpSdk.parseTransactionEvents(signature)` instead.

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
});
```

New cashback launches are rejected. Existing cashback coins remain tradeable
and their accrued cashback remains claimable.

##### `createV2AndBuyInstructions(params)`

Creates a token and immediately buys in a single transaction. Includes the account-extension and ATA-creation instructions.

```typescript
const ixs = await PUMP_SDK.createV2AndBuyInstructions({
  global,                 // Global - from fetchGlobal()
  mint, name, symbol, uri, creator, user,
  amount,                 // BN - token amount to buy
  solAmount,              // BN - SOL to spend (lamports)
  mayhemMode: false,
  holderReward: true,     // routes the first buy to the holder PDA vault
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

Builds instructions to buy tokens from a bonding curve. Automatically prepends an account-extension instruction when the curve account predates `BONDING_CURVE_NEW_SIZE`, and an ATA-creation instruction when `associatedUserAccountInfo` is `null`.

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

Builds instructions to sell tokens back to the bonding curve. Runs `validateSellAmount` first and throws `SellOverflowError` if the amount would overflow the on-chain u64 math.

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

Extends a bonding curve account to the current size (`BONDING_CURVE_NEW_SIZE`).

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

##### `getMinimumDistributableFee(params)`

Builds the simulation instruction that reports the minimum distributable fee. Prefer the `OnlinePumpSdk` method of the same name, which runs the simulation and returns the decoded result.

#### Fee Sharing Authority

```typescript
// Transfer admin control to a new address
const ix1 = await PUMP_SDK.transferFeeSharingAuthorityInstruction({ authority, mint, newAdmin });

// Reset the config and assign a new admin
const ix2 = await PUMP_SDK.resetFeeSharingConfigInstruction({ authority, mint, newAdmin });

// Permanently revoke authority (irreversible; adminRevoked becomes true)
const ix3 = await PUMP_SDK.revokeFeeSharingAuthorityInstruction({ authority, mint });
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

Restricted to program authorities; exposed for completeness. Pump program: `adminSetCreatorInstruction`, `adminUpdateTokenIncentivesInstruction`, `adminSetIdlAuthorityInstruction`, `setMayhemVirtualParamsInstruction`, `toggleMayhemModeInstruction`, `toggleCashbackEnabledInstruction`, `toggleCreateV2Instruction`, `updateGlobalAuthorityInstruction`, `setReservedFeeRecipientsInstruction`, `setParamsInstruction`, `migrateBondingCurveCreatorInstruction`, `setMetaplexCreatorInstruction`. PumpAMM: `ammCreateConfigInstruction`, `ammUpdateAdminInstruction`, `ammUpdateFeeConfigInstruction`, `ammDisableInstruction`, `ammAdminSetCoinCreatorInstruction`, `ammAdminUpdateTokenIncentivesInstruction`, `ammToggleCashbackEnabledInstruction`, `ammToggleMayhemModeInstruction`, `ammExtendAccountInstruction`, `ammSetReservedFeeRecipientsInstruction`. PumpFees: `setClaimRateLimitInstruction`, `setSocialClaimAuthorityInstruction`, `upsertFeeTiersInstruction`, `initializeFeeConfigInstruction`, `initializeFeeProgramGlobalInstruction`, `setFeeAuthorityInstruction`, `setFeeDisableFlagsInstruction`, `feesUpdateAdminInstruction`, `feesUpdateFeeConfigInstruction`. See `docs/admin-operations.md`.

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
| `fetchBuyState(mint, user, tokenProgram?)` | `{ bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo, tokenProgram }` | Everything a buy needs; auto-detects the token program from the mint owner. `associatedUserAccountInfo` is `null` when the user has no ATA yet |
| `fetchSellState(mint, user, tokenProgram?)` | `{ bondingCurveAccountInfo, bondingCurve, tokenProgram }` | Everything a sell needs; throws if the user has no token account |
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
| `adminSetCoinCreatorInstructions(newCreator, mint)` | `TransactionInstruction[]` | Admin: reassign creator on both programs |
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

##### `buildDistributeCreatorFeesInstructions(mint)`

Builds distribution instructions. For graduated tokens, automatically prepends the AMM `transferCreatorFeesToPump` consolidation step.

```typescript
const { instructions, isGraduated } = await sdk.buildDistributeCreatorFeesInstructions(mint);
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

#### `newBondingCurve(global)`

Creates the initial bonding curve state a brand-new token would have, from `Global` config. Used to quote a buy for a token that hasn't been created yet.

```typescript
const curve = newBondingCurve(global);
// {
//   virtualTokenReserves, virtualSolReserves, realTokenReserves,
//   realSolReserves: BN(0), tokenTotalSupply, complete: false,
//   creator: PublicKey.default,
//   isMayhemMode: global.mayhemModeEnabled,
//   isCashbackCoin: false,
// }
```

#### `getStaticRandomFeeRecipient()`

Picks a random protocol fee recipient from the hardcoded list used by buy/sell instructions.

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
}
```

#### `BondingCurve`

```typescript
interface BondingCurve {
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
  realTokenReserves: BN;
  realSolReserves: BN;
  tokenTotalSupply: BN;
  complete: boolean;         // true = graduated to AMM
  creator: PublicKey;
  isMayhemMode: boolean;
  isCashbackCoin: boolean;
}
```

#### `FeeConfig`

```typescript
interface FeeConfig {
  admin: PublicKey;
  flatFees: Fees;
  feeTiers: FeeTier[];
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

### Events

Every on-chain Anchor event has a typed interface export: Pump (`TradeEvent`, `CreateEvent`, `CompleteEvent`, `CompletePumpAmmMigrationEvent`, `SetCreatorEvent`, `CollectCreatorFeeEvent`, `ClaimTokenIncentivesEvent`, `ClaimCashbackEvent`, `ExtendAccountEvent`, volume accumulator events, admin events), PumpAMM (`AmmBuyEvent`, `AmmSellEvent`, `DepositEvent`, `WithdrawEvent`, `CreatePoolEvent`, plus admin/config events), and PumpFees (`CreateFeeSharingConfigEvent`, `UpdateFeeSharesEvent`, `ResetFeeSharingConfigEvent`, `RevokeFeeSharingAuthorityEvent`, `TransferFeeSharingAuthorityEvent`, `SocialFeePdaCreatedEvent`, `SocialFeePdaClaimedEvent`, `DistributeCreatorFeesEvent`, `MinimumDistributableFeeEvent`, plus fee-admin events). See [Events Reference](./events-reference.md) for field-level detail.

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

See the [Error Reference](./errors.md) for causes and fixes.

---

## Related

- [Getting Started](./getting-started.md): first calls, offline and live
- [Architecture](./architecture.md): how the modules fit together
- [Bonding Curve Math](./bonding-curve-math.md) and [Fee Tiers](./fee-tiers.md): the math behind the quotes
- [AMM Trading](./amm-trading.md): graduated pool operations

Runnable examples: all 50 numbered examples under `examples/` exercise this API surface; run any with `npm run example NN`.
