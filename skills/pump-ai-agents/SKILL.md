---
name: Pump AI Agent Integration
description: >
  AI agent integration layer for the Pump SDK — agent instruction files, .well-known
  discovery, LLM context documents, 15+ skill files, MCP server prompts, and terminal
  management rules for GitHub Copilot, Claude, and Gemini.
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
---

# AI Agent Integration — Agent Scaffolding & Discovery

Configure AI agents (GitHub Copilot, Claude, Gemini) to work effectively with the Pump SDK through instruction files, skill registries, and MCP server integration.

## Agent Instruction Files

| File | Agent | Purpose |
|------|-------|---------|
| `AGENTS.md` | Universal | Project overview, architecture, security rules |
| `CLAUDE.md` | Claude Code | Key patterns, critical rules |
| `COPILOT.md` | GitHub Copilot | Instructions pointer |
| `GEMINI.md` | Google Gemini | Instructions pointer |
| `.github/copilot-instructions.md` | Copilot Chat | SDK patterns, security rules |

## .well-known Discovery Files

| File | Purpose |
|------|---------|
| `.well-known/ai-plugin.json` | AI plugin manifest |
| `.well-known/agent.json` | Agent capabilities and config |
| `.well-known/skills.json` | Skills registry (15+ skills) |
| `.well-known/security.txt` | Security contact information |

## LLM Context Documents

| File | Size | Purpose |
|------|------|---------|
| `llms.txt` | Short | Quick reference for LLMs |
| `llms-full.txt` | Long | Comprehensive LLM context |

## Skills Registry Schema

```json
{
    "schema_version": "v1",
    "name": "pump-fun-sdk",
    "skills": [
        {
            "id": "pump-sdk-core",
            "name": "Pump SDK Core",
            "description": "...",
            "path": ".github/skills/pump-sdk-core.skill.md",
            "tags": ["typescript", "solana", "sdk"]
        }
    ]
}
```

## Terminal Management (Agent Rules)

- **Always use background terminals** (`isBackground: true`) for every command
- **Always kill the terminal** after completion — never leave terminals open
- Do not reuse foreground shell sessions
- If a terminal appears unresponsive, kill it and create a new one

## Security Invariants for Agents

- ONLY official Solana Labs crypto: `solana-sdk`, `@solana/web3.js`, `solana-keygen`
- Zeroize all key material after use
- File permissions `0600` for keypairs
- No network calls for key generation
- All amounts use `BN` (bn.js) — never JavaScript `number` for financial math
- `createInstruction` (v1) is deprecated — use `createV2Instruction`

## MCP Server Integration

```json
{
    "mcpServers": {
        "solana-wallet": {
            "command": "npx",
            "args": ["-y", "@pump-fun/mcp-server"],
            "transportType": "stdio"
        }
    }
}
```

## Patterns to Follow

- Keep agent instruction files concise and actionable
- Point agents to specific skill files for domain knowledge
- Update `skills.json` when adding or modifying skill files
- Maintain consistency between `AGENTS.md`, `CLAUDE.md`, and `COPILOT.md`

## Common Pitfalls

- Agent instruction files that are too long get truncated or ignored
- Missing skills from `skills.json` means agents won't discover them
- Terminal management rules are critical in Codespaces — stale terminals block operations
- MCP server must be registered in the agent's tool configuration
