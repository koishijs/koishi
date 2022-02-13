import { Context } from '~/client'
import type {} from '@koishijs/plugin-commands/src'
import Commands from './commands.vue'

export default (ctx: Context) => {
  ctx.addPage({
    path: '/commands',
    name: '指令管理',
    icon: 'tools',
    order: 500,
    authority: 4,
    fields: ['commands'],
    component: Commands,
  })
}
