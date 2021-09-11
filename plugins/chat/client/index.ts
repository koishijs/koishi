import { router, views } from '@koishijs/ui-console'
import Chat from './chat.vue'
import Sandbox from './sandbox.vue'
import Overlay from './overlay.vue'

views.push(Overlay)

router.addRoute({
  path: '/sandbox',
  name: '沙盒',
  meta: { icon: 'laptop-code', authority: 1 },
  component: Sandbox,
})

router.addRoute({
  path: '/chat',
  name: '聊天',
  meta: { icon: 'comments', require: ['user'], authority: 4 },
  component: Chat,
})
