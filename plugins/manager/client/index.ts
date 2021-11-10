import { store, addPage, addHomeMeta } from '@koishijs/ui-console'
import type {} from '@koishijs/plugin-manager/src'
import Bots from './bots/index.vue'
import Settings from './settings/index.vue'
import Market from './market/index.vue'

addHomeMeta({
  order: -100,
  title: '当前消息频率',
  icon: 'paper-plane',
  content: () => store.value.bots.reduce((sum, bot) => sum + bot.messageSent, 0) + ' / min',
})

// home.meta.require.push('bots')

addPage({
  path: '/bots',
  name: '机器人',
  icon: 'robot',
  order: 100,
  require: ['bots', 'protocols', 'registry'],
  component: Bots,
})

addPage({
  path: '/settings',
  name: '插件配置',
  icon: 'tools',
  order: 110,
  require: ['registry', 'market', 'services'],
  component: Settings,
})

addPage({
  path: '/market',
  name: '插件市场',
  icon: 'puzzle-piece',
  order: 120,
  require: ['market'],
  component: Market,
})
