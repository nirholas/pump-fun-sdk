import { OpenAPIConvertor } from '@sperax/chat-plugin-sdk/openapi';
import { describe, expect, it } from 'vitest';

import ChatWithPDF from './fixtures/ChatWithPDF.json';
import OpenAPI_Auth_API_Key from './fixtures/OpenAPI_Auth_API_Key.json';
import OpenAPIV2 from './fixtures/OpenAPI_V2.json';
import openAPIV3 from './fixtures/OpenAPI_V3.json';
import OpenAPI_V3_0_2 from './fixtures/OpenAPI_V3_0_2.json';

describe('OpenAPIConvertor', () => {
  describe('convertOpenAPIToPluginSchema', () => {
    it('can convert OpenAPI v3.1 to sperax apis', async () => {
      const convertor = new OpenAPIConvertor(openAPIV3);
      const plugins = await convertor.convertOpenAPIToPluginSchema();

      expect(plugins).toMatchSnapshot();
    });

    it('can convert OpenAPI v2 MJ openAPI', async () => {
      const convertor = new OpenAPIConvertor(OpenAPIV2);
      const plugins = await convertor.convertOpenAPIToPluginSchema();

      expect(plugins).toMatchSnapshot();
    });

    it('can convert OpenAPI v3.0.2 openAPI', async () => {
      const convertor = new OpenAPIConvertor(OpenAPI_V3_0_2);
      const plugins = await convertor.convertOpenAPIToPluginSchema();

      expect(plugins).toMatchSnapshot();
    });

    it('ChatWithPDF', async () => {
      const convertor = new OpenAPIConvertor(ChatWithPDF);
      const plugins = await convertor.convertOpenAPIToPluginSchema();

      expect(plugins).toMatchSnapshot();
    });
  });

  describe('convertAuthToSettingsSchema', () => {
    it('do not need has settings', async () => {
      const convertor = new OpenAPIConvertor(OpenAPIV2);
      const plugins = await convertor.convertAuthToSettingsSchema();

      expect(plugins).toEqual({
        properties: {},
        type: 'object',
      });
    });

    it('can convert OpenAPI Bear key to settings', async () => {
      const convertor = new OpenAPIConvertor(openAPIV3);
      const plugins = await convertor.convertAuthToSettingsSchema();

      expect(plugins).toEqual({
        properties: {
          HTTPBearer: {
            description: 'HTTPBearer Bearer token',
            format: 'password',
            title: 'HTTPBearer',
            type: 'string',
          },
        },
        required: ['HTTPBearer'],
        type: 'object',
      });
    });

    it('can convert OpenAPI Auth API key to settings', async () => {
      const convertor = new OpenAPIConvertor(OpenAPI_Auth_API_Key);

      const settings = await convertor.convertAuthToSettingsSchema({
        properties: {
          abc: {},
        },
        required: ['abc', 'apiKeyAuth'],
        type: 'object',
      });

      expect(settings).toEqual({
        properties: {
          abc: {},
          apiKeyAuth: {
            description: 'apiKeyAuth API Key',
            format: 'password',
            title: 'X-OpenAPIHub-Key',
            type: 'string',
          },
        },
        required: ['abc', 'apiKeyAuth'],
        type: 'object',
      });
    });

    it('can convert OpenAPI Basic Auth to settings', async () => {
      // 假设的 OpenAPI 配置示例，需要根据实际情况调整
      const OpenAPI_Basic_Auth = {
        components: {
          securitySchemes: { basicAuth: { scheme: 'basic', type: 'http' } },
        },
      };
      const convertor = new OpenAPIConvertor(OpenAPI_Basic_Auth);

      const plugins = await convertor.convertAuthToSettingsSchema();

      expect(plugins).toEqual({
        properties: {
          basicAuth: {
            description: 'Basic authentication credentials',
            format: 'password',
            type: 'string',
          },
        },
        required: ['basicAuth'],
        type: 'object',
      });
    });

    it('can convert OpenAPI OAuth2 to settings', async () => {
      const OpenAPI_OAuth2 = {
        components: { securitySchemes: { oauth2: { type: 'oauth2' } } },
      };
      const convertor = new OpenAPIConvertor(OpenAPI_OAuth2);

      const plugins = await convertor.convertAuthToSettingsSchema();

      expect(plugins).toEqual({
        properties: {
          oauth2_accessToken: {
            description: 'Access token for OAuth2',
            format: 'password',
            type: 'string',
          },
          oauth2_clientId: {
            description: 'Client ID for OAuth2',
            type: 'string',
          },
          oauth2_clientSecret: {
            description: 'Client Secret for OAuth2',
            format: 'password',
            type: 'string',
          },
        },
        required: ['oauth2_clientId', 'oauth2_clientSecret', 'oauth2_accessToken'],
        type: 'object',
      });
    });

    it('should handle cases where securitySchemes is undefined', async () => {
      const convertor = new OpenAPIConvertor({});
      const plugins = await convertor.convertAuthToSettingsSchema();

      expect(plugins).toEqual({
        properties: {},
        type: 'object',
      });
    });

    it('should handle cases where components is undefined', async () => {
      const openApiWithoutComponents = { paths: {} };

      const convertor = new OpenAPIConvertor(openApiWithoutComponents);
      const plugins = await convertor.convertAuthToSettingsSchema();

      expect(plugins).toEqual({
        properties: {},
        type: 'object',
      });
    });
  });
});
