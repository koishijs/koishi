import { Context } from '@koishijs/client'
import {} from '@koishijs/plugin-insight'
import Graph from './index.vue'

export default (ctx: Context) => {
  ctx.addPage({
    path: '/graph',
    name: '依赖图',
    icon: 'diagram',
    order: 600,
    fields: ['registry'],
    component: Graph,
  })
}
