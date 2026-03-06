# Agent Teams Guide

How to use multiple specialized agents collaboratively in AI Agents Library.

---

## What Are Agent Teams?

Agent Teams bring together multiple AI agents, each with their own expertise, to collaborate on conversations. Instead of one agent's perspective, you get comprehensive answers from a team of specialists.

**Key Benefits:**

- Multiple perspectives on complex problems
- Specialized agents contribute their unique strengths
- Coordinated discussion with built-in host
- Richer, more comprehensive solutions

---

## How Agent Teams Work

### The Flow

1. **You ask a question** or present a problem
2. **Host agent** determines which team members should respond
3. **Agents discuss** and build on each other's insights
4. **Host coordinates** the conversation flow
5. **You receive** comprehensive, multi-perspective answer

### The Host Agent

Every team has a host who:

- Decides speaking order
- Keeps discussion organized
- Synthesizes insights
- Asks clarifying questions
- Manages conversation flow

**You can:**

- Interrupt the host at any time
- Customize host behavior in Advanced Options
- Resume whenever you're ready

---

## Creating an Agent Team

### Quick Start

1. **Click "Create Agent Team"** in AI Agents Library
2. **Choose method:**
   - Use preset template (recommended for beginners)
   - Build custom team from your agents

### From Template

**Available Templates:**

**DeFi Strategy Team**

- Portfolio Analyzer
- Yield Optimizer
- Risk Assessor
- Gas Cost Calculator

**Content Creation Team**

- Writer
- Editor
- SEO Specialist
- Social Media Adapter

**Research Team**

- Data Gatherer
- Analyst
- Citation Checker
- Summarizer

**Problem Solving Team**

- Strategy Consultant
- Technical Expert
- Risk Evaluator
- Implementation Planner

Select template → Customize members if needed → Start conversation

### Build Custom Team

1. **Select 3-5 agents** from your workspace
2. **Assign roles** (optional but recommended)
3. **Configure host** behavior
4. **Set team name**
5. **Save and start**

---

## Using Agent Teams

### @ Mentions

Target specific team members:

```
@Portfolio-Analyzer what's my current allocation?
```

Only that agent responds directly.

### Private Messages

Click agent's avatar to send direct message:

- Other team members don't see it
- Use for sensitive questions
- Coordinate behind the scenes

### Interrupt and Resume

**Interrupt:** Click "Pause" or interrupt naturally

- Team freezes current state
- Conversation pauses mid-discussion

**Resume:** Click "Continue" or prompt host

- Team picks up where it left off
- Maintains context

### Team Speed

Adjust response pacing:

- **Fast:** Quick exchanges (good for simple queries)
- **Medium:** Balanced discussion \[Default]
- **Slow:** Thorough deliberation (complex problems)

---

## Example Scenarios

### DeFi Portfolio Analysis

**Team:**

- Portfolio Analyzer
- Risk Assessor
- Yield Optimizer
- Rebalancing Advisor

**User:** "Review my positions and suggest improvements"

**Flow:**

1. Portfolio Analyzer examines holdings
2. Risk Assessor evaluates exposure
3. Yield Optimizer identifies opportunities
4. Rebalancing Advisor suggests changes
5. Host synthesizes recommendations

**Result:** Comprehensive analysis from multiple angles

---

### Content Strategy

**Team:**

- Topic Researcher
- Content Writer
- SEO Specialist
- Distribution Strategist

**User:** "Plan a content series about DeFi for beginners"

**Flow:**

1. Researcher identifies trending topics
2. Writer proposes article structures
3. SEO suggests keywords and optimization
4. Distribution recommends channels
5. Host creates unified strategy

**Result:** Complete content plan ready to execute

---

### Technical Problem

**Team:**

- Smart Contract Auditor
- Gas Optimizer
- Security Expert
- Best Practices Advisor

**User:** "Review this contract for issues"

**Flow:**

1. Auditor scans for vulnerabilities
2. Gas Optimizer finds efficiency improvements
3. Security Expert assesses risks
4. Best Practices suggests improvements
5. Host prioritizes findings

**Result:** Thorough code review from multiple dimensions

---

## Best Practices

### Team Size

**Optimal:** 3-5 agents

- Enough diversity
- Manageable coordination
- Maintains focus

**Too few (1-2):** Limited perspectives
**Too many (6+):** Coordination overhead, slower responses

### Agent Selection

**Mix expertise types:**
✅ Analyst + Strategist + Risk Assessor + Implementer
❌ 4 variations of the same role

**Complementary skills:**

- Breadth agent + Depth agent
- Creative agent + Analytical agent
- Big picture + Details

### Host Customization

**Default host works for most cases**

**Customize when:**

- Specific industry knowledge needed
- Particular facilitation style wanted
- Custom decision-making process

**Advanced Options → Custom Moderator:**

```
You are a DeFi-focused team coordinator.

Prioritize:
- Risk assessment first
- Security considerations always
- Gas costs in every recommendation

Guide discussion toward:
- Actionable recommendations
- Clear next steps
- Risk-adjusted thinking
```

### Conversation Management

**Start broad, get specific:**

