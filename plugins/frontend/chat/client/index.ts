import { Context } from '@koishijs/client'
import Chat from './chat.vue'

export default (ctx: Context) => {
  ctx.addPage({
    path: '/chat',
    name: '聊天',
    icon: 'comments-full',
    authority: 3,
    component: Chat,
    order: 100,
  })
}
