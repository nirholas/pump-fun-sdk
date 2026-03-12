# Tutorial 29: Event Parsing & On-Chain Analytics

> Parse all 20+ event types from Pump, PumpAMM, and PumpFees program logs to build real-time analytics dashboards.

## Prerequisites

- Node.js 18+
- `@nirholas/pump-sdk` installed
- Familiarity with Solana transaction structure

```bash
npm install @nirholas/pump-sdk @solana/web3.js @coral-xyz/anchor bn.js
```

## Event Taxonomy

The Pump ecosystem emits events across three programs:

### Pump Program Events
| Event | When It Fires |
|-------|--------------|
| `CreateEvent` | New token created on bonding curve |
| `TradeEvent` | Buy or sell on bonding curve |
| `CompleteEvent` | Bonding curve filled, ready to migrate |
| `CompletePumpAmmMigrationEvent` | Token migrated to PumpAMM |
| `SetCreatorEvent` | Creator address changed |
| `AdminSetCreatorEvent` | Admin overrode creator |
| `MigrateBondingCurveCreatorEvent` | Creator migrated from fee config |
| `CollectCreatorFeeEvent` | Creator fees collected |
| `ClaimTokenIncentivesEvent` | Volume rewards claimed |
| `ClaimCashbackEvent` | Cashback claimed |
| `ExtendAccountEvent` | Account storage extended |
| `InitUserVolumeAccumulatorEvent` | Volume tracker initialized |
| `SyncUserVolumeAccumulatorEvent` | Volume data synced |
| `CloseUserVolumeAccumulatorEvent` | Volume tracker closed |

### PumpAMM Events
| Event | When It Fires |
|-------|--------------|
| `CreatePoolEvent` | AMM pool created post-graduation |
| `AmmBuyEvent` | Buy on AMM pool |
| `AmmSellEvent` | Sell on AMM pool |
| `DepositEvent` | Liquidity deposited |
| `WithdrawEvent` | Liquidity withdrawn |

### PumpFees Events
| Event | When It Fires |
|-------|--------------|
| `CreateFeeSharingConfigEvent` | Fee sharing config created |
| `UpdateFeeSharesEvent` | Shareholders updated |
| `ResetFeeSharingConfigEvent` | Config reset by admin |
| `SocialFeePdaCreatedEvent` | Social fee PDA created |
| `SocialFeePdaClaimedEvent` | Social fees claimed |

## Step 1: Subscribe to Program Logs

```typescript
import { Connection, PublicKey, Logs } from "@solana/web3.js";

const connection = new Connection("https://api.mainnet-beta.solana.com", {
  wsEndpoint: "wss://api.mainnet-beta.solana.com",
  commitment: "confirmed",
});

const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const PUMP_AMM_PROGRAM_ID = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
const PUMP_FEES_PROGRAM_ID = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");

// Subscribe to Pump program logs
const pumpSubId = connection.onLogs(PUMP_PROGRAM_ID, (logs) => {
  handleProgramLogs("pump", logs);
});

// Subscribe to PumpAMM logs
const ammSubId = connection.onLogs(PUMP_AMM_PROGRAM_ID, (logs) => {
  handleProgramLogs("amm", logs);
});

// Subscribe to PumpFees logs
const feesSubId = connection.onLogs(PUMP_FEES_PROGRAM_ID, (logs) => {
  handleProgramLogs("fees", logs);
});

console.log("Subscribed to all three programs");
```

## Step 2: Parse Anchor Events from Logs

Anchor programs emit events as base64-encoded data in log messages:

```typescript
import { BorshCoder, EventParser } from "@coral-xyz/anchor";

// You'll need the IDL for each program — exported from the SDK
import { PumpIdl, PumpAmmIdl, PumpFeesIdl } from "@nirholas/pump-sdk";

const pumpCoder = new BorshCoder(PumpIdl);
const ammCoder = new BorshCoder(PumpAmmIdl);
const feesCoder = new BorshCoder(PumpFeesIdl);

const pumpParser = new EventParser(PUMP_PROGRAM_ID, pumpCoder);
const ammParser = new EventParser(PUMP_AMM_PROGRAM_ID, ammCoder);
const feesParser = new EventParser(PUMP_FEES_PROGRAM_ID, feesCoder);

function handleProgramLogs(program: string, logs: Logs) {
  const parser =
    program === "pump"
      ? pumpParser
      : program === "amm"
        ? ammParser
        : feesParser;

  for (const event of parser.parseLogs(logs.logs)) {
    console.log(`[${program.toUpperCase()}] ${event.name}:`, event.data);
    routeEvent(event.name, event.data, logs.signature);
  }
}
```

