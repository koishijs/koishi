import { Bot as GBot, Guild as GGuild, User as GUser } from '@qq-guild-sdk/core'
import { Bot } from 'koishi'
import { WebSocketClient } from './ws'
import { renameProperty } from '@koishijs/utils'

export interface BotConfig extends Bot.BaseConfig, GBot.AppConfig {
  indents: GBot.Intents | number
}

const adaptGuild = (guild: GGuild): Bot.Guild => ({
  guildId: guild.id, guildName: guild.name,
})

const adaptUser = (user: GUser): Bot.User => ({
  isBot: user.bot,
  avatar: user.avatar,
  userId: user.id,
  username: user.username,
  nickname: user.username,
})

export class QQGuildBot extends Bot<BotConfig> {
  $innerBot: GBot
  constructor(adapter: WebSocketClient, app: BotConfig) {
    super(adapter, app)
    this.$innerBot = new GBot({ app, ...adapter.config })
  }

  async getSelf() {
    const u = adaptUser(await this.$innerBot.me)
    renameProperty(u, 'selfId' as never, 'userId')
    return u
  }

  async sendMessage(channelId: string, content: string, guildId?: string): Promise<string> {
    const resp = await this.$innerBot.send.channel(channelId, content)
    return resp.id
  }

  async getGuildList() {
    return this.$innerBot.guilds.then(guilds => guilds.map(adaptGuild))
  }
}
