---
sidebarDepth: 2
---

# 使用数据库

::: tip
本节所介绍的内容需要你安装一个数据库支持。如果你暂时不打算使用数据库，那么可以略过。
:::

在之前的章节中，我们已经看到 Koishi 内部实现了一套权限管理系统，这需要对数据库的支持。但是另一方面，为了保证纯粹性，Koishi 的核心库 koishi-core 并不希望写入对某个具体的数据库的支持。因此，Koishi 的数据库采取了注入的方法。因此插件开发者大可不必同时担心 Koishi 使用了自己不了解的数据库框架——因为任何数据库在 Koishi 的调用中都提供了相同的接口。

## 调用数据库

### 安装数据库

正如上面所说的，如果你是插件开发者，你可能不需要关心具体的数据库实现（除非你本身需要新的表来存储数据）。但是如果你是 Koishi 的使用者，只有当安装了数据库你才能正常使用所有的特性。首先你需要安装数据库依赖：

::: code-group manager
```npm
# 我们以 mysql 数据库为例
npm i koishi-plugin-mysql -D
```
```yarn
# 我们以 mysql 数据库为例
yarn add koishi-plugin-mysql -D
```
:::

然后与你添加插件同样的方法配置你的数据库：

```js koishi.config.js
module.exports = {
  plugins: {
    mysql: {
      host: '[host]',
      port: 3306,
      user: 'root',
      password: '[password]',
      database: '[database]',
    },
  },
}
```

运行程序后，你就可以通过访问 `ctx.database` 来调用数据库接口了：

```js
// 获取用户数据
const user = await ctx.database.getUser(type, id)

// 修改群数据
await ctx.database.setChannel(type, id, { assignee: 123456789 })
```

你可以在后面的 API 文档中看到全部内置的 [数据库方法](../api/database.md)。

### 使用会话 API

对于 Koishi 内部的两个抽象表 User 和 Channel，我们在 [会话对象](../api/session.md) 中封装了几个高级方法：

```js
// 中间增加了一个第二参数，表示默认情况下的权限等级
// 如果找到该用户，则返回该用户本身
// 否则创建一个新的用户数据，权限为 authority
// 如果 authority 大于 0，则将新的用户数据添加到表中
session.getUser(id, authority, fields)

// 在当前会话上绑定一个可观测用户实例
// 也就是所谓的 session.user
session.observeUser(fields)

// 中间增加了一个第二参数，表示默认情况下的 assignee
// 如果找到该频道，则不修改任何数据，返回该频道本身
// 如果未找到该频道，则创建一个新的频道，代理者为 selfId
// 如果 selfId 大于 0，则将新的频道数据添加到表中
session.getChannel(id, selfId, fields)

// 在当前会话上绑定一个可观测频道实例
// 也就是所谓的 session.channel
session.observeChannel(fields)
```

### 扩展用户和频道字段

向内置的 User 表中注入字段的方式如下：

::: code-group language
```js
const { User } = require('koishi-core')

// 向用户数据库中注入字段 foo，默认值为 'bar'
User.extend(() => ({ foo: 'bar' }))
```
```ts
import { User } from 'koishi-core'

// TypeScript 用户需要进行类型合并
declare module 'koishi-core' {
  interface User {
    foo: string
  }
}

// 向用户数据库中注入字段 foo，默认值为 'bar'
User.extend(() => ({ foo: 'bar' }))
```
:::

如果你是插件开发者，你还需要手动处理 MySQL 字段的定义：

::: code-group language
```js
const { Database } = require('koishi-core')

Database.extend('koishi-plugin-mysql', ({ tables }) => {
  tables.user.foo = 'varchar(100)' // MySQL 类型
})
```
```ts
import { Database } from 'koishi-core'

// 引入 koishi-plugin-mysql 的类型定义
// 如果你是插件开发者，你应该将 koishi-plugin-mysql 作为你的 devDep
// 这行代码不会真正 require 这个依赖，因此即使用户使用的不是 MySQL 也没有关系
import {} from 'koishi-plugin-mysql'

Database.extend('koishi-plugin-mysql', ({ tables }) => {
  tables.user.foo = 'varchar(100)' // MySQL 类型
})
```
:::

