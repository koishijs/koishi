import { createReadStream } from 'fs'
import { camelCase, snakeCase, renameProperty, segment, assertProperty, Logger } from 'koishi-utils'
import { Bot, GroupInfo, GroupMemberInfo, UserInfo, BotOptions, Adapter } from 'koishi-core'
import * as Telegram from './types'
import axios, { AxiosError } from 'axios'
import FormData from 'form-data'

const logger = new Logger('telegram')

export class SenderError extends Error {
  constructor(args: Record<string, any>, url: string, retcode: number, selfId: string) {
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

export interface TelegramBot {
  _request?(action: string, params: Record<string, any>, field?: string, content?: Buffer, filename?: string): Promise<TelegramResponse>
}

function maybeFile(payload: Record<string, any>, field: string) {
  if (!payload[field]) return [payload]
  let content
  const [schema, data] = payload[field].split('://')
  if (['base64', 'file'].includes(schema)) {
    content = (schema === 'base64' ? Buffer.from(data, 'base64') : createReadStream(data))
    delete payload[field]
  }
  return [payload, field, content]
}

export class TelegramBot extends Bot {
  static adaptUser(data: Partial<Telegram.User & UserInfo>) {
    data.userId = data.id.toString()
    data.nickname = data.firstName + (data.lastName || '')
    delete data.id
    delete data.firstName
    delete data.lastName
    return data as UserInfo
  }

  constructor(adapter: Adapter, options: BotOptions) {
    assertProperty(options, 'token')
    if (!options.selfId) {
      if (options.token.includes(':')) {
        options.selfId = options.token.split(':')[0]
      } else {
        assertProperty(options, 'selfId')
      }
    }
    super(adapter, options)
    this.version = 'telegram'
  }

  async get<T = any>(action: string, params = {}, field = '', content: Buffer = null): Promise<T> {
    this.logger.debug('[request] %s %o', action, params)
    const response = await this._request(action, snakeCase(params), field, content)
    this.logger.debug('[response] %o', response)
    const { ok, result } = response
    if (ok) return camelCase(result)
    throw new SenderError(params, action, -1, this.selfId)
  }

  async _listen() {
    const { endpoint, selfUrl, path, axiosConfig } = this.app.options.telegram
    this._request = async (action, params, field, content, filename = 'file') => {
      const payload = new FormData()
      for (const key in params) {
        payload.append(key, params[key].toString())
      }
      if (field) payload.append(field, content, filename)
      const data = await axios.post(`${endpoint}/bot${this.token}/${action}`, payload, {
        ...this.app.options.axiosConfig,
        ...axiosConfig,
        headers: payload.getHeaders(),
      }).then(res => {
        return res.data
      }).catch((e: AxiosError) => {
        return e.response.data
      })
      return data
    }
    const { username } = await this.getLoginInfo()
    await this.get('setWebhook', {
      url: selfUrl + path + '?token=' + this.token,
      drop_pending_updates: true,
    })
    this.status = Bot.Status.GOOD
    this.username = username
    logger.debug('%d got version debug', this.selfId)
    logger.debug('connected to %c', 'telegram:' + this.selfId)
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
          result = await this.get('sendPhoto', ...maybeFile(payload, 'photo'))
          payload.caption = ''
          payload.photo = ''
        }
        payload.photo = node.data.url || node.data.file
      } else {
        payload.caption += '[Unsupported message]'
      }
    }
    if (payload.photo) {
      result = await this.get('sendPhoto', ...maybeFile(payload, 'photo'))
      payload.caption = ''
      payload.photo = ''
    } else if (payload.caption) {
      result = await this.get('sendMessage', { chatId, text: payload.caption })
    }
    return result ? ('' + result.messageId) : null
  }

  async sendMessage(channelId: string, content: string) {
    if (!content) return
    const session = this.createSession({ content, channelId, subtype: 'group', groupId: channelId })
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
    await this.get('deleteMessage', { chatId, messageId })
  }

  static adaptGroup(data: Telegram.Chat & GroupInfo): GroupInfo {
    renameProperty(data, 'groupId', 'id')
    renameProperty(data, 'groupName', 'title')
    return data
  }

  async getGroup(chatId: string): Promise<GroupInfo> {
    const data = await this.get('getChat', { chatId })
    return TelegramBot.adaptGroup(data)
  }

  async getGroupList() {
    return []
  }

  async getGroupMember(chatId: string, userId: string): Promise<GroupMemberInfo> {
    if (Number.isNaN(+userId)) return null
    const data = await this.get('getChatMember', { chatId, userId })
    return TelegramBot.adaptUser(data)
  }

  async getGroupMemberList(chatId: string): Promise<GroupMemberInfo[]> {
    const data = await this.get('getChatAdministrators', { chatId })
    return data.map(TelegramBot.adaptUser)
  }

  setGroupLeave(chatId: string) {
    return this.get('leaveChat', { chatId })
  }

  async getLoginInfo() {
    const data = await this.get<Telegram.User>('getMe')
    return TelegramBot.adaptUser(data)
  }
}

function defineSync(name: string, ...params: string[]) {
  const prop = camelCase(name.replace(/^_/, ''))
  TelegramBot.prototype[prop] = function (this: TelegramBot, ...args: any[]) {
    return this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
  }
}

function defineAsync(name: string, ...params: string[]) {
  const prop = camelCase(name.replace(/^_/, ''))
  TelegramBot.prototype[prop] = async function (this: TelegramBot, ...args: any[]) {
    await this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
  }
  TelegramBot.prototype[prop + 'Async'] = async function (this: TelegramBot, ...args: any[]) {
    await this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
  }
}

function defineExtract(name: string, key: string, ...params: string[]) {
  const prop = camelCase(name.replace(/^_/, ''))
  TelegramBot.prototype[prop] = async function (this: TelegramBot, ...args: any[]) {
    const data = await this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
    return data[key]
  }
}

defineAsync('set_group_kick', 'group_id', 'user_id', 'reject_add_request')
defineAsync('set_group_ban', 'group_id', 'user_id', 'duration')
defineAsync('set_group_whole_ban', 'group_id', 'enable')
defineAsync('set_group_admin', 'group_id', 'user_id', 'enable')
defineAsync('set_group_anonymous', 'group_id', 'enable')
defineAsync('set_group_card', 'group_id', 'user_id', 'card')
defineAsync('set_group_leave', 'group_id', 'is_dismiss')
defineExtract('get_friend_list', '[]')
defineExtract('get_group_list', '[]')
defineSync('get_group_info', 'group_id', 'no_cache')
defineSync('get_group_member_info', 'group_id', 'user_id', 'no_cache')
defineSync('get_group_member_list', 'group_id')
defineSync('get_group_honor_info', 'group_id', 'type')
defineExtract('get_cookies', 'cookies', 'domain')
defineExtract('get_csrf_token', 'token')
defineSync('get_credentials', 'domain')
defineSync('get_record', 'file', 'out_format', 'full_path')
defineSync('get_image', 'file')
defineExtract('can_send_image', 'yes')
defineExtract('can_send_record', 'yes')
defineSync('get_version_info')
