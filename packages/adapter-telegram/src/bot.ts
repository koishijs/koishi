import { camelCase, Logger, snakeCase, renameProperty, CQCode } from 'koishi-utils'
import { Bot, AccountInfo, StrangerInfo, BotStatusCode, Session, MessageInfo, GroupInfo, GroupMemberInfo, UserInfo, AuthorInfo, User } from 'koishi-core'
import Telegram from './interface'

declare module 'koishi-core/dist/server' {
  namespace Bot {
    interface Platforms {
      telegram: TelegramBot
    }
  }
}

const logger = new Logger('bot')

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
export interface CQMessageInfo extends MessageInfo {
  realId: number
}
export interface CQGroupInfo extends GroupInfo {
  memberCount: number
  maxMemberCount: number
}
export interface CQUserInfo extends UserInfo {
  sex?: 'male' | 'female' | 'unknown'
  age?: number
}
export interface CQGroupMemberInfo extends GroupMemberInfo, CQUserInfo {
  cardChangeable: boolean
  groupId: number
  joinTime: number
  lastSentTime: number
  titleExpireTime: number
  unfriendly: boolean
}
export interface TelegramResponse {
  ok: boolean
  result: any
}
interface MessageResponse {
  messageId: string
}
export type RecordFormat = 'mp3' | 'amr' | 'wma' | 'm4a' | 'spx' | 'ogg' | 'wav' | 'flac'
export type DataDirectory = 'image' | 'record' | 'show' | 'bface'
export interface FriendInfo extends AccountInfo {
  remark: string
}
export interface ImageInfo {
  file: string
}
export interface RecordInfo {
  file: string
}

export interface TelegramBot {
  _request?(action: string, params: Record<string, any>): Promise<TelegramResponse>
  setGroupKick(groupId: string, userId: string, rejectAddRequest?: boolean): Promise<void>
  setGroupKickAsync(groupId: string, userId: string, rejectAddRequest?: boolean): Promise<void>
  setGroupBan(groupId: string, userId: string, duration?: number): Promise<void>
  setGroupBanAsync(groupId: string, userId: string, duration?: number): Promise<void>
  setGroupLeave(groupId: string, isDismiss?: boolean): Promise<void>
  setGroupLeaveAsync(groupId: string, isDismiss?: boolean): Promise<void>
  getLoginInfo(): Promise<AccountInfo>
  getStrangerInfo(userId: string, noCache?: boolean): Promise<StrangerInfo>
  getFriendList(): Promise<FriendInfo[]>
  getRecord(file: string, outFormat: RecordFormat, fullPath?: boolean): Promise<RecordInfo>
  getImage(file: string): Promise<ImageInfo>
  canSendImage(): Promise<boolean>
  canSendRecord(): Promise<boolean>
  setGroupName(groupId: string, name: string): Promise<void>
  setGroupNameAsync(groupId: string, name: string): Promise<void>
  setGroupPortrait(groupId: string, file: string, cache?: boolean): Promise<void>
  setGroupPortraitAsync(groupId: string, file: string, cache?: boolean): Promise<void>
  getGroupMsg(messageId: string): Promise<GroupMessage>
}

export class TelegramBot extends Bot {
  async [Bot.send](meta: Session, content: string) {
    if (!content) return
    return meta.channelId.startsWith('private:')
      ? this.sendPrivateMessage(meta.channelId.slice(8), content) as any
      : this.sendGroupMessage(meta.channelId, content) as any
  }

  async get<T = any>(action: string, params = {}, silent = false): Promise<T> {
    logger.info('[request] %s %o', action, params)
    const response = await this._request(action, snakeCase(params))
    logger.info('[response] %o', response)
    const { ok, result } = response
    if (ok && !silent) return camelCase(result)
    throw new SenderError(params, action, -1, this.selfId)
  }

  async _sendMsg(chatId: string, message: string) {
    if (!message) return
    return await this.get<MessageResponse>('sendMessage', { chatId, text: message })
  }

