import FormData from 'form-data'
import { Adapter, assertProperty, Bot, camelCase, Dict, Logger, Quester, renameProperty, Schema, snakeCase } from 'koishi'
import * as Telegram from './types'
import { AdapterConfig } from './utils'
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

export interface BotConfig extends Bot.BaseConfig {
  token?: string
  request?: Quester.Config
  pollingTimeout?: number
}

export const BotConfig: Schema<BotConfig> = Schema.object({
  token: Schema.string().description('机器人的用户令牌。').role('secret').required(),
  request: Quester.createSchema({
    endpoint: 'https://api.telegram.org',
  }),
})

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

  http: Quester & { file?: Quester }

  constructor(adapter: Adapter, config: BotConfig) {
    assertProperty(config, 'token')
    super(adapter, config)
    this.selfId = config.token.split(':')[0]
    this.http = this.app.http.extend({
      endpoint: `${config.request.endpoint}/bot${config.token}`,
    })
    this.http.file = this.app.http.extend({
      endpoint: `${config.request.endpoint}/file/bot${config.token}`,
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
    if (ok) return camelCase(result)
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
    if (ok) return camelCase(result)
    throw new SenderError(params, action, -1, this.selfId)
  }

  async sendMessage(channelId: string, content: string) {
    if (!content) return
    let subtype: string
    let chatId: string
    if (channelId.startsWith('private:')) {
      subtype = 'private'
      chatId = channelId.slice(8)
    } else {
      subtype = 'group'
      chatId = channelId
    }

    const session = this.createSession({ subtype, content, channelId, guildId: channelId })
    if (await this.app.serial(session, 'before-send', session)) return

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

  async deleteMessage(chatId: string, messageId: string) {
    await this.get('/deleteMessage', { chatId, messageId })
  }

  static adaptGroup(data: Telegram.Chat): Bot.Guild {
    renameProperty(data as any, 'guildId', 'id')
    renameProperty(data as any, 'guildName', 'title')
    return data as any
  }

  async getGuild(chatId: string): Promise<Bot.Guild> {
    const data = await this.get<Telegram.Chat>('/getChat', { chatId })
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

  async handleGuildMemberRequest(messageId: string, approve: boolean, comment?: string): Promise<void> {
    const [chatId, userId] = messageId.split('@')
    const method = approve ? '/approveChatJoinRequest' : '/declineChatJoinRequest'
    const success = await this.get<boolean>(method, { chatId, userId })
    if (!success) throw new Error(`handel guild member request field ${success}`)
  }

  async getLoginInfo() {
    const data = await this.get<Telegram.User>('/getMe')
    return TelegramBot.adaptUser(data)
  }

  async $getFileData(fileId: string) {
    try {
      const file = await this.get<Telegram.File>('/getFile', { fileId })
      return await this.$getFileContent(file.filePath)
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
