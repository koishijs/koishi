import { Context } from '@koishijs/client'
import { createChart, Tooltip } from './utils'

const formatHour = (value: number) => `${(value - 0.5).toFixed()}:00-${(value + 0.5).toFixed()}:00`

export default (ctx: Context) => {
  ctx.addView({
    type: 'chart',
    component: createChart({
      title: '每小时发言数量',
      fields: ['stats'],
      options({ stats }) {
        return {
          tooltip: Tooltip.axis<number[]>((params) => {
            const [{ data: [x], dataIndex }] = params
            const source = stats.hours[dataIndex]
            const output = [
              `${formatHour(x)}`,
              `消息总量：${+(source.total || 0).toFixed(1)}`,
            ]
            params.reverse().forEach(({ seriesName, marker }, index) => {
              const value = index === 0 ? source.command
                : index === 1 ? source.dialogue
                  : Math.max(0, source.total - source.command - source.dialogue)
              if (!value) return
              output.push(`${marker}${seriesName}：${+value.toFixed(1)}`)
            })
            return output.join('<br>')
          }),
          xAxis: {
            type: 'value',
            min: 0,
            max: 24,
            minInterval: 1,
            maxInterval: 4,
            axisLabel: {
              formatter: value => value + ':00',
            },
            axisPointer: {
              label: {
                formatter: ({ value }) => formatHour(value as number),
              },
            },
          },
          yAxis: {
            type: 'value',
          },
          series: [{
            name: '其他',
            data: stats.hours.map((val, index) => [index + 0.5, val.total || 0]),
            type: 'bar',
            stack: '1',
            itemStyle: {
              color: 'rgb(255,219,92)',
            },
          }, {
            name: '教学',
            data: stats.hours.map((val, index) => [index + 0.5, (val.command || 0) + (val.dialogue || 0)]),
            type: 'bar',
            stack: '1',
            itemStyle: {
              color: 'rgb(103,224,227)',
            },
          }, {
            name: '指令',
            data: stats.hours.map((val, index) => [index + 0.5, val.command || 0]),
            type: 'bar',
            stack: '1',
            itemStyle: {
              color: 'rgb(55,162,218)',
            },
          }],
        }
      },
    }),
  })
}
