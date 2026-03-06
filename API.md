# API Reference

> Complete API documentation for `@pump-fun/pump-sdk` v1.30.0.

---

## 📋 Table of Contents

- [Classes](#classes)
  - [PumpSdk (Offline)](#pumpsdk)
  - [OnlinePumpSdk (With RPC)](#onlinepumpsdk)
- [Bonding Curve Functions](#bonding-curve-functions)
- [Fee Functions](#fee-functions)
- [Analytics Functions](#analytics-functions)
- [Token Incentive Functions](#token-incentive-functions)
- [PDA Functions](#pda-functions)
- [Error Types](#error-types)
- [Interfaces & Types](#interfaces--types)
  - [Account State](#account-state)
  - [Event Types](#event-types)
  - [Enums](#enums)
- [Constants](#constants)

---

## Classes

### PumpSdk

Offline instruction builder. Builds `TransactionInstruction[]` without an RPC connection.

**Import**:

```typescript
import { PumpSdk, PUMP_SDK } from "@pump-fun/pump-sdk";
```

> **Tip**: Use the `PUMP_SDK` singleton for most cases — `PumpSdk` is stateless.

---

#### `createV2Instruction`

Create a new token on the bonding curve.

```typescript
async createV2Instruction(params: {
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  creator: PublicKey;
  user: PublicKey;
  mayhemMode: boolean;
  cashback?: boolean;
}): Promise<TransactionInstruction>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mint` | `PublicKey` | Yes | Keypair public key for the new token mint |
| `name` | `string` | Yes | Token name |
| `symbol` | `string` | Yes | Token symbol |
| `uri` | `string` | Yes | Metadata URI (Arweave/IPFS) |
| `creator` | `PublicKey` | Yes | Token creator address (receives creator fees) |
| `user` | `PublicKey` | Yes | Transaction payer |
| `mayhemMode` | `boolean` | Yes | Enable randomized bonding curve parameters |
| `cashback` | `boolean` | No | Enable cashback fee rebates |

**Returns**: `TransactionInstruction`

**Example**:

```typescript
import { Keypair } from "@solana/web3.js";
import { PUMP_SDK } from "@pump-fun/pump-sdk";

const mint = Keypair.generate();
const ix = await PUMP_SDK.createV2Instruction({
  mint: mint.publicKey,
  name: "My Token",
  symbol: "MYTKN",
  uri: "https://arweave.net/metadata.json",
  creator: wallet.publicKey,
  user: wallet.publicKey,
  mayhemMode: false,
});
```

> **Warning**: `createInstruction` (v1) is deprecated. Always use `createV2Instruction`.

---

#### `buyInstructions`

Buy tokens on the bonding curve with slippage protection.

```typescript
async buyInstructions(params: {
  global: Global;
  bondingCurveAccountInfo: AccountInfo<Buffer>;
  bondingCurve: BondingCurve;
  associatedUserAccountInfo: AccountInfo<Buffer> | null;
  mint: PublicKey;
  user: PublicKey;
  amount: BN;
  solAmount: BN;
  slippage: number;
  tokenProgram?: PublicKey;
}): Promise<TransactionInstruction[]>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `global` | `Global` | Yes | Protocol global state |
| `bondingCurveAccountInfo` | `AccountInfo<Buffer>` | Yes | Raw bonding curve account |
| `bondingCurve` | `BondingCurve` | Yes | Decoded bonding curve state |
| `associatedUserAccountInfo` | `AccountInfo<Buffer> \| null` | Yes | User's ATA info (null if doesn't exist) |
| `mint` | `PublicKey` | Yes | Token mint address |
| `user` | `PublicKey` | Yes | Buyer's wallet address |
| `amount` | `BN` | Yes | Token amount to buy (set to 0 when using solAmount) |
| `solAmount` | `BN` | Yes | SOL amount in lamports |
| `slippage` | `number` | Yes | Slippage tolerance (decimal, e.g., 0.05 = 5%) |
| `tokenProgram` | `PublicKey` | No | Token program ID (defaults to SPL Token) |

**Returns**: `TransactionInstruction[]` — May include ATA creation instruction.

**Example**:

```typescript
const buyState = await sdk.fetchBuyState(mint, user);
const ixs = await sdk.buyInstructions({
  ...buyState,
  mint,
  user,
  amount: new BN(0),
  solAmount: new BN(100_000_000), // 0.1 SOL
  slippage: 0.05,
});
```

---

#### `sellInstructions`

Sell tokens on the bonding curve with slippage protection.

```typescript
async sellInstructions(params: {
  global: Global;
  bondingCurveAccountInfo: AccountInfo<Buffer>;
  bondingCurve: BondingCurve;
  mint: PublicKey;
  user: PublicKey;
  amount: BN;
  solAmount: BN;
  slippage: number;
  tokenProgram?: PublicKey;
  mayhemMode?: boolean;
  cashback?: boolean;
}): Promise<TransactionInstruction[]>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `global` | `Global` | Yes | Protocol global state |
| `bondingCurveAccountInfo` | `AccountInfo<Buffer>` | Yes | Raw bonding curve account |
| `bondingCurve` | `BondingCurve` | Yes | Decoded bonding curve state |
| `mint` | `PublicKey` | Yes | Token mint address |
| `user` | `PublicKey` | Yes | Seller's wallet address |
| `amount` | `BN` | Yes | Token amount to sell |
| `solAmount` | `BN` | Yes | Expected SOL output in lamports |
| `slippage` | `number` | Yes | Slippage tolerance (decimal) |
| `tokenProgram` | `PublicKey` | No | Token program ID |
| `mayhemMode` | `boolean` | No | Whether this is a mayhem mode token |
| `cashback` | `boolean` | No | Whether cashback is enabled |

**Returns**: `TransactionInstruction[]`

---

#### `buyExactSolInInstruction`

Buy tokens by specifying exact SOL input.

```typescript
async buyExactSolInInstruction(params: {
  user: PublicKey;
  mint: PublicKey;
  creator: PublicKey;
  feeRecipient: PublicKey;
  solAmount: BN;
  minTokenAmount: BN;
  tokenProgram?: PublicKey;
}): Promise<TransactionInstruction>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user` | `PublicKey` | Yes | Buyer's wallet |
| `mint` | `PublicKey` | Yes | Token mint |
| `creator` | `PublicKey` | Yes | Token creator |
| `feeRecipient` | `PublicKey` | Yes | Fee recipient address |
| `solAmount` | `BN` | Yes | Exact SOL to spend (lamports) |
| `minTokenAmount` | `BN` | Yes | Minimum tokens to receive |
| `tokenProgram` | `PublicKey` | No | Token program ID |

**Returns**: `TransactionInstruction`

---

#### `getBuyInstructionRaw` / `getSellInstructionRaw`

Low-level buy/sell without slippage calculation.

```typescript
async getBuyInstructionRaw(params: {
  user: PublicKey;
  mint: PublicKey;
  creator: PublicKey;
  amount: BN;
  solAmount: BN;
  feeRecipient?: PublicKey;
  tokenProgram?: PublicKey;
}): Promise<TransactionInstruction>

async getSellInstructionRaw(params: {
  user: PublicKey;
  mint: PublicKey;
  creator: PublicKey;
  amount: BN;
  solAmount: BN;
  feeRecipient?: PublicKey;
  tokenProgram?: PublicKey;
  cashback?: boolean;
}): Promise<TransactionInstruction>
```

---

#### `createFeeSharingConfig`

Create a fee sharing configuration for a token.

```typescript
async createFeeSharingConfig(params: {
  creator: PublicKey;
  mint: PublicKey;
  pool: PublicKey | null;
}): Promise<TransactionInstruction>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `creator` | `PublicKey` | Yes | Token creator (must be signer) |
| `mint` | `PublicKey` | Yes | Token mint address |
| `pool` | `PublicKey \| null` | Yes | AMM pool address (null for pre-graduation tokens) |

**Returns**: `TransactionInstruction`

**Throws**: `PoolRequiredForGraduatedError` if `pool` is null for a graduated token.

---

#### `updateFeeShares`

Update shareholders in a fee sharing config.

```typescript
async updateFeeShares(params: {
  authority: PublicKey;
  mint: PublicKey;
  currentShareholders: PublicKey[];
  newShareholders: Shareholder[];
}): Promise<TransactionInstruction>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `authority` | `PublicKey` | Yes | Fee sharing admin |
| `mint` | `PublicKey` | Yes | Token mint |
| `currentShareholders` | `PublicKey[]` | Yes | Current shareholder addresses |
| `newShareholders` | `Shareholder[]` | Yes | New shareholders with BPS allocations |

**Returns**: `TransactionInstruction`

**Throws**:
- `NoShareholdersError` — Empty array
- `TooManyShareholdersError` — More than 10
- `ZeroShareError` — Any shareholder has 0 BPS
- `InvalidShareTotalError` — BPS don't sum to 10,000
- `DuplicateShareholderError` — Duplicate addresses

**Example**:

```typescript
const ix = await PUMP_SDK.updateFeeShares({
  authority: wallet.publicKey,
  mint: tokenMint,
  currentShareholders: [wallet.publicKey],
  newShareholders: [
    { address: wallet.publicKey, shareBps: 6000 },
    { address: partnerAddress, shareBps: 4000 },
  ],
});
```

---

#### `distributeCreatorFees`

Distribute accumulated creator fees to shareholders.

```typescript
async distributeCreatorFees(params: {
  mint: PublicKey;
  sharingConfig: SharingConfig;
  sharingConfigAddress: PublicKey;
}): Promise<TransactionInstruction>
```

---

#### `migrateInstruction`

Migrate a graduated bonding curve to an AMM pool.

```typescript
async migrateInstruction(params: {
  withdrawAuthority: PublicKey;
  mint: PublicKey;
  user: PublicKey;
  tokenProgram?: PublicKey;
}): Promise<TransactionInstruction>
```

---

#### `setCreator`

Set the creator address for a token.

```typescript
async setCreator(params: {
  mint: PublicKey;
  setCreatorAuthority: PublicKey;
  creator: PublicKey;
}): Promise<TransactionInstruction>
```

---

#### `initUserVolumeAccumulator`

Initialize a volume accumulator for $PUMP token incentives.

```typescript
async initUserVolumeAccumulator(params: {
  payer: PublicKey;
  user: PublicKey;
}): Promise<TransactionInstruction>
```

---

#### `syncUserVolumeAccumulator`

Sync a user's volume accumulator with the global state.

```typescript
async syncUserVolumeAccumulator(user: PublicKey): Promise<TransactionInstruction>
```

---

#### `claimCashbackInstruction`

Claim accumulated cashback rewards.

```typescript
async claimCashbackInstruction(params: {
  user: PublicKey;
}): Promise<TransactionInstruction>
```

---

#### `extendAccountInstruction`

Extend a bonding curve account to the new size (migration helper).

```typescript
async extendAccountInstruction(params: {
  account: PublicKey;
  user: PublicKey;
}): Promise<TransactionInstruction>
```

---

#### Event Decoders

All event decoders accept a `Buffer` and return the typed event object.

**Pump Program Events**:

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

**PumpAMM Events**:

| Method | Returns |
|--------|---------|
| `decodeAmmBuyEvent(data)` | `AmmBuyEvent` |
| `decodeAmmSellEvent(data)` | `AmmSellEvent` |
| `decodeDepositEvent(data)` | `DepositEvent` |
| `decodeWithdrawEvent(data)` | `WithdrawEvent` |
| `decodeCreatePoolEvent(data)` | `CreatePoolEvent` |

**PumpFees Events**:

| Method | Returns |
|--------|---------|
| `decodeCreateFeeSharingConfigEvent(data)` | `CreateFeeSharingConfigEvent` |
| `decodeUpdateFeeSharesEvent(data)` | `UpdateFeeSharesEvent` |
| `decodeResetFeeSharingConfigEvent(data)` | `ResetFeeSharingConfigEvent` |
| `decodeRevokeFeeSharingAuthorityEvent(data)` | `RevokeFeeSharingAuthorityEvent` |
| `decodeTransferFeeSharingAuthorityEvent(data)` | `TransferFeeSharingAuthorityEvent` |
| `decodeSocialFeePdaCreatedEvent(data)` | `SocialFeePdaCreatedEvent` |
| `decodeSocialFeePdaClaimedEvent(data)` | `SocialFeePdaClaimedEvent` |

---

#### Account Decoders

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

---

### OnlinePumpSdk

Extends `PumpSdk` with RPC-dependent fetchers and convenience methods.

**Import**:

```typescript
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";

const sdk = new OnlinePumpSdk(connection);
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `connection` | `Connection` | Yes | Solana RPC connection |

---

#### `fetchBondingCurve`

Fetch and decode a bonding curve account.

```typescript
async fetchBondingCurve(mint: PublicKeyInitData): Promise<BondingCurve>
```

**Throws**: Error if the bonding curve account doesn't exist.

---

#### `fetchBuyState`

Fetch all state needed for a buy instruction in one call.

```typescript
async fetchBuyState(
  mint: PublicKey,
  user: PublicKey,
  tokenProgram?: PublicKey
): Promise<{
  global: Global;
  feeConfig: FeeConfig;
  bondingCurveAccountInfo: AccountInfo<Buffer>;
  bondingCurve: BondingCurve;
  associatedUserAccountInfo: AccountInfo<Buffer> | null;
  mintSupply: BN;
}>
```

---

#### `fetchSellState`

Fetch all state needed for a sell instruction.

```typescript
async fetchSellState(
  mint: PublicKey,
  user: PublicKey,
  tokenProgram?: PublicKey
): Promise<{
  global: Global;
  feeConfig: FeeConfig;
  bondingCurveAccountInfo: AccountInfo<Buffer>;
  bondingCurve: BondingCurve;
  mintSupply: BN;
}>
```

---

#### `fetchBondingCurveSummary`

Get a complete summary of a bonding curve's current state.

```typescript
async fetchBondingCurveSummary(mint: PublicKeyInitData): Promise<BondingCurveSummary>
```

**Returns**: `BondingCurveSummary` — Contains marketCap, progressBps, prices, reserves, isGraduated.

---

#### `fetchGraduationProgress`

Check how close a token is to graduating.

```typescript
async fetchGraduationProgress(mint: PublicKeyInitData): Promise<GraduationProgress>
```

**Returns**: `GraduationProgress`

**Example**:

```typescript
const progress = await sdk.fetchGraduationProgress(mint);
console.log(`${progress.progressBps / 100}% complete`);
```

---

#### `fetchTokenPrice`

Get current buy/sell price per token.

```typescript
async fetchTokenPrice(mint: PublicKeyInitData): Promise<TokenPriceInfo>
```

**Returns**: `TokenPriceInfo` — buyPricePerToken, sellPricePerToken, marketCap, isGraduated.

---

#### `fetchBuyPriceImpact` / `fetchSellPriceImpact`

Calculate price impact for a trade.

```typescript
async fetchBuyPriceImpact(mint: PublicKeyInitData, solAmount: BN): Promise<PriceImpactResult>
async fetchSellPriceImpact(mint: PublicKeyInitData, tokenAmount: BN): Promise<PriceImpactResult>
```

---

#### `isGraduated`

Check if a token has graduated to AMM.

```typescript
async isGraduated(mint: PublicKeyInitData): Promise<boolean>
```

---

#### `sellAllInstructions`

Sell a user's entire token balance.

```typescript
async sellAllInstructions(params: {
  mint: PublicKey;
  user: PublicKey;
  slippage?: number;
  tokenProgram?: PublicKey;
}): Promise<TransactionInstruction[]>
```

---

#### `collectCoinCreatorFeeInstructions`

Collect accumulated creator fees.

```typescript
async collectCoinCreatorFeeInstructions(
  coinCreator: PublicKey,
  feePayer?: PublicKey,
): Promise<TransactionInstruction[]>
```

---

#### `getCreatorVaultBalance` / `getCreatorVaultBalanceBothPrograms`

Check creator fee vault balance.

```typescript
async getCreatorVaultBalance(creator: PublicKey): Promise<BN>
async getCreatorVaultBalanceBothPrograms(creator: PublicKey): Promise<BN>
```

---

#### `claimTokenIncentives` / `claimTokenIncentivesBothPrograms`

Claim $PUMP token incentive rewards.

```typescript
async claimTokenIncentives(user: PublicKey, payer: PublicKey): Promise<TransactionInstruction[]>
async claimTokenIncentivesBothPrograms(user: PublicKey, payer: PublicKey): Promise<TransactionInstruction[]>
```

---

#### `getTotalUnclaimedTokens` / `getTotalUnclaimedTokensBothPrograms`

Check unclaimed $PUMP token rewards.

```typescript
async getTotalUnclaimedTokens(user: PublicKey): Promise<BN>
async getTotalUnclaimedTokensBothPrograms(user: PublicKey): Promise<BN>
```

---

#### `getMinimumDistributableFee`

Check if accumulated fees meet the minimum threshold for distribution.

```typescript
async getMinimumDistributableFee(
  mint: PublicKey,
  simulationSigner?: PublicKey,
): Promise<MinimumDistributableFeeResult>
```

**Returns**:

```typescript
interface MinimumDistributableFeeResult {
  minimumRequired: BN;
  distributableFees: BN;
  canDistribute: boolean;
  isGraduated: boolean;
}
```

---

#### `buildDistributeCreatorFeesInstructions`

Build instructions to distribute creator fees to shareholders.

```typescript
async buildDistributeCreatorFeesInstructions(
  mint: PublicKey,
): Promise<DistributeCreatorFeeResult>
```

**Returns**:

```typescript
interface DistributeCreatorFeeResult {
  instructions: TransactionInstruction[];
  isGraduated: boolean;
}
```

---

#### AMM Instructions

For graduated tokens trading on PumpAMM:

```typescript
// Buy tokens on AMM
async ammBuyInstruction(params: {
  user: PublicKey;
  pool: PublicKey;
  mint: PublicKey;
  baseAmountOut: BN;
  maxQuoteAmountIn: BN;
  cashback?: boolean;
}): Promise<TransactionInstruction>

// Buy by specifying exact SOL input
async ammBuyExactQuoteInInstruction(params: {
  user: PublicKey;
  pool: PublicKey;
  mint: PublicKey;
  quoteAmountIn: BN;
  minBaseAmountOut: BN;
  cashback?: boolean;
}): Promise<TransactionInstruction>

// Sell tokens on AMM
async ammSellInstruction(params: {
  user: PublicKey;
  pool: PublicKey;
  mint: PublicKey;
  baseAmountIn: BN;
  minQuoteAmountOut: BN;
  cashback?: boolean;
}): Promise<TransactionInstruction>

// Deposit liquidity
async ammDepositInstruction(params: {
  user: PublicKey;
  pool: PublicKey;
  mint: PublicKey;
  maxBaseAmountIn: BN;
  maxQuoteAmountIn: BN;
  minLpTokenAmountOut: BN;
}): Promise<TransactionInstruction>

// Withdraw liquidity
async ammWithdrawInstruction(params: {
  user: PublicKey;
  pool: PublicKey;
  mint: PublicKey;
  lpTokenAmountIn: BN;
  minBaseAmountOut: BN;
  minQuoteAmountOut: BN;
}): Promise<TransactionInstruction>
```

---

#### Social Fee Instructions

```typescript
// Create a social fee PDA (referral account)
async createSocialFeePdaInstruction(params: {
  payer: PublicKey;
  userId: string;
  platform: Platform;
}): Promise<TransactionInstruction>

// Claim accumulated social fees
async claimSocialFeePdaInstruction(params: {
  recipient: PublicKey;
  socialClaimAuthority: PublicKey;
  userId: string;
  platform: Platform;
}): Promise<TransactionInstruction>

// Normalize shareholders (resolve social IDs to PDAs)
normalizeSocialShareholders(params: {
  newShareholders: Array<{
    shareBps: number;
    address?: PublicKey;
    userId?: string;
    platform?: Platform;
  }>;
}): {
  normalizedShareholders: Shareholder[];
  socialRecipientsToCreate: Map<string, { userId: string; platform: Platform }>;
}
```

---

## Bonding Curve Functions

### `getBuyTokenAmountFromSolAmount`

Calculate how many tokens you receive for a given SOL amount.

```typescript
function getBuyTokenAmountFromSolAmount(params: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN | null;
  bondingCurve: BondingCurve | null;
  amount: BN;
}): BN
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `global` | `Global` | Yes | Protocol global state |
| `feeConfig` | `FeeConfig \| null` | Yes | Fee configuration (null = flat fees) |
| `mintSupply` | `BN \| null` | Yes | Current token supply (null = new curve) |
| `bondingCurve` | `BondingCurve \| null` | Yes | Current curve state (null = new curve) |
| `amount` | `BN` | Yes | SOL amount in lamports |

**Returns**: `BN` — Token amount (with 6 decimals).

**Example**:

```typescript
import { getBuyTokenAmountFromSolAmount } from "@pump-fun/pump-sdk";
import BN from "bn.js";

const tokens = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount: new BN(100_000_000), // 0.1 SOL
});
console.log("Tokens:", tokens.toString());
```

---

### `getBuySolAmountFromTokenAmount`

Calculate the SOL cost for a specific number of tokens.

```typescript
function getBuySolAmountFromTokenAmount(params: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN | null;
  bondingCurve: BondingCurve | null;
  amount: BN;
}): BN
```

**Returns**: `BN` — SOL cost in lamports.

---

### `getSellSolAmountFromTokenAmount`

Calculate SOL received for selling tokens.

```typescript
function getSellSolAmountFromTokenAmount(params: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
  amount: BN;
}): BN
```

**Returns**: `BN` — SOL received in lamports (after fees).

---

### `bondingCurveMarketCap`

Calculate current market cap.

```typescript
function bondingCurveMarketCap(params: {
  mintSupply: BN;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
}): BN
```

**Returns**: `BN` — Market cap in lamports.

Formula: `virtualSolReserves * mintSupply / virtualTokenReserves`

---

### `newBondingCurve`

Create a fresh bonding curve from global state (for quoting new tokens).

```typescript
function newBondingCurve(global: Global): BondingCurve
```

---

### `getStaticRandomFeeRecipient`

Get a random fee recipient from the hardcoded list.

```typescript
function getStaticRandomFeeRecipient(): PublicKey
```

---

## Fee Functions

### `getFee`

Calculate the fee for a trade.

```typescript
function getFee(params: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
  amount: BN;
  isNewBondingCurve: boolean;
}): BN
```

**Returns**: `BN` — Fee amount in lamports.

---

### `computeFeesBps`

Get the current fee rates in basis points.

```typescript
function computeFeesBps(params: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
}): CalculatedFeesBps
```

**Returns**:

```typescript
interface CalculatedFeesBps {
  protocolFeeBps: BN;
  creatorFeeBps: BN;
}
```

---

### `calculateFeeTier`

Determine the fee tier for a given market cap.

```typescript
function calculateFeeTier(params: {
  feeTiers: FeeTier[];
  marketCap: BN;
}): Fees
```

**Returns**: `Fees` — The applicable fee rates (lpFeeBps, protocolFeeBps, creatorFeeBps).

---

## Analytics Functions

### `calculateBuyPriceImpact`

Calculate the price impact of a buy trade.

```typescript
function calculateBuyPriceImpact(params: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
  solAmount: BN;
}): PriceImpactResult
```

**Returns**:

```typescript
interface PriceImpactResult {
  priceBefore: BN;    // Lamports per token before trade
  priceAfter: BN;     // Lamports per token after trade
  impactBps: number;  // Impact in basis points (150 = 1.5%)
  outputAmount: BN;   // Tokens received
}
```

---

### `calculateSellPriceImpact`

Calculate the price impact of a sell trade.

```typescript
function calculateSellPriceImpact(params: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
  tokenAmount: BN;
}): PriceImpactResult
```

---

### `getGraduationProgress`

Calculate how close a token is to graduating.

```typescript
function getGraduationProgress(
  global: Global,
  bondingCurve: BondingCurve,
): GraduationProgress
```

**Returns**:

```typescript
interface GraduationProgress {
  progressBps: number;   // 0–10000 (0–100%)
  isGraduated: boolean;
  tokensRemaining: BN;
  tokensTotal: BN;
  solAccumulated: BN;
}
```

---

### `getTokenPrice`

Get current per-token pricing.

```typescript
function getTokenPrice(params: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
}): TokenPriceInfo
```

**Returns**:

```typescript
interface TokenPriceInfo {
  buyPricePerToken: BN;   // Cost to buy 1 token (10^6 units) in lamports
  sellPricePerToken: BN;  // SOL received for selling 1 token in lamports
  marketCap: BN;           // Total market cap in lamports
  isGraduated: boolean;
}
```

---

### `getBondingCurveSummary`

Get a comprehensive bonding curve overview.

```typescript
function getBondingCurveSummary(params: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
}): BondingCurveSummary
```

**Returns**:

```typescript
interface BondingCurveSummary {
  marketCap: BN;
  progressBps: number;
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

## Token Incentive Functions

### `totalUnclaimedTokens`

Calculate total unclaimed $PUMP token rewards.

```typescript
function totalUnclaimedTokens(
  globalVolumeAccumulator: GlobalVolumeAccumulator,
  userVolumeAccumulator: UserVolumeAccumulator,
  currentTimestamp?: number,
): BN
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `globalVolumeAccumulator` | `GlobalVolumeAccumulator` | Yes | — | Global volume tracking state |
| `userVolumeAccumulator` | `UserVolumeAccumulator` | Yes | — | User's volume tracking state |
| `currentTimestamp` | `number` | No | `Date.now() / 1000` | Unix timestamp in seconds |

---

### `currentDayTokens`

Calculate tokens earned on the current day.

```typescript
function currentDayTokens(
  globalVolumeAccumulator: GlobalVolumeAccumulator,
  userVolumeAccumulator: UserVolumeAccumulator,
  currentTimestamp?: number,
): BN
```

---

## PDA Functions

All PDA functions are pure and deterministic — they derive addresses from seeds without RPC calls.

### Static PDAs (Pre-computed)

| Constant | Description |
|----------|-------------|
| `GLOBAL_PDA` | Pump program global state |
| `AMM_GLOBAL_PDA` | PumpAMM global state |
| `PUMP_FEE_CONFIG_PDA` | Fee configuration |
| `GLOBAL_VOLUME_ACCUMULATOR_PDA` | Pump volume accumulator |
| `AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA` | AMM volume accumulator |
| `PUMP_EVENT_AUTHORITY_PDA` | Pump event authority |
| `PUMP_AMM_EVENT_AUTHORITY_PDA` | AMM event authority |
| `PUMP_FEE_EVENT_AUTHORITY_PDA` | Fee program event authority |
| `AMM_GLOBAL_CONFIG_PDA` | AMM global configuration |
| `AMM_FEE_CONFIG_PDA` | AMM fee configuration |

### Derived PDA Functions

| Function | Parameters | Description |
|----------|-----------|-------------|
| `bondingCurvePda(mint)` | `PublicKeyInitData` | Bonding curve account for a mint |
| `bondingCurveV2Pda(mint)` | `PublicKeyInitData` | V2 bonding curve (extended) |
| `creatorVaultPda(creator)` | `PublicKey` | Creator fee vault (Pump) |
| `ammCreatorVaultPda(creator)` | `PublicKey` | Creator fee vault (AMM) |
| `pumpPoolAuthorityPda(mint)` | `PublicKey` | Pool authority |
| `canonicalPumpPoolPda(mint)` | `PublicKey` | Canonical AMM pool for a mint |
| `poolV2Pda(baseMint)` | `PublicKeyInitData` | V2 pool |
| `userVolumeAccumulatorPda(user)` | `PublicKey` | User volume tracker (Pump) |
| `ammUserVolumeAccumulatorPda(user)` | `PublicKey` | User volume tracker (AMM) |
| `feeSharingConfigPda(mint)` | `PublicKey` | Fee sharing config for a token |
| `feeProgramGlobalPda()` | — | Fee program global state |
| `socialFeePda(userId, platform)` | `string, number` | Social referral fee account |
| `getEventAuthorityPda(programId)` | `PublicKey` | Event authority for any program |

### Mayhem Mode PDAs

| Function | Description |
|----------|-------------|
| `getGlobalParamsPda()` | Mayhem global parameters |
| `getMayhemStatePda(mint)` | Mayhem state for a token |
| `getSolVaultPda()` | Mayhem SOL vault |
| `getTokenVaultPda(mint)` | Mayhem token vault |

---

## Error Types

All errors extend `Error` and have a `name` property matching the class name.

| Error Class | Properties | Thrown When |
|-------------|-----------|-------------|
| `NoShareholdersError` | — | Empty shareholders array in `updateFeeShares` |
| `TooManyShareholdersError` | `count: number`, `max: number` | More than 10 shareholders |
| `ZeroShareError` | `address: string` | A shareholder has 0 or negative BPS |
| `ShareCalculationOverflowError` | — | BPS total exceeds safe integer range |
| `InvalidShareTotalError` | `total: number` | Shares don't sum to 10,000 BPS |
| `DuplicateShareholderError` | — | Same address appears twice |
| `PoolRequiredForGraduatedError` | — | `pool` is null for graduated coin in `createFeeSharingConfig` |

---

## Interfaces & Types

### Account State

#### `Global`

Protocol-wide configuration.

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
  creatorFeeBasisPoints: BN;
  withdrawAuthority: PublicKey;
  enableMigrate: boolean;
  poolMigrationFee: BN;
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

Per-token bonding curve state.

```typescript
interface BondingCurve {
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
  realTokenReserves: BN;
  realSolReserves: BN;
  tokenTotalSupply: BN;
  complete: boolean;          // true = graduated to AMM
  creator: PublicKey;
  isMayhemMode: boolean;
}
```

#### `FeeConfig`

Tiered fee configuration.

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

#### `Pool`

AMM pool state (for graduated tokens).

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

#### `SharingConfig`

Fee sharing configuration.

```typescript
interface SharingConfig {
  version: number;
  mint: PublicKey;
  admin: PublicKey;
  adminRevoked: boolean;
  shareholders: Shareholder[];
}

interface Shareholder {
  address: PublicKey;
  shareBps: number;  // 1–10,000
}
```

#### `GlobalVolumeAccumulator`

Global volume tracking for token incentives.

```typescript
interface GlobalVolumeAccumulator {
  startTime: BN;
  endTime: BN;
  secondsInADay: BN;
  mint: PublicKey;
  totalTokenSupply: BN[];
  solVolumes: BN[];
}
```

#### `UserVolumeAccumulator`

Per-user volume tracking.

```typescript
interface UserVolumeAccumulator {
  user: PublicKey;
  needsClaim: boolean;
  totalUnclaimedTokens: BN;
  totalClaimedTokens: BN;
  currentSolVolume: BN;
  lastUpdateTimestamp: BN;
}
```

#### `SocialFeePda`

Social referral fee account.

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

#### `FeeProgramGlobal`

Fee program global state.

```typescript
interface FeeProgramGlobal {
  bump: number;
  authority: PublicKey;
  disableFlags: number;
  socialClaimAuthority: PublicKey;
  claimRateLimit: BN;
}
```

#### `AmmGlobalConfig`

AMM global configuration.

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

---

### Event Types

#### `TradeEvent`

Emitted on every bonding curve trade.

```typescript
interface TradeEvent {
  mint: PublicKey;
  solAmount: BN;
  tokenAmount: BN;
  isBuy: boolean;
  user: PublicKey;
  timestamp: BN;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
  realSolReserves: BN;
  realTokenReserves: BN;
  feeRecipient: PublicKey;
  feeBasisPoints: BN;
  fee: BN;
  creator: PublicKey;
  creatorFeeBasisPoints: BN;
  creatorFee: BN;
  trackVolume: boolean;
  totalUnclaimedTokens: BN;
  totalClaimedTokens: BN;
  currentSolVolume: BN;
  lastUpdateTimestamp: BN;
  ixName: string;
  mayhemMode: boolean;
  cashbackFeeBasisPoints: BN;
  cashback: BN;
}
```

#### `CreateEvent`

Emitted when a new token is created.

```typescript
interface CreateEvent {
  name: string;
  symbol: string;
  uri: string;
  mint: PublicKey;
  bondingCurve: PublicKey;
  user: PublicKey;
  creator: PublicKey;
  timestamp: BN;
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
  realTokenReserves: BN;
  tokenTotalSupply: BN;
  tokenProgram: PublicKey;
  isMayhemMode: boolean;
  isCashbackEnabled: boolean;
}
```

#### `CompleteEvent`

Emitted when a bonding curve graduates.

```typescript
interface CompleteEvent {
  user: PublicKey;
  mint: PublicKey;
  bondingCurve: PublicKey;
  timestamp: BN;
}
```

---

### Enums

#### `Platform`

Social platform identifiers for social fee PDAs.

```typescript
enum Platform {
  Pump = 0,
  X = 1,
  GitHub = 2,
}
```

**Helper functions**:

```typescript
function platformToString(platform: Platform): string;
function stringToPlatform(str: string): Platform;
const SUPPORTED_SOCIAL_PLATFORMS: Platform[];
```

---

## Constants

| Constant | Type | Value | Description |
|----------|------|-------|-------------|
| `PUMP_PROGRAM_ID` | `string` | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Pump program |
| `PUMP_AMM_PROGRAM_ID` | `string` | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | PumpAMM program |
| `PUMP_FEE_PROGRAM_ID` | `string` | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | PumpFees program |
| `MAYHEM_PROGRAM_ID` | `string` | `MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e` | Mayhem program |
| `PUMP_TOKEN_MINT` | `string` | `pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn` | $PUMP token mint |
| `ONE_BILLION_SUPPLY` | `BN` | `1000000000000000` | 1B tokens × 10^6 decimals |
| `MAX_SHAREHOLDERS` | `number` | `10` | Max shareholders in fee sharing |
| `BONDING_CURVE_NEW_SIZE` | `number` | `151` | New bonding curve account size (bytes) |
| `CANONICAL_POOL_INDEX` | `number` | `0` | Default pool index for canonical pools |
