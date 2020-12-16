import { Context } from 'koishi-core'
import Achievement from './achievement'
import Affinity from './affinity'
import Rank from './rank'
import './utils'

export { Achievement, Affinity, Rank }

export const name = 'adventure'

export function apply(ctx: Context) {
  ctx.command('adventure', '冒险系统')

  ctx.plugin(Achievement)
  ctx.plugin(Affinity)
  ctx.plugin(Rank)
}
