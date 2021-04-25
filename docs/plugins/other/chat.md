---
sidebarDepth: 2
---

# 聊天工具 (Chat)

koishi-plugin-chat 能够提供三方面的支持：

1. 持续接收消息，并发送到命令行中
2. 在 WebUI 中扩展一个「聊天」页面，可用于直接操作机器人的账号接收和发送消息
3. 在 WebUI 中扩展一个「沙盒」页面，其中包含一个虚拟的机器人，可用于调试自己的新功能

## 配置项

### whitelist

- 类型: `string[]`
- 默认值: [参见源码](https://github.com/koishijs/koishi/blob/master/packages/plugin-chat/src/index.ts)

图片转发服务器所允许的白名单。

### maxMessages

- 类型: `number`
- 默认值: `1000`

在客户端存储的最大消息数量。
