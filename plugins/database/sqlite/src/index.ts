import { defineDriver, Logger, Schema } from 'koishi'
import { SQLiteDriver } from '@minatojs/driver-sqlite'
import { mkdir, rename, stat } from 'fs/promises'
import { dirname, join } from 'path'

const logger = new Logger('sqlite')

export default defineDriver(SQLiteDriver, Schema.object({
  path: Schema.path().default('data/koishi.db'),
}).i18n({
  'zh-CN': require('./locales/zh-CN'),
}), async (ctx, config) => {
  if (config.path === ':memory:') return
  config.path = join(ctx.baseDir, config.path)
  const oldPath = join(ctx.baseDir, '.koishi.db')
  if (await stat(oldPath).catch(() => null)) {
    logger.info('migrating to data directory')
    await mkdir(dirname(config.path), { recursive: true })
    await rename(oldPath, config.path)
  }
})
