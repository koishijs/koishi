import { addPage, store, addHomeMeta, addView } from '@koishijs/ui-console'
import type {} from '@koishijs/plugin-status/src'
import CommandChart from './home/command-chart.vue'
import GroupChart from './home/group-chart.vue'
import HistoryChart from './home/history-chart.vue'
import HourChart from './home/hour-chart.vue'
import LoadChart from './home/load-chart.vue'

addHomeMeta({
  title: '近期消息频率',
  icon: 'history',
  when: () => store.value.stats,
  content() {
    return Object.values(store.value.stats.botSend).reduce((sum, value) => sum + value, 0).toFixed(1) + ' / d'
  },
})

addHomeMeta({
  title: '数据库体积',
  icon: 'database',
  type: 'size',
  when: () => store.value.stats,
  content() {
    // @ts-ignore
    return Object.values(store.value.meta.tables || {}).reduce((prev, curr) => prev + curr.size, 0)
  },
})

addHomeMeta({
  title: '资源服务器',
  icon: 'hdd',
  type: 'size',
  content: () => store.value.meta.assetSize,
})

addHomeMeta({
  title: '活跃用户数量',
  icon: 'heart',
  when: () => store.value.stats,
  content: () => store.value.meta.activeUsers,
})

addHomeMeta({
  title: '活跃群数量',
  icon: 'heart',
  when: () => store.value.stats,
  content: () => store.value.meta.activeGroups,
})

addView('home', LoadChart)
addView('home-charts', HistoryChart)
addView('home-charts', HourChart)
addView('home-charts', GroupChart)
addView('home-charts', CommandChart)

addPage({
  path: '/database',
  name: '数据库',
  icon: 'database',
  order: 200,
  require: ['meta'],
  component: () => import('./database/index.vue'),
})

addPage({
  path: '/logs',
  name: '运行日志',
  icon: 'clipboard-list',
  order: 1000,
  require: ['logs'],
  component: () => import('./logs/index.vue'),
})
