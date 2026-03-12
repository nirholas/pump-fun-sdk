# Tutorial 44: Custom DeFi Agent Definitions & i18n

> Create AI agent JSON definitions, translate them into 18 languages, and publish to the agents manifest for discovery by LLM platforms.

## Prerequisites

- Basic JSON editing
- Understanding of LLM system prompts

```bash
cd packages/defi-agents
```

## What Are DeFi Agents?

Each agent is a JSON file that defines an AI persona — its expertise, personality, example interactions, and metadata. LLM platforms (Claude, GPT, LobeChat) load these as pre-configured assistants.

```
packages/defi-agents/
├── src/                    # 43 agent definitions
│   ├── pump-fun-sdk-expert.json
│   ├── airdrop-hunter.json
│   ├── yield-sustainability-analyst.json
│   └── ...
├── locales/                # 18-language translations
│   ├── pump-fun-sdk-expert/
│   │   ├── index.json      # Default (English)
│   │   ├── index.zh-CN.json
│   │   ├── index.ja-JP.json
│   │   └── ...
│   └── ...
├── agent-template.json     # Blank template for new agents
└── agents-manifest.json    # Machine-readable index
```

## Step 1: Agent JSON Schema

Every agent follows this structure:

```json
{
  "author": "your-name",
  "config": {
    "systemRole": "You are a ... expert assistant...",
    "openingMessage": "Hello! I'm your assistant for...",
    "openingQuestions": [
      "How do I create a token on Pump?",
      "What's the current fee structure?",
      "How do bonding curves work?"
    ]
  },
  "createdAt": "2026-03-06",
  "examples": [
    {
      "role": "user",
      "content": "How do I buy tokens?"
    },
    {
      "role": "assistant",
      "content": "To buy tokens from a bonding curve..."
    }
  ],
  "identifier": "my-custom-agent",
  "meta": {
    "title": "My Custom Agent",
    "description": "Expert assistant for ...",
    "avatar": "🤖",
    "tags": ["defi", "solana", "trading"],
    "category": "defi"
  },
  "schemaVersion": 1,
  "summary": "A one-paragraph description of what this agent does.",
  "tokenUsage": 500
}
```

### Key Fields

| Field | Purpose |
|-------|---------|
| `config.systemRole` | The system prompt — defines the agent's expertise and behavior |
| `config.openingMessage` | First message the agent sends when a conversation starts |
| `config.openingQuestions` | Suggested questions shown to the user |
| `examples` | Few-shot demonstration of the agent's style |
| `meta.avatar` | Emoji or image URL |
| `meta.category` | One of: `defi`, `security`, `analytics`, `education`, `general` |
| `tokenUsage` | Estimated token count of the system prompt |
| `schemaVersion` | Always `1` |

## Step 2: Create a New Agent

Start from the template:

```bash
cp agent-template.json src/my-pump-trader.json
```

Edit `src/my-pump-trader.json`:

```json
{
  "author": "your-name",
  "config": {
    "systemRole": "You are a Pump Fun Trading Strategist specializing in bonding curve dynamics and graduation timing.\n\nCore Knowledge:\n- Bonding curves use constant-product AMM: virtualSolReserves × virtualTokenReserves = k\n- Tokens graduate to PumpAMM when the SOL cap is reached\n- Fee tiers: 1% (< 10M supply), 1.5% (10-100M), 2% (> 100M)\n- Always use BN.js for financial math — never JavaScript number\n- Slippage protection: recommend 3-5% for normal trades, 10% for volatile\n\nTrading Rules:\n1. Always check `bondingCurve.complete` before choosing Pump vs AMM\n2. Calculate price impact before large trades with `calculateBuyPriceImpact`\n3. Use `getGraduationProgress` to time entries near graduation\n4. Monitor fee shares — creators with fee sharing enabled have more skin in the game\n\nRisk Warnings:\n- Never invest more than you can afford to lose\n- Bonding curve tokens are highly volatile\n- Check holder distribution before buying",
    "openingMessage": "Hey! I'm your Pump trading strategy assistant. I can help you analyze bonding curves, time entries, estimate price impact, and navigate graduation to AMM. What token are you looking at?",
    "openingQuestions": [
      "Analyze this token's bonding curve health",
      "What's a good entry strategy for a token at 60% curve?",
      "How do I calculate price impact for a 1 SOL buy?",
      "When should I sell before vs after graduation?"
    ]
  },
  "createdAt": "2026-03-06",
  "examples": [
    {
      "role": "user",
      "content": "Should I buy a token that's at 85% bonding curve progress?"
    },
    {
      "role": "assistant",
      "content": "At 85% curve progress, you're buying late into the bonding phase. Here's what to consider:\n\n**Pros:**\n- Close to graduation — if it graduates, you'll trade on AMM with deeper liquidity\n- High curve progress means strong community interest\n\n**Risks:**\n- Price is much higher than early buyers paid\n- Smaller upside potential within the bonding curve\n- If momentum stalls, you could be left holding at a premium\n\n**My suggestion:** Use `getGraduationProgress()` to get the exact %. If it's above 90%, the risk/reward shifts toward graduation. Size your position small (0.1-0.5 SOL) and set tight slippage. Check `calculateBuyPriceImpact` to see how much your buy moves the price.\n\n```typescript\nconst progress = await onlineSdk.getGraduationProgress(mint);\nconst impact = PUMP_SDK.calculateBuyPriceImpact(bc, new BN(500_000_000));\n```"
    }
  ],
  "identifier": "pump-trading-strategist",
  "meta": {
    "title": "Pump Trading Strategist",
    "description": "Analyzes bonding curves, times entries, estimates price impact, and optimizes trading strategies for Pump tokens.",
    "avatar": "📈",
    "tags": ["trading", "pump", "bonding-curve", "strategy", "defi"],
    "category": "defi"
  },
  "schemaVersion": 1,
  "summary": "A trading strategy assistant for Pump protocol tokens that analyzes bonding curve dynamics, price impact, graduation timing, and risk management.",
  "tokenUsage": 420
}
```

