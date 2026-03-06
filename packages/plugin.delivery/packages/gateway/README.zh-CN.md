<a name="readme-top"></a>

<div align="center">


<h1>SperaxOS 插件网关</h1>

SperaxOS Plugin Delivery 是一个为 SperaxOS 和 Sperax 提供 Chat 插件网关的后端服务。


[English](./README.md) · **简体中文** ·
</div>

<details>
<summary><kbd>目录</kbd></summary>

#### TOC

- [👋 简介](#-简介)
- [🤯 使用方法](#-使用方法)
  - [基本 URL](#基本-url)
  - [POST 插件网关](#post-插件网关)
- [🛳 自托管](#-自托管)
  - [部署到 Vercel](#部署到-vercel)
- [📦 插件生态](#-插件生态)
- [⌨️ Local Development](#️-local-development)
- [🤝 Contributing](#-contributing)
- [🔗 Links](#-links)

####

</details>

## 👋 简介

SperaxOS 插件网关是一个后端服务，为 SperaxOS 插件提供网关。我们使用 [vercel](https://vercel.com/) 来部署此服务。主要 API `POST /api/v1/runner` 部署为[Edge Function](https://vercel.com/docs/functions/edge-functions)。

网关服务从 [SperaxOS 插件](https://github.com/nirholas/plugin.delivery) 获取 Sperax 插件索引，如果您想将您的插件添加到索引中，请在 SperaxOS 插件仓库中[提交 PR](https://github.com/nirholas/plugin.delivery/pulls)。

<div align="right">

[![][back-to-top]](#readme-top)

</div>


### 基本 URL

| 环境   | URL                                            |
| ------ | ---------------------------------------------- |
| `PROD` | <https://plugin.delivery>     |
| `DEV`  | <https://plugin.delivery> |

### POST 插件网关

> **Note**\
> **POST** `/api/v1/runner`\
> 与 SperaxOS 插件进行通信的接口。此接口描述了如何使用 SperaxOS 插件网关 API 发送请求和获取响应。

#### Body Request Parameters 请求体参数

```json
{
  "arguments": "{\n  \"city\": \"杭州\"\n}",
  "name": "realtimeWeather"
}
```

#### Response 响应

```json
[
  {
    "city": "杭州市",
    "adcode": "330100",
    "province": "浙江",
    "reporttime": "2023-08-17 23:32:22",
    "casts": [
      {
        "date": "2023-08-17",
        "week": "4",
        "dayweather": "小雨",
        "nightweather": "小雨",
        "daytemp": "33",
        "nighttemp": "24",
        "daywind": "东",
        "nightwind": "东",
        "daypower": "≤3",
        "nightpower": "≤3",
        "daytemp_float": "33.0",
        "nighttemp_float": "24.0"
      },
      {
        "date": "2023-08-18",
        "week": "5",
        "dayweather": "小雨",
        "nightweather": "小雨",
        "daytemp": "32",
        "nighttemp": "23",
        "daywind": "东北",
        "nightwind": "东北",
        "daypower": "4",
        "nightpower": "4",
        "daytemp_float": "32.0",
        "nighttemp_float": "23.0"
      },
      {
        "date": "2023-08-19",
        "week": "6",
        "dayweather": "小雨",
        "nightweather": "雷阵雨",
        "daytemp": "32",
        "nighttemp": "24",
        "daywind": "东",
        "nightwind": "东",
        "daypower": "4",
        "nightpower": "4",
        "daytemp_float": "32.0",
        "nighttemp_float": "24.0"
      },
      {
        "date": "2023-08-20",
        "week": "7",
        "dayweather": "雷阵雨",
        "nightweather": "多云",
        "daytemp": "33",
        "nighttemp": "25",
        "daywind": "东",
        "nightwind": "东",
        "daypower": "≤3",
        "nightpower": "≤3",
        "daytemp_float": "33.0",
        "nighttemp_float": "25.0"
      }
    ]
  }
]
```

更多信息请参见[API 文档](https://apifox.com/apidoc/shared-c574e77f-4230-4727-9c05-c5c9988eed06)。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🛳 自托管

如果您想自己部署此服务，可以按照以下步骤进行操作。

### 部署到 Vercel

点击下方按钮来部署您的私有插件网关。

[![使用 Vercel 部署](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnirholas%2Fplugin.delivery&project-name=chat-plugins-gateway&repository-name=chat-plugins-gateway)

如果您想进行一些自定义设置，可以在部署时添加环境变量（Environment Variable）：

- `PLUGINS_INDEX_URL`：你可以通过该变量指定插件市场的索引地址

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📦 插件生态

插件提供了扩展 SperaxOS Function Calling 能力的方法。可以用于引入新的 Function Calling，甚至是新的消息结果渲染方式。如果你对插件开发感兴趣，请在 Wiki 中查阅我们的 [📘 插件开发指引](https://github.com/nirholas/SperaxOS/wiki/Plugin-Development.zh-CN) 。

- [sperax-plugins][sperax-plugins]：这是 SperaxOS 的插件索引。它从该仓库的 index.json 中获取插件列表并显示给用户。
- [chat-plugin-template][chat-plugin-template]: Chat Plugin 插件开发模版，你可以通过项目模版快速新建插件项目。
- [@sperax/plugin-sdk][chat-plugin-sdk]：SperaxOS 插件 SDK 可帮助您创建出色的 SperaxOS 插件。
- [@sperax/chat-plugins-gateway][chat-plugins-gateway]：SperaxOS 插件网关是一个后端服务，作为 SperaxOS 插件的网关。我们使用 Vercel 部署此服务。主要的 API POST /api/v1/runner 被部署为 Edge Function。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ⌨️ Local Development

可以使用 GitHub Codespaces 进行在线开发：

[![][github-codespace-shield]][github-codespace-link]

或者使用以下命令进行本地开发：


```bash
$ git clone https://github.com/nirholas/plugin.delivery.git
$ cd chat-plugins-gateway
$ bun install
$ bun dev
```

<div align="right">

[![][back-to-top]](#readme-top)

</div>


<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🔗 Links

- **[🤖 SperaxOS](https://github.com/nirholas/SperaxOS)** - An open-source, extensible (Function Calling), high-performance chatbot framework. It supports one-click free deployment of your private ChatGPT/LLM web application.
- **[Plugin Delivery](https://github.com/nirholas/plugin.delivery)** - This is the plugin index for SperaxOS. It accesses index.json from this repository to display a list of available plugins for Function Calling to the user.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

---

#### 📝 License

Copyright © 2026 [Plugin Delivery][profile-link]. <br />
This project is [MIT](./LICENSE) licensed.

---