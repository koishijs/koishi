import { store, router, addHomeMeta, home } from '@koishijs/ui-console'
import type {} from '@koishijs/plugin-manager/src'

addHomeMeta({
  order: -100,
  title: '当前消息频率',
  icon: 'paper-plane',
  content: () => store.value.bots.reduce((sum, bot) => sum + bot.messageSent, 0) + ' / min',
})

home.meta.require.push('bots')

router.addRoute({
  path: '/bots',
  name: '机器人',
  meta: { icon: 'robot', require: ['bots', 'protocols', 'registry'] },
  component: () => import('./bots/index.vue'),
})

router.addRoute({
  path: '/settings',
  name: '插件配置',
  meta: { icon: 'tools', require: ['registry', 'market', 'services'] },
  component: () => import('./settings/index.vue'),
})

router.addRoute({
  path: '/market',
  name: '插件市场',
  meta: { icon: 'puzzle-piece', require: ['market'] },
  component: () => import('./market/index.vue'),
})
