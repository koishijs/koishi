---
sidebarDepth: 2
---

# 事件与生命周期

在 [使用会话](../message/session.md) 一章中，我们介绍了如何使用接受会话事件，并埋下了一个伏笔。本章节就让我们来完整地认识一下 Koishi 的事件系统。

## 事件系统

### 注册监听器

先让我们回顾一下之前介绍过的例子：

```ts
// 当有新成员入群时，发送：欢迎+@入群者+入群！
ctx.on('guild-member-added', (session) => {
  session.send('欢迎' + segment.at(session.userId) + '入群！')
})
```

要注册一个监听器，可以使用 `ctx.on()`，它的基本用法与 Node.js 自带的 [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter) 类似：第一个参数表示要监听的事件名称，第二个参数表示事件的回调函数。同时，我们也提供了类似的函数 `ctx.once()`，用于注册一个只触发一次的监听器；以及 `ctx.off()`，用于取消一个已注册的监听器。

这套事件系统与 EventEmitter 的一个不同点在于，无论是 `ctx.on()` 还是 `ctx.once()` 都会返回一个 dispose 函数，调用这个函数即可取消注册监听器。因此你其实不必使用 `ctx.once()` 和 `ctx.off()`。下面给一个只触发一次的监听器的例子：

```ts
declare module 'koishi' {
  interface EventMap {
    foo(...args: any[]): void
  }
}
// ---cut---
// 回调函数只会被触发一次
const dispose = ctx.on('foo', (...args) => {
  dispose()
  // do something
})
```

### 事件的命名

无论是通用会话事件，生命周期事件还是插件自定义的事件，Koishi 的事件名都遵循着一些既定的规范。它们包括：

- 总是使用 param-case 作为事件名 (在 JavaScript 中使用下划线是坏文明)
- 对于相关的大量事件，推荐通过命名空间进行管理，使用 `/` 作为分隔符
- 配对使用 xxx 和 before-xxx 命名时序相关的事件

举个例子，@koishijs/plugin-teach 扩展了多达 20 个自定义事件。为了防止命名冲突，所有的事件都以 `dialogue/` 开头，并且在特定操作前触发的事件都包含了 `before-` 前缀，例如：

- dialogue/before-search: 获取搜索结果前触发
- dialogue/search: 获取完搜索结果后触发

### 前置事件和执行次序

前面介绍了，Koishi 有不少监听器满足 before-xxx 的形式。对于这类监听器的注册，我们也提供了一个语法糖，那就是 `ctx.before('xxx', callback)`。这种写法也支持命名空间的情况：

```ts
// @errors: 2304
ctx.before('dialogue/search', callback)
// 相当于
ctx.on('dialogue/before-search', callback)
```

