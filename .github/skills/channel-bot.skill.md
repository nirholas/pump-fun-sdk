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

## Product contract and current pipeline

Read `docs/github-claims-product.md` and `channel-bot/CLAUDE.md` first.
`@pumpfunclaims` alerts once per GitHub developer–coin pair, including a first
claim on a new coin by an experienced developer. Repeated pair claims are
suppressed. Previous coins provide context. A CA in GitHub and developer token
creation are not prerequisites.

The current `index.ts` still uses a PDA-wide lifetime gate before mint
resolution, then picks the highest-market-cap linked coin. These are known gaps,
not the product specification. A shared social-fee withdrawal identifies the
GitHub ID and recipient but does not name a mint. Do not remove the lifetime
gate without solving attribution, or claim every delegated coin was collected.

1. `ClaimMonitor` and its verifier-history backstop discover PumpFees claims.
2. Decode the actual payout, GitHub identity, PDA and quote asset.
3. Establish coin attribution and durable developer–mint history before making
   a coin-specific first-claim decision (required implementation work).
4. Bound enrichment concurrency/deadlines and retain unresolved evidence.
5. Format the first-pair claim, previous coins and developer-wide history as
   separate facts. Label metadata as a linked repository.
6. Deliver through the profile policy; preserve history and retryable delivery
   state. Never use the live channel for test messages.

The dedicated project is `nirholas/pumpfun-github-claims`. Source publication is
separate from deploying or migrating the live feed.

## Claim Types & Where Mint Comes From

| Claim Type | Program | Has Token Mint? | Source |
|------------|---------|----------------|--------|
| `claim_social_fee_pda` / V2 | PumpFees | No | GitHub identity and shared PDA; coin attribution requires additional evidence |
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
3. Deduplicate by stable GitHub ID and mint; wallet-level or PDA-wide history is not per-coin evidence
4. WebSocket mode is preferred over polling (real-time vs 30s delay)
5. Rate limit RPC calls via `RpcQueue` (1 req/sec, max 50 queued)
