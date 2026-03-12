# PumpKit Tutorials

Hands-on guides for building PumpFun Telegram bots.

## Bot Building

| # | Tutorial | What You'll Learn |
|---|----------|-------------------|
| 1 | [Telegram Bot Patterns](18-telegram-bot.md) | Interactive DM bot with grammy, commands, price alerts, graduation alerts |
| 2 | [Channel Bot Setup](22-channel-bot-setup.md) | Read-only channel feed, one-way broadcasts, event formatting |
| 3 | [AI-Enriched Channel Bot](39-channel-bot-ai-enrichment.md) | GitHub enrichment, first-claim detection, rich HTML cards |
| 4 | [Trading Bot Architecture](11-trading-bot.md) | Condition-based trading patterns, bot architecture |

## Monitoring & Events

| # | Tutorial | What You'll Learn |
|---|----------|-------------------|
| 5 | [Monitoring Fee Claims](16-monitoring-claims.md) | Claims architecture, tracking token incentives, creator fees, cashback |
| 6 | [Event Parsing & Analytics](29-event-parsing-analytics.md) | Decoding 20+ on-chain events from Pump/PumpAMM/PumpFees logs |
| 7 | [WebSocket Real-Time Feeds](21-websocket-realtime-feeds.md) | Real-time token launches & trades via WebSocket |

## Getting Started with Bots

| # | Tutorial | What You'll Learn |
|---|----------|-------------------|
| 8 | [Your First Claim Bot](40-your-first-claim-bot.md) | Set up a claim bot from scratch with grammy and Solana RPC |
| 9 | [Customizing Claim Cards](41-customizing-claim-cards.md) | HTML message formatting, badges, enrichment fields |
| 10 | [Channel Feed Bot](42-channel-feed-bot.md) | Read-only channel broadcasting, event filtering, formatting |
| 11 | [Understanding PumpFun Events](43-understanding-pumpfun-events.md) | On-chain event types, log parsing, program account decoding |

## Protocol Knowledge

| # | Tutorial | What You'll Learn |
|---|----------|-------------------|
| 12 | [Fee Sharing Setup](07-fee-sharing.md) | Configuring shareholders, fee distribution mechanics |
| 13 | [Error Handling Patterns](33-error-handling-patterns.md) | Validation patterns for fee sharing, error classes |
| 14 | [Cashback & Social Fees](27-cashback-social-fees.md) | Cashback rewards, social fee PDAs, identity-linked fees |
| 15 | [Analytics & Price Quotes](28-analytics-price-quotes.md) | Quote functions, price impact, graduation progress, price feeds |
| 16 | [AMM Liquidity Operations](34-amm-liquidity-operations.md) | Post-graduation AMM trading, LP tokens, creator fees |

## Advanced Topics

| # | Tutorial | What You'll Learn |
|---|----------|-------------------|
| 17 | [Testing & Benchmarking](38-testing-benchmarking.md) | CLI tests, fuzz tests, stress tests, Rust vs TS benchmarks |
| 18 | [Custom DeFi Agents & i18n](44-custom-defi-agents-i18n.md) | AI agent JSON definitions, 18-language translations, LLM integration |

## Prerequisites

- Node.js 20+
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))
- A Solana RPC URL (free or paid provider)
- Basic TypeScript knowledge

## Getting Started

New to PumpKit? Start with:

1. [Getting Started](../docs/getting-started.md) — Setup and first bot
2. [Architecture](../docs/architecture.md) — How PumpKit is structured
3. [Tutorial #1: Telegram Bot Patterns](18-telegram-bot.md) — Build your first bot
