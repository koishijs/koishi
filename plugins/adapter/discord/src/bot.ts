/* eslint-disable camelcase */

import { Adapter, App, Bot, Schema, segment, Quester } from 'koishi'
import { adaptChannel, adaptGroup as adaptGuild, adaptMessage, adaptUser, AdapterConfig } from './utils'
import { Sender } from './sender'
import * as Discord from './types'

export interface BotConfig extends Bot.BaseConfig, Sender.Config {
  token: string
}

export const BotConfig = Schema.intersect([
  Schema.object({
    token: Schema.string().description('机器人的用户令牌。').required(),
    handleExternalAsset: Schema.union([
      Schema.const('download').description('先下载后发送'),
      Schema.const('direct').description('直接发送链接'),
      Schema.const('auto').description('发送一个 HEAD 请求，如果返回的 Content-Type 正确，则直接发送链接，否则先下载后发送'),
    ]).description('发送外链资源时采用的方式。').default('auto'),
    handleMixedContent: Schema.union([
      Schema.const('separate').description('将每个不同形式的内容分开发送'),
      Schema.const('attach').description('图片前如果有文本内容，则将文本作为图片的附带信息进行发送'),
      Schema.const('auto').description('如果图片本身采用直接发送则与前面的文本分开，否则将文本作为图片的附带信息发送'),
    ]).description('发送图文等混合内容时采用的方式。').default('auto'),
  }),
  App.Config.Request,
])

export class DiscordBot extends Bot<BotConfig> {
  static schema = AdapterConfig

  _d: number
  _ping: NodeJS.Timeout
  _sessionId: string

  public http: Quester
  public internal: Discord.Internal

  constructor(adapter: Adapter, config: BotConfig) {
    super(adapter, config)
    this._d = 0
    this._sessionId = ''
    this.http = adapter.http.extend({
      headers: { Authorization: `Bot ${config.token}` },
    })
    this.internal = new Discord.Internal(this.http)
  }

  async getSelf() {
    const data = await this.internal.getCurrentUser()
    return adaptUser(data)
  }

  private parseQuote(chain: segment.Chain) {
    if (chain[0].type !== 'quote') return
    return chain.shift().data.id
  }

  async sendMessage(channelId: string, content: string, guildId?: string) {
    const session = this.createSession({ channelId, content, guildId, subtype: guildId ? 'group' : 'private' })
    if (await this.app.serial(session, 'before-send', session)) return

    const chain = segment.parse(session.content)
    const quote = this.parseQuote(chain)
    const message_reference = quote ? {
      message_id: quote,
    } : undefined

    const send = Sender.from(this, `/channels/${channelId}/messages`)
    session.messageId = await send(session.content, { message_reference })

    this.app.emit(session, 'send', session)
    return session.messageId
  }

  async sendPrivateMessage(channelId: string, content: string) {
    return this.sendMessage(channelId, content)
  }

  async deleteMessage(channelId: string, messageId: string) {
    await this.internal.deleteMessage(channelId, messageId)
  }

  async editMessage(channelId: string, messageId: string, content: string) {
    const chain = segment.parse(content)
    const image = chain.find(v => v.type === 'image')
    if (image) {
      throw new Error("You can't include embed object(s) while editing message.")
    }
    await this.internal.editMessage(channelId, messageId, {
      content,
    })
  }

  async getMessage(channelId: string, messageId: string): Promise<Bot.Message> {
    const [msg, channel] = await Promise.all([
      this.internal.getChannelMessage(channelId, messageId),
      this.internal.getChannel(channelId),
    ])
    const result: Bot.Message = {
      messageId: msg.id,
      channelId: msg.channel_id,
      guildId: channel.guild_id,
      userId: msg.author.id,
      content: msg.content,
      timestamp: new Date(msg.timestamp).valueOf(),
      author: adaptUser(msg.author),
    }
    result.author.nickname = msg.member?.nick
    if (msg.message_reference) {
      const quoteMsg = await this.internal.getChannelMessage(msg.message_reference.channel_id, msg.message_reference.message_id)
      result.quote = adaptMessage(this, quoteMsg)
    }
    return result
  }

  async getUser(userId: string) {
    const data = await this.internal.getUser(userId)
    return adaptUser(data)
  }

  async getGuildMemberList(guildId: string) {
    const data = await this.internal.listGuildMembers(guildId)
    return data.map(v => adaptUser(v.user))
  }

  async getChannel(channelId: string) {
    const data = await this.internal.getChannel(channelId)
    return adaptChannel(data)
  }

  async getGuildMember(guildId: string, userId: string) {
    const member = await this.internal.getGuildMember(guildId, userId)
    return {
      ...adaptUser(member.user),
      nickname: member.nick,
    }
  }

  async getGuild(guildId: string) {
    const data = await this.internal.getGuild(guildId)
    return adaptGuild(data)
  }

  async getGuildList() {
    const data = await this.internal.getCurrentUserGuilds()
    return data.map(v => adaptGuild(v))
  }

  async getChannelList(guildId: string) {
    const data = await this.internal.getGuildChannels(guildId)
    return data.map(v => adaptChannel(v))
  }
}
