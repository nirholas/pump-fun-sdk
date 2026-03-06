# Frequently Asked Questions

## General Questions

### What is an AI agent?

An AI agent is a specialized version of ChatGPT or Claude with specific instructions for one task. Instead of a generalist that tries to do everything, an agent focuses on doing one thing exceptionally well.

### Do I need coding skills to create an agent?

No. Creating an agent is about writing clear instructions in plain English. If you can explain what you want to a person, you can create an agent.

### Which platform should I use?

- **ChatGPT Custom GPTs**: Best for sharing publicly, has GPT Store
- **Claude Projects**: Best for document-heavy work, large context window
- **AI Agents Library**: Best for using pre-built agents, DeFi/crypto focus, agent teams

### Can I use the same agent across platforms?

The core system prompt works across platforms, but you'll need to recreate the agent in each. Copy your prompt and adapt the setup process for each platform.

---

## Creating Agents

### How long does it take to create an agent?

- Simple agent: 5-10 minutes
- Well-tested agent: 30-60 minutes
- Production-ready agent: 2-4 hours (including testing and refinement)

### What makes a good agent?

1. **Specific role** (not generic)
2. **Clear instructions** (no ambiguity)
3. **Consistent output** (same quality every time)
4. **Appropriate scope** (not too broad or narrow)
5. **Well-tested** (tried with real examples)

### How specific should my instructions be?

Very specific. Instead of "be helpful," say:

- "Keep responses under 150 words"
- "Use bullet points for lists of 3+ items"
- "Always include a call-to-action"
- "Match the user's formality level"

### Can I make an agent that does multiple things?

You can, but specialized agents perform better. Instead of one "productivity agent," create separate agents for:

- Email writing
- Meeting summaries
- Task organization
- Document proofreading

### How do I know if my agent is working well?

Test it 5-10 times with real scenarios. If you consistently get quality results without having to clarify or correct, it's working.

---

## AI Agents Library Marketplace

### How do I submit an agent to AI Agents Library?

1. Fork the repository: github.com/nirholas/AI-Agents-Library
2. Create your agent in `/src/your-agent-name.json`
3. Test thoroughly
4. Submit a Pull Request
5. Our team reviews within 48-72 hours

### Do I need to translate my agent?

No. Submit in English. Our automated i18n workflow translates to 18 languages automatically.

### Can I update an agent after submission?

Yes. Submit a new Pull Request with your changes. Explain what changed and why in the PR description.

### Can I delete or unpublish an agent?

Yes. Open an issue or PR requesting removal. Provide your reasoning.

### How do I get credit for my agent?

Your GitHub username is listed as the author. Users see this when browsing the marketplace.

### Can I monetize my agent?

Currently, the marketplace is free and open-source. Monetization features may be added in the future.

---

## Sperax Portfolio Agents

### What is the Sperax Portfolio master agent?

The **Sperax Portfolio** (🎯) is an all-in-one master agent that consolidates all 16 portfolio specialist agents into one comprehensive interface. It's recommended for most users as it provides access to 100% of portfolio features while maintaining conversation context.

**Current Status:**

- ✅ Read-only portfolio tracking and analytics available now
- 🚧 Automated trading, bots, and DeFi interactions coming soon (in SperaxOS roadmap)

### What domain do the Sperax portfolio agents use?

Currently, the Sperax portfolio agents (Dashboard, Trading Assistant, DCA Bot, etc.) use **sperax.fun** for testing and development purposes.

### Will the domain change in the future?

Yes, likely. Once **SperaxOS** is officially live in production, the domain may change to something like:

- **sperax.io** for the main platform
- **sperax.io/chat** for the SperaxOS chat interface
- Different subdomains for specific portfolio features

However, **everything is still in flux** and subject to change as the platform evolves.

### Should I hardcode sperax.fun URLs?

If you're building integrations or creating custom agents, be aware that:

- Current URL: `https://sperax.fun/artifacts/portfolio/embed/*`
- Future URL (tentative): `https://sperax.io/*` or similar
- Timeline: TBD based on SperaxOS production launch

Monitor the repository for updates when the domain migration occurs.

### Will there be a migration guide?

Yes. When the domain changes, we'll provide:

- Migration announcement in the repository
- Updated documentation
- Automated URL updates for all agents in the library
- Deprecation timeline for the old domain

---

## Technical Questions

### What's the difference between temperature and top_p?

Both control randomness, but use different methods:

- **Temperature**: Scales all probabilities (0 = deterministic, 2 = very random)
- **Top_p**: Only considers top candidates until cumulative probability reaches threshold

