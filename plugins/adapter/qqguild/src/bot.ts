import { Bot as GBot, Message } from '@qq-guild-sdk/core'
import { Bot, segment, Session } from 'koishi'
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
    this.app.emit(session, 'message', this.adaptMessage(resp))
    return [resp.id]
  }

  async getGuildList() {
    return this.$innerBot.guilds.then(guilds => guilds.map(adaptGuild))
  }

  adaptMessage(msg: Message) {
    const {
      id: messageId, author, guildId, channelId, timestamp,
    } = msg
    const session: Partial<Session> = {
      selfId: this.selfId,
      guildId,
      messageId,
      channelId,
      timestamp: +timestamp,
    }
    session.author = adaptUser(msg.author)
    session.userId = author.id
    session.guildId = msg.guildId
    session.channelId = msg.channelId
    session.subtype = 'group'
    session.content = (msg.content ?? '')
      .replace(/<@!(.+)>/, (_, $1) => segment.at($1))
      .replace(/<#(.+)>/, (_, $1) => segment.sharp($1))
    session.content = (msg as any as { attachments: any[] }).attachments
      .filter(({ contentType }) => contentType.startsWith('image'))
      .reduce((content, attachment) => content + segment.image(attachment.url), session.content)
    return new Session(this, session)
  }
}
