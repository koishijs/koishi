---
sidebarDepth: 2
---

# 事件与生命周期

在 [接收和发送消息](./message.md) 一章中，我们介绍了如何使用接受消息，并埋下了一个伏笔。本章节就让我们来认识一下 Koishi 的事件系统。

## 事件系统

如果将我们已经熟悉的那个实例用事件系统的方式来改写，应该会是这样：

```js
// 如果收到“天王盖地虎”，就回应“宝塔镇河妖”
ctx.on('message', (session) => {
  if (session.content === '天王盖地虎') {
    session.send('宝塔镇河妖')
  }
})
```

上面的 `message` 字符串被称为 **事件名称**。这个事件名称可能有多级：我们用 `message/group` 表示群组消息，`message/private` 表示私聊消息。这意味着你可以只监听收到消息的一部分。而当你监听 `message` 事件时，则所有收到的消息都会经由这个回调函数处理。

除去这个例子中所使用的 **上报事件** 外，Koishi 自身也提供了一批 **内部事件**，例如用 `connect` 事件表示应用启动完成等。前者通常由适配器生成，回调函数只接受一个会话对象；而后者由 Koishi 自身生成，回调函数有着各种不同的形式。你可以在 [事件文档](../api/events.md) 中看到全部 Koishi 支持的事件接口。

### 事件的命名

无论是上报事件，内部事件还是插件事件，Koishi 的事件名都遵循者一些既定的规范。它们包括：

- 总是使用 param-case 作为事件名
- 使用 `/` 作为事件命名空间的分隔符
- 配对使用 xxx 和 before-xxx 命名事件

对于上报事件来说，命名空间和其子事件往往是一种包含的关系，例如 `group-member` 和 `group-member/ban`。当子事件被触发时，其父事件也会被同时触发。而对于内部事件来说，命名空间则单纯是为了将事件归类而设计的，例如 `dialogue/modify` 表示在教学插件中进行了修改操作。对于全部插件的开发者，我们都建议将插件相关的事件放入自己的命名空间中，以免发生冲突。

### 注册监听器

要注册一个监听器，可以使用 `ctx.on(event, callback)`，它的用法与 Node.js 自带的 [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter) 类似，不过多出了第三个可选参数 `prepend`：如果设为 truthy 则在事件队列的头部而不是尾部添加，相当于 `emitter.prependListener()`。与此同时，我们也提供了类似的函数 `ctx.once(event, callback)`，用于注册一个只触发一次的监听器；以及 `ctx.off(event, callback)`，用于取消一个已注册的监听器。

特别地，Koishi 有不少监听器是满足 before-xxx 形式的。对于这类监听器的注册，我们也提供了一个语法糖，那就是 `ctx.before('xxx', callback)`。如此使用时，默认情况与第三个参数的作用与前面描述的正好相反。考虑到事件的命名空间，如果使用 `ctx.before('xxx/yyy', callback)`，其实际效果也与 `ctx.on('xxx/before-yyy', callback)` 相当。

这些方法与 EventEmitter 的另一个不同点在于，无论是 `ctx.on()` 还是 `ctx.before()` 都会返回一个 dispose 函数，调用这个函数即可取消注册监听器。因此你完全不必使用 `ctx.once()` 和 `ctx.off()`。下面给一个只触发一次的监听器的例子：

```js
const dispose = ctx.on('foo', (...args) => {
  dispose()
  // do something
})
```

### 触发事件

在 Koishi 中，触发一个事件可以有着多种形式，目前支持 6 个不同的方法，足以适应绝大多数需求。

- `ctx.emit()` 同时触发所有 event 事件的回调函数。
- `ctx.parallel()` 是上述方法对应的异步版本。
- `ctx.bail()` 依次触发所有 event 事件的回调函数。当返回一个 `false`, `null`, `undefined` 以外的值时将这个值作为结果返回。
- `ctx.serial()` 是上述方法对应的异步版本。
- `ctx.chain()` 依次触发所有 event 事件的回调函数。每次用得到的返回值覆盖下一轮调用的第一个参数，并在所有函数执行完后返回最终结果。
- `ctx.waterfall()` 是上述方法对应的异步版本。

