# Using DeFi Agents with OpenRouter

DeFi Agents is a framework for building AI-powered DeFi agents. Use it with OpenRouter to access any AI model for your autonomous trading and DeFi strategies.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides unified access to 200+ AI models through a single API.

## Setup

### 1. Get Your OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Generate an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)

### 2. Configure Your Agent

```typescript
import { DeFiAgent } from '@nirholas/defi-agents';
import OpenAI from 'openai';

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

const agent = new DeFiAgent({
  llm: openrouter,
  model: 'anthropic/claude-sonnet-4',
  // ... other config
});
```

### 3. Run Your Agent

```typescript
await agent.analyze('Should I provide liquidity to ETH/USDC on Uniswap?');
```

## Use Cases

| Agent Type | Description |
|------------|-------------|
| **Trading Agent** | AI-driven trading decisions |
| **Yield Optimizer** | Find and optimize yield farming |
| **Risk Analyzer** | Assess DeFi protocol risks |
| **Portfolio Manager** | Manage multi-chain portfolios |

## Why OpenRouter for DeFi Agents?

- **Model Flexibility** - Switch between models based on task complexity
- **Cost Control** - Use cheaper models for routine tasks
- **Redundancy** - Automatic failover between providers
- **No Vendor Lock-in** - Works with 200+ models

## Recommended Models

| Task | Recommended Model |
|------|-------------------|
| Complex analysis | `anthropic/claude-sonnet-4` |
| Quick decisions | `meta-llama/llama-3-70b-instruct` |
| Cost-sensitive | `mistralai/mixtral-8x7b-instruct` |

## Resources

- [GitHub](https://github.com/nirholas/defi-agents)
- [OpenRouter Docs](https://openrouter.ai/docs)

