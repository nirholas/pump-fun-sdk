# DeFi Agents API Documentation

## Overview

The DeFi Agents API is a RESTful JSON API providing access to 58 production-ready AI agent definitions for DeFi, portfolio management, trading, and Web3 workflows. All agents are available in 18 languages.

**Base URL**: `https://sperax.click`

---

## Endpoints

### 1. **Get All Agents (English)**

Retrieve the complete index of all 58 agents in English.

```
GET /index.json
```

**Response**: Array of agent objects with full definitions

**Example**:

```bash
curl https://sperax.click/index.json | jq '.[] | {id: .identifier, name: .meta.title}'
```

---

### 2. **Get Agents in Specific Language**

Retrieve all agents in a supported language.

```
GET /index.{locale}.json
```

**Supported Locales**:

- `en-US` (English)
- `ar` (Arabic)
- `bg-BG` (Bulgarian)
- `zh-CN` (Chinese Simplified)
- `zh-TW` (Chinese Traditional)
- `de-DE` (German)
- `es-ES` (Spanish)
- `fa-IR` (Persian)
- `fr-FR` (French)
- `it-IT` (Italian)
- `ja-JP` (Japanese)
- `ko-KR` (Korean)
- `nl-NL` (Dutch)
- `pl-PL` (Polish)
- `pt-BR` (Portuguese Brazilian)
- `ru-RU` (Russian)
- `tr-TR` (Turkish)
- `vi-VN` (Vietnamese)

**Example**:

```bash
curl https://sperax.click/index.zh-CN.json # Get all agents in Chinese
```

---

### 3. **Get Single Agent**

Retrieve a specific agent definition by ID.

```
GET /{agent-id}.json
```

**Example**:

```bash
curl https://sperax.click/sperax-dashboard.json
```

---

### 4. **Get Single Agent in Specific Language**

```
GET /{agent-id}.{locale}.json
```

**Example**:

```bash
curl https://sperax.click/sperax-dashboard.fr-FR.json # French
```

---

### 5. **Agent Manifest (Machine-Readable Index)**

Get structured metadata about all agents for indexing.

```
GET /agents-manifest.json
```

**Example**:

```bash
curl https://sperax.click/agents-manifest.json
```

---

## Agent Schema

Each agent follows this JSON structure:

```json
{
  "author": "string", // Agent creator/organization
  "config": {
    "systemRole": "string", // System prompt/instructions
    "openingMessage": "string", // Welcome message
    "openingQuestions": ["string"] // Suggested first questions
  },

  "createdAt": "YYYY-MM-DD", // Creation date
  "examples": [
    // Example interactions
    {
      "role": "user|assistant",
      "content": "string"
    }
  ],

  "homepage": "string", // URL to agent home/docs
  "identifier": "string", // Unique agent ID (used in URLs)
  "knowledgeCount": 0, // Number of knowledge files
  "meta": {
    "title": "string", // Display name
    "description": "string", // Short description
    "avatar": "string", // Emoji or icon
    "tags": ["string"], // Searchable tags
    "category": "string" // Category (trading, defi, portfolio, etc.)
  },

  "pluginCount": 0, // Number of plugins/integrations
  "schemaVersion": 1, // Schema version number

  "summary": "string", // Detailed summary
  "tokenUsage": 150 // Typical token usage
}
```

---

## Response Format

All endpoints return JSON with the following characteristics:

- **Encoding**: UTF-8
- **Content-Type**: `application/json`
- **Status Codes**:
  - `200` - Success
  - `404` - Agent/language not found
  - `500` - Server error

---

## Query Examples

### Example 1: Get all agents in German

```bash
curl https://sperax.click/index.de-DE.json
```

### Example 2: Parse agent names and categories

```bash
curl https://sperax.click/index.json \
  | jq '.[] | {name: .meta.title, category: .meta.category, tags: .meta.tags}'
```

### Example 3: Filter agents by category

