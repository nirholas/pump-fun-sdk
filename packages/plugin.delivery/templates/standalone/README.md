# SperaxOS Plugin System

> A comprehensive plugin ecosystem enabling AI agents to interact with external services through a unified gateway architecture

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)

## Overview

SperaxOS Plugin System is a modular architecture that extends AI agent capabilities through standardized plugin interfaces. It provides authentication management, function calling integration, and a gateway API for routing plugin requests. Built on Next.js with TypeScript, it supports both standalone plugins and integrated marketplace deployments.

## Quick Start

### Prerequisites
- Node.js >= 18
- pnpm (recommended) or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/nirholas/SperaxOS.git
cd SperaxOS

# Install dependencies
pnpm install

# Start development server
bun run dev
```

### First Plugin Call

```bash
# Visit http://localhost:3010
# Navigate to Chat → Enable a plugin → Send message that triggers plugin
```

Expected output: The AI agent will automatically detect relevant tools and call the plugin API when needed.

## Key Features

- **Unified Gateway Architecture**: Single API endpoint (`/api/gateway`) routes all plugin requests with centralized authentication
- **Function Calling Integration**: Plugins automatically activate when AI models return `tool_calls` responses
- **Authentication Management**: Supports multiple auth methods (API keys, OAuth, Bearer tokens, custom headers)
- **Multi-Provider Support**: 40+ AI model providers including OpenAI, Anthropic, Google, and custom adapters
- **Plugin Marketplace**: Discover and install community plugins via the Agents Market
- **Artifacts System**: Display portfolio data, charts, and interactive components within chat via `<speraxArtifact>` tags
- **Internationalization**: Built-in i18n with automatic translation pipeline using sperax-i18n

## Architecture

### Technology Stack

**Frontend:**
- Next.js 15 (App Router with Route Groups)
- React 19, TypeScript
- Ant Design, @sperax/ui, antd-style
- Zustand (state management), SWR (data fetching)

**Backend:**
- Edge Runtime API (AI conversation logic)
- tRPC (type-safe API layer with edge/lambda/async variants)
- PostgreSQL, PGLite, Drizzle ORM
- AgentRuntime (unified model provider abstraction)

**Testing:**
- Vitest, Testing Library
- 97%+ coverage target for core modules

### Directory Structure

```
src/
├── app/                      # Next.js App Router
│   ├── (backend)/           # API routes and services
│   │   ├── api/            # REST endpoints
│   │   ├── trpc/           # tRPC routes (edge/lambda/desktop)
│   │   └── webapi/         # Web API endpoints
│   └── [variants]/         # Platform variants (web/desktop/mobile)
├── components/              # Reusable UI components
├── features/                # Business feature modules
│   ├── AgentSetting/       # Agent configuration UI
│   ├── Conversation/       # Chat interface
│   └── Portal/             # Artifacts rendering
├── libs/                    # Third-party integrations
│   └── agent-runtime/      # Model provider abstractions
├── services/                # Backend service interfaces
├── store/                   # Zustand state management
├── types/                   # TypeScript definitions
└── database/                # Drizzle schemas and migrations
```

### Core Components

- **app/(backend)/webapi/chat/**: Handles chat streaming and function calling
- **libs/agent-runtime/**: AgentRuntime class provides unified interface for 40+ AI providers
- **features/Portal/Artifacts/**: Renders React/HTML/SVG artifacts in chat sidebar
- **services/chat.ts**: Frontend ChatService orchestrates message flow
- **database/schemas/**: Drizzle ORM schemas for agents, sessions, and plugins

## API Reference

### Main Functions

| Function/Endpoint | Purpose | Parameters | Returns |
|-------------------|---------|------------|---------|
| `POST /api/gateway` | Route plugin requests | `apiName`, `identifier`, `arguments` | Plugin API response |
| `createAssistantMessage()` | Initiate AI chat | `messages`, `tools`, `model`, `provider` | Streaming response |
| `runPluginApi()` | Execute plugin | `identifier`, `apiName`, `params` | Plugin result |
| `fetchPresetTaskResult()` | Run preset tasks | `taskPrompt`, `params` | Task completion |
| `AgentRuntime.chat()` | Unified model call | `messages`, `model`, `provider`, `options` | Stream response |
| `buildFluxDevWorkflow()` | ComfyUI workflow | `modelFileName`, `prompt`, `context` | PromptBuilder instance |

### Configuration

```typescript
// Agent Configuration
interface SperaxAgentConfig {
  model: string;                    // Model identifier
  chatConfig: SperaxAgentChatConfig;  // Chat settings
  openingMessage?: string;          // Welcome message
  openingQuestions?: string[];      // Suggested prompts
  params: {
    frequency_penalty: number;
    presence_penalty: number;
    temperature: number;
    top_p: number;
  };
  plugins?: string[];               // Enabled plugin identifiers
  systemRole?: string;              // System prompt
  tts: SperaxAgentTTSConfig;         // Text-to-speech config
}

