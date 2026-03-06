# Artifacts Guide for AI Chat Applications

> **Complete Reference for Implementing Artifacts in Plugin-Enabled Chat**  
> Version: 1.0 | Last Updated: December 27, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Artifact Types](#artifact-types)
3. [Tag Structure](#tag-structure)
4. [Implementation Examples](#implementation-examples)
5. [Best Practices](#best-practices)
6. [AI Integration](#ai-integration)

---

## Overview

### What are Artifacts?

Artifacts enable AI assistants to create and display substantial, self-contained content in a dedicated UI panel separate from the conversation flow. This feature provides a Claude Artifacts-like experience for any AI model with 8K+ context windows.

### Key Benefits

- **Visual Separation**: Content displayed in dedicated panel for better focus
- **Interactive Preview**: Real-time rendering of HTML, SVG, React components, and more
- **Persistent Access**: Users can revisit and interact with generated artifacts
- **Multi-Model Support**: Works with Claude, ChatGPT, Gemini, and other models
- **Enhanced Collaboration**: Users can view, edit, and iterate on generated content

### When to Use Artifacts

**✅ Good Candidates:**
- Substantial content (>15 lines)
- Self-contained, complex content understandable on its own
- Content users will modify, iterate on, or take ownership of
- Content intended for use outside the conversation (reports, presentations)
- Reusable content referenced multiple times

**❌ Not Suitable For:**
- Simple, short content or code snippets
- Primarily explanatory or instructional content
- Conversational responses
- Content dependent on conversational context
- One-off questions

---

## Artifact Types

### Supported Types

| Type | MIME Type | Use Case | Rendering |
|------|-----------|----------|-----------|
| **Code** | `application/sperax.artifacts.code` | Code snippets (any language) | Syntax highlighter |
| **HTML** | `text/html` | Interactive web pages | iframe sandbox |
| **SVG** | `image/svg+xml` | Vector graphics | Sanitized SVG |
| **React** | `application/sperax.artifacts.react` | React components | Live preview |
| **Mermaid** | `application/sperax.artifacts.mermaid` | Diagrams and flowcharts | Mermaid renderer |
| **Markdown** | `text/markdown` | Formatted documents | Markdown renderer |

---

## Tag Structure

### Basic Syntax

```xml
<speraxArtifact 
  identifier="unique-kebab-case-id"
  type="application/sperax.artifacts.react"
  title="Human Readable Title"
  language="typescript">
  [CONTENT]
</speraxArtifact>
```

### Attributes

| Attribute | Required | Description | Example |
|-----------|----------|-------------|---------|
| `identifier` | Yes | Unique kebab-case ID | `"weather-dashboard"` |
| `type` | Yes | MIME type from table above | `"text/html"` |
| `title` | Yes | Human-readable title | `"Temperature Converter"` |
| `language` | Conditional | For code artifacts only | `"python"`, `"javascript"` |

### Optional Tag: speraxThinking

AI can include its reasoning process (hidden from user):

```xml
<speraxThinking>
User needs a responsive dashboard with charts. I'll use React with Recharts library for data visualization. Using Tailwind for styling.
</speraxThinking>

<speraxArtifact identifier="dashboard" type="application/sperax.artifacts.react" title="Sales Dashboard">
[React component code]
</speraxArtifact>
```

---

## Implementation Examples

### 1. Code Artifact

Generic code snippets that don't need execution.

```xml
<speraxArtifact identifier="factorial-algo" type="application/sperax.artifacts.code" language="python" title="Factorial Calculator">
def factorial(n):
    """Calculate factorial recursively"""
    if n == 0:
        return 1
    return n * factorial(n - 1)

# Example usage
print(factorial(5))  # Output: 120
</speraxArtifact>
```

**Supported Languages:** Any language with syntax highlighting (python, javascript, typescript, rust, go, java, etc.)

---

### 2. HTML Artifact

Single-file interactive web pages.

**Requirements:**
- HTML, CSS, and JS must be in a single file
- External scripts only from `https://cdnjs.cloudflare.com`
- Use placeholder images: `<img src="/api/placeholder/400/320" alt="..." />`

```xml
<speraxArtifact identifier="temp-converter" type="text/html" title="Temperature Converter">
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Temperature Converter</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 p-8">
  <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
    <h1 class="text-2xl font-bold mb-4">Temperature Converter</h1>
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-2">Celsius</label>
        <input type="number" id="celsius" class="w-full p-2 border rounded" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-2">Fahrenheit</label>
        <input type="number" id="fahrenheit" class="w-full p-2 border rounded" readonly />
      </div>
    </div>
  </div>
  <script>
    document.getElementById('celsius').addEventListener('input', (e) => {
      const celsius = parseFloat(e.target.value);
      const fahrenheit = (celsius * 9/5) + 32;
      document.getElementById('fahrenheit').value = fahrenheit.toFixed(2);
    });
  </script>
</body>
</html>
</speraxArtifact>
```

---

### 3. SVG Artifact

Scalable vector graphics for diagrams, illustrations, charts.

**Best Practices:**
- Use `viewBox` instead of fixed width/height
- Sanitized for XSS prevention
- Supports download as PNG or SVG

```xml
<speraxArtifact identifier="process-flow" type="image/svg+xml" title="User Authentication Flow">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <path d="M0,0 L0,6 L9,3 z" fill="#4F46E5" />
    </marker>
  </defs>
  
  <!-- Login box -->
  <rect x="150" y="20" width="100" height="50" fill="#4F46E5" stroke="#312E81" stroke-width="2" rx="5"/>
  <text x="200" y="50" text-anchor="middle" fill="white" font-size="14">Login</text>
  
  <!-- Arrow -->
  <line x1="200" y1="70" x2="200" y2="120" stroke="#4F46E5" stroke-width="2" marker-end="url(#arrow)"/>
  
  <!-- Verify box -->
  <rect x="150" y="120" width="100" height="50" fill="#10B981" stroke="#065F46" stroke-width="2" rx="5"/>
  <text x="200" y="150" text-anchor="middle" fill="white" font-size="14">Verify</text>
  
  <!-- Arrow -->
  <line x1="200" y1="170" x2="200" y2="220" stroke="#10B981" stroke-width="2" marker-end="url(#arrow)"/>
  
  <!-- Dashboard box -->
  <rect x="150" y="220" width="100" height="50" fill="#F59E0B" stroke="#92400E" stroke-width="2" rx="5"/>
  <text x="200" y="250" text-anchor="middle" fill="white" font-size="14">Dashboard</text>
</svg>
</speraxArtifact>
```

---

### 4. React Artifact

Interactive React components with full ecosystem support.

**Available Libraries:**
- React & React Hooks (built-in)
- Tailwind CSS (via CDN)
- lucide-react@0.263.1 (icons)
- recharts (charting)
- Ant Design
- Radix UI primitives

**Requirements:**
- Must have no required props (or provide defaults)
- Must use default export
- Use Tailwind for styling

```xml
<speraxArtifact identifier="crypto-dashboard" type="application/sperax.artifacts.react" title="Crypto Portfolio">
import React, { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const CryptoDashboard = () => {
  const [assets] = useState([
    { name: 'BTC', value: 45000, change: 5.2, amount: 0.5 },
    { name: 'ETH', value: 3200, change: -2.1, amount: 3 },
    { name: 'SOL', value: 120, change: 12.5, amount: 50 }
  ]);

  const totalValue = assets.reduce((sum, asset) => sum + (asset.value * asset.amount), 0);
  const chartData = assets.map(a => ({ name: a.name, value: a.value * a.amount }));

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Portfolio Overview</h1>
        
        {/* Total Value Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Portfolio Value</p>
              <p className="text-4xl font-bold">${totalValue.toLocaleString()}</p>
            </div>
            <DollarSign className="w-12 h-12 text-green-500" />
          </div>
        </div>

        {/* Assets List */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Your Assets</h2>
          <div className="space-y-4">
            {assets.map((asset) => (
              <div key={asset.name} className="flex items-center justify-between p-4 bg-gray-50 rounded">
                <div>
                  <p className="font-semibold">{asset.name}</p>
                  <p className="text-sm text-gray-600">{asset.amount} coins</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${(asset.value * asset.amount).toLocaleString()}</p>
                  <div className={`flex items-center text-sm ${asset.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {asset.change >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                    {Math.abs(asset.change)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Asset Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#4F46E5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default CryptoDashboard;
</speraxArtifact>
```

---

### 5. Mermaid Artifact

Diagrams and flowcharts using Mermaid syntax.

```xml
<speraxArtifact identifier="deployment-flow" type="application/sperax.artifacts.mermaid" title="CI/CD Pipeline">
graph LR
    A[Code Push] --> B{Tests Pass?}
    B -->|Yes| C[Build]
    B -->|No| D[Notify Developer]
    C --> E[Deploy to Staging]
    E --> F{Manual Approval}
    F -->|Approved| G[Deploy to Production]
    F -->|Rejected| D
    G --> H[Monitor]
</speraxArtifact>
```

**Mermaid Types Supported:**
- `graph` - Flowcharts
- `sequenceDiagram` - Sequence diagrams
- `classDiagram` - Class diagrams
- `stateDiagram` - State diagrams
- `gantt` - Gantt charts
- `pie` - Pie charts
- `gitGraph` - Git graphs

---

## Best Practices

### 1. Identifier Naming

✅ **Good:**
- `crypto-portfolio-2024`
- `user-auth-flow`
- `temperature-converter-v2`

❌ **Bad:**
- `CryptoPortfolio` (use kebab-case)
- `temp` (too vague)
- `converter123` (meaningless numbers)

### 2. Content Size

- **Minimum**: >15 lines (otherwise use inline code)
- **Maximum**: No hard limit, but keep focused
- **Optimal**: 50-500 lines for React components

### 3. Dependencies

**HTML Artifacts:**
- Only use CDN scripts from `cdnjs.cloudflare.com`
- Keep external dependencies minimal
- Self-contained is better

**React Artifacts:**
- Use available libraries (see type details)
- Don't import external packages not in the sandbox
- Inline any utilities you need

### 4. User Experience

- **Title**: Clear, descriptive, 3-8 words
- **Type**: Choose the most appropriate renderer
- **Layout**: Responsive design using Tailwind
- **Accessibility**: Include ARIA labels, semantic HTML

---

## AI Integration

### System Prompt Guidelines

When configuring AI assistants to use artifacts, include these guidelines:

```markdown
## Artifact Creation Guidelines

Use `<speraxArtifact>` tags to create substantial, reusable content that benefits from:
- Visual separation from conversation
- Interactive preview capabilities
- Persistent access for users
- Editing and iteration

### When to Create Artifacts

CREATE artifacts for:
- Code (>15 lines) in any language
- HTML pages with interactivity
- SVG graphics and diagrams
- React components with state
- Mermaid flowcharts and diagrams
- Markdown documents (>100 words)

DO NOT create artifacts for:
- Short code snippets (<15 lines)
- Simple text responses
- Explanations without substantial content
- Questions or conversational replies

### Artifact Structure

<speraxArtifact identifier="unique-id" type="MIME-TYPE" title="Title" language="LANGUAGE">
[CONTENT]
</speraxArtifact>

### Available Types

- application/sperax.artifacts.code (with language attribute)
- text/html
- image/svg+xml
- application/sperax.artifacts.react
- application/sperax.artifacts.mermaid
- text/markdown

### React Components

When creating React artifacts:
- Use default export
- No required props (use defaults)
- Import from: react, lucide-react, recharts
- Use Tailwind CSS for styling
- Make responsive with proper breakpoints

Example:
<speraxArtifact identifier="example-component" type="application/sperax.artifacts.react" title="Example">
import React from 'react';

const Component = () => {
  return <div className="p-4">Hello</div>;
};

export default Component;
</speraxArtifact>
```

### Model-Specific Considerations

**Claude (Anthropic):**
- Native artifact support
- Use `<speraxThinking>` for reasoning
- Excellent at complex React components

**ChatGPT (OpenAI):**
- Supports artifacts via system prompt
- May need explicit reminders
- Good at HTML and SVG

**Gemini (Google):**
- Works with clear instructions
- Strong with data visualizations
- May need examples

**Other Models:**
- Provide clear schema and examples
- Test with simple artifacts first
- Adjust prompt based on results

---

## Plugin Integration

Plugins can return artifact-formatted responses:

```typescript
// In your plugin's API handler
export default async function handler(req, res) {
  const result = await someDataFetch();
  
  const artifact = `
<speraxArtifact identifier="plugin-result" type="application/sperax.artifacts.react" title="Search Results">
import React from 'react';

const Results = () => {
  const data = ${JSON.stringify(result)};
  
  return (
    <div className="p-4">
      {data.map(item => (
        <div key={item.id} className="mb-4 p-4 bg-white rounded shadow">
          <h3 className="font-bold">{item.title}</h3>
          <p>{item.description}</p>
        </div>
      ))}
    </div>
  );
};

export default Results;
</speraxArtifact>
  `;
  
  res.status(200).send(artifact);
}
```

This enables plugins to create rich, interactive displays in the chat interface.

---

## Resources

- **Plugin SDK**: [@sperax/plugin-sdk](https://www.npmjs.com/package/@sperax/plugin-sdk)
- **Plugin Marketplace**: [plugin.delivery](https://plugin.delivery)
- **Mermaid Docs**: [mermaid.js.org](https://mermaid.js.org)
- **Tailwind CSS**: [tailwindcss.com](https://tailwindcss.com)
- **Recharts**: [recharts.org](https://recharts.org)

---

**Last Updated:** December 27, 2025  
**Version:** 1.0  
**License:** MIT
