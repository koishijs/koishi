import { Context } from 'koishi-core'
import plugin, { StatusOptions } from './status'

export * from './status'

export const name = 'status'

export async function apply (ctx: Context, config: StatusOptions = {}) {
  ctx.plugin(plugin, config)
}
