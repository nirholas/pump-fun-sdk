import { ReactNode } from 'react';

/**
 * 插件渲染函数
 * @param props - 插件渲染属性
 * @returns React 节点
 */
export type PluginRender<T = any> = (props: PluginRenderProps<T>) => ReactNode;

/**
 * 插件渲染属性
 * @template Result - 结果类型，默认为 any
 */
export interface PluginRenderProps<Result = any> {
  /**
   * 内容
   */
  content: Result;
  /**
   * 名称
   */
  name: string;
}
