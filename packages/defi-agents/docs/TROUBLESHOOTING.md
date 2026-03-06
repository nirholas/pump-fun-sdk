# Troubleshooting Guide

Common issues and solutions for AI agent creation and usage.

---

## Agent Behavior Issues

### Agent Ignores Instructions

**Symptoms:**

- Doesn't follow specified format
- Skips important steps
- Acts generically instead of specialized role

**Solutions:**

1. **Make instructions more explicit**

```
❌ "Be professional"
✅ "Use formal business tone. No contractions. Address as 'Dear [Name]'"
```

2. **Use numbered steps for processes**

```
When responding:
1. First, acknowledge the request
2. Then, provide analysis
3. Finally, give recommendation
```

3. **Add examples of desired behavior**

```
EXAMPLE:
User: "Summarize this meeting"
You: "## Key Decisions
- Approved Q3 budget..."
```

4. **Check prompt length**

- If over 1000 words, model may miss details
- Condense or break into clear sections

---

### Inconsistent Output Quality

**Symptoms:**

- Sometimes excellent, sometimes poor
- Format changes between responses
- Tone varies unpredictably

**Solutions:**

1. **Lower temperature**

- Set to 0.1-0.3 for consistent behavior
- 0 = completely deterministic

2. **Add format constraints**

```
ALWAYS format as:
- Section 1: [specific content]
- Section 2: [specific content]
- Never deviate from this structure
```

3. **Remove ambiguous language**

```
❌ "Be helpful and creative"
✅ "Provide exactly 3 options. Format as numbered list."
```

---

### Agent Too Verbose

**Symptoms:**

- Responses too long
- Unnecessary details
- Rambling explanations

**Solutions:**

1. **Set explicit length limits**

```
- Maximum 150 words per response
- Use bullet points for anything over 3 items
- One paragraph maximum
```

2. **Increase frequency penalty**

- Set to 0.8-1.5
- Discourages repetitive filler words

3. **Add brevity instructions**

```
BREVITY RULES:
- Get to the point immediately
- No introductory phrases
- Cut all unnecessary words
- Active voice only
```

---

### Agent Too Brief

**Symptoms:**

- Incomplete answers
- Missing critical details
- Unhelpful brevity

**Solutions:**

1. **Request elaboration in prompt**

```
- Provide comprehensive coverage
- Include examples for each point
- Explain reasoning
- Minimum 200 words when appropriate
```

2. **Lower frequency penalty**

- Set to 0 or negative
- Allows more natural expression

3. **Add detail requirements**

```
For each recommendation:
- Why it works
- How to implement
- Potential issues
- Expected timeline
```

---

### Repetitive Language

**Symptoms:**

- Same words/phrases repeated
- Redundant content
- Circular explanations

**Solutions:**

1. **Increase presence penalty**

```
presence_penalty: 1.0-1.5
```

2. **Increase frequency penalty**

```
frequency_penalty: 1.0-1.5
```

3. **Add variety instructions**

```
- Use varied vocabulary
- Don't repeat the same examples
- Provide different angles each time
```

---

## Platform-Specific Issues

### ChatGPT Custom GPT

**Issue: GPT doesn't save**

- Check if you're on ChatGPT Plus
- Try different browser
- Clear cache and retry
- Verify all required fields filled

**Issue: Knowledge files not working**

- Confirm file format (PDF, TXT, DOCX supported)
- Check file size (max varies by plan)
- Wait a few minutes after upload
- Try re-uploading

**Issue: Can't share GPT**

- Check privacy settings (Only me / Link / Public)
- Verify you have GPT Plus
- Try generating new share link
- Check if workplace admin restricted sharing

---

### Claude Projects

**Issue: Instructions not applying**

- Verify instructions in Project settings, not chat
- Check you're in correct project
- Try creating new conversation within project
- Restart browser if persistent

**Issue: Project knowledge not accessible**

- Confirm files uploaded successfully
- Check file format compatibility
- Verify file size under limits
- Wait for processing (large files take time)

**Issue: Context limit reached**

- Claude Projects have 200K token limit
- Long conversations + large docs = limit reached
- Solution: Start new conversation in same project
- Or: Remove some uploaded documents

---

### AI Agents Library Marketplace

**Issue: Agent not appearing**

- Check if PR merged
- Wait 24 hours for deployment
- Clear browser cache
- Search by exact identifier

**Issue: Agent translation incorrect**

- Our i18n is automated and imperfect
- You can provide manual translations
- Submit PR with corrected locale files
- See CONTRIBUTING.md for format

**Issue: Can't add agent to workspace**

- Refresh browser
- Check internet connection
- Try different browser
- Report as bug if persistent

---

## JSON/File Issues

### Invalid JSON Error

**Common mistakes:**

