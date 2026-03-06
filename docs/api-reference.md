# API Reference

Complete reference for all public classes, functions, types, and constants exported by `@pump-fun/pump-sdk`.

The SDK exposes **42 instruction builders** across 4 on-chain programs (Pump, PumpAMM, PumpFees, Mayhem), plus decoders, analytics, PDA helpers, and fee math.

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
| `PUMP_SDK` | `PumpSdk` | — | Pre-built offline SDK singleton |
| `BONDING_CURVE_NEW_SIZE` | `number` | `151` | Byte size of new bonding curve accounts |
| `PUMP_TOKEN_MINT` | `PublicKey` | `pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn` | Pump token mint address |
| `MAX_SHAREHOLDERS` | `number` | `10` | Maximum number of fee sharing shareholders |
| `CANONICAL_POOL_INDEX` | `number` | `0` | Default AMM pool index |

### Pre-computed PDAs

| Constant | Description |
|----------|-------------|
| `GLOBAL_PDA` | Global config account |
| `AMM_GLOBAL_PDA` | AMM global config account |
| `PUMP_FEE_CONFIG_PDA` | Fee configuration account |
| `GLOBAL_VOLUME_ACCUMULATOR_PDA` | Pump volume tracker |
| `AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA` | AMM volume tracker |
| `PUMP_EVENT_AUTHORITY_PDA` | Pump event authority |
| `PUMP_AMM_EVENT_AUTHORITY_PDA` | AMM event authority |
| `PUMP_FEE_EVENT_AUTHORITY_PDA` | Fee event authority |

---

## Classes

### `PumpSdk`

Offline instruction builder. Does not require a Solana connection.

A pre-built instance is available as the `PUMP_SDK` export.

#### Account Decoders

These methods decode raw `AccountInfo<Buffer>` data into typed objects.

| Method | Returns |
|--------|---------|-------|
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

Decode Anchor CPI event data from transaction logs.

**Pump Program Events:**

| Method | Returns |
|--------|---------|
| `decodeTradeEvent(data)` | `TradeEvent` |
| `decodeCreateEvent(data)` | `CreateEvent` |
| `decodeCompleteEvent(data)` | `CompleteEvent` |
| `decodeCompletePumpAmmMigrationEvent(data)` | `CompletePumpAmmMigrationEvent` |
| `decodeSetCreatorEvent(data)` | `SetCreatorEvent` |
| `decodeCollectCreatorFeeEvent(data)` | `CollectCreatorFeeEvent` |
| `decodeClaimTokenIncentivesEvent(data)` | `ClaimTokenIncentivesEvent` |
| `decodeClaimCashbackEvent(data)` | `ClaimCashbackEvent` |
| `decodeExtendAccountEvent(data)` | `ExtendAccountEvent` |
| `decodeInitUserVolumeAccumulatorEvent(data)` | `InitUserVolumeAccumulatorEvent` |
| `decodeSyncUserVolumeAccumulatorEvent(data)` | `SyncUserVolumeAccumulatorEvent` |
| `decodeCloseUserVolumeAccumulatorEvent(data)` | `CloseUserVolumeAccumulatorEvent` |
| `decodeAdminSetCreatorEvent(data)` | `AdminSetCreatorEvent` |
| `decodeMigrateBondingCurveCreatorEvent(data)` | `MigrateBondingCurveCreatorEvent` |
| `decodeDistributeCreatorFeesEvent(data)` | `DistributeCreatorFeesEvent` |
| `decodeMinimumDistributableFee(data)` | `MinimumDistributableFeeEvent` |

**PumpAMM Events:**

| Method | Returns |
|--------|---------|
| `decodeAmmBuyEvent(data)` | `AmmBuyEvent` |
| `decodeAmmSellEvent(data)` | `AmmSellEvent` |
| `decodeDepositEvent(data)` | `DepositEvent` |
| `decodeWithdrawEvent(data)` | `WithdrawEvent` |
| `decodeCreatePoolEvent(data)` | `CreatePoolEvent` |

**PumpFees Events:**

| Method | Returns |
|--------|---------|
| `decodeCreateFeeSharingConfigEvent(data)` | `CreateFeeSharingConfigEvent` |
| `decodeUpdateFeeSharesEvent(data)` | `UpdateFeeSharesEvent` |
| `decodeResetFeeSharingConfigEvent(data)` | `ResetFeeSharingConfigEvent` |
| `decodeRevokeFeeSharingAuthorityEvent(data)` | `RevokeFeeSharingAuthorityEvent` |
| `decodeTransferFeeSharingAuthorityEvent(data)` | `TransferFeeSharingAuthorityEvent` |
| `decodeSocialFeePdaCreatedEvent(data)` | `SocialFeePdaCreatedEvent` |
| `decodeSocialFeePdaClaimedEvent(data)` | `SocialFeePdaClaimedEvent` |

#### Token Creation

##### `createV2Instruction(params)`