## Step 3: Translate to 18 Languages

Create locale files for each supported language:

```bash
# Create locale directory
mkdir -p locales/pump-trading-strategist

# Copy as English default
cp src/pump-trading-strategist.json locales/pump-trading-strategist/index.json
```

### Supported Languages

| Locale | Language |
|--------|----------|
| `en-US` | English (default) |
| `zh-CN` | Chinese (Simplified) |
| `zh-TW` | Chinese (Traditional) |
| `ja-JP` | Japanese |
| `ko-KR` | Korean |
| `es-ES` | Spanish |
| `pt-BR` | Portuguese |
| `fr-FR` | French |
| `de-DE` | German |
| `it-IT` | Italian |
| `ru-RU` | Russian |
| `ar-SA` | Arabic |
| `hi-IN` | Hindi |
| `tr-TR` | Turkish |
| `vi-VN` | Vietnamese |
| `th-TH` | Thai |
| `nl-NL` | Dutch |
| `pl-PL` | Polish |

### Locale File Format

```json
// locales/pump-trading-strategist/index.ja-JP.json
{
  "config": {
    "systemRole": "あなたはPump Funトレーディング戦略家です...",
    "openingMessage": "こんにちは！Pumpトレーディング戦略アシスタントです...",
    "openingQuestions": [
      "このトークンのボンディングカーブの健全性を分析してください",
      "カーブ60%のトークンへの良いエントリー戦略は？"
    ]
  },
  "meta": {
    "title": "Pumpトレーディング戦略家",
    "description": "ボンディングカーブのダイナミクスを分析し..."
  }
}
```

**Translate only**: `systemRole`, `openingMessage`, `openingQuestions`, `meta.title`, `meta.description`, `summary`. Keep `identifier`, `author`, `tags`, `examples` in English.

## Step 4: Register in the Manifest

Add your agent to `agents-manifest.json`:

```json
{
  "accessPatterns": {
    "getAllAgents": "GET /index.json",
    "getAgentsByLanguage": "GET /index.{locale}.json",
    "getSingleAgent": "GET /{agent-id}.json",
    "getSingleAgentLocalized": "GET /{agent-id}.{locale}.json"
  },
  "agents": {
    "your-name": {
      "count": 1,
      "agents": ["pump-trading-strategist"]
    }
  }
}
```

## Step 5: Load into LLM Platforms

### OpenAI / GPT

```typescript
import { OpenAI } from "openai";
import agentDef from "./src/pump-trading-strategist.json";

const openai = new OpenAI();

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: agentDef.config.systemRole },
    { role: "user", content: "Analyze a token at 72% curve progress" },
  ],
});
```

### Anthropic / Claude

```typescript
import Anthropic from "@anthropic-ai/sdk";
import agentDef from "./src/pump-trading-strategist.json";

const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  system: agentDef.config.systemRole,
  messages: [
    { role: "user", content: "What's the best entry strategy?" },
  ],
  max_tokens: 1024,
});
```

### REST API Access

```bash
# Get all agents
curl https://your-domain.com/index.json

# Get single agent
curl https://your-domain.com/pump-trading-strategist.json

# Get localized
curl https://your-domain.com/pump-trading-strategist.ja-JP.json
```

## Step 6: Test Your Agent

```typescript
import agentDef from "./src/pump-trading-strategist.json";

// Verify schema
console.assert(agentDef.schemaVersion === 1);
console.assert(agentDef.identifier.length > 0);
console.assert(agentDef.config.systemRole.length > 0);
console.assert(agentDef.meta.tags.length > 0);
console.assert(agentDef.examples.length >= 1);

// Check token usage estimate
const actualTokens = Math.ceil(agentDef.config.systemRole.length / 4);
console.log(`Estimated tokens: ${agentDef.tokenUsage}, actual ~${actualTokens}`);
```

## Existing Agents (43 total)

Sample from the collection:

| Agent | Avatar | Category |
|-------|--------|----------|
| Pump Fun SDK Expert | 🚀 | DeFi |
| Airdrop Hunter | 🎯 | DeFi |
| Alpha Leak Detector | 🔍 | Analytics |
| Bridge Security Analyst | 🌉 | Security |
| Crypto News Analyst | 📰 | Analytics |
| Yield Sustainability Analyst | 📊 | DeFi |
| APY vs APR Educator | 🎓 | Education |

## Next Steps

- See [Tutorial 20](./20-mcp-server-ai-agents.md) for MCP server integration
