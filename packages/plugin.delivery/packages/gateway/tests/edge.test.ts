import {
  SperaxOSPluginManifest,
  PluginErrorType,
  PluginRequestPayload,
  createHeadersWithPluginSettings,
} from '@sperax/chat-plugin-sdk';
import { SPERAXOS_PLUGIN_SETTINGS } from '@sperax/chat-plugin-sdk/lib/request';
import { createGatewayOnEdgeRuntime } from '@sperax/chat-plugins-gateway';
// @ts-ignore
import SwaggerClient from 'swagger-client';
import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('fetch', vi.fn());

vi.mock('swagger-client', () => ({
  default: vi.fn(),
}));

// 模拟响应数据
const mockMarketIndex = {
  plugins: [
    {
      identifier: 'test-plugin',
      manifest: 'https://test-plugin-url.com/manifest.json',
    },
  ],
  schemaVersion: 1,
};

const mockManifest = {
  api: [
    {
      description: '',
      name: 'test-api',
      parameters: { properties: {}, type: 'object' },
      url: 'https://test-api-url.com',
    },
  ],
  identifier: 'abc',
  meta: {},
} as SperaxOSPluginManifest;

const mockManifestWithOpenAPI = {
  ...mockManifest,
  openapi: 'https://test-openapi-url.com',
};

const mockPluginRequestPayload: PluginRequestPayload = {
  apiName: 'test-api',
  arguments: '{}',
  identifier: 'test-plugin',
  indexUrl: 'https://test-market-index-url.com',
  manifest: mockManifest,
};

const mockRequest: Request = new Request('https://test-url.com', {
  body: JSON.stringify(mockPluginRequestPayload),
  method: 'POST',
});

let gateway: ReturnType<typeof createGatewayOnEdgeRuntime>;

beforeEach(() => {
  // Reset the mocked fetch before each test
  vi.resetAllMocks();
  gateway = createGatewayOnEdgeRuntime();
});

