import { Context } from '~/client'
import Chat from './chat.vue'
import Overlay from './overlay.vue'

export default (ctx: Context) => {
  ctx.registerView({
    type: 'global',
    component: Overlay,
  })

  ctx.registerPage({
    path: '/chat',
    name: '聊天',
    icon: 'comments',
    component: Chat,
    order: 100,
  })
}
