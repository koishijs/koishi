import type { GroupData } from '@koishijs/plugin-status/src'
import { Card, Context } from '~/client'
import { Tooltip } from './utils'

export default (ctx: Context) => {
  ctx.registerView({
    type: 'chart',
    component: Card.echarts({
      title: '各群发言数量',
      fields: ['stats'],
      options({ stats }) {
        if (!stats.groups.length) return

        return {
          tooltip: Tooltip.item<GroupData>(({ data }) => {
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
            data: stats.groups.sort((a, b) => b.value - a.value),
            radius: ['35%', '65%'],
            minShowLabelAngle: 3,
          }],
        }
      },
    }),
  })
}
