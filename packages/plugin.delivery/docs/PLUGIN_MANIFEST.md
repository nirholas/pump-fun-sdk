# Plugin Manifest Reference

The Plugin Manifest (`manifest.json`) is the configuration file that describes your plugin to the host application. This document covers every field in detail.

## Table of Contents

- [Overview](#overview)
- [Complete Schema](#complete-schema)
- [Field Reference](#field-reference)
- [Examples](#examples)
- [JSON Schema Integration](#json-schema-integration)

---

## Overview

The manifest file serves as the "identity card" of your plugin:

- **Identifies** the plugin with a unique identifier
- **Configures metadata** like title, description, tags, and avatar
- **Defines API interfaces** that the AI can call
- **Specifies UI display** settings for iframe rendering
- **Sets authentication** requirements via settings schema

---

## Complete Schema

```typescript
interface PluginManifest {
  // Required
  identifier: string;
  
  // API Definition (choose one)
  api?: PluginApi[];           // Manual API definition
  openapi?: string;            // OpenAPI spec URL
  
  // Optional
  author?: string;
  createdAt?: string;
  gateway?: string;
  homepage?: string;
  meta?: PluginMeta;
  settings?: JSONSchema;
  systemRole?: string;
  type?: 'default' | 'markdown' | 'standalone';
  ui?: PluginUI;
  version?: string;
}

interface PluginApi {
  url: string;
  name: string;
  description: string;
  parameters: JSONSchema;
}

interface PluginMeta {
  avatar?: string;
  description?: string;
  tags?: string[];
  title?: string;
}

interface PluginUI {
  url: string;
  height?: number;
  width?: number;
  mode?: 'iframe' | 'module';
}
```

---

## Field Reference

### identifier (required)

Unique identifier for the plugin. Must be globally unique across all plugins.

```json
{
  "identifier": "weather-forecast"
}
```

**Rules:**
- Use lowercase letters, numbers, and hyphens only
- Must be unique in the plugin marketplace
- Cannot be changed after publication

---

### api

Array of API endpoints that the AI can call. Each API is exposed as a Function Call.

```json
{
  "api": [
    {
      "url": "https://api.example.com/weather",
      "name": "getWeather",
      "description": "Get current weather for a city",
      "parameters": {
        "type": "object",
        "properties": {
          "city": {
            "type": "string",
            "description": "City name"
          },
          "units": {
            "type": "string",
            "enum": ["celsius", "fahrenheit"],
            "description": "Temperature units"
          }
        },
        "required": ["city"]
      }
    }
  ]
}
```

**API Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Endpoint URL |
| `name` | string | Yes | Function name (used in Function Call) |
| `description` | string | Yes | Description for the AI to understand when to use |
| `parameters` | JSONSchema | Yes | Parameter schema following JSON Schema spec |

**Parameters Schema:**
- Must have `type: "object"` at the root
- Use `properties` to define each parameter
- Use `required` array to mark mandatory parameters
- Use `description` for each property to help AI understand

---

### openapi

URL to an OpenAPI specification file. Alternative to manual `api` definition.

```json
{
  "openapi": "https://api.example.com/openapi.json"
}
```

**Supported formats:** JSON or YAML

When using `openapi`, the `api` array can be empty or omitted.

---

### gateway

Gateway URL for routing requests. Required for local development.

```json
{
  "gateway": "http://localhost:3400/api/gateway"
}
```

**When to use:**
- **Local development:** Always specify to route requests through your local gateway
- **Production:** Omit to use the default cloud gateway

---

### ui

UI configuration for rendering the plugin interface in an iframe.

```json
{
  "ui": {
    "url": "https://plugin.example.com",
    "height": 400,
    "width": 600,
    "mode": "iframe"
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | string | - | URL to load in iframe |
| `height` | number | 300 | Height in pixels |
| `width` | number | - | Width in pixels (optional) |
| `mode` | string | `iframe` | Rendering mode |

**Note:** UI is optional. Plugins can be backend-only without any visual interface.

---

### type

Plugin type determines behavior and AI interaction.

```json
{
  "type": "default"
}
```

| Type | Description |
|------|-------------|
| `default` | Standard plugin - AI summarizes response (default) |
| `markdown` | Returns Markdown directly, no AI summarization |
| `standalone` | Full control over interaction, custom AI triggers |

See [Plugin Types Guide](./PLUGIN_TYPES.md) for detailed comparison.

---

### settings

JSON Schema for plugin settings. Creates a configuration UI for users.

```json
{
  "settings": {
    "type": "object",
    "required": ["apiKey"],
    "properties": {
      "apiKey": {
        "title": "API Key",
        "description": "Your API key from the service",
        "type": "string",
        "format": "password",
        "minLength": 32
      },
      "region": {
        "title": "Region",
        "type": "string",
        "enum": ["us", "eu", "asia"],
        "default": "us"
      }
    }
  }
}
```

**Supported field types:**
- `string` - Text input (use `format: "password"` for secrets)
- `number` / `integer` - Numeric input
- `boolean` - Toggle switch
- `enum` - Dropdown selector

---

### meta

Metadata for marketplace display.

```json
{
  "meta": {
    "avatar": "🌤️",
    "title": "Weather Forecast",
    "description": "Get real-time weather information for any city",
    "tags": ["weather", "forecast", "utility"]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `avatar` | string | Emoji or URL to image |
| `title` | string | Display name |
| `description` | string | Brief description |
| `tags` | string[] | Categorization tags |

---

### systemRole

System prompt addition when plugin is active.

```json
{
  "systemRole": "You have access to real-time weather data. When users ask about weather, use the getWeather function."
}
```

---

### author

Plugin author name or organization.

```json
{
  "author": "Sperax"
}
```

---

### homepage

URL to plugin homepage or documentation.

```json
{
  "homepage": "https://github.com/sperax/weather-plugin"
}
```

---

### version

Plugin version string.

```json
{
  "version": "1.0.0"
}
```

---

## Examples

### Minimal Plugin (Backend Only)

```json
{
  "identifier": "simple-calculator",
  "api": [
    {
      "url": "https://api.example.com/calculate",
      "name": "calculate",
      "description": "Perform mathematical calculations",
      "parameters": {
        "type": "object",
        "properties": {
          "expression": {
            "type": "string",
            "description": "Mathematical expression to evaluate"
          }
        },
        "required": ["expression"]
      }
    }
  ]
}
```

### Plugin with UI

```json
{
  "identifier": "chart-generator",
  "api": [
    {
      "url": "https://api.example.com/chart",
      "name": "generateChart",
      "description": "Generate a chart from data",
      "parameters": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "enum": ["bar", "line", "pie"]
          },
          "data": {
            "type": "array",
            "items": { "type": "number" }
          }
        },
        "required": ["type", "data"]
      }
    }
  ],
  "ui": {
    "url": "https://plugin.example.com/chart",
    "height": 400
  }
}
```

### OpenAPI Plugin

```json
{
  "identifier": "coingecko",
  "author": "CoinGecko",
  "homepage": "https://www.coingecko.com",
  "openapi": "https://plugin.delivery/openapi/coingecko.json",
  "meta": {
    "avatar": "https://plugin.delivery/logo/coingecko.png",
    "title": "CoinGecko Crypto Data",
    "description": "Real-time cryptocurrency prices and market data",
    "tags": ["crypto", "prices", "defi"]
  }
}
```

### Plugin with Settings

```json
{
  "identifier": "private-api",
  "api": [...],
  "settings": {
    "type": "object",
    "required": ["apiKey"],
    "properties": {
      "apiKey": {
        "title": "API Key",
        "type": "string",
        "format": "password",
        "description": "Your private API key"
      }
    }
  }
}
```

### Markdown Plugin

```json
{
  "identifier": "time-display",
  "type": "markdown",
  "api": [
    {
      "url": "https://api.example.com/time",
      "name": "getCurrentTime",
      "description": "Get current time",
      "parameters": {
        "type": "object",
        "properties": {
          "timezone": { "type": "string" }
        }
      }
    }
  ]
}
```

### Standalone Plugin

```json
{
  "identifier": "interactive-clock",
  "type": "standalone",
  "ui": {
    "url": "https://plugin.example.com/clock",
    "height": 300
  },
  "meta": {
    "avatar": "🕐",
    "title": "Interactive Clock",
    "description": "A fully interactive clock widget"
  }
}
```

---

## JSON Schema Integration

The SDK provides a JSON Schema definition for the manifest, which provides type information and intelligent hints for IDEs when writing the `manifest.json` file.

### Using $schema for IDE Autocompletion

When using the schema, you only need to declare the `$schema` field in the JSON configuration file to point to the schema definition file. This enables:

- **Autocompletion** - IDE suggests available fields as you type
- **Type Hints** - See expected types for each field
- **Validation** - Immediate error highlighting for invalid values
- **Documentation** - Hover to see field descriptions

### Configuration Examples

**Using local node_modules (recommended for development):**

With a project structure like:

```plaintext
my-plugin/
├── node_modules/
│   └── @sperax/plugin-sdk/
│       └── schema.json
├── public/
│   ├── manifest.json
│   └── manifest-dev.json
├── src/
└── package.json
```

Configure `manifest.json` with a relative path:

```json
{
  "$schema": "../node_modules/@sperax/plugin-sdk/schema.json",
  "identifier": "my-plugin",
  "api": [
    {
      "url": "http://localhost:3400/api/endpoint",
      "name": "myFunction",
      "description": "Description of the function",
      "parameters": {
        "type": "object",
        "properties": {
          "param1": { "type": "string" }
        }
      }
    }
  ],
  "gateway": "http://localhost:3400/api/gateway",
  "ui": {
    "url": "http://localhost:3400",
    "height": 200
  },
  "version": "1"
}
```

**Using CDN version (for production or quick setup):**

```json
{
  "$schema": "https://unpkg.com/@sperax/plugin-sdk/schema.json",
  "identifier": "my-plugin",
  ...
}
```

**Using plugin.delivery hosted schema:**

```json
{
  "$schema": "https://plugin.delivery/schema.json",
  "identifier": "my-plugin",
  ...
}
```

### VS Code Configuration

For enhanced JSON editing in VS Code, add to your `.vscode/settings.json`:

```json
{
  "json.schemas": [
    {
      "fileMatch": ["**/manifest.json", "**/manifest-*.json"],
      "url": "./node_modules/@sperax/plugin-sdk/schema.json"
    }
  ]
}
```

---

## Validation

Validate manifests programmatically:

```typescript
import { pluginManifestSchema } from '@sperax/plugin-sdk';

const manifest = require('./manifest.json');

try {
  pluginManifestSchema.parse(manifest);
  console.log('Valid manifest!');
} catch (error) {
  console.error('Invalid manifest:', error.errors);
}
```

---

## Next Steps

- [Plugin Types Guide](./PLUGIN_TYPES.md) - Understand plugin types
- [SDK API Reference](./SDK_API_REFERENCE.md) - Full SDK documentation
- [Gateway Guide](./GATEWAY_GUIDE.md) - Set up local development