Creates a new token on the bonding curve.

```typescript
const ix = await sdk.createV2Instruction({
  mint: PublicKey,        // Mint keypair public key
  name: string,           // Token name
  symbol: string,         // Token symbol
  uri: string,            // Metadata URI
  creator: PublicKey,     // Creator wallet
  user: PublicKey,        // Fee payer
  mayhemMode: boolean,    // Enable mayhem mode
  cashback?: boolean,    // Enable cashback (default: false)
});
```

##### `createV2AndBuyInstructions(params)`

Creates a token and immediately buys in a single transaction.

```typescript
const ixs = await sdk.createV2AndBuyInstructions({
  global: Global,         // Global state
  mint: PublicKey,
  name: string,
  symbol: string,
  uri: string,
  creator: PublicKey,
  user: PublicKey,
  amount: BN,             // Token amount to buy
  solAmount: BN,          // SOL to spend (lamports)
  mayhemMode: boolean,
  cashback?: boolean,         // Enable cashback (default: false)
});
```

##### `createInstruction(params)` *(deprecated)*

Use `createV2Instruction` instead.

##### `createAndBuyInstructions(params)` *(deprecated)*

Use `createV2AndBuyInstructions` instead.

#### Buy / Sell

##### `buyInstructions(params)`

Builds instructions to buy tokens from a bonding curve.

```typescript
const ixs = await sdk.buyInstructions({
  global: Global,
  bondingCurveAccountInfo: AccountInfo<Buffer>,
  bondingCurve: BondingCurve,
  associatedUserAccountInfo: AccountInfo<Buffer> | null,
  mint: PublicKey,
  user: PublicKey,
  amount: BN,             // Token amount to receive
  solAmount: BN,          // Max SOL to spend (lamports)
  slippage: number,       // Slippage tolerance (e.g. 1 = 1%)
  tokenProgram: PublicKey, // Default: TOKEN_PROGRAM_ID
});
```

Automatically includes:
- Account extension instruction if needed
- ATA creation if the user doesn't have one

##### `sellInstructions(params)`

Builds instructions to sell tokens back to the bonding curve.

```typescript
const ixs = await sdk.sellInstructions({
  global: Global,
  bondingCurveAccountInfo: AccountInfo<Buffer>,
  bondingCurve: BondingCurve,
  mint: PublicKey,
  user: PublicKey,
  amount: BN,             // Token amount to sell
  solAmount: BN,          // Min SOL to receive (lamports)
  slippage: number,
  tokenProgram: PublicKey,  // Default: TOKEN_PROGRAM_ID
  mayhemMode: boolean,     // Default: false
  cashback?: boolean,      // Enable cashback (default: false)
});
```

##### `getBuyInstructionRaw(params)` / `getSellInstructionRaw(params)`

Low-level variants that build a single instruction without ATA management or account extension.

#### Migration

##### `migrateInstruction(params)`

Migrates a graduated token from the bonding curve to an AMM pool.

```typescript
const ix = await sdk.migrateInstruction({
  withdrawAuthority: PublicKey,
  mint: PublicKey,
  user: PublicKey,
  tokenProgram?: PublicKey,
});
```

#### Account Management

##### `extendAccountInstruction(params)`

Extends a bonding curve account to the new size (`BONDING_CURVE_NEW_SIZE`).

```typescript
const ix = await sdk.extendAccountInstruction({
  account: PublicKey,
  user: PublicKey,
});
```

##### `setCreator(params)`

Sets the creator for a token mint.

```typescript
const ix = await sdk.setCreator({
  mint: PublicKey,
  setCreatorAuthority: PublicKey,
  creator: PublicKey,
});
```

#### Volume Accumulators

##### `initUserVolumeAccumulator(params)`

```typescript
const ix = await sdk.initUserVolumeAccumulator({ payer: PublicKey, user: PublicKey });
```

##### `syncUserVolumeAccumulator(user)`

```typescript
const ix = await sdk.syncUserVolumeAccumulator(user: PublicKey);
```

##### `closeUserVolumeAccumulator(user)`

```typescript
const ix = await sdk.closeUserVolumeAccumulator(user: PublicKey);
```

#### Fee Sharing

##### `createFeeSharingConfig(params)`

Creates a fee sharing configuration for a token.

```typescript
const ix = await sdk.createFeeSharingConfig({
  creator: PublicKey,
  mint: PublicKey,
  pool: PublicKey | null,  // null for bonding curve tokens, required for graduated tokens
});
```

##### `updateFeeShares(params)`

Updates the shareholder distribution. Validates:
- Maximum 10 shareholders
- Share total equals 10,000 bps (100%)
- No duplicate addresses
- No zero shares

```typescript
const ix = await sdk.updateFeeShares({
  authority: PublicKey,
  mint: PublicKey,
  currentShareholders: PublicKey[],  // Public keys of current shareholders
  newShareholders: Shareholder[],     // New shareholders with share allocations
});
```

