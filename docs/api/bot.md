---
sidebarDepth: 2
---

# 机器人 (Bot)

**机器人 (Bot)** 是适配器的核心，它将不同平台的 API 封装成统一的格式供 Koishi 使用。而不同的适配器也可以自行扩展 Bot 实例上的属性和方法。

标有 <Badge text="内置" vertical="baseline"/> 的 API 已经由 koishi-core 提供，适配器可以覆盖对应的方法，但是无需自行实现。

## 属性

### 构造选项

每个 Bot 都会继承你构造 App 时传入的选项，因此下列选项是天生就有的：

- bot.type
- bot.selfId

### bot.app

当前 Bot 所在的 [App](./app.md) 实例。

### bot.adapter

当前 Bot 所在的 Adapter 实例。

### bot.platform

当前 Bot 的平台名称。

### bot.username

当前 Bot 的用户名，需要在启动前获取完成。

## 处理消息

### bot.sendMessage(channelId, content)

- **channelId:** `string` 频道 ID
- **content:** `string` 要发送的内容
- 返回值: `Promise<string>` 发送的消息 ID

向特定频道发送消息。

### bot.sendPrivateMessage(userId, content)

- **userId:** `string` 对方 ID
- **content:** `string` 要发送的内容
- 返回值: `Promise<string>` 发送的消息 ID

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

### bot.getGroup(groupId)

- **groupId:** `string` 目标群 ID
- 返回值: `Promise<GroupInfo>` 群组信息

获取群组信息。

```js
export interface GroupInfo {
  groupId: string
  groupName: string
}
```

### bot.getGroupList()

- 返回值: `Promise<GroupInfo[]>` 群组列表

获取机器人加入的群组列表。

### bot.getGroupMember(groupId, userId)

- **groupId:** `string` 目标群 ID
- **userId:** `string` 目标用户 ID
- 返回值: `Promise<GroupMemberInfo>` 群成员信息

获取群成员信息。

```js
export interface GroupMemberInfo extends UserInfo {
  nickname: string
}
```

### bot.getGroupMemberList(groupId)

- **groupId:** `string` 目标群 ID
- 返回值: `Promise<GroupMemberInfo[]>` 群成员列表

获取群成员列表。

### bot.getGroupMemberMap(groupId) <Badge text="内置"/>

- **groupId:** `string` 目标群 ID
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

### bot.getChannelList(groupId)

- **groupId:** `string` 目标群 ID
- 返回值: `Promise<ChannelInfo[]>` 频道列表

获取某个群组的频道列表。

## 处理请求

### bot.handleFriendRequest(messageId, approve, comment?)

- **messageId:** `string` 请求 ID
- **approve:** `boolean` 是否通过请求
- **comment:** `string` 备注信息
- 返回值: `Promise<void>`

处理好友请求。

### bot.handleGroupRequest(messageId, approve, comment?)

- **messageId:** `string` 请求 ID
- **approve:** `boolean` 是否通过请求
- **comment:** `string` 备注信息
- 返回值: `Promise<void>`

处理来自群组的邀请。

### bot.handleGroupMemberRequest(messageId, approve, comment?)

- **messageId:** `string` 请求 ID
- **approve:** `boolean` 是否通过请求
- **comment:** `string` 备注信息
- 返回值: `Promise<void>`

处理加群请求。

## 其他

### bot.getStatus()

- 返回值: `Promise<BotStatus>`

获取当前运行状态。

```js
export enum Status {
  /** 正常运行 */
  GOOD,
  /** 机器人处于闲置状态 */
  BOT_IDLE,
  /** 机器人离线 */
  BOT_OFFLINE,
  /** 无法获得状态 */
  NET_ERROR,
  /** 服务器状态异常 */
  SERVER_ERROR,
  /** 机器人被封禁 */
  BANNED,
}
```

### bot.createSession(session) <Badge text="内置"/>

- **session:** `Partial<Session>` 会话数据
- 返回值: `Session` 新会话

创建一个 send 类型的会话，供 `bot.sendMessage()` 等 API 使用。
