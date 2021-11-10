import { addPage, addView } from '~/client'
import Chat from './chat.vue'
import Overlay from './overlay.vue'

addView('global', Overlay)

addPage({
  path: '/chat',
  name: '聊天',
  icon: 'comments',
  component: Chat,
  order: 100,
})
