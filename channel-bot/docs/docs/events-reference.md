# Events Reference

Complete catalog of all events emitted by the Pump, PumpAMM, and PumpFees programs. Events are emitted as Anchor program logs and can be decoded with the SDK.

---

## Decoding Events

All events are decoded from transaction log buffers:

```typescript
import { PUMP_SDK } from "@nirholas/pump-sdk";

// Parse transaction logs to extract event data buffers, then:
const tradeEvent = PUMP_SDK.decodeTradeEvent(data);
const createEvent = PUMP_SDK.decodeCreateEvent(data);
```

---

## Pump Program Events

### TradeEvent

Emitted on every bonding curve buy/sell.

| Field | Type | Description |
|-------|------|-------------|
| `mint` | `PublicKey` | Token mint |
| `solAmount` | `BN` | SOL involved (lamports) |
| `tokenAmount` | `BN` | Tokens involved |
| `isBuy` | `boolean` | `true` = buy, `false` = sell |
| `user` | `PublicKey` | Trader address |
| `timestamp` | `BN` | Unix timestamp |
| `virtualSolReserves` | `BN` | Virtual SOL reserves after trade |
| `virtualTokenReserves` | `BN` | Virtual token reserves after trade |
| `realSolReserves` | `BN` | Real SOL reserves after trade |
| `realTokenReserves` | `BN` | Real token reserves after trade |
| `feeRecipient` | `PublicKey` | Protocol fee recipient |
| `feeBasisPoints` | `BN` | Protocol fee rate (BPS) |
| `fee` | `BN` | Protocol fee amount |
| `creator` | `PublicKey` | Token creator |
| `creatorFeeBasisPoints` | `BN` | Creator fee rate (BPS) |
| `creatorFee` | `BN` | Creator fee amount |
| `trackVolume` | `boolean` | Whether volume is tracked for incentives |
| `totalUnclaimedTokens` | `BN` | Unclaimed token incentives |
| `totalClaimedTokens` | `BN` | Claimed token incentives |
| `currentSolVolume` | `BN` | Current cumulative volume |
| `lastUpdateTimestamp` | `BN` | Volume tracker last update |
| `ixName` | `string` | Instruction name |
| `mayhemMode` | `boolean` | Whether mayhem mode was active |
| `cashbackFeeBasisPoints` | `BN` | Cashback fee rate (BPS) |
| `cashback` | `BN` | Cashback amount |

**Decoder:** `PUMP_SDK.decodeTradeEvent(data)`

---

### CreateEvent

Emitted when a new token is created via `createV2`.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Token name |
| `symbol` | `string` | Token symbol |
| `uri` | `string` | Metadata URI |
| `mint` | `PublicKey` | Token mint |
| `bondingCurve` | `PublicKey` | Bonding curve PDA |
| `user` | `PublicKey` | Transaction signer |
| `creator` | `PublicKey` | Token creator |
| `timestamp` | `BN` | Unix timestamp |
| `virtualTokenReserves` | `BN` | Initial virtual token reserves |
| `virtualSolReserves` | `BN` | Initial virtual SOL reserves |
| `realTokenReserves` | `BN` | Initial real token reserves |
| `tokenTotalSupply` | `BN` | Total token supply |
| `tokenProgram` | `PublicKey` | SPL Token program used |
| `isMayhemMode` | `boolean` | Whether mayhem mode was active |
| `isCashbackEnabled` | `boolean` | Whether cashback was enabled |

**Decoder:** `PUMP_SDK.decodeCreateEvent(data)`

---

### CompleteEvent

Emitted when a bonding curve reaches 100% and triggers graduation.

| Field | Type | Description |
|-------|------|-------------|
| `user` | `PublicKey` | User who triggered graduation |
| `mint` | `PublicKey` | Token mint |
| `bondingCurve` | `PublicKey` | Bonding curve PDA |
| `timestamp` | `BN` | Unix timestamp |

**Decoder:** `PUMP_SDK.decodeCompleteEvent(data)`

---

### CompletePumpAmmMigrationEvent

Emitted when a graduated token migrates to PumpAMM.

| Field | Type | Description |
|-------|------|-------------|
| `user` | `PublicKey` | Migration initiator |
| `mint` | `PublicKey` | Token mint |
| `mintAmount` | `BN` | Tokens migrated |
| `solAmount` | `BN` | SOL migrated |
| `poolMigrationFee` | `BN` | Migration fee |
| `bondingCurve` | `PublicKey` | Source bonding curve |
| `timestamp` | `BN` | Unix timestamp |
| `pool` | `PublicKey` | Created AMM pool |

