---
sidebarDepth: 2
---

# 编写数据库插件

现在让我们介绍一下如何编写一个数据库支持。与上面介绍的方法类似，我们也采用注入的方式，不过这次我们需要先实现一个类。我们用 mysql 来举个例子：

由于数据库支持往往要被其他插件或用户所使用，有一个好的类型标注是非常重要的。因此这里我们就只提供 TypeScript 的范例了。

```js
import { createPool, Pool, PoolConfig } from 'mysql'
import { Database } from 'koishi'

// 类型注入
declare module 'koishi' {
  namespace Database {
    interface Library {
      // 别忘了加 typeof，不然就不对了~
      mysql: typeof MysqlDatabase
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

当然，真正的 [@koishijs/plugin-mysql](../api/database/mysql.md) 要比上面的例子复杂的多，我们还需要处理有关数据库的更多细节。你可以在 [这里](https://github.com/koishijs/koishi/tree/master/packages/plugin-mysql) 看到完整的源代码。