##### `distributeCreatorFees(params)`

Distributes accumulated fees to shareholders.

```typescript
const ix = await sdk.distributeCreatorFees({
  mint: PublicKey,
  sharingConfig: SharingConfig,
  sharingConfigAddress: PublicKey,
});
```

##### `getMinimumDistributableFee(params)`

Returns the minimum distributable fee (as a simulation instruction).

```typescript
const ix = await sdk.getMinimumDistributableFee({
  mint: PublicKey,
  sharingConfig: SharingConfig,
  sharingConfigAddress: PublicKey,
});
```

#### Cashback

##### `claimCashbackInstruction(params)`

```typescript
const ix = await sdk.claimCashbackInstruction({ user: PublicKey });
```

##### `ammClaimCashbackInstruction(params)`

Claim cashback from AMM trading.

```typescript
const ix = await sdk.ammClaimCashbackInstruction({ user: PublicKey });
```

#### Buy Exact SOL In

##### `buyExactSolInInstruction(params)`

Buy tokens by specifying the exact SOL amount to spend. More intuitive for users who think in SOL terms.

```typescript
const ix = await sdk.buyExactSolInInstruction({
  user: PublicKey,
  mint: PublicKey,
  creator: PublicKey,
  feeRecipient: PublicKey,
  solAmount: BN,          // Exact SOL to spend (lamports)
  minTokenAmount: BN,     // Minimum tokens to receive (slippage)
  tokenProgram?: PublicKey,
});
```

#### AMM Instructions

Instructions for trading on graduated AMM pools (PumpAMM program).

##### `ammBuyInstruction(params)`

Buy tokens on a graduated AMM pool.

```typescript
const ix = await sdk.ammBuyInstruction({
  user: PublicKey,
  pool: PublicKey,
  mint: PublicKey,
  baseAmountOut: BN,      // Tokens to receive
  maxQuoteAmountIn: BN,   // Max SOL to spend
});
```

##### `ammBuyExactQuoteInInstruction(params)`

Buy by specifying exact SOL (quote) input on AMM.

```typescript
const ix = await sdk.ammBuyExactQuoteInInstruction({
  user: PublicKey,
  pool: PublicKey,
  mint: PublicKey,
  quoteAmountIn: BN,       // Exact SOL to spend
  minBaseAmountOut: BN,    // Min tokens to receive
});
```

##### `ammSellInstruction(params)`

Sell tokens on a graduated AMM pool.

```typescript
const ix = await sdk.ammSellInstruction({
  user: PublicKey,
  pool: PublicKey,
  mint: PublicKey,
  baseAmountIn: BN,        // Tokens to sell
  minQuoteAmountOut: BN,   // Min SOL to receive
});
```

##### `ammDepositInstruction(params)`

Deposit liquidity into an AMM pool (LP provision).

```typescript
const ix = await sdk.ammDepositInstruction({
  user: PublicKey,
  pool: PublicKey,
  mint: PublicKey,
  maxBaseAmountIn: BN,     // Max tokens to deposit
  maxQuoteAmountIn: BN,    // Max SOL to deposit
  minLpTokenAmountOut: BN, // Min LP tokens to receive
});
```

##### `ammWithdrawInstruction(params)`

Withdraw liquidity from an AMM pool.

```typescript
const ix = await sdk.ammWithdrawInstruction({
  user: PublicKey,
  pool: PublicKey,
  mint: PublicKey,
  lpTokenAmountIn: BN,    // LP tokens to burn
  minBaseAmountOut: BN,    // Min tokens to receive
  minQuoteAmountOut: BN,   // Min SOL to receive
});
```

##### `ammMigratePoolCoinCreatorInstruction(params)`

Migrate AMM pool creator based on fee sharing config.

```typescript
const ix = await sdk.ammMigratePoolCoinCreatorInstruction({
  pool: PublicKey,
  mint: PublicKey,
});
```

##### `ammTransferCreatorFeesToPumpInstruction(params)`

Transfer creator fees from AMM pool to the Pump program vault.

```typescript
const ix = await sdk.ammTransferCreatorFeesToPumpInstruction({
  coinCreator: PublicKey,
});
```

##### `ammCollectCoinCreatorFeeInstruction(params)`

Collect creator fees from an AMM pool.

```typescript
const ix = await sdk.ammCollectCoinCreatorFeeInstruction({
  creator: PublicKey,
});
```

##### `ammSetCoinCreatorInstruction(params)`

Set the coin creator for an AMM pool from bonding curve metadata.

```typescript
const ix = await sdk.ammSetCoinCreatorInstruction({
  pool: PublicKey,
  mint: PublicKey,
});
```

##### `ammSyncUserVolumeAccumulatorInstruction(user)`

Sync user volume accumulator on the AMM program.

```typescript
const ix = await sdk.ammSyncUserVolumeAccumulatorInstruction(user: PublicKey);
```