**Decoder:** `PUMP_SDK.decodeCompletePumpAmmMigrationEvent(data)`

---

### SetCreatorEvent

Emitted when a bonding curve's creator is set or updated.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `mint` | `PublicKey` | Token mint |
| `bondingCurve` | `PublicKey` | Bonding curve PDA |
| `creator` | `PublicKey` | New creator |

**Decoder:** `PUMP_SDK.decodeSetCreatorEvent(data)`

---

### CollectCreatorFeeEvent

Emitted when a creator collects accumulated fees.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `creator` | `PublicKey` | Creator address |
| `creatorFee` | `BN` | Amount collected (lamports) |

**Decoder:** `PUMP_SDK.decodeCollectCreatorFeeEvent(data)`

---

### AdminSetCreatorEvent

Emitted when the admin overrides a token's creator.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `adminSetCreatorAuthority` | `PublicKey` | Admin authority |
| `mint` | `PublicKey` | Token mint |
| `bondingCurve` | `PublicKey` | Bonding curve PDA |
| `oldCreator` | `PublicKey` | Previous creator |
| `newCreator` | `PublicKey` | New creator |

**Decoder:** `PUMP_SDK.decodeAdminSetCreatorEvent(data)`

---

### MigrateBondingCurveCreatorEvent

Emitted when creator is migrated via fee sharing config.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `mint` | `PublicKey` | Token mint |
| `bondingCurve` | `PublicKey` | Bonding curve PDA |
| `sharingConfig` | `PublicKey` | Fee sharing config |
| `oldCreator` | `PublicKey` | Previous creator |
| `newCreator` | `PublicKey` | New creator |

**Decoder:** `PUMP_SDK.decodeMigrateBondingCurveCreatorEvent(data)`

---

### ExtendAccountEvent

Emitted when an account is extended (resized).

| Field | Type | Description |
|-------|------|-------------|
| `account` | `PublicKey` | Extended account |
| `user` | `PublicKey` | User who extended |
| `currentSize` | `BN` | Size before |
| `newSize` | `BN` | Size after |
| `timestamp` | `BN` | Unix timestamp |

**Decoder:** `PUMP_SDK.decodeExtendAccountEvent(data)`

---

## Token Incentive Events

### ClaimTokenIncentivesEvent

| Field | Type | Description |
|-------|------|-------------|
| `user` | `PublicKey` | Claimer |
| `mint` | `PublicKey` | Token mint |
| `amount` | `BN` | Tokens claimed |
| `timestamp` | `BN` | Unix timestamp |
| `totalClaimedTokens` | `BN` | Cumulative claimed |
| `currentSolVolume` | `BN` | Volume at claim time |

**Decoder:** `PUMP_SDK.decodeClaimTokenIncentivesEvent(data)`

---

### ClaimCashbackEvent

| Field | Type | Description |
|-------|------|-------------|
| `user` | `PublicKey` | Claimer |
| `amount` | `BN` | SOL claimed (lamports) |
| `timestamp` | `BN` | Unix timestamp |
| `totalClaimed` | `BN` | Cumulative claimed |
| `totalCashbackEarned` | `BN` | Total earned to date |

**Decoder:** `PUMP_SDK.decodeClaimCashbackEvent(data)`

---

### Volume Accumulator Events

#### InitUserVolumeAccumulatorEvent

| Field | Type | Description |
|-------|------|-------------|
| `payer` | `PublicKey` | Account funder |
| `user` | `PublicKey` | User address |
| `timestamp` | `BN` | Unix timestamp |

#### SyncUserVolumeAccumulatorEvent

| Field | Type | Description |
|-------|------|-------------|
| `user` | `PublicKey` | User address |
| `totalClaimedTokensBefore` | `BN` | Before sync |
| `totalClaimedTokensAfter` | `BN` | After sync |
| `timestamp` | `BN` | Unix timestamp |

#### CloseUserVolumeAccumulatorEvent

