---
title: 适配器：飞书
sidebarDepth: 2
---

# @koishijs/plugin-adapter-feishu

## 接入方法

TODO

## 机器人选项

### options(.bots[]).endpoint

- 类型: `string`

用于发送信息的 webhook 地址。

## 适配器选项

### options.path

- 类型：`string`
- 默认值：`'/feishu'`

服务器监听的路径。

### options(.bots[]).encryptKey

- 类型: `string`
- 默认值: `undefined`

用于事件订阅或事件安全验证时的解密密钥，需要和飞书后台配置的 [Encrypt Key](https://open.feishu.cn/document/ukTMukTMukTM/uYDNxYjL2QTM24iN0EjN/event-security-verification) 一致。若没有配置则忽略此项。