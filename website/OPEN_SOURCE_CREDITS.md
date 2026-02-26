# LairOS Open-Source Credits

LairOS builds on and learns from open-source ecosystems. This document tracks all adopted, integrated, and inspiration-source projects for transparency and community credit.

---

## Directly Integrated Libraries (NPM Dependencies)

### ccxt — CryptoCurrency eXchange Trading Library

- **Stars:** ~28,000 | **License:** MIT
- **Repo:** https://github.com/ccxt/ccxt
- **Usage in Lair:** Powers the `exchangeService` in `@nirholas/shared` — provides unified access to 100+ exchanges for tickers, OHLCV candles, orderbooks, funding rates, and open interest data.
- **Files:** `packages/shared/src/services/exchange.ts`, `arbitrage-scanner.ts`

### technicalindicators — Technical Analysis Library

- **Stars:** ~3,800 | **License:** MIT
- **Repo:** https://github.com/anandanand84/technicalindicators
- **Usage in Lair:** Powers the `technicalAnalysis` service — computes RSI, MACD, Bollinger Bands, Stochastic, ADX, ATR, CCI, OBV, and 30+ candlestick pattern detections.
- **Files:** `packages/shared/src/services/technical-analysis.ts`

### TradingView Lightweight Charts

- **Stars:** ~9,000 | **License:** Apache 2.0
- **Repo:** https://github.com/nickovchinnikov/lightweight-charts
- **Usage in Lair:** Professional charting in LairOS desktop apps (loaded via CDN).
- **Files:** Various LairOS app HTML files in `packages/os/Lair-Store/apps/`

---

## Architecture Inspiration & Patterns

### freqtrade/freqtrade — Crypto Trading Bot (32k ⭐)

- https://github.com/freqtrade/freqtrade
- **License:** GPL-3.0 | **Lang:** Python
- **Patterns adopted:** Trading signal scoring methodology, multi-timeframe analysis pipeline, strategy-based signal generation framework.
- **Files influenced:** `packages/shared/src/services/trading-signals.ts`

### hummingbot/hummingbot — Market Making Bot (8.5k ⭐)

- https://github.com/hummingbot/hummingbot
- **License:** Apache 2.0 | **Lang:** Python
- **Patterns adopted:** Cross-exchange arbitrage detection, spread calculation with fee estimation, orderbook depth analysis.
- **Files influenced:** `packages/shared/src/services/arbitrage-scanner.ts`

### CryptoSignal/Crypto-Signal — Signal Bot (4.7k ⭐)

- https://github.com/CryptoSignal/Crypto-Signal
- **License:** MIT | **Lang:** Python
- **Patterns adopted:** TA indicator combination scoring, bull/bear signal confidence calculation.
- **Files influenced:** `packages/shared/src/services/technical-analysis.ts`, `trading-signals.ts`

### Drakkar-Software/OctoBot — Modular Trading Bot (5k ⭐)

- https://github.com/Drakkar-Software/OctoBot
- **License:** GPL-3.0 | **Lang:** Python
- **Patterns studied:** Modular plugin architecture for trading strategies, multi-exchange orchestration.

### SockTrader/SockTrader — TypeScript Trading Framework (3.8k ⭐)

- https://github.com/SockTrader/SockTrader
- **License:** MIT | **Lang:** TypeScript
- **Patterns studied:** TypeScript trading bot architecture, backtesting framework design.

### grammyjs/grammY — Telegram Bot Framework (3k ⭐)

- https://github.com/grammyjs/grammY
- **License:** MIT | **Lang:** TypeScript
- **Reference:** Modern type-safe Telegram bot patterns (Lair uses Telegraf but studies grammY for architecture).

---

## Researched Repositories

- Elenchev/order-book-heatmap — real-time orderbook heatmap concepts and UX inspiration
  - https://github.com/Elenchev/order-book-heatmap
- colekennelly1/awesome-defi-trackers — DeFi dashboard and tracker landscape curation
  - https://github.com/colekennelly1/awesome-defi-trackers
- 0xinevitable/bento — cross-wallet dashboard interaction patterns
  - https://github.com/0xinevitable/bento
- chxash/sol-sniper-bot — Solana DEX sniping patterns (1.2k ⭐)
  - https://github.com/chxash/sol-sniper-bot
- bitcoinvsalts/node-binance-trader — Node.js signal-driven trading (3.2k ⭐)
  - https://github.com/bitcoinvsalts/node-binance-trader
- lorcalhost/BTB-manager-telegram — Remote trading management via Telegram (1.5k ⭐)
  - https://github.com/lorcalhost/BTB-manager-telegram

---

## LairOS App Integrations Influenced by OSS

- **Exchange Service** (`packages/shared/src/services/exchange.ts`)
  - Multi-exchange data via ccxt. Tickers, candles, orderbooks, funding rates.

- **Technical Analysis** (`packages/shared/src/services/technical-analysis.ts`)
  - 50+ indicators via technicalindicators. Candlestick pattern detection.

- **Trading Signals** (`packages/shared/src/services/trading-signals.ts`)
  - Composite signal scoring inspired by freqtrade + CryptoSignal patterns.

- **Arbitrage Scanner** (`packages/shared/src/services/arbitrage-scanner.ts`)
  - Cross-exchange price discrepancy detection inspired by hummingbot.

- **Orderbook Heatmap app** (`packages/os/Lair-Store/apps/orderbook-heatmap.html`)
  - Uses Binance depth websocket + heatmap visualization patterns from orderbook heatmap research.

---

## Data Provider Credits

- Binance Public API / WebSocket
- DeFiLlama APIs (TVL, bridges, stablecoins, yields)
- DexScreener API (multi-chain DEX pairs)
- GeckoTerminal API (DEX pools, OHLCV)
- CoinGecko API (market data, trending)
- Birdeye API (Solana analytics)
- GoPlus API (token security)
- Blockchair Ethereum API
- Jupiter API (Solana DEX aggregator)
- Defined.fi API (DEX analytics)

---

## Contribution Intent

LairOS aims to contribute improvements back to open source where practical, especially around:

- Modular web-native trading tool UI patterns
- Reusable data adapters for real-time crypto analytics
- Open, transparent attribution and interoperability
- TypeScript service wrappers that may benefit ccxt and technicalindicators ecosystems
