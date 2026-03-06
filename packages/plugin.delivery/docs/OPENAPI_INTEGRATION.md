# OpenAPI Integration Guide

Use OpenAPI specifications to define your plugin's API without writing manual definitions.

## Table of Contents

- [Overview](#overview)
- [SperaxOS Plugin Compatibility](#speraxos-plugin-compatibility)
- [OpenAPI Specification](#openapi-specification)
- [Creating an OpenAPI Spec](#creating-an-openapi-spec)
- [Manifest Configuration](#manifest-configuration)
- [OpenAPI Requirements](#openapi-requirements)
- [Integrating OpenAPI with SperaxOS](#integrating-openapi-with-speraxos)
- [Examples](#examples)
- [Converting Existing APIs](#converting-existing-apis)
- [Troubleshooting](#troubleshooting)

---

## Overview

OpenAPI (formerly Swagger) is a standard for describing RESTful APIs. The plugin system can read your OpenAPI spec and automatically create Function Call definitions.

SperaxOS's plugin mechanism supports the OpenAPI specification, which is a standard for defining and describing RESTful APIs. By using OpenAPI, developers can create a clear, language-agnostic API description to facilitate the correct implementation and usage of the API.

### Benefits

- ✅ Use existing API documentation
- ✅ Auto-generate function definitions
- ✅ Standard tooling support
- ✅ Easy to maintain
- ✅ Compatible with OpenAI ChatGPT plugins
- ✅ Language-agnostic API descriptions
- ✅ Clear documentation for endpoints, parameters, and responses

### How It Works

1. You provide an OpenAPI spec URL in your manifest
2. The system reads the spec
3. Each operation becomes a callable function
4. Parameters are extracted from the spec
5. AI can call any operation
6. SwaggerClient interacts with third-party services defined in the spec

---

## SperaxOS Plugin Compatibility

SperaxOS's plugin system is fully compatible with OpenAPI documents. When you create a SperaxOS plugin, you only need to follow these steps to convert an OpenAPI service into a conversation plugin:

### Step 1: Build the API

Develop your service API, ensuring that it can handle requests from SperaxOS and return appropriate responses.

**Example API Server:**

```typescript
// api/weather.ts
export default async (req: Request) => {
  const { city } = await req.json();
  
  // Fetch weather data
  const weather = await fetchWeatherData(city);
  
  return new Response(JSON.stringify({
    temperature: weather.temp,
    condition: weather.condition,
    humidity: weather.humidity
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
```

### Step 2: Create OpenAPI Document

Use the OpenAPI specification (in YAML or JSON format) to describe your API. This document should provide detailed information about:
- Endpoints
- Parameters
- Response formats
- Authentication methods
- Error codes

**Example OpenAPI Document:**

```yaml
openapi: 3.0.0
info:
  title: Weather API
  description: Get current weather data for any city
  version: 1.0.0
servers:
  - url: https://api.weather.example.com
    description: Production server
paths:
  /weather/current:
    post:
      operationId: getCurrentWeather
      summary: Get current weather for a city
      description: Returns temperature, condition, and humidity for the specified city
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - city
              properties:
                city:
                  type: string
                  description: City name (e.g., "Tokyo", "New York")
                  example: "Tokyo"
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  temperature:
                    type: number
                    description: Temperature in Celsius
                  condition:
                    type: string
                    description: Weather condition (e.g., "sunny", "cloudy")
                  humidity:
                    type: number
                    description: Humidity percentage
        '400':
          description: Invalid city name
        '500':
          description: Server error
```

### Step 3: Create a Plugin Manifest

Create a `manifest.json` plugin manifest file for SperaxOS, which includes the plugin's metadata and, most importantly, fill in the URL of your OpenAPI document in the `openapi` field:

```json
{
  "identifier": "weather-plugin",
  "openapi": "https://api.weather.example.com/openapi.json",
  "meta": {
    "avatar": "🌤️",
    "title": "Weather Plugin",
    "description": "Get real-time weather data for any city worldwide",
    "tags": ["weather", "data", "api"]
  },
  "homepage": "https://weather.example.com",
  "settings": {
    "type": "object",
    "properties": {
      "apiKey": {
        "type": "string",
        "title": "API Key",
        "description": "Your Weather API key",
        "format": "password"
      }
    },
    "required": ["apiKey"]
  }
}
```

---

## OpenAPI Specification

The OpenAPI specification is a standard for describing the structure and behavior of RESTful APIs. This specification allows developers to define:

### Core Elements

1. **Basic Information**
   - API title, description, and version
   - Contact information
   - License details

2. **Server Information**
   - URL of the API server
   - Multiple environments (production, staging)
   - Server variables

3. **Endpoints and Operations**
   - Available endpoints (paths)
   - HTTP methods (GET, POST, PUT, DELETE, etc.)
   - Operation IDs for function calling

4. **Parameters**
   - Input parameters for each operation
   - Path, query, header, and cookie parameters
   - Request body schemas

5. **Responses**
   - Expected responses for each operation
   - Success and error response formats
   - HTTP status codes

6. **Authentication Methods**
   - No authentication
   - HTTP basic authentication
   - Bearer token (JWT)
   - OAuth2
   - API keys

7. **Data Models**
   - Reusable schemas
   - Component definitions
   - Common response messages and error codes

### OpenAPI Document Example

You can view a complete example of an OpenAPI document here: [CoinGecko OpenAPI Spec](https://github.com/nirholas/plugin.delivery/blob/main/public/openai/coingecko/openapi.json)

For a detailed introduction to OpenAPI, refer to the [OpenAPI Specification](https://swagger.io/specification/).

---

## Creating an OpenAPI Spec

### Minimal Example

```yaml
openapi: 3.0.0
info:
  title: Weather API
  version: 1.0.0
servers:
  - url: https://api.weather.example.com
paths:
  /current:
    post:
      operationId: getCurrentWeather
      summary: Get current weather for a city
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - city
              properties:
                city:
                  type: string
                  description: City name
      responses:
        '200':
          description: Weather data
          content:
            application/json:
              schema:
                type: object
                properties:
                  temperature:
                    type: number
                  condition:
                    type: string
```

### JSON Format

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Weather API",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://api.weather.example.com"
    }
  ],
  "paths": {
    "/current": {
      "post": {
        "operationId": "getCurrentWeather",
        "summary": "Get current weather for a city",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["city"],
                "properties": {
                  "city": {
                    "type": "string",
                    "description": "City name"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Weather data"
          }
        }
      }
    }
  }
}
```

---

## Manifest Configuration

### Basic Setup

```json
{
  "identifier": "weather-plugin",
  "openapi": "https://api.example.com/openapi.json",
  "meta": {
    "avatar": "🌤️",
    "title": "Weather Plugin",
    "description": "Get weather data"
  }
}
```

### With API Array (Hybrid)

You can combine OpenAPI with manual API definitions:

```json
{
  "identifier": "my-plugin",
  "openapi": "https://api.example.com/openapi.json",
  "api": [
    {
      "url": "https://api.example.com/custom",
      "name": "customEndpoint",
      "description": "A custom endpoint not in OpenAPI",
      "parameters": {
        "type": "object",
        "properties": {
          "param": { "type": "string" }
        }
      }
    }
  ]
}
```

---

## OpenAPI Requirements

### Required Fields

| Field | Description |
|-------|-------------|
| `openapi` | Version (3.0.0 or 3.1.0) |
| `info.title` | API title |
| `info.version` | API version |
| `servers` | At least one server URL |
| `paths` | At least one path/operation |

### Operation Requirements

Each operation should have:

| Field | Required | Description |
|-------|----------|-------------|
| `operationId` | Yes | Unique function name |
| `summary` or `description` | Yes | What the function does |
| `requestBody` or `parameters` | Recommended | Input parameters |
| `responses` | Yes | Expected responses |

### Best Practices

#### Use POST for Complex Parameters

```yaml
paths:
  /search:
    post:
      operationId: search
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                query:
                  type: string
                filters:
                  type: object
```

#### Add Descriptions to Everything

```yaml
properties:
  city:
    type: string
    description: "The city name to get weather for (e.g., 'New York', 'London')"
```

#### Use Enums for Fixed Values

```yaml
properties:
  unit:
    type: string
    enum: ["celsius", "fahrenheit"]
    description: "Temperature unit"
```

---

## Examples

### CoinGecko-style Crypto API

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Crypto Prices API",
    "version": "1.0.0"
  },
  "servers": [
    { "url": "https://api.coingecko.com/api/v3" }
  ],
  "paths": {
    "/simple/price": {
      "get": {
        "operationId": "getPrice",
        "summary": "Get current price of cryptocurrencies",
        "parameters": [
          {
            "name": "ids",
            "in": "query",
            "required": true,
            "schema": { "type": "string" },
            "description": "Comma-separated coin IDs (e.g., 'bitcoin,ethereum')"
          },
          {
            "name": "vs_currencies",
            "in": "query",
            "required": true,
            "schema": { "type": "string" },
            "description": "Comma-separated currencies (e.g., 'usd,eur')"
          }
        ],
        "responses": {
          "200": {
            "description": "Price data"
          }
        }
      }
    },
    "/coins/{id}": {
      "get": {
        "operationId": "getCoinDetails",
        "summary": "Get detailed info about a coin",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": { "type": "string" },
            "description": "Coin ID (e.g., 'bitcoin')"
          }
        ],
        "responses": {
          "200": {
            "description": "Coin details"
          }
        }
      }
    }
  }
}
```

### Search API with Filters

```yaml
openapi: 3.0.0
info:
  title: Search API
  version: 1.0.0
servers:
  - url: https://search.example.com
paths:
  /search:
    post:
      operationId: search
      summary: Search with advanced filters
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - query
              properties:
                query:
                  type: string
                  description: Search query
                filters:
                  type: object
                  properties:
                    category:
                      type: string
                      enum: ["news", "images", "videos"]
                    dateRange:
                      type: string
                      enum: ["day", "week", "month", "year"]
                    language:
                      type: string
                limit:
                  type: integer
                  minimum: 1
                  maximum: 100
                  default: 10
      responses:
        '200':
          description: Search results
```

---

## Converting Existing APIs

### From Swagger 2.0

Use the [swagger2openapi](https://www.npmjs.com/package/swagger2openapi) tool:

```bash
npx swagger2openapi swagger.json -o openapi.json
```

### From Postman Collection

1. Export collection as JSON
2. Use [postman-to-openapi](https://www.npmjs.com/package/postman-to-openapi):

```bash
npx postman-to-openapi collection.json -o openapi.json
```

### Manual Conversion

Map your endpoints to OpenAPI:

| Your API | OpenAPI |
|----------|---------|
| GET /users?id=123 | GET with query parameter |
| POST /users body: {} | POST with requestBody |
| PUT /users/123 | PUT with path parameter |
| Headers | parameters with `in: header` |

---

## Troubleshooting

### "Server URL not found"

**Problem**: OpenAPI spec missing servers array

**Solution**: Add servers:

```json
{
  "servers": [
    { "url": "https://api.example.com" }
  ]
}
```

### "Operation ID missing"

**Problem**: Operations without operationId

**Solution**: Add unique operationId to each operation:

```yaml
paths:
  /endpoint:
    post:
      operationId: uniqueFunctionName  # Add this
```

### "Parameters not extracted"

**Problem**: Parameters not being passed to function

**Solution**: Ensure proper schema structure:

```yaml
requestBody:
  content:
    application/json:
      schema:
        type: object  # Must be object
        properties:
          param:
            type: string
            description: "Add descriptions!"  # Helps AI understand
```

### "Wrong server URL"

**Problem**: Using localhost in production

**Solution**: Use environment-specific servers:

```yaml
servers:
  - url: https://api.example.com
    description: Production
  - url: http://localhost:3000
    description: Development
```

### CORS Issues

**Problem**: Browser blocks cross-origin requests

**Solution**: Ensure your server returns proper CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

---

## Next Steps

- [Plugin Manifest Reference](./PLUGIN_MANIFEST.md) - Full manifest docs
- [Gateway Guide](./GATEWAY_GUIDE.md) - Set up local development
- [Quick Start](./QUICK_START.md) - Build your first plugin

---

## Integrating OpenAPI with SperaxOS

Once your API and plugin manifest file are ready, you can integrate them with SperaxOS.

### Integration Flow

1. **User Installation**: In the SperaxOS UI, users can install your plugin from the plugin marketplace
2. **Manifest Loading**: SperaxOS reads your plugin manifest and fetches the OpenAPI document
3. **Schema Parsing**: The system parses endpoints defined in the OpenAPI document
4. **Function Registration**: Each operation becomes available as a function call
5. **User Interaction**: Users interact with your service through the AI assistant
6. **API Communication**: The OpenAPI document guides SperaxOS on how to communicate with your API

### Example: CoinGecko Plugin

The CoinGecko plugin demonstrates OpenAPI integration. Users can query cryptocurrency prices, and SperaxOS uses the OpenAPI spec to correctly format requests and interpret responses.

---

## Best Practices for OpenAPI Plugins

### 1. Comprehensive Descriptions

Provide detailed descriptions for all operations and parameters. The AI uses these to understand when to call your API.

### 2. Use operationId

Always provide unique `operationId` values - these become the function names:

```yaml
paths:
  /weather:
    get:
      operationId: getCurrentWeather  # Clear function name
```

### 3. Document All Responses

Include success and error responses with appropriate HTTP status codes.

### 4. Version Your API

Use semantic versioning in your OpenAPI spec info section.

### 5. Test Thoroughly

Validate your OpenAPI spec using tools like Swagger Editor before deployment.

---

## Additional Resources

- **OpenAPI Specification**: https://swagger.io/specification/
- **Swagger Editor**: https://editor.swagger.io/
- **OpenAPI Generator**: https://openapi-generator.tech/
- **Plugin Manifest Reference**: See PLUGIN_MANIFEST.md

By following the OpenAPI specification, you ensure accurate API documentation and seamless integration with SperaxOS, providing users with a rich, reliable plugin experience.

