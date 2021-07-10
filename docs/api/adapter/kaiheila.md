---
title: 平台：Kaiheila
sidebarDepth: 2
---

# koishi-adapter-kaiheila

## 创建机器人

1. 前往 [开发者平台](https://developer.kaiheila.cn/)，选择「机器人」并点击「新建」
2. 在机器人连接模式中配置 Webhook 或 WebSocket 中的一种：
    - 如果是 Webhook，请记下页面中的 token 和 verify_token，并作为机器人的配置项，同时让 Koishi 暴露一个 URL，填入下方的 Callback URL 中，启动 Koishi 后点击「机器人上线」
    - 如果是 WebSocket，则只需记录 token 并作为机器人的配置项即可，你可以在任何时候启动 Koishi
    - 页面中的其他值不用管，但请注意 token 不要泄露

## 机器人选项

### options(.bots[]).type

- 可选值: kaiheila, kaiheila:http, kaiheila:ws

如果使用了 kaiheila，则 Koishi 会根据你是否配置了 `verifyToken` 来判断你使用的通信方式。

### options(.bots[]).token

- 类型: `string`

机器人账户的令牌。

### options(.bots[]).verifyToken

- 类型: `string`

机器人账户的验证令牌。仅限 Webhook 通信方式。

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

### options.kaiheila.attachMode

- 类型: `'separate' | 'mixed' | 'card'`
- 默认值: `'separate'`

控制当尝试发送含有[资源消息段](../segment.md#资源消息段)的消息时的行为。

- **separate:** 每一个资源消息段，以及资源消息段之间的文本都将单独发送一条消息
- **mixed:** 当要发送的内容中含有多个资源消息段或资源消息段和文本的混合时，发送卡片消息；否则将单独发送资源消息段
- **card:** 当要发送的内容中含有资源消息段，则以卡片消息的形式发送

### options.kaiheila.axiosConfig

- 类型: [`AxiosRequestConfig`](https://github.com/axios/axios#request-config)

用于 kaiheila 适配器的请求配置。