```bash
curl https://sperax.click/index.json \
  | jq '.[] | select(.meta.category == "trading")'
```

### Example 4: Get manifest data for indexing

```bash
curl https://sperax.click/agents-manifest.json | jq '.stats'
```

---

## Integration Examples

### Python

```python
import requests
import json

# Get all agents
response = requests.get('https://sperax.click/index.json')
agents = response.json()

# Filter by category
trading_agents = [a for a in agents if a['meta']['category'] == 'trading']
print(f"Found {len(trading_agents)} trading agents")

# Get agent in specific language
spanish_agents = requests.get('https://sperax.click/index.es-ES.json').json()
```

### JavaScript/Node.js

```javascript
// Fetch all agents
const agents = await fetch('https://sperax.click/index.json').then((r) => r.json());

// Get specific agent
const dashboard = await fetch('https://sperax.click/sperax-dashboard.json').then((r) => r.json());

// Filter by tags
const defiAgents = agents.filter((a) => a.meta.tags.includes('defi'));
```

### cURL

```bash
# Get all agents
curl https://sperax.click/index.json

# Get agent in Chinese
curl https://sperax.click/sperax-dashboard.zh-CN.json

# Count total agents
curl https://sperax.click/index.json | jq 'length'
```

---

## Rate Limiting

No rate limiting. All endpoints are static JSON files served via GitHub Pages CDN.

---

## Caching

Recommended HTTP headers for caching:

```
Cache-Control: public, max-age=3600
```

---

## Agent Categories

### 🪙 Sperax Ecosystem Agents (23 Agents)

Portfolio management, trading, DeFi protocols, governance

**Key Agents**:

- `sperax-dashboard` - Portfolio overview
- `sperax-assets-tracker` - Asset tracking
- `sperax-analytics-expert` - Performance analytics
- `sperax-trading-assistant` - Trade execution
- `sperax-ai-trading-bot` - AI trading strategies
- `sperax-wallet-manager` - Wallet management
- `sperax-defi-center` - DeFi protocol aggregator
- And 16 more...

### 💰 DeFi & Crypto Agents (34 Agents)

Risk analysis, yield farming, security, tokenomics

**Categories**:

- **Yield & Income**: `defi-yield-farmer`, `staking-rewards-calculator`, `yield-sustainability-analyst`
- **Risk Management**: `liquidation-risk-manager`, `defi-risk-scoring-engine`, `defi-insurance-advisor`
- **Trading**: `dex-aggregator-optimizer`, `gas-optimization-expert`, `mev-protection-advisor`
- **Analysis**: `smart-contract-auditor`, `protocol-revenue-analyst`, `narrative-trend-analyst`
- **And more...**

---

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for version history, new agents, and schema changes.

---

## Support

For issues, questions, or contributions, visit:

- **GitHub**: <https://github.com/nirholas/defi-agents>
- **Issues**: <https://github.com/nirholas/defi-agents/issues>
- **Contributing**: See [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## License

MIT License - See [LICENSE](../LICENSE) for details.
"meta": {
"title": "string",
"description": "string",
"avatar": "string",
"tags": \["string"],
"systemRole": "string"
},
"schemaVersion": 1,
"createAt": "ISO date string"
}
]
}

````

**Example:**

