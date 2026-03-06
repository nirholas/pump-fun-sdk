/**
 * SperaxOS Plugins
 * @desc SperaxOS Plugins interface
 * @nameCN 插件列表
 * @descCN 插件市场的列表接口
 */
export interface SperaxOSPluginsMarketIndex {
  /**
   * plugins
   * @desc List of plugin items
   * @nameCN 插件列表
   * @descCN 插件项列表
   */
  plugins: SperaxOSPluginMeta[];
  /**
   * version
   * @desc Version of the plugins
   * @nameCN 版本
   * @descCN 插件的版本
   */
  schemaVersion: 1;
}

/**
 * Plugin Item
 * @desc Plugin item interface
 * @nameCN 插件项
 * @descCN 插件项接口
 */
export interface SperaxOSPluginMeta {
  author: string;
  /**
   * @deprecated
   */
  createAt?: string;
  /**
   * createAt
   * @desc Creation date of the plugin
   * @nameCN 创建时间
   * @descCN 插件的创建时间
   */
  createdAt: string;
  /**
   * homepage
   * @desc Homepage of the plugin
   * @nameCN 主页
   * @descCN 插件的主页
   */
  homepage: string;
  /**
   * plugin identifier
   * @nameCN 插件的名称
   */
  identifier: string;
  /**
   * manifest url of this plugin
   * @desc Manifest of the plugin
   * @nameCN 插件的线上 manifest url
   */
  manifest: string;
  /**
   * metadata
   * @desc Meta data of the plugin
   * @nameCN 插件元数据
   * @descCN 包含图片与标签等
   */
  meta: Meta;
  /**
   * Manifest schema version
   * @desc The version of the plugin manifest schema
   * @nameCN 插件清单的版本
   */
  schemaVersion: number;
}

/**
 * Meta
 * @desc Meta data interface
 * @nameCN 元数据
 * @descCN 元数据接口
 */
export interface Meta {
  /**
   * avatar
   * @desc Avatar of the plugin
   * @nameCN 头像
   * @descCN 插件的头像
   */
  avatar: string;
  /**
   * description
   * @desc Description of the plugin
   * @nameCN 描述
   * @descCN 插件的描述
   */
  description?: string;
  /**
   * tags
   * @desc Tags of the plugin
   * @nameCN 标签
   * @descCN 插件的标签
   */
  tags?: string[];
  title: string;
}
