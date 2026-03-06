# OpenAPI Plugin Template

A template for creating plugins using OpenAPI specifications.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Server runs at http://localhost:3400

## Structure

```
openapi/
├── api/
│   ├── gateway.ts      # Plugin gateway
│   ├── greet.ts        # Greet endpoint
│   └── calculate.ts    # Calculate endpoint
├── public/
│   ├── manifest.json   # Plugin manifest
│   └── openapi.json    # OpenAPI specification
├── package.json
└── README.md
```

## How It Works

1. The `openapi.json` defines your API endpoints
2. Each endpoint in `paths` becomes a callable function
3. The host reads the OpenAPI spec and creates Function Call definitions
4. When AI calls a function, the request routes to your API endpoint

## Adding New Endpoints

1. Add the endpoint to `public/openapi.json`:

```json
{
  "paths": {
    "/api/new-endpoint": {
      "post": {
        "operationId": "newEndpoint",
        "summary": "Description for AI",
        "requestBody": { ... }
      }
    }
  }
}
```

2. Create the handler in `api/new-endpoint.ts`:

```typescript
export default async function handler(req: Request) {
  const body = await req.json();
  // Your logic
  return new Response(JSON.stringify(result));
}
```

## Testing

Test API directly:

```bash
curl -X POST http://localhost:3400/api/greet \
  -H "Content-Type: application/json" \
  -d '{"name": "World", "language": "es"}'
```

## Deployment

```bash
# Deploy to Vercel
vercel --prod
```

Update `public/openapi.json` servers URL:

```json
{
  "servers": [
    { "url": "https://your-plugin.vercel.app" }
  ]
}
```

Remove `gateway` field from manifest for production.