默认情况下，事件的多个回调函数的执行顺序取决于它们添加的顺序。先注册的回调函数会先被执行。如果你希望提高某个回调函数的优先级，可以给 `ctx.on()` 传入第三个参数 `prepend`，设置为 true 即表示添加到事件执行队列的开头而非结尾，相当于 [`emitter.prependListener()`](https://nodejs.org/api/events.html#emitterprependlistenereventname-listener)。

对于 `ctx.before()`，情况则正好相反。默认的行为的先注册的回调函数后执行，同时 `ctx.before()` 的第三个参数 `append` 则表示添加到事件执行队列的末尾而非开头。

### 事件的触发形式

Koishi 的事件系统与 EventEmitter 的最大区别在于，触发一个事件可以有着多种形式，目前支持 6 个不同的方法，足以适应绝大多数需求。

- `ctx.emit()` 同时触发所有 event 事件的回调函数。
- `ctx.parallel()` 是上述方法对应的异步版本。
- `ctx.bail()` 依次触发所有 event 事件的回调函数。当返回一个 `false`, `null`, `undefined` 以外的值时将这个值作为结果返回。
- `ctx.serial()` 是上述方法对应的异步版本。
- `ctx.chain()` 依次触发所有 event 事件的回调函数。每次用得到的返回值覆盖下一轮调用的第一个参数，并在所有函数执行完后返回最终结果。
- `ctx.waterfall()` 是上述方法对应的异步版本。

这些方法的基本用法也都与 EventEmitter 类似，第一个参数是事件名称，之后的参数对应回调函数的参数。下面是一个例子：

```ts
declare module 'koishi' {
  interface EventMap {
    'custom-event'(...args: any[]): void
  }
}

// ---cut---
// @errors: 2304
ctx.emit('custom-event', arg1, arg2, ...rest)
// 对应于
ctx.on('custom-event', (arg1, arg2, ...rest) => {})
```

### 支持选择器的事件

在上一章中，我们已经了解到上下文选择器会对会话事件进行过滤。但是相信你应该已经意识到，事件不一定与某个会话相关，而这样的事件显然不能被过滤。那么，如何让特定事件支持选择器呢？只需在触发事件的时候传入一个额外的一参数 `session` 即可：

```ts
declare module 'koishi' {
  interface EventMap {
    'custom-event'(...args: any[]): void
  }
}

// ---cut---
// @errors: 2304
// 无法匹配该会话的上下文中注册的回调函数不会被执行 (可能有点绕)
ctx.emit(session, 'custom-event', arg1, arg2, ...rest)
```

而这也是这类事件被称为 **会话事件** 的原因。

## 生命周期事件

目前我们了解的事件还仅限于通用会话事件。然而 Koishi 还有不少的内部事件，这些事件会在不同的阶段被触发。你可以通过监听它们来实现各种各样的功能。这里只介绍最核心的几个事件。要了解更多事件，可以参考 [事件列表](../../api/core/events.md)。

### ready 事件

ready 事件在应用启动时触发。如果一个插件在加载时，应用已经处于启动状态，则会立即触发。在下面的场景建议将逻辑放入 ready 事件：

- 含有异步操作 (比如文件操作，网络请求等)
- 希望等待其他插件加载完成后才执行的操作

### dispose 事件

应用被关闭或插件被卸载时触发。它最主要的功能是在卸载时清除插件的 [副作用](./plugin.md#卸载插件)。Koishi 的插件系统支持热重载，因此一个插件可能在运行时被多次加载和卸载。如果处理不当，可能会导致内存泄漏。请在开发功能复杂的插件时注意这一点。

事实上，我们熟悉的许多操作都会自动注册相应的 dispose 回调函数，包括事件、中间件和指令等等。

## 消息处理流程

我们已经熟悉了 Koishi 的一些基本概念，比如事件、中间件和指令等，那么他们的关系是什么呢？上面的生命周期图也同样告诉了我们答案：**中间件由内置监听器管理，而指令由内置中间件管理**。没错，当 message 事件被发送到各个上下文的监听器上时，绑定在 App 上的内置监听器将会将这个事件逐一交由中间件进行处理。全部处理完成后会触发一个 after-middleware 事件。

因为我们通常不需要直接监听 message 事件 (使用中间件往往是更好的实现)，after-middleware 事件的触发通常意味着你对一条消息的处理已经完成。我们的测试插件 @koishijs/plugin-mock 就是基于这种逻辑实现了它的会话 API。

::: tip
这一节会介绍一些 Koishi 的内部机制。部分细节要等到后续章节才会介绍，因此你不需要立即弄明白所有的东西。不过随着你的不断学习和使用，它的参考价值会越来越高。
:::

### 内置消息监听器

1. message 事件触发，进入中间件处理流程
2. 根据上下文从中间件池中筛选出要执行的中间件序列
3. 逐一执行中间件：
    - 内置中间件是理论上第一个注册的中间件 (下接 [内置中间件](#内置中间件))
    - 通过 `ctx.middleware(cb, true)` 注册的中间件会插在队列的更前面
    - 临时中间件会直接插在当前序列的尾端，并不会影响中间件池本身
    - 如果执行中遇到错误或未调用 `next` 函数，会停止后续中间件的执行
4. 触发 [middleware](../../api/core/events.md#事件：middleware) 事件
5. 更新当前用户和群的缓冲数据 (参见 [按需加载与自动更新](./manage.md#按需加载与自动更新))

### 内置中间件

1. 从前缀中匹配 at 机器人，nickname 或 prefix
2. 预处理消息内容，生成 [`session.parsed`](../../api/core/session.md#session-parsed)
3. 触发 [before-parse](../../api/core/events.md#事件：before-parse) 事件，尝试解析消息内容 ([快捷方式](./execute.md#快捷方式) 的解析也在此处完成)
4. 如果数据库存在：
    - 触发 [before-attach-channel](../../api/core/events.md#事件：before-attach-channel) 事件
    - 获取频道数据并存储于 [`session.channel`](../../api/core/session.md#session-channel)
    - 根据 flags, assignee 等字段判断是否应该处理该信息，如果不应该则直接返回
    - 触发 [attach-channel](../../api/core/events.md#事件：attach-channel) 事件 (用户可以在其中同步地更新群数据，或中止执行后续操作)
    - 触发 [before-attach-user](../../api/core/events.md#事件：before-attach-user) 事件
    - 获取用户数据并存储于 [`session.user`](../../api/core/session.md#session-user)
    - 根据 flags 等字段判断是否应该处理该信息，如果不应该则直接返回
    - 触发 [attach-user](../../api/core/events.md#事件：attach-user) 事件 (用户可以在其中同步地更新群和用户数据，或中止执行后续操作)
5. 如果解析出指令：执行该指令 (下接 [指令执行流程](#指令执行流程))
6. 尝试解析出候选指令，如果成功则显示候选项 (参见 [模糊匹配](./execute.md#模糊匹配))

在以上过程中，无论是解析指令还是出发内置的 before-attach-* 钩子都可能用到 [parse](../../api/core/events.md#事件：parse) 事件。

### 指令执行流程

1. 如果解析过程中存在错误 (如非法参数等)，直接返回错误信息
2. 逐一调用 check 回调函数，直到返回值不为 `undefined`
3. 触发 [before-command](../../api/core/events.md#事件：before-command) 事件：
    - 如果是 -h, --help 则直接显示帮助信息 (参见 [查看帮助](./help.md#查看帮助))
    - 根据配置检查用户权限和调用记录 (参见 [指令调用管理](./message.md#指令调用管理))
4. 逐一调用 action 回调函数，直到返回值不为 `undefined`
5. 触发 [command](../../api/core/events.md#事件：command) 事件
