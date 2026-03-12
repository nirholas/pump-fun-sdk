# DeFi Agents

Catalog of 43 AI agent definitions for DeFi intelligence, built with the PumpKit agent framework.

---

## Overview

The DeFi agents package (`packages/defi-agents/`) provides pre-built AI agent definitions that can be deployed to any compatible platform. Each agent is a JSON file with a system prompt, plugin list, and metadata.

### Agent Categories

| Category | Count | Focus |
|----------|-------|-------|
| Master Agents | 3 | Multi-tool orchestrators |
| Ecosystem Agents | 5+ | Chain-specific analysis |
| Portfolio Agents | 5+ | Asset management & tracking |
| General DeFi Agents | 10+ | Yields, swaps, staking |
| Security Agents | 5+ | Auditing & threat detection |
| Crypto News Agents | 3+ | News & regulatory monitoring |

---

## Agent Structure

Each agent definition includes:

```json
{
  "id": "agent-id",
  "name": "Agent Display Name",
  "avatar": "🤖",
  "description": "What this agent does",
  "systemPrompt": "You are an AI assistant specializing in...",
  "plugins": ["pump-fun-sdk", "coingecko"],
  "category": "defi",
  "createdAt": "2026-03-06T00:00:00Z"
}
```

---

## Master Agents (3)

| Agent | Description | Plugins |
|-------|-------------|---------|
| DeFi Master | Orchestrates all DeFi operations | All plugins |
| Solana Master | Solana-specific operations | pump-fun-sdk, dexscreener |
| Security Master | Full security audit suite | contract-scanner, phishing-detector |

## Ecosystem Agents (5+)

| Agent | Focus | Key Plugin |
|-------|-------|------------|
| Solana Analyst | Solana ecosystem analysis | pump-fun-sdk |
| Ethereum Analyst | ETH DeFi protocols | defillama, thegraph |
| Multi-Chain Monitor | Cross-chain tracking | defillama |
| DEX Tracker | DEX activity monitoring | dexscreener |
| Token Launcher | Token launch workflows | pump-fun-sdk |

## Portfolio Agents (5+)

| Agent | Capability | Plugins |
|-------|-----------|---------|
| Portfolio Tracker | Balance & PnL tracking | coingecko, defillama |
| Yield Optimizer | Best yield discovery | beefy, defillama |
| Risk Analyzer | Portfolio risk assessment | coingecko |
| Tax Reporter | Transaction tax reporting | coingecko |
| Rebalancer | Portfolio rebalancing | oneinch, coingecko |

## General DeFi Agents (10+)

| Agent | Focus | Key Plugin |
|-------|-------|------------|
| Swap Router | Best swap routes | oneinch |
| Yield Farmer | Yield opportunities | beefy, defillama |
| Staking Guide | Staking comparisons | lido |
| Price Oracle | Price feeds | coingecko |
| Liquidity Provider | LP management | dexscreener |

## Security Agents (5+)

| Agent | Specialization | Key Plugin |
|-------|---------------|------------|
| Contract Scanner | Smart contract analysis | contract-scanner |
| Phishing Detector | URL/contract threat check | phishing-detector |
| Address Labeler | Known address identification | address-labels |
| Grant Finder | Matching users to grant programs | grants-finder |
| Security Auditor | Contract safety evaluation | contract-scanner, phishing-detector |
| Validator Guide | Staking provider comparison | lido |

## Crypto News Agents (3+)

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

---

## Best Practices

1. **System prompts should be specific** — Tell the agent exactly what it can and cannot do
2. **List only plugins the agent needs** — Don't give every agent access to every plugin
3. **Include examples in system prompts** — Show the agent what good responses look like
4. **Test with edge cases** — What happens when data is unavailable? When the user asks something off-topic?
5. **Keep descriptions concise** — Users see descriptions in the marketplace; they should understand the agent's purpose in one line
6. **Use appropriate avatars** — Emoji that match the agent's function (📊 for analytics, 🔒 for security, etc.)

---

## Related

- [Tutorial 25: DeFi Agents Integration](../tutorials/25-defi-agents-integration.md) — Building with the agent framework
- [Architecture](./architecture.md) — System design overview
- [API Reference](./api-reference.md) — SDK method catalog
