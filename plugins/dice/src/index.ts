import { Context, Schema } from 'koishi'
import roll, { RollConfig } from './roll'

declare module 'koishi' {
  interface Modules {
    dice: typeof import('.')
  }
}

export const name = 'dice'

export interface Config extends RollConfig {}

export const Config = Schema.object({
  maxPoint: Schema.number('掷骰的最大点数。').default(1 << 16),
  maxTimes: Schema.number('单次调用中最大掷骰次数。').default(64),
})

export function apply(ctx: Context, config: Config = {}) {
  ctx.plugin(roll, config)
}
