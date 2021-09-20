---
sidebarDepth: 2
---

# 接收和发送消息

从本节开始，我们开始深入研究如何利用 Koishi 的来接收和发送消息。

首先让我们回顾一下之前展示过的 [基本实例](./starter.md#编写并调用你的插件)：

```js
// 如果收到“天王盖地虎”，就回应“宝塔镇河妖”
ctx.middleware((session, next) => {
  if (session.content === '天王盖地虎') {
    session.send('宝塔镇河妖')
  }
  return next()
})
```

在这个简单的示例中，这里有两件事你需要了解：

上面的 `ctx.middleware()` 方法所传入的回调函数成为 **中间件**。你可以使用中间件来处理所有收到的一切消息。如果你希望处理其他类型的事件（例如加群申请又或者消息撤回等等），可以使用 Koishi 的 [事件系统](./lifecycle.md#事件系统)，这将在后面的章节中介绍。

上面的 `session` 对象被称为 **会话**。所有的上报事件都会被转化成一个会话对象。你可以利用这个对象访问与此事件有关的数据（例如用 `session.content` 表示消息的内容），或调用 API 作为对此事件的响应（例如用 `session.send()` 在当前频道内发送消息）。

## 使用中间件

有了接收和发送消息的能力，似乎你就能完成一切工作了——很多机器人框架也的确是这么想的。但是从 Koishi 的角度，这还远远不够。当载入的功能越来越多后，另一些严重的问题将逐渐浮现出来：如何限制消息能触发的应答次数？如何进行权限管理？如何提高机器人的性能？这些问题的答案将我们引向另一套更高级的系统——这也就是 **中间件** 的由来。

中间件是对消息事件处理流程的再封装。你注册的所有中间件将会由一个事件监听器进行统一管理，数据流向下游，控制权流回上游——这可以有效确保了任意消息都只被处理一次。被认定为无需继续处理的消息不会进入下游的中间件——这让我们能够轻易地实现权限管理。与此同时，Koishi 的中间件也支持异步调用，这使得你可以在中间件函数中实现任何逻辑。事实上，相比更加底层地调用事件监听器，**使用中间件处理消息才是 Koishi 更加推荐的做法**。

::: tip
在你阅读下面的内容之前，你首先应该了解中间件是为了 **处理消息** 而设计的。因此，如果你要处理的是加群申请之类的其他事件，那么你还是应该使用事件监听器来处理。
:::

中间件的本质是下面的函数。看起来挺简单的，不是吗？我们将在下面详细介绍它的运作方式。

```js
type NextFunction = (next?: NextFunction) => any
type Middleware = (session: Session, next: NextFunction) => any
```

### 注册和取消中间件

使用 `ctx.middleware()` 方法注册中间件。这个方法接受一个回调函数，其第一个参数为一个会话对象，第二个参数是 `next` 函数，只有调用了它才会进入接下来的流程。如果自始至终都没有调用 `next` 函数的话，之后的中间件都将不会被执行。下面是一个例子：

```js
ctx.middleware((session, next) => {
  // 仅当接收到的消息包含了对机器人的称呼时才继续处理（比如消息以 @机器人 开头）
  if (session.parsed.appel) {
    return session.send('是你在叫我吗？')
  } else {
    // 如果去掉这一行，那么不满足上述条件的消息就不会进入下一个中间件了
    return next()
  }
})
```

这个函数的返回值是一个新的函数，调用这个函数就可以完成取消上述中间件：

```js
const dispose = ctx.middleware(callback)
dispose() // 取消中间件
```

### 注册异步中间件

中间件也可以是异步的。下面给出一个示例：

```js
ctx.middleware(async (session, next) => {
  // 获取数据库中的用户信息
  // 这里只是示例，事实上 Koishi 会自动获取数据库中的信息并存放在 session.user 中
  const user = await session.getUser(session.userId)
  if (user.authority === 0) {
    return session.send('抱歉，你没有权限访问机器人。')
  } else {
    return next()
  }
})
```

::: warning 注意
异步中间件代码中 next 前面的 return 是必须的。如果删去将可能会导致时序错误，这在 Koishi 中将会抛出一个运行时警告。
:::

### 注册前置中间件

从上面的两个例子中不难看出，中间件是一种消息过滤的利器。但是反过来，当你需要的恰恰是捕获全部消息时，中间件反而不会是最佳选择——因为前置的中间件可能会将消息过滤掉，导致你注册的回调函数根本不被执行。因此在这种情况下，我们更推荐使用事件监听器。然而，还存在着这样一种情况：你既需要捕获全部的消息，又要对其中的一些加以回复，这又该怎么处理呢？

听起来这种需求有些奇怪，让我们举个具体点例子吧：假如你写的是一个复读插件，它需要在每次连续接收到 3 条相同消息时进行复读。我们不难使用事件监听器实现这种逻辑：

```js
let times = 0 // 复读次数
let message = '' // 当前消息

ctx.on('message', (session) => {
  // 这里其实有个小问题，因为来自不同群的消息都会触发这个回调函数
  // 因此理想的做法应该是分别记录每个群的当前消息和复读次数
  // 但这里我们假设机器人只处理一个群，这样可以简化逻辑
  if (session.content === message) {
    times += 1
    if (times === 3) session.send(message)
  } else {
    times = 0
    message = session.content
  }
})
```

但是这样写出的机器人就存在所有用事件监听器写出的机器人的通病——如果这条消息本身可以触发其他回应，机器人就会多次回应。更糟糕的是，你无法预测哪一次回应先发生，因此这样写出的机器人就会产生延迟复读的迷惑行为。为了避免这种情况发生，Koishi 对这种情况也有对应的解决方案，那就是 **前置中间件**：

```js
let times = 0 // 复读次数
let message = '' // 当前消息

ctx.middleware((session, next) => {
  if (session.content === message) {
    times += 1
    if (times === 3) return session.send(message)
  } else {
    times = 0
    message = session.content
    return next()
  }
}, true /* true 表示这是前置中间件 */)
```

### 注册临时中间件

有的时候，你也可能需要实现这样一种逻辑：你的中间件产生了一个响应，但你认为这个响应优先级较低，希望等后续中间件执行完毕后，如果信号仍然未被截取，就执行之前的响应。这当然可以通过注册新的中间件并取消的方法来实现，但是由于这个新注册的中间件可能不被执行，你需要手动处理许多的边界情况。

为了应对这种问题 Koishi 提供了更加方便的写法：你只需要在调用 `next` 时再次传入一个回调函数即可！这个回调函数只接受一个 `next` 参数，且只会加入当前的中间件执行队列；无论这个回调函数执行与否，在本次中间件解析完成后，它都会被清除。下面是一个例子：

```js
ctx.middleware((session, next) => {
  if (session.content === 'hlep') {
    // 如果该 session 没有被截获，则这里的回调函数将会被执行
    return next(() => session.send('你想说的是 help 吗？'))
  } else {
    return next()
  }
})
```

除此以外，临时中间件还有下面的用途。让我们先回到上面介绍的前置中间件。它虽然能够成功解决问题，但是如果有两个插件都注册了类似的前置中间件，就仍然可能发生一个前置中间件截获了消息，导致另一个前置中间件获取不到消息的情况发生。但是，借助临时中间件，我们便有了更好的解决方案：

```js
let times = 0 // 复读次数
let message = '' // 当前消息

ctx.middleware((session, next) => {
  if (session.content === message) {
    times += 1
    if (times === 3) return next(() => session.send(message))
  } else {
    times = 0
    message = session.content
    return next()
  }
}, true)
```

搭配使用上面几种中间件，你的机器人便拥有了无限可能。在 koishi-plugin-common 库中，就有着一个官方实现的复读功能，它远比上面的示例所显示的更加强大。如果想深入了解中间件机制，可以去研究一下这个功能的 [源代码](https://github.com/koishijs/koishi/blob/master/packages/plugin-common/src/handler.ts)。

## 使用会话

### 延时发送

如果你需要连续发送多条消息，那么在各条消息之间留下一定的时间间隔是很重要的：一方面它可以防止消息刷屏和消息错位（后发的条消息呈现在先发的消息前面），提高了阅读体验；另一方面它能够有效降低机器人发送消息的频率，防止被平台误封。这个时候，`session.sendQueued()` 可以解决你的问题。

```js
// 发送两条消息，中间间隔一段时间，这个时间由系统计算决定
await session.sendQueued('message1')
await session.sendQueued('message2')

// 清空等待队列
await session.cancelQueued()
```

你也可以在发送时手动定义等待的时长：

```js
// 如果消息队列非空，在前一条消息发送完成后 1s 发送本消息
await session.sendQueued('message3', Time.second)

// 清空等待队列，并设定下一条消息发送距离现在至少 0.5s
await session.cancelQueued(0.5 * Time.second)
```

事实上，对于不同的消息长度，系统等待的时间也是不一样的，你可以通过配置项修改这个行为：

```js koishi.config.js
module.exports = {
  delay: {
    // 消息里每有一个字符就等待 0.02s
    character: 0.02 * Time.second,
    // 每条消息至少等待 0.5s
    message: 0.5 * Time.second,
  },
}
```

这样一来，一段长度为 60 个字符的消息发送后，下一条消息发送前就需要等待 1.2 秒了。

### 等待用户输入

当你需要进行一些交互式操作时，可以使用 `session.prompt()`：

```js
await session.send('请输入用户名：')

const name = await session.prompt()
if (!name) return session.send('输入超时。')

// 执行后续操作
await ctx.database.setUser(session.platform, session.userId, { name })
return session.send(`${name}，请多指教！`)
```

你可以给这个方法传入一个 `timeout` 参数，或使用 `delay.prompt` 配置项，来作为等待的时间。

### 调用底层接口

当然，你所能做的并不只有在当前频道内发送信息那么简单。我们还提供了 Bot 类，允许你进行更多机器人操作。你可以像这样调用它：

```js
// 向特定频道发送消息
await session.bot.sendMessage(123456789, 'Hello world')

// 获取特定群的成员列表
const members = await session.bot.getGroupMemberList(987654321)
```

你可以在 [**机器人**](../api/bot.md) 一章中看到完整的 API 列表。

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

## 处理消息文本

### 使用消息段

当然，一个聊天平台所能发送或接收的内容往往不只有纯文本——请放心，无论是 @其他人、发送表情、上传文件还是更加复杂的卡片消息都是 Koishi 所能处理的范围。

`segment()` 函数传入两个参数，第一个参数是消息段的类型，第二个参数是一个对象，表示这个消息段的属性。如果希望在你的消息中 @某某用户，或发送一张图片，你可以使用下面的写法：

```js
// @某某用户 我在叫你哟！
session.send(segment('at', { id: userId }) + '我在叫你哟！')

// 你发送了一张 Koishi 图标
session.send(segment('image', { url: 'https://koishi.js.org/koishi.png' }))
```

**前缀消息段**表达了你发送的消息具有某些特殊语义。当你要发送匿名消息，或者引用其他消息的内容，你同样只需要在消息的开头加上一个消息段即可：

```js
session.send(segment('anonymous') + '这是一条匿名消息。')

session.send(segment('quote', { id: messageId }) + '这是一条回复消息。')
```

为了方便起见，在实际应用时，你可以使用 `s()` 代替 `segment()`。

### 使用模板

Koishi 自身就提供了丰富的生态，但如果你觉得某些功能输出的内容缺乏个性化，有没有办法修改它们的行为呢？这时候就可以使用**模板**来解决。

使用 `template.set()` 定义一个模板，并使用 `template()` 获取一个模板的值：

```js
template.set('foo', 'foo{0}ooo')

template('foo', 'bar') // 'foobarooo'
```

又因为官方的多数输出行为都可以使用模板控制，你便可以通过 `template.set()` 覆盖这些行为了。下面举一个例子（假设 echo 是一条有时间间隔限制的指令）：

```js
template.set('internal.too-frequent', '调用太频繁了亲~')
```

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">echo foo</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">foo</chat-message>
<chat-message nickname="Alice" color="#cc0066">echo foo</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">调用太频繁了亲~</chat-message>
</panel-view>

为了方便起见，在实际应用时，你可以使用 `t()` 代替 `template()`。
