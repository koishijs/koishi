import { Context } from '~/client'
import Chat from './chat.vue'
import Overlay from './overlay.vue'

export default (ctx: Context) => {
  ctx.addView({
    type: 'global',
    component: Overlay,
  })

  ctx.addPage({
    path: '/chat',
    name: '聊天',
    icon: 'comments',
    component: Chat,
    order: 100,
  })
}
