# SperaxOS Plugin Documentation

> **Live:** [plugin.delivery](https://plugin.delivery) • **SDK:** `@sperax/plugin-sdk`

Build AI-powered plugins for SperaxOS. Extend chat capabilities with custom APIs, OpenAPI integrations, and interactive UIs.

---

## 📚 Documentation Index

### Getting Started

| Guide | Description | Time |
|-------|-------------|------|
| **[🚀 Quick Start](./QUICK_START.md)** | Build your first plugin | 10 min |
| **[📖 Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md)** | Complete walkthrough | 30 min |
| **[🎨 Plugin Types](./PLUGIN_TYPES.md)** | Choose the right type | 5 min |

### Reference

| Document | Description |
|----------|-------------|
| **[📋 Manifest Reference](./PLUGIN_MANIFEST.md)** | manifest.json specification |
| **[🔌 SDK API Reference](./SDK_API_REFERENCE.md)** | Full SDK documentation |
| **[💬 Communication Guide](./COMMUNICATION_GUIDE.md)** | Plugin ↔ Host messaging |
| **[🌐 OpenAPI Integration](./OPENAPI_INTEGRATION.md)** | Use OpenAPI specs |

### Publishing

| Document | Description |
|----------|-------------|
| **[📤 Submit Your Plugin](./SUBMIT_PLUGIN.md)** | List in the marketplace |

### Advanced

| Document | Description |
|----------|-------------|
| **[🎭 Artifacts Guide](./ARTIFACTS_GUIDE.md)** | Rich interactive content |
| **[🔄 MCP Comparison](./MCP_COMPARISON.md)** | Model Context Protocol vs Plugins |
| **[⚡ Complete Guide](./SPERAXOS_PLUGIN_COMPLETE_GUIDE.md)** | Everything in one doc |

---

## 🎯 Choose Your Path

### "I want to return data for AI to explain"
→ Use **Default** type → [Quick Start](./QUICK_START.md)

### "I want to show formatted text/tables"
→ Use **Markdown** type → [Plugin Types](./PLUGIN_TYPES.md#markdown)

### "I want to build interactive UI"
→ Use **Standalone** type → [Plugin Types](./PLUGIN_TYPES.md#standalone)

### "I have an OpenAPI spec already"
→ Use **OpenAPI** type → [OpenAPI Guide](./OPENAPI_INTEGRATION.md)

---

## 🏗️ Plugin Architecture

```
User: "What's the price of ETH?"
           │
           ▼
    ┌──────────────┐
    │   SperaxOS   │ ←── Discovers plugin from index
    │   AI Model   │
    └──────┬───────┘
           │
           ▼ Function Call: getPrice(coin: "ethereum")
    ┌──────────────┐
    │   Gateway    │ ←── Routes, validates, injects settings
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ Plugin API   │ ←── Your code runs here
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │   Response   │ ←── JSON, Markdown, or UI
    └──────────────┘
```

### Three Plugin Types

| Type | Output | AI Processing | Use Case |
|------|--------|---------------|----------|
| **Default** | JSON | ✅ AI summarizes | Data APIs |
| **Markdown** | Formatted text | ❌ Direct display | Reports, tables |
| **Standalone** | React/HTML | ❌ Custom UI | Dashboards, tools |

---

## ⚡ Quick Start

```bash
# 1. Clone template
git clone https://github.com/nirholas/plugin.delivery.git
cd plugins
cp -r templates/default my-plugin
cd my-plugin

# 2. Install & run
bun install
bun dev

# 3. Test in SperaxOS
# Add custom plugin: http://localhost:3400/manifest.json
```

[Full Quick Start Guide →](./QUICK_START.md)

---

## 📦 Templates

| Template | Type | Use Case |
|----------|------|----------|
| [basic](../templates/basic) | Default | Full-featured with CI |
| [default](../templates/default) | Default | Simple backend + UI |
| [markdown](../templates/markdown) | Markdown | Formatted output |
| [openapi](../templates/openapi) | OpenAPI | Auto-generated |
| [settings](../templates/settings) | Default | User preferences |
| [standalone](../templates/standalone) | Standalone | Interactive UI |

---

## 🔗 Resources

### Packages

| Package | npm |
|---------|-----|
| `@sperax/plugin-sdk` | [![npm](https://img.shields.io/npm/v/@sperax/plugin-sdk)](https://www.npmjs.com/package/@sperax/plugin-sdk) |
| `@sperax/chat-plugins-gateway` | [![npm](https://img.shields.io/npm/v/@sperax/chat-plugins-gateway)](https://www.npmjs.com/package/@sperax/chat-plugins-gateway) |

### Links

| Resource | URL |
|----------|-----|
| Plugin Index | [plugin.delivery](https://plugin.delivery) |
| GitHub | [github.com/nirholas/plugins](https://github.com/nirholas/plugin.delivery) |
| Twitter/X | [@nichxbt](https://x.com/nichxbt) |

---

## 🏷️ Plugin Categories

| Category | ID | Examples |
|----------|-----|----------|
| 💰 Stocks & Finance | `stocks-finance` | Crypto prices, trading |
| 🔧 Developer Tools | `developer` | Code tools, APIs |
| 🔍 Information | `information` | Search, lookups |
| 🎨 Media | `media-generate` | Images, video |
| 📚 Education | `science-education` | Learning, research |
| 🎮 Gaming | `gaming` | Games, entertainment |
| 🌍 Lifestyle | `lifestyle` | Travel, weather |

---

## ❓ Need Help?

- **GitHub Issues:** [github.com/nirholas/plugins/issues](https://github.com/nirholas/plugin.delivery/issues)
- **Twitter/X:** [@nichxbt](https://x.com/nichxbt)
- **Example Plugin:** [CoinGecko](../src/coingecko.json)
