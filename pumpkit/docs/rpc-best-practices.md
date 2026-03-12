# RPC Best Practices

How to configure, optimize, and troubleshoot Solana RPC connections in the Pump SDK ecosystem.

---

## Provider Selection

### Free vs Paid

| Aspect | Free (Public) | Paid Provider |
|--------|---------------|---------------|
| Rate limit | 40 req/sec (shared) | 500-5000+ req/sec (dedicated) |
| Reliability | ≤95% uptime, frequent 429s | ≥99.9% SLA |
| WebSocket | Often unstable | Persistent, reliable |
| Priority | Lowest | Configurable |
| Geographic | US-only | Multi-region |
| Cost | Free | $49-500+/mo |

**Recommendation:** Use paid RPC for anything user-facing or monitoring real-time events. Free is fine for development and CI.

### Recommended Providers

| Provider | Strengths | Best For |
|----------|-----------|----------|
| [Helius](https://helius.dev) | DAS API, webhooks, enhanced TX | Token metadata, analytics |
| [Alchemy](https://alchemy.com) | Reliability, multi-chain | Production apps |
| [QuickNode](https://quicknode.com) | Fastest raw RPC | Trading bots |
| [Triton](https://triton.one) | Dedicated validators, Geyser | High-frequency monitoring |

---

## Connection Configuration

### Basic Setup

```typescript
import { Connection } from "@solana/web3.js";

// Use HTTPS for RPC, WSS for WebSocket
const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  {
    commitment: "confirmed",           // Good balance of speed vs finality
    wsEndpoint: process.env.SOLANA_WS_URL,  // Explicit WebSocket URL
    httpHeaders: {
      "Authorization": `Bearer ${process.env.RPC_API_KEY}`,  // If provider requires it
    },
  }
);
```

### Commitment Levels

| Level | Latency | Finality | Use Case |
|-------|---------|----------|----------|
| `processed` | ~400ms | May revert | Read-after-write in same TX |
| `confirmed` | ~2-5s | 66%+ validators | **Recommended default** |
| `finalized` | ~12-15s | 31+ slots | Financial settlements, irreversible |

**Rule of thumb:**
- **Monitoring / feeds:** `confirmed` — fast enough for notifications
- **Trade execution:** `confirmed` — wait for confirmation before showing success
- **Balance queries:** `confirmed` — accurate within seconds
- **Fee collection:** `finalized` — must be irreversible

---

## Rate Limiting & Throttling

### Built-in Retry Logic

Implement exponential backoff for 429 (Too Many Requests) responses:

```typescript
async function rpcWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error?.message?.includes("429") && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}
```

### Request Batching

Combine multiple calls into batched RPC requests:

```typescript
// ❌ Bad: 10 sequential calls
for (const mint of mints) {
  const info = await connection.getAccountInfo(mint);
}

// ✅ Good: 1 batched call
const infos = await connection.getMultipleAccountsInfo(mints);
```

### Rate Limit Guidelines

| Provider | Requests/sec | Burst | Mitigation |
|----------|-------------|-------|------------|
| Public | 40 (shared) | None | Use `sleep(100)` between calls |
| Helius Free | 10 | 50 | Batch `getMultipleAccountsInfo` |
| Helius Pro | 500 | 1000 | No throttling needed for most use cases |
| Alchemy Growth | 660 | 1000 | No throttling needed |

---

## Failover & Redundancy

### Multi-Provider Setup

```typescript
const RPC_ENDPOINTS = [
  process.env.PRIMARY_RPC_URL,       // Helius
  process.env.SECONDARY_RPC_URL,     // Alchemy (backup)
  "https://api.mainnet-beta.solana.com",  // Public (last resort)
].filter(Boolean);

let currentIndex = 0;

function getConnection(): Connection {
  return new Connection(RPC_ENDPOINTS[currentIndex]!, { commitment: "confirmed" });
}

function failover(): Connection {
  currentIndex = (currentIndex + 1) % RPC_ENDPOINTS.length;
  console.warn(`RPC failover to endpoint ${currentIndex}`);
  return getConnection();
}
```

### Health Checking

Test your RPC connection before starting monitors:

```typescript
async function checkRpcHealth(connection: Connection): Promise<boolean> {
  try {
    const slot = await connection.getSlot();
    const blockTime = await connection.getBlockTime(slot);
    const now = Math.floor(Date.now() / 1000);
    const lag = now - (blockTime || 0);

    if (lag > 30) {
      console.warn(`RPC is ${lag}s behind — may be degraded`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
```

---

## WebSocket Subscriptions

### Log Subscriptions (Monitoring)

The Telegram bot and channel bot use `onLogs` for real-time event detection:

```typescript
const subscriptionId = connection.onLogs(
  PUMP_PROGRAM_ID,
  (logs) => {
    // Process logs
  },
  "confirmed"
);

// ALWAYS clean up subscriptions
process.on("SIGTERM", () => {
  connection.removeOnLogsListener(subscriptionId);
});
```

### WebSocket Stability

WebSocket connections drop frequently. Always implement reconnection:

```typescript
let wsSubscription: number | null = null;

function subscribe() {
  wsSubscription = connection.onLogs(PUMP_PROGRAM_ID, handleLogs, "confirmed");
}

// Reconnect every 5 minutes (preventive)
setInterval(() => {
  if (wsSubscription !== null) {
    connection.removeOnLogsListener(wsSubscription);
  }
  subscribe();
}, 5 * 60 * 1000);
```

**Key facts:**
- Solana WebSocket connections timeout after ~5 minutes of inactivity
- Providers may disconnect during maintenance windows
- Always have HTTP polling as fallback (the Telegram bot does this)

---

## Cost Optimization

### Minimize Calls

| Instead of | Use | Savings |
|------------|-----|---------|
| N × `getAccountInfo` | 1 × `getMultipleAccountsInfo` | 90%+ |
| Polling every 1s | WebSocket subscription | 95%+ |
| Fetching full TX | `getTransaction` with `maxSupportedTransactionVersion: 0` | Smaller response |
| Repeated price lookups | Cache with 5-10s TTL | 80%+ |

### Cache Frequently Accessed Data

```typescript
const PRICE_CACHE = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 10_000; // 10 seconds

async function getSolPrice(): Promise<number> {
  const cached = PRICE_CACHE.get("SOL/USD");
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  const price = await fetchFromJupiter();
  PRICE_CACHE.set("SOL/USD", { price, timestamp: Date.now() });
  return price;
}
```

### What to Cache vs What to Fetch Live

| Data | Cache? | TTL | Reason |
|------|--------|-----|--------|
| SOL/USD price | ✅ | 10-60s | Changes slowly relative to query volume |
| Bonding curve state | ✅ | 5s | Changes with every trade |
| Token metadata | ✅ | 1 hour | Immutable after creation |
| Creator profile | ✅ | 5 min | Rarely changes |
| Transaction status | ❌ | — | Must be real-time |
| Account balances | ❌ | — | Must be current for trading |

---

## Troubleshooting

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `429 Too Many Requests` | Rate limit exceeded | Add retry with backoff, reduce request frequency |
| `503 Service Unavailable` | RPC node overloaded | Failover to secondary provider |
| `Blockhash not found` | TX sent with expired blockhash | Use `getLatestBlockhash` immediately before signing |
| `Transaction simulation failed` | Insufficient funds, invalid accounts | Check balances, verify account addresses |
| `WebSocket disconnected` | Connection timeout or provider restart | Implement auto-reconnection |
| `AccountNotFound` | Querying non-existent account | Verify address, check if account was closed |

### Debugging Slow Queries

```bash
# Measure RPC latency
time curl -s -X POST "${SOLANA_RPC_URL}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getSlot"}' | jq '.result'

# Check slot lag (should be < 5)
curl -s -X POST "${SOLANA_RPC_URL}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```
