import { Context } from '@koishijs/client'
import Sandbox from './index.vue'

export default (ctx: Context) => {
  ctx.addPage({
    name: '模拟调试',
    path: '/sandbox',
    order: 300,
    component: Sandbox,
  })
}
