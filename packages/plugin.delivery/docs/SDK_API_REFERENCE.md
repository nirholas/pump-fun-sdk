# Plugin SDK Documentation

Complete API reference for the Plugin SDK (`@sperax/plugin-sdk`) from **nirholas/plugin.delivery**.

## Table of Contents

- [Installation](#installation)
- [Client SDK (speraxOS)](#client-sdk-speraxchat)
- [React Hooks](#react-hooks)
- [Schema Validation](#schema-validation)
- [Error Types](#error-types)
- [Server Utilities](#server-utilities)
- [Communication Channels](#communication-channels)

---

## Installation

```bash
# Install the SDK from nirholas/plugin.delivery
pnpm add @sperax/plugin-sdk

# Or with npm/yarn/bun
npm install @sperax/plugin-sdk
yarn add @sperax/plugin-sdk
bun add @sperax/plugin-sdk
```

---

## Client SDK (speraxOS)

The `speraxOS` object provides methods for plugin-to-host communication from the **nirholas/plugin.delivery** SDK. Import from the client subpath:

```typescript
import { speraxOS } from '@sperax/plugin-sdk/client';
```

### getPluginPayload

Get the Function Call initialization payload including arguments, name, settings, and state.

```typescript
interface PluginPayload<T = any> {
  arguments?: T;
  name: string;
  settings?: Record<string, any>;
  state?: Record<string, any>;
}

const payload = await speraxOS.getPluginPayload<MyArgs>();
console.log(payload.name);       // API name that was called
console.log(payload.arguments);  // Arguments passed to the function
console.log(payload.settings);   // Plugin settings from user config
```

### getPluginMessage

Retrieve the current plugin message content (the `content` field deserialized as JSON).

```typescript
const message = await speraxOS.getPluginMessage<MyMessageType>();
console.log(message);
```

### setPluginMessage

Update the plugin message content. This serializes the content and triggers conversation flow.

```typescript
await speraxOS.setPluginMessage({ 
  title: 'Result', 
  data: myData 
});
```

### getPluginState / setPluginState

Manage runtime state stored in the message.

```typescript
// Get state
const counter = await speraxOS.getPluginState<number>('counter');

// Set state
await speraxOS.setPluginState('counter', counter + 1);
```

### getPluginSettings / setPluginSettings

Manage plugin configuration stored in the host application.

```typescript
// Get all settings
const settings = await speraxOS.getPluginSettings<MySettings>();

// Update settings (partial update)
await speraxOS.setPluginSettings({ theme: 'dark' });
```

### triggerAIMessage

Trigger the AI to generate a response (for standalone plugins).

```typescript
await speraxOS.triggerAIMessage(messageId);
```

### createAssistantMessage

Create a new assistant message programmatically (for standalone plugins).

```typescript
await speraxOS.createAssistantMessage('Here is the analysis...');
```

---

## React Hooks

### useWatchPluginMessage

This is a React Hook encapsulating the Chat Plugin SDK, used to listen for plugin messages sent from SperaxOS.

**Syntax:**

```typescript
const { data, loading } = useWatchPluginMessage<T>();
```

**Return Value:**

| Property | Type | Description |
|----------|------|-------------|
| `data` | `T` | Data of the message sent by the plugin |
| `loading` | `boolean` | Indicates whether the data is currently being loaded |

**Example:**

```tsx
import { useWatchPluginMessage } from '@sperax/plugin-sdk/client';

const MyPlugin = () => {
  const { data, loading } = useWatchPluginMessage<MyDataType>();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Plugin Message Data:</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default MyPlugin;
```

**Notes:**

- Please ensure that `useWatchPluginMessage` is used within a React functional component.
- The hook automatically handles postMessage communication with the host.
- Use with `swr` or `react-query` for data caching and automatic updates.

---

### useOnStandalonePluginInit

Used to listen for the initialization of standalone type plugins. This hook is only executed once when the component is mounted.

**Syntax:**

```typescript
useOnStandalonePluginInit<T>(callback: (payload: PluginPayload<T>) => void): void;
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `callback` | `(payload: PluginPayload<T>) => void` | Callback function invoked when the plugin initialization event is triggered |

**Payload Type:**

```typescript
interface PluginPayload<T = any> {
  arguments?: T;      // Plugin initialization parameters
  name: string;       // Plugin initialization function name
  settings?: Record<string, any>;
  state?: Record<string, any>;
}
```

**Example:**

```tsx
import { useOnStandalonePluginInit } from '@sperax/plugin-sdk/client';

const StandalonePlugin = () => {
  useOnStandalonePluginInit((payload) => {
    console.log('Plugin initialization triggered');
    console.log('Function name:', payload.name);
    console.log('Arguments:', payload.arguments);
    console.log('Settings:', payload.settings);
  });

  return <div>Listening for plugin initialization</div>;
};

export default StandalonePlugin;
```

**Notes:**

- Please ensure it is used within a React functional component.
- Will only be executed once when the component is mounted.
- In the callback function, you can process the payload, such as obtaining initialization parameters or calling initialization functions.

---

### usePluginState

Used to retrieve and update the running state of the plugin. The state is persisted across re-renders.

**Syntax:**

```typescript
const [value, updateValue] = usePluginState<T>(key: string, initialValue: T);
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Unique identifier for the state |
| `initialValue` | `T` | Initial value of the state |

**Return Value:**

| Property | Type | Description |
|----------|------|-------------|
| `value` | `T` | Current value of the state |
| `updateValue` | `(value: T) => void` | Function to update the state |

**Example:**

```tsx
import { usePluginState } from '@sperax/plugin-sdk/client';

const Counter = () => {
  const [count, setCount] = usePluginState('count', 0);

  const increment = () => {
    setCount(count + 1);
  };

  return (
    <div>
      <h1>Current Count: {count}</h1>
      <button onClick={increment}>Increment</button>
    </div>
  );
};

export default Counter;
```

**Notes:**

- Ensure usage within a React function component.
- The `key` parameter must be a string used to uniquely identify the plugin state.
- The `initialValue` parameter is the initial value of the state.
- State is automatically synchronized with SperaxOS.

---

### usePluginSettings

Used to retrieve and update plugin settings with automatic synchronization.

**Syntax:**

```typescript
const [value, updateValue] = usePluginSettings<T>(initialValue: T);
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `initialValue` | `T` | Initial value of plugin settings |

**Return Value:**

Returns an array containing two elements: the current plugin settings value and the function to update plugin settings.

**Example:**

```tsx
import { usePluginSettings } from '@sperax/plugin-sdk/client';

const SettingsPanel = () => {
  const [settings, updateSettings] = usePluginSettings({ 
    theme: 'light',
    fontSize: 14 
  });

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ theme: e.target.value });
  };

  return (
    <div>
      <h1>Plugin Settings:</h1>
      <select value={settings.theme} onChange={handleThemeChange}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
};

export default SettingsPanel;
```

**Notes:**

- Please ensure to use `usePluginSettings` inside a React function component.
- Initial value `initialValue` can be of any type.
- When updating plugin settings, the SDK automatically sends update messages to SperaxOS via `postMessage`.

---

### fetchPluginMessage

A utility function for fetching plugin message data. Useful in `useEffect` or non-hook contexts.

**Syntax:**

```typescript
const data = await fetchPluginMessage<T>();
```

**Example:**

```tsx
import { fetchPluginMessage } from '@sperax/plugin-sdk/client';
import { memo, useEffect, useState } from 'react';

interface ResponseData {
  items: string[];
  timestamp: number;
}

const PluginDisplay = memo(() => {
  const [data, setData] = useState<ResponseData>();

  useEffect(() => {
    // Get the current message of the plugin from SperaxOS
    fetchPluginMessage<ResponseData>().then((response) => {
      setData(response);
    });
  }, []);

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <h1>Plugin Data</h1>
      <ul>
        {data.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
});

export default PluginDisplay;
```

**Notes:**

- The `fetchPluginMessage` method is a regular asynchronous request method.
- Can be used with `swr` or `react-query` to implement data caching and automatic updates for a better user experience.

---

## Schema Validation

The SDK provides Zod schemas for validating plugin configurations.

### pluginManifestSchema

Validate plugin manifest files.

```typescript
import { pluginManifestSchema } from '@sperax/plugin-sdk';

const manifest = {
  identifier: 'my-plugin',
  api: [{
    url: 'https://api.example.com/endpoint',
    name: 'myFunction',
    description: 'Does something useful',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' }
      },
      required: ['query']
    }
  }],
  ui: {
    url: 'https://plugin.example.com',
    height: 400
  }
};

const result = pluginManifestSchema.parse(manifest);
```

### pluginMetaSchema

Validate plugin metadata for the index.

```typescript
import { pluginMetaSchema } from '@sperax/plugin-sdk';

const meta = {
  author: 'MyCompany',
  createdAt: '2024-01-01',
  homepage: 'https://example.com',
  identifier: 'my-plugin',
  manifest: 'https://plugin.example.com/manifest.json',
  meta: {
    avatar: '🔌',
    tags: ['utility', 'search'],
    title: 'My Plugin',
    description: 'A useful plugin'
  }
};

const result = pluginMetaSchema.parse(meta);
```

### pluginApiSchema

Validate individual API definitions.

```typescript
import { pluginApiSchema } from '@sperax/plugin-sdk';

const api = {
  url: 'https://api.example.com/search',
  name: 'search',
  description: 'Search for items',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' }
    }
  }
};

const result = pluginApiSchema.parse(api);
```

---

## Error Types

Use `PluginErrorType` for standardized error responses.

```typescript
import { PluginErrorType, createErrorResponse } from '@sperax/plugin-sdk';

export default async (req: Request) => {
  // Method validation
  if (req.method !== 'POST') {
    return createErrorResponse(PluginErrorType.MethodNotAllowed);
  }

  // Settings validation
  const settings = getPluginSettingsFromRequest(req);
  if (!settings?.apiKey) {
    return createErrorResponse(PluginErrorType.PluginSettingsInvalid, {
      message: 'API key is required'
    });
  }

  // Your logic here...
};
```

### Business Errors

| Error Type | Description |
|------------|-------------|
| `PluginMarketIndexNotFound` | Plugin market index parse failed |
| `PluginMarketIndexInvalid` | Invalid plugin market index |
| `PluginMetaNotFound` | No plugin metadata found |
| `PluginMetaInvalid` | Invalid plugin metadata |
| `PluginManifestNotFound` | Plugin manifest file does not exist |
| `PluginManifestInvalid` | Invalid plugin manifest format |
| `PluginSettingsInvalid` | Invalid plugin settings |
| `PluginApiNotFound` | Plugin API does not exist |
| `PluginApiParamsError` | Plugin API parameter error |
| `PluginServerError` | Plugin server error |

### HTTP Client Errors

| Error Type | HTTP Status | Description |
|------------|-------------|-------------|
| `BadRequest` | 400 | Bad request |
| `Unauthorized` | 401 | Unauthorized |
| `Forbidden` | 403 | Forbidden |
| `ContentNotFound` | 404 | Not found |
| `MethodNotAllowed` | 405 | Method not allowed |
| `TooManyRequests` | 429 | Too many requests |

### HTTP Server Errors

| Error Type | HTTP Status | Description |
|------------|-------------|-------------|
| `InternalServerError` | 500 | Internal server error |
| `BadGateway` | 502 | Bad gateway |
| `ServiceUnavailable` | 503 | Service unavailable |
| `GatewayTimeout` | 504 | Gateway timeout |

---

## Server Utilities

### getPluginSettingsFromRequest

Extract plugin settings from the request headers.

```typescript
import { getPluginSettingsFromRequest } from '@sperax/plugin-sdk';

interface MySettings {
  apiKey: string;
  endpoint?: string;
}

export default async (req: Request) => {
  const settings = getPluginSettingsFromRequest<MySettings>(req);
  
  if (!settings?.apiKey) {
    return createErrorResponse(PluginErrorType.PluginSettingsInvalid);
  }

  // Use settings.apiKey for API calls
};
```

### createHeadersWithPluginSettings

Create headers with plugin settings (useful for testing).

```typescript
import { createHeadersWithPluginSettings } from '@sperax/plugin-sdk';

const headers = createHeadersWithPluginSettings({ apiKey: 'test-key' });
const req = new Request('https://api.example.com', { headers });
```

---

## Communication Channels

For advanced use cases, you can use the low-level `PluginChannel` constants.

```typescript
import { PluginChannel } from '@sperax/plugin-sdk';
```

### Initialization

| Channel | Literal | Description |
|---------|---------|-------------|
| `pluginReadyForRender` | `speraxos:plugin-ready-for-render` | Plugin is ready for rendering |
| `initStandalonePlugin` | `speraxos:init-standalone-plugin` | Initialize standalone plugin |

### Messages

| Channel | Literal | Description |
|---------|---------|-------------|
| `fetchPluginMessage` | `speraxos:fetch-plugin-message` | Request message content |
| `renderPlugin` | `speraxos:render-plugin` | Render plugin instruction |
| `fillStandalonePluginContent` | `speraxos:fill-plugin-content` | Fill standalone plugin content |

### State

| Channel | Literal | Description |
|---------|---------|-------------|
| `fetchPluginState` | `speraxos:fetch-plugin-state` | Request plugin state |
| `renderPluginState` | `speraxos:render-plugin-state` | Render plugin state |
| `updatePluginState` | `speraxos:update-plugin-state` | Update plugin state |

### Settings

| Channel | Literal | Description |
|---------|---------|-------------|
| `fetchPluginSettings` | `speraxos:fetch-plugin-settings` | Request plugin settings |
| `renderPluginSettings` | `speraxos:render-plugin-settings` | Render plugin settings |
| `updatePluginSettings` | `speraxos:update-plugin-settings` | Update plugin settings |

---

## TypeScript Support

The SDK is fully typed. Import types as needed:

```typescript
import type {
  PluginManifest,
  PluginMeta,
  PluginApi,
  PluginPayload,
  PluginErrorType,
} from '@sperax/plugin-sdk';
```

---

## Next Steps

- [Plugin Manifest Reference](./PLUGIN_MANIFEST.md) - Complete manifest schema
- [Plugin Types Guide](./PLUGIN_TYPES.md) - Choose the right plugin type
- [Quick Start](./QUICK_START.md) - Build your first plugin
