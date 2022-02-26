import { Adapter, Bot, Quester, Schema, segment } from 'koishi'
import { adaptChannel, AdapterConfig, adaptGroup as adaptGuild, adaptMessage, adaptUser } from './utils'
import { Sender } from './sender'
import { GatewayIntent, Internal } from './types'

interface PrivilegedIntents {
  members?: boolean
  presence?: boolean
}

export interface BotConfig extends Bot.BaseConfig, Quester.Config {
  token: string
  gateway?: string
  intents?: PrivilegedIntents
}

export const BotConfig = Schema.intersect([
  Schema.object({
    token: Schema.string().description('机器人的用户令牌。').role('secret').required(),
  }),
  Schema.object({
    gateway: Schema.string().role('url').default('wss://gateway.discord.gg/?v=8&encoding=json').description('要连接的 WebSocket 网关。'),
    intents: Schema.object({
      members: Schema.boolean().description('启用 GUILD_MEMBERS 推送。').default(true),
      presence: Schema.boolean().description('启用 GUILD_PRESENCES 推送。').default(false),
    }),
  }).description('推送设置'),
  Quester.createSchema({
    endpoint: 'https://discord.com/api/v8',
  }),
])

export class DiscordBot extends Bot<BotConfig> {
  static schema = AdapterConfig

  _d: number
  _ping: NodeJS.Timeout
  _sessionId: string

  public http: Quester
  public internal: Internal

  constructor(adapter: Adapter, config: BotConfig) {
    super(adapter, config)
    this._d = 0
    this._sessionId = ''
    this.http = adapter.ctx.http.extend({
      ...config,
      headers: {
        Authorization: `Bot ${config.token}`,
        ...config.headers,
      },
    })
    this.internal = new Internal(this.http)
  }

  getIntents() {
    let intents = 0
      | GatewayIntent.GUILD_MESSAGES
      | GatewayIntent.GUILD_MESSAGE_REACTIONS
      | GatewayIntent.DIRECT_MESSAGES
      | GatewayIntent.DIRECT_MESSAGE_REACTIONS
    if (this.config.intents.members) {
      intents |= GatewayIntent.GUILD_MEMBERS
    }
    if (this.config.intents.presence) {
      intents |= GatewayIntent.GUILD_PRESENCES
    }
    return intents
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
    const session = await this.session({ channelId, content, guildId, subtype: guildId ? 'group' : 'private' })
    if (!session?.content) return []

    const chain = segment.parse(session.content)
    const quote = this.parseQuote(chain)
    const message_reference = quote ? {
      message_id: quote,
    } : undefined

    const send = Sender.from(this, `/channels/${channelId}/messages`)
    const results = await send(session.content, { message_reference })

    for (const id of results) {
      session.messageId = id
      this.app.emit(session, 'send', session)
    }

    return results
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
