---
sidebarDepth: 2
---

# 适配器 (Adapter)

本章将介绍与适配器相关的内容，这是一个相当底层的概念，因此如果你并不打算编写一个平台实现，你完全可以跳过本章节。

标有 <Badge text="abstract" vertical="baseline"/> 的方法需要平台自行实现。

## 静态属性和方法

### Adapter.define(platform, bot, adapter)
### Adapter.define(platform, bot, adapters, redirect?)

- 第一种调用方式：
  - **platform:** `string` 平台名
  - **bot:** `Bot.Constructor` Bot 构造函数
  - **adapter:** `Adapter.Constructor` Adapter 构造函数
- 第二种调用方式：
  - **platform:** `string` 平台名
  - **bot:** `Bot.Constructor` Bot 构造函数
  - **adapters:** `Dict<Adapter.Constructor>` 协议到 Adapter 构造函数的键值对
  - **redirect:** `Function` 由 Bot 配置项推断采用的协议的回调函数
- 返回值: `Plugin`

创建一个适配器插件。参见 [编写适配器](../guide/adapter.md) 一节。

## 类：Adapter

### new Adapter(app, config)

- **app:** `App` 应用实例
- **config:** `object` 配置项

创建一个适配器实例。

### adapter.config

- 类型: `object`

构造 Adapter 实例时所使用的配置项。

### adapter.bots

- 类型: `Bot[]`

当前适配器下的全部机器人实例。

### adapter.dispatch(session)

- **session:** `Session` 会话实例
- 返回值: `void`

根据会话内容，在相应的上下文触发一个上报事件。

### adapter.start() <Badge text="abstract"/>

- 返回值: `void | Promise<void>`

启动适配器所需的操作，将作为 connect 事件的回调函数。

### adapter.stop() <Badge text="abstract"/>

- 返回值: `void | Promise<void>`

停止适配器所需的操作，将作为 disconnect 事件的回调函数。

### adapter.connect(bot) <Badge text="abstract"/>

- **bot:** `Bot` 机器人实例
- 返回值: `void | Promise<void>`

连接 Bot 所需的操作，将在 `bot.connect()` 中被调用。

## 类：Adapter.WebSocketClient

### new Adapter.WebSocketClient(app, options?)

- **app:** `App` 应用实例
- **options:** `WebSocketClientOptions` 连接配置

创建一个 WebSocketClient 适配器实例。

```js
export interface WebSocketClientOptions {
  retryLazy?: number
  retryTimes?: number
  retryInterval?: number
}
```

### adapter.prepare(bot) <Badge text="abstract"/>

- **bot:** `Bot` 机器人实例
- 返回值: `WebSocket | Promise<WebSocket>`

根据机器人实例生成一个 WebSocket 对象。

### adapter.accept(bot) <Badge text="abstract"/>

- **bot:** `Bot` 机器人实例
- 返回值: `void`

WebSocket 连接成功建立后的回调函数。你需要实现这个方法，并在其中手动调用 `bot.resolve()` 回调函数表示已经连接成功。