describe('createGatewayOnEdgeRuntime', () => {
  it('should execute successfully when provided with correct payload and settings', async () => {
    (fetch as Mock).mockImplementation(async (url) => {
      if (url === 'https://test-market-index-url.com')
        return {
          json: async () => mockMarketIndex,
          ok: true,
        };

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    const response = await gateway(mockRequest);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it('should return correct response when OpenAPI request is successful', async () => {
    const mockSettings = {
      apiKey: 'mock-api-key',
    };

    vi.mocked(SwaggerClient).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({
        status: 200,
        text: JSON.stringify({ success: true }),
      }),
    });

    const mockRequest: Request = new Request('https://test-url.com', {
      body: JSON.stringify({ ...mockPluginRequestPayload, manifest: mockManifestWithOpenAPI }),
      headers: createHeadersWithPluginSettings(mockSettings),
      method: 'POST',
    });

    const response = await gateway(mockRequest);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  describe('with defaultPluginSettings', () => {
    it('should execute successfully when provided with defaultPluginSettings payload', async () => {
      (fetch as Mock).mockImplementation(async (url, { headers }) => {
        if (url === 'https://test-market-index-url.com')
          return {
            json: async () => mockMarketIndex,
            ok: true,
          };

        return new Response(JSON.stringify({ headers }), { status: 200 });
      });

      const config = { abc: '123' };

      gateway = createGatewayOnEdgeRuntime({ defaultPluginSettings: { 'test-plugin': config } });

      const request: Request = new Request('https://test-url.com', {
        body: JSON.stringify(mockPluginRequestPayload),
        method: 'POST',
      });

      const response = await gateway(request);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toEqual({
        headers: { [SPERAXOS_PLUGIN_SETTINGS]: JSON.stringify(config) },
      });
    });
  });

  describe('Error', () => {
    it('only allow post method', async () => {
      const invalidPayload = { ...mockPluginRequestPayload, identifier: null }; // Invalid payload
      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify(invalidPayload),
        method: 'PUT',
      });
      const response = await gateway(mockRequest);
      expect(response.status).toBe(PluginErrorType.MethodNotAllowed);
    });
    it('should return BadRequest error when payload is invalid', async () => {
      const invalidPayload = { ...mockPluginRequestPayload, identifier: null }; // Invalid payload
      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify(invalidPayload),
        method: 'POST',
      });
      const response = await gateway(mockRequest);
      expect(response.status).toBe(PluginErrorType.BadRequest);
    });

    it('should return PluginMarketIndexNotFound error when market index is unreachable', async () => {
      (fetch as Mock).mockRejectedValue(new Error('Network error'));
      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify({
          ...mockPluginRequestPayload,
          indexUrl: undefined,
          manifest: undefined,
        }),
        method: 'POST',
      });
      const response = await gateway(mockRequest);
      expect(response.status).toBe(590);
      expect(await response.json()).toMatchSnapshot();
    });

    it('should return PluginMarketIndexInvalid error when market index is invalid', async () => {
      (fetch as Mock).mockResolvedValueOnce({
        json: async () => ({ invalid: 'index' }),
        ok: true, // Invalid market index
      });
      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify({ ...mockPluginRequestPayload, manifest: undefined }),
        method: 'POST',
      });
      const response = await gateway(mockRequest);
      expect(response.status).toBe(490);
      expect(await response.json()).toMatchSnapshot();
    });

    it('should return PluginMetaNotFound error when plugin meta does not exist', async () => {
      (fetch as Mock).mockResolvedValueOnce({
        json: async () => mockMarketIndex,
        ok: true,
      });
      const invalidPayload = {
        ...mockPluginRequestPayload,
        identifier: 'unknown-plugin',
        manifest: undefined,
      };
      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify(invalidPayload),
        method: 'POST',
      });

      const response = await gateway(mockRequest);

      expect(response.status).toEqual(404);
      expect(await response.json()).toEqual({
        body: {
          identifier: 'unknown-plugin',
          message:
            "[gateway] plugin 'unknown-plugin' is not found，please check the plugin list in https://test-market-index-url.com, or create an issue to [sperax-os-plugins](https://github.com/sperax/sperax-os-plugins/issues)",
        },
        errorType: 'PluginMetaNotFound',
      });
    });

    it('should return PluginMetaInvalid error when plugin meta is invalid', async () => {
      (fetch as Mock).mockResolvedValueOnce({
        json: async () => ({
          ...mockMarketIndex,
          plugins: [{ identifier: 'test-plugin', invalidMeta: true }],
        }),
        ok: true,
      });
      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify({ ...mockPluginRequestPayload, manifest: undefined }),
        method: 'POST',
      });
      const response = await gateway(mockRequest);
      expect(response.status).toBe(490);
      expect(await response.json()).toMatchSnapshot();
    });

    it('should return PluginManifestNotFound error when plugin manifest is unreachable', async () => {
      (fetch as Mock).mockImplementation(async (url) => {
        if (url === mockPluginRequestPayload.indexUrl)
          return {
            json: async () => ({
              ...mockMarketIndex,
              plugins: [
                {
                  author: 'test-plugin',
                  createdAt: '2023-08-12',
                  homepage: 'https://github.com/sperax/chat-plugin-real-time-weather',
                  identifier: 'test-plugin',
                  manifest: 'https://test-plugin-url.com/manifest.json',
                  meta: {
                    avatar: '☂️',
                    tags: ['weather', 'realtime'],
                    title: 'realtimeWeather',
                  },
                  schemaVersion: 1,
                },
              ],
            }),
            ok: true,
          };

        if (url === 'https://test-plugin-url.com/manifest.json')
          return {
            json: async () => {
              throw new Error('Network error');
            },
            ok: true,
          };

        throw new Error('Network error');
      });

      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify({ ...mockPluginRequestPayload, manifest: undefined }),
        method: 'POST',
      });
      const response = await gateway(mockRequest);

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchSnapshot();
    });

    it('should return PluginManifestInvalid error when plugin manifest is invalid', async () => {
      (fetch as Mock).mockImplementation(async (url) => {
        if (url === mockPluginRequestPayload.indexUrl)
          return {
            json: async () => ({
              ...mockMarketIndex,
              plugins: [
                {
                  author: 'test-plugin',
                  createdAt: '2023-08-12',
                  homepage: 'https://github.com/sperax/chat-plugin-real-time-weather',
                  identifier: 'test-plugin',
                  manifest: 'https://test-plugin-url.com/manifest.json',
                  meta: {
                    avatar: '☂️',
                    tags: ['weather', 'realtime'],
                    title: 'realtimeWeather',
                  },
                  schemaVersion: 1,
                },
              ],
            }),
            ok: true,
          };

        if (url === 'https://test-plugin-url.com/manifest.json')
          return {
            json: async () => ({ invalid: 'manifest' }),
            ok: true,
          };

        throw new Error('Network error');
      });

      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify({ ...mockPluginRequestPayload, manifest: undefined }),
        method: 'POST',
      });
      const response = await gateway(mockRequest);
      expect(response.status).toBe(490);
      expect(await response.json()).toMatchSnapshot();
    });

    it('should return PluginSettingsInvalid error when provided settings are invalid', async () => {
      const settings = { invalid: 'settings' };

      const payload = {
        ...mockPluginRequestPayload,
        manifest: {
          ...mockManifest,
          settings: { properties: { abc: { type: 'string' } }, required: ['abc'], type: 'object' },
        } as SperaxOSPluginManifest,
      };
      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify(payload),
        headers: createHeadersWithPluginSettings(settings),
        method: 'POST',
      });

      const response = await gateway(mockRequest);
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchSnapshot();
    });

    it('should return PluginSettingsInvalid error when provided empty settings', async () => {
      const payload = {
        ...mockPluginRequestPayload,
        manifest: {
          ...mockManifest,
          settings: { properties: { abc: { type: 'string' } }, required: ['abc'], type: 'object' },
        } as SperaxOSPluginManifest,
      };

      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify(payload),
        method: 'POST',
      });
      const response = await gateway(mockRequest);
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchSnapshot();
    });

    it('should return PluginApiNotFound error when apiName is not found in manifest', async () => {
      const payload = { ...mockPluginRequestPayload, apiName: 'unknown-api' };
      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify(payload),
        method: 'POST',
      });
      const response = await gateway(mockRequest);
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchSnapshot();
    });

    it('should return PluginApiParamsError when api parameters are invalid', async () => {
      const payload: PluginRequestPayload = {
        ...mockPluginRequestPayload,
        // Invalid parameters
        arguments: '{"invalid": "params"}',
        manifest: {
          ...mockManifest,
          api: [
            {
              description: '',
              name: 'test-api',
              parameters: {
                properties: { a: { type: 'string' } },
                required: ['a'],
                type: 'object',
              },
              url: 'https://test-api-url.com',
            },
          ],
        } as SperaxOSPluginManifest,
      };
      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify(payload),
        method: 'POST',
      });
      const response = await gateway(mockRequest);
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchSnapshot();
    });

    it('should return PluginApiParamsError when api url is missing', async () => {
      const manifestWithoutUrl = {
        ...mockManifest,
        api: [{ ...mockManifest.api[0], url: undefined }],
      };
      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify({ ...mockPluginRequestPayload, manifest: manifestWithoutUrl }),
        method: 'POST',
      });

      const response = await gateway(mockRequest);
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchSnapshot();
    });

    it('should return correct response when API request is successful', async () => {
      (fetch as Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );

      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify(mockPluginRequestPayload),
        method: 'POST',
      });

      const response = await gateway(mockRequest);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
    });

    it('should return error response when API request fails', async () => {
      (fetch as Mock).mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }));

      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify(mockPluginRequestPayload),
        method: 'POST',
      });

      const response = await gateway(mockRequest);
      expect(response.status).toBe(500);
      expect(await response.text()).toBe(
        JSON.stringify({ body: 'Internal Server Error', errorType: 500 }),
      );
    });
  });

  describe('OpenAPI Error', () => {
    const mockSettings = {
      apiKey: 'mock-api-key',
    };

    it('should return PluginOpenApiInitError error when openapi client init fails', async () => {
      vi.mocked(SwaggerClient).mockImplementationOnce(() => {
        throw new Error('Initialization failed');
      });

      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify({ ...mockPluginRequestPayload, manifest: mockManifestWithOpenAPI }),
        headers: createHeadersWithPluginSettings(mockSettings),
        method: 'POST',
      });

      const response = await gateway(mockRequest);
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchSnapshot();
    });

    it('should return error response when OpenAPI request fails', async () => {
      vi.mocked(SwaggerClient).mockResolvedValue({
        execute: vi.fn().mockRejectedValueOnce({
          status: 500,
          text: 'Internal Server Error',
        }),
      });

      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify({ ...mockPluginRequestPayload, manifest: mockManifestWithOpenAPI }),
        headers: createHeadersWithPluginSettings(mockSettings),
        method: 'POST',
      });

      const response = await gateway(mockRequest);
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchSnapshot();
    });
  });

  describe('OpenAPI Auth', () => {
    it.skip('should handle authorization correctly for basicAuth', async () => {
      const settingsWithBasicAuth = {
        basic_auth_password: 'testpass',
        basic_auth_username: 'testuser',
      };
      const mockSwaggerExecute = vi.fn().mockResolvedValue({
        status: 200,
        text: JSON.stringify({ success: true }),
      });
      vi.mocked(SwaggerClient).mockResolvedValue({
        execute: mockSwaggerExecute,
      });
      const PasswordAuthorization = vi
        .fn()
        .mockImplementation((u: string, p: string) => [u, p].join('-'));

      SwaggerClient['PasswordAuthorization'] = PasswordAuthorization;

      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify({ ...mockPluginRequestPayload, manifest: mockManifestWithOpenAPI }),
        headers: createHeadersWithPluginSettings(settingsWithBasicAuth),
        method: 'POST',
      });

      await gateway(mockRequest);

      expect(SwaggerClient).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizations: expect.objectContaining({
            basicAuth: expect.anything(),
          }),
          url: 'https://test-openapi-url.com',
        }),
      );
      expect(mockSwaggerExecute).toHaveBeenCalled();
    });

    it.skip('should handle authorization correctly for OAuth2', async () => {
      const settingsWithOAuth2 = {
        oauth2_accessToken: 'testtoken',
        oauth2_clientId: 'testclient',
        oauth2_clientSecret: 'testsecret',
      };
      const mockSwaggerExecute = vi.fn().mockResolvedValue({
        status: 200,
        text: JSON.stringify({ success: true }),
      });
      vi.mocked(SwaggerClient).mockResolvedValue({
        execute: mockSwaggerExecute,
      });

      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify({ ...mockPluginRequestPayload, manifest: mockManifestWithOpenAPI }),
        headers: createHeadersWithPluginSettings(settingsWithOAuth2),
        method: 'POST',
      });

      await gateway(mockRequest);

      expect(SwaggerClient).toHaveBeenCalledWith({
        authorizations: expect.objectContaining({
          oauth2: expect.objectContaining({
            accessToken: 'testtoken',
            clientId: 'testclient',
            clientSecret: 'testsecret',
          }),
        }),
        url: 'https://test-openapi-url.com',
      });
      expect(mockSwaggerExecute).toHaveBeenCalled();
    });

    it('should return PluginServerError when OpenAPI request returns non-200 status', async () => {
      const mockSwaggerExecute = vi.fn().mockRejectedValue({
        status: 400,
        text: 'Bad Request',
      });
      vi.mocked(SwaggerClient).mockResolvedValue({
        execute: mockSwaggerExecute,
      });

      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify({
          ...mockPluginRequestPayload,
          manifest: mockManifestWithOpenAPI,
        }),
        headers: createHeadersWithPluginSettings({}),
        method: 'POST',
      });

      const response = await gateway(mockRequest);

      expect(response.status).toBe(500);
      expect(await response.json()).toMatchSnapshot();
    });

    it('should return PluginGatewayError when not return status', async () => {
      const mockSwaggerExecute = vi.fn().mockRejectedValue({
        text: 'Bad Request',
      });
      vi.mocked(SwaggerClient).mockResolvedValue({
        execute: mockSwaggerExecute,
      });
      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify({
          ...mockPluginRequestPayload,
          arguments: undefined,
          manifest: mockManifestWithOpenAPI,
        }),
        headers: createHeadersWithPluginSettings({}),
        method: 'POST',
      });

      const response = await gateway(mockRequest);

      expect(response.status).toBe(500);
      expect(await response.json()).toMatchSnapshot();
    });

    it('should return PluginSettingsInvalid when OpenAPI request fails with 401', async () => {
      const mockSwaggerExecute = vi.fn().mockRejectedValue({
        status: 401,
        text: 'Unauthorized',
      });
      vi.mocked(SwaggerClient).mockResolvedValue({
        execute: mockSwaggerExecute,
      });

      const mockRequest: Request = new Request('https://test-url.com', {
        body: JSON.stringify({ ...mockPluginRequestPayload, manifest: mockManifestWithOpenAPI }),
        headers: createHeadersWithPluginSettings({}),
        method: 'POST',
      });
      const response = await gateway(mockRequest);
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchSnapshot();
    });
  });
});
