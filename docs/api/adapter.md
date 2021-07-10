---
sidebarDepth: 2
---

# 适配器 (Adapter)

本章将介绍与适配器相关的内容，这是一个相当底层的概念，因此如果你并不打算编写一个平台实现，你完全可以跳过本章节。

标有 <Badge text="abstract" vertical="baseline"/> 的方法需要平台自行实现。

## 静态属性和方法

### Adapter.types

- 类型: `Record<string, Adapter.Constructor>`

一个键值对，保存了已经注册的所有适配器。注册时请注意将键改为全小写。

### Adapter.from(app, bot)

- **app:** `App` 应用实例
- **bot:** `BotOptions` 机器人配置
- 返回值: `Adapter`

创建一个适用于 bot 的适配器实例并挂载在 app 下。如果同类型的适配器已经被创建，则直接返回过去创建的实例。

### Adapter.redirect(target)

- **target:** `string | ((bot: BotOptions) => string)`
- 返回值: `void`

创建一个重定向适配器。

## 类：Adapter

### new Adapter(app, BotStatic)

- **app:** `App` 应用实例
- **BotStatic:** `Bot.Constructor` 机器人构造函数

创建一个适配器实例。

### adapter.bots

- 类型: `Bot[] & Record<string, Bot>`

当前适配器下的全部机器人实例。你既可以使用 Array 方法遍历全部机器人，也可以使用 `selfId` 作为索引找到具体的某一个。

### adapter.create(bot)

- **bot:** `BotOptions` 机器人配置
- 返回值: `void`

在当前适配器下添加一个新的机器人。下面是一个例子：

```js
// 如果想要在 App 创建完成后添加一个机器人，你应该这样做
Adapter.from(app, bot).create(bot)
```

### adapter.dispatch(session)

- **session:** `Session` 会话实例
- 返回值: `void`

根据会话内容，在相应的上下文触发一个上报事件。

### adapter.start() <Badge text="abstract"/>

- 返回值: `void | Promise<void>`

启动适配器所需的操作，将作为 connect 事件的回调函数。

### adapter.stop() <Badge text="abstract"/>

- 返回值: `void`

停止适配器所需的操作，将作为 disconnect 事件的回调函数。

## 类：Adapter.WsClient

### new Adapter.WsClient(app, BotStatic, options?)

- **app:** `App` 应用实例
- **BotStatic:** `Bot.Constructor` 机器人构造函数
- **options:** `WsClientOptions` 连接配置

创建一个 WsClient 适配器实例。

```js
export interface WsClientOptions {
  retryLazy?: number
  retryTimes?: number
  retryInterval?: number
}
```

### adapter.prepare(bot) <Badge text="abstract"/>

- **bot:** `Bot` 机器人实例
- 返回值: `WebSocket | Promise<WebSocket>`

根据机器人实例生成一个 WebSocket 对象。

### adapter.connect(bot) <Badge text="abstract"/>

- **bot:** `Bot` 机器人实例
- 返回值: `Promise<void>`

WebSocket 连接成功建立后的回调函数。
