# Agent Creation Guide

## Overview

Agents in AI Agents Library are specialized AI assistants designed to handle specific tasks in DeFi, crypto, and Web3. This guide will help you create effective agents for the marketplace.

## Agent Anatomy

### Basic Structure

```json
{
  "author": "your-github-username",
  "config": {
    "systemRole": "Your detailed system prompt here..."
  },
  "identifier": "unique-agent-id",
  "meta": {
    "title": "Agent Display Name",
    "description": "Clear, concise description (max 200 characters)",
    "avatar": "🤖",
    "tags": ["defi", "trading", "analytics"],
    "systemRole": "agent"
  },
  "schemaVersion": 1
}
```

### Key Components

**identifier**: URL-safe name (lowercase, hyphens, no spaces)

- Good: `sperax-yield-optimizer`, `defi-portfolio-analyzer`
- Bad: `My Agent!`, `DeFi Agent v2`

**title**: Display name (user-facing, can have spaces/caps)

**description**: Brief summary visible in marketplace (160-200 chars optimal)

**avatar**: Single emoji that represents your agent's function

**tags**: 3-8 relevant keywords for discovery

**systemRole**: The core prompt that defines agent behavior

## Writing Effective System Prompts

### Structure Template

```
You are [ROLE/IDENTITY]

CAPABILITIES:
- [What the agent can do]
- [Key specialization]
- [Tools/knowledge available]

GUIDELINES:
- [How to approach tasks]
- [Response format]
- [Constraints/limitations]

WORKFLOW:
1. [Step-by-step process]
2. [How to handle specific scenarios]

EXAMPLES:
[Optional: Demonstrate desired behavior]
```

### DeFi Agent Example

```json
{
  "systemRole": "You are a DeFi Yield Optimization Specialist focusing on the AI Agents Library ecosystem.

CAPABILITIES:
- Analyze yield farming opportunities across protocols
- Calculate APY/APR with impermanent loss considerations
- Monitor gas costs and optimize transaction timing
- Compare liquidity pools and staking options

GUIDELINES:
- Always include risk assessments (high/medium/low)
- Show calculations transparently
- Consider gas costs in recommendations
- Mention smart contract audit status when known

WORKFLOW:
1. Understand user's capital amount and risk tolerance
2. Analyze current market conditions
3. Compare top 3-5 opportunities with pros/cons
4. Provide specific action steps with estimated returns
5. Include warnings about risks

When analyzing yields, format as:
Protocol | APY | TVL | Risk | Gas Cost | Recommendation"
}
```

## Best Practices

### Do's

✅ Be specific about capabilities and limitations
✅ Include relevant DeFi/crypto terminology
✅ Provide structured, scannable output formats
✅ Consider gas costs in recommendations
✅ Mention risks and security considerations
✅ Use clear step-by-step workflows

### Don'ts

❌ Make financial guarantees or predictions
❌ Recommend specific investments without disclaimers
❌ Ignore security and audit status
❌ Use overly technical jargon without explanation
❌ Provide outdated protocol information
❌ Copy prompts from other agents verbatim

## Agent Categories

### DeFi & Finance

- Yield optimizers
- Portfolio managers
- Risk assessors
- Staking calculators
- Gas optimizers

### Trading & Analysis

- Market sentiment analyzers
- Technical analysts
- On-chain data interpreters
- MEV researchers
- Trading strategy advisors

### Development & Security

- Smart contract auditors
- Solidity experts
- Web3 architecture consultants
- Security researchers
- Testing specialists

### Research & Education

- Protocol explainers
- Tokenomics analysts
- Whitepaper reviewers
- DeFi educators
- Governance advisors

## Testing Your Agent

Before submission, test your agent thoroughly:

1. **Basic Functionality**: Does it understand its role?
2. **Edge Cases**: How does it handle unusual requests?
3. **Error Handling**: Does it gracefully decline out-of-scope tasks?
4. **Response Quality**: Are outputs clear, accurate, helpful?
5. **Consistency**: Does it maintain character across conversations?

### Test Prompts

Try these with your DeFi agent:

```
"What's the best yield opportunity right now?"
"Compare staking SPA vs providing liquidity"
"Calculate impermanent loss for ETH/USDC pool"
"Is this smart contract safe?" [provide address]
"Explain the AI Agents Library USDs mechanism"
```

## Localization

Agents are automatically translated to 18 languages. Tips for translation-friendly prompts:

- Use clear, standard English
- Avoid idioms and colloquialisms
- Keep sentences concise
- Use consistent terminology
- Define technical terms on first use

## Submission Checklist

- [ ] Unique, descriptive identifier
- [ ] Clear title and description
- [ ] Appropriate avatar emoji
- [ ] 3-8 relevant tags
- [ ] Well-structured system prompt
- [ ] Tested with multiple queries
- [ ] No copyrighted or proprietary content
- [ ] Follows community guidelines
- [ ] JSON validates correctly

## Examples of Great Agents

### Simple Agent (Trading Sentiment)

```json
{
  "config": {
    "systemRole": "You analyze cryptocurrency market sentiment by synthesizing data from multiple sources: social media trends, news sentiment, on-chain metrics, and community discussions. Provide sentiment scores (bullish/neutral/bearish) with supporting evidence and confidence levels."
  },
  "identifier": "crypto-sentiment-analyzer",
  "meta": {
    "title": "Crypto Sentiment Analyzer",
    "description": "Analyzes market sentiment from social media, news, and on-chain data",
    "avatar": "📊",
    "tags": ["trading", "sentiment", "analysis", "social"]
  }
}
```

### Complex Agent (Portfolio Manager)

```json
{
  "identifier": "defi-portfolio-manager",
  "meta": {
    "title": "DeFi Portfolio Manager",
    "description": "Comprehensive portfolio tracking, rebalancing suggestions, and risk management for DeFi positions",
    "avatar": "💼",
    "tags": ["defi", "portfolio", "risk", "management"]
  },
  "config": {
    "systemRole": "You are an expert DeFi portfolio manager specializing in multi-protocol position tracking and optimization.

CORE FUNCTIONS:
1. Portfolio Analysis: Track assets across protocols, calculate net worth, identify concentrations
2. Risk Assessment: Evaluate smart contract risk, impermanent loss exposure, liquidation risks
3. Rebalancing: Suggest optimal rebalancing based on market conditions and user goals
4. Yield Tracking: Monitor APYs, claim rewards timing, compound strategies

WORKFLOW:
- Request user's wallet address or manual position entry
- Calculate current allocation and risk exposure
- Analyze yields and locked capital
- Provide actionable recommendations with rationale
- Include gas cost considerations

OUTPUT FORMAT:
Portfolio Summary | Risk Score | Recommendations | Action Items

Always disclaim: 'Not financial advice. DYOR.'"
  }
}
```

## Need Help?

- Open an issue with the `agent-help` tag
- Join our Discord community
- Check existing agents for inspiration
- Review the [Prompt Engineering Guide](./PROMPTS.md)

---

**Ready to contribute?** Submit your agent via Pull Request!

