// https://github.com/vercel/next.js/discussions/47063#discussioncomment-5303951
import { Schema } from '@cfworker/json-schema';
import {
  IPluginErrorType,
  SperaxOSPluginApi,
  SperaxOSPluginManifest,
  SperaxOSPluginsMarketIndex,
  PluginErrorType,
  PluginRequestPayload,
  createHeadersWithPluginSettings,
  marketIndexSchema,
  pluginManifestSchema,
  pluginMetaSchema,
  pluginRequestPayloadSchema,
} from '@sperax/plugin-sdk';
import { OPENAPI_REQUEST_BODY_KEY } from '@sperax/plugin-sdk/openapi';
// @ts-ignore
import SwaggerClient from 'swagger-client';

export const DEFAULT_PLUGINS_INDEX_URL = 'https://plugin.delivery';

type IValidator = (schema: Schema, value: any) => { errors?: any; valid: boolean };

export interface GatewayOptions {
  Validator?: IValidator;
  defaultPluginSettings?: Record<string, Record<string, any>>;
  /**
   * @default https://plugin.delivery
   */
  pluginsIndexUrl?: string;
}

export interface GatewaySuccessResponse {
  data: string;
  success: true;
}
export interface GatewayErrorResponse {
  body: string | object;
  errorType: IPluginErrorType;
  success: false;
}

export class Gateway {
  private pluginIndexUrl = DEFAULT_PLUGINS_INDEX_URL;
  private _validator: IValidator | undefined;
  private defaultPluginSettings: Record<string, Record<string, any>> = {};

  constructor(options?: GatewayOptions) {
    if (options?.pluginsIndexUrl) {
      this.pluginIndexUrl = options.pluginsIndexUrl;
    }

    if (options?.defaultPluginSettings) {
      this.defaultPluginSettings = options.defaultPluginSettings;
    }

    if (options?.Validator) {
      this._validator = options.Validator;
    }
  }

  private createSuccessResponse = (data: string) => {
    return { data, success: true } as const;
  };

  private createErrorResponse = (errorType: IPluginErrorType | string, body?: string | object) => {
    throw { body, errorType, success: false };
  };

  private async validate(schema: Schema, value: any) {
    if (this._validator) return this._validator(schema, value);

    // reason to use cfworker json schema:
    // https://github.com/vercel/next.js/discussions/47063#discussioncomment-5303951
    const { Validator } = await import('@cfworker/json-schema');
    const v = new Validator(schema);
    const validator = v.validate(value);
    if (!validator.valid) return { errors: validator.errors, valid: false };
    return { valid: true };
  }

