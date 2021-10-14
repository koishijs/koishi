---
sidebarDepth: 2
---

# 机器人操作

在前面的几节中我们已经学习了如何处理消息，但实际的机器人有时需要处理更多的场景，例如针对入群的新人进行欢迎，在特定时机发送广播消息，又或者处理来自其他用户的好友请求等等……这些各种各样的需求实际上可以归结为两个问题：

- 如何接收平台推送过来的事件？
- 如何操作机器人访问平台提供的接口？

本节就主要介绍这两个问题的解决方案。

## 会话事件

让我们先用一个简单的例子来引入事件的概念：

```ts
// 当有新成员入群时，发送：@入群者+欢迎入群！
ctx.on('guild-member-added', (session) => {
  session.send(segment.at(session.userId) + '欢迎入群！')
})
```

正如你所见，上述 `ctx.on()` 方法监听了一个事件。第一个参数 `guild-member-added` 是要监听的事件名称（群组成员增加），而第二个参数则是当事件被触发时的回调函数。与中间件相同，这个回调函数依然会传入一个会话对象，你可以在其中使用之前你已经学习过的方法操作它。而与中间件不同的地方在于，在事件的回调函数中并没有 `next` 方法，回调函数的执行也是同时开始的。

像这样由平台推送过来的事件，我们称之为 **会话事件**。与此相对的，Koishi 还有一些 **生命周期事件**，例如 `connect` 事件表示应用启动完成等。前者通常由适配器生成，回调函数只接受一个会话对象；而后者由 Koishi 自身生成，回调函数有着各种不同的形式。你可以在 [事件文档](../../api/core/events.md) 中看到全部 Koishi 支持的事件接口。关于更一般的事件，我们也将在 [这一节](../plugin/lifecycle.md) 中着重介绍。

### 常用会话事件

### 会话的属性

## 机器人对象

现在让我们再次尝试一个简单的例子：

```ts
// 当有好友请求时，接受请求并发送欢迎消息
ctx.on('friend-request', async (session) => {
  await session.bot.handleFriendRequest(session.messageId, true)
  await session.bot.sendPrivateMessage(session.userId, '很高兴认识你！')
})
```

你可以在 [**机器人文档**](../../api/core/bot.md) 中看到完整的 API 列表。

### 常用机器人方法

### 发送广播消息

有的时候你可能希望向多个频道同时发送消息，我们也专门设计了相关的接口。

```js
// 使用当前机器人账户向多个频道发送消息
await session.bot.broadcast(['123456', '456789'], content)

// 如果你有多个账号，请使用 ctx.broadcast，并在频道编号前加上平台名称
await ctx.broadcast(['onebot:123456', 'discord:456789'], content)

// 或者直接将消息发给所有频道
await ctx.broadcast(content)
```

如果你希望广播消息的发送也有时间间隔的话，可以使用 `delay.broadcast` 配置项。

### 访问原始接口
