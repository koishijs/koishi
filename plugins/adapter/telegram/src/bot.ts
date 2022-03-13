import FormData from 'form-data'
import { Adapter, assertProperty, Bot, camelize, Dict, Logger, Quester, renameProperty, Schema, snakeCase } from 'koishi'
import * as Telegram from './types'
import { AdapterConfig, adaptGuildMember, adaptUser } from './utils'
import { AxiosError } from 'axios'
import { Sender } from './sender'

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

export interface BotConfig extends Bot.BaseConfig, Quester.Config {
  token?: string
  pollingTimeout?: number
}

export const BotConfig: Schema<BotConfig> = Schema.intersect([
  Schema.object({
    token: Schema.string().description('机器人的用户令牌。').role('secret').required(),
  }),
  Quester.createSchema({
    endpoint: 'https://api.telegram.org',
  }),
])

export class TelegramBot extends Bot<BotConfig> {
  static schema = AdapterConfig

  http: Quester & { file?: Quester }
  internal?: Telegram.Internal

  constructor(adapter: Adapter, config: BotConfig) {
    assertProperty(config, 'token')
    super(adapter, config)
    this.selfId = config.token.split(':')[0]
    this.http = this.app.http.extend({
      ...config,
      endpoint: `${config.endpoint}/bot${config.token}`,
    })
    this.http.file = this.app.http.extend({
      ...config,
      endpoint: `${config.endpoint}/file/bot${config.token}`,
    })
  }

  /**
   * Request telegram API
   * @param action method of telegram API. Starts with a '/'
   * @param params params in camelCase
   * @returns Respond form telegram
   */
  async get<T = any, P = any>(action: string, params: P = undefined): Promise<T> {
    this.logger.debug('[request] %s %o', action, params)
    const response = await this.http.get(action, {
      params: snakeCase(params || {}),
    })
    this.logger.debug('[response] %o', response)
    const { ok, result } = response
    if (ok) return camelize(result)
    throw new SenderError(params, action, -1, this.selfId)
  }

  /**
   * Request telegram API
   * @param action method of telegram API. Starts with a '/'
   * @param params params in camelCase
   * @param field file field key in fromData
   * @param content file stream
   * @returns Respond form telegram
   */
  async post<T = any, P = any>(action: string, params: P = undefined, field = '', content: Buffer = null, filename = 'file'): Promise<T> {
    this.logger.debug('[request] %s %o', action, params)
    const payload = new FormData()
    for (const key in params) {
      payload.append(snakeCase(key), params[key].toString())
    }
    if (field && content) payload.append(field, content, filename)
    let response: any
    try {
      response = await this.http.post(action, payload, {
        headers: payload.getHeaders(),
      })
    } catch (e) {
      response = (e as AxiosError).response.data
    }
    this.logger.debug('[response] %o', response)
    const { ok, result } = response
    if (ok) return camelize(result)
    throw new SenderError(params, action, -1, this.selfId)
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

    for (const id of results) {
      session.messageId = id
      this.app.emit(session, 'send', session)
    }

    return results
  }

  async sendPrivateMessage(userId: string, content: string) {
    return this.sendMessage(userId, content)
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
    const res = await this.http.file.get(`/${filePath}`, { responseType: 'arraybuffer' })
    const base64 = `base64://` + res.toString('base64')
    return { url: base64 }
  }
}
