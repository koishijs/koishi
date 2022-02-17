import { Context } from '@koishijs/client'
import Sandbox from './index.vue'

export default (ctx: Context) => {
  ctx.addPage({
    name: '沙盒',
    path: '/sandbox',
    icon: 'flask',
    order: 300,
    authority: 4,
    component: Sandbox,
  })
}
