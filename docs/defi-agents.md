# DeFi Agents Catalog

Comprehensive reference for all 43 production-ready AI agent definitions in the Pump SDK ecosystem.

> **API:** Agents are served via CDN at `https://nirholas.github.io/AI-Agents-Library/`
> **Source:** `packages/defi-agents/`

---

## How Agents Work

Each agent is a JSON definition that describes:
- **Identity** — Name, avatar, description
- **Capabilities** — What tools/plugins the agent can call
- **System prompt** — Instructions for the LLM
- **Locale** — Translations in 18 languages

Agents are consumed by AI platforms like SperaxOS that support function-calling. The agent definition tells the platform which API endpoints (plugins) the agent can invoke.

### Agent JSON Structure

```json
{
  "id": "pump-token-researcher",
  "name": "Token Researcher",
  "avatar": "🔬",
  "description": "Analyzes PumpFun tokens — bonding curves, fee structures, holder distribution",
  "systemPrompt": "You are a token research analyst specializing in PumpFun tokens on Solana...",
  "plugins": ["pump-fun-sdk", "coingecko", "dexscreener"],
  "category": "defi",
  "createdAt": "2026-01-15T00:00:00Z"
}
```

### API Endpoints

```bash
# Get the full agent registry
GET https://nirholas.github.io/AI-Agents-Library/index.json

# Get a specific agent definition (with locale)
GET https://nirholas.github.io/AI-Agents-Library/{agent-id}.en-US.json

# Available locales: en-US, zh-CN, zh-TW, ja-JP, ko-KR, fr-FR, de-DE,
#   es-ES, pt-BR, it-IT, ru-RU, ar-SA, hi-IN, th-TH, vi-VN, id-ID, tr-TR, nl-NL
```

---

## Agent Categories

### 👑 Master Agent (1)

| Agent | Plugins | Description |
|-------|---------|-------------|
| **Sperax Portfolio** | All | Recommended starting point — routes to specialist agents based on user intent |

### 🏗️ Sperax Ecosystem Specialists (7)

| Agent | Focus | Key Plugins |
|-------|-------|-------------|
| USD Management | SperaxUSD stablecoin operations | sperax |
| Staking Optimizer | Yield optimization for SPA staking | sperax, defillama |
| Governance Advisor | DAO proposal analysis and voting | sperax |
| Bridge Navigator | Cross-chain bridging guidance | sperax, coingecko |
| Liquidity Manager | LP position management | sperax, defillama |
| Rewards Tracker | Staking and farming rewards | sperax |
| Risk Analyzer | Protocol risk assessment | sperax, defillama |

### 💼 SperaxOS Portfolio Specialists (16)

| Agent | Focus | Key Plugins |
|-------|-------|-------------|
| Portfolio Tracker | Multi-wallet position tracking | coingecko, defillama |
| Yield Farmer | Auto-compounding strategy recommendations | defillama, beefy |
| Gas Optimizer | Transaction cost minimization | gas-estimator |
| NFT Analyst | NFT collection analysis | — |
| Tax Reporter | Transaction categorization for tax reporting | coingecko |
| Airdrop Hunter | Airdrop eligibility checking | — |
| MEV Protector | Sandwich attack detection | — |
| Token Screener | New token evaluation | dexscreener, coingecko |
| Whale Watcher | Large wallet movement tracking | dexscreener |
| DCA Bot | Dollar-cost averaging automation | coingecko |
| Rebalancer | Portfolio rebalancing recommendations | coingecko, defillama |
| Sentiment Analyzer | Social media sentiment tracking | — |
| On-Chain Sleuth | Wallet relationship analysis | address-labels |
| Fee Optimizer | Cross-DEX fee comparison | defillama, oneinch |
| Copy Trader | Follow successful wallet strategies | dexscreener |
| News Curator | Crypto news filtering and summarization | — |

### 🌐 General DeFi Agents (8+)

| Agent | Focus | Key Plugins |
|-------|-------|-------------|
| Token Researcher | Deep token analysis | pump-fun-sdk, coingecko, dexscreener |
| DEX Aggregator | Best swap routes across DEXes | oneinch, dexscreener |
| Lending Advisor | Borrow/lend rate comparison | defillama |
| Stablecoin Monitor | Depeg detection and stablecoin health | coingecko, defillama |
| Chain Analyst | Cross-chain TVL and activity | defillama |
| Grant Finder | Matching users to grant programs | grants-finder |
| Security Auditor | Contract safety evaluation | contract-scanner, phishing-detector |
| Validator Guide | Staking provider comparison | lido |

