import SwaggerParser from '@apidevtools/swagger-parser';
import { convertParametersToJSONSchema } from 'openapi-jsonschema-parameters';
import { OpenAPI, OpenAPIV3_1 } from 'openapi-types';

import { pluginApiSchema } from '../schema/manifest';
import { SperaxOSPluginApi, PluginSchema } from '../types';

export const OPENAPI_REQUEST_BODY_KEY = '_requestBody';

export class OpenAPIConvertor {
  private readonly openapi: object;
  constructor(openapi: object) {
    this.openapi = openapi;
  }

  convertOpenAPIToPluginSchema = async () => {
    const api = await SwaggerParser.dereference(this.openapi as OpenAPI.Document);

    const paths = api.paths!;
    const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

    const plugins: SperaxOSPluginApi[] = [];

    for (const [path, operations] of Object.entries(paths)) {
      for (const method of methods) {
        const operation = (operations as any)[method];
        if (operation) {
          const parametersSchema = convertParametersToJSONSchema(operation.parameters || []);
          const requestBodySchema = this.convertRequestBodyToSchema(operation.requestBody);

          const parameters = this.mergeSchemas(...Object.values(parametersSchema));

          if (requestBodySchema && requestBodySchema.properties && Object.keys(requestBodySchema.properties).length > 0) {
            parameters.properties[OPENAPI_REQUEST_BODY_KEY] = requestBodySchema;
            parameters.required?.push('_requestBody');
          }

          // 保留原始逻辑作为备选
          const name = operation.operationId || `${method.toUpperCase()} ${path}`;

          const description = operation.summary || operation.description || name;

          const plugin = { description, name, parameters } as SperaxOSPluginApi;

          const res = pluginApiSchema.safeParse(plugin);
          if (res.success) plugins.push(plugin);
          else {
            throw res.error;
          }
        }
      }
    }

    return plugins;
  };

  convertAuthToSettingsSchema = async (
    // eslint-disable-next-line unicorn/no-object-as-default-parameter
    rawSettingsSchema: PluginSchema = { properties: {}, type: 'object' },
  ): Promise<PluginSchema> => {
    let settingsSchema = rawSettingsSchema;

    // @ts-ignore
    const { default: SwaggerClient } = await import('swagger-client');

    // 使用 SwaggerClient 解析 OpenAPI JSON
    const openAPI = await SwaggerClient.resolve({ spec: this.openapi });
    const api = openAPI.spec;

    for (const entry of Object.entries(api.components?.securitySchemes || {})) {
      let authSchema = {} as PluginSchema;
      const [key, value] = entry as [string, any];

      switch (value.type) {
        case 'apiKey': {
          authSchema = {
            properties: {
              [key]: {
                description: value.description || `${key} API Key`,
                format: 'password',
                title: value.name,
                type: 'string',
              },
            },
            required: [key],
            type: 'object',
          };
          break;
        }
        case 'http': {
          if (value.scheme === 'basic') {
            authSchema = {
              properties: {
                [key]: {
                  description: 'Basic authentication credentials',
                  format: 'password',
                  type: 'string',
                },
              },
              required: [key],
              type: 'object',
            };
          } else if (value.scheme === 'bearer') {
            authSchema = {
              properties: {
                [key]: {
                  description: value.description || `${key} Bearer token`,
                  format: 'password',
                  title: key,
                  type: 'string',
                },
              },
              required: [key],
              type: 'object',
            };
          }
          break;
        }
        case 'oauth2': {
          authSchema = {
            properties: {
              [`${key}_clientId`]: {
                description: 'Client ID for OAuth2',
                type: 'string',
              },
              [`${key}_clientSecret`]: {
                description: 'Client Secret for OAuth2',
                format: 'password',
                type: 'string',
              },
              [`${key}_accessToken`]: {
                description: 'Access token for OAuth2',
                format: 'password',
                type: 'string',
              },
            },
            required: [`${key}_clientId`, `${key}_clientSecret`, `${key}_accessToken`],
            type: 'object',
          };
          break;
        }
      }

      // 合并当前鉴权机制的 schema 到 settingsSchema
      Object.assign(settingsSchema.properties, authSchema.properties);

      if (authSchema.required) {
        settingsSchema.required = [
          ...new Set([...(settingsSchema.required || []), ...authSchema.required]),
        ];
      }
    }

    return settingsSchema;
  };

  private convertRequestBodyToSchema(
    requestBody: OpenAPIV3_1.RequestBodyObject,
  ): PluginSchema | null {
    if (!requestBody || !requestBody.content) {
      return null;
    }

    let requestBodySchema = {};

    // 遍历所有的 content-type
    for (const [contentType, mediaType] of Object.entries(requestBody.content)) {
      if (mediaType.schema) {
        // 直接使用已解析的 Schema
        const resolvedSchema = this.removeRequiredFields(mediaType.schema);

        // 根据不同的 content-type，可以在这里添加特定的处理逻辑
        switch (contentType) {
          case 'application/json': {
            // 直接使用解析后的 Schema 作为 JSON 的请求体定义
            requestBodySchema = resolvedSchema;
            break;
          }
          case 'application/x-www-form-urlencoded':
          case 'multipart/form-data': {
            // 这些类型通常用于文件上传和表单数据，可能需要特别处理
            requestBodySchema = resolvedSchema;
            break;
          }
          // 其他 MIME 类型...
          default: {
            // 如果遇到未知的 content-type，可以选择忽略或抛出错误
            console.warn(`Unsupported content-type: ${contentType}`);
            break;
          }
        }
      }
    }

    return requestBodySchema as PluginSchema;
  }

  private removeRequiredFields(schema: any): any {
    if (schema && typeof schema === 'object') {
      // 如果是对象类型，遍历它的每个属性
      for (const key in schema) {
        // eslint-disable-next-line no-prototype-builtins
        if (schema.hasOwnProperty(key)) {
          const value = schema[key];

          // 如果属性是 required 并且值为 true，则删除该属性
          if (key === 'required' && value === true) {
            delete schema[key];
          } else {
            // 否则，如果属性是对象或数组，则递归处理
            schema[key] = this.removeRequiredFields(value);
          }
        }
      }
    } else if (Array.isArray(schema)) {
      // 如果是数组类型，遍历每个元素
      return schema.map(this.removeRequiredFields.bind(this));
    }
    return schema;
  }

  private mergeSchemas(...schemas: any[]) {
    // 初始化合并后的 Schema
    const mergedSchema: PluginSchema = {
      properties: {},
      required: [],
      type: 'object',
    };

    // 遍历每个参数的 Schema
    for (const schema of schemas) {
      if (schema && schema.properties) {
        // 合并属性
        Object.assign(mergedSchema.properties, schema.properties);

        // 合并必需字段
        if (Array.isArray(schema.required)) {
          mergedSchema.required = [
            ...new Set([...(mergedSchema.required || []), ...schema.required]),
          ];
        }
      }
    }

    // 如果没有任何必需字段，则删除 required 属性
    if (mergedSchema.required?.length === 0) {
      delete mergedSchema.required;
    }

    return mergedSchema;
  }
}