## Step 3: Route Events to Handlers

```typescript
interface EventContext {
  signature: string;
  timestamp: number;
}

function routeEvent(name: string, data: any, signature: string) {
  const ctx: EventContext = { signature, timestamp: Date.now() };

  switch (name) {
    // Token lifecycle
    case "CreateEvent":
      handleCreate(data, ctx);
      break;
    case "TradeEvent":
      handleTrade(data, ctx);
      break;
    case "CompleteEvent":
      handleComplete(data, ctx);
      break;
    case "CompletePumpAmmMigrationEvent":
      handleMigration(data, ctx);
      break;

    // AMM trading
    case "AmmBuyEvent":
      handleAmmBuy(data, ctx);
      break;
    case "AmmSellEvent":
      handleAmmSell(data, ctx);
      break;

    // Liquidity
    case "DepositEvent":
      handleDeposit(data, ctx);
      break;
    case "WithdrawEvent":
      handleWithdraw(data, ctx);
      break;

    // Fees
    case "CollectCreatorFeeEvent":
      handleFeeCollection(data, ctx);
      break;
    case "ClaimCashbackEvent":
      handleCashback(data, ctx);
      break;
    case "ClaimTokenIncentivesEvent":
      handleIncentiveClaim(data, ctx);
      break;

    // Fee sharing
    case "CreateFeeSharingConfigEvent":
      handleFeeSharingCreated(data, ctx);
      break;
    case "UpdateFeeSharesEvent":
      handleSharesUpdated(data, ctx);
      break;

    default:
      console.log(`[UNHANDLED] ${name}`);
  }
}
```

## Step 4: Handle Token Creation Events

```typescript
function handleCreate(data: any, ctx: EventContext) {
  console.log("🚀 NEW TOKEN CREATED");
  console.log(`  Name:     ${data.name}`);
  console.log(`  Symbol:   ${data.symbol}`);
  console.log(`  Mint:     ${data.mint.toBase58()}`);
  console.log(`  Creator:  ${data.creator.toBase58()}`);
  console.log(`  Mayhem:   ${data.isMayhemMode}`);
  console.log(`  Cashback: ${data.isCashbackEnabled}`);
  console.log(`  URI:      ${data.uri}`);
  console.log(`  Supply:   ${data.tokenTotalSupply.toString()}`);
  console.log(`  Tx:       ${ctx.signature}`);
}
```

## Step 5: Handle Trade Events

```typescript
interface TradeStats {
  totalBuys: number;
  totalSells: number;
  totalBuyVolumeSol: number;
  totalSellVolumeSol: number;
  totalFeesSol: number;
  totalCreatorFeesSol: number;
}

const tradeStats: TradeStats = {
  totalBuys: 0,
  totalSells: 0,
  totalBuyVolumeSol: 0,
  totalSellVolumeSol: 0,
  totalFeesSol: 0,
  totalCreatorFeesSol: 0,
};

function handleTrade(data: any, ctx: EventContext) {
  const solAmount = data.solAmount.toNumber() / 1e9;
  const tokenAmount = data.tokenAmount.toString();
  const fee = data.fee.toNumber() / 1e9;
  const creatorFee = data.creatorFee.toNumber() / 1e9;

  if (data.isBuy) {
    tradeStats.totalBuys++;
    tradeStats.totalBuyVolumeSol += solAmount;
  } else {
    tradeStats.totalSells++;
    tradeStats.totalSellVolumeSol += solAmount;
  }
  tradeStats.totalFeesSol += fee;
  tradeStats.totalCreatorFeesSol += creatorFee;

  const emoji = data.isBuy ? "📈" : "📉";
  const type = data.isBuy ? "BUY" : "SELL";

  console.log(`${emoji} ${type}: ${solAmount.toFixed(4)} SOL (${tokenAmount} tokens)`);
  console.log(`  Mint:        ${data.mint.toBase58()}`);
  console.log(`  User:        ${data.user.toBase58()}`);
  console.log(`  Fee:         ${fee.toFixed(6)} SOL (${data.feeBasisPoints.toString()} bps)`);
  console.log(`  Creator fee: ${creatorFee.toFixed(6)} SOL`);

  if (data.cashback.toNumber() > 0) {
    console.log(`  Cashback:    ${data.cashback.toNumber() / 1e9} SOL`);
  }

  // Whale alert
  if (solAmount >= 10) {
    console.log(`  🐋 WHALE ALERT: ${solAmount.toFixed(2)} SOL`);
  }
}
```

