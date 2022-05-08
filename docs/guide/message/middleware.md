---
sidebarDepth: 2
---

# 使用中间件

从本节开始，我们开始深入研究如何利用 Koishi 的来接收和发送消息。

首先让我们回顾一下之前展示过的 [基本示例](../introduction/direct.md#添加交互逻辑)：

```ts
// 如果收到“天王盖地虎”，就回应“宝塔镇河妖”
ctx.middleware((session, next) => {
  if (session.content === '天王盖地虎') {
    return '宝塔镇河妖'
  } else {
    return next()
  }
})
```

在这个简单的示例中，这里有两件事你需要了解：

上面的 `ctx.middleware()` 方法所传入的回调函数成为 **中间件 (Middleware)**。你可以使用中间件来处理所有收到的一切消息。如果你希望处理其他类型的事件 (例如加群申请又或者消息撤回等等)，可以使用 Koishi 的事件系统，这将在后面的章节中介绍。

上面的 `session` 对象被称为 **会话 (Session)**。所有的上报事件都会被转化成一个会话对象。你可以利用这个对象访问与此事件有关的数据 (例如用 `session.content` 表示消息的内容)，或调用 API 作为对此事件的响应 (例如用 `session.send()` 在当前频道内发送消息)。

## 为什么？

读到这里你可能会想问：为什么不先学习更加通用的事件系统呢？毕竟，有了接收事件和发送消息的能力，似乎你就能完成一切工作了——很多机器人框架也的确是这么想的。但是从 Koishi 的角度，这还远远不够。因为当我们面临更多复杂的需求时：如何限制消息能触发的应答次数？如何进行权限管理？如何提高机器人的性能？这些问题的答案将我们引向另一套更高级的系统——这也就是中间件的由来。

中间件是对消息事件处理流程的再封装。你注册的所有中间件将会由一个事件监听器进行统一管理，数据流向下游，控制权流回上游——这可以有效确保了任意消息都只被处理一次。被认定为无需继续处理的消息不会进入下游的中间件——这让我们能够轻易地实现权限管理。与此同时，Koishi 的中间件也支持异步调用，这使得你可以在中间件函数中实现任何逻辑。事实上，相比更加底层地调用事件监听器，**使用中间件处理消息才是 Koishi 更加推荐的做法**。

中间件的本质是下面的函数。看起来挺简单的，不是吗？我们将在下面详细介绍它的运作方式。

```ts
type Next = (next?: Callback) => Promise<void | string>
type Callback = void | string | ((next?: Next) => Awaitable<void | string>)
type Middleware = (session: Session, next: Next) => Promise<void | string>
```

## 注册和取消中间件

使用 `ctx.middleware()` 方法注册中间件。这个方法接受一个回调函数，其第一个参数为一个会话对象，第二个参数是 `next` 函数，只有调用了它才会进入接下来的流程。如果自始至终都没有调用 `next` 函数的话，之后的中间件都将不会被执行。下面是一个例子：

```ts
ctx.middleware((session, next) => {
  // 仅当接收到的消息包含了对机器人的称呼时才继续处理（比如消息以 @机器人 开头）
  if (session.parsed.appel) {
    return '是你在叫我吗？'
  } else {
    // 如果去掉这一行，那么不满足上述条件的消息就不会进入下一个中间件了
    return next()
  }
})
```

这个函数的返回值是一个新的函数，调用这个函数就可以完成取消上述中间件：

```ts
declare const callback: import('koishi').Middleware
// ---cut---
const dispose = ctx.middleware(callback)
dispose() // 取消中间件
```

## 注册异步中间件

中间件也可以是异步的。下面给出一个示例：

```ts
ctx.middleware(async (session, next) => {
  // 获取数据库中的用户信息
  // 这里只是示例，事实上 Koishi 会自动获取数据库中的信息并存放在 session.user 中
  const user = await session.getUser(session.userId)
  if (user.authority === 0) {
    return '抱歉，你没有权限访问机器人。'
  } else {
    return next()
  }
})
```

::: warning 注意
异步中间件代码中，`next` 函数被调用时前面必须加上 await (或者 return)。如果删去将可能会导致时序错误，这在 Koishi 中将会抛出一个运行时警告。
:::

## 注册前置中间件

从上面的两个例子中不难看出，中间件是一种消息过滤的利器。但是反过来，当你需要的恰恰是捕获全部消息时，中间件反而不会是最佳选择——因为前置的中间件可能会将消息过滤掉，导致你注册的回调函数根本不被执行。因此在这种情况下，我们更推荐使用事件监听器。然而，还存在着这样一种情况：你既需要捕获全部的消息，又要对其中的一些加以回复，这又该怎么处理呢？

听起来这种需求有些奇怪，让我们举个具体点例子吧：假如你写的是一个复读插件，它需要在每次连续接收到 3 条相同消息时进行复读。我们不难使用事件监听器实现这种逻辑：

```ts
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

```ts
let times = 0 // 复读次数
let message = '' // 当前消息

ctx.middleware((session, next) => {
  if (session.content === message) {
    times += 1
    if (times === 3) return message
  } else {
    times = 0
    message = session.content
    return next()
  }
}, true /* true 表示这是前置中间件 */)
```

## 注册临时中间件

有的时候，你也可能需要实现这样一种逻辑：你的中间件产生了一个响应，但你认为这个响应优先级较低，希望等后续中间件执行完毕后，如果信号仍然未被截取，就执行之前的响应。这当然可以通过注册新的中间件并取消的方法来实现，但是由于这个新注册的中间件可能不被执行，你需要手动处理许多的边界情况。

为了应对这种问题 Koishi 提供了更加方便的写法：你只需要在调用 `next` 时再次传入一个回调函数即可！这个回调函数只接受一个 `next` 参数，且只会加入当前的中间件执行队列；无论这个回调函数执行与否，在本次中间件解析完成后，它都会被清除。下面是一个例子：

```ts
ctx.middleware((session, next) => {
  if (session.content === 'hlep') {
    // 如果该 session 没有被截获，则这里的回调函数将会被执行
    return next('你想说的是 help 吗？')
  } else {
    return next()
  }
})
```

除此以外，临时中间件还有下面的用途。让我们先回到上面介绍的前置中间件。它虽然能够成功解决问题，但是如果有两个插件都注册了类似的前置中间件，就仍然可能发生一个前置中间件截获了消息，导致另一个前置中间件获取不到消息的情况发生。但是，借助临时中间件，我们便有了更好的解决方案：

```ts
let times = 0 // 复读次数
let message = '' // 当前消息

ctx.middleware((session, next) => {
  if (session.content === message) {
    times += 1
    if (times === 3) return next(message)
  } else {
    times = 0
    message = session.content
    return next()
  }
}, true)
```

搭配使用上面几种中间件，你的机器人便拥有了无限可能。在 @koishijs/plugin-repeater 库中，就有着一个官方实现的复读功能，它远比上面的示例所显示的更加强大。如果想深入了解中间件机制，可以去研究一下这个功能的 [源代码](https://github.com/koishijs/koishi/blob/master/plugins/common/repeater/src/index.ts)。
