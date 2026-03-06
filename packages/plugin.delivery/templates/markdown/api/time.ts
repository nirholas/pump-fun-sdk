import { PluginErrorType, createErrorResponse } from '@sperax/plugin-sdk';

export const config = {
  runtime: 'edge',
};

interface TimeRequest {
  timezone?: string;
  format?: '12h' | '24h';
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return createErrorResponse(PluginErrorType.MethodNotAllowed);
  }

  try {
    const { timezone = 'UTC', format = '24h' } = (await req.json()) as TimeRequest;

    const now = new Date();
    
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: format === '12h',
    };

    const timeString = now.toLocaleTimeString('en-US', options);
    const dateString = now.toLocaleDateString('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Return plain Markdown - no JSON wrapping
    const markdown = `## 🕐 Current Time

**Timezone:** ${timezone}

| Field | Value |
|-------|-------|
| **Time** | ${timeString} |
| **Date** | ${dateString} |
| **Format** | ${format === '12h' ? '12-hour' : '24-hour'} |
`;

    return new Response(markdown, {
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    // Even errors should be markdown for markdown plugins
    return new Response(`## ⚠️ Error

Could not get time: ${error instanceof Error ? error.message : 'Unknown error'}

Please check the timezone format and try again.
`, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
