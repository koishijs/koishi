import { registerPage } from '~/client'
import Database from './database/index.vue'

import './home'
import './index.scss'

registerPage({
  path: '/database',
  name: '数据库',
  icon: 'database',
  order: 410,
  fields: ['meta'],
  component: Database,
})
