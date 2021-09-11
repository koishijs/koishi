import { router } from '@koishijs/ui-console'
import Teach from './teach.vue'

router.addRoute({
  path: '/teach',
  name: '问答',
  meta: { icon: 'book', require: ['stats', 'meta'] },
  component: Teach,
})
