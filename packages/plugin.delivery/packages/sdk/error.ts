/* eslint-disable sort-keys-fix/sort-keys-fix */
export const PluginErrorType = {
  // ******* 业务错误语义 ******* //
  PluginMarketIndexNotFound: 'PluginMarketIndexNotFound', // 插件市场索引解析失败
  PluginMarketIndexInvalid: 'PluginMarketIndexInvalid', // 插件市场索引无效

  PluginMetaNotFound: 'PluginMetaNotFound', // 没有找到插件元数据
  PluginMetaInvalid: 'PluginMetaInvalid', // 插件元数据无效

  PluginManifestNotFound: 'PluginManifestNotFound', // 插件描述文件不存在
  PluginManifestInvalid: 'PluginManifestInvalid', // 插件描述文件格式不正确

  PluginSettingsInvalid: 'PluginSettingsInvalid', // 插件设置不正确

  PluginApiNotFound: 'PluginApiNotFound', // 插件 API 不存在
  PluginApiParamsError: 'PluginApiParamsError', // 插件 API 请求入参有问题

  PluginServerError: 'PluginServerError', // 插件服务端出错

  PluginGatewayError: 'PluginGatewayError', // 插件网关出错
  PluginOpenApiInitError: 'PluginOpenApiInitError', // 插件 OpenAPI 初始化失败

  // ******* 客户端错误 ******* //
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  ContentNotFound: 404, // 没找到接口
  MethodNotAllowed: 405, // 不支持
  TooManyRequests: 429,

  // ******* 服务端错误 ******* //
  InternalServerError: 500,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
} as const;
/* eslint-enable */

export type IPluginErrorType = (typeof PluginErrorType)[keyof typeof PluginErrorType];

export const getPluginErrorStatus = (errorType: IPluginErrorType | string) => {
  switch (errorType) {
    case PluginErrorType.PluginApiNotFound:
    case PluginErrorType.PluginMetaNotFound:
    case PluginErrorType.PluginManifestNotFound:
      return 404;

    case PluginErrorType.PluginMetaInvalid:
    case PluginErrorType.PluginMarketIndexInvalid:
    case PluginErrorType.PluginManifestInvalid:
      return 490;

    case PluginErrorType.PluginMarketIndexNotFound:
      return 590;

    case PluginErrorType.PluginApiParamsError:
    case PluginErrorType.PluginSettingsInvalid:
      return 422;
  }

  if (typeof errorType === 'number') return errorType;

  return 500;
};

export interface ErrorResponse {
  body: any;
  errorType: IPluginErrorType | string;
}

/**
 * 创建一个错误响应对象
 * @param {IPluginErrorType} errorType - 错误类型
 * @param body - 响应体数据
 * @returns {Response} - 错误响应对象
 */
export const createErrorResponse = (
  errorType: IPluginErrorType | string,
  body?: string | object,
): Response => {
  // 获取错误类型对应的状态码
  const statusCode = getPluginErrorStatus(errorType);

  // 构造错误响应数据
  const data: ErrorResponse = { body, errorType };

  // 创建并返回错误响应对象
  return new Response(JSON.stringify(data), { status: statusCode });
};
