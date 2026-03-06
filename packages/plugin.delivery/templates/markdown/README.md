# Markdown Plugin Template

A template for creating plugins that return Markdown directly without AI summarization.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Server runs at http://localhost:3400

## Key Difference from Default Plugins

- **Default plugins**: Return JSON → AI summarizes → User sees AI response
- **Markdown plugins**: Return Markdown → Displayed directly → No AI processing

This is faster and more predictable when you want exact formatted output.

## Structure

```
markdown/
├── api/
│   ├── gateway.ts    # Plugin gateway
│   ├── time.ts       # Time endpoint
│   └── date.ts       # Date endpoint
├── public/
│   └── manifest.json # Plugin manifest (type: "markdown")
├── package.json
└── README.md
```

## How It Works

1. Set `"type": "markdown"` in manifest.json
2. Return plain Markdown text (not JSON)
3. Response displays directly in chat

## Response Format

```typescript
// ✅ Correct: Plain Markdown text
return new Response(`## Title

Some **bold** and *italic* text.

| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |
`);

// ❌ Wrong: Don't wrap in JSON
return new Response(JSON.stringify({ markdown: '...' }));
```

## Supported Markdown Features

- Headings (#, ##, ###)
- Bold, italic, strikethrough
- Lists (ordered and unordered)
- Tables
- Code blocks
- Links
- Images
- Blockquotes

## When to Use Markdown Plugins

✅ Time/date queries  
✅ Formatted tables  
✅ Code snippets  
✅ Static information  
✅ Pre-formatted reports  

❌ Data that needs AI interpretation  
❌ Complex conversational responses  
❌ Dynamic follow-up questions  

## Testing

```bash
curl -X POST http://localhost:3400/api/time \
  -H "Content-Type: application/json" \
  -d '{"timezone": "America/New_York", "format": "12h"}'
```

## Deployment

```bash
vercel --prod
```

Update manifest URLs for production and remove the `gateway` field.
