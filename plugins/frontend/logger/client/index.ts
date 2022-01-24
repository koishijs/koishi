import { Context } from '~/client'
import type {} from '@koishijs/plugin-logger/src'
import Logs from './index.vue'
import './index.scss'

export default (ctx: Context) => {
  ctx.registerPage({
    path: '/logs',
    name: '日志',
    icon: 'clipboard-list',
    order: 400,
    fields: ['logs'],
    component: Logs,
  })
}
