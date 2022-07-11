import { Card, Context, icons } from '@koishijs/client'
import type {} from '@koishijs/plugin-manager'
import Bots from './bots/index.vue'
import Settings from './settings/index.vue'
import Dependencies from './deps/index.vue'
import Market from './market/index.vue'
import { overrideCount } from './utils'
import AddGroup from './icons/add-group.vue'
import AddPlugin from './icons/add-plugin.vue'

icons.register('add-plugin', AddPlugin)
icons.register('add-group', AddGroup)

export default (ctx: Context) => {
  ctx.addView({
    type: 'numeric',
    order: 100,
    component: Card.numeric({
      title: '当前消息频率',
      icon: 'paper-plane',
      fields: ['bots'],
      content: ({ bots }) => Object.values(bots).reduce((sum, bot) => sum + bot.messageSent, 0) + ' / min',
    }),
  })

  ctx.addPage({
    path: '/bots',
    name: '机器人',
    icon: 'robot',
    order: 640,
    authority: 4,
    fields: ['bots'],
    component: Bots,
  })

  ctx.addPage({
    path: '/plugins/:name*',
    name: '插件配置',
    icon: 'cog',
    order: 630,
    authority: 4,
    fields: ['config', 'packages', 'dependencies'],
    component: Settings,
  })

  ctx.addPage({
    path: '/market',
    name: '插件市场',
    icon: 'puzzle-piece',
    order: 620,
    authority: 4,
    fields: ['config', 'market', 'packages'],
    component: Market,
  })

  ctx.addPage({
    path: '/dependencies',
    name: '依赖管理',
    icon: 'box-open',
    order: 610,
    authority: 4,
    fields: ['market', 'dependencies'],
    component: Dependencies,
    badge: () => overrideCount.value,
  })
}
