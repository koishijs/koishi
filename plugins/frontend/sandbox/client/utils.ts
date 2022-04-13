import { createStorage, receive } from '@koishijs/client'
import { Message } from '@koishijs/plugin-sandbox/src'
import { Dict } from 'koishi'

export const panelTypes = {
  private: '私聊模式',
  guild: '群聊模式',
  profile: '用户设置',
}

interface SandboxConfig {
  user: string
  index: number
  messages: Dict<Message[]>
  panelType: keyof typeof panelTypes
}

export const config = createStorage<SandboxConfig>('sandbox', 1, () => ({
  user: '',
  index: 0,
  messages: {},
  panelType: 'private',
}))

receive('sandbox', (message: Message) => {
  (config.messages[message.channel] ||= []).push(message)
})

export const words = [
  'Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace',
  'Hank', 'Ivy', 'Jack', 'Kathy', 'Lily', 'Mandy', 'Nancy',
  'Oscar', 'Peggy', 'Quinn', 'Randy', 'Sandy', 'Toby',
  'Uma', 'Vicky', 'Wendy', 'Xander', 'Yvonne', 'Zoe',
]
