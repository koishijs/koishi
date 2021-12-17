import { registerPage } from '~/client'
import Database from './database/index.vue'
import Logs from './logs/index.vue'

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

registerPage({
  path: '/logs',
  name: '日志',
  icon: 'clipboard-list',
  order: 400,
  fields: ['logs'],
  component: Logs,
})
