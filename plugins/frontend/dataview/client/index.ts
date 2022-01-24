import { Context } from '~/client'
import type {} from '@koishijs/plugin-dataview/src'
import Database from './index.vue'

export default (ctx: Context) => {
  ctx.registerPage({
    path: '/database',
    name: '数据库',
    icon: 'database',
    order: 410,
    fields: ['tables'],
    component: Database,
  })
}