#### Mayhem & Admin

##### `setMayhemVirtualParamsInstruction(params)`

Set virtual parameters for mayhem mode on a bonding curve.

```typescript
const ix = await sdk.setMayhemVirtualParamsInstruction({ mint: PublicKey });
```

##### `toggleMayhemModeInstruction(params)`

Toggle mayhem mode on/off for the protocol.

```typescript
const ix = await sdk.toggleMayhemModeInstruction({
  authority: PublicKey,
  enabled: boolean,
});
```

##### `toggleCashbackEnabledInstruction(params)`

Toggle the cashback feature on/off.

```typescript
const ix = await sdk.toggleCashbackEnabledInstruction({
  authority: PublicKey,
  enabled: boolean,
});
```

##### `toggleCreateV2Instruction(params)`

Toggle the createV2 instruction on/off.

```typescript
const ix = await sdk.toggleCreateV2Instruction({
  authority: PublicKey,
  enabled: boolean,
});
```

##### `updateGlobalAuthorityInstruction(params)`

Update the global authority address.

```typescript
const ix = await sdk.updateGlobalAuthorityInstruction({
  authority: PublicKey,
  newAuthority: PublicKey,
});
```

##### `setReservedFeeRecipientsInstruction(params)`

Set reserved fee recipients for the protocol.

```typescript
const ix = await sdk.setReservedFeeRecipientsInstruction({
  authority: PublicKey,
  whitelistPda: PublicKey,
});
```

#### Creator Management

##### `migrateBondingCurveCreatorInstruction(params)`

Migrate bonding curve creator based on fee sharing config.

```typescript
const ix = await sdk.migrateBondingCurveCreatorInstruction({ mint: PublicKey });
```

##### `setMetaplexCreatorInstruction(params)`

Set the Metaplex creator metadata from the bonding curve.

```typescript
const ix = await sdk.setMetaplexCreatorInstruction({ mint: PublicKey });
```

#### Social Fee PDAs

##### `createSocialFeePdaInstruction(params)`

Create a social fee PDA for referral/social fee sharing.

```typescript
const ix = await sdk.createSocialFeePdaInstruction({
  payer: PublicKey,
  userId: string,
  platform: number,
});
```

##### `claimSocialFeePdaInstruction(params)`

Claim accumulated social/referral fees.

```typescript
const ix = await sdk.claimSocialFeePdaInstruction({
  recipient: PublicKey,
  socialClaimAuthority: PublicKey,
  userId: string,
  platform: number,
});
```

#### Fee Sharing Authority

##### `resetFeeSharingConfigInstruction(params)`

Reset a fee sharing configuration to a new admin.

```typescript
const ix = await sdk.resetFeeSharingConfigInstruction({
  authority: PublicKey,
  mint: PublicKey,
  newAdmin: PublicKey,
});
```

##### `transferFeeSharingAuthorityInstruction(params)`

Transfer fee sharing authority to a new address.

```typescript
const ix = await sdk.transferFeeSharingAuthorityInstruction({
  authority: PublicKey,
  mint: PublicKey,
  newAdmin: PublicKey,
});
```

##### `revokeFeeSharingAuthorityInstruction(params)`

Permanently revoke fee sharing authority. After this, no one can modify the configuration.

```typescript
const ix = await sdk.revokeFeeSharingAuthorityInstruction({
  authority: PublicKey,
  mint: PublicKey,
});
```

#### Fee Admin

##### `setClaimRateLimitInstruction(params)`

Set the claim rate limit for anti-abuse throttling.

```typescript
const ix = await sdk.setClaimRateLimitInstruction({
  authority: PublicKey,
  claimRateLimit: BN,
});
```

##### `setSocialClaimAuthorityInstruction(params)`

Set the social claim authority.

```typescript
const ix = await sdk.setSocialClaimAuthorityInstruction({
  authority: PublicKey,
  socialClaimAuthority: PublicKey,
});
```

##### `upsertFeeTiersInstruction(params)`

Upsert (create or update) fee tiers for the protocol.

```typescript
const ix = await sdk.upsertFeeTiersInstruction({
  admin: PublicKey,
  feeTiers: Array<{
    marketCapLamportsThreshold: BN;
    fees: { lpFeeBps: BN; protocolFeeBps: BN; creatorFeeBps: BN };
  }>,
  offset?: number,  // default: 0
});
```

---

### `OnlinePumpSdk`

Online SDK that extends `PumpSdk` capabilities with on-chain data fetching.

```typescript
const sdk = new OnlinePumpSdk(connection: Connection);
```

#### State Fetchers

