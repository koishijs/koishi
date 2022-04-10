---
sidebarDepth: 2
---

# 数据库操作 (Database)

一个 Database 对象代理了 Koishi 上下文绑定的应用实例有关的所有数据库访问。同时它具有注入特性，任何插件都可以自己定义数据库上的方法。本章主要介绍数据库的官方接口。注意：**它们并不由 Koishi 自身实现，而是由每个数据库分别实现的**。Koishi 只是提供了一套标准。

## database.drop()

## database.stats()

## database.get(table, query, modifier?)

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

下面是一些简单的示例：

```ts
// @errors: 2451

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
  $or: [{ id: { $gt: 100 } }],
})

// 只获取 id 和 command 字段（默认情况下将获取全部字段）
const rows = await ctx.database.get('schedule', 1, ['id', 'command'])
```

## database.set(table, query, updater)

## database.remove(table, query)

## database.create(table, data)

## database.upsert(table, data, keys?)

## database.eval(table, expr, query?)