  execute = async (
    payload: PluginRequestPayload,
    settings?: any,
  ): Promise<GatewaySuccessResponse> => {
    // ==========  2. 校验请求入参基础格式 ========== //
    const payloadParseResult = pluginRequestPayloadSchema.safeParse(payload);
    if (!payloadParseResult.success)
      return this.createErrorResponse(PluginErrorType.BadRequest, payloadParseResult.error);

    const { identifier, arguments: args, indexUrl, apiName } = payload;

    let manifest = payload.manifest as SperaxOSPluginManifest | undefined;
    console.info(`[${identifier}] - ${apiName} `);

    // 入参中如果没有 manifest，则从插件市场索引中获取
    if (!manifest) {
      const marketIndexUrl = indexUrl ?? this.pluginIndexUrl;
      // ==========  3. 获取插件市场索引 ========== //

      let marketIndex: SperaxOSPluginsMarketIndex | undefined;
      try {
        const indexRes = await fetch(marketIndexUrl);
        marketIndex = await indexRes.json();
      } catch (error) {
        console.error(error);
        marketIndex = undefined;
      }

      // 插件市场索引不存在
      if (!marketIndex)
        return this.createErrorResponse(PluginErrorType.PluginMarketIndexNotFound, {
          indexUrl: marketIndexUrl,
          message: '[gateway] plugin market index not found',
        });

      // 插件市场索引解析失败
      const indexParseResult = marketIndexSchema.safeParse(marketIndex);

      if (!indexParseResult.success)
        return this.createErrorResponse(PluginErrorType.PluginMarketIndexInvalid, {
          error: indexParseResult.error,
          indexUrl: marketIndexUrl,
          marketIndex,
          message: '[gateway] plugin market index is invalid',
        });

      console.info(
        `[marketIndex V${marketIndex.schemaVersion}] total ${marketIndex.plugins.length} plugins`,
      );

      // ==========  4. 校验插件 meta 完备性 ========== //

      const pluginMeta = marketIndex.plugins.find((i) => i.identifier === identifier);

      // 一个不规范的插件示例
      // const pluginMeta = {
      //   createAt: '2023-08-12',
      //   homepage: 'https://github.com/nirholas/plugin.delivery-real-time-weather',
      //   manifest: 'https://registry.npmmirror.com/@sperax/sperax-plugins/latest/files',
      //   meta: {
      //     avatar: '☂️',
      //     tags: ['weather', 'realtime'],
      //   },
      //   name: 'realtimeWeather',
      //   schemaVersion: 'v1',
      // };

      // 校验插件是否存在
      if (!pluginMeta)
        return this.createErrorResponse(PluginErrorType.PluginMetaNotFound, {
          identifier,
          message: `[gateway] plugin '${identifier}' is not found，please check the plugin list in ${marketIndexUrl}, or create an issue to [sperax-plugins](https://github.com/nirholas/plugin.delivery/issues)`,
        });

      const metaParseResult = pluginMetaSchema.safeParse(pluginMeta);

      if (!metaParseResult.success)
        return this.createErrorResponse(PluginErrorType.PluginMetaInvalid, {
          error: metaParseResult.error,
          message: '[plugin] plugin meta is invalid',
          pluginMeta,
        });
      // ==========  5. 校验插件 manifest 完备性 ========== //

      // 获取插件的 manifest
      try {
        const pluginRes = await fetch(pluginMeta.manifest);
        manifest = (await pluginRes.json()) as SperaxOSPluginManifest;
      } catch (error) {
        console.error(error);
        manifest = undefined;
      }

      if (!manifest)
        return this.createErrorResponse(PluginErrorType.PluginManifestNotFound, {
          manifestUrl: pluginMeta.manifest,
          message: '[plugin] plugin manifest not found',
        });
    }

    const manifestParseResult = pluginManifestSchema.safeParse(manifest);

    if (!manifestParseResult.success)
      return this.createErrorResponse(PluginErrorType.PluginManifestInvalid, {
        error: manifestParseResult.error,
        manifest: manifest,
        message: '[plugin] plugin manifest is invalid',
      });

    // console.log(`[${identifier}] plugin manifest:`, manifest);

    const defaultSettings = this.defaultPluginSettings[identifier] || {};
    const finalSettings = { ...defaultSettings, ...settings };
    // ==========  6. 校验是否按照 manifest 包含了 settings 配置 ========== //

    if (manifest.settings) {
      const { valid, errors } = await this.validate(manifest.settings as any, finalSettings);

      if (!valid)
        return this.createErrorResponse(PluginErrorType.PluginSettingsInvalid, {
          error: errors,
          message: '[plugin] your settings is invalid with plugin manifest setting schema',
          settings,
        });
    }

    // ==========  7. 校验请求入参与 manifest 要求一致性 ========== //
    const api = manifest.api.find((i) => i.name === apiName);

    if (!api)
      return this.createErrorResponse(PluginErrorType.PluginApiNotFound, {
        manifest,
        message: '[plugin] api not found',
        request: {
          apiName,
          identifier,
        },
      });

    if (args) {
      const params = JSON.parse(args!);
      const { valid, errors } = await this.validate(api.parameters as any, params);

      if (!valid)
        return this.createErrorResponse(PluginErrorType.PluginApiParamsError, {
          api,
          error: errors,
          message: '[plugin] args is invalid with plugin manifest api schema',
          request: params,
        });
    }

    // ==========  8. 兼容 OpenAPI 请求模式 ========== //
    if (manifest.openapi) {
      return await this.callOpenAPI(payload, finalSettings, manifest);
    }

    return await this.callApi(api, args, finalSettings);
  };

