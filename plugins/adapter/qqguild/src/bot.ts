import { Bot as GBot, Guild as GGuild } from '@qq-guild-sdk/core'
import { Bot } from 'koishi'
import { WebSocketClient } from './ws'

export interface BotConfig extends Bot.BaseConfig, GBot.AppConfig {
  indents: GBot.Intents | number
}

const adaptGuild = (guild: GGuild): Bot.Guild => ({
  guildId: guild.id, guildName: guild.name,
})

export class QQGuildBot extends Bot<BotConfig> {
  $innerBot: GBot
  constructor(adapter: WebSocketClient, app: BotConfig) {
    super(adapter, app)
    this.$innerBot = new GBot({ app, ...adapter.config })
  }

  async sendMessage(channelId: string, content: string, guildId?: string): Promise<string> {
    const resp = await this.$innerBot.send.channel(channelId, content)
    return resp.id
  }

  async getGuildList() {
    return this.$innerBot.guilds.then(guilds => guilds.map(adaptGuild))
  }
}