向 Channel 注入字段同理。

::: tip
#### 为什么 MySQL 需要编写两份代码

看起来这是不必要的重复，但其实不然。`User.extend()` 定义的是用户表中各列的**默认值**，而 `Database.extend()` 定义的是数据库的**字段类型**，会被用于自动建表和补全字段。换句话说，如果你已经手动建好表了，那么你确实不需要编写后面的额外代码。但是反过来，如果你是插件开发者，你的用户很可能不知道这个插件需要哪些用户字段，因此这样的写法可以在用户安装插件的时候就自动创建字段。
:::

## 使用 ORM API

Koishi 设计了一套对象关系映射（ORM）接口，它易于扩展并广泛地运用于各种插件中。

### 获取和删除数据

使用 `database.get()` 方法以获取特定表中的数据。下面是一个最基本的形式：

```js
// 获取 schedule 表中 id 为 1234 或 5678 的数据行，返回一个数组
const rows = await ctx.database.get('schedule', [1234, 5678])
```

对于复杂的数据表，如果你只需要获取少数字段，你可以通过第三个参数手动指定要获取的字段：

```js
// 返回的数组中每个元素只会包含 command, lastCall 属性
const rows = await ctx.database.get('schedule', [1234], ['command', 'lastCall'])
```

你还可以向第二个参数传入一个对象，用来查询非主键上的数据或者同时指定多列的值：

```js
// 获取名为 schedule 的表中 assignee 为 onebot:123456 的数据行
const rows = await ctx.database.get('schedule', { assignee: ['onebot:123456'] })
```

对于需要进行复杂的数据库搜索的，ORM 也提供了相对应的方法：

```js
// 获取名为 schedule 的表中 id 大于 2 但是小于等于 5 的数据行
const rows = await ctx.database.get('schedule', { id: { $gt: 2, $lte: 5 } })
```

