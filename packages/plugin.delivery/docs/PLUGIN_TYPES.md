# Plugin Types Guide

This guide explains the three plugin types and when to use each one.

## Table of Contents

- [Overview](#overview)
- [Default Plugins](#default-plugins)
- [Markdown Plugins](#markdown-plugins)
- [Standalone Plugins](#standalone-plugins)
- [Comparison Table](#comparison-table)
- [Decision Guide](#decision-guide)

---

## Overview

The plugin system supports three types of plugins:

| Type | AI Summarizes Response | Frontend Required | Best For |
|------|------------------------|-------------------|----------|
| `default` | ✅ Yes | Optional | Most plugins, content needing AI summarization |
| `markdown` | ❌ No | ❌ No | Direct formatted output, simple queries |
| `standalone` | 🔧 Controlled by plugin | ✅ Yes | Complex interactions, games, forms |

---

## Default Plugins

### Overview

The **default** type is the standard plugin behavior and the most commonly used. The AI processes the plugin's response and generates a natural language summary for the user. This type is suitable for pure backend-driven plugins and display-oriented plugins without rich interactive capabilities.

### Characteristics

- **Backend-Driven**: Requires a server to process requests and return data
- **AI Integration**: Response is passed to AI for summarization or interpretation
- **Simple Display**: Supports content display without user interaction (no editable forms, buttons)
- **ChatGPT Compatible**: All compatible OpenAI ChatGPT plugins are default type
- AI receives the raw plugin response
- Supports optional UI for rich display

### When to Use

✅ You want AI to interpret and summarize results  
✅ Your plugin returns structured data that needs context  
✅ You need simple backend processing  
✅ Display-only UI without user interaction  
✅ Content should be summarized or further processed by AI  
✅ Plugin requires tight integration with AI responses  

### Use Cases

**Default plugins cover common mainstream scenarios:**

1. **AI Summarization Needed**: Plugin content should be interpreted or summarized by AI
2. **Data Enrichment**: Plugin returns raw data that AI interprets or supplements
3. **Content Display**: Mainly for displaying information with possible custom frontend but no user interaction
4. **Web Content Processing**: Extract, summarize, or analyze web content

### Examples

**Website Content Summarizer**:
- User provides a URL
- Plugin fetches and returns page content
- AI summarizes and presents key information

**Cryptocurrency Price Plugin**:
- Fetches current market data
- Returns price, volume, changes
- AI provides analysis and insights

**Search Engine Plugin**:
- Queries search APIs
- Returns search results
- AI interprets and provides contextual answers

### Example Manifest

```json
{
  "identifier": "weather-lookup",
  "api": [
    {
      "url": "https://api.example.com/weather",
      "name": "getWeather",
      "description": "Get weather for a location",
      "parameters": {
        "type": "object",
        "properties": {
          "city": { 
            "type": "string",
            "description": "City name"
          }
        },
        "required": ["city"]
      }
    }
  ],
  "ui": {
    "url": "https://plugin.example.com/weather-display",
    "height": 200
  },
  "meta": {
    "avatar": "🌤️",
    "title": "Weather Lookup",
    "description": "Get current weather conditions"
  }
}
```

Note: Default plugins do NOT need to specify `"type"` in the manifest (it's the default).

### Example Response Flow

1. User: "What's the weather in Tokyo?"
2. AI calls `getWeather({ city: "Tokyo" })`
3. Plugin returns: `{ "temp": 22, "condition": "sunny", "humidity": 65 }`
4. AI responds: "The weather in Tokyo is sunny with a temperature of 22°C and 65% humidity."

### Server Implementation

```typescript
export default async (req: Request) => {
  const { city } = await req.json();
  
  const weather = await fetchWeatherAPI(city);
  
  // Return structured JSON data - AI will summarize
  return new Response(JSON.stringify({
    temperature: weather.temp,
    condition: weather.condition,
    humidity: weather.humidity,
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
```

### When NOT to Use Default Type

- You need user interaction (editable forms, buttons, clicks)
- Response doesn't need AI processing
- You want to avoid AI token usage for simple displays
- You need a full interactive application

---

## Markdown Plugins

### Overview

**Markdown** plugins return formatted content directly without AI summarization. The response is rendered as Markdown in the chat. This rendering method is suitable for scenarios where the result is clear and doesn't need to be sent to AI for processing again.

### Characteristics

- **Direct Display**: Markdown content rendered directly in chat
- **No AI Processing**: By default, does NOT trigger AI messages (saves tokens)
- **Rich Formatting**: Supports full Markdown syntax (headers, lists, tables, code blocks, etc.)
- **Fast Response**: Skips AI summarization step for immediate display
- Response displayed directly as Markdown
- No extra AI processing needed

### When to Use

✅ Results are clear and don't need interpretation  
✅ You want formatted output (tables, lists, code)  
✅ Avoid unnecessary AI processing  
✅ Simple, specific queries  
✅ Quick formatted results needed  
✅ Rich text display without complex frontend interaction  
✅ Plugin answers simple queries like time, name, or status  

### Use Cases

Choose the markdown plugin if your needs align with these scenarios:

1. **Quick Formatted Results**: Need to rapidly return clear, formatted text results
2. **Rich Text Display**: Want results to support rich Markdown format without complex frontend
3. **No AI Needed**: Avoid unnecessary AI summarization and display results directly
4. **Simple Queries**: Answer simple, specific queries like time, status, or lookup

### Examples

**Time Query Plugin**:
- User asks "What time is it in Tokyo?"
- Plugin returns formatted Markdown:
  ```markdown
  ## Current Time in Tokyo
  
  🕐 **14:35:20 JST**
  
  - Timezone: Asia/Tokyo (UTC+9)
  - Date: December 27, 2025
  ```

**Status Check Plugin**:
- User asks "What's the status of service X?"
- Returns colored status:
  ```markdown
  ### Service Status: ✅ Operational
  
  | Component | Status |
  |-----------|--------|
  | API | 🟢 Healthy |
  | Database | 🟢 Healthy |
  | Cache | 🟡 Degraded |
  ```

### Example Manifest

```json
{
  "identifier": "time-check",
  "type": "markdown",
  "api": [
    {
      "url": "https://api.example.com/time",
      "name": "getCurrentTime",
      "description": "Get current time in a timezone",
      "parameters": {
        "type": "object",
        "properties": {
          "timezone": { 
            "type": "string",
            "description": "Timezone name (e.g., 'America/New_York')"
          }
        }
      }
    }
  ],
  "meta": {
    "avatar": "🕐",
    "title": "Time Query",
    "description": "Get current time in any timezone"
  }
}
```

### Example Response Flow

1. User: "What time is it in New York?"
2. AI calls `getCurrentTime({ timezone: "America/New_York" })`
3. Plugin returns: `"## Current Time\n\n🕐 **New York**: 2:30 PM EST"`
4. Message displays the Markdown directly (no AI summary)

### Server Implementation

```typescript
export default async (req: Request) => {
  const { timezone } = await req.json();
  
  const time = new Date().toLocaleString('en-US', { timeZone: timezone });
  const date = new Date().toLocaleDateString('en-US', { timeZone: timezone });
  
  // Return plain Markdown text (not JSON)
  const markdown = `
## Current Time in ${timezone}

🕐 **${time}**

- Date: ${date}
- Timezone: ${timezone}
  `.trim();
  
  return new Response(markdown, {
    headers: { 'Content-Type': 'text/plain' }
  });
};
```

### Markdown Syntax Support

Markdown plugins support full Markdown syntax:

- **Headers**: `#`, `##`, `###`
- **Emphasis**: `*italic*`, `**bold**`, `***bold italic***`
- **Lists**: Ordered (`1.`) and unordered (`-`, `*`)
- **Links**: `[text](url)`
- **Images**: `![alt](url)`
- **Code**: Inline `` `code` `` and blocks ` ```lang `
- **Tables**: Full table syntax
- **Blockquotes**: `>`
- **Horizontal rules**: `---`
- **Emojis**: 🎉 ✅ 🔴 etc.

### Advanced Markdown Example

```typescript
const markdown = `
# 📊 Bitcoin Market Analysis

## Price Overview
| Metric | Value | Change |
|--------|-------|--------|
| Current Price | $45,000 | +2.5% ↗️ |
| 24h Volume | $1.2B | +5.3% |
| Market Cap | $850B | +2.1% |

## Key Levels
- **Support**: $43,500
- **Resistance**: $47,000

> ⚠️ **Note**: This is not financial advice

---

\`\`\`
Last Updated: ${new Date().toLocaleString()}
\`\`\`
`;

return new Response(markdown, {
  headers: { 'Content-Type': 'text/plain' }
});
```

### When NOT to Use Markdown Type

- You need user interaction (buttons, forms, edits)
- Response needs AI interpretation or summarization
- You need custom styling beyond Markdown
- You want dynamic client-side updates
- Complex multi-step workflows required

---

## Standalone Plugins

**Standalone** plugins have full control over interaction logic. They can trigger AI messages programmatically and provide rich interactive experiences.

### Characteristics

- Complete control over AI interaction
- Required frontend UI
- Can be pure frontend (no backend API)
- Programmatic AI triggers
- Best for complex, multi-step interactions

### When to Use

✅ Rich, complex user interactions  
✅ Forms, games, or multi-step workflows  
✅ Custom control over when AI responds  
✅ Pure frontend applications  
✅ Real-time interactive widgets  

### Example Manifest

```json
{
  "identifier": "interactive-calculator",
  "type": "standalone",
  "ui": {
    "url": "https://plugin.example.com/calculator",
    "height": 400
  },
  "meta": {
    "avatar": "🧮",
    "title": "Interactive Calculator",
    "description": "A full-featured calculator widget"
  }
}
```

### Example Response Flow

1. User: "Open calculator"
2. Plugin UI renders in chat
3. User interacts with the calculator UI
4. User clicks "Send to AI" button
5. Plugin calls `speraxChat.triggerAIMessage()` with result
6. AI receives result and responds

### Frontend Implementation

```tsx
import { useOnStandalonePluginInit, speraxChat } from '@sperax/plugin-sdk/client';
import { useState } from 'react';

export default function Calculator() {
  const [result, setResult] = useState(0);
  
  useOnStandalonePluginInit((payload) => {
    console.log('Calculator initialized', payload);
  });
  
  const handleCalculate = (expression: string) => {
    const value = eval(expression); // Don't use eval in production!
    setResult(value);
  };
  
  const sendToAI = async () => {
    // Update plugin message
    await speraxChat.setPluginMessage({ result });
    
    // Trigger AI to respond
    await speraxChat.triggerAIMessage();
  };
  
  return (
    <div>
      <input onChange={(e) => handleCalculate(e.target.value)} />
      <div>Result: {result}</div>
      <button onClick={sendToAI}>Send to AI</button>
    </div>
  );
}
```

### Communication Methods

Standalone plugins use the full client SDK:

```typescript
import { speraxChat } from '@sperax/plugin-sdk/client';

// Get initialization payload
const payload = await speraxChat.getPluginPayload();

// Update plugin message content
await speraxChat.setPluginMessage(data);

// Get/set plugin state
const state = await speraxChat.getPluginState('key');
await speraxChat.setPluginState('key', value);

// Trigger AI response
await speraxChat.triggerAIMessage(messageId);

// Create assistant message
await speraxChat.createAssistantMessage('Analysis complete...');
```

---

## Comparison Table

| Feature | Default | Markdown | Standalone |
|---------|---------|----------|------------|
| AI summarizes response | ✅ Yes | ❌ No | 🔧 Controlled |
| Frontend UI | Optional | Not needed | Required |
| Backend API | Required | Required | Optional |
| User interaction | Display only | None | Full |
| Triggers AI by default | ✅ Yes | ❌ No | ❌ No |
| Can trigger AI manually | ❌ No | ❌ No | ✅ Yes |
| Pure frontend possible | ❌ No | ❌ No | ✅ Yes |

---

## Decision Guide

Use this flowchart to choose the right type:

```
Start
  │
  ├─► Do you need user interaction in the plugin?
  │     │
  │     ├─► YES: Use STANDALONE
  │     │
  │     └─► NO: Continue ↓
  │
  ├─► Should AI summarize/interpret the response?
  │     │
  │     ├─► YES: Use DEFAULT
  │     │
  │     └─► NO: Continue ↓
  │
  └─► Is the output already formatted/complete?
        │
        ├─► YES: Use MARKDOWN
        │
        └─► NO: Use DEFAULT
```

### Quick Examples

| Scenario | Type |
|----------|------|
| Weather data that AI explains | `default` |
| Stock prices displayed in a chart | `default` + UI |
| Current time query | `markdown` |
| Formatted table of results | `markdown` |
| Interactive form submission | `standalone` |
| Real-time clock widget | `standalone` |
| Game or quiz | `standalone` |
| Drawing/sketching tool | `standalone` |

---

## Next Steps

- [Plugin Manifest Reference](./PLUGIN_MANIFEST.md) - Complete manifest documentation
- [SDK API Reference](./SDK_API_REFERENCE.md) - Client SDK for standalone plugins
- [Quick Start](./QUICK_START.md) - Build your first plugin
