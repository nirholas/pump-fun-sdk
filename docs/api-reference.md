# API Reference

Complete reference for all public classes, functions, types, and constants exported by `@pump-fun/pump-sdk`.

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
| `ONE_BILLION_SUPPLY` | `BN` | `1_000_000_000_000_000` | Standard total token supply (with decimals) |
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
|--------|---------|
| `decodeGlobal(accountInfo)` | `Global` |
| `decodeFeeConfig(accountInfo)` | `FeeConfig` |
| `decodeBondingCurve(accountInfo)` | `BondingCurve` |
| `decodeBondingCurveNullable(accountInfo)` | `BondingCurve \| null` |
| `decodeGlobalVolumeAccumulator(accountInfo)` | `GlobalVolumeAccumulator` |
| `decodeUserVolumeAccumulator(accountInfo)` | `UserVolumeAccumulator` |
| `decodeUserVolumeAccumulatorNullable(accountInfo)` | `UserVolumeAccumulator \| null` |
| `decodeSharingConfig(accountInfo)` | `SharingConfig` |
| `decodeDistributeCreatorFeesEvent(data)` | `DistributeCreatorFeesEvent` |
| `decodeMinimumDistributableFee(data)` | `MinimumDistributableFeeEvent` |

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
  cashback?: PublicKey,   // Optional cashback recipient
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
  cashback?: PublicKey,
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
  tokenProgram?: PublicKey,
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
  tokenProgram?: PublicKey,
  mayhemMode?: boolean,
  cashback?: PublicKey,
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
  pool?: PublicKey,   // Required for graduated tokens
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
  currentShareholders: Shareholder[],
  newShareholders: Shareholder[],
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
| `getGlobalParamsPda()` | `PublicKey` | Global params address |
| `getMayhemStatePda(mint)` | `PublicKey` | Mayhem state for a token |
| `getSolVaultPda()` | `PublicKey` | SOL vault address |
| `getTokenVaultPda(mint)` | `PublicKey` | Token vault address |
| `getEventAuthorityPda(programId)` | `PublicKey` | Event authority for a program |

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

## Error Classes

All errors extend `Error`.

| Error | When Thrown |
|-------|------------|
| `NoShareholdersError` | Empty shareholders array in `updateFeeShares` |
| `TooManyShareholdersError` | More than 10 shareholders |
| `ZeroShareError` | A shareholder has 0 bps |
| `ShareCalculationOverflowError` | Share math overflow |
| `InvalidShareTotalError` | Shares don't sum to 10,000 bps |
| `DuplicateShareholderError` | Duplicate addresses in shareholders |
| `PoolRequiredForGraduatedError` | `createFeeSharingConfig` for graduated token without pool |
