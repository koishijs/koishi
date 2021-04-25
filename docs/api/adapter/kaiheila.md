---
title: 平台：Kaiheila
sidebarDepth: 2
---

# koishi-adapter-kaiheila

## 注册机器人

1. 前往 [开发者平台](https://developer.kaiheila.cn/)，选择「机器人」并点击「新建」
2. 在机器人连接模式中配置 Webhook 或 WebSocket 中的一种：
    - 如果是 Webhook，请记下页面中的 token 和 verify_token，并作为机器人的配置项，同时让 Koishi 暴露一个 URL，填入下方的 Callback URL 中，启动 Koishi 后点击「机器人上线」
    - 如果是 WebSocket，则只需记录 token 并作为机器人的配置项即可，你可以在任何时候启动 Koishi
    - 页面中的其他值不用管，但请注意 token 不要泄露

## 适配器选项

包括全部的 [`WsClient`](../adapter.md#类-adapter-wsclient) 选项和下列额外选项：

### options.kaiheila.path

- 类型：`string`
- 默认值：`'/kaiheila'`

服务器监听的路径。仅用于 HTTP 通信方式。

### options.kaiheila.endpoint

- 类型: `string`
- 默认值: `'https://www.kaiheila.cn/api/v3'`

要请求的 API 网址。

### options.kaiheila.axiosConfig

- 类型: [`AxiosRequestConfig`](https://github.com/axios/axios#request-config)

用于 kaiheila 适配器的请求配置。
