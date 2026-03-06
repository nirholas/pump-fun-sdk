# SperaxOS Plugin Ecosystem Reference

> **Version:** 2.0.0  
> **Last Updated:** December 27, 2025  
> **Domain:** `plugin.delivery`

This document provides a comprehensive reference for the SperaxOS plugin ecosystem, covering architecture, protocols, model compatibility, and operational details.

---

## Table of Contents

1. [Ecosystem Overview](#1-ecosystem-overview)
2. [Plugin Delivery Domain](#2-plugin-delivery-domain)
3. [Plugin vs MCP Comparison](#3-plugin-vs-mcp-comparison)
4. [Model Tool Calling Compatibility](#4-model-tool-calling-compatibility)
5. [Plugin Gateway Architecture](#5-plugin-gateway-architecture)
6. [Security & Authentication](#6-security--authentication)
7. [Rate Limiting & Best Practices](#7-rate-limiting--best-practices)
8. [Plugin Categories & Discovery](#8-plugin-categories--discovery)

---

## 1. Ecosystem Overview

### What is the SperaxOS Plugin System?

The SperaxOS plugin system extends AI assistant capabilities through external tools and services. It enables:

- **Real-time data access** - Live prices, weather, search results
- **External API integration** - CoinGecko, DeFi protocols, databases
- **Custom functionality** - Specialized tools for specific workflows
- **Interactive experiences** - Forms, visualizations, games

### Core Philosophy

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLUGIN ECOSYSTEM LAYERS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  DISCOVERY LAYER                                           │ │
│  │  • Plugin marketplace (plugin.delivery)                    │ │
│  │  • Plugin index (public/index.json)                        │ │
│  │  • Categories, tags, search                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  MANIFEST LAYER                                            │ │
│  │  • Plugin identity (identifier, name, description)         │ │
│  │  • API definitions (endpoints, parameters, schemas)        │ │
│  │  • UI configuration (iframe URL, dimensions)               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  EXECUTION LAYER                                           │ │
│  │  • Gateway proxy (CORS, auth, routing)                     │ │
│  │  • Plugin servers (API implementations)                    │ │
│  │  • Response processing                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  INTEGRATION LAYER                                         │ │
│  │  • LLM function calling                                    │ │
│  │  • Response formatting                                     │ │
│  │  • UI rendering (iframes, markdown)                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **Plugin Index** | Registry of available plugins | `plugin.delivery/index.json` |
| **Plugin Manifests** | Individual plugin configurations | `plugin.delivery/openai/{id}/manifest.json` |
| **Plugin Gateway** | Proxy for plugin requests | `plugin.delivery/api/gateway` |
| **Plugin SDK** | Development toolkit | `@sperax/plugin-sdk` |
| **SperaxOS Client** | Consumer of plugins | SperaxOS web/desktop app |

---

## 2. Plugin Delivery Domain

### Domain Structure

The `plugin.delivery` domain hosts all SperaxOS plugin assets:

```
plugin.delivery/
├── index.json                    # Main plugin index
├── index.{locale}.json           # Localized indexes
├── api/
│   └── gateway/                  # Plugin gateway proxy
└── openai/
    ├── coingecko/
    │   ├── manifest.json         # Plugin manifest
    │   ├── openapi.json          # OpenAPI specification
    │   └── logo.webp             # Plugin logo
    ├── another-plugin/
    │   └── ...
    └── ...
```

### URL Patterns

| Resource | URL Pattern |
|----------|-------------|
| Plugin Index | `https://plugin.delivery/index.json` |
| Localized Index | `https://plugin.delivery/index.{locale}.json` |
| Plugin Manifest | `https://plugin.delivery/openai/{identifier}/manifest.json` |
| OpenAPI Spec | `https://plugin.delivery/openai/{identifier}/openapi.json` |
| Plugin Logo | `https://plugin.delivery/openai/{identifier}/logo.webp` |
| Gateway | `https://plugin.delivery/api/gateway` |

### CORS Configuration

All plugin.delivery endpoints include permissive CORS headers:

```json
{
  "headers": [
    { "key": "Access-Control-Allow-Origin", "value": "*" },
    { "key": "Access-Control-Allow-Methods", "value": "GET, POST, OPTIONS" },
    { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" }
  ]
}
```

### Deployment

Plugin.delivery is deployed via Vercel with automatic deployments from the `main` branch:

```bash
# Manual deployment
cd plugins
vercel --prod

# Or push to main for auto-deploy
git push origin main
```

---

## 3. Plugin vs MCP Comparison

SperaxOS supports two plugin systems. Here's a detailed comparison:

### Quick Comparison

| Feature | Legacy Plugins | MCP Plugins |
|---------|---------------|-------------|
| **Protocol** | HTTP/REST + OpenAPI | Model Context Protocol |
| **Standard** | Plugin manifest format | Open (Anthropic) |
| **Transport** | HTTP only | STDIO + HTTP/SSE |
| **Desktop Support** | HTTP only | Full (STDIO + HTTP) |
| **Web Support** | Full | HTTP only |
| **Local Execution** | No | Yes (STDIO) |
| **System Dependencies** | N/A | Auto-checked |
| **Development Status** | Maintenance | Active |

### When to Use Each

**Use Legacy Plugins When:**
- Building for web-first experience
- Wrapping existing REST APIs
- Need ChatGPT plugin compatibility
- Simple request/response patterns

**Use MCP Plugins When:**
- Need local file/system access
- Building desktop-first features
- Want standardized protocol
- Need resources + tools + prompts

### Architecture Comparison

**Legacy Plugin Flow:**
```
User Request → LLM → Function Call → Gateway → Plugin Server → Response → LLM → User
```

**MCP Plugin Flow:**
```
User Request → LLM → Tool Call → MCP Client → MCP Server (STDIO/HTTP) → Response → LLM → User
```

### Installation Methods

**Legacy Plugin:**
```
speraxos://plugin/install?type=plugin&manifest=https://...
```

**MCP Plugin:**
```
speraxos://plugin/install?type=mcp&id=brave-search&schema=<base64>
```

---

## 4. Function Call Mechanism & Plugin Triggering

### Overview of Plugin Triggering

The SperaxOS plugin system triggers plugins through the Function Call mechanism, enabling chatbots to interact with external APIs to enhance user experience. This section details how plugins are invoked during conversations.

### Basic Principles of Function Call

Function Call is a feature that allows developers to describe functions within LLM models (GPT, Claude, etc.), enabling the model to intelligently generate the JSON parameters required to call these functions. This mechanism extends AI capabilities by improving the reliability of connections with external tools and APIs.

### Plugin Trigger Steps

1. **User Input**: The user makes a request to SperaxOS, such as querying cryptocurrency prices or adding data
2. **Intent Recognition**: The model analyzes the user's input to determine if a plugin needs to be invoked
3. **Generate Function Call**: If plugin intervention is required, the model generates a Function Call request containing necessary parameters
4. **Send Request**: SperaxOS sends the Function Call as an API request to the designated plugin server via the gateway
5. **Process Request**: The plugin server receives the Function Call request, processes it, and prepares response data
6. **Return Response**: The plugin server returns the processed data to SperaxOS in JSON format
7. **Model Processes Plugin Response**: The model receives the plugin's response data and continues interacting with the user based on this data

### Example Process: Cryptocurrency Price Plugin

Here is a detailed process for triggering a cryptocurrency price plugin, including JSON request and response examples.

**1. User Inquiry**

```json
{
  "content": "What's the current price of Bitcoin?",
  "role": "user"
}
```

**2. Model Generates Function Call**

The model recognizes that the user wants cryptocurrency data and generates a Function Call:

```json
{
  "content": {
    "arguments": {
      "coinId": "bitcoin"
    }
  },
  "name": "getCryptocurrencyPrice",
  "role": "function"
}
```

**3. SperaxOS Sends API Request**

SperaxOS converts the Function Call into an API request to the cryptocurrency price plugin:

```http
POST /crypto-price HTTP/1.1
Host: plugin.example.com
Content-Type: application/json

{
  "coinId": "bitcoin"
}
```

**4. Plugin Processes Request and Returns Data**

The cryptocurrency plugin processes the request and returns current price data:

```json
{
  "content": {
    "data": {
      "coinId": "bitcoin",
      "price": 45000,
      "change24h": "+2.5%",
      "volume": "1.2B USD",
      "timestamp": "2025-12-27T10:00:00Z"
    }
  },
  "name": "getCryptocurrencyPrice",
  "role": "function"
}
```

**5. Model Receives Response and Interacts with User**

After receiving the plugin's response, the model interacts with the user:

```json
{
  "content": "Based on the latest data, Bitcoin (BTC) is currently trading at $45,000 USD, up 2.5% in the last 24 hours with a trading volume of $1.2B. This represents a positive market sentiment.",
  "role": "assistant"
}
```

### Real-World Plugin Examples

**Search Plugin**: When a user needs real-time information, the AI calls a web search plugin to retrieve the latest data

**Image Generation Plugin**: When a user requests image generation, the AI calls DALL-E or Midjourney plugins to create images

**DeFi Analytics Plugin**: Provides protocol TVL, yields, and positions by calling DeFi data APIs

**Portfolio Plugin**: Aggregates multi-chain wallet data for comprehensive portfolio views

### Function Call Considerations

- **Design Accuracy**: Function Call definitions must accurately reflect user intent and required parameters
- **Security**: Plugins must securely and efficiently handle requests from SperaxOS
- **Tool Calls Update**: In the latest OpenAI implementation, Function Call has been updated to `tool_calls`. SperaxOS has completed compatibility adaptation
- **Error Handling**: Plugins should return appropriate error types (see Plugin Error Types) for proper user feedback

---

## 5. Plugin Communication Protocol

---

## 4. Model Tool Calling Compatibility

### Overview

Not all LLM models handle tool/function calling equally. This section documents compatibility.

### Detailed Compatibility Matrix

#### OpenAI Models

| Model | Tool Calling | Streaming | Parallel | Quality |
|-------|-------------|-----------|----------|---------|
| GPT-4o | ✅ | ✅ | ✅ | ⭐⭐⭐ Excellent |
| GPT-4 Turbo | ✅ | ✅ | ✅ | ⭐⭐⭐ Excellent |
| GPT-4 | ✅ | ✅ | ✅ | ⭐⭐⭐ Excellent |
| GPT-3.5 Turbo | ✅ | ✅ | ✅ | ⭐⭐ Good |

**OpenAI Characteristics:**
- Consistently reliable tool calling
- Good at following complex multi-tool instructions
- Streaming works flawlessly
- Supports parallel function calls

#### Anthropic Claude Models

| Model | Tool Calling | Streaming | Parallel | Quality |
|-------|-------------|-----------|----------|---------|
| Claude 3.5 Sonnet | ✅ | ✅ | ✅ | ⭐⭐⭐ Excellent |
| Claude 3 Opus | ✅ | ✅ | ❌ | ⭐⭐ Good |
| Claude 3 Sonnet | ✅ | ✅ | ❌ | ⭐ Limited |
| Claude 3 Haiku | ✅ | ✅ | ❌ | ⭐ Limited |

**Claude Characteristics:**
- Claude 3.5 Sonnet is best for plugins
- Older models output `<thinking>` tags (degrades UX)
- May generate strings instead of arrays (schema issues)
- Sequential (not parallel) in older versions

**Known Issues:**
```json
// Expected (array)
{ "prompts": ["prompt1", "prompt2"] }

// Claude sometimes returns (string)
{ "prompts": "prompt1, prompt2" }
```

#### Google Gemini Models

| Model | Tool Calling | Streaming | Parallel | Quality |
|-------|-------------|-----------|----------|---------|
| Gemini 1.5 Pro | ✅ | ❌ | ✅ | ⚠️ Unreliable |
| Gemini 1.5 Flash | ❌ | ❌ | ❌ | ❌ Not usable |

**Gemini Characteristics:**
- ⚠️ **NOT RECOMMENDED** for plugins
- Schema compatibility issues with JSON Schema
- Does not support `minItems`, `maxItems`, `default`
- Returns incorrect function names
- Streaming not supported for tool calls

**Known Errors:**
```json
{
  "message": "[400 Bad Request] Unknown name \"maxItems\"..."
}
```

### Recommendations

| Use Case | Recommended Model |
|----------|------------------|
| Production plugins | GPT-4o, Claude 3.5 Sonnet |
| Complex multi-tool | GPT-4 Turbo |
| Cost-sensitive | GPT-3.5 Turbo |
| Avoid for plugins | Gemini (all versions) |

---

## 5. Plugin Gateway Architecture

### What is the Plugin Gateway?

The gateway is a proxy service that:
1. Routes plugin requests from SperaxOS
2. Handles CORS and authentication
3. Validates plugin manifests and parameters
4. Forwards requests to plugin servers

### Request Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  SperaxOS   │────▶│   Gateway   │────▶│   Plugin    │
│   Client    │     │  (Proxy)    │     │   Server    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │  PluginRequest    │                   │
       │  Payload          │                   │
       │──────────────────▶│                   │
       │                   │   HTTP POST       │
       │                   │──────────────────▶│
       │                   │                   │
       │                   │   JSON Response   │
       │                   │◀──────────────────│
       │  Formatted        │                   │
       │  Response         │                   │
       │◀──────────────────│                   │
```

### Request Payload Structure

```typescript
interface PluginRequestPayload {
  // Plugin identification
  identifier: string;
  
  // API to call
  apiName: string;
  
  // Function arguments
  arguments: Record<string, unknown>;
  
  // Optional manifest (if not in index)
  manifest?: PluginManifest;
  
  // Optional settings from user
  settings?: Record<string, unknown>;
}
```

### Gateway Implementation

```typescript
// Using the official gateway package
import { createSperaxChatPluginGateway } from '@sperax/chat-plugins-gateway';

export const config = {
  runtime: 'edge',
};

export default createSperaxChatPluginGateway();
```

### Gateway Processing Steps

1. **Parse Request** - Extract `PluginRequestPayload` from body
2. **Validate Plugin** - Check identifier exists in index
3. **Fetch Manifest** - Get plugin manifest if not provided
4. **Match API** - Find the API by `apiName`
5. **Validate Parameters** - Check against JSON Schema
6. **Forward Request** - POST to plugin server
7. **Process Response** - Format and return to client

### Error Handling

| Error Type | HTTP Status | Cause |
|------------|-------------|-------|
| `MethodNotAllowed` | 405 | Non-POST request |
| `PluginGatewayError` | 500 | Gateway internal error |
| `PluginApiNotFound` | 404 | API name not in manifest |
| `PluginApiParamsError` | 400 | Invalid parameters |
| `PluginServerError` | 502 | Plugin server error |

---

## 6. Security & Authentication

### Authentication Types

#### No Authentication
```json
{
  "auth": {
    "type": "none"
  }
}
```
- Public APIs (like CoinGecko free tier)
- Rate limits handled by upstream

#### Service-Level Authentication
```json
{
  "auth": {
    "type": "service_http",
    "authorization_type": "bearer"
  }
}
```
- API key stored in plugin settings
- Forwarded via Authorization header

#### OAuth 2.0
```json
{
  "auth": {
    "type": "oauth",
    "client_url": "https://example.com/oauth/authorize",
    "authorization_url": "https://example.com/oauth/token",
    "scope": "read write",
    "verification_tokens": {
      "openai": "token-from-openai"
    }
  }
}
```
- User authorization flow
- Token refresh handling

### Settings Security

User settings (like API keys) are:
1. Stored encrypted in user's browser/database
2. Sent via headers (not URL parameters)
3. Never logged by the gateway
4. Validated against schema

```typescript
// Accessing settings in plugin
import { getPluginSettingsFromRequest } from '@sperax/plugin-sdk';

const settings = getPluginSettingsFromRequest<{
  apiKey: string;
}>(req);
```

### Best Practices

1. **Never expose API keys in manifests**
2. **Use HTTPS for all endpoints**
3. **Validate all input parameters**
4. **Implement rate limiting**
5. **Log requests without sensitive data**

---

## 7. Rate Limiting & Best Practices

### Rate Limiting Guidelines

| Scenario | Recommendation |
|----------|---------------|
| Free public APIs | Respect upstream limits |
| Paid APIs | Implement your own limits |
| High-traffic plugins | Use caching |
| Development | Use mock data |

### Caching Strategies

```typescript
// Example: Simple in-memory cache
const cache = new Map<string, { data: unknown; expires: number }>();

async function getCachedData(key: string, fetcher: () => Promise<unknown>, ttl = 60000) {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  
  const data = await fetcher();
  cache.set(key, { data, expires: Date.now() + ttl });
  return data;
}
```

### Performance Best Practices

1. **Minimize Response Size**
   - Only return needed fields
   - Paginate large results
   - Compress responses

2. **Optimize LLM Processing**
   - Clear, structured responses
   - Include context the LLM needs
   - Avoid excessive data

3. **Handle Errors Gracefully**
   - Return helpful error messages
   - Include retry guidance
   - Don't expose internal errors

### Example: Optimized Response

```typescript
// ❌ Bad - Too much data
return {
  all_tokens: [...10000 tokens...],
  last_updated: timestamp,
  internal_id: uuid,
  debug_info: {...}
};

// ✅ Good - Focused, LLM-friendly
return {
  summary: "Bitcoin is $96,500 (+2.3% 24h)",
  data: {
    price_usd: 96500,
    change_24h_pct: 2.3,
    market_cap_usd: 1900000000000
  },
  source: "CoinGecko",
  updated_at: "2025-12-27T10:30:00Z"
};
```

---

## 8. Plugin Categories & Discovery

### Official Categories

| Category ID | Display Name | Description |
|-------------|--------------|-------------|
| `stocks-finance` | Stocks & Finance | Financial, crypto, trading tools |
| `web-search` | Web Search | Search engines, web crawlers |
| `tools` | Tools | Utilities, productivity |
| `media-generate` | Media Generation | Image, video, audio creation |
| `science-education` | Science & Education | Learning, research tools |
| `gaming-entertainment` | Gaming | Games, entertainment |
| `lifestyle` | Lifestyle | Travel, weather, personal |
| `social` | Social | Social media, communication |

### Discovery Flow

```
User opens Plugin Store
         │
         ▼
┌─────────────────┐
│  Fetch Index    │◀── plugin.delivery/index.json
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Display Grid   │◀── Categories, tags, search
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Clicks    │
│  Install        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Fetch Manifest  │◀── Validate plugin
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Add to Agent   │◀── Enable in settings
└─────────────────┘
```

### Tags Best Practices

When tagging your plugin:

1. **Be specific** - "crypto-prices" not just "crypto"
2. **Include key features** - "defi", "lending", "yield"
3. **Limit to 5-7 tags** - Quality over quantity
4. **Use lowercase** - "market-data" not "Market-Data"

### Plugin Visibility

Plugins appear in the store based on:
- **Recency** - Newer plugins shown first
- **Category match** - Filtered by category
- **Tag search** - Matched against query
- **Locale** - Localized metadata

---

## Appendix: Quick Reference

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `PLUGINS_INDEX_URL` | Custom plugin index URL | For custom index |
| `OPENAI_API_KEY` | For i18n translation | Build only |

### Important URLs

| Resource | URL |
|----------|-----|
| Plugin Index | `https://plugin.delivery/index.json` |
| Gateway | `https://plugin.delivery/api/gateway` |
| SDK Docs | [SDK API Reference](./SDK_API_REFERENCE.md) |
| OpenAPI Spec | `https://swagger.io/specification/` |

### File Locations (plugins repo)

```
plugins/
├── public/
│   ├── index.json              # Generated plugin index
│   └── openai/{id}/            # Plugin assets
├── src/
│   └── {plugin-id}.json        # Plugin definitions
├── locales/
│   └── {plugin-id}.{locale}.json  # Translations
├── api/
│   └── gateway/                # Gateway service
├── packages/
│   └── sdk/                    # Plugin SDK
└── templates/
    └── basic/                  # Plugin template
```

---

*For development guide, see [PLUGIN_DEVELOPMENT_GUIDE.md](./PLUGIN_DEVELOPMENT_GUIDE.md)*
*For MCP plugins, see [MCP_VS_PLUGINS.md](../SperaxOS/docs/MCP_VS_PLUGINS.md)*
