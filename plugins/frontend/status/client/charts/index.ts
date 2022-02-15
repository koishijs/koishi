import { Context } from '@koishijs/client'
import CommandChart from './command'
import GuildChart from './guild'
import HistoryChart from './history'
import HourChart from './hour'

export default (ctx: Context) => {
  ctx.install(HistoryChart)
  ctx.install(HourChart)
  ctx.install(GuildChart)
  ctx.install(CommandChart)
}
