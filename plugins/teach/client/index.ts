import { registerPage } from '~/client'
import Teach from './teach.vue'

registerPage({
  path: '/teach',
  name: '问答',
  icon: 'book',
  fields: ['stats', 'meta'],
  component: Teach,
})