1. **Trailing commas**

```json
❌ {
  "title": "My Agent",
  "tags": ["tag1", "tag2",]
}

✅ {
  "title": "My Agent",
  "tags": ["tag1", "tag2"]
}
```

2. **Unescaped quotes**

```json
❌ "systemRole": "You are a "professional" agent"

✅ "systemRole": "You are a \"professional\" agent"
```

3. **Missing commas**

```json
❌ {
  "title": "Agent"
  "description": "Does stuff"
}

✅ {
  "title": "Agent",
  "description": "Does stuff"
}
```

**Solution:**

- Use JSON validator: jsonlint.com
- Use code editor with JSON syntax highlighting
- Copy working example and modify

---

### File Not Found

**For GitHub submissions:**

1. **Check file location**

- Must be in `/src/` directory
- Use exact filename from identifier
- Extension must be `.json`

2. **Check naming**

```
✅ src/my-agent-name.json
❌ src/my_agent_name.json
❌ src/MyAgentName.json
❌ My-Agent-Name.json (wrong directory)
```

3. **Verify committed**

```bash
git status
git add src/your-agent.json
git commit -m "Add agent"
```

---

## Testing Issues

### Can't Reproduce Results

**Problem:** Agent works in testing but fails in real use

**Solutions:**

1. **Test with real users**

- Have someone else try it
- Use actual scenarios, not synthetic
- Test edge cases and ambiguities

2. **Document test cases**

```
Test 1: [Scenario]
Input: [What you sent]
Expected: [What should happen]
Actual: [What happened]
```

3. **Version control your prompts**

- Save each iteration
- Note what changed and why
- Can roll back if needed

---

### Agent Works Sometimes

**Causes:**

1. **Temperature too high**

- Randomness causes variation
- Lower to 0.3 or below

2. **Ambiguous instructions**

- Model interprets differently each time
- Be more explicit

3. **Context matters**

- Previous messages affect responses
- Test in fresh conversations

---

## Submission Issues

### Pull Request Rejected

**Common reasons:**

1. **Duplicate agent**

- Check existing agents first
- Search by function, not just name
- Differentiate if similar

2. **Low quality prompt**

- Too vague or generic
- No clear purpose
- Poor formatting

3. **Inappropriate content**

- Violates guidelines
- Offensive/harmful
- Copyright issues

4. **Technical errors**

- Invalid JSON
- Missing required fields
- Wrong file location

**Next steps:**

- Read reviewer feedback
- Make requested changes
- Resubmit with explanation

---

### Merge Delayed

**Timeline:** Usually 48-72 hours

**If longer:**

- Check PR for reviewer comments
- Verify all checks passed
- Tag maintainer if urgent
- Join Discord for status update

---

## Performance Issues

### Slow Responses

**Causes:**

1. **Model selection**

- GPT-4 slower than GPT-3.5
- Claude Opus slower than Sonnet
- Check model in settings

2. **Long context**

- Large uploaded files
- Long conversation history
- Solution: Start fresh conversation

3. **Complex instructions**

- Overly detailed prompts
- Multiple nested conditions
- Simplify if possible

4. **High reasoning_effort (Claude)**

- Set to "low" or "medium"
- Reserve "high" for complex tasks

---

### Rate Limits Hit

**ChatGPT:**

- Plus: \~50 messages/3 hours for GPT-4
- Solution: Use GPT-3.5 or wait

**Claude:**

- Pro: Higher limits but still exist
- Solution: Space out requests

**AI Agents Library:**

- Varies by plan
- Contact support for limit info

---

## Getting More Help

### Before Opening Issue

1. **Search existing issues**
2. **Check FAQ.md**
3. **Review examples in EXAMPLES.md**
4. **Test in fresh conversation**

### When Opening Issue

Include:

- Agent identifier or full JSON
- What you expected
- What actually happened
- Steps to reproduce
- Platform (ChatGPT/Claude/AI Agents Library)
- Screenshots if relevant

### Emergency Issues

For critical bugs or security issues:

- Mark as \[URGENT] in subject
- Don't publicly share exploit details

---

## Quick Reference

**Problem → Solution:**

| Issue          | Quick Fix                          |
| -------------- | ---------------------------------- |
| Inconsistent   | Lower temperature to 0.3           |
| Repetitive     | Increase penalties to 1.0          |
| Too long       | Set word limit explicitly          |
| Too short      | Request elaboration in prompt      |
| Wrong tone     | Add tone examples                  |
| Ignores format | Use numbered structure             |
| Too creative   | Lower temperature                  |
| Too boring     | Increase temperature to 0.7        |
| Invalid JSON   | Use validator, check commas/quotes |
| Slow           | Choose faster model or simplify    |

---

Still stuck? Join Discord or open an issue with details.