```bash
curl https://nirholas.github.io/AI-Agents-Library/index.json
````

---

### Individual Agent (English)

```
GET /{agent-identifier}.json
```

Returns single agent data in English.

**Example:**

```bash
curl https://nirholas.github.io/AI-Agents-Library/defi-yield-optimizer.json
```

**Response:**

```json
{
  "author": "username",
  "config": {
    "systemRole": "You are a DeFi yield optimization specialist..."
  },
  "createAt": "2024-01-15",
  "identifier": "defi-yield-optimizer",
  "meta": {
    "title": "DeFi Yield Optimizer",
    "description": "Analyzes yield farming opportunities...",
    "avatar": "🌾",
    "tags": ["defi", "yield", "analytics"],
    "systemRole": "agent"
  },
  "schemaVersion": 1
}
```

---

### Localized Agent

```
GET /{agent-identifier}.{locale}.json
```

Returns agent in specific language.

**Supported Locales:**

- `en-US` - English
- `zh-CN` - Simplified Chinese
- `zh-TW` - Traditional Chinese
- `ja-JP` - Japanese
- `ko-KR` - Korean
- `de-DE` - German
- `fr-FR` - French
- `es-ES` - Spanish
- `ru-RU` - Russian
- `ar` - Arabic
- `pt-BR` - Portuguese (Brazil)
- `it-IT` - Italian
- `nl-NL` - Dutch
- `pl-PL` - Polish
- `tr-TR` - Turkish
- `vi-VN` - Vietnamese
- `fa-IR` - Persian
- `bg-BG` - Bulgarian

**Example:**

```bash
curl https://nirholas.github.io/AI-Agents-Library/defi-yield-optimizer.zh-CN.json
```

---

## Use Cases

### 1. Build Custom Marketplace

```javascript
// Fetch all agents
const response = await fetch('https://nirholas.github.io/AI-Agents-Library/index.json');
const data = await response.json();

// Filter by category
const defiAgents = data.agents.filter((agent) => agent.meta.tags.includes('defi'));

// Display in your UI
defiAgents.forEach((agent) => {
  console.log(`${agent.meta.avatar} ${agent.meta.title}`);
  console.log(agent.meta.description);
});
```

### 2. Search Agents

```javascript
function searchAgents(query) {
  return fetch('https://nirholas.github.io/AI-Agents-Library/index.json')
    .then((r) => r.json())
    .then((data) =>
      data.agents.filter(
        (agent) =>
          agent.meta.title.toLowerCase().includes(query.toLowerCase()) ||
          agent.meta.description.toLowerCase().includes(query.toLowerCase()) ||
          agent.meta.tags.some((tag) => tag.includes(query.toLowerCase())),
      ),
    );
}

// Usage
searchAgents('yield').then((results) => console.log(results));
```

### 3. Load Agent by ID

```javascript
async function loadAgent(identifier, locale = 'en-US') {
  const filename = locale === 'en-US' ? `${identifier}.json` : `${identifier}.${locale}.json`;

  const response = await fetch(`https://nirholas.github.io/AI-Agents-Library/${filename}`);
  return response.json();
}

// Usage
const agent = await loadAgent('defi-yield-optimizer', 'zh-CN');
console.log(agent.config.systemRole);
```

### 4. Filter by Tags

```javascript
async function getAgentsByTag(tag) {
  const response = await fetch('https://nirholas.github.io/AI-Agents-Library/index.json');
  const data = await response.json();

  return data.agents.filter((agent) => agent.meta.tags.includes(tag));
}