| Field | Type | Description |
|-------|------|-------------|
| `user` | `PublicKey` | User address |
| `timestamp` | `BN` | Unix timestamp |
| `totalUnclaimedTokens` | `BN` | Unclaimed at close |
| `totalClaimedTokens` | `BN` | Total claimed |
| `currentSolVolume` | `BN` | Volume at close |
| `lastUpdateTimestamp` | `BN` | Last update |

---

## PumpAMM Events

### AmmBuyEvent

Emitted on AMM pool buys. See [AMM Trading](./amm-trading.md) for key fields.

**Decoder:** `PUMP_SDK.decodeAmmBuyEvent(data)`

### AmmSellEvent

Emitted on AMM pool sells.

**Decoder:** `PUMP_SDK.decodeAmmSellEvent(data)`

### DepositEvent

Emitted on liquidity deposits.

**Decoder:** `PUMP_SDK.decodeDepositEvent(data)`

### WithdrawEvent

Emitted on liquidity withdrawals.

**Decoder:** `PUMP_SDK.decodeWithdrawEvent(data)`

### CreatePoolEvent

Emitted when a new AMM pool is created during graduation.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `index` | `number` | Pool index |
| `creator` | `PublicKey` | Pool creator |
| `baseMint` | `PublicKey` | Token mint |
| `quoteMint` | `PublicKey` | SOL mint (wrapped) |
| `baseAmountIn` | `BN` | Initial token amount |
| `quoteAmountIn` | `BN` | Initial SOL amount |
| `pool` | `PublicKey` | Pool address |
| `lpMint` | `PublicKey` | LP token mint |
| `coinCreator` | `PublicKey` | Token creator |
| `isMayhemMode` | `boolean` | Mayhem mode state |

**Decoder:** `PUMP_SDK.decodeCreatePoolEvent(data)`

---

## PumpFees Events

### CreateFeeSharingConfigEvent

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `mint` | `PublicKey` | Token mint |
| `bondingCurve` | `PublicKey` | Bonding curve |
| `pool` | `PublicKey \| null` | AMM pool (if graduated) |
| `sharingConfig` | `PublicKey` | Config address |
| `admin` | `PublicKey` | Config admin |
| `initialShareholders` | `Shareholder[]` | Initial share split |
| `status` | `number` | Config status |

### UpdateFeeSharesEvent

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `mint` | `PublicKey` | Token mint |
| `sharingConfig` | `PublicKey` | Config address |
| `admin` | `PublicKey` | Admin who updated |
| `newShareholders` | `Shareholder[]` | Updated shares |

### DistributeCreatorFeesEvent

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `mint` | `PublicKey` | Token mint |
| `sharingConfig` | `PublicKey` | Config address |
| `admin` | `PublicKey` | Admin |
| `shareholders` | `Shareholder[]` | Recipients |
| `distributed` | `BN` | Total distributed (lamports) |

### ResetFeeSharingConfigEvent

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `mint` | `PublicKey` | Token mint |
| `sharingConfig` | `PublicKey` | Config address |
| `oldAdmin` | `PublicKey` | Previous admin |
| `oldShareholders` | `Shareholder[]` | Previous shares |
| `newAdmin` | `PublicKey` | New admin |
| `newShareholders` | `Shareholder[]` | New shares |

### RevokeFeeSharingAuthorityEvent

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `mint` | `PublicKey` | Token mint |
| `sharingConfig` | `PublicKey` | Config address |
| `admin` | `PublicKey` | Authority revoked |

### TransferFeeSharingAuthorityEvent

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `mint` | `PublicKey` | Token mint |
| `sharingConfig` | `PublicKey` | Config address |
| `oldAdmin` | `PublicKey` | Previous admin |
| `newAdmin` | `PublicKey` | New admin |

### SocialFeePdaCreatedEvent / SocialFeePdaClaimedEvent

See [Social Fees](./social-fees.md).

### MinimumDistributableFeeEvent

| Field | Type | Description |
|-------|------|-------------|
| `minimumRequired` | `BN` | Threshold for distribution |
| `distributableFees` | `BN` | Current distributable amount |
| `canDistribute` | `boolean` | Whether threshold is met |

---

## Related

- [AMM Trading](./amm-trading.md) — AMM event details
- [Fee Sharing](./fee-sharing.md) — Fee distribution system
- [Social Fees](./social-fees.md) — Social fee events
- [Token Incentives](./token-incentives.md) — Volume rewards
- [Tutorial 29](../tutorials/29-events-parsing.md) — Event parsing guide
