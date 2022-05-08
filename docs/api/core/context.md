---
sidebarDepth: 2
---

# 上下文 (Context)

**上下文 (Context)** 是 Koishi 的重要概念。你的每一个插件，中间件，监听器和指令都被绑定在上下文上。

## 实例属性

以下实例属性都是只读的。

### ctx.state

- 类型: `State`

当前上下文关联的插件信息对象。

```ts
export interface State {
  id: string
  parent: Context
  config?: any
  using: string[]
  schema?: Schema
  plugin?: Plugin
  children: Plugin[]
  disposables: Disposable[]
}
```

### ctx.filter

- 类型: `(session: Session) => boolean`

插件绑定的过滤器。

## 过滤器

有关这里的 API，请参见 [使用上下文](../../guide/context.md#使用上下文)。

### ctx.any()

- 返回值: `Context` 新的上下文

选取上下文全集。

::: tip
这个方法与 `ctx.app` 的区别在于，后者不受插件管理器控制，容易产生内存泄漏。因此我们建议，除非你已经为你的插件声明了副作用，你应当尽量使用这个方法。参见 [插件热重载](../../guide/context.md#插件热重载)。
:::

### ctx.never()

- 返回值: `Context` 新的上下文

选取上下文空集。

### ctx.self(...values)
### ctx.user(...values)
### ctx.guild(...values)
### ctx.channel(...values)
### ctx.platform(...values)

- **values:** `string[]` 允许的机器人 / 用户 / 群组 / 频道 / 平台名称构成的数组
- 返回值: `Context` 新的上下文

选取当前上下文的子集，限定机器人 / 用户 / 群组 / 频道 / 平台名称为所给定的值。

### ctx.union(filter)

- **context:** `Context | ((session: Session) => boolean)` 另一个上下文或者过滤器函数
- 返回值: `Context` 新的上下文

给出当前上下文和其他上下文的并集。

### ctx.intersect(filter)

- **context:** `Context | ((session: Session) => boolean)` 另一个上下文或者过滤器函数
- 返回值: `Context` 新的上下文

给出当前上下文和其他上下文的交集。

### ctx.exclude(filter)

- **context:** `Context | ((session: Session) => boolean)` 另一个上下文或者过滤器函数
- 返回值: `Context` 新的上下文

给出当前上下文和其他上下文的差集。

### ctx.match(session)

- **session:** [`Session`](./session.md) 会话对象
- 返回值: `boolean` 匹配结果

测试上下文能否匹配会话对象。

## 钩子与中间件

有关这里的 API，请参见 [事件系统](../../guide/lifecycle.md#事件系统)。

### ctx.emit(session?, event, ...param)
### ctx.parallel(session?, event, ...param)

- **session:** [`Session`](./session.md) 会话对象
- **event:** `string` 事件名称
- **param:** `any[]` 事件的参数
- 返回值: `boolean` 匹配结果

同时触发所有 event 事件的能够匹配 session 对象的回调函数。emit 为同步，parallel 为异步。

### ctx.bail(session?, event, ...param)
### ctx.serial(session?, event, ...param)

- **session:** [`Session`](./session.md) 会话对象
- **event:** `string` 事件名称
- **param:** `any[]` 事件的参数
- 返回值: `boolean` 匹配结果

依次触发所有 event 事件的能够匹配 session 对象的回调函数。当返回一个 false, null, undefined 以外的值时将这个值作为结果返回。bail 为同步，serial 为异步。

### ctx.chain(session?, event, ...param)
### ctx.waterfall(session?, event, ...param)

- **session:** [`Session`](./session.md) 会话对象
- **event:** `string` 事件名称
- **param:** `any[]` 事件的参数
- 返回值: `boolean` 匹配结果

依次触发所有 event 事件的能够匹配 session 对象的回调函数。每次用得到的返回值覆盖下一轮调用的第一个参数，并在所有函数执行完后返回最终结果。chain 为同步，waterfall 为异步。

### ctx.on(event, listener, prepend?)

- **event:** `string` 事件名称
- **listener:** `Function` 回调函数
- **prepend:** `boolean` 是否前置
- 返回值: `() => boolean` 取消这个监听器

监听一个事件。

### ctx.off(event, listener)

- **event:** `string` 事件名称
- **listener:** `Function` 回调函数
- 返回值: `boolean` 是否有此回调函数

取消监听一个事件。

### ctx.once(event, listener, prepend?)

- **event:** `string` 事件名称
- **listener:** `Function` 回调函数
- **prepend:** `boolean` 是否前置
- 返回值: `() => boolean` 取消这个监听器

监听一个事件，且确保回调函数只会被执行一次。

### ctx.before(event, listener, append?)

- **event:** `string` 事件名称
- **listener:** `Function` 回调函数
- **append:** `boolean` 是否后置
- 返回值: `() => boolean` 取消这个监听器

监听一个以 `before-` 开头的事件。

### ctx.middleware(middleware, prepend?)

- **middleware:** [`Middleware`](../../guide/message.md#使用中间件) 要注册的中间件
- **prepend:** `boolean` 是否前置
- 返回值: `() => boolean` 取消这个中间件

当前上下文中注册一个中间件。

## 指令与插件

### ctx.plugin(plugin, options?)

- **plugin:** `Plugin` 要安装的插件
- **options:** `any` 要传入插件的参数，如果为 `false` 则插件不会被安装
- 返回值: `this`

当前上下文中安装一个插件。参见 [认识插件](../../guide/plugin/)。

### ctx.using(deps, plugin)

- **deps:** `string[]` 依赖的服务列表
- **plugin:** `Plugin` 要安装的插件
- 返回值: `this`

安装一个存在依赖的插件，参见 [声明依赖关系](../../guide/plugin/service.md#声明依赖关系)。

### ctx.command(def, desc?, config?)

- **def:** `string` 指令名以及可能的参数
- **desc:** `string` 指令的描述
- **config:** `CommandConfig` 指令的配置
  - **checkUnknown:** `boolean` 是否对未知选项进行检测，默认为 `false`
  - **checkArgCount:** `boolean` 是否对参数个数进行检测，默认为 `false`
  - **authority:** `number` 最低调用权限，默认为 `1`
  - **showWarning:** `boolean` 当小于最短间隔时是否进行提醒，默认为 `false`
- 返回值：[`Command`](./command.md) 注册或修改的指令

在当前上下文中注册或修改一个指令。

### ctx.getSelfIds(type?, assignees?)

- **type:** `Platform` 平台名称，如果不写就对应全部平台
- **assignees:** `string[]` 机器人 ID 列表，如果不写就对应当前平台的全部机器人
- 返回值: `Record<string, readonly string[]>` 平台名到机器人 ID 列表的键值对

按平台名称对机器人分类。

### ctx.broadcast(channels?, content, forced?)

- **channels:** `string[]` 频道列表
- **content:** `string` 要发送的内容
- **forced:** `boolean` 是否无视 silent 标记
- 返回值: `Promise<string[]>` 成功发送的消息 ID 列表

所有机器人向自己分配的频道广播消息，存在标记 silent 的频道除外。如有失败不会抛出错误。参见 [发送广播消息](../../guide/message.md#发送广播消息)。

### ctx.logger(scope?)

- **scope:** `string` 要指定的类型，默认为 `''`
- 返回值: [`Logger`](../../guide/logger.md#使用-logger)

根据 namespace 生成一个 [Logger 对象](../../guide/logger.md#使用-logger)。

### ctx.dispose(plugin?)

- **plugin:** `Plugin` 要移除的插件
- 返回值: `void`

移除插件中所注册的钩子、中间件、指令和子插件等。`plugin` 是默认为当前上下文所在的插件。如果既没有提供 `plugin`，上下文也不是一个插件上下文的话，会抛出一个错误。参见 [卸载插件](../../guide/plugin/#卸载插件)。

## 静态属性和方法

### Context.current

- 类型: `symbol`

特殊的键值，可以在通用上下文属性对象的方法上访问。参见 [声明通用上下文属性](../../guide/context.md#声明通用上下文属性)。

### Context.service(name) <Badge text="beta" type="warning"/>

- **name:** `string` 属性名称

声明一个通用上下文属性。参见 [声明通用上下文属性](../../guide/context.md#声明通用上下文属性)。