```
✅ "Analyze our DeFi strategy"
   → Let team discuss
   → Then: "@Risk-Assessor what's our worst-case scenario?"

❌ "Tell me exactly what to do"
   → Too directive
   → Doesn't leverage team dynamics
```

**Use private messages for:**

- Clarifying questions
- Sensitive information
- Behind-scenes coordination

**Use @ mentions for:**

- Direct questions to specific expertise
- Getting second opinions
- Resolving disagreements

---

## Advanced Features

### Team Templates

**Save your custom teams:**

1. Create and configure team
2. Click "Save as Template"
3. Name and describe
4. Reuse anytime

**Share templates:**

- Export configuration
- Share with team
- Import on their end

### Sequential vs Parallel

**Sequential (Default):**

- Agents take turns
- Build on previous responses
- More organized

**Parallel (Advanced):**

- Agents respond simultaneously
- Faster but potentially chaotic
- Good for independent analyses

### Role Assignment

Give agents specific responsibilities:

```
Portfolio Analyzer: "Data collector"
Risk Assessor: "Devil's advocate"
Yield Optimizer: "Opportunity spotter"
Host: "Decision maker"
```

Roles guide behavior and coordination.

---

## Common Use Cases

### 1. Investment Analysis

**Team:** Fundamental Analyst + Technical Analyst + Risk Manager + Market Strategist

**Use:** Comprehensive investment evaluation

---

### 2. Content Production

**Team:** Researcher + Writer + Editor + SEO Specialist

**Use:** End-to-end content creation

---

### 3. Project Planning

**Team:** Strategist + Technical Lead + Resource Manager + Risk Assessor

**Use:** Complete project roadmap

---

### 4. Code Review

**Team:** Security Auditor + Performance Optimizer + Best Practices Expert + Documentation Reviewer

**Use:** Multi-dimensional code assessment

---

### 5. Decision Making

**Team:** Pros/Cons Analyst + Devil's Advocate + Opportunity Spotter + Risk Evaluator

**Use:** Balanced decision analysis

---

## Troubleshooting

### Team responses too slow

**Solutions:**

- Reduce team size (3 instead of 5)
- Increase Team Speed setting
- Use faster model if available
- Start fresh conversation (clear context)

### Agents talk past each other

**Solutions:**

- Customize host to better coordinate
- Use @ mentions to direct conversation
- Interrupt and redirect
- Ensure agents have complementary (not duplicate) roles

### Too much agreement (no debate)

**Solutions:**

- Add "devil's advocate" agent
- Customize host: "Encourage different perspectives"
- Use agents with different philosophies
- Explicitly ask for counterarguments

### Host too dominant

**Solutions:**

- Customize host: "Facilitate, don't dominate"
- Use @ mentions to bypass host
- Adjust host instructions to be more neutral

### Missing key perspective

**Solutions:**

- Add relevant agent mid-conversation
- @ mention external agent for input
- Note for next time to include in template

---

## Creating Agent Teams for Others

### Team Design Principles

1. **Clear division of labor**

- Each agent has specific expertise
- Minimal overlap
- Complementary strengths

2. **Appropriate size**

- 3-5 for most use cases
- Can go to 6-7 for comprehensive analysis
- Avoid 8+ (coordination breaks down)

3. **Balanced perspectives**

- Mix of specialist types
- Include risk/opportunity agents
- Add devil's advocate if needed

4. **Host instructions**

- Specify facilitation style
- Set priority order if needed
- Define success criteria

### Example: Research Team

```json
{
  "agents": [
    "literature-reviewer",
    "methodology-expert",
    "data-analyst",
    "citation-checker",
    "synthesizer"
  ],
  "host": {
    "instructions": "Coordinate academic research process. Ensure methodology rigor, proper citations, and clear synthesis. Facilitate from research question → literature review → methodology → analysis → conclusions."
  },
  "name": "Academic Research Team"
}
```

---

## Tips for Power Users

### Reusable Templates

Create templates for recurring workflows:

- Weekly portfolio review
- Content pipeline
- Code review process
- Strategic planning

### Hybrid Approach

Combine team discussion with individual agent queries:

1. Get team perspective
2. @ mention specific agent for depth
3. Use private messages for follow-ups
4. Return to team for synthesis

### Iterative Refinement

**First run:** See how team interacts
**Second run:** Adjust roles and host
**Third run:** Optimize team composition
**Fourth+ run:** Fine-tuned workflow

### Documentation

Keep notes on what works:

- Which agent combinations
- Effective host instructions
- Good use cases
- Team dynamics observations

---

## FAQ

**Q: Can I use the same agent twice in a team?**
A: Technically yes, but not recommended. Use different specialized agents instead.

**Q: Do agents see each other's full conversation history?**
A: Yes, that's how they build on each other's insights.

**Q: Can I remove an agent mid-conversation?**
A: Not currently. Plan team composition before starting.

**Q: Does team size affect cost?**
A: Yes—more agents = more tokens = higher cost. Keep teams lean.

**Q: Can teams work on long documents?**
A: Yes, but monitor context limits. Teams consume more tokens than solo agents.

---

## Resources

- Pre-built team templates in marketplace
- Community-shared team configurations
- Team composition best practices guide
- Host customization examples

---

Agent Teams transform AI from solo performer to collaborative ensemble. Start simple, experiment, refine.

