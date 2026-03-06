<a name="readme-top"></a>

<div align="center">


<h1>Sperax Plugins Gateway - Plugin Delivery</h1>

Plugin Gateway Service for SperaxOS


**English** · [简体中文](./README.zh-CN.md) ·


</div>

<details>
<summary><kbd>Table of contents</kbd></summary>

#### TOC

- [👋 Intro](#-intro)
- [🤯 Usage](#-usage)
  - [Base URLs](#base-urls)
  - [POST Plugin Gateway](#post-plugin-gateway)
- [🛳 Self Hosting](#-self-hosting)
  - [Deploy to Vercel](#deploy-to-vercel)
- [📦 Plugin Ecosystem](#-plugin-ecosystem)
- [⌨️ Local Development](#️-local-development)
- [🤝 Contributing](#-contributing)
- [🔗 Links](#-links)

####

</details>

## 👋 Intro

Sperax Plugins Gateway is a backend service that provides a gateway for SperaxOS plugins. We use [vercel](https://vercel.com/) to deploy this service. The main API `POST /api/v1/runner` is deployed as an [Edge Function](https://vercel.com/docs/functions/edge-functions).

The gateway service fetches Plugin Delivery index from the [SperaxOS Plugins](https://github.com/nirholas/plugin.delivery), if you want to add your plugin to the index, please [submit a PR](https://github.com/nirholas/plugin.delivery/pulls) to the SperaxOS Plugins repository.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🤯 Usage

### Base URLs

| Environment | URL                                            |
| ----------- | ---------------------------------------------- |
| `PROD`      | <https://plugin.delivery>     |
| `DEV`       | <https://plugin.delivery> |

### POST Plugin Gateway

> **Note**\
> **POST** `/api/v1/runner`\
> Interface to communicate with the SperaxOS plugin. This interface describes how to use the SperaxOS plugin gateway API to send requests and get responses

#### Body Request Parameters

```json
{
  "arguments": "{\n  \"city\": \"杭州\"\n}",
  "name": "realtimeWeather"
}
```

#### Response

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

See [API Document](https://apifox.com/apidoc/shared-c574e77f-4230-4727-9c05-c5c9988eed06) for more information.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🛳 Self Hosting

If you want to deploy this service by yourself, you can follow the steps below.

### Deploy to Vercel

Click button below to deploy your private plugins' gateway.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnirholas%2Fplugin.delivery&project-name=chat-plugins-gateway&repository-name=chat-plugins-gateway)

If you want to make some customization, you can add environment variable:

- `PLUGINS_INDEX_URL`: You can change the default plugins index url as your need.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📦 Plugin Ecosystem

Plugins provide a means to extend the Function Calling capabilities of SperaxOS. They can be used to introduce new function calls and even new ways to render message results. If you are interested in plugin development, please refer to our [📘 Plugin Development Guide](https://github.com/nirholas/SperaxOS/wiki/Plugin-Development) in the Wiki.

- [sperax-plugins][sperax-plugins]: This is the plugin index for SperaxOS. It accesses index.json from this repository to display a list of available plugins for SperaxOS to the user.
- [chat-plugin-template][chat-plugin-template]: This is the plugin template for SperaxOS plugin development.
- [@sperax/plugin-sdk][chat-plugin-sdk]: The Sperax Plugin SDK assists you in creating exceptional chat plugins for SperaxOS.
- [@sperax/chat-plugins-gateway][chat-plugins-gateway]: The Sperax Plugins Gateway is a backend service that provides a gateway for SperaxOS plugins. We deploy this service using Vercel. The primary API POST /api/v1/runner is deployed as an Edge Function.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ⌨️ Local Development

You can use Github Codespaces for online development:

[![][github-codespace-shield]][github-codespace-link]

Or clone it for local development:

[![][bun-shield]][bun-link]

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
- **[Plugin Delivery](https://github.com/nirholas/plugin.delivery)** - This is the plugin index. It accesses index.json from this repository to display a list of available plugins for Function Calling to the user.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

---

#### 📝 License

Copyright © 2026 [Plugin.Delivery][profile-link]. <br />
This project is [MIT](./LICENSE) licensed.

---