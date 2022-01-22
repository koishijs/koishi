import { registerPage } from '~/client'
import type {} from '@koishijs/plugin-logger/src'
import Logs from './logs.vue'
import './index.scss'

registerPage({
  path: '/logs',
  name: '日志',
  icon: 'clipboard-list',
  order: 400,
  fields: ['logs'],
  component: Logs,
})
