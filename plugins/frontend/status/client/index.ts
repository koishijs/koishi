import { Card, registerView } from '~/client'
import {} from '@koishijs/plugin-status/src'
import LoadChart from './components/load-chart.vue'

import './charts'

registerView({
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

registerView({
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

registerView({
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

registerView({
  type: 'numeric',
  component: Card.numeric({
    title: '活跃用户数量',
    icon: 'heart',
    fields: ['meta'],
    content: ({ meta }) => meta.activeUsers,
  }),
})

registerView({
  type: 'numeric',
  component: Card.numeric({
    title: '活跃群数量',
    icon: 'users',
    fields: ['meta'],
    content: ({ meta }) => meta.activeGuilds,
  }),
})

registerView({
  type: 'home',
  component: LoadChart,
})
