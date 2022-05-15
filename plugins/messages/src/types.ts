export interface Message {
  id?: number
  content: string
  messageId: string
  platform: string
  guildId: string
  userId: string
  timestamp: Date
  quoteId?: string
  username: string
  nickname: string
  channelId: string
  selfId: string
  lastUpdated?: Date
  deleted?: number
}
