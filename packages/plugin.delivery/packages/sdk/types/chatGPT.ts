export interface ChatGPTPluginManifest {
  HttpAuthorizationType?: HttpAuthorizationType;
  ManifestAuthType?: ManifestAuthType;
  /**
   * API specification
   * @desc The specification for the plugin's API
   * @nameCN API规范
   * @descCN OpenAI 插件的 API 规范
   */
  api: {
    /**
     * Type of API specification
     * @desc The type of the API specification
     * @nameCN API规范的类型
     * @descCN API规范的类型
     */
    type: 'openapi';
    /**
     * URL of the OpenAPI specification file
     * @desc The URL of the OpenAPI specification file
     * @nameCN OpenAPI规范文件的URL
     * @descCN OpenAPI规范文件的URL
     */
    url: string;
  };
  /**
   * Authentication schema
   * @desc The authentication schema for the plugin
   * @nameCN 认证模式
   * @descCN 插件的认证模式
   */
  auth: ManifestAuth;
  /**
   * Email contact for safety/moderation, support, and deactivation
   * @desc The email contact for safety/moderation, support, and deactivation of the plugin
   * @nameCN 邮件联系方式
   * @descCN 插件的安全/审核，支持和停用的电子邮件联系方式
   */
  contact_email: string;
  /**
   * Human-readable description of the plugin. 100 character max.
   * @desc A human-readable description of the plugin. Maximum length of 100 characters.
   * @nameCN 给用户看的描述信息
   * @descCN 最大长度为100个字符。
   */
  description_for_human: string;
  /**
   * Description better tailored to the model
   * @desc A description of the plugin that is better tailored to the model. It can include considerations for token context length or keyword usage to improve plugin prompting. Maximum length of 8,000 characters.
   * @nameCN 给模型看的描述
   * @descCN 更适合模型的描述，可以包括对令牌上下文长度或关键字使用的考虑，以改进插件提示。最大长度为8,000个字符。
   */
  description_for_model: string;
  /**
   * Redirect URL for users to view plugin information
   * @desc The redirect URL for users to view information about the plugin
   * @nameCN 重定向URL，用于用户查看插件信息
   * @descCN 用户查看插件信息的重定向URL
   */
  legal_info_url: string;
  /**
   * Plugin Logo URL
   * @desc The URL used to fetch the logo of the plugin. It should have a suggested size of 512 x 512 pixels. Transparent backgrounds are supported. Only images are allowed, GIFs are not allowed.
   * @nameCN 插件 Logo URL
   * @descCN 用于获取插件徽标的URL。建议大小为 512 x 512 px。支持透明背景。只允许图片，不允许GIF。
   */
  logo_url: string;
  /**
   * Human-readable Name
   * @desc The human-readable name of the plugin, such as the full company name. Maximum length of 20 characters.
   * @nameCN 给用户看的名称
   * @descCN 比如完整的公司名称。最大长度为20个字符。
   */
  name_for_human: string;

  /**
   * Name the model will use to target the plugin
   * @desc The name that the model will use to target the plugin. It should not contain any spaces and should only consist of letters and numbers. Maximum length of 50 characters.
   * @nameCN 给模型看的插件名称
   * @descCN 帮助模型定位插件的名称。它不应包含任何空格，只能由字母和数字组成。最大长度为50个字符。
   */
  name_for_model: string;
  /**
   * Manifest schema version
   * @desc The version of the plugin manifest schema
   * @nameCN 插件清单的版本
   */
  schema_version: 'v1';
}

// Authentication schema types

/**
 * Type of HTTP authorization
 */
export type HttpAuthorizationType = 'bearer' | 'basic';

/**
 * Type of authentication
 */
export type ManifestAuthType = 'none' | 'user_http' | 'service_http' | 'oauth';

/**
 * Base authentication schema
 */
export interface BaseManifestAuth {
  /**
   * Instructions for authentication
   */
  instructions: string;
  /**
   * Type of authentication
   */
  type: ManifestAuthType;
}

/**
 * No authentication required
 */
export interface ManifestNoAuth extends BaseManifestAuth {
  /**
   * Type of authentication
   */
  type: 'none';
}

/**
 * Service-level HTTP authentication
 */
export interface ManifestServiceHttpAuth extends BaseManifestAuth {
  /**
   * Type of HTTP authorization
   */
  authorization_type: HttpAuthorizationType;
  /**
   * Type of authentication
   */
  type: 'service_http';
  /**
   * Verification tokens for service
   */
  verification_tokens?: {
    [service: string]: string;
  };
}

/**
 * User-level HTTP authentication
 */
export interface ManifestUserHttpAuth extends BaseManifestAuth {
  /**
   * Type of HTTP authorization
   */
  authorization_type: HttpAuthorizationType;
  /**
   * Type of authentication
   */
  type: 'user_http';
}

/**
 * OAuth authentication
 */
export interface ManifestOAuthAuth extends BaseManifestAuth {
  /**
   * When exchanging OAuth code with access token, the expected header 'content-type'. For example: 'content-type: application/json'
   */
  authorization_content_type: string;
  /**
   * Endpoint used to exchange OAuth code with access token.
   */
  authorization_url: string;
  /**
   * OAuth URL where a user is directed to for the OAuth authentication flow to begin.
   */
  client_url: string;
  /**
   * OAuth scopes required to accomplish operations on the user's behalf.
   */
  scope: string;
  /**
   * Type of authentication
   */
  type: 'oauth';
  /**
   * Verification tokens for service
   */
  verification_tokens?: {
    [service: string]: string;
  };
}

/**
 * Authentication schema
 */
export type ManifestAuth =
  | ManifestNoAuth
  | ManifestServiceHttpAuth
  | ManifestUserHttpAuth
  | ManifestOAuthAuth;
