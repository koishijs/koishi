import { addPage } from '~/client'
import Teach from './teach.vue'

addPage({
  path: '/teach',
  name: '问答',
  icon: 'book',
  require: ['stats', 'meta'],
  component: Teach,
})
