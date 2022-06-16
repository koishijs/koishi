import { defineDriver, Schema } from 'koishi'
import { resolve } from 'path'
import SQLiteDriver from '@minatojs/driver-sqlite'

export default defineDriver(SQLiteDriver, Schema.object({
  path: Schema.string().description('数据库路径').default('.koishi.db'),
}), (ctx, config) => {
  if (config.path !== ':memory:') {
    config.path = resolve(ctx.app.baseDir, config.path)
  }
})
