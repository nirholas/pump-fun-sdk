# Pump SDK Tutorials

> 19 hands-on tutorials for building on the Pump protocol with `@pump-fun/pump-sdk`.

## Getting Started

```bash
npm install @pump-fun/pump-sdk @solana/web3.js @coral-xyz/anchor bn.js
```

## Tutorials

### Core Token Operations

| # | Tutorial | Topics |
|---|---------|--------|
| 01 | [Create Your First Token](./01-create-token.md) | `createV2Instruction`, metadata, mint keypair |
| 02 | [Buy Tokens from a Bonding Curve](./02-buy-tokens.md) | `buyInstructions`, `fetchBuyState`, slippage |
| 03 | [Sell Tokens](./03-sell-tokens.md) | `sellInstructions`, `fetchSellState`, partial sells |
| 04 | [Create and Buy Atomically](./04-create-and-buy.md) | `createV2AndBuyInstructions`, atomic transactions |

### Math & Pricing

| # | Tutorial | Topics |
|---|---------|--------|
| 05 | [Bonding Curve Math](./05-bonding-curve-math.md) | `getBuyTokenAmountFromSolAmount`, price impact, market cap |

### Advanced Operations

| # | Tutorial | Topics |
|---|---------|--------|
| 06 | [Token Migration to PumpAMM](./06-migration.md) | `migrateInstruction`, graduation detection, AMM pools |
| 07 | [Fee Sharing Setup](./07-fee-sharing.md) | `createFeeSharingConfig`, shareholders, BPS |
| 08 | [Token Incentives](./08-token-incentives.md) | `claimTokenIncentives`, volume accumulators |
| 09 | [Fee System Deep Dive](./09-fee-system.md) | `computeFeesBps`, tiers, `FeeConfig` |

### Architecture & Infrastructure

| # | Tutorial | Topics |
|---|---------|--------|
| 10 | [Working with PDAs](./10-working-with-pdas.md) | `bondingCurvePda`, `feeSharingConfigPda`, all PDAs |
| 11 | [Building a Trading Bot](./11-trading-bot.md) | Monitoring, strategy, automated execution |
| 12 | [Offline SDK vs Online SDK](./12-offline-vs-online.md) | `PumpSdk` vs `OnlinePumpSdk`, hybrid patterns |

### Tools & Integrations

| # | Tutorial | Topics |
|---|---------|--------|
| 13 | [Generating Vanity Addresses](./13-vanity-addresses.md) | Rust, TypeScript, shell generators |
| 14 | [x402 Paywalled APIs](./14-x402-paywalled-apis.md) | HTTP 402, USDC micropayments, Express middleware |
| 15 | [Decoding On-Chain Accounts](./15-decoding-accounts.md) | `decodeGlobal`, `decodeBondingCurve`, batch decoding |

### Monitoring & Operations

| # | Tutorial | Topics |
|---|---------|--------|
| 16 | [Monitoring Claims](./16-monitoring-claims.md) | Unclaimed tokens, creator vaults, fee distributions, cashback, polling |

### Full-Stack & Integrations

| # | Tutorial | Topics |
|---|---------|--------|
| 17 | [Build a Monitoring Website](./17-monitoring-website.md) | Live dashboard, real-time bonding curve UI |
| 18 | [Telegram Bot](./18-telegram-bot.md) | Price alerts, claim checking, graduation notifications |
| 19 | [CoinGecko Integration](./19-coingecko-integration.md) | SOL/USD prices, token discovery, price comparison |

## Prerequisites

- Node.js 18+
- A Solana wallet with devnet SOL (`solana airdrop 2`)
- Basic TypeScript knowledge

## Resources

- [SDK Source Code](../src/)
- [API Reference (llms.txt)](../llms.txt)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
