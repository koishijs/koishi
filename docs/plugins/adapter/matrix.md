---
title: 适配器：Matrix
sidebarDepth: 2
---

# @koishijs/plugin-adapter-matrix

## 接入方法

1. 编写 `registry.yaml`, 参考 [Registion](https://spec.matrix.org/unstable/application-service-api/#registration)

```yaml
id: koishi # id
hs_token: # hs_token 与 as_token 没有特别的格式要求
as_token:
url: # 你的 bot 的地址
sender_localpart: koishi # sender_localpart
namespaces:
  users:
  - exclusive: true
    regex: '@koishi:matrix.example.com' # 你的 bot 的 userId
  aliases:
  - exclusive: false
    regex: '#koishi_*:matrix.example.com' # 此处填写匹配你的 bot 管理的 room 的 id 的正则表达式
  rooms: []
```

2. 将 `registry.yaml` 添加进你的 homeserver, 如 synapse 则使用 `app_service_config_files` 来指向 `registry.yaml`
3. 重启 homeserver, 启动 bot, 为你的 room 添加别名，使其匹配 `registry.yaml` 中的正则表达式并邀请你的 bot
4. 使用 [`/_matrix/client/v3/join/{roomIdOrAlias}`](https://spec.matrix.org/unstable/client-server-api/#post_matrixclientv3joinroomidoralias) api 将 bot 加入 room

## 机器人选项

### options(.bots[]).selfId

- 类型: `string`

机器人的 ID 。

### options(.bots[]).host

- 类型: `string`

Matrix homeserver 的域名。

### options(.bots[]).as_token

- 类型: `string`

as_token

### options(.bots[]).hs_token

- 类型: `string`

hs_token

### options(.bots[]).endpoint

- 类型: `string`
- 默认值: `https://` + [`options(.bots[]).host`](#options-bots-host)

Matrix homeserver 地址。
