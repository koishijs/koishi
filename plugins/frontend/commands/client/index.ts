import { Context } from '@koishijs/client'
import {} from '@koishijs/plugin-commands'
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
