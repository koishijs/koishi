import { Context } from '@koishijs/client'
import {} from '@koishijs/plugin-logger'
import Logs from './index.vue'
import './index.scss'

export default (ctx: Context) => {
  ctx.addPage({
    path: '/logs',
    name: '日志',
    icon: 'clipboard-list',
    order: 400,
    authority: 4,
    fields: ['logs'],
    component: Logs,
  })
}
