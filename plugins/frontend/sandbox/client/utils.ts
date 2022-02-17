import { createStorage, receive } from '@koishijs/client'
import { Message } from '@koishijs/plugin-sandbox/src'
import { Dict } from 'koishi'

interface SandboxConfig {
  messages: Dict<Message[]>
  isPrivate: boolean
}

export const config = createStorage<SandboxConfig>('sandbox', 2, () => ({
  messages: {},
  isPrivate: true,
}))

receive('sandbox', (message: Message) => {
  (config.messages[message.channel] ||= []).push(message)
})

export const names = [
  'Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace',
  'Hank', 'Ivy', 'Jack', 'Kathy', 'Lily', 'Mandy', 'Nancy',
  'Oscar', 'Peggy', 'Quinn', 'Randy', 'Sandy', 'Toby',
  'Uma', 'Vicky', 'Wendy', 'Xander', 'Yvonne', 'Zoe',
]
