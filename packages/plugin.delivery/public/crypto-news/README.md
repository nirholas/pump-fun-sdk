# 📰 Crypto News Plugin

> Aggregated crypto news from the top Web3 publications. 100% free, no API keys required.

## Overview

The Crypto News plugin provides real-time news aggregation from 7 major crypto publications:

| Source | Focus |
|--------|-------|
| **CoinDesk** | Industry news, markets, policy |
| **The Block** | Research, data-driven journalism |
| **Decrypt** | Beginner-friendly, NFTs, gaming |
| **CoinTelegraph** | Global crypto news |
| **Bitcoin Magazine** | Bitcoin-focused, Lightning Network |
| **Blockworks** | Institutional, DeFi research |
| **The Defiant** | DeFi-native, protocol deep dives |

## API Endpoints

### `getLatestNews`

Get the latest crypto news from all sources.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | number | No | Number of articles (default: 10, max: 50) |
| `source` | string | No | Filter by source (see sources below) |

**Source values:** `coindesk`, `theblock`, `decrypt`, `cointelegraph`, `bitcoinmagazine`, `blockworks`, `defiant`

**Example:**
```
Get latest news: "What's the latest crypto news?"
Filter by source: "Show me news from CoinDesk"
```

---

### `searchNews`

Search for news by keywords.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `keywords` | string | Yes | Comma-separated keywords |
| `limit` | number | No | Number of articles (default: 10, max: 30) |

**Example:**
```
"Search for news about Ethereum ETF"
"Find news mentioning Vitalik Buterin"
"What's the news on Solana DeFi?"
```

---

### `getDefiNews`

Get DeFi-specific news from The Defiant and DeFi-focused outlets.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | number | No | Number of articles (default: 10) |

**Topics covered:** Yield farming, DEXs, lending protocols, airdrops, governance

**Example:**
```
"What's happening in DeFi today?"
"Get the latest DeFi news"
```

---

### `getBitcoinNews`

Get Bitcoin-specific news and analysis.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | number | No | Number of articles (default: 10) |

**Topics covered:** Halving, mining, Lightning Network, ordinals, institutional adoption

**Example:**
```
"What's the latest Bitcoin news?"
"Any news about the Lightning Network?"
```

---

### `getBreakingNews`

Get breaking news from the last 2 hours.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | number | No | Number of articles (default: 5) |

**Example:**
```
"Any breaking crypto news?"
"What just happened in the market?"
```

---

### `getSources`

List all available news sources with their current status.

**Parameters:** None

**Example:**
```
"List all crypto news sources"
"Which news sources are available?"
```

## Response Format

All endpoints return articles in this format:

```json
{
  "articles": [
    {
      "title": "Ethereum Surges Past $4,000 Amid ETF Optimism",
      "description": "The second-largest cryptocurrency by market cap...",
      "link": "https://example.com/article",
      "pubDate": "2026-01-02T10:30:00Z",
      "source": "coindesk"
    }
  ],
  "count": 10,
  "lastUpdated": "2026-01-02T10:35:00Z"
}
```

## Use Cases

### For Traders
- Monitor breaking news that could affect positions
- Track specific token/protocol mentions
- Get early signals on market-moving events

### For Researchers
- Aggregate news for daily digests
- Search historical coverage of topics
- Track narrative shifts in crypto

### For Builders
- Stay updated on protocol changes
- Monitor competitor news
- Track regulatory developments

## Integration

### In SperaxOS

The plugin is automatically available via Sperax Intelligence. Just ask:

```
"What's the latest crypto news?"
"Search for news about Uniswap v4"
"Get me DeFi news from today"
```

### In Other LobeChat/ChatGPT Forks

Add to your plugins:

```json
{
  "identifier": "crypto-news",
  "manifest": "https://plugin.delivery/public/crypto-news/manifest.json"
}
```

## Technical Details

- **Rate Limits:** No rate limits for reasonable usage
- **Caching:** RSS feeds cached for 5 minutes
- **Uptime:** Best-effort (depends on source RSS availability)
- **Cost:** Free (no API keys required)

## Contributing

Want to add a news source? Open a PR to add the RSS feed URL to the aggregator.

**Requirements for new sources:**
- Must have a public RSS feed
- Must focus on crypto/Web3 content
- Must be an established publication

## License

MIT License - see [LICENSE](../../LICENSE)

---

Made with 💜 by [Sperax](https://sperax.io)
