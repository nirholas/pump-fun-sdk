# One-Shot README Generation Prompt

## Instructions for Agent

You are generating a comprehensive README.md for the **plugins** system based on the provided documentation. Follow the extraction and template phases precisely.

---

## PHASE 1: Extract These Specific Items

From the 4000+ lines of documentation, extract ONLY:

### Project Identity
- Project name: [Extract from context]
- One-line description: [What problem does this solve?]
- Primary use case: [Main scenario]

### Quick Start Essentials
- Installation command(s)
- First command to run
- Expected output/result

### Key Features (Max 7)
- [ ] Feature 1: [Description]
- [ ] Feature 2: [Description]
- [ ] Feature 3: [Description]
- [ ] Feature 4: [Description]
- [ ] Feature 5: [Description]

### Architecture Components
- Main technology stack (list)
- Core directories and their purpose
- Key design patterns used

### API Reference (Top 5-7 endpoints/functions)
| Function/Endpoint | Purpose | Parameters | Returns |
|-------------------|---------|------------|---------|
| | | | |

### Code Examples (2-3 best examples)
```typescript
// Example 1: [Most common use case]
```

```typescript
// Example 2: [Advanced feature]
```

---

## PHASE 2: Generate README Using Template

<target_readme_template>
# {Project Name}

> {One-line description}

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

## Overview

{2-3 sentence overview explaining what this is, why it exists, and who should use it}

## Quick Start

### Prerequisites
- Node.js >= 18
- pnpm (recommended) or npm

### Installation

```bash
{Installation commands - verbatim from docs}
```

### First Run

```bash
{First command to run}
```

Expected output:
```
{What user should see}
```

## Key Features

{Bullet list of 5-7 main features extracted from Phase 1}

## Architecture

### Technology Stack
{List from extraction}

### Directory Structure
```
{Simplified tree from docs}
```

### Core Components
{Brief description of main directories/components}

## API Reference

### Main Functions

{Table from Phase 1 extraction}

### Configuration

```typescript
{Configuration interface/options - from docs}
```

## Usage Examples

### Basic Usage
```typescript
{Example 1 from extraction - must be verbatim}
```

### Advanced Usage
```typescript
{Example 2 from extraction - must be verbatim}
```

## Development

### Setup Development Environment
```bash
{Dev setup commands from docs}
```

### Running Tests
```bash
{Test commands from docs}
```

### Project Structure Conventions
{Key conventions from docs}

## Authentication & Security

{If mentioned in docs - extract auth methods}

## Extending the System

### Adding New Features
{Brief steps from docs}

### Plugin Development
{If applicable - extract plugin architecture}

## Best Practices

{3-5 key best practices from docs}

## Troubleshooting

### Common Issues

**Issue**: {Common problem from docs}
**Solution**: {Solution from docs}

## Resources

- [Full Documentation](docs/)
- [API Reference](docs/API.md)
- [Contributing Guide](CONTRIBUTING.md)

## License

MIT © [Project Team]

</target_readme_template>

---

## RULES - CRITICAL

### Content Rules
✅ **DO:**
- Use ONLY information from the provided documentation
- Copy code examples EXACTLY as written in source
- Maintain all type definitions and interfaces verbatim
- Use actual file paths from the documentation
- Keep technical accuracy as top priority

❌ **DON'T:**
- Invent features not in the documentation
- Create placeholder text ("TODO", "Coming soon", etc.)
- Simplify code examples (must be runnable)
- Add marketing language not in source
- Include links that don't exist in docs

### Style Rules
- Target length: 300-500 lines
- Tone: Technical but approachable
- Code blocks: Must have language tags
- Formatting: GitHub-flavored Markdown
- Sections: Use ## for main sections, ### for subsections

### Quality Checklist

Before outputting, verify:
- [ ] All code examples have syntax highlighting
- [ ] All code examples are complete (no `// ... rest of code`)
- [ ] Installation steps are numbered and sequential
- [ ] No placeholder text remains
- [ ] All file paths use actual paths from docs
- [ ] Links point to real files mentioned in docs
- [ ] Technical terms are consistent throughout
- [ ] At least 2 complete, runnable code examples included

---

## SOURCE DOCUMENTATION

<documentation>

### Section: Portfolio Artifacts Integration
Priority: HIGH
Content:
```markdown
{Paste the Portfolio Artifacts section from your docs}
```

### Section: Feature Development Guide
Priority: HIGH
Content:
```markdown
{Paste the Feature Development section}
```

### Section: Architecture & Tech Stack
Priority: HIGH
Content:
```markdown
{Paste Architecture section}
```

### Section: API & Services
Priority: MEDIUM
Content:
```markdown
{Paste API client-server interaction section}
```

### Section: Testing & Development
Priority: MEDIUM
Content:
```markdown
{Paste Testing guide section}
```

### Section: Authentication
Priority: LOW
Content:
```markdown
{Paste Authentication provider guide}
```

### Section: Extensions (ComfyUI, etc.)
Priority: LOW (exclude if space limited)
Content:
```markdown
{Paste extension development sections}
```

</documentation>

---

## REFERENCE EXAMPLES

<example_readme quality="excellent">
{Include 1-2 high-quality READMEs from similar projects as style reference}
</example_readme>

---

## OUTPUT INSTRUCTION

Generate the complete README.md now following the template exactly. Begin with `# {Project Name}` and end with the license section.

