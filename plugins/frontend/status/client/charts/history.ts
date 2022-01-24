import { Card, Context } from '~/client'
import { Tooltip } from './utils'

const week = '日一二三四五六'

export default (ctx: Context) => {
  ctx.registerView({
    type: 'chart',
    component: Card.echarts({
      title: '历史发言数量',
      fields: ['stats'],
      options({ stats }) {
        if (!Object.keys(stats.history).length) return

        return {
          tooltip: Tooltip.axis(([{ name, value }]) => {
            const day = new Date(name).getDay()
            return `${name} 星期${week[day]}<br>发言数量：${value}`
          }),
          xAxis: {
            type: 'category',
            data: Object.keys(stats.history).reverse(),
          },
          yAxis: {
            type: 'value',
            axisLabel: {
              formatter: value => value / 1000 + 'k',
            },
          },
          series: {
            type: 'line',
            smooth: true,
            data: Object.values(stats.history).reverse(),
          },
        }
      },
    }),
  })
}
