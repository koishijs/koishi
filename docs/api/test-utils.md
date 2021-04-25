---
sidebarDepth: 2
---

# 测试工具 (Test Utils)

::: tip
本页显示的版本号都表示对应的 koishi-test-utils 版本号（而不是对应的 koishi 版本号）。
:::

koishi-test-utils 包含了被 Koishi 使用的测试工具。

## testDatabase(app: App)

- **app:** [`App`](./app.md) 用于测试的 App 实例
- 返回值: [`App`](./app.md) 用于测试的 App 实例

测试全部内置数据库方法。

## 类：MockedApp

App 的子类，封装了一系列用于测试的方法。除了 MockedApp 这个名字外，你还可以直接从 koishi-test-utils 中引入 App：

```js
import { App } from 'koishi-test-utils'

const mockedApp = new App()
```

### new MockedApp(options?)

- **options.mockStart:** `boolean` 使构造的应用处于已连接状态
- **options.mockDatabase:** `boolean` 给构造的应用配置一个 [MemoryDatabase](#类-memorydatabase)
- 返回值: `MockedApp`

这里的 `options` 除了支持 App 类的所有构造选项外，还支持下列选项：

### app.receive(meta)

- **meta:** `Partial<Session>` 事件所需的 Session 属性
- 返回值: `string`

触发会话事件。

### app.session(userId, channelId?)

- **userId:** `string` 用户 ID
- **channelId:** `string` 频道 ID
- 返回值: `TestSession`

创建一个测试会话。

## 类：TestSession

**测试会话**是对发往同一上下文的多次消息的一个抽象。它使用 `app.session()` 方法创建，并借助 `app.receive()` 实现其功能。

::: warning
这个类下的大部分方法的返回都基于 [session.send](./session.md#session-send) 方法和 [after-middleware](./events.md#事件：after-middleware) 事件。在提供了极大方便的同时，会话也存在一些限制。如果你的插件存在以下几种特殊情况之一：

- 使用了异步的 message 事件监听器
- 中间件和指令中可能存在未阻塞的异步操作
- 直接调用 Bot API 而非 meta.send

这个类的方法可能会返回预料之外的结果。当然，如果要测试这些特殊情况，koishi-test-utils 也是提供了其他方法的。
:::

### session.receive(content, count?)

- **content:** `string` 要发送的信息
- **count:** `number` 等待的回复数量
- 返回值: `Promise<string[]>` 收到的回复列表

模拟发送一条消息。

### session.shouldReply(content, reply?)

- **content:** `string` 要发送给机器人的信息
- **reply:** `string | RegExp | readonly (string | RegExp)[]` 应有的回复，如果略去则不会进行比较
- 返回值: `Promise<void>`

断言某条信息应存在某些回复。

### session.shouldNotReply(content)

- **content:** `string` 要发送给机器人的信息
- 返回值: `Promise<void>`

断言某条信息不应存在任何回复。

## 类：MemoryDatabase

### db.$store

### db.$create

### db.$select

### db.$update

### db.$remove

### db.$count
