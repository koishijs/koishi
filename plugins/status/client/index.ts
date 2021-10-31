import { router } from '@koishijs/ui-console'

router.addRoute({
  path: '/',
  name: '仪表盘',
  meta: { icon: 'tachometer-alt', require: ['stats', 'meta', 'profile'] },
  component: () => import('./home/home.vue'),
})

router.addRoute({
  path: '/database',
  name: '数据库',
  meta: { icon: 'database', require: ['meta'] },
  component: () => import('./database/index.vue'),
})

router.addRoute({
  path: '/logs',
  name: '运行日志',
  meta: { icon: 'clipboard-list', require: ['logs'] },
  component: () => import('./logs/index.vue'),
})
