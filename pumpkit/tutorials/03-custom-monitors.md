# Build Custom Event Monitors

> Extend BaseMonitor to create your own event detector, subscribe to specific Solana program logs, and wire alerts to Telegram.

## What You'll Build

A custom monitor that watches a **specific token's** bonding curve for buy/sell trades and sends Telegram alerts when trades exceed a threshold. You'll learn the BaseMonitor pattern that powers all of PumpKit's built-in monitors.

```
Solana RPC (WebSocket)
    │
    ▼
YourTokenMonitor extends BaseMonitor
    │
    ├── Subscribes to Pump program logs
    ├── Filters by your target token mint
    ├── Decodes buy/sell amounts
    │
    ▼
Telegram notification
```

## Prerequisites

- Node.js 20+
- Completed [Tutorial 01](01-your-first-bot.md) (familiar with @pumpkit/core basics)
- A Solana RPC URL with WebSocket support

## Step 1: Understand the BaseMonitor Pattern

Every monitor in PumpKit extends `BaseMonitor`. Here's how it works:

```typescript
import { BaseMonitor } from "@pumpkit/core";

// BaseMonitor provides:
// - start() / stop()     → lifecycle management
// - status()             → { running, lastEvent, eventsProcessed }
// - recordEvent()        → increment event counter + timestamp
// - this.log.*           → prefixed logger (debug, info, warn, error)
```

The built-in monitors follow this contract:

| Monitor | Program | Event |
|---------|---------|-------|
| `ClaimMonitor` | PumpFees | Fee claims (social, creator, cashback) |
| `LaunchMonitor` | Pump | New token creation |
| `GraduationMonitor` | Pump | Bonding curve completion |
| `WhaleMonitor` | Pump / PumpAMM | Large trades (configurable min SOL) |
| `CTOMonitor` | Pump | Creator authority transfers |
| `FeeDistMonitor` | PumpFees | Fee distribution events |

## Step 2: Create Your Project

```bash
mkdir token-watcher && cd token-watcher
npm init -y
npm install @pumpkit/core grammy @solana/web3.js dotenv
npm install -D typescript tsx @types/node
npx tsc --init --target ES2020 --module nodenext --moduleResolution nodenext --outDir dist --strict
```

Create `.env`:

```bash
TELEGRAM_BOT_TOKEN=your-bot-token
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key
# The token mint address you want to monitor
TARGET_MINT=YourTokenMintAddressHere
```

## Step 3: Extend BaseMonitor

Create `src/token-trade-monitor.ts`:

```typescript
import { Connection, PublicKey, Logs } from "@solana/web3.js";
import {
  BaseMonitor,
  PUMP_PROGRAM_ID,
  decodePumpLogs,
  log,
} from "@pumpkit/core";

export interface TradeEvent {
  signature: string;
  mint: string;
  type: "buy" | "sell";
  solAmount: number;
  tokenAmount: number;
  user: string;
  timestamp: number;
}

export interface TokenTradeMonitorOptions {
  connection: Connection;
  targetMint: string;
  onTrade: (event: TradeEvent) => void | Promise<void>;
  minSolAmount?: number;
}

export class TokenTradeMonitor extends BaseMonitor {
  private subscriptionId: number | null = null;
  private readonly connection: Connection;
  private readonly targetMint: string;
  private readonly onTrade: (event: TradeEvent) => void | Promise<void>;
  private readonly minSolAmount: number;
  private readonly seen = new Set<string>();

  constructor(options: TokenTradeMonitorOptions) {
    super("TokenTradeMonitor");
    this.connection = options.connection;
    this.targetMint = options.targetMint;
    this.onTrade = options.onTrade;
    this.minSolAmount = options.minSolAmount ?? 0;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this.log.info(`Monitoring trades for ${this.targetMint.slice(0, 8)}…`);
    this.subscribe();
  }

  stop(): void {
    this._running = false;
    if (this.subscriptionId !== null) {
      this.connection
        .removeOnLogsListener(this.subscriptionId)
        .catch(() => {});
      this.subscriptionId = null;
    }
    this.log.info("Stopped");
  }

  private subscribe(): void {
    try {
      this.subscriptionId = this.connection.onLogs(
        new PublicKey(PUMP_PROGRAM_ID),
        (logInfo: Logs) => this.handleLog(logInfo),
        "confirmed"
      );
      this.log.info("WebSocket subscription active");
    } catch (err) {
      this.log.error("Failed to subscribe:", err);
    }
  }

  private handleLog(logInfo: Logs): void {
    const { signature, logs } = logInfo;

    // Deduplicate by signature
    if (this.seen.has(signature)) return;
    this.seen.add(signature);

    // Cap dedup set size to prevent memory leak
    if (this.seen.size > 50_000) {
      const entries = [...this.seen];
      for (let i = 0; i < 25_000; i++) {
        this.seen.delete(entries[i]!);
      }
    }

    // Check if this transaction involves our target mint
    const logsText = logs.join("\n");
    if (!logsText.includes(this.targetMint)) return;

    // Decode the event
    const decoded = decodePumpLogs(logs);
    if (!decoded) return;

    // Determine if it's a buy or sell
    const isBuy = logsText.includes("Program log: Instruction: Buy");
    const isSell = logsText.includes("Program log: Instruction: Sell");
    if (!isBuy && !isSell) return;

    const trade: TradeEvent = {
      signature,
      mint: this.targetMint,
      type: isBuy ? "buy" : "sell",
      solAmount: decoded.solAmount ?? 0,
      tokenAmount: decoded.tokenAmount ?? 0,
      user: decoded.user ?? "unknown",
      timestamp: Date.now(),
    };

    // Apply minimum SOL filter
    if (trade.solAmount < this.minSolAmount) return;

    this.recordEvent();
    Promise.resolve(this.onTrade(trade)).catch((err) =>
      this.log.error("Callback error:", err)
    );
  }
}
```