// Plugin Authentication
interface ComfyUIKeyVault {
  baseURL: string;
  authType: 'none' | 'basic' | 'bearer' | 'custom';
  apiKey?: string;
  username?: string;
  password?: string;
  customHeaders?: Record<string, string>;
}
```

## Usage Examples

### Basic Plugin Integration

```typescript
import { SperaxComfyUI } from '@/libs/model-runtime/comfyui';

// Initialize plugin client
const comfyUI = new SperaxComfyUI({
  baseURL: 'http://localhost:8000',
  authType: 'none'
});

// Generate image via plugin
const result = await comfyUI.createImage({
  model: 'flux-dev',
  prompt: 'A serene mountain landscape at sunset',
  size: { width: 1024, height: 1024 },
  steps: 20,
  seed: Math.floor(Math.random() * 1000000),
  params: {
    cfg: 7.0,
    sampler: 'euler',
    scheduler: 'normal'
  }
});

console.log('Generated image URL:', result.imageUrl);
```

### Function Calling Flow

```typescript
// Frontend: ChatService initiates request
const chatService = new ChatService();

await chatService.createAssistantMessage({
  messages: [
    { role: 'user', content: 'Search for the latest AI news' }
  ],
  tools: enabledPluginTools,
  model: 'gpt-4',
  provider: 'openai',
  onMessageHandle: (text) => {
    console.log('Streaming text:', text);
  },
  onToolCall: (toolCall) => {
    console.log('Tool called:', toolCall.function.name);
  }
});

// Backend: AI returns tool_calls
// {
//   "tool_calls": [{
//     "id": "call_123",
//     "function": {
//       "name": "web_search",
//       "arguments": "{\"query\": \"latest AI news 2025\"}"
//     }
//   }]
// }

// System automatically calls runPluginApi
const pluginResult = await chatService.runPluginApi({
  identifier: 'web-search-plugin',
  apiName: 'search',
  params: { query: 'latest AI news 2025' }
});

// AI receives plugin result and generates final response
```

### Artifacts Display in Chat

```typescript
// AI returns artifact in response
const artifactResponse = `
<speraxArtifact identifier="portfolio-assets" title="My Portfolio" type="application/sperax.artifacts.react">
import { Card, Statistic, Row, Col } from 'antd';

export default function PortfolioDisplay() {
  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic title="Total Assets" value={125430.50} prefix="$" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="Total Coins" value={12} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="24h Change" value={2.47} suffix="%" valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
</speraxArtifact>
`;

// Artifacts panel automatically opens and renders the React component
```

## Development

### Setup Development Environment

```bash
# Install dependencies
pnpm install

# Start development server with debug mode
DEBUG=speraxos:* bun run dev

# Run type checking
bun run type-check

# Run linting
bun run lint
```

### Running Tests

```bash
# Run all tests (not recommended - takes ~10 minutes)
bun run test

# Run specific test file
bunx vitest run --silent='passed-only' 'src/store/agent/slices/chat/selectors/agent.test.ts'

# Run tests for specific module
bunx vitest run --silent='passed-only' 'src/comfyui'

# View coverage
bunx vitest run --coverage 'src/comfyui'

# Update test snapshots
bunx vitest -u 'path/to/test.ts'
```

### Project Structure Conventions

**Feature Organization:**
- Global features: `src/features/<feature-name>/` (used across multiple pages)
- Page-specific features: `src/app/<page>/features/<feature-name>/` (single-page only)

**State Management:**
- Use Zustand for global state
- Define selectors in `store/selectors.ts` for performance optimization
- Follow slice pattern for complex stores

**Code Style:**
- Prefer interfaces over types for object shapes
- Use `bun` to run npm scripts, `bunx` for executables
- Commit messages: prefix with gitmoji
- Branch format: `username/feat/feature-name`

## Authentication & Security

### Supported Authentication Methods

**1. No Authentication**
```typescript
const client = new SperaxComfyUI({ baseURL: 'http://localhost:8000', authType: 'none' });
```

**2. Basic Authentication**
```typescript
const client = new SperaxComfyUI({
  baseURL: 'https://api.example.com',
  authType: 'basic',
  username: 'user',
  password: 'pass'
});
```

**3. Bearer Token**
```typescript
const client = new SperaxComfyUI({
  baseURL: 'https://api.example.com',
  authType: 'bearer',
  apiKey: 'your-token'
});
```

**4. Custom Headers**
```typescript
const client = new SperaxComfyUI({
  baseURL: 'https://api.example.com',
  authType: 'custom',
  customHeaders: {
    'X-API-Key': 'key123',
    'X-Custom-Auth': 'value'
  }
});
```

### OAuth Integration

Add new OAuth providers via Auth.js:

```typescript
// src/app/api/auth/next-auth.ts
import Okta from 'next-auth/providers/okta';

