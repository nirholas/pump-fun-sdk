import { ChatCompletionFunctions } from './schema';

/**
 * 插件项
 * @template Result - 结果类型，默认为 any
 * @template RunnerParams - 运行参数类型，默认为 any
 */
export interface PluginItem<Result = any, RunnerParams = any> {
  /**
   * 头像
   */
  avatar: string;
  /**
   * 名称
   */
  name: string;
  /**
   * 运行器
   * @param params - 运行参数
   * @returns 运行结果的 Promise
   */
  runner: PluginRunner<RunnerParams, Result>;
  /**
   * 聊天完成函数的模式
   */
  schema: ChatCompletionFunctions;
}

/**
 * 插件运行器
 * @template Params - 参数类型，默认为 object
 * @template Result - 结果类型，默认为 any
 * @param params - 运行参数
 * @returns 运行结果的 Promise
 */
export type PluginRunner<Params = object, Result = any> = (params: Params) => Promise<Result>;