## Step 4: Wire It to Telegram

Create `src/index.ts`:

```typescript
import "dotenv/config";
import {
  createBot,
  createRpcConnection,
  requireEnv,
  installShutdownHandlers,
  bold,
  code,
  formatSol,
  solscanTx,
  pumpFunToken,
} from "@pumpkit/core";
import { TokenTradeMonitor, type TradeEvent } from "./token-trade-monitor.js";

// ── Config ───────────────────────────────────────────────
const token = requireEnv("TELEGRAM_BOT_TOKEN");
const rpcUrl = requireEnv("SOLANA_RPC_URL");
const targetMint = requireEnv("TARGET_MINT");

// ── Setup ────────────────────────────────────────────────
const connection = createRpcConnection(rpcUrl);
const bot = createBot({ token });

const subscribedChats = new Set<number>();

bot.command("start", (ctx) => {
  subscribedChats.add(ctx.chat.id);
  return ctx.reply(
    `👀 Watching trades for ${targetMint.slice(0, 8)}…\nMinimum: 1 SOL`
  );
});

bot.command("status", async (ctx) => {
  const s = monitor.status();
  return ctx.reply(
    `Running: ${s.running}\n` +
    `Events: ${s.eventsProcessed}\n` +
    `Last event: ${s.lastEvent ? new Date(s.lastEvent).toISOString() : "none"}`
  );
});

// ── Format trade alerts ──────────────────────────────────
function formatTrade(event: TradeEvent): string {
  const emoji = event.type === "buy" ? "🟢" : "🔴";
  const action = event.type === "buy" ? "BUY" : "SELL";
  return [
    `${emoji} ${bold(action)} — ${formatSol(event.solAmount)} SOL`,
    `Token: ${pumpFunToken(event.mint)}`,
    `Tx: ${solscanTx(event.signature)}`,
    `User: ${code(event.user.slice(0, 8))}…`,
  ].join("\n");
}

// ── Monitor ──────────────────────────────────────────────
const monitor = new TokenTradeMonitor({
  connection,
  targetMint,
  minSolAmount: 1, // Only trades ≥ 1 SOL
  onTrade: async (event) => {
    const message = formatTrade(event);
    for (const chatId of subscribedChats) {
      await bot.api
        .sendMessage(chatId, message, { parse_mode: "HTML" })
        .catch(() => {}); // Ignore send failures
    }
  },
});

// ── Launch ───────────────────────────────────────────────
monitor.start();
bot.start();
installShutdownHandlers();
console.log(`🚀 Monitoring trades for ${targetMint.slice(0, 8)}…`);
```

## Step 5: Run and Test

```bash
npx tsx src/index.ts
```

Expected output:

```
[INFO] TokenTradeMonitor: Monitoring trades for YourToke…
[INFO] TokenTradeMonitor: WebSocket subscription active
🚀 Monitoring trades for YourToke…
```

Send `/start` to your bot, then wait for trades on your target token. Send `/status` to check event counts.

## Step 6: Subscribe to Multiple Programs

You can monitor multiple programs by creating separate subscriptions. Here's a monitor that watches both the Pump bonding curve and PumpAMM (post-graduation):

```typescript
import {
  BaseMonitor,
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
} from "@pumpkit/core";

export class DualProgramMonitor extends BaseMonitor {
  private subscriptionIds: number[] = [];

  constructor(private connection: Connection, private onEvent: (data: unknown) => void) {
    super("DualProgramMonitor");
  }

  start(): void {
    if (this._running) return;
    this._running = true;

    // Subscribe to bonding curve program
    const id1 = this.connection.onLogs(
      new PublicKey(PUMP_PROGRAM_ID),
      (logInfo) => this.handle(logInfo, "bonding-curve"),
      "confirmed"
    );
    this.subscriptionIds.push(id1);

    // Subscribe to AMM program
    const id2 = this.connection.onLogs(
      new PublicKey(PUMP_AMM_PROGRAM_ID),
      (logInfo) => this.handle(logInfo, "amm"),
      "confirmed"
    );
    this.subscriptionIds.push(id2);

    this.log.info("Subscribed to Pump + PumpAMM programs");
  }

  stop(): void {
    this._running = false;
    for (const id of this.subscriptionIds) {
      this.connection.removeOnLogsListener(id).catch(() => {});
    }
    this.subscriptionIds = [];
  }

  private handle(logInfo: Logs, source: string): void {
    this.recordEvent();
    this.onEvent({ signature: logInfo.signature, source, logs: logInfo.logs });
  }
}
```

## Step 7: Add WebSocket Reconnection

Production monitors should handle WebSocket drops gracefully:

```typescript
private scheduleReconnect(): void {
  if (!this._running) return;
  
  const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
  this.reconnectAttempts++;
  
  this.log.warn(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
  
  setTimeout(() => {
    if (this._running) {
      this.subscribe();
    }
  }, delay);
}
```

Add this to your monitor's `subscribe()` error handler and WebSocket `onclose` callback. The built-in monitors (`ClaimMonitor`, `LaunchMonitor`, etc.) already handle this.

## How the Built-in Monitors Work

All built-in monitors follow the same pattern:

```
1. Extend BaseMonitor
2. In start(): subscribe to program logs via WebSocket
3. In handleLog(): decode logs → filter → callback
4. In stop(): remove subscription + clear timers
5. Dedup by transaction signature (Set<string>)
6. Cap dedup set to prevent memory leaks
7. Reconnect with exponential backoff on failure
```

### Creating a Composite Monitor

The `@pumpkit/monitor` package orchestrates multiple monitors together:

```typescript
import {
  ClaimMonitor,
  LaunchMonitor,
  GraduationMonitor,
  WhaleMonitor,
} from "@pumpkit/core";

// Start all monitors
const monitors = [
  new ClaimMonitor({ connection, onClaim: handleClaim }),
  new LaunchMonitor({ connection, onLaunch: handleLaunch }),
  new GraduationMonitor({ connection, onGraduation: handleGraduation }),
  new WhaleMonitor({ connection, onWhaleTrade: handleWhale, minSol: 10 }),
];

monitors.forEach((m) => m.start());

// Check all statuses
const statuses = monitors.map((m) => m.status());
```

## Common Issues

| Issue | Fix |
|-------|-----|
| No events firing | Verify your `TARGET_MINT` is an active token with recent trades |
| `decodePumpLogs` returns null | The transaction may not contain decodable Pump events — check log format |
| Dedup set growing unbounded | Cap it (see Step 3 — `if (this.seen.size > 50_000)`) |
| WebSocket disconnects | Add reconnection logic (Step 7) |

## Next Steps

- [04 — Group Tracker](04-group-tracker.md): Set up call tracking and leaderboards in a Telegram group
- [05 — Deploy to Railway](05-deploy-railway.md): Ship your custom monitor to production
- [06 — Webhooks & API](06-add-webhooks-api.md): Expose your monitor's events via REST + SSE
