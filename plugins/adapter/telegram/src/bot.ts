import { createReadStream } from 'fs'
import { Bot, Adapter, camelCase, snakeCase, renameProperty, segment, assertProperty, Dict, Schema, Quester } from 'koishi'
import * as Telegram from './types'
import { AdapterConfig } from './utils'

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

export interface BotConfig extends Bot.BaseConfig {
  selfId?: string
  token?: string
  pollingInterval?: number
}

export const BotConfig: Schema<BotConfig> = Schema.object({
  token: Schema.string().description('机器人的用户令牌。').required(),
  pollingInterval: Schema.number().description('通过长轮询获取更新时间隔，单位为秒。设置即不使用 webhook 获取更新。'),
})

export interface TelegramBot {
  _request?(action: string, params: Dict<any>, field?: string, content?: Buffer, filename?: string): Promise<TelegramResponse>
}

function maybeFile(payload: Dict<any>, field: string) {
  if (!payload[field]) return [payload]
  let content
  const [schema, data] = payload[field].split('://')
  if (['base64', 'file'].includes(schema)) {
    content = (schema === 'base64' ? Buffer.from(data, 'base64') : createReadStream(data))
    delete payload[field]
  }
  return [payload, field, content]
}

export class TelegramBot extends Bot<BotConfig> {
  static adaptUser(data: Partial<Telegram.User & Bot.User>) {
    data.userId = data.id.toString()
    data.nickname = data.firstName + (data.lastName || '')
    delete data.id
    delete data.firstName
    delete data.lastName
    return data as Bot.User
  }

  static schema = AdapterConfig

  http: Quester

  constructor(adapter: Adapter, config: BotConfig) {
    assertProperty(config, 'token')
    if (!config.selfId) {
      if (config.token.includes(':')) {
        config.selfId = config.token.split(':')[0]
      } else {
        assertProperty(config, 'selfId')
      }
    }
    super(adapter, config)
    this.http = adapter.http.extend({
      endpoint: `${adapter.http.config.endpoint}/bot${config.token}`,
    })
  }

  /**
   * Request telegram API (using post method actually)
   * @param action method of telegram API, leading with a '/'
   * @param params params in camelCase
   * @param field file field key in fromData
   * @param content file stream
   * @returns Respond form telegram
   */
  async get<T = any, P = any>(action: string, params: P = undefined, field = '', content: Buffer = null): Promise<T> {
    this.logger.debug('[request] %s %o', action, params)
    const response = await this._request(action, snakeCase(params || {}), field, content)
    this.logger.debug('[response] %o', response)
    const { ok, result } = response
    if (ok) return camelCase(result)
    throw new SenderError(params, action, -1, this.selfId)
  }

  private async _sendMessage(chatId: string, content: string) {
    const chain = segment.parse(content)
    const payload = { chatId, caption: '', photo: '' }
    let result: Telegram.Message
    for (const node of chain) {
      if (node.type === 'text') {
        payload.caption += node.data.content
      } else if (node.type === 'image') {
        if (payload.photo) {
          result = await this.get('/sendPhoto', ...maybeFile(payload, 'photo'))
          payload.caption = ''
          payload.photo = ''
        }
        payload.photo = node.data.url || node.data.file
      } else {
        payload.caption += '[Unsupported message]'
      }
    }
    if (payload.photo) {
      result = await this.get('/sendPhoto', ...maybeFile(payload, 'photo'))
      payload.caption = ''
      payload.photo = ''
    } else if (payload.caption) {
      result = await this.get('/sendMessage', { chatId, text: payload.caption })
    }
    return result ? ('' + result.messageId) : null
  }

  async sendMessage(channelId: string, content: string) {
    if (!content) return
    const session = this.createSession({ content, channelId, subtype: 'group', guildId: channelId })
    if (await this.app.serial(session, 'before-send', session)) return
    session.messageId = await this._sendMessage(channelId, session.content)
    this.app.emit(session, 'send', session)
    return session.messageId
  }

  async sendPrivateMessage(userId: string, content: string) {
    return this.sendMessage(userId, content)
  }

  async getMessage() {
    return null
  }

  async deleteMessage(chatId: string, messageId: string) {
    await this.get('/deleteMessage', { chatId, messageId })
  }

  static adaptGroup(data: Telegram.Chat & Bot.Guild): Bot.Guild {
    renameProperty(data, 'guildId', 'id')
    renameProperty(data, 'guildName', 'title')
    return data
  }

  async getGuild(chatId: string): Promise<Bot.Guild> {
    const data = await this.get('/getChat', { chatId })
    return TelegramBot.adaptGroup(data)
  }

  async getGuildList() {
    return []
  }

  async getGuildMember(chatId: string, userId: string): Promise<Bot.GuildMember> {
    if (Number.isNaN(+userId)) return null
    const data = await this.get('/getChatMember', { chatId, userId })
    return TelegramBot.adaptUser(data)
  }

  async getGuildMemberList(chatId: string): Promise<Bot.GuildMember[]> {
    const data = await this.get('/getChatAdministrators', { chatId })
    return data.map(TelegramBot.adaptUser)
  }

  setGroupLeave(chatId: string) {
    return this.get('/leaveChat', { chatId })
  }

  async getLoginInfo() {
    const data = await this.get<Telegram.User>('/getMe')
    return TelegramBot.adaptUser(data)
  }
}
