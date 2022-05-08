import { Context } from '@koishijs/client'
import Page from './page.vue'

export default (ctx: Context) => {
  ctx.addPage({
    name: '扩展页面',
    path: '/custom-page',
    component: Page,
  })
}
