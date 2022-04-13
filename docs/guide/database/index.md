---
sidebarDepth: 2
---

# 使用数据库

::: tip
本章所介绍的内容需要你安装一个数据库支持。如果你暂时不打算使用数据库，那么可以略过。
:::

对于几乎所有大型机器人项目，数据库的使用都是不可或缺的。但如果每个插件都使用了自己的数据库，这将导致插件之间的兼容性非常差——用户要么选择同时安装多个数据库，要么只能放弃一些功能或者重复造轮子。为此，Koishi 设计了一整套对象关系映射 (ORM) 接口，它易于扩展并广泛地运用于各种插件中。同时，我们也提供了一些常用数据库的官方插件，足以应对绝大部分使用场景。

## 安装数据库

如果你是插件开发者，你并不需要关心具体的数据库实现。但是如果你是 Koishi 的使用者，只有当安装了数据库你才能正常使用所有的特性。首先你需要安装数据库依赖：

::: code-group manager
```npm
# 我们以 mysql 数据库为例
npm i @koishijs/plugin-database-mysql -D
```
```yarn
# 我们以 mysql 数据库为例
yarn add @koishijs/plugin-database-mysql -D
```
:::

然后与你添加插件同样的方法配置你的数据库：

```yaml title=koishi.yml
plugins:
  database-mysql:
    host: host
    port: 3306
    user: root
    password: password
    database: database
```

运行程序后，你就可以通过访问 `ctx.database` 来调用数据库接口了：

```ts
// @errors: 2304
// 获取用户数据
const user = await ctx.database.getUser(platform, id)

// 修改频道数据
await ctx.database.setChannel(platform, id, { assignee: '123456789' })
```

你可以在后面的 API 文档中看到全部内置的 [数据库方法](../../api/core/database.md)。

## 获取数据

使用 `database.get()` 方法以获取特定表中的数据。下面是一个最基本的形式：

```ts
// 获取 schedule 表中 id 为 1234 的数据行，返回一个数组
await ctx.database.get('schedule', 1234)

// 获取 schedule 表中 id 为 1234 或 5678 的数据行，返回一个数组
await ctx.database.get('schedule', [1234, 5678])
```

对于复杂的数据表，如果你只需要获取少数字段，你可以通过第三个参数手动指定要获取的字段：

```ts
// 返回的数组中每个元素只会包含 command, lastCall 属性
await ctx.database.get('schedule', [1234], ['command', 'lastCall'])
```

你还可以向第二个参数传入一个对象，用来查询非主键上的数据或者同时指定多列的值：

```ts
// 获取名为 schedule 的表中 assignee 为 onebot:123456 的数据行
await ctx.database.get('schedule', {
  assignee: ['onebot:123456'],
})
```

对于需要进行复杂的数据库搜索的，ORM 也提供了相对应的方法：

```ts
// 获取名为 schedule 的表中 id 大于 2 但是小于等于 5 的数据行
await ctx.database.get('schedule', {
  id: { $gt: 2, $lte: 5 },
})
```

我们甚至也支持逻辑运算：

```ts
// 上述两个搜索条件的或运算
await ctx.database.get('schedule', {
  $or: [
    { assignee: ['onebot:123456'] },
    { id: { $gt: 2, $lte: 5 } },
  ],
})
```

你可以在 [这里](../../api/database/query.md) 看到完整的查询表达式 API。

## 添加和删除数据

添加和删除数据的语法也非常简单：

```ts
// @errors: 2304
// 从 schedule 表中删除特定 id 的数据行
// 第二个参数也可以使用上面介绍的查询表达式
await ctx.database.remove('schedule', [id])

// 向 schedule 表中添加一行数据，data 是要添加的数据行
// 返回值是添加的行的完整数据（包括自动生成的 id 和默认属性等）
await ctx.database.create('schedule', row)
```

## 修改数据

Koishi 提供了两种修改数据的方法。我们将逐一介绍。

| | set | upsert |
| ---- | ---- | ---- |
| 作用范围 | 支持复杂的查询表达式 | 只能限定特定字段的值 |
| 插入行为 | 如果不存在则不会进行任何操作 | 如果不存在则会插入新行 |

### 使用 set 修改数据

`database.set()` 方法需要传入三个参数：表名、查询条件和要修改的数据。

```ts
// 第二个参数也可以使用上面介绍的查询表达式
await ctx.database.set('schedule', 1234, {
  assignee: 'onebot:123456',
  lastCall: new Date(),
})
```

如果要修改的数据与已有数据相关，可以使用求值表达式：

```ts
// 让所有日期为今天的数据行的 count 字段在原有基础上增加 1
await ctx.database.set('foo', { date: new Date() }, {
  // { $add: [a, b] } 相当于 a + b
  // { $: field } 相当于对当前行的 field 字段取值
  count: { $add: [{ $: 'count' }, 1] },
})
```

你可以在 [这里](../../api/database/evaluation.md) 看到完整的求值表达式 API。

### 使用 upsert 修改数据

`database.upsert()` 的逻辑稍微有些不同，需要你传入一个数组：

```ts
// 用一个数组来对数据进行更新，你需要确保每一个元素都拥有这个数据表的主键
// 修改时只会用每一行中出现的键进行覆盖，不会影响未定义的字段
await ctx.database.upsert('foo', [
  { id: 1, foo: 'hello' },
  { id: 2, foo: 'world' },
  // 这里同样支持求值表达式，$concat 可用于连接字符串
  { id: 3, bar: { $concat: ['koi', 'shi'] } },
])
```

如果初始的数据库是这样的：

| id | foo | bar |
| ---- | ---- | ---- |
| (默认值) | null | bar |
| 1 | foo | baz |

那么进行上述操作后的数据库将是这样的：

| id | foo | bar | 说明 |
| ---- | ---- | ---- | ---- |
| 1 | hello | baz | 该行已经存在，只更新了 foo 字段 |
| 2 | world | bar | 插入了新行，其中 foo 字段取自传入的数据，bar 字段取自默认值 |
| 3 | null | koishi | 插入了新行，其中 bar 字段取自传入的数据，foo 字段取自默认值 |

如果想以非主键来索引要修改的数据，可以使用第三个参数：

```ts
// @errors: 2304
// 以非主键为基准对数据表进行更新，你需要确保每一个元素都拥有 onebot 属性
await ctx.database.upsert('user', rows, 'onebot')

// 以复合键为基准对数据表进行更新，你需要确保每一个元素都拥有 platform 和 id 属性
await ctx.database.upsert('channel', rows, ['platform', 'id'])
```
