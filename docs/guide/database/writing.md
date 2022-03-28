---
sidebarDepth: 2
---

# 编写数据库插件

现在让我们介绍一下如何编写一个数据库支持。与上面介绍的方法类似，我们也采用注入的方式，不过这次我们需要先实现一个类。我们用 mysql 来举个例子：

由于数据库支持往往要被其他插件或用户所使用，有一个好的类型标注是非常重要的。因此这里我们就只提供 TypeScript 的范例了。

## 代码示例

```ts no-extra-header
// @errors: 2416

import { createPool, Pool, PoolConfig } from 'mysql'
import { Context, Database } from 'koishi'

// 从 Database 类派生出一个子类并将其默认导出
export default class MysqlDatabase extends Database {
  private pool: Pool

  constructor(ctx: Context, config: PoolConfig = {}) {
    super(ctx)
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

  // 实现内置方法
  get() {}
  set() {}
  upsert() {}
  remove() {}
  create() {}
  drop() {}
  eval() {}
  stats() {}
}
```

当然，真正的 [@koishijs/plugin-database-mysql](../../plugins/database/mysql.md) 要比上面的例子复杂的多，我们还需要处理有关数据库的更多细节。你可以在 [这里](https://github.com/koishijs/koishi/tree/master/plugins/database/mysql) 看到完整的源代码。

## 调用原始接口

::: danger
虽然 Koishi 提供了这种方案，但必须说明的是我们不推荐这种行为。这样做会使你的代码的耦合度增加，并且难以被其他人使用。
:::

如果用户需要调用原始的数据库接口而不是使用 ORM，他可以利用 Database 对象的特殊属性，它只在使用了特定的数据库插件的时候有效：

```ts
// TypeScript 用户需要手动引入模块，否则将产生类型错误
import {} from '@koishijs/plugin-database-mysql'

// 直接发送 SQL 语句
ctx.database.mysql.query('select * from user')
```

对于其他数据库实现类似，例如 mongo 的原始接口可以通过 `ctx.database.mongo` 访问到。为了实现这一点，数据库插件的开发者需要在上面的示例代码中添加下面几行：

```ts
import { Database } from 'koishi'

// 步骤 1: 注入属性
declare module 'koishi' {
  interface Database {
    mysql: MysqlDatabase
  }
}

// 步骤 2: 实现此属性
export default class MysqlDatabase extends Database {
  public mysql = this
}
```