| Method | Returns | Description |
|--------|---------|-------------|
| `fetchGlobal()` | `Global` | Global configuration |
| `fetchFeeConfig()` | `FeeConfig` | Fee tier configuration |
| `fetchBondingCurve(mint)` | `BondingCurve` | Bonding curve state for a token |
| `fetchBuyState(mint, user)` | `{ bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo }` | All state needed for a buy |
| `fetchSellState(mint, user)` | `{ bondingCurveAccountInfo, bondingCurve }` | All state needed for a sell |
| `fetchGlobalVolumeAccumulator()` | `GlobalVolumeAccumulator` | Global volume tracking data |
| `fetchUserVolumeAccumulator(user)` | `UserVolumeAccumulator \| null` | User's volume data (null if not initialized) |
| `fetchUserVolumeAccumulatorTotalStats(user)` | `UserVolumeAccumulatorTotalStats` | Combined pump + AMM volume stats |

#### Creator Fees

| Method | Returns | Description |
|--------|---------|-------------|
| `collectCoinCreatorFeeInstructions(creator, feePayer?)` | `TransactionInstruction[]` | Collect from both programs |
| `adminSetCoinCreatorInstructions(newCreator, mint)` | `TransactionInstruction[]` | Admin: reassign creator |
| `getCreatorVaultBalance(creator)` | `BN` | Balance in pump vault only |
| `getCreatorVaultBalanceBothPrograms(creator)` | `BN` | Combined pump + AMM balance |

#### Token Incentives

| Method | Returns | Description |
|--------|---------|-------------|
| `claimTokenIncentives(user, payer)` | `TransactionInstruction[]` | Claim from pump program |
| `claimTokenIncentivesBothPrograms(user, payer)` | `TransactionInstruction[]` | Claim from both programs |
| `getTotalUnclaimedTokens(user)` | `BN` | Unclaimed pump rewards |
| `getTotalUnclaimedTokensBothPrograms(user)` | `BN` | Combined unclaimed rewards |
| `getCurrentDayTokens(user)` | `BN` | Current day's pump rewards |
| `getCurrentDayTokensBothPrograms(user)` | `BN` | Combined current day rewards |
| `adminUpdateTokenIncentives(...)` | `TransactionInstruction` | Admin: configure incentives |
| `adminUpdateTokenIncentivesBothPrograms(...)` | `TransactionInstruction[]` | Admin: configure both programs |

#### Fee Sharing

##### `getMinimumDistributableFee(mint, simulationSigner?)`

Checks how much fee can be distributed for a token. Handles graduated tokens automatically.

```typescript
const result = await sdk.getMinimumDistributableFee(mint);
// result: {
//   minimumRequired: BN,
//   distributableFees: BN,
//   canDistribute: boolean,
//   isGraduated: boolean,
// }
```

##### `buildDistributeCreatorFeesInstructions(mint)`

Builds instructions to distribute fees. For graduated tokens, automatically includes the AMM fee consolidation step.

```typescript
const { instructions, isGraduated } =
  await sdk.buildDistributeCreatorFeesInstructions(mint);
```

#### Sync

##### `syncUserVolumeAccumulatorBothPrograms(user)`

Syncs volume accumulators across both programs.

```typescript
const ixs = await sdk.syncUserVolumeAccumulatorBothPrograms(user);
```

#### Analytics Fetchers

These methods combine RPC fetching with the offline analytics functions from `analytics.ts`.

##### `fetchBondingCurveSummary(mint)`

Fetch bonding curve state, global, and fee config, then return a full summary including market cap, graduation progress, and token price.

```typescript
const summary = await sdk.fetchBondingCurveSummary(mint);
// Returns: BondingCurveSummary
// { marketCap, progressBps, isGraduated, buyPricePerToken, sellPricePerToken,
//   realSolReserves, realTokenReserves, virtualSolReserves, virtualTokenReserves }
```

##### `fetchGraduationProgress(mint)`

Fetch how close a token is to graduating from the bonding curve to an AMM pool.

```typescript
const progress = await sdk.fetchGraduationProgress(mint);
// Returns: GraduationProgress
// { progressBps, isGraduated, tokensRemaining, tokensTotal, solAccumulated }
```

##### `fetchTokenPrice(mint)`

Fetch current buy and sell price per whole token (10^6 raw units).

```typescript
const price = await sdk.fetchTokenPrice(mint);
// Returns: TokenPriceInfo
// { buyPricePerToken, sellPricePerToken, marketCap, isGraduated }
```

##### `fetchBuyPriceImpact(mint, solAmount)`

Calculate the price impact of a buy trade on a specific token.

```typescript
const impact = await sdk.fetchBuyPriceImpact(mint, new BN(1e9));
// Returns: PriceImpactResult
// { priceBefore, priceAfter, impactBps, outputAmount }
```

##### `fetchSellPriceImpact(mint, tokenAmount)`

Calculate the price impact of a sell trade on a specific token.

```typescript
const impact = await sdk.fetchSellPriceImpact(mint, new BN(1_000_000));
// Returns: PriceImpactResult
// { priceBefore, priceAfter, impactBps, outputAmount }
```

#### Sell All

##### `sellAllInstructions(params)`

