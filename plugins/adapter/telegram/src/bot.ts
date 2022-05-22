import { Adapter, assertProperty, Bot, Dict, Logger, Quester, renameProperty, Schema, segment, Session, Time } from 'koishi'
import * as Telegram from './types'
import { AdapterConfig, adaptGuildMember, adaptUser } from './utils'
import { Sender } from './sender'
import fs from 'fs'

const logger = new Logger('telegram')

export class SenderError extends Error {
  constructor(args: Dict<any>, url: string, retcode: number, selfId: string) {
    super(`Error when trying to send to ${url}, args: ${JSON.stringify(args)}, retcode: ${retcode}`)
    Object.defineProperties(this, {
      name: { value: 'SenderError' },
      selfId: { value: selfId },
      code: { value: retcode },
      args: { value: args },
      url: { value: url },
    })
  }
}

export interface TelegramResponse {
  ok: boolean
  result: any
}

export interface FileConfig {
  endpoint?: string
  local?: boolean
}

export interface BotConfig extends Bot.BaseConfig, Quester.Config {
  token?: string
  pollingTimeout?: number
  files?: FileConfig
}

export const BotConfig: Schema<BotConfig> = Schema.intersect([
  Schema.object({
    token: Schema.string().description('机器人的用户令牌。').role('secret').required(),
    files: Schema.object({
      endpoint: Schema.string().description('文件请求的终结点。'),
      local: Schema.boolean().description('是否启用 [Telegram Bot API](https://github.com/tdlib/telegram-bot-api) 本地模式。').default(false),
    }),
  }),
  Quester.createSchema({
    endpoint: 'https://api.telegram.org',
  }),
] as const)

export class TelegramBot extends Bot<BotConfig> {
  static schema = AdapterConfig

  http: Quester & { file?: Quester }
  internal?: Telegram.Internal
  local?: boolean

  constructor(adapter: Adapter, config: BotConfig) {
    assertProperty(config, 'token')
    super(adapter, config)
    this.selfId = config.token.split(':')[0]
    this.local = config.files.local
    this.http = this.app.http.extend({
      ...config,
      endpoint: `${config.endpoint}/bot${config.token}`,
    })
    this.http.file = this.app.http.extend({
      ...config,
      endpoint: `${config.files.endpoint || config.endpoint}/file/bot${config.token}`,
    })
    this.internal = new Telegram.Internal(this.http)
  }

  async adaptMessage(message: Telegram.Message, session: Partial<Session>) {
    function parseText(text: string, entities: Telegram.MessageEntity[]): segment[] {
      let curr = 0
      const segs: segment[] = []
      for (const e of entities) {
        const eText = text.substr(e.offset, e.length)
        if (e.type === 'mention') {
          if (eText[0] !== '@') throw new Error('Telegram mention does not start with @: ' + eText)
          const atName = eText.slice(1)
          if (eText === '@' + this.username) segs.push({ type: 'at', data: { id: this.selfId, name: atName } })
          // TODO handle @others
        } else if (e.type === 'text_mention') {
          segs.push({ type: 'at', data: { id: e.user.id } })
        } else {
          continue
        }
        if (e.offset > curr) {
          segs.splice(-1, 0, { type: 'text', data: { content: text.slice(curr, e.offset) } })
          curr = e.offset + e.length
        }
      }
      if (curr < text?.length || 0) {
        segs.push({ type: 'text', data: { content: text.slice(curr) } })
      }
      return segs
    }

    session.messageId = message.message_id.toString()
    session.timestamp = message.date * 1000
    const segments: segment[] = []
    if (message.reply_to_message) {
      const replayText = message.reply_to_message.text || message.reply_to_message.caption
      const parsedReply = parseText(replayText, message.reply_to_message.entities || [])
      session.quote = {
        messageId: message.reply_to_message.message_id.toString(),
        author: adaptUser(message.reply_to_message.from),
        content: replayText ? segment.join(parsedReply) : undefined,
      }
      segments.push({ type: 'quote', data: { id: message.reply_to_message.message_id, channelId: message.reply_to_message.chat.id } })
    }
    if (message.location) {
      segments.push({
        type: 'location',
        data: { lat: message.location.latitude, lon: message.location.longitude },
      })
    }
    if (message.photo) {
      const photo = message.photo.sort((s1, s2) => s2.file_size - s1.file_size)[0]
      segments.push({ type: 'image', data: await this.$getFileData(photo.file_id) })
    }
    if (message.sticker) {
      // TODO: Convert tgs to gif
      // https://github.com/ed-asriyan/tgs-to-gif
      // Currently use thumb only
      try {
        const file = await this.internal.getFile({ file_id: message.sticker.file_id })
        if (file.file_path.endsWith('.tgs')) {
          throw new Error('tgs is not supported now')
        }
        segments.push({ type: 'image', data: await this.$getFileContent(file.file_path) })
      } catch (e) {
        logger.warn('get file error', e)
        segments.push({ type: 'text', data: { content: `[${message.sticker.set_name || 'sticker'} ${message.sticker.emoji || ''}]` } })
      }
    } else if (message.animation) {
      segments.push({ type: 'image', data: await this.$getFileData(message.animation.file_id) })
    } else if (message.voice) {
      segments.push({ type: 'audio', data: await this.$getFileData(message.voice.file_id) })
    } else if (message.video) {
      segments.push({ type: 'video', data: await this.$getFileData(message.video.file_id) })
    } else if (message.document) {
      segments.push({ type: 'file', data: await this.$getFileData(message.document.file_id) })
    }

    const msgText: string = message.text || message.caption
    segments.push(...parseText(msgText, message.entities || []))

    session.content = segment.join(segments)
    session.userId = message.from.id.toString()
    session.author = adaptUser(message.from)
    session.channelId = message.chat.id.toString()
    if (message.chat.type === 'private') {
      session.subtype = 'private'
      session.channelId = 'private:' + session.channelId
    } else {
      session.subtype = 'group'
      session.guildId = session.channelId
    }
  }