// Get all trading agents
const tradingAgents = await getAgentsByTag('trading');
```

### 5. Get Random Agent

```javascript
async function getRandomAgent() {
  const response = await fetch('https://nirholas.github.io/AI-Agents-Library/index.json');
  const data = await response.json();

  const random = Math.floor(Math.random() * data.agents.length);
  return data.agents[random];
}
```

### 6. Analytics

```javascript
async function getMarketplaceStats() {
  const response = await fetch('https://nirholas.github.io/AI-Agents-Library/index.json');
  const data = await response.json();

  const stats = {
    totalAgents: data.agents.length,
    tags: {},
    authors: new Set(),
    recentAgents: [],
  };

  data.agents.forEach((agent) => {
    // Count tags
    agent.meta.tags.forEach((tag) => {
      stats.tags[tag] = (stats.tags[tag] || 0) + 1;
    });

    // Unique authors
    stats.authors.add(agent.author);
  });

  // Sort agents by creation date
  stats.recentAgents = data.agents
    .sort((a, b) => new Date(b.createAt) - new Date(a.createAt))
    .slice(0, 10);

  stats.authors = stats.authors.size;

  return stats;
}
```

---

## Data Schema

### Agent Object

```typescript
interface Agent {
  author: string; // GitHub username
  identifier: string; // Unique ID (URL-safe)
  meta: {
    title: string; // Display name
    description: string; // Brief description
    avatar: string; // Single emoji
    tags: string[]; // 3-8 keywords
    systemRole?: string; // Optional role type
  };
  schemaVersion: 1; // Always 1
  config: {
    systemRole: string; // Full system prompt
  };
  createAt: string; // ISO date
}
```

### Index Response

```typescript
interface IndexResponse {
  agents: Agent[];
}
```

---

## Rate Limits

**GitHub Pages:**

- No authentication required
- Generous rate limits (soft limit \~10 requests/second)
- Cached via CDN
- Free for all use cases

**Best Practices:**

- Cache index.json locally
- Don't fetch on every page load
- Use conditional requests (ETag/If-Modified-Since)
- Respect GitHub's infrastructure

---

## CORS

All endpoints support CORS. You can make requests from any domain.

```javascript
// Works from any origin
fetch('https://nirholas.github.io/AI-Agents-Library/index.json')
  .then((r) => r.json())
  .then((data) => console.log(data));
```

---

## Caching

**Recommended strategy:**

```javascript
class AgentCache {
  constructor(ttl = 3600000) {
    // 1 hour default
    this.cache = null;
    this.timestamp = null;
    this.ttl = ttl;
  }

  async getAgents() {
    const now = Date.now();

    // Return cached if fresh
    if (this.cache && now - this.timestamp < this.ttl) {
      return this.cache;
    }

    // Fetch fresh data
    const response = await fetch('https://nirholas.github.io/AI-Agents-Library/index.json');
    this.cache = await response.json();
    this.timestamp = now;

    return this.cache;
  }

  invalidate() {
    this.cache = null;
    this.timestamp = null;
  }
}

// Usage
const cache = new AgentCache();
const agents = await cache.getAgents();
```

---

## Error Handling

```javascript
async function safeLoadAgent(identifier) {
  try {
    const response = await fetch(`https://nirholas.github.io/AI-Agents-Library/${identifier}.json`);

    if (!response.ok) {
      throw new Error(`Agent not found: ${identifier}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to load agent:', error);
    return null;
  }
}
```

---

## Example Projects

### CLI Tool

```javascript
#!/usr/bin/env node
const https = require('https');

function searchAgents(query) {
  https.get('https://nirholas.github.io/AI-Agents-Library/index.json', (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      const agents = JSON.parse(data).agents;
      const results = agents.filter((a) =>
        a.meta.title.toLowerCase().includes(query.toLowerCase()),
      );

      results.forEach((agent) => {
        console.log(`${agent.meta.avatar} ${agent.meta.title}`);
        console.log(`   ${agent.meta.description}`);
        console.log();
      });
    });
  });
}

searchAgents(process.argv[2]);
```

### React Component

```jsx
import { useEffect, useState } from 'react';

function AgentList({ tag }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://nirholas.github.io/AI-Agents-Library/index.json')
      .then((r) => r.json())
      .then((data) => {
        const filtered = tag ? data.agents.filter((a) => a.meta.tags.includes(tag)) : data.agents;
        setAgents(filtered);
        setLoading(false);
      });
  }, [tag]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {agents.map((agent) => (
        <div key={agent.identifier}>
          <h3>
            {agent.meta.avatar} {agent.meta.title}
          </h3>
          <p>{agent.meta.description}</p>
          <div>
            {agent.meta.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Updates

The index is updated automatically when new agents are merged to main branch:

- New agents appear within 24 hours
- Updates to existing agents reflect immediately
- No API versioning (backwards compatible changes only)

---

## Support

- Issues: github.com/nirholas/AI-Agents-Library/issues
- Discord: \[Join community]

---

## License

Agent data is MIT licensed. Free for commercial and personal use.