## Step 6: Handle AMM Events

```typescript
function handleAmmBuy(data: any, ctx: EventContext) {
  const quoteIn = data.quoteAmountIn.toNumber() / 1e9;
  const baseOut = data.baseAmountOut.toNumber();
  const lpFee = data.lpFee.toNumber() / 1e9;
  const protocolFee = data.protocolFee.toNumber() / 1e9;
  const creatorFee = data.coinCreatorFee.toNumber() / 1e9;

  console.log(`📈 AMM BUY: ${quoteIn.toFixed(4)} SOL → ${baseOut} tokens`);
  console.log(`  Pool:          ${data.pool.toBase58()}`);
  console.log(`  LP fee:        ${lpFee.toFixed(6)} SOL (${data.lpFeeBasisPoints.toString()} bps)`);
  console.log(`  Protocol fee:  ${protocolFee.toFixed(6)} SOL`);
  console.log(`  Creator fee:   ${creatorFee.toFixed(6)} SOL`);
}

function handleAmmSell(data: any, ctx: EventContext) {
  const baseIn = data.baseAmountIn.toNumber();
  const quoteOut = data.quoteAmountOut.toNumber() / 1e9;

  console.log(`📉 AMM SELL: ${baseIn} tokens → ${quoteOut.toFixed(4)} SOL`);
  console.log(`  Pool: ${data.pool.toBase58()}`);
}

function handleDeposit(data: any, ctx: EventContext) {
  const baseIn = data.baseAmountIn.toNumber();
  const quoteIn = data.quoteAmountIn.toNumber() / 1e9;
  const lpOut = data.lpTokenAmountOut.toNumber();

  console.log(`💧 DEPOSIT: ${baseIn} tokens + ${quoteIn.toFixed(4)} SOL → ${lpOut} LP tokens`);
  console.log(`  Pool: ${data.pool.toBase58()}`);
}

function handleWithdraw(data: any, ctx: EventContext) {
  const lpIn = data.lpTokenAmountIn.toNumber();
  const baseOut = data.baseAmountOut.toNumber();
  const quoteOut = data.quoteAmountOut.toNumber() / 1e9;

  console.log(`🔥 WITHDRAW: ${lpIn} LP → ${baseOut} tokens + ${quoteOut.toFixed(4)} SOL`);
}
```

## Step 7: Handle Fee Events

