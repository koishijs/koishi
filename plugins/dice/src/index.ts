import { Context } from 'koishi'
import roll, { RollConfig } from './roll'

declare module 'koishi' {
  interface Module {
    dice: typeof import('.')
  }
}

export interface Config extends RollConfig {}

export const name = 'dice'

export function apply(ctx: Context, config: Config = {}) {
  ctx.plugin(roll, config)
}
