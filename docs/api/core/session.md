---
sidebarDepth: 2
---

# 会话 (Session)

会话来源于 Koishi v1 的元信息对象，并在后续的版本中发展成了专门的类并大幅扩展了功能。目前的会话已经参与到了 Koishi 的绝大部分工作。

## 通用属性

对于会话事件，我们抽象出了一套通用的属性：

### session.type

事件类型。它应当是 [通用会话事件](./events.md#通用会话事件) 中的某一个。

### session.platform

触发事件的机器人所在的平台。

### session.selfId

触发事件的机器人所在平台的编号。

### session.userId

事件相关用户的平台编号 (例如发送好友申请的人，发送消息的人等)。

### session.guildId

事件相关群组的平台编号 (如果不是群组相关事件则没有这一项)。

### session.channelId

事件相关频道的平台编号 (如果不是频道相关事件则没有这一项)。

### session.messageId

事件相关的消息编号 (例如在回复消息时需要用到)。

### session.content

事件的文本内容 (例如消息的文本等)。

## 实例属性

你应该已经读过 [事件 (Events)](./events.md) 一章了。由于每个会话都必定表达了一个上报事件，因此上报事件中定义的属性也都可以在 Session 的实例中访问到。此外，也只有来自上报事件的属性才会在序列化中被保留。下面将介绍的实例属性都是无法被序列化的。

### session.app

当前会话绑定的 [App](./app.md) 实例。

### session.bot

当前会话绑定的 [Bot](./bot.md) 实例。

### session.user

当前会话绑定的用户数据，是一个可观测 [User](./database.md#user) 对象。

::: tip
通常情况下，Session 对象只有在中间件内才有此属性。因此如果想使用此接口请考虑下列方式：

- 使用中间件
- 使用指令 (指令的执行处于中间件内部)
- 手动调用 [`session.observeUser()`](#session-observeuser-fields)
- 手动调用 [`database.getUser()`](../database/built-in.md#database-getuser-platform-id-modifier)

下面的两个属性也同理。
:::

### session.channel

当前会话绑定的频道数据，是一个可观测 [Channel](./database.md#channel) 对象。

### session.guild

当前会话绑定的群组数据，是一个可观测 [Channel](./database.md#channel) 对象。

## 实例方法

### session.observeUser(fields?)

观测特定的用户字段，并更新到 [`session.user`](#session-user) 中。

- **fields:** `Iterable<User.Field>`
- 返回值: `Promise<User.Observed>`

### session.observeChannel(fields?)

观测特定的用户字段，并更新到 [`session.channel`](#session-channel) 中。

- **fields:** `Iterable<Channel.Field>`
- 返回值: `Promise<Channel.Observed>`

### session.send(message)

- **message:** `string` 要发送的内容
- 返回值: `Promise<void>`

在当前上下文发送消息。

### session.sendQueued(message, delay?)

- **message:** `string` 要发送的内容
- **delay:** `number` 与下一条消息的时间间隔，缺省时会使用 [`app.options.delay.queue`](./app.md#options-delay)
- 返回值: `Promise<void>`

在当前上下文发送消息，并与下一条通过 `session.sendQueued` 发送的消息之间保持一定的时间间隔。

### session.cancelQueued(delay?)

- **delay:** `number` 与下一条消息的时间间隔，默认值为 `0`
- 返回值: `Promise<void>`

取消当前正在等待发送的消息队列，并重置与下一条通过 `session.sendQueued` 发送的消息之间的时间间隔。

### session.middleware(middleware)

- **middleware:** [`Middleware`](../../guide/message.md#中间件) 要注册的中间件
- 返回值: `() => void` 取消该中间件的函数

注册一个仅对当前会话生效的中间件。

### session.prompt(timeout?) <Badge text="beta" type="warning"/>

- **timeout:** `number` 中间件的生效时间，缺省时会使用 [`app.options.delay.prompt`](./app.md#options-delay)
- 返回值: `Promise<string>` 用户输入

等待当前会话的下一次输入，如果超时则会返回空串。

### session.suggest(options)

- **options.target:** `string` 目标字符串
- **options.items:** `string[]` 源字符串列表
- **options.next:** [`Next?`](../../guide/message.md#使用中间件) 回调函数
- **options.prefix:** `string?` 显示在候选输入前的文本
- **options.suffix:** `string` 当只有一个选项时，显示在候选输入后的文本
- **options.coefficient:** `number` 用于模糊匹配的相似系数，缺省时会使用 [`app.options.minSimilarity`](./app.md#options-minsimilarity)
- **options.apply:** `(suggestion: string, next: Next) => void` 确认后执行的操作
- 返回值: `Promise<void>`

尝试显示候选输入。

### session.resolve(argv)

- **argv:** `Argv` 运行时参数对象
- 返回值: [`Command`](./command.md) 关联的指令

尝试解析一个 argv 所关联的指令。

### session.collect(argv, key, fields)

按照 argv 中的 command 属性向 fields 添加所需的用户字段。它是内置的 before-attach-user 和 before-attach-channel 监听器。

- **argv:** `Argv` 只需确保其中存在 command 属性即可
- **key:** `'user' | 'channel'` 要添加的类型
- **fields:** `Set<string>` 用户字段集合
- 返回值: `void`

### session.execute(argv, next?)

- **argv:** `string | Argv` 指令文本或运行时参数对象
- **next:** [`Next`](../../guide/message.md#使用中间件) 回调函数
- 返回值: `Promise<void>`

执行一个指令。可以传入一个 argv 对象或者指令对应的文本。