## 生命周期

在实际使用生命周期钩子之前，我们需要对 App 的生命周期有一个总体的认识：它分为 **连接阶段**、**运行阶段** 和 **销毁阶段**。下图大体展示了一个 App 实例的生命周期。在本节的后面，我们将具体介绍每一部分的流程细节。当然你不需要立即弄明白所有的东西，不过随着你的不断学习和使用，它的参考价值会越来越高。

![app-lifecycle](/app-lifecycle.png)

### 事件、中间件与指令

我们已经熟悉了 Koishi 的一些基本概念，比如事件、中间件和指令等，那么他们的关系是什么呢？上面的生命周期图也同样告诉了我们答案：**中间件由内置监听器管理，而指令由内置中间件管理**。没错，当 message 事件被发送到各个上下文的监听器上时，绑定在 App 上的内置监听器将会将这个事件逐一交由中间件进行处理。全部处理完成后会触发一个 after-middleware 事件。

因为我们通常不需要直接监听 message 事件（使用中间件往往是更好的实现），after-middleware 事件的触发通常意味着你对一条消息的处理已经完成。我们的测试工具 koishi-test-utils 就是基于这种逻辑实现了它的会话 API。

### 内置监听器

1. message 事件触发，进入中间件处理流程
2. 根据上下文从中间件池中筛选出要执行的中间件序列
3. 逐一执行中间件：
    - 内置中间件是理论上第一个注册的中间件（下接 [内置中间件](#内置中间件)）
    - 通过 `ctx.middleware(cb, true)` 注册的中间件会插在队列的更前面
    - 临时中间件会直接插在当前序列的尾端，并不会影响中间件池本身
    - 如果执行中遇到错误或未调用 `next` 函数，会停止后续中间件的执行
4. 触发 [middleware](../api/events.md#事件：middleware) 事件
5. 更新当前用户和群的缓冲数据（参见 [按需加载与自动更新](./manage.md#按需加载与自动更新)）

### 内置中间件

1. 从前缀中匹配 at 机器人，nickname 或 prefix
2. 预处理消息内容，生成 [`session.parsed`](../api/session.md#session-parsed)
3. 触发 [before-parse](../api/events.md#事件：before-parse) 事件，尝试解析消息内容（[快捷方式](./execute.md#快捷方式) 的解析也在此处完成）
4. 如果数据库存在：
    - 触发 [before-attach-channel](../api/events.md#事件：before-attach-channel) 事件
    - 获取频道数据并存储于 [`session.channel`](../api/session.md#session-channel)
    - 根据 flags, assignee 等字段判断是否应该处理该信息，如果不应该则直接返回
    - 触发 [attach-channel](../api/events.md#事件：attach-channel) 事件（用户可以在其中同步地更新群数据，或中止执行后续操作）
    - 触发 [before-attach-user](../api/events.md#事件：before-attach-user) 事件
    - 获取用户数据并存储于 [`session.user`](../api/session.md#session-user)
    - 根据 flags 等字段判断是否应该处理该信息，如果不应该则直接返回
    - 触发 [attach-user](../api/events.md#事件：attach-user) 事件（用户可以在其中同步地更新群和用户数据，或中止执行后续操作）
5. 如果解析出指令：执行该指令（下接 [指令执行流程](#指令执行流程)）
6. 尝试解析出候选指令，如果成功则显示候选项（参见 [模糊匹配](./execute.md#模糊匹配)）

在以上过程中，无论是解析指令还是出发内置的 before-attach-* 钩子都可能用到 [parse](../api/events.md#事件：parse) 事件。

### 指令执行流程

1. 如果解析过程中存在错误（如非法参数等），直接返回错误信息
2. 逐一调用 check 回调函数，直到返回值不为 `undefined`
3. 触发 [before-command](../api/events.md#事件：before-command) 事件：
    - 如果是 -h, --help 则直接显示帮助信息（参见 [查看帮助](./help.md#查看帮助)）
    - 根据配置检查用户权限和调用记录（参见 [指令调用管理](./message.md#指令调用管理)）
4. 逐一调用 action 回调函数，直到返回值不为 `undefined`
5. 触发 [command](../api/events.md#事件：command) 事件