Build instructions to sell a user's entire token balance and close the ATA to reclaim rent. Returns an empty array if the user has no balance.

```typescript
const ixs = await sdk.sellAllInstructions({
  mint: PublicKey,
  user: PublicKey,
  slippage?: number,        // Default: 1%
  tokenProgram?: PublicKey,  // Default: TOKEN_PROGRAM_ID
});
// Returns: TransactionInstruction[]
```

If the balance is zero, returns only a close-account instruction to reclaim rent.

#### Graduation & Balance

##### `isGraduated(mint)`

Check if a token has graduated to the AMM by checking if its canonical pool account exists on-chain.

```typescript
const graduated = await sdk.isGraduated(mint);
// Returns: boolean
```

##### `getTokenBalance(mint, user, tokenProgram?)`

Get a user's token balance for a specific mint.

```typescript
const balance = await sdk.getTokenBalance(mint, user);
// Returns: BN (raw units, or BN(0) if no account exists)
```

#### AMM / Fee Program Fetchers

##### `fetchPool(mint)`

Fetch a graduated AMM pool account by mint address.

```typescript
const pool = await sdk.fetchPool(mint);
// Returns: Pool
```

##### `fetchPoolByAddress(poolAddress)`

Fetch a graduated AMM pool account by pool address.

```typescript
const pool = await sdk.fetchPoolByAddress(poolAddress);
// Returns: Pool
```

##### `fetchAmmGlobalConfig()`

Fetch the AMM global config account.

```typescript
const config = await sdk.fetchAmmGlobalConfig();
// Returns: AmmGlobalConfig
```

##### `fetchFeeProgramGlobal()`

Fetch the PumpFees program global account.

```typescript
const global = await sdk.fetchFeeProgramGlobal();
// Returns: FeeProgramGlobal
```

##### `fetchSocialFeePda(userId, platform)`

Fetch a social fee PDA account by user ID and platform.

```typescript
const socialFee = await sdk.fetchSocialFeePda("user123", 1);
// Returns: SocialFeePda
```

---

## Functions

### Bonding Curve Math

#### `getBuyTokenAmountFromSolAmount(params)`

Calculate how many tokens you receive for a given SOL amount.

```typescript
import { getBuyTokenAmountFromSolAmount } from "@pump-fun/pump-sdk";

const tokens = getBuyTokenAmountFromSolAmount({
  global: Global,
  feeConfig: FeeConfig | null,
  mintSupply: BN | null,
  bondingCurve: BondingCurve | null,  // null for new tokens
  amount: BN,                          // SOL in lamports
});
```

#### `getBuySolAmountFromTokenAmount(params)`

Calculate how much SOL is needed to buy a given token amount.

```typescript
const sol = getBuySolAmountFromTokenAmount({
  global: Global,
  feeConfig: FeeConfig | null,
  mintSupply: BN | null,
  bondingCurve: BondingCurve | null,
  amount: BN,                          // Token amount
});
```

#### `getSellSolAmountFromTokenAmount(params)`

Calculate how much SOL you receive for selling a given token amount.

```typescript
const sol = getSellSolAmountFromTokenAmount({
  global: Global,
  feeConfig: FeeConfig | null,
  mintSupply: BN,
  bondingCurve: BondingCurve,
  amount: BN,                          // Token amount to sell
});
```

#### `bondingCurveMarketCap(params)`

Calculate the current market cap of a token.

```typescript
const marketCap = bondingCurveMarketCap({
  mintSupply: BN,
  virtualSolReserves: BN,
  virtualTokenReserves: BN,
});
```

#### `newBondingCurve(global)`

Creates a fresh bonding curve state from global configuration.

```typescript
const curve = newBondingCurve(global: Global);
// Returns:
// {
//   virtualTokenReserves, virtualSolReserves,
//   realTokenReserves, realSolReserves: BN(0),
//   tokenTotalSupply, complete: false,
//   creator: PublicKey.default,
//   isMayhemMode: global.mayhemModeEnabled,
// }
```

### Token Incentives

#### `totalUnclaimedTokens(globalVolume, userVolume, timestamp?)`

Compute total unclaimed token incentive rewards.

```typescript
import { totalUnclaimedTokens } from "@pump-fun/pump-sdk";

const unclaimed = totalUnclaimedTokens(
  globalVolumeAccumulator,
  userVolumeAccumulator,
  Math.floor(Date.now() / 1000), // optional
);
```

#### `currentDayTokens(globalVolume, userVolume, timestamp?)`

Compute token rewards accrued for the current day.

```typescript
const todayRewards = currentDayTokens(
  globalVolumeAccumulator,
  userVolumeAccumulator,
);
```

### PDA Helpers