  private async callApi(
    api: SperaxOSPluginApi,
    args: string | undefined,
    settings: any,
  ): Promise<GatewaySuccessResponse> {
    if (!api.url)
      return this.createErrorResponse(PluginErrorType.PluginApiParamsError, {
        api,
        message: '[plugin] missing api url',
      });

    const response = await fetch(api.url, {
      body: args,
      headers: createHeadersWithPluginSettings(settings),
      method: 'POST',
    });

    // ==========  9. 发送请求 ========== //

    // 不正常的错误，直接返回请求
    if (!response.ok)
      return this.createErrorResponse(response.status as IPluginErrorType, await response.text());

    const data = await response.text();

    // console.log(`[${identifier}]`, args, `result:`, JSON.stringify(data).slice(0, 1000));

    return this.createSuccessResponse(data);
  }

  private async callOpenAPI(
    payload: PluginRequestPayload,
    settings: any = {},
    manifest: SperaxOSPluginManifest,
  ): Promise<GatewaySuccessResponse> {
    const { arguments: args, apiName } = payload;

    // @ts-ignore
    // const { default: SwaggerClient } = await import('swagger-client');

    const authorizations = {} as {
      [key: string]: any;
      basicAuth?: any;
      oauth2?: {
        accessToken: string;
        clientId: string;
        clientSecret: string;
      };
    };

    // 根据 settings 中的每个属性来构建 authorizations 对象
    for (const [key, value] of Object.entries(settings)) {
      // 处理 API Key 和 Bearer Token
      authorizations[key] = value as string;

      // TODO: Basic Auth and OAuth2
      // if (key.endsWith('_username') && key.endsWith('_password')) {
      //   // 处理 HTTP Basic Authentication
      //   const username = settings[key];
      //   const password = settings[key.replace('_username', '_password')];
      //   authorizations.basicAuth = new SwaggerClient.PasswordAuthorization(username, password);
      //   console.log(authorizations.basicAuth);
      // } else if (
      //   key.endsWith('_clientId') &&
      //   key.endsWith('_clientSecret') &&
      //   key.endsWith('_accessToken')
      // ) {
      //   // 处理 OAuth2
      //   const clientId = settings[key];
      //   const clientSecret = settings[key.replace('_clientId', '_clientSecret')];
      //   const accessToken = settings[key.replace('_clientId', '_accessToken')];
      //   authorizations.oauth2 = { accessToken, clientId, clientSecret };
      // }
    }

    let client;
    try {
      client = await SwaggerClient({ authorizations, url: manifest.openapi });
    } catch (error) {
      return this.createErrorResponse(PluginErrorType.PluginOpenApiInitError, {
        error: error,
        message: '[plugin] openapi client init error',
        openapi: manifest.openapi,
      });
    }

    const requestParams = JSON.parse(args || '{}');
    const { [OPENAPI_REQUEST_BODY_KEY]: requestBody, ...parameters } = requestParams;

    try {
      const res = await client.execute({ operationId: apiName, parameters, requestBody });

      return this.createSuccessResponse(res.text);
    } catch (error) {
      // 如果没有 status，说明没有发送请求，可能是 openapi 相关调用实现的问题
      if (!(error as any).status) {
        console.error(error);

        return this.createErrorResponse(PluginErrorType.PluginGatewayError, {
          apiName,
          authorizations,
          error: (error as Error).message,
          message:
            '[plugin] there are problem with sending openapi request, please contact with Sperax Team',
          openapi: manifest.openapi,
          parameters,
          requestBody,
        });
      }

      // 如果是 401 则说明是鉴权问题
      if ((error as Response).status === 401)
        return this.createErrorResponse(PluginErrorType.PluginSettingsInvalid);

      return this.createErrorResponse(PluginErrorType.PluginServerError, { error });
    }
  }
}
