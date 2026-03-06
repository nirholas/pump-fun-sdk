import {
  PluginErrorType,
  PluginRequestPayload,
  createErrorResponse,
  getPluginSettingsFromRequest,
} from '@sperax/plugin-sdk';

import cors, { CorsOptions } from './cors';
import { Gateway, GatewayErrorResponse, GatewayOptions } from './gateway';

export interface EdgeRuntimeGatewayOptions extends GatewayOptions {
  cors?: CorsOptions;
}

/**
 * create Gateway Edge Function with plugins index url
 * @param options {EdgeRuntimeGatewayOptions}
 */
export const createGatewayOnEdgeRuntime = (options: EdgeRuntimeGatewayOptions = {}) => {
  const gateway = new Gateway(options);

  const handler = async (req: Request): Promise<Response> => {
    // ==========  1. 校验请求方法 ========== //
    if (req.method !== 'POST')
      return createErrorResponse(PluginErrorType.MethodNotAllowed, {
        message: '[gateway] only allow POST method',
      });

    const requestPayload = (await req.json()) as PluginRequestPayload;
    const settings = getPluginSettingsFromRequest(req);

    try {
      const res = await gateway.execute(requestPayload, settings);
      return new Response(res.data);
    } catch (error) {
      const { errorType, body } = error as GatewayErrorResponse;

      if (!errorType) {
        const err = error as Error;
        console.error(err.stack);
        return createErrorResponse(PluginErrorType.PluginGatewayError, {
          stack: err.stack,
        });
      }
      return createErrorResponse(errorType, body);
    }
  };

  return async (req: Request) => cors(req, await handler(req), options.cors);
};
