import { Context, Schema } from 'koishi'
import MemoryDriver from '@minatojs/driver-memory'

export const name = 'MemoryDatabase'

export type Config = MemoryDriver.Config

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context, config: Config) {
  const driver = new MemoryDriver(ctx.model, config)
  ctx.on('ready', () => driver.start())
  ctx.on('dispose', () => driver.stop())
}
