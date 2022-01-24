import { Card, Context } from '~/client'
import {} from '@koishijs/plugin-status/src'
import LoadChart from './components/load-chart.vue'
import Home from './index.vue'
import CommandChart from './charts/command'
import GuildChart from './charts/guild'
import HistoryChart from './charts/history'
import HourChart from './charts/hour'

export default (ctx: Context) => {
  ctx.install(HistoryChart)
  ctx.install(HourChart)
  ctx.install(GuildChart)
  ctx.install(CommandChart)

  ctx.addPage({
    path: '/',
    name: '仪表盘',
    icon: 'tachometer-alt',
    order: 1000,
    component: Home,
  })

  ctx.addView({
    type: 'numeric',
    component: Card.numeric({
      title: '近期消息频率',
      icon: 'history',
      fields: ['stats'],
      content({ stats }) {
        return Object.values(stats.botSend).reduce((sum, value) => sum + value, 0).toFixed(1) + ' / d'
      },
    }),
  })

  ctx.addView({
    id: 'database',
    type: 'numeric',
    component: Card.numeric({
      title: '数据库体积',
      icon: 'database',
      type: 'size',
      fields: ['meta'],
      content: ({ meta }) => meta.databaseSize,
    }),
  })

  ctx.addView({
    id: 'assets',
    type: 'numeric',
    component: Card.numeric({
      title: '资源服务器',
      icon: 'hdd',
      type: 'size',
      fields: ['meta'],
      content: ({ meta }) => meta.assetSize,
    }),
  })

  ctx.addView({
    type: 'numeric',
    component: Card.numeric({
      title: '活跃用户数量',
      icon: 'heart',
      fields: ['meta'],
      content: ({ meta }) => meta.activeUsers,
    }),
  })

  ctx.addView({
    type: 'numeric',
    component: Card.numeric({
      title: '活跃群数量',
      icon: 'users',
      fields: ['meta'],
      content: ({ meta }) => meta.activeGuilds,
    }),
  })

  ctx.addView({
    type: 'home',
    component: LoadChart,
  })
}