const nextAuth = NextAuth({
  providers: [
    Okta({
      clientId: process.env.OKTA_CLIENT_ID,
      clientSecret: process.env.OKTA_CLIENT_SECRET,
      issuer: process.env.OKTA_ISSUER
    })
  ]
});
```

## Extending the System

### Adding New AI Model Providers

1. **Create Provider Implementation**
```typescript
// src/libs/agent-runtime/myprovider/index.ts
import { SperaxRuntimeAI } from '../BaseAI';

export class SperaxMyProviderAI implements SperaxRuntimeAI {
  async chat(payload, options) {
    // Implement chat method
  }
}
```

2. **Register in Runtime Map**
```typescript
// src/libs/agent-runtime/runtimeMap.ts
export const providerRuntimeMap = {
  myprovider: SperaxMyProviderAI,
  // ... other providers
};
```

3. **Add Environment Variables**
```typescript
// src/config/server/app.ts
export const getAppConfig = () => ({
  MYPROVIDER_API_KEY: z.string().optional(),
});
```

### Adding New Plugin Features

1. **Update Database Schema**
```typescript
// src/database/schemas/agent.ts
export const agents = pgTable('agents', {
  newFeature: text('new_feature'),
});
```

2. **Generate Migration**
```bash
npm run db:generate
# Rename and update migration file
```

3. **Update Type Definitions**
```typescript
// src/types/agent/index.ts
export interface SperaxAgentConfig {
  newFeature?: string;
}
```

4. **Implement UI Component**
```typescript
// src/features/AgentSetting/NewFeature/index.tsx
const NewFeature = () => {
  const [config, setConfig] = useStore(s => [s.config, s.setAgentConfig]);
  
  return (
    <Input
      value={config.newFeature}
      onChange={(e) => setConfig({ newFeature: e.target.value })}
    />
  );
};
```

5. **Add i18n Keys**
```typescript
// src/locales/default/setting.ts
export default {
  agent: {
    newFeature: 'New Feature Label',
    newFeatureDescription: 'Description of the feature',
  },
};
```

## Best Practices

1. **State Management**: Use selectors for derived state to optimize re-renders. Define selectors in dedicated files for reusability.

2. **Testing Strategy**: Run targeted tests during development (`bunx vitest run '[pattern]'`). Never run full test suite locally - let CI handle it.

3. **Database Migrations**: Always generate migrations with `npm run db:generate` after schema changes. Manually rename migration files with semantic names.

4. **Internationalization**: Only translate `zh-CN` locale during development. CI automatically handles other languages via `pnpm i18n`.

5. **Plugin Development**: Base workflow structures on official ComfyUI API exports. Use PromptBuilder to wrap and parameterize workflows. Never invent node structures.

## Troubleshooting

### Common Issues

**Issue**: `Could not find 'stylelint-config-recommended'` during `npm install`

**Solution**: Use pnpm or bun instead:
```bash
pnpm install
# or
bun install
```

---

**Issue**: Tests fail with snapshot mismatches after adding optional config fields

**Solution**: Update snapshots for affected tests:
```bash
bunx vitest -u 'src/store/agent/slices/chat/selectors/agent.test.ts'
```

---

**Issue**: Plugin not appearing in marketplace

**Solution**: Ensure plugin manifest includes required fields:
```json
{
  "identifier": "unique-plugin-id",
  "api": [{ "name": "apiName", "url": "/api/endpoint" }],
  "meta": { "title": "Plugin Name", "description": "..." }
}
```

---

**Issue**: ComfyUI workflow fails with "Model file not found"

**Solution**: Verify model file exists in ComfyUI's models directory and filename matches exactly:
```typescript
const resolver = new ModelResolverService(clientService);
const fileName = await resolver.resolveModelFileName('flux-dev');
console.log('Resolved filename:', fileName);
```

## Resources

- [Full Documentation](docs/)
- [API Reference](docs/SDK_API_REFERENCE.md)
- [Plugin Development Guide](docs/PLUGIN_DEVELOPMENT_GUIDE.md)
- [Testing Guide](testing-guide/testing-guide.mdc)
- [Contributing Guide](CONTRIBUTING.md)
- [SperaxOS GitHub](https://github.com/nirholas/SperaxOS)

## License

MIT © Sperax