> 你可以在 [这里](../api/database.md#db-get-table) 看到更多相关的 API。

删除数据的语法与获取数据类似：

```js
// 从 schedule 表中删除特定 id 的数据行
// 第二个参数也可以使用上面介绍的对象语法
await ctx.database.remove('schedule', [id])
```

### 添加和修改数据

除了获取和删除数据，常用的需求还有添加和修改数据。

```js
// 向 schedule 表中添加一行数据，data 是要添加的数据行
// 返回值是添加的行的完整数据（包括自动生成的 id 和默认属性等）
await ctx.database.create('schedule', row)
```

修改数据的逻辑稍微有些不同，需要你传入一个数组：

```js
// 用 rows 来对数据进行更新，你需要确保每一个元素都拥有 id 属性
// 修改时只会用 rows 中出现的键进行覆盖，不会影响未记录在 data 中的字段
await ctx.database.update('schedule', rows)
```

如果想以非主键来索引要修改的数据，可以使用第三个参数：

```js
// 用 rows 来对数据进行更新，你需要确保每一个元素都拥有 onebot 属性
await ctx.database.update('user', rows, 'onebot')
```

### 定义数据表

以上面的 schedule 数据表为例，让我们看看如何定义新的数据表：

::: code-group language
```js
const { Tables } = require('koishi-core')

Tables.extend('schedule')
```
```ts
import { Tables } from 'koishi-core'

declare module 'koishi-core' {
  interface Tables {
    schedule: Schedule
  }
}

export interface Schedule {
  id: number
  assignee: string
  lastCall: Date
  command: string
}

Tables.extend('schedule')
```
:::

这个方法还可以传入第二个参数，用于配置数据表：

```js
Tables.extend('schedule', {
  // 主键名称，将用于 database.get() 等方法
  primary: 'id',
  // 所有数据值唯一的字段名称构成的列表
  unique: [],
  // 主键产生的方式，incremental 表示自增
  type: 'incremental',
})
```

与上面一致，如果你是插件开发者，你还需要手动处理 MySQL 字段的定义：

::: code-group language
```js
const { Database } = require('koishi-core')

Database.extend('koishi-plugin-mysql', ({ tables }) => {
  tables.schedule = {
    id: 'int',
    assignee: 'varchar(50)',
    // 其他字段定义
  }
})
```
```ts
import { Database } from 'koishi-core'
import {} from 'koishi-plugin-mysql'

Database.extend('koishi-plugin-mysql', ({ tables }) => {
  tables.schedule = {
    id: 'int',
    assignee: 'varchar(50)',
    // 其他字段定义
  }
})
```
:::

## 扩展数据库

由于 Koishi 的数据库实现使用了注入策略，因此无论是字段，表，方法还是数据库都是可以扩展的。

### 扩展数据库方法

要添加新的数据库方法，只需调用 `Database.extend()`：

::: code-group language
```js
const { Database } = require('koishi-core')

// 第一个参数声明这个方法依赖于 mysql 数据库
// 第二个参数表明这次调用注入的是 user 表
Database.extend('koishi-plugin-mysql', {
  // 要扩展的方法实现
  myMethod(...args) {
    // 此时这里的 this 实际上是一个 MysqlDatabase 对象
    return this.query(sql)
  },
})

ctx.database.myMethod(...args)
```
```ts
// 你应该将 koishi-plugin-mysql 作为插件的 devDependency
// 这个空的导入在编译中会自然消失，但会提供必要的类型注入
import {} from 'koishi-plugin-mysql'
import { Database } from 'koishi-core'

declare module 'koishi-core' {
  interface Database {
    myMethod(...args): Promise<SomeType>
  }
}

// 第一个参数声明这个方法依赖于 mysql 数据库
// 第二个参数表明这次调用注入的是 user 表
Database.extend('koishi-database-mysql', {
  myMethod(...args) {
    // 此时这里的 this 实际上是一个 MysqlDatabase 对象
    return this.query(sql)
  },
})
```
:::

请放心，这么做并不需要你引入 koishi-plugin-mysql 作为插件的依赖。

### 编写数据库支持

最后，让我们介绍一下如何编写一个数据库支持。与上面介绍的方法类似，我们也采用注入的方式，不过这次我们需要先实现一个类。我们用 mysql 来举个例子：

由于数据库支持往往要被其他插件或用户所使用，有一个好的类型标注是非常重要的。因此这里我们就只提供 TypeScript 的范例了。

```js
import { createPool, Pool, PoolConfig } from 'mysql'
import { Database } from 'koishi-core'

// 类型注入
declare module 'koishi-core' {
  namespace Database {
    interface Statics {
      // 别忘了加 typeof，不然就不对了~
      'koishi-plugin-mysql': typeof MysqlDatabase
    }
  }
}

// 防止下面产生类型报错
interface MysqlDatabase extends Database {}

class MysqlDatabase {
  private pool: Pool

  constructor(config: PoolConfig = {}) {
    this.pool = createPool(config)
  }

  query(sql: string, values?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.pool.query(sql, values, (error, results, fields) => {
        if (error) {
          reject(error)
        } else {
          resolve(results)
        }
      })
    })
  }
}

// Database.extend 方法也可以直接传入一个数据库类
Database.extend(MysqlDatabase, {
  // 提供内置方法的实现（参见上一节）
})

export default MysqlDatabase

export const name = 'mysql'

export function apply(ctx: Context, config: PoolConfig = {}) {
  const db = new MysqlDatabase(ctx.app, config)
  ctx.database = db
}
```

当然，真正的 [koishi-plugin-mysql](../api/database/mysql.md) 要比上面的例子复杂的多，我们还需要处理有关数据库的更多细节。你可以在 [这里](https://github.com/koishijs/koishi/tree/master/packages/plugin-mysql) 看到完整的源代码。
