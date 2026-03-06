import { PluginErrorType, createErrorResponse } from '@sperax/plugin-sdk';

export const config = {
  runtime: 'edge',
};

interface GreetRequest {
  name: string;
  language?: string;
}

const greetings: Record<string, string> = {
  en: 'Hello',
  es: 'Hola',
  fr: 'Bonjour',
  de: 'Hallo',
  ja: 'こんにちは',
  zh: '你好',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return createErrorResponse(PluginErrorType.MethodNotAllowed);
  }

  try {
    const { name, language = 'en' } = (await req.json()) as GreetRequest;

    const greeting = greetings[language] || greetings.en;

    return new Response(
      JSON.stringify({
        greeting: `${greeting}, ${name}!`,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return createErrorResponse(PluginErrorType.PluginServerError, {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