### 📰 Crypto News Agents (3+)

| Agent | Focus |
|-------|-------|
| News Aggregator | Multi-source crypto news compilation |
| Market Reporter | Daily/weekly market summaries |
| Regulatory Monitor | Regulatory updates and compliance news |

---

## Creating a New Agent

### 1. Create the Agent Definition

```bash
# Create the agent JSON
cat > packages/defi-agents/src/my-agent.json << 'EOF'
{
  "id": "my-agent",
  "name": "My Custom Agent",
  "avatar": "🤖",
  "description": "Describe what this agent does",
  "systemPrompt": "You are an AI assistant specializing in...",
  "plugins": ["pump-fun-sdk", "coingecko"],
  "category": "defi",
  "createdAt": "2026-03-06T00:00:00Z"
}
EOF
```

### 2. Create the Locale File (Required)

```bash
cat > packages/defi-agents/locales/my-agent.en-US.json << 'EOF'
{
  "name": "My Custom Agent",
  "description": "Describe what this agent does",
  "systemPrompt": "You are an AI assistant specializing in..."
}
EOF
```

> ⚠️ **Required:** The build fails without a locale file for each agent.

### 3. Generate Translations

```bash
cd packages/defi-agents
bun run format    # Uses OpenAI to generate 18 language translations
```

### 4. Build and Deploy

```bash
bun run build     # Builds index.json and per-agent files
# Deployment: push to main → GitHub Actions auto-deploys to GitHub Pages
```

---

## Plugin Reference

Agents reference plugins by ID. These map to API endpoints in `packages/plugin.delivery/`:

| Plugin ID | Endpoints | Status | API Base |
|-----------|-----------|--------|----------|
| `pump-fun-sdk` | bonding-curve, market-cap, price-quote, fee-sharing, fee-tier, token-incentives | ✅ | `/api/pump-fun-sdk/` |
| `coingecko` | price, trending | ✅ | `/api/coingecko/` |
| `defillama` | protocols, protocol, chains, yields, stablecoins | ✅ | `/api/defillama/` |
| `dexscreener` | pair, search, trending, new-listings | ✅ | `/api/dexscreener/` |
| `beefy` | vaults | ✅ | `/api/beefy/` |
| `lido` | stats | ✅ | `/api/lido/` |
| `oneinch` | quote | ✅ | `/api/oneinch/` |
| `thegraph` | query, subgraphs, network-stats | ✅ | `/api/thegraph/` |
| `address-labels` | get-label, search-entity | 🚧 | `/api/address-labels/` |
| `contract-scanner` | scan-token, check-honeypot | 🚧 | `/api/contract-scanner/` |
| `phishing-detector` | check-url, check-contract | 🚧 | `/api/phishing-detector/` |
| `grants-finder` | get-active-grants, search-grants | 🚧 | `/api/grants-finder/` |
| `gas-estimator` | estimate-gas, simulate-transaction | 🚧 | `/api/gas-estimator/` |

---

## Testing Agents

### Verify Agent Structure

```bash
# Validate all agent JSONs
cd packages/defi-agents
node -e "
  const fs = require('fs');
  const agents = fs.readdirSync('src').filter(f => f.endsWith('.json'));
  agents.forEach(f => {
    const agent = JSON.parse(fs.readFileSync('src/' + f, 'utf8'));
    const required = ['id', 'name', 'description', 'systemPrompt', 'plugins'];
    const missing = required.filter(k => !agent[k]);
    if (missing.length) console.error(f + ': missing ' + missing.join(', '));
    else console.log('✅ ' + f);
  });
"
```

### Test Agent in SperaxOS

1. Deploy agents via `bun run build` + push to GitHub Pages
2. Open SperaxOS and navigate to the agent marketplace
3. Install your agent and test with sample queries
4. Verify plugin calls are routed correctly

---

## Best Practices

1. **System prompts should be specific** — Tell the agent exactly what it can and cannot do
2. **List only plugins the agent needs** — Don't give every agent access to every plugin
3. **Include examples in system prompts** — Show the agent what good responses look like
4. **Test with edge cases** — What happens when data is unavailable? When the user asks something off-topic?
5. **Keep descriptions concise** — Users see descriptions in the marketplace; they should understand the agent's purpose in one line
6. **Use appropriate avatars** — Emoji that match the agent's function (📊 for analytics, 🔒 for security, etc.)
