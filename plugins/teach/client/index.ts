import { Context } from '~/client'
import Teach from './teach.vue'

export default (ctx: Context) => {
  ctx.addPage({
    path: '/teach',
    name: '问答',
    icon: 'book',
    authority: 3,
    fields: ['stats', 'meta'],
    component: Teach,
  })
}
