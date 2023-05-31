import { defineDriver, Logger, Schema } from 'koishi'
import { SQLiteDriver } from '@minatojs/driver-sqlite'
import fs from 'fs'
import path from 'path'

const logger = new Logger('sqlite')

export default defineDriver(SQLiteDriver, Schema.object({
  path: Schema.path().default('data/koishi.db'),
}).i18n({
  'zh-CN': require('./locales/zh-CN'),
}), (ctx, config) => {
  if (config.path === ':memory:') return
  config.path = path.resolve(ctx.baseDir, config.path)
  const oldPath = path.resolve(ctx.baseDir, '.koishi.db')
  if (fs.existsSync(oldPath)) {
    logger.info('migrating to data directory')
    fs.renameSync(oldPath, config.path)
  }
})
