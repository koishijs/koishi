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

所有用户 / 频道状态标签构成的枚举类型。参见 [状态标签](../../guide/manage.md#状态标签)。

### Tables.extend(name, fields, config?) <Badge type="warning" text="beta"/>

- **name:** `string` 数据表名
- **fields:** `Field.Config` 字段信息
- **config:** `Table.Meta` 表的基本配置
  - **config.primary:** `string | string[]` 主键名，默认为 `'id'`
  - **config.unique:** `(string | string[])[]` 值唯一的键名列表
  - **config.foreign:** `Dict<[string, string]>` 值唯一的键名列表
  - **config.autoInc:** `boolean` 是否使用自增主键

扩展一个新的数据表。

## 数据类型

数值类型会被用于 [`Tables.extend()`](#tables-extend-name-fields-config)，其定义如下：

```ts
export interface Field<T> {
  type: string
  length?: number
  nullable?: boolean
  initial?: T
  comment?: string
}
```

::: tip
- 默认情况下 `nullable` 为 `true`
- 如果 `initial` 或默认初始值不为 `null`，则 `nullable` 默认为 `false`
- 如果希望覆盖默认初始值的以上行为，可以将 `initial` 手动设置为 `null`
:::

### 数值类型

| 名称 | TS 类型 | 默认长度 | 默认初始值 | 说明 |
| :-: | :-: | :-: | :-: | :-: |
| integer | `number` | 10 | `0` | 有符号整型数，长度决定了数据的范围 |
| unsigned | `number` | 10 | `0` | 无符号整型数，长度决定了数据的范围 |
| float | `number` | 固定长度 | `0` | 单精度浮点数 |
| double | `number` | 固定长度 | `0` | 双精度浮点数 |

### 字符串类型

| 名称 | TS 类型 | 默认长度 | 默认初始值 | 说明 |
| :-: | :-: | :-: | :-: | :-: |
| char | `string` | 64 | `''` | 定长的字符串 |
| string | `string` | 256 | `''` | 变长的字符串 |
| text | `string` | 65535 | `''` | 变长的字符串 |

### 时间类型

| 名称 | TS 类型 | 默认长度 | 默认初始值 | 说明 |
| :-: | :-: | :-: | :-: | :-: |
| date | `Date` | 固定长度 | `null` | 日期值 |
| time | `Date` | 固定长度 | `null` | 时间值 |
| timestamp | `Date` |  固定长度 | `null` | 时间戳 |

### 其他类型

| 名称 | TS 类型 | 默认长度 | 默认初始值 | 说明 |
| :-: | :-: | :-: | :-: | :-: |
| json | `object` | 65535 | `null` | 可被序列化为 json 的结构化数据 |
| list | `string[]` | 65535 | `[]` | 字符串构成的列表，序列化时以逗号分隔 |

## ORM 方法

一个 Database 对象代理了 Koishi 上下文绑定的应用实例有关的所有数据库访问。同时它具有注入特性，任何插件都可以自己定义数据库上的方法。本章主要介绍数据库的官方接口。注意：**它们并不由 Koishi 自身实现，而是由每个数据库分别实现的**。Koishi 只是提供了一套标准。

### db.drop(table?)

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

### db.set(table, query, updater)

### db.remove(table, query)

### db.create(table, data)

### db.upsert(table, data, keys?)

### db.aggregate(table, fields, query?)

## 数据库方法

### db.getUser(platform, id, modifier?)

- **platform:** `string` 平台名
- **id:** `string | string[]` 用户标识符
- **modifier:** `QueryModifier<User.Field>` 请求修饰符
- 返回值: `Promise<User | User[]>` 用户数据

向数据库请求用户数据。如果传入的 id 是一个列表，则返回值也应当是一个列表。

### db.setUser(platform, id, data)

- **platform:** `string` 平台名
- **id:** `string` 用户标识符
- **data:** `User` 要修改 / 添加的数据
- 返回值: `Promise<void>`

向数据库修改或添加用户数据。

### db.getChannel(platform, id, fields?)

- **platform:** `string` 平台名
- **id:** `string | string[]` 频道标识符
- **fields:** `QueryModifier<User.Field>` 请求修饰符
- 返回值: `Promise<Channel | Channel[]>` 频道数据

向数据库请求频道数据。如果传入的 id 是一个列表，则返回值也应当是一个列表。

### db.getAssignedChannels(fields?, platform?, assignees?) <Badge type="danger" text="deprecated"/>

- **fields:** `ChannelField[]` 请求的字段，默认为全部字段
- **platform:** `string` 平台名，默认为全平台
- **assignees:** `string[]` 代理者列表，默认为当前运行的全部机器人
- 返回值: `Promise<Channel[]>` 频道数据列表

向数据库请求被特定机器人管理的所有频道数据。这里的两个参数可以写任意一个，都可以识别。

### db.setChannel(platform, id, data)

- **platform:** `string` 平台名
- **id:** `number` 频道标识符
- **data:** `Channel` 要修改 / 添加的数据
- 返回值: `Promise<void>`

向数据库修改或添加频道数据。
