import { Guild as GGuild, User as GUser } from '@qq-guild-sdk/core/dist/common'
import { Adapter, Bot, Schema } from 'koishi'
import * as QQGuild from '@qq-guild-sdk/core'

export interface AdapterConfig extends Adapter.WebSocketClient.Config, Omit<QQGuild.Bot.Options, 'app'> {}

export const AdapterConfig: Schema<AdapterConfig> = Schema.intersect([
  Schema.object({
    sandbox: Schema.boolean().description('是否开启沙箱模式。').default(true),
    endpoint: Schema.string().role('url').description('API 入口地址。').default('https://api.sgroup.qq.com/'),
    authType: Schema.union(['bot', 'bearer']).description('采用的验证方式。').default('bot'),
  }),
  Adapter.WebSocketClient.Config,
])

type Intents = keyof typeof QQGuild.Bot.Intents

export interface BotConfig extends Bot.BaseConfig, QQGuild.Bot.AppConfig {
  intents: number | Intents | Intents[]
}

export const BotConfig = Schema.intersect([
  Schema.object({
    id: Schema.string().description('机器人 id。').required(),
    key: Schema.string().description('机器人 key。').role('secret').required(),
    token: Schema.string().description('机器人令牌。').role('secret').required(),
    intents: Schema.number(),
  }),
])

export const adaptGuild = (guild: GGuild): Bot.Guild => ({
  guildId: guild.id,
  guildName: guild.name,
})

export const adaptUser = (user: GUser): Bot.User => ({
  isBot: user.bot,
  avatar: user.avatar,
  userId: user.id,
  username: user.username,
  nickname: user.username,
})
