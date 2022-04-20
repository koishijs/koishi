export interface Message {
  id: string
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
}
