---
title: 适配器：QQ 频道
sidebarDepth: 2
---

# @koishijs/plugin-adapter-qqguild

## 接入方法

QQ 频道官方 SDK 适配器，基于 [@qq-guild-sdk/core](https://www.npmjs.com/package/@qq-guild-sdk/core) 实现。

1. 前往 [QQ 频道管理后台](https://bot.q.qq.com/open/#/type?appType=2) 注册
2. 登陆进入 [机器人管理后台](https://bot.q.qq.com/open/#/botlogin) 并创建官方机器人
3. 创建完成后，在 [频道机器人开发设置](https://bot.q.qq.com/#/developer/developer-setting) 获取机器人基本数据 [id, token, key(secret)]
4. 将上面的基本数据作为机器人配置项即可使用

参考文档：<https://nwylzw.github.io/qq-guild-sdk/api/core/Bot.html#bot>

## 机器人选项

### options(.bots[]).indents

- 类型: `GBot.Intents | number`
- 默认值: `0`

该机器人申请的 WS 监听事件权限。

### options(.bots[]).id

- 类型: `string`

机器人 id。

### options(.bots[]).key

- 类型: `string`

机器人密钥，管理端又称呼为 secret。

### options(.bots[]).token

- 类型: `string`

机器人 token。

## 适配器选项

包括全部的 [`WsClient`](../adapter.md#类-adapter-wsclient) 选项和下列额外选项：

### options.sandbox

- 类型: `boolean`
- 默认值: `true`

是否开启沙盒。

### options.endpoint

- 类型: `string`
- 默认值: `'https://api.sgroup.qq.com/'`

要请求的 API 网址。

### options.authType

- 类型: `'bot' | 'bearer'`
- 默认值: `'bot'`

验证方式。

## 常见问题

- Q: 如何申请测试频道?
- A: [申请测试频道问卷](https://docs.qq.com/form/page/DZVF3RFJnTGF0Y3Nk?_w_tencentdocx_form=1)
- Q: 如何申请测试 (私域) 频道不校验语料?
- A: [私域频道问卷](https://wj.qq.com/s2/9379748/ed13/)
