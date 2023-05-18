import { defineDriver, Schema } from 'koishi'
import { SQLiteDriver } from '@minatojs/driver-sqlite'
import path from 'path'

export default defineDriver(SQLiteDriver, Schema.object({
  path: Schema.string().default('.koishi.db'),
}).i18n({
  'zh-CN': require('./locales/zh-CN'),
}), (ctx, config) => {
  if (config.path !== ':memory:') {
    config.path = path.resolve(ctx.baseDir, config.path)
  }
})
