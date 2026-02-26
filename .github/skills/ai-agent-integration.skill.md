# AI Agent Integration — LLM Context, Skills Registry & Agent Configuration

## Skill Description

Configure and maintain the AI agent integration layer — `.well-known/` manifests, skill file authoring, LLM context documents (`llms.txt`, `llms-full.txt`), agent instruction files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`), MCP server prompts, and the skills registry that enables AI coding assistants to understand and work with the Pump SDK codebase.

## Context

The Pump SDK has first-class AI agent support, designed so that coding assistants (GitHub Copilot, Claude, Gemini, Cursor, etc.) can understand the codebase structure, available operations, and security constraints. This is implemented through a layered system of context files, skills, and machine-readable registries.

## Key Files

### Agent Instruction Files

| File | Target Agent | Purpose |
|------|-------------|---------|
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | GitHub Copilot | Project overview, SDK patterns, security rules |
| [CLAUDE.md](CLAUDE.md) | Claude Code | Key directories, critical patterns, terminal management |
| [GEMINI.md](GEMINI.md) | Google Gemini | Project context and coding guidelines |
| [AGENTS.md](AGENTS.md) | All agents | Architecture, programs, skills index, contributing |
| `COPILOT.md` | GitHub Copilot (root) | Workspace-level instructions |

### Well-Known Files

| File | Purpose | Format |
|------|---------|--------|
| [.well-known/ai-plugin.json](.well-known/ai-plugin.json) | AI plugin manifest (OpenAI-compatible) | JSON |
| [.well-known/agent.json](.well-known/agent.json) | Agent capabilities, programs, security config | JSON |
| [.well-known/skills.json](.well-known/skills.json) | Skills registry with paths and tags | JSON |
| [.well-known/security.txt](.well-known/security.txt) | Security contact (RFC 9116) | Text |

### LLM Context Documents

| File | Purpose | Size |
|------|---------|------|
| [llms.txt](llms.txt) | Quick reference — architecture overview | ~2KB |
| [llms-full.txt](llms-full.txt) | Comprehensive — all programs, PDAs, types | ~15KB |
| [humans.txt](humans.txt) | Human-readable credits | ~200B |

### Skill Files

| File | Domain |
|------|--------|
| [.github/skills/pump-sdk-core.skill.md](.github/skills/pump-sdk-core.skill.md) | Core SDK instruction building |
| [.github/skills/bonding-curve.skill.md](.github/skills/bonding-curve.skill.md) | AMM pricing engine |
| [.github/skills/bonding-curve-math.skill.md](.github/skills/bonding-curve-math.skill.md) | Mathematical formulas |
| [.github/skills/token-lifecycle.skill.md](.github/skills/token-lifecycle.skill.md) | Create → trade → migrate |
| [.github/skills/fee-system.skill.md](.github/skills/fee-system.skill.md) | Tiered fees & creator fees |
| [.github/skills/fee-sharing.skill.md](.github/skills/fee-sharing.skill.md) | Shareholder distribution |
| [.github/skills/token-incentives.skill.md](.github/skills/token-incentives.skill.md) | Volume-based PUMP rewards |
| [.github/skills/admin-operations.skill.md](.github/skills/admin-operations.skill.md) | Protocol governance |
| [.github/skills/solana-wallet.skill.md](.github/skills/solana-wallet.skill.md) | Key generation security |
| [.github/skills/solana-program-architecture.skill.md](.github/skills/solana-program-architecture.skill.md) | PDAs & multi-program design |
| [.github/skills/solana-development.skill.md](.github/skills/solana-development.skill.md) | Solana ecosystem patterns |
| [.github/skills/rust-vanity-gen.skill.md](.github/skills/rust-vanity-gen.skill.md) | Rust vanity generator (focused) |
| [.github/skills/rust-vanity-generator.skill.md](.github/skills/rust-vanity-generator.skill.md) | Rust vanity generator (comprehensive) |
| [.github/skills/typescript-vanity-generator.skill.md](.github/skills/typescript-vanity-generator.skill.md) | TypeScript vanity generator |
| [.github/skills/mcp-server.skill.md](.github/skills/mcp-server.skill.md) | Model Context Protocol server |
| [.github/skills/shell-scripting-cli.skill.md](.github/skills/shell-scripting-cli.skill.md) | Bash scripts & CLI tools |
| [.github/skills/security-practices.skill.md](.github/skills/security-practices.skill.md) | Defense-in-depth security |
| [.github/skills/testing-quality.skill.md](.github/skills/testing-quality.skill.md) | Test frameworks & CI |
| [.github/skills/build-release.skill.md](.github/skills/build-release.skill.md) | Build tooling & releases |
| [.github/skills/nextjs-website.skill.md](.github/skills/nextjs-website.skill.md) | Documentation website |
| [.github/skills/ai-agent-integration.skill.md](.github/skills/ai-agent-integration.skill.md) | This file |

## Architecture

```
Agent / LLM
  │
  ├─ Quick Context
  │   ├─ llms.txt              (architecture overview)
  │   └─ agent instruction file (CLAUDE.md, AGENTS.md, etc.)
  │
  ├─ Discovery
  │   ├─ .well-known/ai-plugin.json   (plugin manifest)
  │   ├─ .well-known/agent.json        (capabilities, programs)
  │   └─ .well-known/skills.json       (skill registry → paths)
  │
  ├─ Deep Context
  │   ├─ llms-full.txt                 (comprehensive reference)
  │   └─ .github/skills/*.skill.md     (domain-specific skills)
  │
  └─ MCP Integration
      ├─ mcp-server/src/prompts/       (structured prompts)
      ├─ mcp-server/src/resources/     (dynamic resources)
      └─ server.json                   (MCP server config)
```

## Skill File Format

Each skill file follows a consistent structure:

```markdown
# {Title} — {Subtitle}

## Skill Description
One-paragraph description of what this skill covers.

## Context
Why this skill exists, architectural context.

## Key Files
- [path/to/file](path/to/file) — Description

## {Domain-Specific Sections}
Core types, architecture, workflows, code examples...

## Patterns to Follow
- Bullet list of best practices

## Common Pitfalls
- Bullet list of anti-patterns and mistakes
```

**Essential sections**: Skill Description, Context, Key Files, Patterns to Follow, Common Pitfalls
**Domain sections**: Vary by skill — types, formulas, architecture diagrams, CLI options, etc.

## skills.json Schema

```json
{
  "schema_version": "v1",
  "name": "pump-fun-sdk",
  "description": "...",
  "skills": [
    {
      "id": "kebab-case-id",
      "name": "Human-Readable Title — Subtitle",
      "description": "What the skill covers, when to use it.",
      "path": ".github/skills/kebab-case-id.skill.md",
      "tags": ["tag1", "tag2", "tag3"]
    }
  ]
}
```

- `id` matches the filename (without `.skill.md`)
- `path` is relative to repository root
- `tags` are lowercase, 3-6 per skill, covering language + domain

## agent.json Schema

```json
{
  "schema_version": "v1",
  "name": "pump-fun-sdk",
  "display_name": "Pump SDK Agent",
  "capabilities": {
    "code_generation": true,
    "code_review": true,
    "debugging": true,
    "testing": true,
    "documentation": true,
    "refactoring": true
  },
  "agent_files": {
    "copilot": ".github/copilot-instructions.md",
    "claude": "CLAUDE.md",
    "gemini": "GEMINI.md",
    "agents": "AGENTS.md"
  },
  "context_files": {
    "llms_txt": "llms.txt",
    "llms_full": "llms-full.txt",
    "skills": ".well-known/skills.json"
  },
  "programs": { ... },
  "security": {
    "official_libraries_only": true,
    "memory_zeroization": true,
    "offline_capable": true,
    "no_network_for_keys": true
  }
}
```

## MCP Server Prompts

The MCP server provides structured prompts for AI agent workflows:

| Prompt | Purpose |
|--------|---------|
| `generate-keypair` | Guide through wallet creation with security checks |
| `vanity-address` | Estimate difficulty and generate vanity addresses |
| `security-audit` | Run security checklist against generated keys |

Prompts are defined in `mcp-server/src/prompts/` and registered via `listPrompts` / `getPrompt` MCP handlers.

## Agent Instruction Patterns

### Terminal Management (Critical)

All agent instruction files include identical terminal management rules:

```markdown
### Terminal Management
- Always use background terminals (isBackground: true)
- Always kill the terminal after completion
- Do not reuse foreground shell sessions
- If unresponsive, kill and create new
```

### Security Invariants

Every agent instruction file emphasizes:
1. ONLY official Solana Labs crypto libraries
2. Zeroize all key material after use
3. File permissions `0600` for keypairs
4. No network calls for key generation

### SDK Pattern

Every instruction file covers the core SDK pattern:
- `PumpSdk` (offline) builds `TransactionInstruction[]`
- `OnlinePumpSdk` extends with RPC fetchers
- `PUMP_SDK` singleton
- All amounts use `BN` — never JavaScript `number`

## Maintenance Workflow

When adding a new feature or domain:

1. **Create the skill file**: `.github/skills/{domain}.skill.md`
2. **Register in skills.json**: Add entry to `.well-known/skills.json`
3. **Update llms.txt**: Add a one-liner about the new feature
4. **Update llms-full.txt**: Add detailed section if significant
5. **Update agent instructions**: Add relevant context to AGENTS.md, CLAUDE.md, etc.
6. **Update ai-plugin.json**: If the description_for_model needs updating

## Patterns to Follow

- Keep skill file names in `kebab-case.skill.md` format
- Ensure `id` in skills.json matches the filename (minus extension)
- Include code examples from the actual codebase, not pseudo-code
- Cross-reference related skill files by name in documentation
- Use consistent section ordering: Description → Context → Key Files → Details → Patterns → Pitfalls
- Tag skills with both language and domain tags
- Keep llms.txt under 3KB for quick context loading
- Keep llms-full.txt under 20KB — comprehensive but not exhaustive
- Update all agent files when adding major features — they should stay in sync

## Common Pitfalls

- Forgetting to register a new skill file in `.well-known/skills.json`
- Inconsistent information between `llms.txt`, `AGENTS.md`, and skill files
- Using relative paths in skill files that don't resolve from the repository root
- Skill files that are too abstract — always include concrete code samples
- Not updating `agent.json` capabilities when adding new agent-facing features
- Terminal management instructions missing from new agent instruction files
- Stale program IDs or account types in context documents