| Function | Returns | Description |
|----------|---------|-------------|
| `bondingCurvePda(mint)` | `PublicKey` | Bonding curve account address |
| `creatorVaultPda(creator)` | `PublicKey` | Creator fee vault (pump) |
| `ammCreatorVaultPda(creator)` | `PublicKey` | Creator fee vault (AMM) |
| `canonicalPumpPoolPda(mint)` | `PublicKey` | AMM pool for graduated token |
| `pumpPoolAuthorityPda(mint)` | `PublicKey` | Pool authority |
| `feeSharingConfigPda(mint)` | `PublicKey` | Fee sharing config address |
| `userVolumeAccumulatorPda(user)` | `PublicKey` | User volume tracker |
| `ammUserVolumeAccumulatorPda(user)` | `PublicKey` | AMM user volume tracker |
| `feeProgramGlobalPda()` | `PublicKey` | PumpFees global state |
| `socialFeePda(userId, platform)` | `PublicKey` | Social fee PDA |
| `getGlobalParamsPda()` | `PublicKey` | Global params address |
| `getMayhemStatePda(mint)` | `PublicKey` | Mayhem state for a token |
| `getSolVaultPda()` | `PublicKey` | SOL vault address |
| `getTokenVaultPda(mint)` | `PublicKey` | Token vault address |
| `getEventAuthorityPda(programId)` | `PublicKey` | Event authority for a program |

**Constants:**

| Constant | Type | Description |
|----------|------|-------------|
| `GLOBAL_PDA` | `PublicKey` | Pump global state PDA |
| `AMM_GLOBAL_PDA` | `PublicKey` | AMM global state PDA |
| `AMM_GLOBAL_CONFIG_PDA` | `PublicKey` | AMM global config PDA |
| `AMM_FEE_CONFIG_PDA` | `PublicKey` | AMM fee config PDA |
| `PUMP_FEE_CONFIG_PDA` | `PublicKey` | Pump fee config PDA |
| `GLOBAL_VOLUME_ACCUMULATOR_PDA` | `PublicKey` | Global volume accumulator PDA |

### Fee Functions

#### `getFee(params)`

Calculates the total fee (protocol + creator) for a given trade amount.

```typescript
import { getFee } from "@pump-fun/pump-sdk";

const fee = getFee({
  global: Global,
  feeConfig: FeeConfig | null,
  mintSupply: BN,
  bondingCurve: BondingCurve,
  amount: BN,
  isNewBondingCurve: boolean,
});
```

#### `computeFeesBps(params)`

Compute the protocol and creator fee rates in basis points. Uses tiered fees when available, otherwise falls back to global defaults.

```typescript
import { computeFeesBps } from "@pump-fun/pump-sdk";

const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
  global: Global,
  feeConfig: FeeConfig | null,
  mintSupply: BN,
  virtualSolReserves: BN,
  virtualTokenReserves: BN,
});
```

#### `calculateFeeTier(params)`

Select the appropriate fee tier based on market cap. Returns the full `Fees` object.

```typescript
import { calculateFeeTier } from "@pump-fun/pump-sdk";

const fees: Fees = calculateFeeTier({
  feeTiers: FeeTier[],
  marketCap: BN,
});
```

### Program Constructors

| Function | Returns | Description |
|----------|---------|-------------|
| `getPumpProgram(connection)` | `Program<Pump>` | Anchor program instance |
| `getPumpAmmProgram(connection)` | `Program<PumpAmm>` | AMM program instance |
| `getPumpFeeProgram(connection)` | `Program<PumpFees>` | Fee program instance |

### Utilities

#### `isCreatorUsingSharingConfig(params)`

Check if a creator has set up fee sharing for a token.

```typescript
const isSharing = isCreatorUsingSharingConfig({
  mint: PublicKey,
  creator: PublicKey,
});
```

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
  shareBps: number;          // Basis points (sum must = 10000)
}

interface SharingConfig {
  version: number;
  mint: PublicKey;
  admin: PublicKey;
  adminRevoked: boolean;
  shareholders: Shareholder[];
}
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

### Events

```typescript
interface DistributeCreatorFeesEvent {
  timestamp: BN;
  mint: PublicKey;
  sharingConfig: PublicKey;
  admin: PublicKey;
  shareholders: Shareholder[];
  distributed: BN;
}

interface MinimumDistributableFeeEvent {
  minimumRequired: BN;
  distributableFees: BN;
  canDistribute: boolean;
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
```

---

## Analytics Functions

Pure offline functions for price analysis. Imported from `analytics.ts`.

### `calculateBuyPriceImpact(params)`

Calculate the price impact of a buy trade.

| Parameter | Type | Description |
|-----------|------|-------------|
| `params.global` | `Global` | Pump global state |
| `params.feeConfig` | `FeeConfig \| null` | Fee config (null for legacy flat fees) |
| `params.mintSupply` | `BN` | Current mint supply |
| `params.bondingCurve` | `BondingCurve` | Current bonding curve state |
| `params.solAmount` | `BN` | SOL amount to spend (lamports) |

**Returns:** `PriceImpactResult`

### `calculateSellPriceImpact(params)`

Calculate the price impact of a sell trade.

