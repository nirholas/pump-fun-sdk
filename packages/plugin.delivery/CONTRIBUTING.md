# Contributing to Plugin Delivery

Thank you for your interest in contributing to the SperaxOS Plugin Delivery ecosystem! This guide will help you get started.

---

## ⚠️ Adding a Plugin? Read This First!

**Every plugin requires TWO files or the build will fail:**

| File | Location | Required |
|------|----------|----------|
| Plugin definition | `src/your-plugin.json` | ✅ Yes |
| Locale file | `locales/your-plugin.en-US.json` | ✅ Yes |

Then run:
```bash
export OPENAI_API_KEY=your-key
bun run format   # Generates all locale translations
bun run build    # Verify it works
```

See [Submitting a Plugin](#submitting-a-plugin) for full details.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Submitting a Plugin](#submitting-a-plugin)
- [Contributing Code](#contributing-code)
- [Style Guidelines](#style-guidelines)

---

## Code of Conduct

Be respectful, inclusive, and constructive. We're building tools for the crypto/DeFi community together.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- [Node.js](https://nodejs.org) v18+ (for compatibility)
- Git

### Clone the Repository

```bash
git clone https://github.com/nirholas/plugin.delivery.git
cd plugins
bun install
```

### Project Structure

```
plugins/
├── packages/
│   ├── sdk/          # @sperax/plugin-sdk
│   └── gateway/      # @sperax/chat-plugins-gateway
├── templates/        # Plugin starter templates
├── docs/             # Documentation
├── public/           # Plugin index files
├── src/              # Plugin source files
└── scripts/          # Build scripts
```

---

## Development Setup

### Run Tests

```bash
bun run test
```

### Build Plugin Index

```bash
bun run build
```

### Local Development

```bash
bun run dev
```

This starts a local Vercel dev server at `http://localhost:3000`.

---

## Submitting a Plugin

### Option 1: Via GitHub Issue

1. Create a [Plugin Submission](https://github.com/nirholas/plugin.delivery/issues/new?template=plugin_submission.md) issue
2. Provide your manifest URL and details
3. We'll review and add it to the index

### Option 2: Via Pull Request

1. Fork the repository
2. Add your plugin to `src/your-plugin.json`:

```json
{
  "identifier": "your-plugin",
  "author": "your-name",
  "createdAt": "2025-01-01",
  "manifest": "https://your-domain.com/manifest.json",
  "meta": {
    "title": "Your Plugin",
    "description": "What it does",
    "avatar": "🔌",
    "tags": ["category"]
  }
}
```

3. Run `bun run build` to regenerate the index
4. Submit a PR

### Plugin Requirements

- ✅ Valid JSON manifest
- ✅ Working API endpoints
- ✅ Tested in SperaxOS
- ✅ Clear documentation
- ✅ No malicious code

---

## Contributing Code

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation
- `plugin/name` - New plugins

### Commit Messages

Use conventional commits:

```
feat: add new plugin type
fix: resolve manifest validation
docs: update SDK guide
plugin: add dexscreener integration
```

### Pull Request Process

1. Fork and create a branch
2. Make changes
3. Run tests: `bun run test`
4. Run lint: `bun run lint`
5. Submit PR with clear description

---

## Style Guidelines

### TypeScript

- Use strict mode
- Prefer `const` over `let`
- Use async/await over promises
- Export types explicitly

### JSON

- 2-space indentation
- Trailing newline
- No trailing commas

### Documentation

- Use Markdown
- Include code examples
- Keep it concise

---

## Questions?

- GitHub Issues: [github.com/nirholas/plugins/issues](https://github.com/nirholas/plugin.delivery/issues)
- Twitter/X: [@nichxbt](https://x.com/nichxbt)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).
