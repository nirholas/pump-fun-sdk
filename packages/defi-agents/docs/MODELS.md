# Model Parameters Guide

Understanding model parameters helps you fine-tune agent behavior for optimal results.

## Core Parameters

### Temperature (0.0 - 2.0)

Controls randomness in responses.

**Low (0.0 - 0.3)**

- Deterministic, consistent output
- Same input → same output
- Best for: Code generation, calculations, factual queries

**Medium (0.4 - 0.7)** \[Default]

- Balanced creativity and consistency
- Slight variations in responses
- Best for: General conversation, analysis

**High (0.8 - 2.0)**

- Creative, unpredictable output
- High variation
- Best for: Brainstorming, creative writing

**Examples:**

```
Query: "Explain smart contract reentrancy"

Temperature 0.0:
"Reentrancy occurs when a function calls an external contract..."
[Same answer every time]

Temperature 0.7:
"Reentrancy is a vulnerability where..."
[Slight variations in phrasing]

Temperature 1.5:
"Picture this: your smart contract is like a bank vault..."
[Creative analogies, different approaches]
```

### Top P (0.0 - 1.0)

Alternative to temperature. Controls diversity by probability threshold.

**How it works:**
Model generates candidate words with probabilities:

- `ethereum` (40%)
- `blockchain` (30%)
- `crypto` (20%)
- `web3` (10%)

**top_p = 0.9**: Include top candidates until 90% cumulative probability
→ Considers: ethereum (40%) + blockchain (30%) + crypto (20%) = 90%

**top_p = 0.5**: Only top 50%
→ Considers: ethereum (40%) only

**Settings:**

- **0.1 - 0.5**: Very focused, conservative
- **0.6 - 0.9**: Balanced diversity \[Default: 0.9]
- **0.95 - 1.0**: Maximum diversity

⚠️ **Don't adjust both temperature AND top_p** - use one or the other.

### Presence Penalty (-2.0 to 2.0)

Penalizes words that already appeared, reducing repetition.

**Negative (-2.0 to -0.1)**

- Encourages repetition
- Reinforces key terms
- Good for: Technical documentation

**Zero (0.0)** \[Default]

- Natural repetition
- Balanced

**Positive (0.1 to 2.0)**

- Discourages repetition
- Forces vocabulary diversity
- Good for: Creative content, avoiding redundancy

**Example (explaining DeFi):**

```
Presence Penalty = -1.0:
"DeFi protocols provide DeFi services. DeFi users can access DeFi platforms..."
[Repetitive, reinforces "DeFi"]

Presence Penalty = 0.0:
"DeFi protocols enable decentralized services. Users can access these platforms..."
[Natural repetition]

Presence Penalty = 1.5:
"Decentralized finance protocols enable trustless services. Participants can access blockchain-based platforms..."
[Varied vocabulary]
```

### Frequency Penalty (-2.0 to 2.0)

Penalizes words based on how OFTEN they've appeared.

**Difference from Presence Penalty:**

- **Presence**: Did word appear? (yes/no)
- **Frequency**: How many times? (count)

**Negative (-2.0 to -0.1)**

- Word spam possible
- Very high repetition

**Zero (0.0)** \[Default]

- Natural frequency

**Positive (0.1 to 2.0)**

- Strong anti-repetition
- Forces alternative phrasings

**Example:**

```
Frequency Penalty = -2.0:
"The yield yield yield yield optimizer optimizes yield yield..."
[Excessive repetition]

Frequency Penalty = 0.0:
"The yield optimizer analyzes yield opportunities and optimizes returns..."
[Natural]

Frequency Penalty = 2.0:
"The return optimizer analyzes APY opportunities and maximizes profits..."
[Varied terms]
```

### Reasoning Effort (Claude Sonnet 4 Only)

**low**

- Faster responses
- Basic reasoning
- Good for: Simple queries, quick answers

**medium** \[Default]

- Balanced speed and depth
- Standard reasoning
- Good for: Most use cases

**high**

- Slower responses
- Deep analysis
- More tokens used
- Good for: Complex problems, research, multi-step logic

## Recommended Settings by Use Case

### DeFi Analysis Agent

