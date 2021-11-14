/* eslint-disable camelcase */

import { Adapter, App, Bot, Schema, segment, Quester } from 'koishi'
import { adaptChannel, adaptGroup, adaptMessage, adaptUser, AdapterConfig } from './utils'
import { Sender } from './sender'
import * as Discord from './types'

export interface BotConfig extends Bot.BaseConfig, Sender.Config {
  token: string
}

export const BotConfig: Schema<BotConfig> = Schema.merge([
  Schema.object({
    token: Schema.string('机器人的用户令牌。').required(),
    handleExternalAsset: Schema.select({
      download: '先下载后发送',
      direct: '直接发送链接',
      auto: '发送一个 HEAD 请求，如果返回的 Content-Type 正确，则直接发送链接，否则先下载后发送',
    }, '发送外链资源时采用的方式。').default('auto'),
    handleMixedContent: Schema.select({
      separate: '将每个不同形式的内容分开发送',
      attach: '图片前如果有文本内容，则将文本作为图片的附带信息进行发送',
      auto: '如果图片本身采用直接发送则与前面的文本分开，否则将文本作为图片的附带信息发送',
    }, '发送图文等混合内容时采用的方式。').default('auto'),
  }),
  App.Config.Request,
])

export class DiscordBot extends Bot<BotConfig> {
  static schema = AdapterConfig

  _d: number
  _ping: NodeJS.Timeout
  _sessionId: string

  public request: Quester
  public internal: Discord.Internal

  constructor(adapter: Adapter, config: BotConfig) {
    super(adapter, config)
    this._d = 0
    this._sessionId = ''
    this.request = adapter.http.extend({
      headers: { Authorization: `Bot ${config.token}`, },
    })
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

  deleteMessage(channelId: string, messageId: string) {
    return this.request('DELETE', `/channels/${channelId}/messages/${messageId}`)
  }

  async editMessage(channelId: string, messageId: string, content: string) {
    const chain = segment.parse(content)
    const image = chain.find(v => v.type === 'image')
    if (image) {
      throw new Error("You can't include embed object(s) while editing message.")
    }
    return this.request('PATCH', `/channels/${channelId}/messages/${messageId}`, {
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
    const data = await this.request<Discord.User>('GET', `/users/${userId}`)
    return adaptUser(data)
  }

  async getGuildMemberList(guildId: string) {
    const data = await this.$listGuildMembers(guildId)
    return data.map(v => adaptUser(v.user))
  }

  async getChannel(channelId: string) {
    const data = await this.$getChannel(channelId)
    return adaptChannel(data)
  }

  async getGuildMember(guildId: string, userId: string) {
    const member = await this.$getGuildMember(guildId, userId)
    return {
      ...adaptUser(member.user),
      nickname: member.nick,
    }
  }

  async getGuild(guildId: string) {
    const data = await this.$getGuild(guildId)
    return adaptGroup(data)
  }

  async $getUserGuilds() {
    return this.request<Discord.PartialGuild[]>('GET', '/users/@me/guilds')
  }

  async getGuildList() {
    const data = await this.$getUserGuilds()
    return data.map(v => adaptGroup(v))
  }

  $getGuildChannels(guildId: string) {
    return this.request<Discord.Channel[]>('GET', `/guilds/${guildId}/channels`)
  }

  async getChannelList(guildId: string) {
    const data = await this.$getGuildChannels(guildId)
    return data.map(v => adaptChannel(v))
  }
}
