# Runnable Examples

Fifty-one self-contained, tested examples covering the full surface of `@nirholas/pump-sdk`: token creation, holder rewards, bonding curve trading, curve math, fees, PDAs, account decoding, event parsing, live mainnet reads, AMM pools, fee sharing, incentives, and vanity mints.

Every example:

- runs against the SDK source in this repo (`@nirholas/pump-sdk` is path-mapped to `src/`),
- exports its core logic as plain functions with a `main()` walkthrough on top,
- has a matching offline Jest test in [`__tests__/`](__tests__/),
- has a step-by-step tutorial in [`../tutorials/examples/`](../tutorials/examples/).

No example ever broadcasts a transaction. Examples that build spend instructions print them and stop; sending is always your explicit, separate step. Read-only examples fetch live mainnet state.

## Run one

```bash
npm install
npm run example 11        # by number
npm run example 11-buy-quote-offline   # or by name
```

List all runnable examples:

```bash
npm run example
```

## Test them all

```bash
npm run test:examples
```

The example tests are fully offline and deterministic: they exercise the exported functions with the same mainnet-shaped fixtures the SDK unit suite uses.

## Configuration (all optional)

| Env var | Purpose | Default |
|---------|---------|---------|
| `PUMP_RPC_URL` | RPC endpoint for live examples | public mainnet RPC |
| `MINT` | Token mint for the live read examples | a token discovered off the live Pump log stream |
| `GRADUATED_MINT` | Graduated token for the AMM and routing examples | a pool discovered off the live AMM log stream |
| `PUMP_WALLET` | Path to a solana-keygen JSON keypair | ephemeral keypair |
| `PUMP_WALLET_SECRET` | base58 secret key | ephemeral keypair |

## Categories

| Range | Category | What it covers |
|-------|----------|----------------|
| 01-10 | Token Lifecycle | createV2, create-and-buy, buy, sell, sell-all, sell-by-percentage, mayhem mode, cashback |
| 11-20 | Curve Math & Fees | offline quotes, market cap, fee tiers, breaking fee recipients, price impact |
| 21-30 | Accounts & Events | every PDA, decoding all account types, parsing all protocol events |
| 31-40 | Live Data | mainnet reads: global state, curve summaries, graduation, prices, batch fetches, WebSocket feeds |
| 41-51 | AMM & Advanced | AMM trading and liquidity, fee sharing, creator fees, incentives, vanity mints, holder rewards |

The shared helpers live in [`_lib/`](_lib/): connection, wallet loading, and BN-safe formatting.
