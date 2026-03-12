# Performance & Benchmarks

Performance characteristics, benchmarks, and optimization tips for PumpKit bot components.

---

## Telegram Bot Performance

### Event Processing

| Metric | Value | Notes |
|--------|-------|-------|
| Transaction processing | ~50 TX/sec | Per bot instance |
| Claim detection latency | < 2s (WebSocket) | Real-time via `logsSubscribe` |
| Claim detection latency | < 10s (polling) | HTTP fallback mode |
| Message sending rate | 30 msg/sec | Telegram rate limit per bot token |
| Bot command response | < 500ms | Includes RPC fetch + format |

### Telegram Rate Limits

| Scope | Limit | Mitigation |
|-------|-------|------------|
| Per bot (global) | 30 msg/sec | Queue messages, batch notifications |
| Per chat (group) | 20 msg/min | Aggregate events into single messages |
| Inline queries | 200/sec | Not applicable for PumpKit bots |
| File uploads | 10 MB max | PNL cards are ~50KB (well under limit) |

> Exceeding Telegram limits triggers 429 errors with `retry_after` headers. All PumpKit bots respect these automatically via grammy's built-in flood control.

---

## Solana RPC Performance

### Connection Modes

| Mode | Latency | Reliability | Cost |
|------|---------|-------------|------|
| WebSocket (`logsSubscribe`) | < 2s | Medium (disconnects) | Free tier: limited |
| HTTP Polling (`getSignaturesForAddress`) | 5-60s | High | 1 call/interval |
| Dual (WS primary + HTTP fallback) | < 2s typical | High | Recommended |

### RPC Call Benchmarks

| Operation | Calls | Typical Latency | Notes |
|-----------|-------|-----------------|-------|
| `getSignaturesForAddress` | 1 | 50-200ms | Primary polling method |
| `getParsedTransaction` | 1 | 100-500ms | Decode claim details |
| `getAccountInfo` | 1 | 50-200ms | Read bonding curve state |
| `logsSubscribe` (WebSocket) | Stream | Real-time | May disconnect under load |

### RPC Rate Limits by Provider

| Provider | Free Tier | Paid Tier | Notes |
|----------|-----------|-----------|-------|
| Solana Public | 40 req/s | N/A | Unreliable for production |
| Helius | 10 req/s | 100+ req/s | Recommended |
| QuickNode | 25 req/s | 500+ req/s | Good WebSocket support |
| Triton | 10 req/s | 200+ req/s | Dedicated endpoints |

### RPC Optimization Tips

```typescript
// ✅ Batch multiple account reads into one call
const accounts = await connection.getMultipleAccountsInfo([key1, key2, key3]);

// ❌ Don't make sequential calls for independent data
const a = await connection.getAccountInfo(key1);
const b = await connection.getAccountInfo(key2); // wasted round-trip
```

**PumpKit patterns:**
- `rpc-fallback.ts` rotates through multiple RPC endpoints on 429/5xx errors
- Failed endpoints get 60s cooldown before retry
- WebSocket auto-reconnects with exponential backoff

---

## Monitor Bot (`@pumpkit/monitor`)

### Watch Capacity

| Metric | Value | Notes |
|--------|-------|-------|
| Watched wallets | Unlimited | JSON file persistence |
| Claim history buffer | 50K entries | LRU eviction (channel mode) |
| Memory baseline | ~50MB | Node.js + dependencies |
| Memory per 1K watches | ~2MB | Minimal per-watch overhead |

### REST API Performance

| Endpoint | Latency | Rate Limit |
|----------|---------|------------|
| `GET /api/v1/health` | < 5ms | Unlimited |
| `GET /api/v1/claims` | < 50ms | 100 req/min |
| `GET /api/v1/claims/stream` (SSE) | Real-time | 10 concurrent |
| `GET /api/v1/watches` | < 10ms | 100 req/min |
| `POST /api/v1/watches` | < 20ms | 100 req/min |
| Webhook dispatch | < 100ms | Per event |

### Event Processing Pipeline

```
Solana RPC → Event Queue → Decoder → Filter → Format → Telegram API
                            │                            │
                            └── RPC Queue ───────────────┘
                            (1 req/sec throttle)
```

Bottleneck is Telegram's 30 msg/sec limit, not event detection.

---

## Tracker Bot (`@pumpkit/tracker`)

### SQLite Performance

| Operation | Latency | Notes |
|-----------|---------|-------|
| Insert call | < 1ms | WAL mode enabled |
| Leaderboard query | < 5ms | Indexed by group_id + timeframe |
| User lookup | < 1ms | Indexed by telegram_id |
| ATH update batch | < 10ms | Bulk UPDATE for active calls |

### DexScreener API

| Metric | Value | Notes |
|--------|-------|-------|
| API calls per poll | 1 per active call | Batched where possible |
| Poll interval | 60s default | Configurable via env |
| Cache TTL | 5 min | Token info cache |
| Rate limit | 300 req/min | DexScreener free tier |

### PNL Card Generation

| Metric | Canvas Mode | Text Fallback |
|--------|-------------|---------------|
| Generation time | ~50ms | < 1ms |
| Output size | ~40-80KB PNG | ~500 bytes text |
| Memory per card | ~5MB (canvas) | Negligible |
| Dependency | `canvas` (native) | None |

---

## Channel Bot (`@pumpkit/channel`)

### Feed Throughput

| Feed | Events/Hour (typical) | Notes |
|------|----------------------|-------|
| Token Launches | 200-500 | Depends on PumpFun activity |
| Graduations | 10-50 | ~5% of launches graduate |
| Whale Trades | 50-200 | Threshold-dependent |
| Fee Claims | 20-100 | Varies by creator activity |

### Data Enrichment Latency

| Source | Latency | Cache TTL | Notes |
|--------|---------|-----------|-------|
| PumpFun API | 100-500ms | 1 min | Token metadata |
| GitHub API | 50-200ms | 10 min | Repo stats, user profiles |
| Twitter/X API | 100-300ms | 10 min | Follower counts |
| DexScreener API | 100-300ms | 5 min | AMM liquidity data |
| Groq AI summary | 500-2000ms | None | One-shot LLM call |

---

## Deployment Performance

### Railway (Recommended)

| Plan | Memory | CPU | Monthly Cost | Suitable For |
|------|--------|-----|-------------|--------------|
| Hobby | 512MB | Shared | ~$5 | Single bot |
| Pro | 8GB | 2 vCPU | ~$20 | Multiple bots |

### Docker Resource Limits

```yaml
# Recommended docker-compose.yml limits
services:
  monitor:
    mem_limit: 256m
    cpus: '0.5'
  tracker:
    mem_limit: 256m
    cpus: '0.5'
  channel:
    mem_limit: 256m
    cpus: '0.5'
```

### Cold Start Times

| Component | Docker Build | Container Start | First Event |
|-----------|-------------|-----------------|-------------|
| Monitor Bot | ~30s | < 2s | < 5s |
| Tracker Bot | ~45s (canvas natives) | < 2s | < 3s |
| Channel Bot | ~30s | < 2s | < 5s |

---

## Optimization Checklist

- [ ] Use WebSocket mode (primary) with HTTP polling (fallback)
- [ ] Configure multiple RPC endpoints for failover
- [ ] Set appropriate poll intervals (60s for tracking, 5s for launches)
- [ ] Enable SQLite WAL mode (tracker — enabled by default)
- [ ] Use LRU caches for API responses (channel — enabled by default)
- [ ] Set Telegram message queue to respect rate limits
- [ ] Monitor health endpoint for degraded state detection
- [ ] Use Railway's autoscaling for traffic spikes
