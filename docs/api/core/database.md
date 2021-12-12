---
sidebarDepth: 2
---

# 数据库 (Database)

## 内置表

### User

- **id:** `string` 内部编号
- **name:** `string` 用户昵称
- **flag:** `number` 状态标签
- **authority:** `number` 用户权限
- **usage:** `Record<string, number>` 指令调用次数
- **timers:** `Record<string, number>` 指令调用时间

### Channel

- **id:** `string` 频道标识符
- **flag:** `number` 状态标签
- **assignee:** `string` 代理者

## 全局接口

### User.Flag, Channel.Flag

所有用户 / 频道状态标签构成的枚举类型。参见 [状态标签](../../guide/database/builtin.md#状态标签)。

## ORM 实例方法

一个 Database 对象代理了 Koishi 上下文绑定的应用实例有关的所有数据库访问。同时它具有注入特性，任何插件都可以自己定义数据库上的方法。本章主要介绍数据库的官方接口。注意：**它们并不由 Koishi 自身实现，而是由每个数据库分别实现的**。Koishi 只是提供了一套标准。

### database.drop(table?)

### database.get(table, query, modifier?)

- **table:** `keyof Tables` 注册在 ORM 中的表名
- **query:** `QueryExpr<Tables[T]> | QueryShorthand` 搜索表达式
- **modifier:** `QueryModifier<keyof Tables[T]>` 请求修饰符
- 返回值: `Promise<Tables[T][]>` 用户数据

参数 query 支持正则以及表达式，你可以使用复杂的嵌套更细致化的去完成你对数据库的查找服务。实现上与 mongo 近似，如果你有使用过 mongodb 经验，那么使用 Koishi ORM 对你来说便不是一件难事。

```ts
interface FieldQueryExpr<T> {
  $regex?: RegExp
  $in?: T[]
  $nin?: T[]
  $eq?: T
  $ne?: T
  $gt?: T
  $gte?: T
  $lt?: T
  $lte?: T
}

interface LogicalQueryExpr<T> {
  $or?: QueryExpr<T>[]
  $and?: QueryExpr<T>[]
  $not?: QueryExpr<T>
}

type QueryShorthand<T> = T[] | RegExp
type FieldQuery<T> = FieldQueryExpr<T> | QueryShorthand<T>
type QueryExpr<T> = LogicalQueryExpr<T> & {
  [K in keyof T]?: FieldQuery<T[K]>
}

interface QueryOptions<T extends string> {
  limit?: number
  offset?: number
  fields?: T[]
}

type QueryModifier<T extends string> = T[] | QueryOptions<T>
```

下面是一些简单的示例

```js
// 获取名为 schedule 的表中 id 为 1 或者 2 的数据行
// Koishi ORM 自动解析你的 primary key
const rows = await ctx.database.get('schedule', [1, 2])
const rows = await ctx.database.get('schedule', { id: [1, 2] })

// 当然 Koishi ORM 也支持了 mongo 的正则写法
const rows = await ctx.database.get('schedule', { command: /echo.*/ })

// 获取名为 schedule 的表中 id 大于 2 但是小于等于 5 的数据行
const rows = await ctx.database.get('schedule', { id: { $gt: 2, $lte: 5 } })

// 获取名为 schedule 的表中
// id 大于 2 但是小于等于 5 或者 id 大于 100 的数据行
const rows = await ctx.database.get('schedule', {
  id: { $gt: 2, $lte: 5 },
  $or: [{ $id: { $gt: 100 } }],
})

// 只获取 id 和 command 字段（默认情况下将获取全部字段）
const rows = await ctx.database.get('schedule', 1, ['id', 'command'])
```

### database.set(table, query, updater)

### database.remove(table, query)

### database.create(table, data)

### database.upsert(table, data, keys?)

### database.aggregate(table, fields, query?)

## 内置实例方法

下列实例方法直接由 @koishijs/core 提供实现。

### database.getUser(platform, id, modifier?)

- **platform:** `string` 平台名
- **id:** `string | string[]` 用户标识符
- **modifier:** `QueryModifier<User.Field>` 请求修饰符
- 返回值: `Promise<User | User[]>` 用户数据

向数据库请求用户数据。如果传入的 id 是一个列表，则返回值也应当是一个列表。

### database.setUser(platform, id, data)

- **platform:** `string` 平台名
- **id:** `string` 用户标识符
- **data:** `User` 要修改 / 添加的数据
- 返回值: `Promise<void>`

向数据库修改或添加用户数据。

### database.getChannel(platform, id, fields?)

- **platform:** `string` 平台名
- **id:** `string | string[]` 频道标识符
- **fields:** `QueryModifier<User.Field>` 请求修饰符
- 返回值: `Promise<Channel | Channel[]>` 频道数据

向数据库请求频道数据。如果传入的 id 是一个列表，则返回值也应当是一个列表。

### database.getAssignedChannels(fields?, platform?, assignees?) <Badge type="danger" text="deprecated"/>

- **fields:** `ChannelField[]` 请求的字段，默认为全部字段
- **platform:** `string` 平台名，默认为全平台
- **assignees:** `string[]` 代理者列表，默认为当前运行的全部机器人
- 返回值: `Promise<Channel[]>` 频道数据列表

向数据库请求被特定机器人管理的所有频道数据。这里的两个参数可以写任意一个，都可以识别。

### database.setChannel(platform, id, data)

- **platform:** `string` 平台名
- **id:** `number` 频道标识符
- **data:** `Channel` 要修改 / 添加的数据
- 返回值: `Promise<void>`

向数据库修改或添加频道数据。
