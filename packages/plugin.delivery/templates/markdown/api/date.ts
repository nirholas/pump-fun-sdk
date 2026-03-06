import { PluginErrorType, createErrorResponse } from '@sperax/plugin-sdk';

export const config = {
  runtime: 'edge',
};

interface DateRequest {
  format?: 'short' | 'long' | 'iso';
  locale?: string;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return createErrorResponse(PluginErrorType.MethodNotAllowed);
  }

  try {
    const { format = 'long', locale = 'en-US' } = (await req.json()) as DateRequest;

    const now = new Date();
    let dateString: string;
    let formatDescription: string;

    switch (format) {
      case 'short':
        dateString = now.toLocaleDateString(locale, {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
        });
        formatDescription = 'Short';
        break;
      case 'iso':
        dateString = now.toISOString().split('T')[0];
        formatDescription = 'ISO 8601';
        break;
      case 'long':
      default:
        dateString = now.toLocaleDateString(locale, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        formatDescription = 'Long';
        break;
    }

    // Return plain Markdown
    const markdown = `## 📅 Current Date

**${dateString}**

- **Format:** ${formatDescription}
- **Locale:** ${locale}
- **Timestamp:** ${now.getTime()}
`;

    return new Response(markdown, {
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    return new Response(`## ⚠️ Error

Could not format date: ${error instanceof Error ? error.message : 'Unknown error'}
`, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
