import { Context, Schema } from 'koishi'
import LevelDriver from '@minatojs/driver-level'

export const name = 'LevelDatabase'

export type Config = LevelDriver.Config

export const Config: Schema<Config> = Schema.object({
  location: Schema.string().description('数据保存的位置').default('.level'),
})

export function apply(ctx: Context, config: Config) {
  const driver = new LevelDriver(ctx.model, config)
  ctx.on('ready', () => driver.start())
  ctx.on('dispose', () => driver.stop())
}
