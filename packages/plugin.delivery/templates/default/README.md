# Default Plugin Template

A complete plugin example with both server API and optional frontend UI.

This template is based on the official "clothes recommendation" example from the documentation.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Server runs at http://localhost:3400

## Features

- ✅ Backend API with Edge Runtime
- ✅ Optional frontend UI component  
- ✅ Plugin gateway for local development
- ✅ Complete manifest with API definitions
- ✅ TypeScript support

## Structure

```
default/
├── api/
│   ├── gateway.ts         # Plugin gateway (local dev)
│   └── clothes.ts         # API endpoint implementation
├── public/
│   ├── manifest-dev.json  # Development manifest (with gateway)
│   └── manifest.json      # Production manifest
├── src/
│   └── pages/
│       └── index.tsx      # Frontend UI component
├── package.json
├── tsconfig.json
├── vercel.json
└── README.md
```

## How It Works

1. **User asks**: "What should I wear today?"
2. **AI recognizes intent**: Needs clothing recommendation
3. **AI gathers info**: Asks for gender and mood
4. **Plugin called**: `recommendClothes({ gender, mood })`
5. **API responds**: Returns clothing suggestions
6. **UI renders**: Shows recommendations in chat
7. **AI summarizes**: Provides final advice

## Manifest Explained

```json
{
  "api": [{
    "url": "http://localhost:3400/api/clothes",
    "name": "recommendClothes",
    "description": "Recommend clothes based on user's mood",
    "parameters": {
      "properties": {
        "mood": { "type": "string", "enum": ["happy", "sad", ...] },
        "gender": { "type": "string", "enum": ["man", "woman"] }
      },
      "required": ["mood", "gender"]
    }
  }],
  "ui": {
    "url": "http://localhost:3400",
    "height": 200
  },
  "gateway": "http://localhost:3400/api/gateway"
}
```

## Customization

### 1. Add Your API Endpoint

Create a new file in `api/`:

```typescript
import { PluginErrorType, createErrorResponse } from '@sperax/plugin-sdk';

export const config = { runtime: 'edge' };

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return createErrorResponse(PluginErrorType.MethodNotAllowed);
  }

  const params = await req.json();
  
  // Your logic here
  const result = { /* ... */ };

  return new Response(JSON.stringify(result));
};
```

### 2. Update Manifest

Add your API to `public/manifest-dev.json`:

```json
{
  "api": [
    {
      "url": "http://localhost:3400/api/your-endpoint",
      "name": "yourFunction",
      "description": "Description for AI",
      "parameters": { /* JSON Schema */ }
    }
  ]
}
```

### 3. Add Frontend UI (Optional)

Edit `src/pages/index.tsx` to create a custom display:

```tsx
import { fetchPluginMessage } from '@sperax/plugin-sdk';

export default function Render() {
  const [data, setData] = useState();
  
  useEffect(() => {
    fetchPluginMessage().then(setData);
  }, []);

  return <div>{/* Your UI */}</div>;
}
```

## Deployment

```bash
# Deploy to Vercel
vercel --prod
```

Then update `public/manifest.json` with production URLs:
- Remove the `gateway` field
- Update `api[].url` to production URLs
- Update `ui.url` to production URL

## When to Use Default Type

Choose this template when:
- You want AI to summarize the plugin results
- You need backend processing
- You want optional rich UI display
- You're building something like:
  - Weather plugins
  - Search plugins
  - Data lookup tools
  - API integrations
