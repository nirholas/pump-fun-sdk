# Tutorial 25: DeFi Agents Integration

> Use 43 pre-built AI agent definitions to build LLM-powered DeFi assistants that understand the Pump SDK.

## Prerequisites

- Node.js 18+
- An LLM API key (OpenAI, Anthropic, or local model)

```bash
npm install openai
# or
npm install @anthropic-ai/sdk
```

## What Are DeFi Agents?

The `packages/defi-agents/` directory contains **43 production-ready agent definitions** — JSON configurations that turn any LLM into a domain-specific DeFi assistant. Each agent includes:

- **System prompt** — Expert knowledge about a specific topic
- **Opening questions** — Suggested starter prompts
- **Example conversations** — Few-shot learning examples
- **Metadata** — Tags, categories, avatar, description

Agents are available in **18 languages** and work with Claude, GPT, LLaMA, and local models.

## Step 1: Load the Agent Manifest

```typescript
import fs from "fs";
import path from "path";

// Load the registry of all available agents
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../packages/defi-agents/agents-manifest.json"),
    "utf-8"
  )
);

console.log(`Available agents: ${manifest.agents.length}`);

// List all agents
for (const agent of manifest.agents) {
  console.log(`  ${agent.meta.avatar} ${agent.identifier} — ${agent.meta.title}`);
}
```

## Step 2: Use the Pump SDK Expert Agent

The flagship agent is `pump-fun-sdk-expert`:

```typescript
// Load the agent definition
const pumpExpert = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../packages/defi-agents/src/pump-fun-sdk-expert.json"
    ),
    "utf-8"
  )
);

console.log("Agent:", pumpExpert.meta.title);
console.log("Description:", pumpExpert.meta.description);
console.log("Tags:", pumpExpert.meta.tags.join(", "));
console.log("\nOpening questions:");
for (const q of pumpExpert.config.openingQuestions) {
  console.log(`  - ${q}`);
}
```

### Agent Structure

```json
{
  "identifier": "pump-fun-sdk-expert",
  "author": "sperax",
  "schemaVersion": 1,
  "meta": {
    "title": "Pump Fun SDK Expert",
    "description": "Specialized assistant for @nirholas/pump-sdk",
    "avatar": "🚀",
    "tags": ["pump-fun", "solana", "sdk", "bonding-curve", "token-creation"],
    "category": "defi"
  },
  "config": {
    "systemRole": "You are a Pump Fun SDK Expert...",
    "openingMessage": "Hello! I'm your Pump Fun SDK Expert...",
    "openingQuestions": [
      "How do I create a token on Pump using createV2Instruction?",
      "Can you explain the bonding curve math and price calculations?",
      "How do I set up fee sharing for my token's creator fees?",
      "What's the difference between PumpSdk (offline) and OnlinePumpSdk?"
    ]
  },
  "examples": [...]
}
```

## Step 3: Wire to OpenAI

```typescript
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function chatWithPumpExpert(userMessage: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: pumpExpert.config.systemRole },
      // Include few-shot examples
      ...pumpExpert.examples.map((ex: any) => ({
        role: ex.role as "user" | "assistant",
        content: ex.content,
      })),
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
  });

  return completion.choices[0].message.content ?? "";
}

// Example usage
const answer = await chatWithPumpExpert(
  "How do I calculate the price impact of buying 1 SOL worth of tokens?"
);
console.log(answer);
```

## Step 4: Wire to Anthropic Claude

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function chatWithPumpExpertClaude(userMessage: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: pumpExpert.config.systemRole,
    messages: [
      // Few-shot examples
      ...pumpExpert.examples.map((ex: any) => ({
        role: ex.role as "user" | "assistant",
        content: ex.content,
      })),
      { role: "user", content: userMessage },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
```

## Step 5: Build a Multi-Agent System

Combine multiple agents for a comprehensive DeFi assistant:

```typescript
interface AgentDefinition {
  identifier: string;
  meta: { title: string; tags: string[]; category: string };
  config: { systemRole: string };
}

// Load multiple relevant agents
const agents: Record<string, AgentDefinition> = {};

const agentFiles = fs.readdirSync(
  path.join(__dirname, "../packages/defi-agents/src")
);

for (const file of agentFiles) {
  if (!file.endsWith(".json")) continue;
  const agent = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../packages/defi-agents/src", file),
      "utf-8"
    )
  );
  agents[agent.identifier] = agent;
}

// Route questions to the right agent based on topic
function selectAgent(query: string): AgentDefinition {
  const queryLower = query.toLowerCase();

  if (queryLower.includes("price") || queryLower.includes("chart")) {
    return agents["coingecko-analyst"] ?? agents["pump-fun-sdk-expert"];
  }
  if (queryLower.includes("dex") || queryLower.includes("swap")) {
    return agents["dexscreener-analyst"] ?? agents["pump-fun-sdk-expert"];
  }
  if (queryLower.includes("pump") || queryLower.includes("bonding")) {
    return agents["pump-fun-sdk-expert"];
  }

  // Default to Pump expert
  return agents["pump-fun-sdk-expert"];
}

async function smartChat(userMessage: string): Promise<string> {
  const agent = selectAgent(userMessage);
  console.log(`Routing to: ${agent.meta.title}`);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: agent.config.systemRole },
      { role: "user", content: userMessage },
    ],
  });

  return completion.choices[0].message.content ?? "";
}
```

## Step 6: Serve Agents via API

Expose your agents as an API for other applications:

```typescript
import express from "express";

const app = express();
app.use(express.json());

// List all available agents
app.get("/agents", (req, res) => {
  const agentList = Object.values(agents).map((a) => ({
    identifier: a.identifier,
    title: a.meta.title,
    tags: a.meta.tags,
    category: a.meta.category,
  }));
  res.json({ agents: agentList });
});

// Get a specific agent definition
app.get("/agents/:id", (req, res) => {
  const agent = agents[req.params.id];
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(agent);
});

// Chat with a specific agent
app.post("/agents/:id/chat", async (req, res) => {
  const agent = agents[req.params.id];
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const { message } = req.body;
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "Missing 'message' in request body" });
    return;
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: agent.config.systemRole },
      { role: "user", content: message },
    ],
  });

  res.json({
    agent: agent.identifier,
    response: completion.choices[0].message.content,
  });
});

app.listen(3000, () => console.log("Agent API running on port 3000"));
```

## Available Agent Categories

| Category | Example Agents | Use Case |
|----------|---------------|----------|
| DeFi | pump-fun-sdk-expert, dex-aggregator | Token trading, SDK usage |
| Analytics | coingecko-analyst, dexscreener-analyst | Price data, market analysis |
| Infrastructure | gas-estimator, rpc-optimizer | Chain operations |
| Security | audit-assistant, rug-detector | Safety analysis |
| Education | solana-teacher, defi-explainer | Learning DeFi concepts |

## Next Steps

- Combine with [Tutorial 20](./20-mcp-server-ai-agents.md) for MCP tool-calling agents
- See [Tutorial 14](./14-x402-paywalled-apis.md) to monetize your agent API
- Check `packages/plugin.delivery/` for 17 API plugins to connect agents to external data
