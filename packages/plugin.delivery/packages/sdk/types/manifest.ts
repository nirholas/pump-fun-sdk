import { JSONSchema7 } from 'json-schema';

import { Meta } from './market';

export type SperaxOSPluginType = 'default' | 'standalone' | 'markdown';

/**
 * Plugin Schema
 * @desc the schema of plugin, de´scribe the api input of the function
 * @nameCN 插件清单
 * @descCN 描述一个插件的构成要素
 */
export interface PluginSchema extends Omit<JSONSchema7, 'type'> {
  properties: {
    [key: string]: JSONSchema7;
  };
  required?: string[];
  type: 'object';
}

export interface SperaxOSPluginApi {
  description: string;
  name: string;
  parameters: PluginSchema;
  /**
   * Endpoint URL
   * @desc The endpoint URL of the plugin, optional in standalone type
   * @nameCN 服务端接口
   * @descCN 插件服务端的接口地址 URL, 在 standalone 类型下是可选项
   */
  url?: string;
}

/**
 * Plugin manifest
 * @desc Represents the manifest of a plugin
 * @nameCN 插件清单
 * @descCN 描述一个插件的构成要素
 */
export interface SperaxOSPluginManifest {
  $schema?: string;
  api: SperaxOSPluginApi[];
  author?: string;
  /**
   * createAt
   * @desc Creation date of the plugin
   * @nameCN 创建时间
   * @descCN 插件的创建时间
   */
  createdAt?: string;
  gateway?: string;
  /**
   * homepage
   * @desc Homepage of the plugin
   * @nameCN 主页
   * @descCN 插件的主页
   */
  homepage?: string;
  /**
   * Plugin name
   * @desc The name of the plugin
   * @nameCN 插件名称
   * @descCN 插件的名称，需要和提交到 SperaxOS Plugins 仓库的插件名称一致
   */
  identifier: string;
  /**
   * metadata
   * @desc Meta data of the plugin
   * @nameCN 插件元数据
   * @descCN 包含图片与标签等
   */
  meta: Meta;
  openapi?: string;
  settings?: PluginSchema;
  /**
   * the plugin system role
   * @desc The system role of the plugin
   * @nameCN 系统角色
   * @descCN 插件的系统角色，将会注入到会话消息中
   */
  systemRole?: string;
  /**
   * plugin runtime type
   * @default default
   */
  type?: SperaxOSPluginType;
  /**
   * plugin ui on user side
   * @desc The type of rendering for the plugin
   * @nameCN 用户界面
   * @descCN 插件在用户侧的展示内容
   */
  ui?: {
    height?: number;
    mode?: 'iframe' | 'module';
    /**
     * component url
     * @desc The type of rendering for the plugin
     * @nameCN 动态组件
     * @descCN 插件的渲染类型
     */
    url: string;
    width?: number;
  };
  version?: '1';
}
