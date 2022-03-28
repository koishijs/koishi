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

## 调用数据库

### 获取数据

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

> 你可以在 [这里](../../api/core/database.md#db-get-table) 看到更多相关的 API。

### 删除数据

删除数据的语法与获取数据类似：

```ts
// @errors: 2304
// 从 schedule 表中删除特定 id 的数据行
// 第二个参数也可以使用上面介绍的对象语法
await ctx.database.remove('schedule', [id])
```

### 添加和修改数据

除了获取和删除数据，常用的需求还有添加和修改数据。

```ts
// @errors: 2304
// 向 schedule 表中添加一行数据，data 是要添加的数据行
// 返回值是添加的行的完整数据（包括自动生成的 id 和默认属性等）
await ctx.database.create('schedule', row)
```

修改数据的逻辑稍微有些不同，需要你传入一个数组：

```ts
// @errors: 2304
// 用 rows 来对数据进行更新，你需要确保每一个元素都拥有 id 属性
// 修改时只会用 rows 中出现的键进行覆盖，不会影响未记录在 data 中的字段
await ctx.database.upsert('schedule', rows)
```

如果想以非主键来索引要修改的数据，可以使用第三个参数：

```ts
// @errors: 2304
// 用 rows 来对数据进行更新，你需要确保每一个元素都拥有 onebot 属性
await ctx.database.upsert('user', rows, 'onebot')
```
