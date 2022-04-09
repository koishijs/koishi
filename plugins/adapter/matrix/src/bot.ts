import { Adapter, Bot, omit, Quester, Schema, segment } from 'koishi'
import * as Matrix from './types'

export interface BotConfig extends Bot.BaseConfig, Quester.Config {
  selfId?: string
  hsToken?: string
  asToken?: string
  host?: string
}

export const BotConfig = Schema.object({
  selfId: Schema.string().description('机器人的 ID。').required(),
  host: Schema.string().description('Matrix homeserver 域名。').required(),
  hsToken: Schema.string().description('hs_token').required(),
  asToken: Schema.string().description('as_token').required(),
  endpoint: Schema.string().description('Matrix homeserver 地址。默认为 https://host 。'),
  ...omit(Quester.Config.dict, ['endpoint']),
})

export class MatrixBot extends Bot<BotConfig> {
    http: Quester
    hsToken: string
    host: string
    userId: string
    endpoint: string
    internal: Matrix.Internal
    constructor(adapter: Adapter, config: BotConfig) {
      super(adapter, config)
      this.selfId = config.selfId
      this.hsToken = config.hsToken
      this.host = config.host
      this.userId = `@${this.selfId}:${this.host}`
      this.endpoint = config.endpoint || `https://${config.host}`
      this.http = this.app.http.extend({
        ...config,
        endpoint: this.endpoint + '/_matrix',
        headers: {
          'Authorization': `Bearer ${config.asToken}`,
        },
      })
      this.internal = new Matrix.Internal(this)
    }

    async sendMessage(channelId: string, content: string, guildId?: string): Promise<string[]> {
      const segs = segment.parse(content)
      const ids = []
      let text = ''
      let reply = null
      const sendText = async (content) => {
        const session = await this.session({ content, channelId, subtype: 'group' })
        const id = await this.internal.sendTextMessage(channelId, this.userId, content, reply)
        session.messageId = id
        this.app.emit(session, 'send', session)
        return id
      }
      const sendMedia = async (url, type) => {
        const session = await this.session({ content, channelId, subtype: 'group' })
        const id = await this.internal.sendMediaMessage(channelId, this.userId, type, url)
        session.messageId = id
        this.app.emit(session, 'send', session)
        return id
      }
      for (const seg of segs) {
        switch (seg.type) {
          case 'text':
            text += seg.data.content
            break
          case 'at':
          case 'sharp':
            text += seg.data.id
            break
          case 'face': // unsupported
            break
          case 'image':
          case 'audio':
          case 'video':
          case 'file':
            if (text) ids.push(await sendText(text))
            text = ''
            ids.push(await sendMedia(seg.data.url, seg.type))
            break
          case 'quote': {
            const message = await this.getMessage(channelId, seg.data.id)
            reply = seg.data.id
            text += `> <${message.userId}> ${message.content}\n\n`
            break
          }
        }
      }
      if (text) ids.push(await sendText(text))
      return ids
    }

    async getMessage(channelId: string, messageId: string): Promise<Bot.Message> {
      const event = await this.internal.getEvent(channelId, messageId)
      const content = event.content as Matrix.M_ROOM_MESSAGE
      const replyId = content['m.relates_to']?.['m.in_reply_to']
      let reply
      if (replyId) reply = await this.getMessage(channelId, replyId)
      return {
        messageId,
        channelId,
        userId: event.sender,
        content: content.body,
        timestamp: event.origin_server_ts,
        author: {
          userId: event.sender,
          username: event.sender,
        },
        quote: reply,
      }
    }

    async getSelf(): Promise<Bot.User> {
      return await this.getUser(this.userId)
    }

    async getUser(userId: string): Promise<Bot.User> {
      const profile = await this.internal.getProfile(userId)
      let avatar: string
      if (profile.avatar_url) avatar = this.internal.getAssetUrl(profile.avatar_url)
      return {
        userId,
        avatar,
        username: userId,
        nickname: profile.displayname,
      }
    }

    async getChannel(channelId: string, guildId?: string): Promise<Bot.Channel> {
      return {
        channelId,
      }
    }
}