  async _sendPhoto(chatId: string, caption: string, photo: string) {
    if (!photo) return
    return await this.get<MessageResponse>('sendPhoto', { chatId, caption, photo })
  };

  sendMessage(channelId: string, content: string) {
    return channelId.startsWith('private:')
      ? this.sendPrivateMessage(channelId.slice(8), content)
      : this.sendGroupMessage(channelId, content)
  }

  async getMessage() {
    return null
  }

  async deleteMessage(channelId: string, messageId: string) {
    const chatId = channelId.startsWith('private:') ? channelId.split(':')[1] : channelId
    await this.get('deleteMessage', { chatId, messageId })
  }

  static adaptGroup(data: Telegram.Chat & GroupInfo): GroupInfo {
    renameProperty(data, 'groupId', 'id')
    renameProperty(data, 'name', 'title')
    return data
  }

  async getGroup(chatId: string): Promise<GroupInfo> {
    const data = await this.get('getChat', { chatId })
    return TelegramBot.adaptGroup(data)
  }

  async getGroupList(): Promise<CQGroupInfo[]> {
    return []
  }

  static adaptUser(data: Telegram.User & UserInfo): UserInfo {
    data.userId = data.id.toString()
    data.name = data.username || (data.first_name + (data.last_name || ''))
    return data
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

  async sendMsg(chatId: string, message: string) {
    const chain = CQCode.parseAll(message)
    const payload = { chatId, message: '', image: '' }
    let result
    for (const node of chain) {
      if (typeof node === 'string') {
        payload.message += node
      } else if (node.type === 'image') {
        if (payload.image) {
          result = await this._sendPhoto(chatId, payload.message, payload.image)
          payload.message = ''
          payload.image = ''
        }
        payload.image = node.data.url
      }
    }
    if (payload.image) {
      result = await this._sendPhoto(chatId, payload.message, payload.image)
      payload.message = ''
      payload.image = ''
    } else if (payload.message) {
      result = await this._sendMsg(chatId, payload.message)
    }
    return result.messageId
  }

  async sendPrivateMessage(userId: string, message: string) {
    if (!message) return
    const session = this.createSession('private', 'user', userId, message)
    if (this.app.bail(session, 'before-send', session)) return
    session.messageId = await this.sendMsg(userId, session.content)
    this.app.emit(session, 'send', session)
    return session.messageId
  }

  async sendGroupMessage(chatId: string, message: string) {
    if (!message) return
    const session = this.createSession('group', 'group', chatId, message)
    if (this.app.bail(session, 'before-send', session)) return
    session.messageId = await this.sendMsg(chatId, session.content)
    this.app.emit(session, 'send', session)
    return session.messageId
  }

  setGroupLeave(chatId: string) {
    return this.get('leave_chat', { chatId })
  };

  async getLoginInfo() {
    let data: any = await this.get('getMe')
    console.log(data)
    data = TelegramBot.adaptUser(data)
    console.log(data)
    data.nickname = data.name
    return data
  }

  async getSelfId() {
    const { userId } = await this.getLoginInfo()
    return userId
  }

  async getStatusCode() {
    if (!this.ready) return BotStatusCode.BOT_IDLE
    try {
      await this.get('getMe')
      return BotStatusCode.GOOD
    } catch {
      return BotStatusCode.NET_ERROR
    }
  };
}

function defineSync(name: string, ...params: string[]) {
  const prop = camelCase(name.replace(/^_/, ''))
  TelegramBot.prototype[prop] = function (this: TelegramBot, ...args: any[]) {
    return this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
  }
}

function defineRenameSync(name: string, send: string, ...params: string[]) {
  const prop = camelCase(name.replace(/^_/, ''))
  TelegramBot.prototype[prop] = function (this: TelegramBot, ...args: any[]) {
    return this.get(send, Object.fromEntries(params.map((name, index) => [name, args[index]])))
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

// go-cqhttp extension

export interface ImageInfo {
  size?: number
  filename?: string
  url?: string
}

export interface GroupMessage {
  messageId: number
  realId: number
  sender: AccountInfo
  time: number
  content: string
}