  async sendMessage(channelId: string, content: string) {
    if (!content) return []
    let subtype: string
    let chatId: string
    if (channelId.startsWith('private:')) {
      subtype = 'private'
      chatId = channelId.slice(8)
    } else {
      subtype = 'group'
      chatId = channelId
    }

    const session = await this.session({ subtype, content, channelId, guildId: channelId })
    if (!session?.content) return []

    const send = Sender.from(this, chatId)
    const results = await send(session.content)

    for (const message of results) {
      const session = new Session(this, {
        selfId: this.selfId,
        type: 'message',
      })
      session.telegram = Object.create(this.internal)
      await this.adaptMessage(message, session)
      this.app.emit(session, 'send', session)
      this.app.emit(session, 'message', session)
    }

    return results.map(result => '' + result.message_id)
  }

  async sendPrivateMessage(userId: string, content: string) {
    return this.sendMessage('private:' + userId, content)
  }

  async getMessage() {
    return null
  }

  async deleteMessage(chat_id: string, message_id: string | number) {
    message_id = +message_id
    await this.internal.deleteMessage({ chat_id, message_id })
  }

  static adaptGroup(data: Telegram.Chat): Bot.Guild {
    renameProperty(data as any, 'guildId', 'id')
    renameProperty(data as any, 'guildName', 'title')
    return data as any
  }

  async getGuild(chat_id: string): Promise<Bot.Guild> {
    const data = await this.internal.getChat({ chat_id })
    return TelegramBot.adaptGroup(data)
  }

  async getGuildList() {
    return []
  }

  async getGuildMember(chat_id: string, user_id: string | number) {
    user_id = +user_id
    if (Number.isNaN(user_id)) return null
    const data = await this.internal.getChatMember({ chat_id, user_id })
    return adaptGuildMember(data)
  }

  async getGuildMemberList(chat_id: string) {
    const data = await this.internal.getChatAdministrators({ chat_id })
    return data.map(adaptGuildMember)
  }

  async kickGuildMember(chat_id: string, user_id: string | number, permanent?: boolean) {
    user_id = +user_id
    await this.internal.banChatMember({
      chat_id,
      user_id,
      until_date: Date.now() + (permanent ? 0 : Time.minute),
      revoke_messages: true,
    })
  }

  setGroupLeave(chat_id: string) {
    return this.internal.leaveChat({ chat_id })
  }

  async handleGuildMemberRequest(messageId: string, approve: boolean, comment?: string) {
    const [chat_id, user_id] = messageId.split('@')
    const method = approve ? 'approveChatJoinRequest' : 'declineChatJoinRequest'
    const success = await this.internal[method]({ chat_id, user_id: +user_id })
    if (!success) throw new Error(`handel guild member request field ${success}`)
  }

  async getLoginInfo() {
    const data = await this.internal.getMe()
    return adaptUser(data)
  }

  async $getFileData(file_id: string) {
    try {
      const file = await this.internal.getFile({ file_id })
      return await this.$getFileContent(file.file_path)
    } catch (e) {
      logger.warn('get file error', e)
    }
  }

  async $getFileContent(filePath: string) {
    let res: Buffer
    if (this.local) {
      res = await fs.promises.readFile(filePath)
    } else {
      res = await this.http.file.get(`/${filePath}`, { responseType: 'arraybuffer' })
    }
    const base64 = `base64://` + res.toString('base64')
    return { url: base64 }
  }
}
