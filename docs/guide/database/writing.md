---
sidebarDepth: 2
---

# 扩展数据库

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
