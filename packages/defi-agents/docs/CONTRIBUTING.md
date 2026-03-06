# Contributing to AI Agents Library Agents

Thank you for contributing to the AI Agents Library Agent Marketplace! This guide will help you submit high-quality agents.

## Quick Start

1. Fork the repository
2. Create your agent in `/src/`
3. Test thoroughly
4. Submit a Pull Request

## Submission Guidelines

### Agent Requirements

✅ **Must Have:**

- Unique identifier (no duplicates)
- Clear, descriptive title
- Concise description (160-200 characters)
- Relevant emoji avatar
- 3-8 appropriate tags
- Well-structured system prompt
- Valid JSON format

❌ **Not Allowed:**

- Copyrighted content
- Malicious or harmful prompts
- Personal/private information
- Spam or low-effort submissions
- Duplicate agents (check existing first)

### File Structure

```
src/
  your-agent-name.json          # Main agent file (English)
  your-agent-name.zh-CN.json    # Optional: Chinese translation
```

If you only provide English, our automated i18n workflow will translate to 18 languages.

### Agent Template

Create `/src/your-agent-name.json`:

```json
{
  "author": "your-github-username",
  "config": {
    "systemRole": "You are [detailed system prompt]..."
  },
  "identifier": "your-agent-name",
  "meta": {
    "title": "Your Agent Title",
    "description": "Brief description of what your agent does",
    "avatar": "🤖",
    "tags": ["defi", "trading", "relevant", "keywords"]
  },
  "schemaVersion": 1
}
```

### Naming Conventions

**Identifier** (filename):

- Use lowercase
- Use hyphens for spaces: `sperax-yield-optimizer`
- No special characters except hyphens
- Keep it descriptive but concise

**Title** (display name):

- Use Title Case
- Can include spaces
- Clear and professional

## Categories & Tags

### Primary Categories

- `defi` - DeFi protocols, yield, liquidity
- `trading` - Market analysis, strategies
- `security` - Audits, vulnerability analysis
- `development` - Coding, smart contracts
- `analytics` - Data analysis, metrics
- `education` - Learning, tutorials
- `research` - Protocol research, tokenomics
- `portfolio` - Asset management
- `nft` - NFT analytics, collections

### Specific Tags

- Protocol names: `uniswap`, `aave`, `sperax`
- Technologies: `ethereum`, `layer2`, `solidity`
- Functions: `yield-optimization`, `risk-assessment`

Use 3-8 tags total for optimal discoverability.

## Quality Standards

### System Prompts

Good prompts are:

- **Clear**: Specific role and capabilities
- **Structured**: Organized sections (identity, guidelines, format)
- **Bounded**: Define scope and limitations
- **Tested**: Verified with real queries

See [Prompt Engineering Guide](./PROMPTS.md) for detailed tips.

### Testing Checklist

Before submitting, test with:

- [ ] Standard queries (happy path)
- [ ] Edge cases (unusual requests)
- [ ] Out-of-scope questions
- [ ] Follow-up conversations
- [ ] Error handling

### Code Quality

- [ ] Valid JSON (use a validator)
- [ ] No trailing commas
- [ ] Proper escaping of quotes
- [ ] Consistent formatting (2-space indent)

## Pull Request Process

### 1. Prepare Your PR

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/ai-agents-library.git
cd ai-agents-library

# Create branch
git checkout -b add-your-agent-name

# Add your agent
# Edit src/your-agent-name.json

# Commit
git add src/your-agent-name.json
git commit -m "feat: add Your Agent Name"

# Push
git push origin add-your-agent-name
```

### 2. PR Title Format

```
feat: add [Agent Name]
```

Examples:

- `feat: add DeFi Yield Optimizer`
- `feat: add Smart Contract Security Auditor`

### 3. PR Description Template

```markdown
## Agent Information

- **Name**: Your Agent Title
- **Category**: Primary category
- **Tags**: tag1, tag2, tag3

## Description

Brief explanation of what your agent does and why it's useful.

## Testing

- [x] Tested with standard queries
- [x] Validated JSON
- [x] Follows naming conventions
- [x] No duplicate identifiers

## Additional Notes

Any special considerations or context.
```

### 4. Review Process

We review PRs within 48-72 hours. Reviewers check:

- Originality and usefulness
- Prompt quality and clarity
- Technical accuracy
- Community guidelines compliance
- JSON validity

You may receive feedback requesting changes. Please address comments promptly.

## After Approval

Once merged:

1. Your agent is automatically translated to 18 languages
2. It appears in the marketplace within 24 hours
3. Users can immediately add it to their workspace

## Community Guidelines

### Be Respectful

- Welcome diverse perspectives
- Provide constructive feedback
- Help newcomers learn

### Be Professional

- Use appropriate language
- Credit sources and inspiration
- Respect intellectual property

### Be Collaborative

- Improve existing agents (with permission)
- Share knowledge and tips
- Help troubleshoot issues

## Agent Updates

To update an existing agent:

1. Create PR with changes to `src/your-agent-name.json`
2. Title: `feat: update Your Agent Name`
3. Explain what changed and why

## Need Help?

- 📖 Read the [Agent Creation Guide](./AGENT_GUIDE.md)
- 🐛 Open an [Issue](https://github.com/nirholas/AI-Agents-Library/issues)

## Recognition

Top contributors:

- Featured on AI Agents Library homepage
- Community recognition badges
- Access to beta features
- Direct feedback from users

---

**Ready to contribute?** Fork the repo and submit your first agent!

