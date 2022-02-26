import { Bot as GBot } from '@qq-guild-sdk/core'
import { Bot } from 'koishi'
import { WebSocketClient } from './ws'
import { renameProperty } from '@koishijs/utils'
import { AdapterConfig, adaptGuild, adaptUser, BotConfig } from './utils'

export class QQGuildBot extends Bot<BotConfig> {
  static schema = AdapterConfig

  $innerBot: GBot

  constructor(adapter: WebSocketClient, app: BotConfig) {
    super(adapter, app)
    this.$innerBot = new GBot({ app, ...adapter.config })
  }

  async getSelf() {
    const user = adaptUser(await this.$innerBot.me)
    renameProperty(user, 'selfId' as never, 'userId')
    return user
  }

  async sendMessage(channelId: string, content: string, guildId?: string) {
    const session = await this.session({ channelId, content, guildId, subtype: 'group' })
    if (!session?.content) return []
    const resp = await this.$innerBot.send.channel(channelId, session.content)
    session.messageId = resp.id
    this.app.emit(session, 'send', session)
    return [resp.id]
  }

  async getGuildList() {
    return this.$innerBot.guilds.then(guilds => guilds.map(adaptGuild))
  }
}
