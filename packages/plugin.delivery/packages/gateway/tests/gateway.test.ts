import { PluginRequestPayload } from '@sperax/chat-plugin-sdk';
import { Gateway } from '@sperax/chat-plugins-gateway';
import Ajv from 'ajv';
// @ts-ignore
import SwaggerClient from 'swagger-client';
import { describe, expect, it, vi } from 'vitest';

vi.mock('swagger-client', () => ({
  default: vi.fn(),
}));

describe('Gateway', () => {
  it('should init with pluginIndexUrl', () => {
    const gateway = new Gateway({ pluginsIndexUrl: 'https://test-market-index-url.com' });

    expect(gateway['pluginIndexUrl']).toBe('https://test-market-index-url.com');
  });

  describe('using AJV Validator', () => {
    const gateway = new Gateway({
      Validator: (schema, value) => {
        const ajv = new Ajv({ strict: false });
        const validate = ajv.compile(schema);

        const valid = validate(value);
        return {
          errors: validate.errors,
          valid,
        };
      },
    });

    it('run with ajv validator', async () => {
      const mockResult = JSON.stringify({ success: true });
      vi.mocked(SwaggerClient).mockResolvedValue({
        execute: vi.fn().mockResolvedValue({
          status: 200,
          text: mockResult,
        }),
      });

      const payload = {
        apiName: 'getWeatherForecast',
        arguments: '{}',
        identifier: 'mock-weather',
        manifest: {
          $schema: '../node_modules/@sperax/chat-plugin-sdk/schema.json',
          api: [
            {
              description: 'Get weather forecast for a location',
              name: 'getWeatherForecast',
              parameters: {
                properties: {},
                type: 'object',
              },
            },
          ],
          author: 'sperax',
          createdAt: '2023-12-11',
          identifier: 'mock-weather',
          meta: {
            avatar: '☀️',
            description: 'Weather Forecast Plugin',
            tags: ['weather', 'forecast', 'utility'],
            title: 'Weather Forecast',
          },
          openapi:
            'https://weather.plugin.delivery/openapi.json',
          settings: {
            properties: {
              apiKeyAuth: {
                description: 'apiKeyAuth API Key',
                format: 'password',
                title: 'X-OpenAPIHub-Key',
                type: 'string',
              },
            },
            required: ['apiKeyAuth'],
            type: 'object',
          },
          version: '1',
        },
        type: 'default',
      } as PluginRequestPayload;

      const res = await gateway.execute(payload, { apiKeyAuth: 'abc' });

      expect(res.success).toBeTruthy();
      expect(res.data).toEqual(mockResult);
    });

    it('run with ajv with $$refs', async () => {
      const mockResult = JSON.stringify({ success: true });
      vi.mocked(SwaggerClient).mockResolvedValue({
        execute: vi.fn().mockResolvedValue({
          status: 200,
          text: mockResult,
        }),
      });

      const payload = {
        apiName: 'getWeatherByCity',
        arguments: '{"city":"new-york"}',
        identifier: 'mock-weather',
        manifest: {
          $schema: '../node_modules/@sperax/chat-plugin-sdk/schema.json',
          api: [
            {
              description: 'Get weather for a specific city',
              name: 'getWeatherByCity',
              parameters: {
                properties: {
                  city: {
                    $$ref: 'https://chat-dev.sperax.com/chat#/components/schemas/City',
                    enum: [
                      'new-york',
                      'los-angeles',
                      'chicago',
                      'houston',
                      'phoenix',
                      'philadelphia',
                    ],
                    type: 'string',
                  },
                },
                required: ['city'],
                type: 'object',
              },
            },
            {
              description: 'Get weather forecast for a location',
              name: 'getWeatherForecast',
              parameters: { properties: {}, type: 'object' },
            },
          ],
          author: 'sperax',
          createdAt: '2023-12-11',
          identifier: 'mock-weather',
          meta: {
            avatar: '☀️',
            description: 'Weather Forecast Plugin',
            tags: ['weather', 'forecast', 'utility'],
            title: 'Weather Forecast',
          },
          openapi:
            'https://weather.plugin.delivery/openapi.json',
          settings: {
            properties: {
              apiKeyAuth: {
                description: 'apiKeyAuth API Key',
                format: 'password',
                title: 'X-OpenAPIHub-Key',
                type: 'string',
              },
            },
            required: ['apiKeyAuth'],
            type: 'object',
          },
          version: '1',
        },
        type: 'default',
      } as PluginRequestPayload;

      const res = await gateway.execute(payload, { apiKeyAuth: 'abc' });

      expect(res.success).toBeTruthy();
      expect(res.data).toEqual(mockResult);
    });
  });
});
