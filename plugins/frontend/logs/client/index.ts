import { registerPage } from '~/client'
import type {} from '@koishijs/plugin-logs/src'
import Logs from './logs.vue'

registerPage({
  path: '/logs',
  name: '日志',
  icon: 'clipboard-list',
  order: 400,
  fields: ['logs'],
  component: Logs,
})
