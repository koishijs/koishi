import { Bot, Schema } from 'koishi'
import * as Telegram from './types'

export interface AdapterConfig {
  path?: string
  selfUrl?: string
}

export const AdapterConfig: Schema<AdapterConfig> = Schema.object({
  path: Schema.string().description('服务器监听的路径。').default('/telegram'),
  selfUrl: Schema.string().role('url').description('Koishi 服务暴露在公网的地址。缺省时将使用全局配置。'),
})

export const adaptUser = (data: Telegram.User): Bot.User => ({
  userId: data.id.toString(),
  username: data.username,
  nickname: data.first_name + (data.last_name || ''),
  isBot: data.is_bot,
})

export const adaptGuildMember = (data: Telegram.ChatMember): Bot.GuildMember => adaptUser(data.user)
