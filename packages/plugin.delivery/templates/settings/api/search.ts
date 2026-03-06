import {
  PluginErrorType,
  createErrorResponse,
  getPluginSettingsFromRequest,
} from '@sperax/plugin-sdk';

export const config = {
  runtime: 'edge',
};

// Define the shape of your settings
interface PluginSettings {
  API_KEY: string;
  DEFAULT_LIMIT?: number;
  SAFE_SEARCH?: boolean;
}

interface SearchRequest {
  query: string;
  limit?: number;
}

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  url: string;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return createErrorResponse(PluginErrorType.MethodNotAllowed);
  }

  // Retrieve settings from request headers
  // Settings are passed by the gateway in the X-Sperax-Plugin-Settings header
  const settings = getPluginSettingsFromRequest<PluginSettings>(req);

  // Validate required settings
  if (!settings) {
    return createErrorResponse(PluginErrorType.PluginSettingsInvalid, {
      message: 'Plugin settings not found. Please configure the plugin.',
    });
  }

  if (!settings.API_KEY) {
    return createErrorResponse(PluginErrorType.PluginSettingsInvalid, {
      message: 'API key is required. Please add your API key in plugin settings.',
    });
  }

  if (settings.API_KEY.length < 32) {
    return createErrorResponse(PluginErrorType.PluginSettingsInvalid, {
      message: 'Invalid API key format. Key must be at least 32 characters.',
    });
  }

  try {
    const { query, limit } = (await req.json()) as SearchRequest;

    if (!query) {
      return createErrorResponse(PluginErrorType.PluginApiParamsError, {
        message: 'Search query is required',
      });
    }

    // Use settings in your API call
    const effectiveLimit = limit || settings.DEFAULT_LIMIT || 10;
    const safeSearch = settings.SAFE_SEARCH ?? true;

    // Mock search results - replace with real API call using settings.API_KEY
    // Example:
    // const response = await fetch('https://api.example.com/search', {
    //   headers: { 'Authorization': `Bearer ${settings.API_KEY}` },
    //   body: JSON.stringify({ query, limit: effectiveLimit, safe: safeSearch })
    // });

    const mockResults: SearchResult[] = [
      {
        id: '1',
        title: `Result for "${query}"`,
        snippet: `This is a mock result for your search query. Safe search: ${safeSearch}`,
        url: 'https://example.com/result/1',
      },
      {
        id: '2',
        title: `Another result for "${query}"`,
        snippet: 'This demonstrates how settings are used in plugin APIs.',
        url: 'https://example.com/result/2',
      },
    ].slice(0, effectiveLimit);

    return new Response(
      JSON.stringify({
        query,
        results: mockResults,
        total: mockResults.length,
        settings_used: {
          limit: effectiveLimit,
          safe_search: safeSearch,
          // Never expose the API key in responses!
        },
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
