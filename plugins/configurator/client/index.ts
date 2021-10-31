import { router } from '@koishijs/ui-console'

router.addRoute({
  path: '/bots',
  name: '机器人',
  meta: { icon: 'robot', require: ['profile', 'registry'] },
  component: () => import('./bots/index.vue'),
})

router.addRoute({
  path: '/settings',
  name: '插件配置',
  meta: { icon: 'tools', require: ['registry', 'market'] },
  component: () => import('./settings/index.vue'),
})

router.addRoute({
  path: '/market',
  name: '插件市场',
  meta: { icon: 'puzzle-piece', require: ['market'] },
  component: () => import('./market/index.vue'),
})
