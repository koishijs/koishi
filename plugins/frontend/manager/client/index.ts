import { Card, Context } from '~/client'
import type {} from '@koishijs/plugin-manager/src'
import Bots from './bots/index.vue'
import Settings from './settings/index.vue'
import Market from './market/index.vue'

export default (ctx: Context) => {
  ctx.registerView({
    type: 'numeric',
    order: 100,
    component: Card.numeric({
      title: '当前消息频率',
      icon: 'paper-plane',
      fields: ['bots'],
      content: ({ bots }) => bots.reduce((sum, bot) => sum + bot.messageSent, 0) + ' / min',
    }),
  })

  ctx.registerPage({
    path: '/bots',
    name: '机器人',
    icon: 'robot',
    order: 630,
    fields: ['bots', 'protocols'],
    component: Bots,
  })

  ctx.registerPage({
    path: '/settings',
    name: '插件配置',
    icon: 'tools',
    order: 620,
    fields: ['packages', 'services'],
    component: Settings,
  })

  ctx.registerPage({
    path: '/market',
    name: '插件市场',
    icon: 'puzzle-piece',
    order: 610,
    fields: ['market', 'packages'],
    component: Market,
  })
}
