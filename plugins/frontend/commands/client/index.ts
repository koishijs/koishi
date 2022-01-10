import { registerPage } from '~/client'
import type {} from '@koishijs/plugin-commands/src'
import Commands from './commands.vue'

registerPage({
  path: '/commands',
  name: '指令',
  icon: 'tools',
  order: 500,
  fields: ['commands'],
  component: Commands,
})
