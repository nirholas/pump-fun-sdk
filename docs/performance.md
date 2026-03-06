# Performance & Benchmarks

Performance characteristics, benchmarks, and optimization tips for every component.

---

## Vanity Address Generation

### Rust vs TypeScript Performance

| Implementation | Speed | Language | Threading |
|---------------|-------|----------|-----------|
| Rust (`rust/`) | ~100K+ keys/sec | Rust | Multi-threaded (Rayon) |
| TypeScript (`typescript/`) | ~1K keys/sec | TypeScript | Single-threaded |

The Rust generator is **~100x faster** — use it for production vanity generation.

### Time Estimates by Pattern Length

For the Rust generator on an 8-core machine:

| Pattern Length | Avg Time | Expected Attempts |
|---------------|----------|-------------------|
| 1 char | Instant | ~58 |
| 2 chars | Instant | ~3,364 |
| 3 chars | < 1s | ~195,112 |
| 4 chars | 2-5s | ~11.3M |
| 5 chars | 2-5 min | ~656M |
| 6 chars | 2-8 hours | ~38B |
| 7 chars | Days | ~2.2T |

> Base58 has 58 possible characters per position. Case-insensitive mode roughly doubles the speed (matches both cases).

### Optimizing Generation

```bash
# Use all CPU cores (Rayon auto-detects)
cd rust && cargo run --release -- --prefix SOL --output key.json

# Case-insensitive doubles match rate
cargo run --release -- --prefix sol --case-insensitive --output key.json

# Suffix matching (checks end of address)
cargo run --release -- --suffix pump --output key.json
```

---

## Core SDK Performance

### Instruction Building (Offline)

All `PumpSdk` methods are synchronous I/O-free operations:

| Operation | Time | Memory |
|-----------|------|--------|
| `buyInstructions()` | < 1ms | < 1KB |
| `sellInstructions()` | < 1ms | < 1KB |
| `createV2Instruction()` | < 1ms | < 2KB |
| `createV2AndBuyInstructions()` | < 1ms | < 3KB |
| Bonding curve math (quote) | < 0.1ms | < 100B |
| PDA derivation | < 0.5ms | < 200B |

These are pure functions with no async overhead — safe to call in hot paths.

### Online SDK (With RPC)

Performance depends entirely on RPC latency:

| Operation | RPC Calls | Typical Latency |
|-----------|-----------|-----------------|
| `fetchBondingCurve(mint)` | 1 | 50-200ms |
| `fetchTokenInfo(mint)` | 1 HTTP | 100-500ms |
| `fetchCreatorProfile(address)` | 1 HTTP | 100-500ms |
| `getCreatorVaultBalanceBothPrograms()` | 2 | 100-400ms |
| `getTotalUnclaimedTokensBothPrograms()` | 4 | 200-800ms |

### BN.js Performance

`BN` (arbitrary-precision integers) is slower than native `number` but necessary for correctness:

| Operation | BN | Native Number |
|-----------|----|---------------|
| Addition | ~200ns | ~1ns |
| Multiplication | ~400ns | ~1ns |
| Division | ~600ns | ~1ns |

This is negligible in practice — a full quote calculation with BN takes < 0.1ms.

---

## WebSocket Relay

### Connection Capacity

| Metric | Value | Notes |
|--------|-------|-------|
| Concurrent WebSocket connections | ~10K | Per 1 vCPU instance |
| Message throughput | ~50K msg/sec | Broadcasting to all clients |
| Memory per connection | ~1KB | Minimal state |
| Backfill on connect | 50 tokens | Sent immediately on new connection |
| Dedup cache size | 5,000 mints | Rolling set, ~500KB memory |

### Polling Frequency

| Source | Default Interval | Configurable |
|--------|-----------------|--------------|
| PumpFun HTTP API | 5s | `POLL_INTERVAL_MS` |
| Solana RPC WebSocket | Real-time | — |
| Heartbeat | 30s | — |

---

## Telegram Bot

### Event Processing

| Metric | Value |
|--------|-------|
| Transaction processing | ~50 TX/sec |
| Claim detection latency | < 2s (WebSocket), < 10s (polling fallback) |
| Message sending rate | Telegram limit: 30 msg/sec per bot |
| Watch list capacity | Unlimited (SQLite-backed) |
| Claim history | Last 50K entries (LRU for channel bot) |

### REST API Performance

| Endpoint | Latency | Rate Limit |
|----------|---------|------------|
| `GET /api/v1/claims` | < 50ms | 100 req/min |
| `GET /api/v1/claims/stream` (SSE) | Real-time | 10 concurrent |
| `GET /api/v1/watches` | < 10ms | 100 req/min |

---

## Live Dashboards

### Browser Performance

| Dashboard | Initial Load | Memory | CPU (idle) |
|-----------|-------------|--------|------------|
| Token Launches (`index.html`) | ~200KB | ~20MB | < 1% |
| Trades (`trades.html`) | ~250KB | ~30MB | < 2% |
| Vanity Generator (`vanity.html`) | ~150KB | ~15MB | Up to 100% (during generation) |

> The vanity generator runs in the browser's main thread — it will use one CPU core at 100% during generation. Consider using Web Workers for non-blocking generation.

---

## Plugin Delivery API

### Endpoint Latency

All endpoints run on Vercel Edge Functions (globally distributed):

| Endpoint Category | Latency | Notes |
|------------------|---------|-------|
| pump-fun-sdk (RPC) | 100-500ms | Depends on Solana RPC latency |
| coingecko | 200-800ms | External API call |
| defillama | 200-600ms | External API call |
| dexscreener | 100-400ms | External API call |
| Static data (labels, grants) | < 50ms | No external calls |

### Cold Start

Vercel Edge Functions have near-zero cold start (~5ms). No concern for latency.

---

## Optimization Tips

### For Trading Bots

1. **Use offline SDK for quoting** — No RPC call needed for price calculations
2. **Cache bonding curve state** — Fetch once, quote multiple times
3. **Batch instructions** — Combine buy + fee claim in one transaction
4. **Pre-compute PDAs** — PDA derivation is deterministic, cache the results
5. **Use `confirmed` commitment** — Faster than `finalized`, reliable enough for trading

### For Monitoring

1. **Prefer WebSocket over polling** — 10x lower latency, 95% less RPC usage
2. **Implement HTTP polling fallback** — WebSocket connections drop; polling is reliable
3. **Deduplicate events** — Keep a rolling set of processed TX signatures
4. **Batch account lookups** — `getMultipleAccountsInfo` for multiple mints at once
5. **Cache token metadata** — Metadata doesn't change after creation

### For Frontend

1. **Use the WebSocket relay** — Don't connect directly to Solana RPC from browsers
2. **Lazy-load chart data** — Only fetch price history when user opens a chart
3. **Debounce user input** — Don't fire RPC calls on every keystroke
4. **Show cached data immediately** — Update in background, show stale data with a "refreshing" indicator

### For CI/CD

1. **Use public RPC for tests** — No paid plan needed for CI
2. **Mock RPC in unit tests** — Never hit the network in unit tests
3. **Run Rust and TypeScript tests in parallel** — They're independent
4. **Set `--max-workers=2` for Jest** — Prevents CPU contention in containers
