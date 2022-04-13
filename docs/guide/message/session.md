---
sidebarDepth: 2
---

# 使用会话

在上一节我们已经了解了中间件，现在让我们回到传统的事件模型，并介绍会话的使用方法。

## 会话事件

让我们先用一个简单的例子来引入事件的概念：

```ts
// 当有新成员入群时，发送：欢迎+@入群者+入群！
ctx.on('guild-member-added', (session) => {
  session.send('欢迎' + segment.at(session.userId) + '入群！')
})
```

如你所见，上述 `ctx.on()` 方法监听了一个事件。第一个参数 `guild-member-added` 是要监听的事件名称 (群组成员增加)，而第二个参数则是当事件被触发时的回调函数。与中间件相同，这个回调函数依然会传入一个会话对象，你可以在其中使用之前你已经学习过的方法操作它。而与中间件不同的地方在于，在事件的回调函数中并没有 `next` 方法，回调函数的执行也是同时开始的。

像这样由平台推送的事件，我们称之为 **通用会话事件**。与此相对的，Koishi 还有一些 **生命周期事件**，例如 `ready` 事件表示应用启动完成等。前者通常由适配器生成，回调函数只接受一个会话对象；而后者由 Koishi 自身生成，回调函数有着各种不同的形式。你可以在 [事件列表](../../api/core/events.md) 中看到全部 Koishi 支持的事件接口。关于更一般的事件，我们也将在 [事件系统](../plugin/lifecycle.md) 中着重介绍。

### 通用事件类型

不同平台可能会有不同的会话事件，但是有一些会话事件是通用的，只要平台支持相应的特性你就总是可以使用它们。

- message: 收到新消息
- message-edited: 消息被修改
- message-deleted: 消息被删除
- reaction-added: 响应被添加
- reaction-removed: 响应被移除
- friend-added: 好友增加
- friend-removed: 好友减少
- friend-request: 收到好友申请
- guild-added: 加入的群组增加
- guild-removed: 加入的群组减少
- guild-request: 收到群组邀请
- guild-member-added: 群组成员增加
- guild-member-removed: 群组成员减少
- guild-member-request: 收到群组成员申请

### 通用会话属性

对于会话事件，我们也抽象出了一套通用的属性：

- session.platform: 触发事件的平台
- session.type: 事件的类型
- session.content: 事件的文本内容 (例如消息的文本等)
- session.selfId: 收到事件的机器人的平台编号
- session.userId: 相关用户的平台编号 (例如发送好友申请的人，发送消息的人等)
- session.guildId: 相关群组的平台编号 (如果不是群组相关事件则没有这一项)
- session.channelId: 相关频道的平台编号 (如果不是频道相关事件则没有这一项)
- session.messageId: 消息编号 (例如在回复消息时需要用到)

### 调用机器人

现在让我们再次尝试一个简单的例子：

```ts
// 当有好友请求时，接受请求并发送欢迎消息
ctx.on('friend-request', async (session) => {
  await session.bot.handleFriendRequest(session.messageId, true)
  await session.bot.sendPrivateMessage(session.userId, '很高兴认识你！')
})
```

你可以在 [机器人文档](../../api/core/bot.md) 中看到完整的 API 列表。

### 访问原始接口

## 一些高级案例

除了大家已经熟知的 `session.send()` 以外，会话对象还提供了一些实用方法。下面介绍其中的一些。

### 延时发送

如果你需要连续发送多条消息，那么在各条消息之间留下一定的时间间隔是很重要的：一方面它可以防止消息刷屏和消息错位（后发的条消息呈现在先发的消息前面），提高了阅读体验；另一方面它能够有效降低机器人发送消息的频率，防止被平台误封。这个时候，`session.sendQueued()` 可以解决你的问题。

```ts
// 发送两条消息，中间间隔一段时间，这个时间由系统计算决定
await session.sendQueued('message1')
await session.sendQueued('message2')

// 清空等待队列
await session.cancelQueued()
```

你也可以在发送时手动定义等待的时长：

```ts
import { Time } from 'koishi'

// 如果消息队列非空，在前一条消息发送完成后 1s 发送本消息
await session.sendQueued('message3', Time.second)

// 清空等待队列，并设定下一条消息发送距离现在至少 0.5s
await session.cancelQueued(0.5 * Time.second)
```

事实上，对于不同的消息长度，系统等待的时间也是不一样的，你可以通过配置项修改这个行为：

::: code-group config koishi
```yaml
delay:
  # 消息里每有一个字符就等待 0.02s
  character: 20
  # 每条消息至少等待 0.5s
  message: 500
```
```ts
import { Time } from 'koishi'

export default {
  delay: {
    // 消息里每有一个字符就等待 0.02s
    character: 0.02 * Time.second,
    // 每条消息至少等待 0.5s
    message: 0.5 * Time.second,
  },
}
```
:::

这样一来，一段长度为 60 个字符的消息发送后，下一条消息发送前就需要等待 1.2 秒了。

### 等待用户输入

当你需要进行一些交互式操作时，可以使用 `session.prompt()`：

```ts
// @errors: 1108
await session.send('请输入用户名：')

const name = await session.prompt()
if (!name) return '输入超时。'

// 执行后续操作
await ctx.database.setUser(session.platform, session.userId, { name })
return `${name}，请多指教！`
```

你可以给这个方法传入一个 `timeout` 参数，或使用 `delay.prompt` 配置项，来作为等待的时间。

### 发送广播消息

有的时候你可能希望向多个频道同时发送消息，我们也专门设计了相关的接口。

```ts
// 使用当前机器人账户向多个频道发送消息
await session.bot.broadcast(['123456', '456789'], content)

// 如果你有多个账号，请使用 ctx.broadcast，并在频道编号前加上平台名称
await ctx.broadcast(['onebot:123456', 'discord:456789'], content)

// 或者直接将消息发给所有频道
await ctx.broadcast(content)
```

如果你希望广播消息的发送也有时间间隔的话，可以使用 `delay.broadcast` 配置项。

### 执行指令

我们还可以实用 `session.execute()` 来让用户执行某条指令：

```ts
// 当用户输入“查看帮助”时，执行 help 指令
ctx.middleware((session, next) => {
  if (session.content === '查看帮助') {
    return session.execute('help', next)
  } else {
    return next()
  }
})
```
