---
sidebarDepth: 2
---

# 机器人 (Bot)

**机器人 (Bot)** 是适配器的核心，它将不同平台的 API 封装成统一的格式供 Koishi 使用。而不同的适配器也可以自行扩展 Bot 实例上的属性和方法。

标有 <Badge text="内置" vertical="baseline"/> 的 API 已经由 @koishijs/core 提供，适配器可以覆盖对应的方法，但是无需自行实现。

## 构造函数选项

不同的适配器可能对应了不同的 Bot 配置项，但是有一些配置项是公用的：

### options.disabled

- 类型: `boolean`

是否禁用此机器人。如果禁用，Bot 实例将仍然存在被创建，但是将不会主动连接服务器进行通信。你可以稍后在网页控制台或执行代码以启用它。

### options.protocol

- 类型: `string`

部分适配器可能提供了多种协议实现，此时你可能需要指定一个协议。

::: tip
并不是每一个提供多种协议实现的适配器都需要手动指定一个协议。一些适配器可以根据你传入的参数自行判断出所使用的协议。
:::

### options.platform

- 类型: `string`

要使用的用户数据字段名称。默认情况下你可以使用适配器名作为字段访问到你的账号，但是对于同一个适配器连接多个服务器的情况，你可能需要对各自账户做出区分。配置不同的 platform 可以确保不会出现串数据的情况。

## 实例属性

### bot.config

- 类型: `object`

构造 Bot 实例时所使用的配置项。

### bot.app

- 类型: [`App`](./app.md)

当前 Bot 所在的 [App](./app.md) 实例。

### bot.adapter

- 类型: [`Adapter`](./adapter.md)

当前 Bot 所在的 [Adapter](./adapter.md) 实例。

### bot.platform

- 类型: `string`

当前 Bot 的平台名称，会受到 [options.platform](#options-platform) 影响。

### bot.username

- 类型: `string`

当前 Bot 的用户名。

### bot.selfId

- 类型: `string`

当前 Bot 的平台账号。

### bot.sid

- 类型: `string`

当前 Bot 的唯一标识符。

### bot.status

- 可选值: online, offline, connect, disconnect, reconnect

当前 Bot 的运行状态。

## 处理消息

### bot.sendMessage(channelId, content)

- **channelId:** `string` 频道 ID
- **content:** `string` 要发送的内容
- 返回值: `Promise<string[]>` 发送的消息 ID

向特定频道发送消息。

### bot.sendPrivateMessage(userId, content)

- **userId:** `string` 对方 ID
- **content:** `string` 要发送的内容
- 返回值: `Promise<string[]>` 发送的消息 ID

向特定用户发送私聊消息。

### bot.getMessage(channelId, messageId)

- **channelId:** `string` 频道 ID
- **messageId:** `string` 消息 ID
- 返回值: `Promise<MessageInfo>`

获取特定消息。

```js
export interface MessageInfo {
  messageId: string
  subtype: 'private' | 'group'
  content: string
  timestamp: number
  author: AuthorInfo
}
```

### bot.deleteMessage(channelId, messageId)

- **channelId:** `string` 频道 ID
- **messageId:** `string` 消息 ID
- 返回值: `Promise<void>`

撤回特定消息。

### bot.editMessage(channelId, messageId, content)

- **channelId:** `string` 频道 ID
- **messageId:** `string` 消息 ID
- **content:** `string` 要发送的内容
- 返回值: `Promise<void>`

修改特定消息。

### bot.broadcast(channels, content, delay?) <Badge text="内置"/>

- **channels:** `string[]` 频道列表
- **content:** `string` 要发送的内容
- **delay:** `number` 发送消息间的延迟，默认值为 [`app.options.delay.broadcast`](./app.md#options-delay)
- 返回值: `Promise<string[]>` 成功发送的消息 ID 列表

向多个频道广播消息。如有失败不会抛出错误。

## 获取数据

### bot.getSelf()

- 返回值: `Promise<UserInfo>` 用户信息

获取机器人自己的信息。

```js
export interface UserInfo {
  userId: string
  username: string
  avatar?: string
}
```

### bot.getUser(userId)

- **userId:** `string` 目标用户 ID
- 返回值: `Promise<UserInfo>` 用户信息

获取用户信息。

### bot.getFriendList()

- 返回值: `Promise<UserInfo[]>` 好友列表

获取机器人的好友列表。

### bot.getGuild(guildId)

- **guildId:** `string` 目标群 ID
- 返回值: `Promise<GuildInfo>` 群组信息

获取群组信息。

```js
export interface GuildInfo {
  guildId: string
  guildName: string
}
```

### bot.getGuildList()

- 返回值: `Promise<GuildInfo[]>` 群组列表

获取机器人加入的群组列表。

### bot.getGuildMember(guildId, userId)

- **guildId:** `string` 目标群 ID
- **userId:** `string` 目标用户 ID
- 返回值: `Promise<GuildMemberInfo>` 群成员信息

获取群成员信息。

```js
export interface GuildMemberInfo extends UserInfo {
  nickname: string
}
```

### bot.getGuildMemberList(guildId)

- **guildId:** `string` 目标群 ID
- 返回值: `Promise<GuildMemberInfo[]>` 群成员列表

获取群成员列表。

### bot.getGuildMemberMap(guildId) <Badge text="内置"/>

- **guildId:** `string` 目标群 ID
- 返回值: `Promise<Record<string, string>>` 群成员昵称的键值对

获取群成员列表，返回一个用户 ID 到昵称的键值对，若无 nickname 则使用 username。

### bot.getChannel(channelId)

- **channelId:** `string` 目标频道 ID
- 返回值: `Promise<ChannelInfo>` 频道信息

获取频道信息。

```js
export interface ChannelInfo {
  channelId: string
  channelName: string
}
```

### bot.getChannelList(guildId)

- **guildId:** `string` 目标群 ID
- 返回值: `Promise<ChannelInfo[]>` 频道列表

获取某个群组的频道列表。

## 处理请求

### bot.handleFriendRequest(messageId, approve, comment?)

- **messageId:** `string` 请求 ID
- **approve:** `boolean` 是否通过请求
- **comment:** `string` 备注信息
- 返回值: `Promise<void>`

处理好友请求。

### bot.handleGuildRequest(messageId, approve, comment?)

- **messageId:** `string` 请求 ID
- **approve:** `boolean` 是否通过请求
- **comment:** `string` 备注信息
- 返回值: `Promise<void>`

处理来自群组的邀请。

### bot.handleGuildMemberRequest(messageId, approve, comment?)

- **messageId:** `string` 请求 ID
- **approve:** `boolean` 是否通过请求
- **comment:** `string` 备注信息
- 返回值: `Promise<void>`

处理加群请求。

## 其他方法

### bot.session(session) <Badge text="内置"/>

- **session:** `Partial<Session>` 会话数据
- 返回值: `Promise<Session>` 新会话

创建一个 send 类型的会话，供 `bot.sendMessage()` 等 API 使用。
