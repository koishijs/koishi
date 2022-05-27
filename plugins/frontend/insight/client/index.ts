import { Context } from '@koishijs/client'
import {} from '@koishijs/plugin-insight/src'
import Graph from './index.vue'

export default (ctx: Context) => {
  ctx.addPage({
    path: '/graph',
    name: '依赖图',
    icon: 'diagram',
    order: 600,
    fields: ['insight'],
    component: Graph,
  })
}