```typescript
function handleFeeCollection(data: any, ctx: EventContext) {
  const amount = data.creatorFee.toNumber() / 1e9;
  console.log(`💰 CREATOR FEE COLLECTED: ${amount.toFixed(6)} SOL`);
  console.log(`  Creator: ${data.creator.toBase58()}`);
}

function handleCashback(data: any, ctx: EventContext) {
  const amount = data.amount.toNumber() / 1e9;
  console.log(`🎁 CASHBACK CLAIMED: ${amount.toFixed(6)} SOL`);
  console.log(`  User: ${data.user.toBase58()}`);
  console.log(`  Total claimed: ${data.totalClaimed.toNumber() / 1e9} SOL`);
}

function handleIncentiveClaim(data: any, ctx: EventContext) {
  console.log(`🏆 INCENTIVE CLAIMED: ${data.amount.toString()} tokens`);
  console.log(`  User: ${data.user.toBase58()}`);
  console.log(`  Mint: ${data.mint.toBase58()}`);
}

function handleComplete(data: any, ctx: EventContext) {
  console.log(`🎓 BONDING CURVE COMPLETE`);
  console.log(`  Mint: ${data.mint.toBase58()}`);
  console.log(`  Ready for migration to PumpAMM`);
}

function handleMigration(data: any, ctx: EventContext) {
  const solAmount = data.solAmount.toNumber() / 1e9;
  console.log(`🚀 MIGRATED TO PUMAMM`);
  console.log(`  Mint:     ${data.mint.toBase58()}`);
  console.log(`  Pool:     ${data.pool.toBase58()}`);
  console.log(`  SOL:      ${solAmount.toFixed(4)} SOL`);
  console.log(`  Tokens:   ${data.mintAmount.toString()}`);
}

function handleFeeSharingCreated(data: any, ctx: EventContext) {
  console.log(`📋 FEE SHARING CONFIG CREATED`);
  console.log(`  Mint: ${data.mint.toBase58()}`);
  console.log(`  Shareholders: ${data.initialShareholders.length}`);
}

function handleSharesUpdated(data: any, ctx: EventContext) {
  console.log(`✏️ FEE SHARES UPDATED`);
  console.log(`  Mint: ${data.mint.toBase58()}`);
  for (const s of data.newShareholders) {
    console.log(`  - ${s.address.toBase58()}: ${s.shareBps} bps (${s.shareBps / 100}%)`);
  }
}
```

## Step 8: Build an Analytics Aggregator

```typescript
interface TokenAnalytics {
  mint: string;
  totalBuys: number;
  totalSells: number;
  volumeSol: number;
  uniqueTraders: Set<string>;
  lastTrade: number;
}

const tokenMap = new Map<string, TokenAnalytics>();

function aggregateTrade(data: any) {
  const mint = data.mint.toBase58();
  const existing = tokenMap.get(mint) || {
    mint,
    totalBuys: 0,
    totalSells: 0,
    volumeSol: 0,
    uniqueTraders: new Set<string>(),
    lastTrade: 0,
  };

  if (data.isBuy) existing.totalBuys++;
  else existing.totalSells++;

  existing.volumeSol += data.solAmount.toNumber() / 1e9;
  existing.uniqueTraders.add(data.user.toBase58());
  existing.lastTrade = Date.now();

  tokenMap.set(mint, existing);
}

// Print top tokens by volume every 30 seconds
setInterval(() => {
  const sorted = [...tokenMap.values()]
    .sort((a, b) => b.volumeSol - a.volumeSol)
    .slice(0, 10);

  console.log("\n=== TOP 10 TOKENS BY VOLUME ===");
  for (const t of sorted) {
    console.log(
      `${t.mint.slice(0, 8)}... | ` +
      `Vol: ${t.volumeSol.toFixed(2)} SOL | ` +
      `Buys: ${t.totalBuys} | Sells: ${t.totalSells} | ` +
      `Traders: ${t.uniqueTraders.size}`
    );
  }
}, 30_000);
```

## Step 9: Historical Event Parsing

Parse events from existing transactions:

```typescript
async function parseHistoricalTx(signature: string) {
  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx?.meta?.logMessages) {
    console.log("No logs found");
    return;
  }

  // Try each parser
  for (const event of pumpParser.parseLogs(tx.meta.logMessages)) {
    console.log(`[PUMP] ${event.name}:`, event.data);
  }
  for (const event of ammParser.parseLogs(tx.meta.logMessages)) {
    console.log(`[AMM] ${event.name}:`, event.data);
  }
  for (const event of feesParser.parseLogs(tx.meta.logMessages)) {
    console.log(`[FEES] ${event.name}:`, event.data);
  }
}
```

## Cleanup

```typescript
// Unsubscribe when done
await connection.removeOnLogsListener(pumpSubId);
await connection.removeOnLogsListener(ammSubId);
await connection.removeOnLogsListener(feesSubId);
```

## Next Steps

- Combine with [Tutorial 21](./21-websocket-realtime-feeds.md) to relay parsed events to browsers
- Use [Tutorial 28](./28-analytics-price-quotes.md) to add pricing data to events
- Build a full dashboard with [Tutorial 26](./26-live-dashboard-deployment.md)
