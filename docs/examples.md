# Runnable Examples

> Fifty-one tested, runnable examples covering the full SDK surface, from your first createV2 instruction to AMM liquidity, holder rewards, fee sharing, and live WebSocket trade feeds.

Every example lives in [`examples/`](https://github.com/nirholas/pump-fun-sdk/tree/main/examples) at the repo root and follows the same contract:

- **Runnable**: `npm run example <NN>` executes it end to end. Read-only mainnet fetches are real; nothing ever broadcasts a transaction. Examples that build spend instructions print them and stop, so running any example is always safe.
- **Tested**: each example exports its core logic as plain functions, and an offline Jest test in `examples/__tests__/` exercises that logic with mainnet-shaped fixture state. `npm run test:examples` runs all of them, no network needed.
- **Explained**: each example has a step-by-step tutorial in [`tutorials/examples/`](https://github.com/nirholas/pump-fun-sdk/tree/main/tutorials/examples), also on the docs site under Examples.

## Quick start

```bash
git clone https://github.com/nirholas/pump-fun-sdk
cd pump-fun-sdk
npm install

npm run example        # list all 50
npm run example 11     # run one: offline buy quotes
npm run test:examples  # run every example's test suite
```

Optional environment:

```bash
PUMP_RPC_URL=https://your-rpc npm run example 31   # your own RPC for the live examples
MINT=<mint address>    npm run example 32          # inspect a specific token
```

## The catalog

### Token Lifecycle (01-10)

| # | Example | Shows |
|---|---------|-------|
| 01 | create-token | The createV2 instruction, the PDAs a launch creates |
| 02 | create-and-buy | Launch plus dev-buy in one transaction |
| 03 | buy-tokens | The canonical buy flow: fetch state, quote, build with slippage |
| 04 | sell-tokens | The sell flow: fetchSellState plus sellInstructions |
| 05 | buy-by-sol-amount | Spend-side buys: "buy 0.5 SOL worth" |
| 06 | sell-by-percentage | Sell 25/50/100% of a position |
| 07 | sell-all | Full exit, and why maxSafeSellAmount exists |
| 08 | sell-to-target-sol | Extract a target SOL amount; chunked exits |
| 09 | mayhem-mode | Mayhem-mode launches and their extra PDAs |
| 10 | cashback-token | Cashback deprecation and existing-coin claim events |

### Curve Math & Fees (11-20)

| # | Example | Shows |
|---|---------|-------|
| 11 | buy-quote-offline | Buy quotes with zero RPC calls |
| 12 | sell-quote-offline | Sell proceeds and fee impact, offline |
| 13 | market-cap | Market cap at launch, mid-curve, graduation |
| 14 | target-sol | Tokens needed to extract N SOL |
| 15 | max-safe-sell | The u64 overflow guard on large sells |
| 16 | launch-price-ladder | Constant-product mechanics, buy by buy |
| 17 | fee-tiers | Market-cap-based fee tiers, computed |
| 18 | fee-recipients | Fee recipient rotation and the 2026-04-28 breaking upgrade |
| 19 | breaking-fee-validation | Validating and patching instructions for the fee upgrade |
| 20 | price-impact-offline | Execution price vs spot price, in basis points |

### Accounts & Events (21-30)

| # | Example | Shows |
|---|---------|-------|
| 21 | derive-pdas | Every PDA the protocol uses, derived and grouped |
| 22 | decode-global | The Global config account, decoded and interpreted |
| 23 | decode-bonding-curve | Curve state and lifecycle classification |
| 24 | decode-fee-config | The fee program's tier table |
| 25 | decode-pool | AMM pool state and global config |
| 26 | parse-transaction-events | Events out of a real mainnet transaction |
| 27 | decode-trade-events | Trade, create, complete, and migration events |
| 28 | volume-accumulators | Global and per-user volume tracking accounts |
| 29 | sharing-config | Fee sharing config accounts and the 10000 BPS invariant |
| 30 | event-catalog | Every event decoder, routed by discriminator |

### Live Data (31-40)

| # | Example | Shows |
|---|---------|-------|
| 31 | fetch-global-state | Live protocol config vs documented defaults |
| 32 | curve-summary | A one-call token dashboard line |
| 33 | graduation-progress | How close a token is to graduating |
| 34 | token-price | Live price, cross-checked against reserve math |
| 35 | price-impact | Live buy and sell impact classification |
| 36 | live-quotes | Online quotes vs offline math, side by side |
| 37 | batch-curves | Many curves in one batched RPC call |
| 38 | batch-pools | Many AMM pools in one call |
| 39 | routed-trading | The router that picks curve vs AMM for you |
| 40 | websocket-trades | A live trade feed over logsSubscribe |

### AMM & Advanced (41-50)

| # | Example | Shows |
|---|---------|-------|
| 41 | amm-buy | Post-graduation buys through the AMM |
| 42 | amm-sell | AMM sells with quotes |
| 43 | amm-deposit | Adding liquidity, with autocomplete helpers |
| 44 | amm-withdraw | Removing liquidity and LP balances |
| 45 | canonical-pool | The canonical pool PDA and pool pricing |
| 46 | fee-sharing-create | Multi-shareholder fee splits |
| 47 | fee-sharing-distribute | Distributing accrued creator fees |
| 48 | creator-fees | Creator vault balances and fee collection |
| 49 | token-incentives | The volume rewards system end to end |
| 50 | vanity-mint | Vanity mint addresses, then launching with one |

## How the examples are built

Three rules keep them trustworthy:

1. **They run against the source in this repo.** The `@nirholas/pump-sdk` import inside `examples/` is path-mapped to `src/`, so the examples exercise the code you are reading, not an old published build. When you install the package from npm, the same imports work unchanged.
2. **Network and logic are separated.** RPC fetches happen only in each example's `main()`. The exported functions are pure, which is what makes offline testing honest instead of mocked.
3. **All money math is BN.** No floating point until the final display formatting, matching the SDK's own conventions.

## Related

- [Getting Started](getting-started.md) for installation and your first SDK call
- [End-to-End Workflow](end-to-end-workflow.md) for the complete token lifecycle in one narrative
- The live apps built on this SDK: the [launchpad](https://sdk.pumpk.it/live/launchpad), [trade feed](https://sdk.pumpk.it/live/trades.html), and [launch dashboard](https://sdk.pumpk.it/live/)
