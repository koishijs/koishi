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

你可以在后面的 API 文档中看到全部内置的 [数据库方法](../api/database.md)。不过在这里我先介绍一下 Koishi 的数据库接口的几种设计，方便理解。

### 常见的接口设计

下面的代码展示了一个 Koishi 数据库最常见的接口设计，它广泛地运用于各种插件中：

```js
// 向数据库中获取一行，可以采用 getXXX(id, fields) 的形式
// 其中 id 是该行的标识符，fields 是需要的字段
// 对于有些数据库这个参数是自动忽略的，无论填写什么都会返回一切字段
// 如果该行存在则返回该行的对应字段，否则返回 null
ctx.database.getSchedule(id, fields)

// 向数据库中添加一行，可以采用 createXXX(data) 的形式
// 其中 data 是一个键值对；返回值是添加的行的完整数据（包括自动生成的 id 和默认属性等）
ctx.database.createSchedule(data)

// 修改数据库中的一行，可以采用 setXXX(id, data) 的形式
// 其中 id 是该行的标识符，data 是要更改的数据
// 修改时只会用 data 中的键进行覆盖，不会影响未记录在 data 中的资源
ctx.database.setSchedule(id, data)
```

### 获取数据的高级方法

对于 Koishi 内部的两个抽象表 User 和 Channel，情况略有不同。我们在此基础上设计了几个高级方法，你可以在 [会话对象](../api/session.md) 中找到它们。

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

## 使用 ORM

## 扩展数据库

由于 Koishi 的数据库实现使用了注入策略，因此无论是字段，表，方法还是数据库都是可以扩展的。

### 扩展用户和频道字段

向内置的 User 和 Channel 两张表中注入字段的方式如下：

```js
const { User } = require('koishi-core')

// 向用户数据库中注入字段 foo，默认值为 'bar'
User.extend(() => ({ foo: 'bar' }))
```

如果你是 TypeScript 用户，你可能还需要进行定义合并：

```js
import { User } from 'koishi-core'

declare module 'koishi-core' {
  interface User {
    foo: string
  }
}

User.extend(() => ({ foo: 'bar' }))
```

### 扩展方法和表实现

要添加新的数据库方法，只需调用 `Database.extend()`：

```js
const { Database } = require('koishi-core')

// 第一个参数声明这个方法依赖于 mysql 数据库
// 第二个参数表明这次调用注入的是 user 表
Database.extend('koishi-plugin-mysql', {
  // 要扩展的方法实现
  createSchedule(...args) {
    // 此时这里的 this 实际上是一个 MysqlDatabase 对象
    return this.query(sql)
  },
})

ctx.database.myMethod(...args)
```

请放心，这么做并不需要你引入 koishi-plugin-mysql 作为插件的依赖。

如果你是 TypeScript 用户，你可能还需要进行定义合并：

```js
// 你应该将 koishi-plugin-mysql 作为插件的 devDependency
// 这个空的导入在编译中会自然消失，但会提供必要的类型注入
import {} from 'koishi-plugin-mysql'
import { Database } from 'koishi-core'

// 导出这张表的接口可以方便别人向这张表注入新的字段
export interface Schedule {
  foo: string
}

declare module 'koishi-core' {
  interface Database {
    createSchedule(...args): Promise<Schedule>
  }
}

Database.extend('koishi-database-mysql', {
  createSchedule(...args) {
    // 这里已经可以进行类型推断了
    return this.query(sql)
  },
})
```

### 编写数据库支持

最后，让我们介绍一下如何编写一个数据库支持。与上面介绍的方法类似，我们也采用注入的方式，不过这次我们需要先实现一个类。我们用 mysql 来举个例子：

对于 TypeScript 的使用者，你可以像这样进行类型合并：

```js
import { createPool, Pool, PoolConfig } from 'mysql'
import { Database } from 'koishi-core'

// 类型注入
declare module 'koishi-core' {
  namespace Database {
    interface Statics {
      // 别忘了加 typeof
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
