---
sidebarDepth: 2
---

# 测试工具 (Mock)

@koishijs/plugin-mock 包含了被 Koishi 使用的测试工具。它提供了一个名为 `mock` 的服务，可用于模拟事件上报、网络请求等等。

## 类：Mock

### mock.webhook

- 类型: [`Webhook`](#类-webhook)

用于模拟网络请求。

### mock.client(userId, channelId?)

- **userId:** `string` 用户 ID
- **channelId:** `string` 频道 ID
- 返回值: [`Client`](#类-client)

创建一个客户端。

### mock.receive(session)

- **session:** `Partial<Session>` 事件所需的 Session 属性
- 返回值: `string`

触发会话事件。

### mock.initUser(id, authority?, data?)

- **id:** `string` 用户 ID
- **authority:** `number` 权限等级
- **data:** `Partial<User>` 其他用户数据

在数据库中初始化一个用户。等价于 `database.create('user', { mock: id, authority, ...data })`。

### mock.initChannel(id, assignee?, data?)

- **id:** `string` 频道 ID
- **assignee:** `string` 频道代理人
- **data:** `Partial<Channel>` 其他频道数据

在数据库中初始化一个频道。等价于 `database.create('channel', { platform: 'mock', id, assignee, ...data })`。

## 类：Client

**客户端 (Client)** 是对发往同一上下文的多次消息的一个抽象。它使用 `mock.client()` 方法创建，并借助 `mock.receive()` 实现其功能。

::: warning
这个类下的大部分方法的返回都基于 [session.send](./session.md#session-send) 方法和 [after-middleware](./events.md#事件：after-middleware) 事件。在提供了极大方便的同时，会话也存在一些限制。如果你的插件存在以下几种特殊情况之一：

- 使用了异步的 message 事件监听器
- 中间件和指令中可能存在未阻塞的异步操作
- 直接调用 Bot API 而非 session.send

这个类的方法可能会返回预料之外的结果。当然，如果要测试这些特殊情况，我们也有其他的解决方案。
:::

### client.receive(content)

- **content:** `string` 要发送的信息
- 返回值: `Promise<string[]>` 收到的回复列表

模拟发送一条消息。

### client.shouldReply(content, reply?)

- **content:** `string` 要发送给机器人的信息
- **reply:** `string | RegExp | (string | RegExp)[]` 应有的回复，如果略去则不会进行比较
- 返回值: `Promise<void>`

断言某条信息应存在某些回复。

### client.shouldNotReply(content)

- **content:** `string` 要发送给机器人的信息
- 返回值: `Promise<void>`

断言某条信息不应存在任何回复。

## 类：Webhook

**网络钩子 (Webhook)** 可用于模拟到 Koishi 服务器的网络请求。

### webhook.get(path, headers?)

- **path:** `string` 请求路径
- **headers:** `object` 请求头

模拟 GET 请求。

### webhook.post(path, body, headers?)

- **path:** `string` 请求路径
- **body:** `string` 请求正文
- **headers:** `object` 请求头

模拟 POST 请求。
