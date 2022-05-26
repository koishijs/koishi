import { Context, Schema } from 'koishi'
import { resolve } from 'path'
import SQLiteDriver from '@minatojs/driver-sqlite'

export const name = 'SQLiteDatabase'

export type Config = SQLiteDriver.Config

export const Config: Schema<Config> = Schema.object({
  path: Schema.string().description('数据库路径').default('.koishi.db'),
})

export function apply(ctx: Context, config: Config) {
  if (config.path !== ':memory:') {
    config.path = resolve(ctx.app.baseDir, config.path)
  }

  const driver = new SQLiteDriver(ctx.model, config)
  ctx.on('ready', () => driver.start())
  ctx.on('dispose', () => driver.stop())
}
