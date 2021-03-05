import { Context } from 'koishi-core'
import roll, { RollConfig } from './roll'

export interface Config extends RollConfig {}

export const name = 'dice'

export function apply(ctx: Context, config: Config = {}) {
  ctx.plugin(roll, config)
}
