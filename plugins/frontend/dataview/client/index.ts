import { Context } from '~/client'
import type {} from '@koishijs/plugin-dataview'
import Database from './index.vue'

export default (ctx: Context) => {
  ctx.addPage({
    path: '/database/:name*',
    name: '数据库',
    icon: 'database',
    order: 410,
    authority: 4,
    fields: ['dbInfo'],
    component: Database,
  })
}
