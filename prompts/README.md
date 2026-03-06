# Prompts

Agent prompt templates for building AI-powered PumpFun tools. These prompts are designed for use with AI coding assistants (Copilot, Claude, Cursor, etc.) to scaffold complete implementations.

## Prompt Index

### Token Launch Monitors

| File | Description |
|------|-------------|
| `agent-token-launch-monitor-1.md` | Prompt for building a token launch monitoring agent (variant 1) |
| `agent-token-launch-monitor-2.md` | Prompt for building a token launch monitoring agent (variant 2) |

### MCP Server Prompts (`mcp-server/`)

Step-by-step prompts for building the MCP (Model Context Protocol) server from scratch:

| File | Phase | Description |
|------|-------|-------------|
| `MCP_MASTER_PLAN.md` | Planning | Master architecture plan for the MCP server |
| `agent-1-server-core.md` | Phase 1 | Server core — transport, lifecycle, configuration |
| `agent-2-tools-prompts.md` | Phase 2 | Tool definitions and prompt templates |
| `agent-3-resources-sampling.md` | Phase 3 | Resource management and sampling |
| `agent-4-testing-security.md` | Phase 4 | Test suite and security hardening |
| `agent-5-docs-deploy.md` | Phase 5 | Documentation and deployment |

## Usage

Copy any prompt into your AI assistant's context to generate the corresponding implementation. Each prompt is self-contained with requirements, constraints, and expected outputs.

```
# Example: paste the content of a prompt file into your AI assistant
cat prompts/agent-token-launch-monitor-1.md | pbcopy
```

The MCP server prompts are designed to be used sequentially (Phase 1 → 2 → 3 → 4 → 5) for incremental implementation.
