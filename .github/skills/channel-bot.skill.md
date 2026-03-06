---
applyTo: "channel-bot/**"
---
# Channel Bot Skill

## Skill Description

Reference this skill when working on the PumpFun Channel Bot — a read-only Telegram channel feed that broadcasts fee claims, token launches, graduations, whale trades, and fee distributions.

## Architecture

| File | Purpose |
|------|---------|
| `channel-bot/src/index.ts` | Entry point: wires monitors → formatters → Telegram posting |
| `channel-bot/src/claim-monitor.ts` | WebSocket/polling monitor for fee claim transactions |
| `channel-bot/src/event-monitor.ts` | Monitor for launches, graduations, whales, fee distributions |
| `channel-bot/src/types.ts` | Program IDs, instruction discriminators, event types |
| `channel-bot/src/formatters.ts` | HTML message formatting for Telegram |
| `channel-bot/src/pump-client.ts` | PumpFun API client (token info, creator profiles, holders) |
| `channel-bot/src/github-client.ts` | GitHub API client (repo info, user profiles) |
| `channel-bot/src/claim-tracker.ts` | First-claim deduplication, claim history persistence |
| `channel-bot/src/rpc-fallback.ts` | Multi-RPC connection manager with automatic failover |
| `channel-bot/src/config.ts` | Environment variable configuration |
| `channel-bot/src/health.ts` | Health check HTTP server |
| `channel-bot/src/logger.ts` | Structured logging |

## Claim Flow Pipeline

1. **WebSocket** receives all program logs for Pump + PumpSwap programs
2. **handleLogEvent** filters for claim event discriminators in `Program data:` log lines
3. **processTransaction** fetches full parsed TX, checks top-level instructions for claim discriminators
4. **buildClaimEvent** extracts claimer wallet, token mint, amount from TX data
5. **onClaim callback** (in index.ts) applies filters:
   - `if (!mint)` → skip wallet-level claims (cashback, collect_creator_fee)
   - `isFirstClaimByWallet(wallet)` → only first-ever claim per wallet
   - `requireGithub` → only tokens with GitHub URLs in description
6. **Enrich** with token info, creator profile, GitHub data, holders, trades
7. **formatClaimFeed** → rich HTML card with market data, links, GitHub info
8. **postToChannel** → sends to Telegram channel

## Claim Types & Where Mint Comes From

| Claim Type | Program | Has Token Mint? | Source |
|------------|---------|----------------|--------|
| `distribute_creator_fees` | Pump | Yes | instruction accounts[0] or event data bytes 16-48 |
| `collect_creator_fee` | Pump | No | Wallet-level claim, no specific token |
| `claim_cashback` | Pump | No | Wallet-level cashback |
| `collect_coin_creator_fee` | PumpSwap | No | Wallet-level AMM creator fee |
| `claim_cashback` | PumpSwap | No | Wallet-level AMM cashback |
| `transfer_creator_fees_to_pump` | PumpSwap | No | Internal fee transfer |

## Official Protocol Docs (MUST READ)

Before modifying claim detection or event parsing, read:

| Topic | File |
|-------|------|
| Fee claim instructions & creator vault PDAs | `docs/pump-official/PUMP_CREATOR_FEE_README.md` |
| AMM creator fees & coin_creator_vault | `docs/pump-official/PUMP_SWAP_CREATOR_FEE_README.md` |
| Cashback rewards & UserVolumeAccumulator | `docs/pump-official/PUMP_CASHBACK_README.md` |
| Dynamic fee tiers | `docs/pump-official/FEE_PROGRAM_README.md` |
| Social fee PDAs, GitHub recipients | `docs/pump-official/README.md` |
| Instruction discriminators | `docs/pump-official/idl/pump.json`, `pump_amm.json` |

## Event Discriminators

### Instruction Discriminators (for matching in TX data)
| Discriminator | Claim Type | Program |
|--------------|------------|---------|
| `1416567bc61cdb84` | collect_creator_fee | Pump |
| `253a237ebe35e4c5` | claim_cashback | Pump / PumpSwap |
| `a572670079cef751` | distribute_creator_fees | Pump |
| `a039592ab58b2b42` | collect_coin_creator_fee | PumpSwap |
| `8b348655e4e56cf1` | transfer_creator_fees_to_pump | PumpSwap |

### Event Log Discriminators (for matching in `Program data:` logs)
| Discriminator | Event |
|--------------|-------|
| `7a027f010ebf0caf` | CollectCreatorFeeEvent |
| `a537817004b3ca28` | DistributeCreatorFeesEvent |
| `e2d6f62107f293e5` | ClaimCashbackEvent |
| `e8f5c2eeeada3a59` | CollectCoinCreatorFeeEvent |

## Configuration (Environment Variables)

| Variable | Default | Purpose |
|----------|---------|---------|
| `TELEGRAM_BOT_TOKEN` | (required) | Bot API token |
| `CHANNEL_ID` | (required) | Target channel (@name or -100xxx) |
| `SOLANA_RPC_URL` | mainnet | Primary RPC endpoint |
| `SOLANA_RPC_URLS` | | Comma-separated fallback RPCs |
| `SOLANA_WS_URL` | (derived) | WebSocket endpoint |
| `REQUIRE_GITHUB` | `true` | Only post claims for tokens with GitHub URLs |
| `FEED_CLAIMS` | `true` | Enable claim feed |
| `FEED_LAUNCHES` | `false` | Enable launch feed |
| `FEED_GRADUATIONS` | `false` | Enable graduation feed |
| `FEED_WHALES` | `false` | Enable whale trade feed |
| `LOG_LEVEL` | `info` | Logging level |

## Critical Rules

1. Never log full RPC URLs — use `maskUrl()` from `rpc-fallback.ts`
2. All amount math uses lamports (integers), converted to SOL only for display
3. The `isFirstClaimByWallet` check is persisted to disk — survives restarts
4. WebSocket mode is preferred over polling (real-time vs 30s delay)
5. Rate limit RPC calls via `RpcQueue` (1 req/sec, max 50 queued)
