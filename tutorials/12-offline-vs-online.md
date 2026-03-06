# Tutorial 12: Offline SDK vs Online SDK

> When to use `PumpSdk` (offline) vs `OnlinePumpSdk` (online) and why the architecture matters.

## The Two SDKs

| | `PumpSdk` (Offline) | `OnlinePumpSdk` (Online) |
|---|---|---|
| **Needs connection?** | No | Yes |
| **Singleton** | `PUMP_SDK` | Create per connection |
| **Returns** | `TransactionInstruction[]` | Instructions + fetched state |
| **Use when** | Building instructions with known state | Fetching state + building |

## Offline SDK: `PumpSdk`

The offline SDK builds instructions **without any network calls**. It's a singleton — use `PUMP_SDK`:

```typescript
import { PUMP_SDK } from "@pump-fun/pump-sdk";

// No connection needed!
const createIx = await PUMP_SDK.createV2Instruction({
  mint: mintPubkey,
  name: "My Token",
  symbol: "MT",
  uri: "https://example.com/meta.json",
  creator: creatorPubkey,
  user: creatorPubkey,
  mayhemMode: false,
});

// Decode account data (also offline)
const bondingCurve = PUMP_SDK.decodeBondingCurve(accountInfo);
const global = PUMP_SDK.decodeGlobal(globalAccountInfo);
```

### When to Use Offline SDK

- **Serverless functions** — no persistent connection needed
- **Batch processing** — decode many accounts without RPC
- **Pre-computing instructions** — build transactions for later signing
- **Testing** — no network dependency
- **Edge/worker environments** — minimal overhead

### Available Offline Operations

```typescript
// Decode account data
PUMP_SDK.decodeGlobal(accountInfo);
PUMP_SDK.decodeFeeConfig(accountInfo);
PUMP_SDK.decodeBondingCurve(accountInfo);
PUMP_SDK.decodeBondingCurveNullable(accountInfo);
PUMP_SDK.decodeGlobalVolumeAccumulator(accountInfo);
PUMP_SDK.decodeUserVolumeAccumulator(accountInfo);
PUMP_SDK.decodeSharingConfig(accountInfo);

// Build instructions (need pre-fetched state)
PUMP_SDK.createV2Instruction({...});
PUMP_SDK.buyInstructions({...});
PUMP_SDK.sellInstructions({...});
PUMP_SDK.migrateInstruction({...});
PUMP_SDK.setCreator({...});
PUMP_SDK.createFeeSharingConfig({...});
PUMP_SDK.updateFeeShares({...});
PUMP_SDK.distributeCreatorFees({...});
PUMP_SDK.claimCashbackInstruction({...});
PUMP_SDK.syncUserVolumeAccumulator(user);
```

## Online SDK: `OnlinePumpSdk`

The online SDK wraps the offline SDK and adds RPC fetchers:

```typescript
import { Connection } from "@solana/web3.js";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);

// Fetches state AND returns it ready to use
const buyState = await onlineSdk.fetchBuyState(mint, user);
const bondingCurve = await onlineSdk.fetchBondingCurve(mint);
const global = await onlineSdk.fetchGlobal();
```

### When to Use Online SDK

- **Interactive apps** — real-time state + instructions
- **Trading bots** — fetch → decide → execute
- **Dashboards** — display current token state
- **Any workflow where you don't already have account data**

### Available Online Operations

```typescript
// Fetch state
onlineSdk.fetchGlobal();
onlineSdk.fetchFeeConfig();
onlineSdk.fetchBondingCurve(mint);
onlineSdk.fetchBuyState(mint, user);
onlineSdk.fetchSellState(mint, user);
onlineSdk.fetchGlobalVolumeAccumulator();
onlineSdk.fetchUserVolumeAccumulator(user);
onlineSdk.fetchUserVolumeAccumulatorTotalStats(user);

// Fee operations
onlineSdk.getCreatorVaultBalance(creator);
onlineSdk.getCreatorVaultBalanceBothPrograms(creator);
onlineSdk.collectCoinCreatorFeeInstructions({...});

// Token incentives
onlineSdk.getTotalUnclaimedTokens(user);
onlineSdk.getTotalUnclaimedTokensBothPrograms(user);
onlineSdk.getCurrentDayTokens(user);
onlineSdk.getCurrentDayTokensBothPrograms(user);
onlineSdk.claimTokenIncentives(user);
onlineSdk.claimTokenIncentivesBothPrograms(user);
onlineSdk.syncUserVolumeAccumulatorBothPrograms(user);

// Admin
onlineSdk.adminUpdateTokenIncentives({...});
onlineSdk.adminUpdateTokenIncentivesBothPrograms({...});
onlineSdk.adminSetCoinCreatorInstructions({...});
```

## Pattern: Hybrid Approach

For high-throughput apps, fetch state once and use the offline SDK:

```typescript
// Fetch all state in one batch
const accounts = await connection.getMultipleAccountsInfo([
  bondingCurvePda(mint1),
  bondingCurvePda(mint2),
  bondingCurvePda(mint3),
  GLOBAL_PDA,
]);

// Decode offline (no additional RPC calls)
const curve1 = PUMP_SDK.decodeBondingCurveNullable(accounts[0]!);
const curve2 = PUMP_SDK.decodeBondingCurveNullable(accounts[1]!);
const curve3 = PUMP_SDK.decodeBondingCurveNullable(accounts[2]!);
const global = PUMP_SDK.decodeGlobal(accounts[3]!);

// Build instructions with pre-fetched data
const buyIxs = await PUMP_SDK.buyInstructions({
  global,
  bondingCurve: curve1!,
  bondingCurveAccountInfo: accounts[0]!,
  // ...
});
```

This minimises RPC calls while keeping instruction building flexible.

## What's Next?

- [Tutorial 13: Generating Vanity Addresses](./13-vanity-addresses.md)
- [Tutorial 14: x402 Paywalled APIs](./14-x402-paywalled-apis.md)
