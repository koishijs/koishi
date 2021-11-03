import { router, addView } from '@koishijs/ui-console'
import Chat from './chat.vue'
import Overlay from './overlay.vue'

addView('global', Overlay)

router.addRoute({
  path: '/chat',
  name: '聊天',
  meta: { icon: 'comments', authority: 4 },
  component: Chat,
})
