# Plugin Communication Guide

This guide explains how plugins communicate with the host application using the postMessage API and the SDK abstractions.

## Table of Contents

- [Overview](#overview)
- [Communication Architecture](#communication-architecture)
- [Server Communication](#server-communication)
- [Frontend Communication](#frontend-communication)
- [Standalone Plugin Communication](#standalone-plugin-communication)
- [Message Channels](#message-channels)
- [Best Practices](#best-practices)

---

## Overview

Plugin communication happens at two levels:

1. **Server Communication**: HTTP requests between the gateway and plugin server
2. **Frontend Communication**: postMessage API between host iframe and plugin UI

```
┌─────────────────────────────────────────────────────────────────┐
│                     Host Application                             │
│                                                                  │
│  ┌──────────────┐         ┌──────────────────────────────────┐  │
│  │   AI/Chat    │         │         Plugin iframe             │  │
│  │   Engine     │         │  ┌──────────────────────────────┐ │  │
│  │              │         │  │      Plugin Frontend         │ │  │
│  │              │◄───────►│  │                              │ │  │
│  │              │ postMsg │  │  Uses: speraxOS.* methods    │ │  │
│  └──────────────┘         │  └──────────────────────────────┘ │  │
│         │                 └──────────────────────────────────┘  │
│         │                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │ HTTP
          ▼
┌─────────────────────┐
│   Plugin Gateway    │
│                     │
└──────────┬──────────┘
           │ HTTP
           ▼
┌─────────────────────┐
│   Plugin Server     │
│                     │
└─────────────────────┘
```

---

## Communication Architecture

### Request Flow

1. **User sends message** → AI processes
2. **AI decides to call plugin** → Generates Function Call
3. **Host sends request to gateway** → PluginRequestPayload
4. **Gateway forwards to plugin server** → HTTP POST with arguments
5. **Plugin server processes** → Returns JSON response
6. **Gateway returns to host** → Response passed to AI
7. **AI summarizes** → User sees result

### Response Flow for UI Plugins

1. **Server response received** → Stored as message content
2. **Plugin iframe loads** → Calls `speraxOS.getPluginMessage()`
3. **Host sends message data** → Via postMessage
4. **Plugin renders UI** → Displays data to user

---

## Function Call Integration with LLMs

### How Plugins Become Function Calls

The `description` and `parameters` fields of each API interface in the manifest are sent to the AI model as the `functions` (or `tools`) parameter in a Function Call request. This is how the AI knows what plugins are available and how to call them.

### Raw Request Format to LLM

Here's an example of how plugin definitions are sent to the AI:

```json
{
  "model": "gpt-4",
  "functions": [
    {
      "name": "getCurrentWeather",
      "description": "Get the current weather condition for a city",
      "parameters": {
        "type": "object",
        "properties": {
          "city": {
            "description": "City name",
            "type": "string"
          },
          "units": {
            "description": "Temperature units: celsius or fahrenheit",
            "type": "string",
            "enum": ["celsius", "fahrenheit"]
          }
        },
        "required": ["city"]
      }
    },
    {
      "name": "recommendClothes",
      "description": "Recommend clothes based on the user's mood",
      "parameters": {
        "type": "object",
        "properties": {
          "mood": {
            "description": "Current mood: happy, sad, anger, fear, surprise, disgust",
            "type": "string",
            "enum": ["happy", "sad", "anger", "fear", "surprise", "disgust"]
          },
          "gender": {
            "type": "string",
            "enum": ["man", "woman"],
            "description": "User's gender, this information needs to be obtained from the user"
          }
        },
        "required": ["mood", "gender"]
      }
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": "What should I wear tomorrow?"
    },
    {
      "role": "assistant",
      "content": "I'd be happy to help you choose what to wear! Could you tell me which city you're in and how you're feeling today?"
    },
    {
      "role": "user",
      "content": "I'm in Tokyo and feeling happy"
    }
  ]
}
```

### AI's Function Call Response

When the AI decides to call a function, it returns:

```json
{
  "role": "assistant",
  "content": null,
  "function_call": {
    "name": "recommendClothes",
    "arguments": "{\"mood\":\"happy\",\"gender\":\"woman\"}"
  }
}
```

Or with the newer `tool_calls` format (OpenAI):

```json
{
  "role": "assistant",
  "content": null,
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "recommendClothes",
        "arguments": "{\"mood\":\"happy\",\"gender\":\"woman\"}"
      }
    }
  ]
}
```

### Plugin Response Back to AI

After the plugin server processes the request and returns data, it's sent back to the AI as a function response:

```json
{
  "role": "function",
  "name": "recommendClothes",
  "content": "{\"clothes\":[{\"name\":\"Bright summer dress\",\"color\":\"yellow\"},{\"name\":\"Light cardigan\",\"color\":\"white\"}],\"mood\":\"happy\"}"
}
```

### Final AI Response to User

The AI processes the function response and generates a natural language reply:

```json
{
  "role": "assistant",
  "content": "Since you're feeling happy, I recommend wearing a bright summer dress in yellow paired with a light white cardigan. The cheerful colors will match your mood perfectly!"
}
```

### Importance of Good Descriptions

The `description` field is **critical** because:

1. **Function Selection** - AI uses it to decide WHEN to call your function
2. **Parameter Understanding** - AI uses property descriptions to know WHAT to pass
3. **User Intent Matching** - Vague descriptions lead to missed function calls

**Good description:**
```json
{
  "description": "Get real-time cryptocurrency price in USD. Use when user asks about crypto prices, token values, or coin costs.",
  "parameters": {
    "properties": {
      "coin": {
        "description": "The cryptocurrency ID (e.g., 'bitcoin', 'ethereum', 'solana'). Use CoinGecko IDs.",
        "type": "string"
      }
    }
  }
}
```

**Bad description:**
```json
{
  "description": "Get price",
  "parameters": {
    "properties": {
      "coin": {
        "type": "string"
      }
    }
  }
}
```

---

## Server Communication

### Request Format

The gateway sends POST requests to your plugin API:

```http
POST /api/your-endpoint HTTP/1.1
Content-Type: application/json
Sperax-Plugin-Settings: {"apiKey": "user-configured-key"}

{
  "param1": "value1",
  "param2": "value2"
}
```

### Handling Requests

```typescript
import { 
  PluginErrorType, 
  createErrorResponse,
  getPluginSettingsFromRequest 
} from '@sperax/plugin-sdk';

interface MySettings {
  apiKey: string;
}

interface RequestBody {
  query: string;
}

export default async (req: Request) => {
  // 1. Validate method
  if (req.method !== 'POST') {
    return createErrorResponse(PluginErrorType.MethodNotAllowed);
  }

  // 2. Get settings from headers
  const settings = getPluginSettingsFromRequest<MySettings>(req);
  if (!settings?.apiKey) {
    return createErrorResponse(PluginErrorType.PluginSettingsInvalid, {
      message: 'API key required'
    });
  }

  // 3. Parse request body
  const body = (await req.json()) as RequestBody;

  // 4. Process and return
  const result = await processQuery(body.query, settings.apiKey);
  
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
};
```

### Response Format

Return JSON that the AI can understand:

```typescript
// Good: Structured data
return new Response(JSON.stringify({
  success: true,
  data: {
    price: 45000,
    change: "+2.5%",
    volume: "1.2B"
  }
}));

// For Markdown plugins: Plain text
return new Response(`
## Bitcoin Price

- **Current**: $45,000
- **Change**: +2.5%
- **Volume**: $1.2B
`);
```

---

## Frontend Communication

Frontend communication uses the `postMessage` API, abstracted by the SDK.

### Getting Plugin Data

When your plugin UI loads, retrieve the message data:

```tsx
import { speraxOS } from '@sperax/plugin-sdk/client';
import { useEffect, useState } from 'react';

function PluginUI() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    speraxOS.getPluginMessage()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  
  return <div>{JSON.stringify(data)}</div>;
}
```

### Using React Hooks

The SDK provides hooks for easier state management:

```tsx
import { useWatchPluginMessage } from '@sperax/plugin-sdk/client';

function PluginUI() {
  const { data, loading } = useWatchPluginMessage<MyDataType>();

  if (loading) return <div>Loading...</div>;
  
  return <div>{data.title}</div>;
}
```

### Getting Initialization Payload

Access the original Function Call arguments:

```tsx
import { speraxOS } from '@sperax/plugin-sdk/client';

async function init() {
  const payload = await speraxOS.getPluginPayload();
  
  console.log(payload.name);       // Function name called
  console.log(payload.arguments);  // Arguments passed
  console.log(payload.settings);   // Plugin settings
  console.log(payload.state);      // Persisted state
}
```

---

## Standalone Plugin Communication

Standalone plugins have full control over the communication flow.

### Initialization

```tsx
import { useOnStandalonePluginInit } from '@sperax/plugin-sdk/client';

function StandalonePlugin() {
  useOnStandalonePluginInit((payload) => {
    // Plugin is ready
    console.log('Initialized with:', payload);
  });

  return <div>My Standalone Plugin</div>;
}
```

### Managing State

State persists across re-renders:

```tsx
import { usePluginState } from '@sperax/plugin-sdk/client';

function Counter() {
  const [count, setCount] = usePluginState('count', 0);

  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
}
```

### Updating Message Content

Send data back to be stored in the message:

```tsx
import { speraxOS } from '@sperax/plugin-sdk/client';

async function saveResult(data) {
  await speraxOS.setPluginMessage(data);
}
```

### Triggering AI Response

Make the AI respond based on plugin output:

```tsx
import { speraxOS } from '@sperax/plugin-sdk/client';

async function askAI() {
  // First update the message content
  await speraxOS.setPluginMessage({
    result: 'User completed the form',
    data: { name: 'Alice', age: 25 }
  });

  // Then trigger AI to process it
  await speraxOS.triggerAIMessage();
}
```

### Creating Assistant Messages

Directly create an assistant response:

```tsx
import { speraxOS } from '@sperax/plugin-sdk/client';

async function sendMessage() {
  await speraxOS.createAssistantMessage(
    'Based on my analysis, here are the results...'
  );
}
```

---

## Message Channels

For advanced use cases, here are the raw postMessage channels:

### Initialization Channels

| Channel | Direction | Description |
|---------|-----------|-------------|
| `speraxos:plugin-ready-for-render` | Plugin → Host | Plugin is ready |
| `speraxos:init-standalone-plugin` | Plugin → Host | Standalone initialized |
| `speraxos:render-plugin` | Host → Plugin | Send render data |

### Message Channels

| Channel | Direction | Description |
|---------|-----------|-------------|
| `speraxos:fetch-plugin-message` | Plugin → Host | Request message |
| `speraxos:fill-plugin-content` | Plugin → Host | Update message |

### State Channels

| Channel | Direction | Description |
|---------|-----------|-------------|
| `speraxos:fetch-plugin-state` | Plugin → Host | Request state |
| `speraxos:render-plugin-state` | Host → Plugin | Send state |
| `speraxos:update-plugin-state` | Plugin → Host | Update state |

### Settings Channels

| Channel | Direction | Description |
|---------|-----------|-------------|
| `speraxos:fetch-plugin-settings` | Plugin → Host | Request settings |
| `speraxos:render-plugin-settings` | Host → Plugin | Send settings |
| `speraxos:update-plugin-settings` | Plugin → Host | Update settings |

### Example: Raw postMessage

```typescript
// Usually you don't need this - use the SDK instead
window.parent.postMessage(
  {
    type: 'speraxos:plugin-ready-for-render',
  },
  '*'
);

window.addEventListener('message', (event) => {
  if (event.data.type === 'speraxos:render-plugin') {
    const pluginData = event.data.payload;
    // Handle the data
  }
});
```

---

## Best Practices

### Performance

- **Cache plugin manifests** client-side
- **Debounce frequent plugin calls** to avoid rate limiting
- **Use background workers** for heavy processing
- **Minimize postMessage frequency** for UI updates

### Security

- **Validate all settings** on the server side
- **Sanitize user inputs** before processing
- **Use HTTPS** for all plugin servers
- **Implement rate limiting** to prevent abuse
- **Never expose API keys** in client code

### Error Handling

- **Return specific error types** for better UX
- **Log errors** for debugging
- **Provide user-friendly messages** in error responses
- **Handle network failures** gracefully

### UX Considerations

- **Show loading states** during plugin calls
- **Provide fallbacks** when plugins fail
- **Keep UI responsive** in standalone plugins
- **Support dark/light themes** when possible

---

## Plugin Gateway Communication

### Gateway Processing Flow

The gateway serves as middleware between SperaxOS and plugin servers, ensuring secure and flexible communication.

**Request Initialization**: SperaxOS sends a request to the Gateway via HTTP POST, carrying a `PluginRequestPayload` containing:
- Plugin identifier
- API name
- Parameters
- User settings (encrypted in headers)

**Gateway Processing Steps**:
1. Parse the `PluginRequestPayload` from request body
2. Validate parameters against manifest schema
3. Retrieve plugin manifest if not provided
4. Add user settings to request headers
5. Route request to appropriate plugin server
6. Return response to SperaxOS

**Parameter Validation**: The Gateway validates parameters based on the API parameter pattern defined in the plugin manifest to ensure validity and security.

**Setting Handling**: The Gateway adds the plugin's requested settings to the `Sperax-Plugin-Settings` header, allowing the plugin to retrieve settings like API keys.

**OpenAPI Support**: If the plugin manifest specifies an OpenAPI manifest, the Gateway utilizes SwaggerClient to interact with third-party services.

### Gateway Error Types

Error handling in server communication is crucial. The Gateway defines various error types:

| Error Type | Description | HTTP Status |
|------------|-------------|-------------|
| `MethodNotAllowed` | Unsupported request method | 405 |
| `PluginGatewayError` | Gateway internal error | 502 |
| `PluginServerError` | Plugin server error | 500 |
| `PluginSettingsInvalid` | Invalid or missing settings | 400 |
| `PluginMarketIndexNotFound` | Plugin not found in market | 404 |

For detailed error types, see the [Plugin Error Types](#plugin-error-types) section.

---

## Frontend Communication Protocol

### Communication via postMessage API

The frontend communication between SperaxOS and plugins is based on the HTML5 `window.postMessage` API, which allows secure communication between pages from different origins.

### Frontend Communication Flow

**1. Initialization of Communication**

When the plugin is loaded and ready to interact with SperaxOS, it uses the `speraxOS.getPluginPayload()` method to obtain initialization data:

```typescript
import { speraxOS } from '@sperax/plugin-sdk/client';

// Plugin waits for initialization
const payload = await speraxOS.getPluginPayload();
console.log('Plugin initialized:', payload);
```

Behind the scenes, the plugin listens for the `message` event, waiting for the initialization message from SperaxOS.

**2. Receiving Plugin Payload**

The plugin receives initialization data including:
- Plugin parameters (function arguments)
- Plugin name
- User settings
- Plugin state

```typescript
interface PluginPayload<T = any> {
  arguments?: T;
  name: string;
  settings?: Record<string, any>;
  state?: Record<string, any>;
}
```

**3. Retrieving and Updating Information**

The plugin can call various methods to interact with the host:

```typescript
// Get current message content
const message = await speraxOS.getPluginMessage();

// Update message content (triggers re-render)
await speraxOS.setPluginMessage({ 
  title: 'Updated Result', 
  data: newData 
});

// Get/set plugin state
const counter = await speraxOS.getPluginState<number>('counter');
await speraxOS.setPluginState('counter', counter + 1);

// Get/set user settings
const settings = await speraxOS.getPluginSettings();
await speraxOS.setPluginSettings({ theme: 'dark' });
```

**4. Custom Trigger Actions (Standalone Plugins)**

For standalone plugins, custom control of AI message triggering is available:

```typescript
// Trigger AI to process a message
await speraxOS.triggerAIMessage(messageId);

// Create new assistant message
await speraxOS.createAssistantMessage('Custom content');
```

### Communication Summary

Communication between SperaxOS and plugins is achieved through asynchronous message exchange using the postMessage API. The plugin can:
- Request data from the host
- Receive initialization data
- Update its own state
- Trigger AI messages
- Create new messages

The SperaxOS host is responsible for responding to these requests and providing the required data. This mechanism allows plugins to operate independently while effectively communicating with the host application.

The SDK's `speraxOS` methods abstract communication details, enabling plugins to interact using a concise API.

---

## Plugin Settings Management

### Overview

Plugins can define custom settings that users configure before use. Common examples include API keys, endpoints, or preferences.

### Defining Settings in Manifest

Add a `settings` field in your `manifest.json`:

```json
{
  "identifier": "my-plugin",
  "settings": {
    "type": "object",
    "required": ["apiKey"],
    "properties": {
      "apiKey": {
        "title": "API Key",
        "description": "Your service API key [Learn more](https://docs.example.com)",
        "type": "string",
        "minLength": 32,
        "maxLength": 64,
        "format": "password"
      },
      "endpoint": {
        "title": "API Endpoint",
        "description": "Custom API endpoint (optional)",
        "type": "string",
        "format": "uri",
        "default": "https://api.example.com"
      }
    }
  }
}
```

### How Settings Appear to Users

When users enable your plugin, SperaxOS will:
1. Display a settings form based on your schema
2. Show input fields with appropriate types (text, password, number, etc.)
3. Validate inputs according to your constraints
4. Store settings securely per-user

### Accessing Settings in Your Plugin

**Server-Side (Plugin API):**

```typescript
import { 
  getPluginSettingsFromRequest,
  createErrorResponse,
  PluginErrorType
} from '@sperax/plugin-sdk';

interface MySettings {
  apiKey: string;
  endpoint?: string;
}

export default async (req: Request) => {
  // Retrieve settings from headers
  const settings = getPluginSettingsFromRequest<MySettings>(req);
  
  if (!settings?.apiKey) {
    // Trigger settings configuration UI
    return createErrorResponse(PluginErrorType.PluginSettingsInvalid, {
      message: 'API key is required. Please configure in plugin settings.'
    });
  }
  
  const endpoint = settings.endpoint || 'https://api.example.com';
  // Use settings...
  const result = await callAPI(endpoint, settings.apiKey);
  
  return new Response(JSON.stringify(result));
};
```

**Client-Side (Standalone Plugin UI):**

```typescript
import { speraxOS } from '@sperax/plugin-sdk/client';

// Get settings
const settings = await speraxOS.getPluginSettings<MySettings>();
console.log('API Key:', settings.apiKey);

// Update settings (if needed)
await speraxOS.setPluginSettings({ 
  endpoint: 'https://custom-api.example.com' 
});
```

### Settings Best Practices

1. **Required vs Optional**: Only mark truly essential fields as `required`
2. **Sensible Defaults**: Provide defaults for optional settings
3. **Clear Descriptions**: Include links to documentation
4. **Validation**: Use JSON Schema constraints (min/max length, format, pattern)
5. **Security**: Use `"format": "password"` for sensitive fields
6. **Error Messages**: Return `PluginSettingsInvalid` with helpful messages when settings are missing or invalid

---

## Message Channels

### Available Communication Channels

| Method | Direction | Use Case |
|--------|-----------|----------|
| `getPluginPayload()` | Host → Plugin | Initial data load |
| `getPluginMessage()` | Host → Plugin | Retrieve message content |
| `setPluginMessage()` | Plugin → Host | Update message content |
| `getPluginState()` | Host → Plugin | Retrieve state value |
| `setPluginState()` | Plugin → Host | Update state value |
| `getPluginSettings()` | Host → Plugin | Retrieve user settings |
| `setPluginSettings()` | Plugin → Host | Update user settings |
| `triggerAIMessage()` | Plugin → Host | Trigger AI processing |
| `createAssistantMessage()` | Plugin → Host | Create new message |

### Channel Usage Examples

See the [SDK API Reference](./SDK_API_REFERENCE.md) for detailed documentation of each method.

---

## Best Practices

### 1. Always Handle Loading States

```tsx
const { data, loading } = useWatchPluginMessage();

if (loading) {
  return <Skeleton />;
}
```

### 2. Validate Data

```typescript
const data = await speraxOS.getPluginMessage<MyType>();
if (!data || !data.requiredField) {
  return <Error message="Invalid data" />;
}
```

### 3. Handle Errors Gracefully

```typescript
try {
  const payload = await speraxOS.getPluginPayload();
} catch (error) {
  console.error('Failed to get payload:', error);
  // Show fallback UI
}
```

### 4. Use TypeScript Generics

```typescript
interface WeatherData {
  temperature: number;
  condition: string;
}

const { data } = useWatchPluginMessage<WeatherData>();
// data is typed as WeatherData | undefined
```

### 5. Debounce State Updates

```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedUpdate = useDebouncedCallback(
  (value) => speraxOS.setPluginState('key', value),
  300
);
```

### 6. Clean Up Listeners

If using raw event listeners:

```typescript
useEffect(() => {
  const handler = (event) => { /* ... */ };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, []);
```

---

## Plugin Gateway Implementation

### Overview

The Plugin Gateway is an intermediary layer that:

- **Routes requests** from the host to plugin servers
- **Handles cross-origin** issues (CORS)
- **Validates requests** and parameters
- **Forwards settings** to plugin servers
- **Aggregates responses** back to the host

### Local Development Setup

For local development, specify a gateway in your manifest:

```json
{
  "identifier": "my-plugin",
  "gateway": "http://localhost:3400/api/gateway",
  "api": [...]
}
```

### Creating Gateway Routes

Install the gateway package:

```bash
pnpm add @sperax/chat-plugins-gateway
```

#### Next.js (Edge Runtime)

Create `pages/api/gateway.ts`:

```typescript
import { createSperaxChatPluginGateway } from '@sperax/chat-plugins-gateway';

export const config = {
  runtime: 'edge',
};

export default createSperaxChatPluginGateway();
```

#### Next.js App Router

Create `app/api/gateway/route.ts`:

```typescript
import { createSperaxChatPluginGateway } from '@sperax/chat-plugins-gateway';

export const runtime = 'edge';

const handler = createSperaxChatPluginGateway();

export { handler as GET, handler as POST };
```

#### Vercel Serverless (Node.js)

Create `api/gateway.ts`:

```typescript
import { createGatewayOnNodeRuntime } from '@sperax/chat-plugins-gateway';

export default createGatewayOnNodeRuntime();
```

### Production Deployment

For production, **omit the gateway field** from your manifest:

```json
{
  "identifier": "my-plugin",
  "api": [
    {
      "url": "https://my-plugin.vercel.app/api/weather",
      ...
    }
  ]
}
```

The host application uses its cloud gateway automatically.

### Gateway Troubleshooting

#### CORS Errors

Ensure your gateway returns proper CORS headers:

```typescript
return new Response(data, {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, SperaxOS-Plugin-Settings',
  },
});
```

#### Gateway Not Receiving Requests

**Checklist:**
1. ✅ `gateway` field in manifest matches your server URL
2. ✅ Server is running on the correct port
3. ✅ No firewall blocking the port
4. ✅ Using HTTP (not HTTPS) for localhost

#### Plugin Settings Not Available

Check if header exists:

```typescript
const settingsHeader = req.headers.get('SperaxOS-Plugin-Settings');
console.log('Settings header:', settingsHeader);
```

---

## Next Steps

- [SDK API Reference](./SDK_API_REFERENCE.md) - Full SDK documentation
- [Plugin Types Guide](./PLUGIN_TYPES.md) - Choose the right type
- [Standalone Plugin Communication](#standalone-plugin-communication) - Advanced patterns