```json
{
  "frequency_penalty": 0.3,
  "presence_penalty": 0.2,
  "reasoning_effort": "medium",
  "temperature": 0.3,
  "top_p": 0.8
}
```

_Consistent, factual, avoids repetition_

### Creative Content Writer

```json
{
  "frequency_penalty": 0.6,
  "presence_penalty": 0.5,
  "reasoning_effort": "low",
  "temperature": 0.9,
  "top_p": 0.95
}
```

_Diverse, creative, varied vocabulary_

### Code Generator

```json
{
  "frequency_penalty": 0.0,
  "presence_penalty": 0.0,
  "reasoning_effort": "high",
  "temperature": 0.1,
  "top_p": 0.9
}
```

_Deterministic, precise, allows technical repetition_

### Research Assistant

```json
{
  "frequency_penalty": 0.2,
  "presence_penalty": 0.1,
  "reasoning_effort": "high",
  "temperature": 0.4,
  "top_p": 0.85
}
```

_Thorough, analytical, comprehensive_

### Trading Advisor

```json
{
  "frequency_penalty": 0.1,
  "presence_penalty": 0.0,
  "reasoning_effort": "medium",
  "temperature": 0.2,
  "top_p": 0.8
}
```

_Consistent, reliable, factual_

## Tuning Tips

### Start Conservative

Begin with default/low values, then increase gradually:

1. Test with temperature = 0.3
2. If too rigid, bump to 0.5
3. Adjust incrementally until optimal

### Single Variable

Change ONE parameter at a time to understand its effect.

### Context Matters

- **Short prompts** → Lower temperature (needs focus)
- **Long, detailed prompts** → Can increase temperature
- **Ambiguous queries** → Lower temperature (consistency)
- **Creative tasks** → Higher temperature

### Monitor Quality

Track across multiple queries:

- Consistency
- Accuracy
- Creativity
- Relevance
- Token usage

## Parameter Interactions

**Temperature + Top P**

- Don't tune both - use one
- Temperature is more intuitive
- Top P gives finer control

**Presence + Frequency Penalties**

- Can use both together
- Presence = reduce repetition
- Frequency = strongly reduce repetition
- Typical combo: presence=0.3, frequency=0.5

**Reasoning Effort + Temperature**

- Independent controls
- Reasoning affects thinking depth
- Temperature affects output randomness
- Can combine: reasoning=high, temp=0.3 for thorough consistent analysis

## Advanced: Context Window

**Max Tokens**
Not a tuning parameter, but important:

- Sets maximum response length
- Different per model
- Costs scale with length

**Models:**

- GPT-3.5: 4k context
- GPT-4: 8k context
- GPT-4-32k: 32k context
- Claude Sonnet 4: 200k context

For agents, set based on expected output:

- **Quick answers**: 500-1000 tokens
- **Analysis**: 1000-2000 tokens
- **Comprehensive**: 2000-4000 tokens

## Troubleshooting

**Problem: Too random/inconsistent**
→ Decrease temperature (try 0.3)
→ Decrease top_p (try 0.8)

**Problem: Too repetitive**
→ Increase presence_penalty (0.5-1.0)
→ Increase frequency_penalty (0.5-1.0)

**Problem: Too boring/generic**
→ Increase temperature (0.7-1.0)
→ Increase top_p (0.95)

**Problem: Off-topic responses**
→ Decrease temperature
→ Improve system prompt clarity

**Problem: Too brief**
→ Check max_tokens
→ Adjust prompt to request detail

**Problem: Too verbose**
→ Increase frequency_penalty
→ Add "be concise" to system prompt

## Testing Methodology

1. **Baseline**: Test with defaults
2. **Hypothesis**: "Increasing temp will make more creative"
3. **Test**: Run same query 5x with temp=0.8
4. **Measure**: Rate creativity, accuracy, consistency
5. **Compare**: vs baseline
6. **Iterate**: Adjust and retest

## Resources

- [OpenAI Parameter Guide](https://platform.openai.com/docs/api-reference/chat/create)
- [Anthropic Model Parameters](https://docs.anthropic.com/claude/docs/models-overview)

---

**Experiment and iterate** - optimal settings vary by use case and agent personality.

