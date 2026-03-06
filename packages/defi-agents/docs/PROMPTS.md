# Prompt Engineering Guide

## Introduction

Effective prompts are the foundation of powerful AI agents. This guide teaches you how to craft system prompts that produce consistent, high-quality results.

## Prompt Structure

### Basic Framework

```
[IDENTITY] + [CAPABILITIES] + [GUIDELINES] + [FORMAT] + [EXAMPLES]
```

### Identity

Define who/what the agent is:

```
You are a DeFi security auditor specializing in Ethereum smart contracts.
```

Clear identity creates consistent behavior and sets user expectations.

### Capabilities

List specific skills and knowledge:

```
CAPABILITIES:
- Analyze Solidity code for common vulnerabilities
- Check for reentrancy, overflow, and access control issues
- Review token economics and minting mechanisms
- Assess gas optimization opportunities
```

### Guidelines

Behavior rules and constraints:

```
GUIDELINES:
- Classify risks as Critical/High/Medium/Low
- Provide code snippets showing vulnerabilities
- Suggest specific fixes with examples
- Never guarantee 100% security
- Recommend professional audits for production code
```

### Output Format

Structure for responses:

```
FORMAT:
Security Score: [0-100]
Critical Issues: [List]
Recommendations: [Prioritized steps]
Code Examples: [Where applicable]
```

### Examples

Demonstrate desired behavior (optional but powerful):

```
EXAMPLE:
User: "Check this function for issues"
You: "Security Score: 65/100

Critical Issues:
1. Reentrancy vulnerability on line 45
   - Current: function withdraw() external { ... }
   - Fix: Add nonReentrant modifier

Recommendations:
1. Implement checks-effects-interactions pattern
2. Add reentrancy guard
3. Consider using OpenZeppelin's ReentrancyGuard"
```

## Writing Clear Prompts

### Be Specific

❌ Vague: "You help with DeFi"
✅ Clear: "You analyze yield farming strategies across Ethereum Layer 2 protocols, focusing on risk-adjusted returns"

### Use Action Verbs

✅ Analyze, Calculate, Compare, Evaluate, Recommend, Monitor, Optimize

### Set Boundaries

```
IN SCOPE:
- Ethereum mainnet and L2s (Arbitrum, Optimism, Base)
- Established protocols (TVL > $10M)
- Yield strategies up to medium risk

OUT OF SCOPE:
- Unaudited contracts
- New protocols (< 3 months old)
- High-risk leveraged positions
- Tax or legal advice
```

## Advanced Techniques

### Conditional Logic

```
IF user provides wallet address:
  - Fetch on-chain data
  - Analyze current positions
  - Provide personalized recommendations

IF user asks about specific protocol:
  - Check TVL and audit status
  - Analyze recent activity
  - Provide risk assessment

IF query is unclear:
  - Ask 2-3 clarifying questions
  - Don't make assumptions
```

### Tone and Personality

```
COMMUNICATION STYLE:
- Professional but approachable
- Use analogies for complex concepts
- Acknowledge uncertainty when appropriate
- Encourage user questions
```

For DeFi agents, balance between:

- **Technical accuracy** (for experienced users)
- **Accessibility** (for newcomers)

### Error Handling

```
WHEN USER REQUEST IS OUT OF SCOPE:
"I specialize in yield optimization for established protocols. For [user's topic], I recommend consulting [appropriate resource]."

WHEN DATA IS UNAVAILABLE:
"I don't have real-time data on that protocol. I can explain the general mechanism, or you can check [reliable source]."

WHEN RISKS ARE HIGH:
"⚠️ High Risk Alert: This strategy involves [specific risks]. Only proceed if you understand and can afford potential losses."
```

## Domain-Specific Tips

### DeFi Prompts

Include:

- Risk disclaimers
- Gas cost considerations
- Smart contract audit status
- Impermanent loss warnings
- Slippage and MEV awareness

```
RISK DISCLAIMER:
Always append to financial recommendations:
"Not financial advice. Smart contract risks exist. Only invest what you can afford to lose. DYOR."
```

### Trading Agents

```
NEVER:
- Guarantee profits or outcomes
- Provide specific entry/exit prices
- Recommend leverage without risk warnings
- Ignore market context

ALWAYS:
- Include multiple scenarios (bull/bear/sideways)
- Show supporting data/charts
- Explain reasoning transparently
- Suggest position sizing
```

### Technical Agents

```
CODE REVIEW STRUCTURE:
1. High-level assessment
2. Line-by-line analysis
3. Security concerns
4. Gas optimizations
5. Best practice recommendations
6. Suggested improvements with code
```

## Testing Your Prompts

### Test Suite

Try these scenarios:

1. **Happy Path**: Standard, clear request
2. **Ambiguous**: Vague or unclear query
3. **Out of Scope**: Request beyond agent's expertise
4. **Edge Case**: Unusual or complex situation
5. **Adversarial**: Attempt to break agent behavior

### Iterative Refinement

```
Version 1: Basic prompt
↓
Test with users
↓
Identify issues: Too verbose? Missing context? Inconsistent?
↓
Version 2: Refined prompt
↓
Test again
↓
Version 3: Optimized prompt
```

## Common Pitfalls

### ❌ Too Broad

"You help with cryptocurrency"
→ Too vague, leads to inconsistent behavior

### ❌ Too Narrow

"You only calculate APY for Uniswap V2 ETH/USDC pools on Thursdays"
→ Overly specific, not useful

### ❌ Contradictory

"Be concise. Provide detailed explanations with examples."
→ Conflicting instructions confuse the model

### ❌ Assuming Knowledge

Referring to concepts without defining them
→ Explain or link to definitions

## Prompt Templates

### General Purpose

```
You are [ROLE] with expertise in [DOMAIN].

Your core functions:
1. [Function 1]
2. [Function 2]
3. [Function 3]

When responding:
- [Guideline 1]
- [Guideline 2]
- [Guideline 3]

Format your responses as:
[Structure description]
```

### Analytical Agent

```
You are a [TYPE] analyst for [DOMAIN].

ANALYSIS FRAMEWORK:
1. Data Collection: [Sources]
2. Processing: [Methods]
3. Interpretation: [Approach]
4. Recommendation: [Format]

DELIVERABLES:
- Summary (2-3 sentences)
- Detailed analysis
- Risk assessment
- Actionable insights

CONFIDENCE LEVELS:
- High: Strong supporting evidence
- Medium: Reasonable evidence
- Low: Limited or conflicting data
```

### Educational Agent

```
You are a [TOPIC] educator specializing in [AUDIENCE LEVEL].

TEACHING APPROACH:
- Start with fundamentals
- Build complexity gradually
- Use analogies and examples
- Check understanding with questions
- Provide resources for deeper learning

FORMAT:
1. Concept explanation (ELI5)
2. Technical details
3. Practical example
4. Common misconceptions
5. Further reading
```

## Resources

- [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)
- [Anthropic Prompting Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [Learn Prompting](https://learnprompting.org/)

## Examples from Top Agents

See `/src/` directory for 505 example agents with proven prompts across various domains.

---

**Questions?** Open an issue or join our Discord community.

