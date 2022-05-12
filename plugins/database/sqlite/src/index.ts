import { Context, DatabaseService, Schema } from 'koishi'
import { resolve } from 'path'
import SQLiteDriver from '@cosmotype/driver-sqlite'

export const name = 'SQLiteDatabase'

export type Config = SQLiteDriver.Config

export const Config: Schema<Config> = Schema.object({
  path: Schema.string().description('数据库路径').default('.koishi.db'),
})

export function apply(ctx: Context, config: Config) {
  if (config.path !== ':memory:') {
    config.path = resolve(ctx.app.baseDir, config.path)
  }
  ctx.plugin(DatabaseService.plugin(SQLiteDriver, Config), config)
}
