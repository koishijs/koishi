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

所有用户 / 频道状态标签构成的枚举类型。参见 [状态标签](../guide/manage.md#状态标签)。

### User.fields, Channel.fields

所有用户 / 频道字段构成的列表。

### User.extend(getter), Channel.extend(getter)

- **getter:** `(type: string, id: string) => object` 新字段的初始化函数，返回值应该是一个由要扩展的字段和它们的默认值构成的键值对
- 返回值: `void`

扩展用户 / 频道字段。

### User.create(type, id), Channel.create(type, id)

- **type:** `string` 平台名
- **id:** `string` 用户 / 频道标识符
- 返回值: `User` / `Channel`

创建一个新用户 / 频道数据对象。

### Tables.extend(name, config?)

- **name:** `string` 数据表名
- **config:** `Table.Meta` 表的基本配置
  - **config.primary:** `string` 主键名，默认为 `'id'`
  - **config.unique:** `string[]` 值唯一的键名列表
  - **config.type:** `string` 主键产生的方式，目前支持：
    - `incremental`: 检测目前最大的主键值，并增加 1 作为新的主键值，适用于数值类型的主键
    - `random`: 产生一个随机字符串作为新的主键值，适用于字符串类型的主键
    - 注意：如果你的主键值是用户指定的，那么你将不需要此项配置

扩展一个新的数据表。

### Database.extend(database, extension)

- **database:** `string | (new () => Database)` 要扩展的数据库类
  - 如果传入一个字符串，则会将这个模块的默认导出作为目标类
- **extension:** `Partial<Database> | ((Database: T) => void)`
  - 如果传入一个对象，则表示要添加到原型链的方法
  - 如果传入一个函数，则会传入上述类构造器并立即执行

扩展数据库的功能。

## ORM API

一个 Database 对象代理了 Koishi 上下文绑定的应用实例有关的所有数据库访问。同时它具有注入特性，任何插件都可以自己定义数据库上的方法。本章主要介绍数据库的官方接口。注意：**它们并不由 Koishi 自身实现，而是由每个数据库分别实现的**。Koishi 只是提供了一套标准。

### db.get(table, query, modifier?)

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

### db.remove(table, query)

### db.create(table, data)

### db.update(table, data, key?)

## 数据库方法

### db.getUser(type, id, modifier?)

- **type:** `string` 平台名
- **id:** `string | string[]` 用户标识符
- **modifier:** `QueryModifier<User.Field>` 请求修饰符
- 返回值: `Promise<User | User[]>` 用户数据

向数据库请求用户数据。如果传入的 id 是一个列表，则返回值也应当是一个列表。

::: tip 提示
尽管这里我们提供了 `fields` 参数用于对特定的数据库进行优化，但是如果你是数据库开发者，也完全可以忽略这个参数。只需要保证返回的数据满足用户数据格式，且包含在 `fields` 中的字段都存在即可。
:::

### db.setUser(type, id, data)

- **type:** `string` 平台名
- **id:** `string` 用户标识符
- **data:** `User` 要修改 / 添加的数据
- 返回值: `Promise<void>`

向数据库修改或添加用户数据。

### db.getChannel(type, id, fields?)

- **type:** `string` 平台名
- **id:** `string | string[]` 频道标识符
- **fields:** `QueryModifier<User.Field>` 请求修饰符
- 返回值: `Promise<Channel | Channel[]>` 频道数据

向数据库请求频道数据。如果传入的 id 是一个列表，则返回值也应当是一个列表。

### db.getAssignedChannels(fields?, type?, assignees?)

- **fields:** `ChannelField[]` 请求的字段，默认为全部字段
- **type:** `string` 平台名，默认为全平台
- **assignees:** `string[]` 代理者列表，默认为当前运行的全部机器人
- 返回值: `Promise<Channel[]>` 频道数据列表

向数据库请求被特定机器人管理的所有频道数据。这里的两个参数可以写任意一个，都可以识别。

### db.setChannel(type, id, data)

- **type:** `string` 平台名
- **id:** `number` 频道标识符
- **data:** `Channel` 要修改 / 添加的数据
- 返回值: `Promise<void>`

向数据库修改或添加频道数据。
