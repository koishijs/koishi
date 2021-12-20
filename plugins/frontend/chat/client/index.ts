import { registerPage, registerView } from '~/client'
import Chat from './chat.vue'
import Overlay from './overlay.vue'

registerView({
  type: 'global',
  component: Overlay,
})

registerPage({
  path: '/chat',
  name: '聊天',
  icon: 'comments',
  component: Chat,
  order: 100,
})