| Parameter | Type | Description |
|-----------|------|-------------|
| `params.global` | `Global` | Pump global state |
| `params.feeConfig` | `FeeConfig \| null` | Fee config (null for legacy flat fees) |
| `params.mintSupply` | `BN` | Current mint supply |
| `params.bondingCurve` | `BondingCurve` | Current bonding curve state |
| `params.tokenAmount` | `BN` | Token amount to sell |

**Returns:** `PriceImpactResult`

### `getGraduationProgress(global, bondingCurve)`

Calculate how close a token is to graduating from the bonding curve to an AMM pool.

| Parameter | Type | Description |
|-----------|------|-------------|
| `global` | `Global` | Pump global state |
| `bondingCurve` | `BondingCurve` | Current bonding curve state |

**Returns:** `GraduationProgress`

### `getTokenPrice(params)`

Get the current buy and sell price per whole token (10^6 raw units).

| Parameter | Type | Description |
|-----------|------|-------------|
| `params.global` | `Global` | Pump global state |
| `params.feeConfig` | `FeeConfig \| null` | Fee config |
| `params.mintSupply` | `BN` | Current mint supply |
| `params.bondingCurve` | `BondingCurve` | Current bonding curve state |

**Returns:** `TokenPriceInfo`

### `getBondingCurveSummary(params)`

Get a comprehensive summary of a bonding curve's state in a single call.

| Parameter | Type | Description |
|-----------|------|-------------|
| `params.global` | `Global` | Pump global state |
| `params.feeConfig` | `FeeConfig \| null` | Fee config |
| `params.mintSupply` | `BN` | Current mint supply |
| `params.bondingCurve` | `BondingCurve` | Current bonding curve state |

**Returns:** `BondingCurveSummary`

### Analytics Types

```typescript
interface PriceImpactResult {
  priceBefore: BN;          // Price per token BEFORE the trade (lamports)
  priceAfter: BN;           // Price per token AFTER the trade (lamports)
  impactBps: number;        // Price impact in basis points (150 = 1.5%)
  outputAmount: BN;         // Tokens received (buy) or SOL received (sell)
}

interface GraduationProgress {
  progressBps: number;      // Percentage complete (0–10000 bps)
  isGraduated: boolean;     // Whether already graduated
  tokensRemaining: BN;      // Tokens left before graduation
  tokensTotal: BN;          // Total real tokens the curve started with
  solAccumulated: BN;       // SOL in real reserves
}

interface TokenPriceInfo {
  buyPricePerToken: BN;     // Cost to buy 1 whole token (lamports)
  sellPricePerToken: BN;    // SOL received for selling 1 whole token (lamports)
  marketCap: BN;            // Current market cap (lamports)
  isGraduated: boolean;     // Whether the curve is complete
}

interface BondingCurveSummary {
  marketCap: BN;            // Market cap (lamports)
  progressBps: number;      // Graduation progress (0–10000 bps)
  isGraduated: boolean;
  buyPricePerToken: BN;
  sellPricePerToken: BN;
  realSolReserves: BN;
  realTokenReserves: BN;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
}
```

---

### AMM & Fee Program Types

#### `Pool`

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
```

#### `AmmGlobalConfig`

```typescript
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
```

#### `FeeProgramGlobal`

```typescript
interface FeeProgramGlobal {
  bump: number;
  authority: PublicKey;
  disableFlags: number;
  socialClaimAuthority: PublicKey;
  claimRateLimit: BN;
}
```

#### `SocialFeePda`

```typescript
interface SocialFeePda {
  bump: number;
  version: number;
  userId: string;
  platform: number;
  totalClaimed: BN;
  lastClaimed: BN;
}
```

### Social Fee Events

```typescript
interface SocialFeePdaCreatedEvent {
  timestamp: BN;
  userId: string;
  platform: number;
  socialFeePda: PublicKey;
  createdBy: PublicKey;
}

interface SocialFeePdaClaimedEvent {
  timestamp: BN;
  userId: string;
  platform: number;
  socialFeePda: PublicKey;
  recipient: PublicKey;
  socialClaimAuthority: PublicKey;
  amountClaimed: BN;
  claimableBefore: BN;
  lifetimeClaimed: BN;
  recipientBalanceBefore: BN;
  recipientBalanceAfter: BN;
}
```

---

## Error Classes

All errors extend `Error`.

| Error | When Thrown |
|-------|------------|
| `NoShareholdersError` | Empty shareholders array in `updateFeeShares` |
| `TooManyShareholdersError` | More than 10 shareholders |
| `ZeroShareError` | A shareholder has 0 bps |
| `InvalidShareTotalError` | Shares don't sum to 10,000 bps |
| `DuplicateShareholderError` | Duplicate addresses in shareholders |
| `ShareCalculationOverflowError` | Share amount calculation would overflow |
| `PoolRequiredForGraduatedError` | Pool param missing for graduated coin |