Don't adjust both—pick one.

### When should I increase temperature?

- Creative writing
- Brainstorming
- Multiple perspectives
- Varied responses

### When should I decrease temperature?

- Code generation
- Factual answers
- Consistent formatting
- Predictable output

### What are presence_penalty and frequency_penalty?

Both reduce repetition:

- **Presence penalty**: Did word appear? (binary)
- **Frequency penalty**: How many times? (count-based)

Increase both to avoid repetitive language.

### How long can my system prompt be?

Technically very long (thousands of words), but shorter is usually better:

- **Sweet spot**: 100-400 words
- **Minimum**: 50 words
- **Maximum useful**: \~800 words

Beyond that, the model may miss details.

### Can my agent access the internet?

Depends on platform:

- **ChatGPT**: Yes (if web browsing enabled)
- **Claude**: Yes (web search available)
- **AI Agents Library**: Depends on agent configuration

### Can my agent use uploaded files?

Yes:

- **ChatGPT**: Upload in GPT configuration (Knowledge section)
- **Claude**: Add to Project Knowledge
- **AI Agents Library**: Depends on implementation

---

## Troubleshooting

### My agent gives inconsistent responses

**Solution**: Lower temperature to 0.1-0.3. Add more explicit instructions about output format.

### My agent is too repetitive

**Solution**: Increase presence_penalty (0.5-1.0) and frequency_penalty (0.5-1.0).

### My agent doesn't follow my instructions

**Solution**:

1. Make instructions more explicit
2. Use numbered lists for multi-step processes
3. Add examples of desired behavior
4. Simplify—may be too complex

### My agent's responses are too long

**Solution**: Add explicit length limits:

- "Keep responses under 150 words"
- "Use 3-5 bullet points maximum"
- "Be concise and direct"

### My agent's tone is wrong

**Solution**: Define tone explicitly with examples:

- "Professional but warm, like a helpful colleague"
- "Casual and friendly, like texting a friend"
- "Formal and respectful, like addressing executives"

### My agent keeps saying "as an AI..."

**Solution**: Add to instructions:
"Never mention being an AI. Respond directly as the role you're playing."

---

## Agent Teams (AI Agents Library)

### What is an Agent Team?

Multiple specialized agents working together on a conversation. Each contributes their expertise, coordinated by a host agent.

### How do Agent Teams work?

1. You ask a question
2. Host agent determines which team members should respond
3. Agents discuss and build on each other's insights
4. You get comprehensive answer from multiple perspectives

### Can I interrupt an Agent Team?

Yes. Pause at any time. The conversation freezes and you can redirect or provide input.

### How many agents can be in a team?

Recommended: 3-5 agents
Maximum: Usually 8-10 before coordination becomes difficult

### Can agents see each other's messages?

Yes. That's how they collaborate. They build on previous responses.

### Can I use private messaging in teams?

Yes. Click an agent's avatar or use @ mention to send direct messages.

---

## Best Practices

### Should I create one mega-agent or multiple specialized ones?

Multiple specialized agents. They're easier to:

- Test
- Refine
- Share
- Maintain
- Understand

### How often should I update my agents?

When you notice patterns:

- Repeated clarifications needed
- Consistent formatting issues
- New use cases emerging
- User feedback

Otherwise, if it works, don't fix it.

### Can I share my agents with my team?

- **ChatGPT**: Yes (share link or publish to GPT Store)
- **Claude**: Yes (share project)
- **AI Agents Library**: Yes (once in marketplace, anyone can use)

### Should I make my agent public?

Benefits:

- Others benefit from your work
- You get feedback for improvement
- Community recognition
- Potential collaborators

Drawbacks:

- Your prompt is visible
- Can't control how others use it

For company-specific agents, keep private.

---

## Getting Help

### Where can I get help?

- **Documentation**: Read guides in /docs folder
- **Examples**: See EXAMPLES.md for annotated agents
- **Community**: Join Discord for discussions
- **Issues**: Open GitHub issue for bugs/suggestions

### How do I report a bug?

Open an issue with:

1. Agent identifier or link
2. What you expected
3. What actually happened
4. Steps to reproduce
5. Platform (ChatGPT/Claude/AI Agents Library)

### How do I request a feature?

Open an issue with "Feature Request" label. Explain:

- What you want to achieve
- Why it's useful
- How you imagine it working

### Can I request someone create an agent?

Yes. Open an issue describing what you need. Community members may build it.

---

Still have questions? Join our Discord or open an issue on GitHub.

