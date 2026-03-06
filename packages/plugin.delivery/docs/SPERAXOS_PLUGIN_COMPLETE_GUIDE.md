# SperaxOS Plugin & Portfolio Integration Complete Guide

> **Version:** 1.0.0  
> **Last Updated:** December 27, 2025  
> **Author:** SperaxOS Development Team

This guide covers the complete setup, development, and deployment of the SperaxOS plugin ecosystem, with a focus on portfolio integration in chat.

---

## Related Documentation

For developing **external plugins** deployed to the SperaxOS Plugin Marketplace (`plugin.delivery`), see the comprehensive guides in the plugins repository:

| Document | Description |
|----------|-------------|
| [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md) | Complete tutorial for building external plugins |
| [Plugins README](../README.md) | Getting started with the plugin marketplace |

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [SperaxOS Plugin Ecosystem](#2-nirholas-plugin-ecosystem)
3. [Portfolio Integration Methods](#3-portfolio-integration-methods)
4. [Environment Setup](#4-environment-setup)
5. [Database Configuration](#5-database-configuration)
6. [Authentication Setup](#6-authentication-setup)
7. [DeBank API Integration](#7-debank-api-integration)
8. [Builtin Plugin Development](#8-builtin-plugin-development)
9. [External Plugin Development](#9-external-plugin-development)
10. [Portal Components](#10-portal-components)
11. [Embed Routes](#11-embed-routes)
12. [Artifacts](#12-artifacts)
13. [Testing Plugins](#13-testing-plugins)
14. [Deployment](#14-deployment)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            SPERAXOS                                      │
│                                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │   /chat    │  │ /portfolio │  │   /embed   │  │    /api    │        │
│  │  (Main UI) │  │(Standalone)│  │ (Iframes)  │  │ (Backend)  │        │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘        │
│        │               │               │               │                │
│        └───────────────┴───────────────┴───────────────┘                │
│                                │                                         │
│                    ┌───────────┴───────────┐                            │
│                    │    Zustand Stores     │                            │
│                    │  - usePortfolioStore  │                            │
│                    │  - useChatStore       │                            │
│                    │  - useAgentStore      │                            │
│                    └───────────┬───────────┘                            │
│                                │                                         │
│                    ┌───────────┴───────────┐                            │
│                    │   Services Layer       │                            │
│                    │  - portfolioService   │                            │
│                    │  - DeBankClient       │                            │
│                    └───────────┬───────────┘                            │
│                                │                                         │
│                    ┌───────────┴───────────┐                            │
│                    │   Database Layer       │                            │
│                    │  - WalletModel        │                            │
│                    │  - Drizzle ORM        │                            │
│                    └───────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Plugin Flow

```
User Message: "Show my portfolio"
        │
        ▼
┌───────────────┐
│   AI Model    │ ◄── System prompt includes plugin descriptions
└───────┬───────┘
        │ Recognizes intent → Function Call
        ▼
┌───────────────┐
│ Tool Router   │ ◄── Matches function to registered tool
└───────┬───────┘
        │
        ├──► Builtin Tool? ──► Portal Component ──► Renders in chat
        │
        └──► External Plugin? ──► Gateway ──► Plugin Server ──► Response

```

---

## 2. SperaxOS Plugin Ecosystem

### Core Repositories

| Repository | Purpose | NPM Package | Importance |
|------------|---------|-------------|------------|
| **[plugin-sdk](https://github.com/nirholas/plugin-sdk)** | SDK for building plugins | `@nirholas/plugin-sdk` | 🔴 Critical |
| **[chat-plugins-gateway](https://github.com/nirholas/chat-plugins-gateway)** | Proxy between SperaxOS and plugins | `@nirholas/chat-plugins-gateway` | 🔴 Critical |
| **[speraxos-plugins](https://github.com/nirholas/speraxos-plugins)** | Plugin marketplace index | - | 🟡 Medium |
| **[openai-plugins](https://github.com/nirholas/openai-plugins)** | ChatGPT plugin compatibility | - | 🟢 Low |

### Example Plugin Repositories

| Repository | Type | Has Backend | Has Frontend | Deployment |
|------------|------|-------------|--------------|------------|
| **[chat-plugin-template](https://github.com/nirholas/chat-plugin-template)** | Template | ✅ | ✅ | Vercel |
| **[chat-plugin-web-crawler](https://github.com/nirholas/chat-plugin-web-crawler)** | Default | ✅ | ❌ | Vercel |
| **[chat-plugin-search-engine](https://github.com/nirholas/chat-plugin-search-engine)** | Default | ✅ | ❌ | Vercel |
| **[chat-plugin-clock-time](https://github.com/nirholas/chat-plugin-clock-time)** | Standalone | ❌ | ✅ | Vercel Static |
| **[chat-plugin-realtime-weather](https://github.com/nirholas/chat-plugin-realtime-weather)** | Default | ✅ | ✅ | Vercel |
| **[chat-plugin-bilibili](https://github.com/nirholas/chat-plugin-bilibili)** | Default | ✅ | ❌ | Vercel |
| **[chat-plugin-steam](https://github.com/nirholas/chat-plugin-steam)** | Default | ✅ | ❌ | Vercel |
| **[chat-plugin-open-interpreter](https://github.com/nirholas/chat-plugin-open-interpreter)** | Standalone | ✅ | ✅ | 🔴 Local Only |

### SDK Installation

```bash
# For plugin development
pnpm add @nirholas/plugin-sdk

# For gateway setup
pnpm add @nirholas/chat-plugins-gateway
```

### SDK Client API

```typescript
import { speraxOS } from '@nirholas/plugin-sdk/client';

// Get initialization data
const payload = await speraxOS.getPluginPayload();
// { name, arguments, settings, state }

// Update message content
speraxOS.setPluginMessage('New content');

// Update plugin state
speraxOS.setPluginState('key', value);

// Trigger AI response (standalone plugins)
speraxOS.triggerAIMessage(messageId);

// Create assistant message (standalone plugins)
speraxOS.createAssistantMessage('AI will process this');
```

---

## 3. Portfolio Integration Methods

### Method Comparison

| Method | Best For | Interactivity | Complexity | Auth Context |
|--------|----------|---------------|------------|--------------|
| **Portal** | Native components | High | Medium | ✅ Shared |
| **Iframe Embed** | Full dashboards | Very High | Low | ⚠️ Separate |
| **Artifacts** | Custom visualizations | Medium | Low | ❌ Sandboxed |
| **Markdown** | Quick text responses | None | Very Low | N/A |
| **Function + AI** | Data + interpretation | None | Low | ✅ Backend |
| **Standalone** | Complex workflows | Full Control | High | Plugin-managed |

### Decision Matrix

```
User asks about portfolio
├── Quick answer needed?
│   └── YES → Markdown response or Function + AI Summary
│
├── Visual display needed?
│   ├── Custom one-off chart → Artifact
│   ├── Standard portfolio view → Portal Component
│   └── Full dashboard → Iframe Embed
│
└── Complex interaction needed?
    └── Standalone Plugin
```

### Current Implementation Status

| Method | Status | Location |
|--------|--------|----------|
| Portal | ✅ Built | `src/features/Portal/PortfolioAnalytics/` |
| Iframe Embed | ✅ Built | `src/app/[variants]/(portfolio)/embed/*` |
| Artifacts | ✅ Ready | AI can generate anytime |
| Markdown | ⚠️ Partial | Plugin exists, needs formatter |
| Function + AI | ⚠️ Partial | Needs data fetching |
| Standalone | ❌ Not built | Future work |

---

## 4. Environment Setup

### Required Environment Variables

Create `.env.local` in project root:

```bash
# ============================================
# DATABASE
# ============================================
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# ============================================
# AUTHENTICATION
# ============================================
# Option A: Clerk (Recommended for production)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx

# Option B: NextAuth
NEXT_AUTH_SECRET=your-secret-key-min-32-chars
KEY_VAULTS_SECRET=base64-encoded-32-byte-key

# ============================================
# APP CONFIGURATION
# ============================================
NEXT_PUBLIC_SERVICE_MODE=server
APP_URL=http://localhost:3010

# ============================================
# DEBANK API (Optional - Free tier works without key)
# ============================================
# DEBANK_API_KEY=your-api-key  # Only if using Pro tier

# ============================================
# AI PROVIDERS (Configure at least one)
# ============================================
OPENAI_API_KEY=sk-xxx
# ANTHROPIC_API_KEY=sk-xxx
# GOOGLE_API_KEY=xxx
```

### Generate Secrets

```bash
# Generate KEY_VAULTS_SECRET (32 bytes, base64 encoded)
openssl rand -base64 32

# Generate NEXT_AUTH_SECRET
openssl rand -hex 16
```

---

## 5. Database Configuration

### Supported Databases

| Database | Use Case | Setup |
|----------|----------|-------|
| **Neon PostgreSQL** | Production | Cloud-hosted |
| **Local PostgreSQL** | Development | Docker |
| **PGLite** | Browser/Development | Built-in |

### Neon PostgreSQL Setup

1. **Create Neon Account:** https://neon.tech

2. **Create Database:**
   - Create new project
   - Copy connection string
   - Enable pgvector extension:
   
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **Configure Environment:**
   ```bash
   DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

4. **Push Schema:**
   ```bash
   bunx drizzle-kit push
   ```

### Portfolio Database Tables

The schema includes these portfolio-specific tables:

```typescript
// src/database/schemas/portfolio.ts

// User wallet addresses
user_wallets: {
  id: string;
  userId: string;
  address: string;        // 0x...
  chain: string;          // ethereum, polygon, etc.
  label: string;          // "Main Wallet"
  isPrimary: boolean;
  createdAt: timestamp;
}

// Token watchlist
portfolio_watchlist: {
  id: string;
  userId: string;
  tokenSymbol: string;
  tokenAddress: string;
  chain: string;
  addedAt: timestamp;
}

// Historical snapshots
portfolio_snapshots: {
  id: string;
  userId: string;
  totalValueUsd: number;
  snapshotAt: timestamp;
  data: jsonb;  // Full snapshot data
}

// Notification preferences
portfolio_notification_prefs: {
  id: string;
  userId: string;
  priceAlerts: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
  settings: jsonb;
}
```

### Verify Tables Exist

```bash
# Check if tables were created
bunx drizzle-kit studio

# Or query directly
psql $DATABASE_URL -c "\dt"
```

---

## 6. Authentication Setup

### Option A: Clerk (Recommended)

1. **Create Clerk Account:** https://clerk.com

2. **Create Application:**
   - Choose sign-in methods (email, Google, GitHub, etc.)
   - Copy publishable key and secret key

3. **Configure Environment:**
   ```bash
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
   CLERK_SECRET_KEY=sk_test_xxx
   ```

4. **Webhook Setup (for user sync):**
   - In Clerk Dashboard → Webhooks
   - Add endpoint: `https://your-domain.com/api/webhooks/clerk`
   - Copy webhook secret:
   ```bash
   CLERK_WEBHOOK_SECRET=whsec_xxx
   ```

5. **Verify Integration:**
   ```typescript
   // Auth is automatically detected
   import { getUserAuth } from '@sperax/utils/server';
   
   const { userId } = await getUserAuth();
   // Returns Clerk user ID when enabled
   ```

### Option B: NextAuth

1. **Generate Secrets:**
   ```bash
   # Auth secret
   openssl rand -hex 16
   
   # Key vault secret
   openssl rand -base64 32
   ```

2. **Configure Environment:**
   ```bash
   NEXT_AUTH_SECRET=your-hex-secret
   KEY_VAULTS_SECRET=your-base64-secret
   ```

3. **Configure OAuth Providers (optional):**
   ```bash
   # GitHub
   AUTH_GITHUB_ID=xxx
   AUTH_GITHUB_SECRET=xxx
   
   # Google
   AUTH_GOOGLE_ID=xxx
   AUTH_GOOGLE_SECRET=xxx
   ```

### Auth Flow in Portfolio

```typescript
// API Route (Backend)
import { getUserAuth } from '@sperax/utils/server';

export async function GET(request: Request) {
  const { userId } = await getUserAuth();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const walletModel = new WalletModel(serverDB, userId);
  const wallets = await walletModel.getWallets();
  
  return NextResponse.json({ data: wallets });
}
```

---

## 7. DeBank API Integration

### API Tiers

| Tier | Cost | Rate Limit | API Key Required |
|------|------|------------|------------------|
| **Free** | $0 | 1000 calls/day | ❌ No |
| **Pro** | $200+/month | Higher | ✅ Yes |

### Configuration

The DeBank client auto-detects which tier to use:

```typescript
// src/server/services/debank/client.ts

constructor(options: DeBankClientOptions = {}) {
  this.apiKey = options.apiKey || process.env.DEBANK_API_KEY;
  // Auto-fallback to free tier if no API key
  this.baseUrl = this.apiKey 
    ? 'https://pro-openapi.debank.com'  // Pro
    : 'https://openapi.debank.com';      // Free
}
```

### Available Endpoints

```typescript
// Token balances
debankClient.getAllTokens(address);      // All tokens across chains
debankClient.getTokensOnChain(address, chainId);  // Chain-specific

// DeFi positions
debankClient.getAllProtocols(address);   // All protocol positions

// Balance
debankClient.getTotalBalance(address);   // Total USD value

// Transaction history
debankClient.getHistoryList(address);    // Recent transactions
```

### Caching

Built-in in-memory caching reduces API calls:

```typescript
const CACHE_TTL = {
  BALANCE: 60,       // 1 minute
  TOKENS: 300,       // 5 minutes
  PROTOCOLS: 300,    // 5 minutes
  HISTORY: 600,      // 10 minutes
  CHAINS: 86_400,    // 24 hours
};
```

---

## 8. Builtin Plugin Development

Builtin plugins are part of SperaxOS and don't need external deployment.

### File Structure

```
src/tools/
├── index.ts                    # Registers all builtin tools
├── portals.ts                  # Maps tools to portal components
├── sperax-portfolio/
│   ├── index.ts               # Main export
│   └── manifest.ts            # Plugin manifest
├── artifacts/
├── dalle/
├── web-browsing/
└── code-interpreter/
```

### Creating a New Builtin Plugin

#### Step 1: Create Manifest

```typescript
// src/tools/my-plugin/manifest.ts

import { BuiltinToolManifest } from '@sperax/types';

export const myPluginManifest: BuiltinToolManifest = {
  identifier: 'my-plugin',
  
  api: [
    {
      name: 'myFunction',
      description: 'Description for AI to understand when to use',
      parameters: {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: 'What this parameter does',
          },
          param2: {
            type: 'number',
            default: 10,
            description: 'Optional parameter with default',
          },
        },
        required: ['param1'],
      },
    },
  ],
  
  meta: {
    avatar: '🔧',
    title: 'My Plugin',
    description: 'What my plugin does',
    tags: ['utility', 'example'],
  },
  
  systemRole: `You are an assistant with access to My Plugin.
    Use myFunction when the user wants to...`,
  
  type: 'builtin',
};
```

#### Step 2: Create Export

```typescript
// src/tools/my-plugin/index.ts

export { myPluginManifest } from './manifest';
export { myPluginManifest as default } from './manifest';
```

#### Step 3: Register Plugin

```typescript
// src/tools/index.ts

import { myPluginManifest } from './my-plugin';

export const builtinTools: SperaxOSBuiltinTool[] = [
  // ... existing tools
  {
    identifier: myPluginManifest.identifier,
    manifest: myPluginManifest,
    type: 'builtin',
  },
];
```

#### Step 4: Create Portal Component (if UI needed)

```typescript
// src/features/Portal/MyPlugin/index.tsx

import { memo, Suspense } from 'react';
import type { BuiltinPortalProps } from '@sperax/types';

const MyPluginBody = memo<{ payload?: Record<string, any> }>(({ payload }) => {
  const { param1, param2 } = payload || {};
  
  return (
    <div>
      <h3>My Plugin Result</h3>
      <p>Param1: {param1}</p>
      <p>Param2: {param2}</p>
    </div>
  );
});

export const MyPluginPortal = memo<BuiltinPortalProps>(({ arguments: args }) => {
  return <MyPluginBody payload={args} />;
});
```

#### Step 5: Register Portal

```typescript
// src/tools/portals.ts

import { MyPluginPortal } from '@/features/Portal/MyPlugin';

export const BuiltinToolsPortals: Record<string, BuiltinPortal> = {
  // ... existing portals
  'my-plugin___myFunction': MyPluginPortal as BuiltinPortal,
};
```

---

## 9. External Plugin Development

External plugins run on separate servers and communicate via Gateway.

### Project Setup

```bash
# Clone template
git clone https://github.com/nirholas/chat-plugin-template my-plugin
cd my-plugin

# Install dependencies
pnpm install

# Start development
pnpm dev
```

### Manifest File

```json
// public/manifest.json
{
  "$schema": "https://plugin.delivery/schema/manifest-v1.json",
  "identifier": "my-external-plugin",
  "version": "1.0.0",
  "api": [
    {
      "name": "getData",
      "description": "Fetches data from external API",
      "url": "https://my-plugin.vercel.app/api/getData",
      "parameters": {
        "type": "object",
        "properties": {
          "query": { "type": "string" }
        },
        "required": ["query"]
      }
    }
  ],
  "meta": {
    "title": "My External Plugin",
    "description": "Does something useful",
    "avatar": "🔌",
    "tags": ["external", "api"]
  },
  "gateway": "https://my-plugin.vercel.app/api/gateway"
}
```

### API Route

```typescript
// pages/api/getData.ts (or app/api/getData/route.ts)

export default async function handler(req, res) {
  const { query } = req.body;
  
  // Process request
  const result = await fetchExternalData(query);
  
  // Return response
  res.json({ data: result });
}
```

### Gateway Route

```typescript
// pages/api/gateway.ts

import { createSperaxOSPluginGateway } from '@nirholas/chat-plugins-gateway';

export default createSperaxOSPluginGateway();
```

### Plugin Settings

```json
// In manifest.json
{
  "settings": {
    "type": "object",
    "properties": {
      "apiKey": {
        "type": "string",
        "title": "API Key",
        "description": "Your API key for the external service"
      }
    },
    "required": ["apiKey"]
  }
}
```

Access settings in API:

```typescript
import { getPluginSettingsFromRequest } from '@nirholas/chat-plugins-gateway';

export default async function handler(req, res) {
  const settings = getPluginSettingsFromRequest(req);
  const apiKey = settings.apiKey;
  
  // Use API key...
}
```

---

## 10. Portal Components

Portals render plugin output directly in the chat UI.

### Portal Structure

```typescript
// src/features/Portal/PortfolioAnalytics/index.tsx

import { memo, Suspense, lazy } from 'react';
import { createStyles } from 'antd-style';
import { Spin } from 'antd';
import type { BuiltinPortalProps } from '@sperax/types';

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    width: 100%;
    min-height: 400px;
    background: ${token.colorBgContainer};
    border-radius: ${token.borderRadiusLG}px;
  `,
  loading: css`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 400px;
  `,
}));

// Lazy load components
const Dashboard = lazy(() => import('@/components/portfolio/dashboard-content'));

const PortalBody = memo<{ payload?: Record<string, any> }>(({ payload }) => {
  const { styles } = useStyles();
  const { view = 'dashboard' } = payload || {};

  return (
    <div className={styles.container}>
      <Suspense fallback={<Spin size="large" />}>
        {view === 'dashboard' && <Dashboard />}
        {/* Add more views */}
      </Suspense>
    </div>
  );
});

// Export for portal registration
export const PortfolioAnalyticsPortal = memo<BuiltinPortalProps>(
  ({ arguments: args }) => <PortalBody payload={args} />
);
```

### Portal Registration

```typescript
// src/tools/portals.ts

import { PortfolioAnalyticsPortal } from '@/features/Portal/PortfolioAnalytics';

export const BuiltinToolsPortals: Record<string, BuiltinPortal> = {
  // Format: 'plugin-identifier___functionName'
  'sperax-portfolio___showPortfolio': PortfolioAnalyticsPortal,
  'sperax-portfolio___getPortfolioSummary': PortfolioAnalyticsPortal,
  'sperax-portfolio___searchAssets': PortfolioAnalyticsPortal,
  'sperax-portfolio___analyzePortfolio': PortfolioAnalyticsPortal,
};
```

---

## 11. Embed Routes

Embed routes provide full portfolio views for iframe embedding.

### Available Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/embed/dashboard` | DashboardContent | Full portfolio dashboard |
| `/embed/wallets` | WalletsInterface | Wallet management |
| `/embed/trading` | TradingInterface | Trading UI |
| `/embed/assets` | MyAssets | Asset list |
| `/embed/analytics` | MyAnalytics | Charts and analytics |
| `/embed/defi-protocols` | DefiProtocolsInterface | DeFi positions |
| `/embed/yield-farming` | YieldFarmingInterface | Yield opportunities |
| `/embed/staking-pools` | StakingPoolsInterface | Staking pools |
| `/embed/ai-bot` | AiBotDashboard | AI trading bot |
| `/embed/dca-bot` | DcaBotDashboard | DCA automation |
| `/embed/signal-bot` | SignalBotDashboard | Signal-based trading |
| `/embed/settings` | SettingsInterface | Settings |
| `/embed/help-center` | HelpCenterInterface | Help & FAQ |

### Embed Route Structure

```typescript
// src/app/[variants]/(portfolio)/embed/dashboard/page.tsx

'use client';

import { useEffect } from 'react';
import { DashboardContent } from '@/components/portfolio/dashboard-content';
import { useEmbedMode } from '@/libs/portfolio/embed-utils';

export default function DashboardEmbedPage() {
  const embed = useEmbedMode();

  useEffect(() => {
    if (embed.isEmbed) {
      embed.notifyReady(embed);
    }
  }, [embed]);

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <DashboardContent />
    </div>
  );
}
```

### Embed Communication

```typescript
// src/libs/portfolio/embed-utils.ts

export enum MessageType {
  PORTFOLIO_READY = 'PORTFOLIO_READY',
  PORTFOLIO_DATA_LOADED = 'PORTFOLIO_DATA_LOADED',
  SET_ACCOUNT = 'SET_ACCOUNT',
  SET_THEME = 'SET_THEME',
  REFRESH_PORTFOLIO = 'REFRESH_PORTFOLIO',
}

// Send to parent window
export function sendToParent(type: MessageType, data?: any) {
  if (typeof window === 'undefined' || !isIframe()) return;
  window.parent.postMessage({ type, data }, '*');
}

// Listen from parent
export function listenToParent(callback: (message) => void) {
  window.addEventListener('message', (event) => {
    if (event.data?.type) callback(event.data);
  });
}
```

### Using Embeds in Artifacts

```html
<speraxArtifact identifier="portfolio-embed" type="text/html" title="Portfolio">
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; }
    iframe { width: 100%; height: 600px; border: none; }
  </style>
</head>
<body>
  <iframe src="/embed/dashboard" title="Portfolio"></iframe>
</body>
</html>
</speraxArtifact>
```

---

## 12. Artifacts

Artifacts are AI-generated React components rendered in chat.

### Available Libraries

| Library | Version | Use For |
|---------|---------|---------|
| `react` | 19.x | Components, hooks |
| `antd` | 5.x | UI components |
| `lucide-react` | 0.263.1 | Icons |
| `recharts` | 2.x | Charts |

### Artifact Structure

```jsx
<speraxThinking>
Analyzing user request...
</speraxThinking>

<speraxArtifact 
  identifier="unique-id" 
  type="application/sperax.artifacts.react" 
  title="Display Title"
>
import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import { TrendingUp, Wallet } from 'lucide-react';

export default function App() {
  // Component code
  return (
    <Card title="Portfolio Summary">
      <Row gutter={16}>
        <Col span={12}>
          <Statistic title="Total Value" value={127453.89} prefix="$" />
        </Col>
        <Col span={12}>
          <Statistic title="24h Change" value={2.28} suffix="%" />
        </Col>
      </Row>
    </Card>
  );
}
</speraxArtifact>
```

### When to Use Artifacts

| Scenario | Recommended |
|----------|-------------|
| Custom one-off visualization | ✅ Yes |
| Displaying static data | ✅ Yes |
| Interactive forms | ⚠️ Limited |
| Accessing app stores | ❌ No |
| Persistent state | ❌ No |

---

## 13. Testing Plugins

### Local Development

```bash
# Start SperaxOS dev server
bun run dev

# For external plugins, start plugin server
cd my-plugin && pnpm dev
```

### Testing Builtin Plugins

1. Start dev server
2. Go to http://localhost:3010/chat
3. Enable plugin in agent settings
4. Test by asking related questions

### Testing External Plugins

1. Start plugin server locally
2. In SperaxOS → Settings → Plugins → Custom Plugins
3. Add manifest URL: `http://localhost:3400/manifest.json`
4. Enable and test

### Debug Mode

```bash
# Enable debug logging
DEBUG=sperax:* bun run dev
```

### Type Checking

```bash
# Check for TypeScript errors
bun run type-check

# Run tests
bunx vitest run --silent='passed-only' 'src/tools'
```

---

## 14. Deployment

### SperaxOS (Main App)

**Platform:** Vercel

**Configuration:**

```json
// vercel.json
{
  "buildCommand": "bun run build",
  "framework": "nextjs"
}
```

**Environment Variables to Set:**
- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SERVICE_MODE=server`

**Deploy:**

```bash
# Push to deploy branch
git push origin feature/xxx:deploy
```

### External Plugins

**Platform:** Vercel (recommended)

```bash
# Deploy
vercel --prod

# Or connect GitHub repo for auto-deploy
```

**Required Setup:**
1. Add environment variables in Vercel dashboard
2. Configure custom domain (optional)
3. Update manifest.json with production URLs

### Plugin Gateway

If using separate gateway:

```bash
# Deploy gateway
vercel --prod

# Update plugins to use gateway URL
```

---

## 15. Troubleshooting

### Common Issues

#### "Unauthorized" Error in Portfolio API

**Cause:** User not authenticated

**Solution:**
1. Ensure Clerk or NextAuth is configured
2. Check `NEXT_PUBLIC_ENABLE_CLERK_AUTH` is set
3. Verify user is logged in

#### "No wallet connected" Error

**Cause:** User hasn't connected wallet in /portfolio

**Solution:**
1. Go to /portfolio
2. Connect MetaMask/wallet
3. Wallet saves to `user_wallets` table
4. Try chat command again

#### TypeScript Errors in Portfolio Components

**Cause:** `createStyles` returns class names, not style objects

**Wrong:**
```tsx
<div style={styles.container}>  // ❌ Error
```

**Correct:**
```tsx
<div className={styles.container}>  // ✅ Correct
```

#### Database "vector type does not exist"

**Cause:** pgvector extension not enabled

**Solution:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Plugin Not Appearing in Chat

**Cause:** Not registered in builtinTools or portals

**Solution:**
1. Add to `src/tools/index.ts`
2. Add portal to `src/tools/portals.ts`
3. Restart dev server

#### Embed Route 404

**Cause:** Route not defined or layout missing

**Solution:**
1. Check route exists in `src/app/[variants]/(portfolio)/embed/`
2. Verify layout.tsx exists in parent folder

### Debug Commands

```bash
# Check environment
env | grep -E "(DATABASE|CLERK|NEXT)"

# Check database tables
bunx drizzle-kit studio

# Check TypeScript
bun run type-check 2>&1 | head -50

# Check build
bun run build 2>&1 | tail -100

# Clear cache
rm -rf .next node_modules/.cache
```

---

## Appendix A: Complete File Reference

### Plugin System Files

```
src/
├── tools/
│   ├── index.ts                 # Builtin tools registry
│   ├── portals.ts               # Portal component mapping
│   └── sperax-portfolio/
│       ├── index.ts
│       └── manifest.ts
│
├── features/
│   └── Portal/
│       └── PortfolioAnalytics/
│           └── index.tsx        # Portfolio portal component
│
├── components/
│   └── portfolio/               # All portfolio components
│       ├── dashboard-content/
│       ├── my-assets/
│       ├── my-analytics/
│       └── ...
│
├── app/
│   └── [variants]/
│       └── (portfolio)/
│           └── embed/           # 26 embed routes
│               ├── dashboard/
│               ├── wallets/
│               └── ...
│
├── libs/
│   └── portfolio/
│       └── embed-utils.ts       # Iframe communication
│
├── server/
│   └── services/
│       └── debank/
│           ├── client.ts        # DeBank API client
│           └── types.ts
│
├── services/
│   └── portfolio.ts             # Frontend portfolio service
│
├── store/
│   └── portfolio/               # Zustand portfolio store
│
└── database/
    └── schemas/
        └── portfolio.ts         # DB schema for wallets, etc.
```

### Environment Template

```bash
# .env.local.example

# Database
DATABASE_URL=

# Auth (choose one)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
# OR
NEXT_AUTH_SECRET=
KEY_VAULTS_SECRET=

# App
NEXT_PUBLIC_SERVICE_MODE=server
APP_URL=http://localhost:3010

# AI (at least one)
OPENAI_API_KEY=

# Optional
DEBANK_API_KEY=
```

---

## Appendix B: Quick Reference

### Plugin Types

| Type | Backend | Frontend | AI Summarizes |
|------|---------|----------|---------------|
| default | ✅ Required | Optional | ✅ Yes |
| markdown | ✅ Required | ❌ No | ❌ No |
| standalone | Optional | ✅ Required | Controlled |

### Function Call Flow

```
User message → AI → Function Call → Tool Router
    → Builtin? → Portal → Render
    → External? → Gateway → Plugin Server → Response → AI → Display
```

### Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrated
- [ ] Auth provider configured
- [ ] At least one AI provider configured
- [ ] Build passes (`bun run build`)
- [ ] Type check passes (`bun run type-check`)

---

*End of Document*
