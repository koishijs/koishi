---
title: 适配器：Telegram
sidebarDepth: 2
---

# @koishijs/plugin-adapter-telegram

## 接入方法

1. 搜索 @botfather（有个官方认证的符号）并进入聊天界面
2. 输入 `/start` 后，会出现一个使用菜单，你可以使用这里指令对你的机器人进行配置
3. 要创建一个机器人，请点击 `/newbot`，并根据系统提示完成创建流程
4. 使用 `/setprivacy` 开启 Privacy Mode（不然机器人只能收到特定消息）
5. 创建完毕后，你会获得一个 token（请注意不要泄露），将其作为机器人配置项即可使用

参考文档：<https://core.telegram.org/bots>

## 机器人选项

### options(.bots[]).token

- 类型: `string`

机器人账户的令牌。

### options(.bots[]).endpoint

- 类型: `string`
- 默认值: `'https://api.telegram.org'`

API 请求的终结点。

### options(.bots[]).proxyAgent

- 类型: `string`
- 默认值: [`app.options.request.proxyAgent`](../../api/core/app.md#options-request-proxyagent)

请求时默认使用的网络代理。

## 适配器选项

### options.path

- 类型：`string`
- 默认值：`'/telegram'`

服务器监听的路径。

### options.selfUrl

- 类型：`string`

Koishi 服务暴露在公网的地址，会覆盖 [`app.options.selfUrl`](../../api/app.md#options-selfurl) 的值。

### options.endpoint

- 类型: `string`
- 默认值: `'https://api.telegram.org'`

要请求的 API 终结点。
