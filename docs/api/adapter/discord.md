---
title: 平台：Discord
sidebarDepth: 2
---

# koishi-adapter-discord

## 注册机器人

1. 前往 [https://discord.com/developers/applications](https://discord.com/developers/applications)，登录账号创建一个应用
2. 点击「Bot」并创建一个新的机器人，保存这个页面中的 token（请注意不要泄露）
3. 要将机器人拉进你的服务器，点击「OAuth2」，并在网址生成器中勾选 Bot 和机器人所需要的权限
4. 打开生成的链接，选择你具有管理权限的服务器，就成功把机器人添加进去了
5. 将上面的 token 作为机器人配置项即可使用

## 适配器选项

包括全部的 [`WsClient`](../adapter.md#类-adapter-wsclient) 选项和下列额外选项：

### options.discord.endpoint

- 类型: `string`
- 默认值: `'https://discord.com/api/v8'`

要请求的 API 网址。

### options.discord.axiosConfig

- 类型: [`AxiosRequestConfig`](https://github.com/axios/axios#request-config)

用于 discord 适配器的请求配置。
