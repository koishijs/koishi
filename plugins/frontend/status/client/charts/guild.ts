import type { GuildData } from '@koishijs/plugin-status/src'
import { Context } from '@koishijs/client'
import { createChart, Tooltip } from './utils'

export default (ctx: Context) => {
  ctx.addView({
    type: 'chart',
    component: createChart({
      title: '各群发言数量',
      fields: ['stats'],
      options({ stats }) {
        if (!stats.guilds.length) return

        return {
          tooltip: Tooltip.item<GuildData>(({ data }) => {
            const output = [data.name]
            output.push(`平台：${data.platform}`)
            if (data.memberCount) output.push(`人数：${data.memberCount}`)
            if (data.assignee) output.push(`接入：${data.assignee}`)
            output.push(`日均发言：${+data.value.toFixed(1)}`)
            output.push(`昨日发言：${+data.last.toFixed(1)}`)
            return output.join('<br>')
          }),
          series: [{
            type: 'pie',
            data: stats.guilds.sort((a, b) => b.value - a.value),
            radius: ['35%', '65%'],
            minShowLabelAngle: 3,
          }],
        }
      },
    }),
  })
}
