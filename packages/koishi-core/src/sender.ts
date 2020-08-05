import { SenderInfo, StatusInfo, Session, AccountInfo, StrangerInfo, MessageType } from './session'
import { snakeCase, camelCase, Logger } from 'koishi-utils'
import { BotOptions } from './server'
import { App } from './app'

const logger = Logger.create('sender')

export class SenderError extends Error {
  constructor (args: Record<string, any>, url: string, retcode: number, selfId: number) {
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

export interface CQResponse {
  status: string
  retcode: number
  data: any
  echo?: number
}

interface MessageResponse {
  messageId: number
}

export interface CQSender extends BotOptions {}

export class CQSender {
  public version?: VersionInfo

  _get?: (action: string, params: Record<string, any>) => Promise<CQResponse>

  constructor (public app: App, public bot: BotOptions) {
    Object.assign(this, bot)
  }

  async get <T = any> (action: string, params: Record<string, any> = {}, silent = false): Promise<T> {
    logger.debug('[request] %s %o', action, params)
    const response = await this._get(action, snakeCase(params))
    logger.debug('[response] %o', response)
    const { data, retcode } = response
    if (retcode === 0 && !silent) {
      return camelCase(data)
    } else if (retcode < 0 && !silent) {
      throw new SenderError(params, action, retcode, this.bot.selfId)
    } else if (retcode > 1) {
      throw new SenderError(params, action, retcode, this.bot.selfId)
    }
  }

  async getAsync (action: string, params: Record<string, any> = {}): Promise<void> {
    await this.get(action + '_async', params)
  }

  createSession (messageType: MessageType, ctxType: 'group' | 'user', ctxId: number, message: string) {
    return new Session({
      message,
      messageType,
      postType: 'send',
      $app: this.app,
      selfId: this.bot.selfId,
      [ctxType + 'Id']: ctxId,
      time: Math.round(Date.now() / 1000),
    })
  }

  async sendMsg (type: MessageType, ctxId: number, message: string, autoEscape = false) {
    if (!message) return
    const ctxType = type === 'private' ? 'user' : type
    const session = this.createSession(type, ctxType, ctxId, message)
    if (this.app.bail(session, 'before-send', session)) return
    const { messageId } = await this.get<MessageResponse>('send_msg', { [ctxType + 'Id']: ctxId, message, autoEscape })
    session.messageId = messageId
    this.app.emit(session, 'send', session)
    return messageId
  }

  async sendMsgAsync (type: MessageType, ctxId: number, message: string, autoEscape = false) {
    if (!message) return
    const ctxType = type === 'private' ? 'user' : type
    const session = this.createSession(type, ctxType, ctxId, message)
    if (this.app.bail(session, 'before-send', session)) return
    return this.getAsync('send_msg', { [ctxType + 'Id']: ctxId, message, autoEscape })
  }

  async sendGroupMsg (groupId: number, message: string, autoEscape = false) {
    if (!message) return
    const session = this.createSession('group', 'group', groupId, message)
    if (this.app.bail(session, 'before-send', session)) return
    const { messageId } = await this.get<MessageResponse>('send_group_msg', { groupId, message, autoEscape })
    session.messageId = messageId
    this.app.emit(session, 'send', session)
    return messageId
  }

  async sendGroupMsgAsync (groupId: number, message: string, autoEscape = false) {
    if (!message) return
    const session = this.createSession('group', 'group', groupId, message)
    if (this.app.bail(session, 'before-send', session)) return
    return this.getAsync('send_group_msg', { groupId, message, autoEscape })
  }

  async sendPrivateMsg (userId: number, message: string, autoEscape = false) {
    if (!message) return
    const session = this.createSession('private', 'user', userId, message)
    if (this.app.bail(session, 'before-send', session)) return
    const { messageId } = await this.get<MessageResponse>('send_private_msg', { userId, message, autoEscape })
    session.messageId = messageId
    this.app.emit(session, 'send', session)
    return messageId
  }

  async sendPrivateMsgAsync (userId: number, message: string, autoEscape = false) {
    if (!message) return
    const session = this.createSession('private', 'user', userId, message)
    if (this.app.bail(session, 'before-send', session)) return
    return this.getAsync('send_private_msg', { userId, message, autoEscape })
  }

  setGroupAnonymousBan (groupId: number, anonymous: object, duration?: number): Promise<void>
  setGroupAnonymousBan (groupId: number, flag: string, duration?: number): Promise<void>
  async setGroupAnonymousBan (groupId: number, meta: object | string, duration?: number) {
    const args = { groupId, duration } as any
    args[typeof meta === 'string' ? 'flag' : 'anonymous'] = meta
    await this.get('set_group_anonymous_ban', args)
  }

  setGroupAnonymousBanAsync (groupId: number, anonymous: object, duration?: number): Promise<void>
  setGroupAnonymousBanAsync (groupId: number, flag: string, duration?: number): Promise<void>
  async setGroupAnonymousBanAsync (groupId: number, meta: object | string, duration?: number) {
    const args = { groupId, duration } as any
    args[typeof meta === 'string' ? 'flag' : 'anonymous'] = meta
    return this.getAsync('set_group_anonymous_ban', args)
  }

  setFriendAddRequest (flag: string, approve?: boolean): Promise<void>
  setFriendAddRequest (flag: string, remark?: string): Promise<void>
  async setFriendAddRequest (flag: string, info: string | boolean = true) {
    if (typeof info === 'string') {
      await this.get('set_friend_add_request', { flag, approve: true, remark: info })
    } else {
      await this.get('set_friend_add_request', { flag, approve: info })
    }
  }

  setFriendAddRequestAsync (flag: string, approve?: boolean): Promise<void>
  setFriendAddRequestAsync (flag: string, remark?: string): Promise<void>
  async setFriendAddRequestAsync (flag: string, info: string | boolean = true) {
    if (typeof info === 'string') {
      return this.getAsync('set_friend_add_request', { flag, approve: true, remark: info })
    } else {
      return this.getAsync('set_friend_add_request', { flag, approve: info })
    }
  }

  setGroupAddRequest (flag: string, subType: 'add' | 'invite', approve?: boolean): Promise<void>
  setGroupAddRequest (flag: string, subType: 'add' | 'invite', reason?: string): Promise<void>
  async setGroupAddRequest (flag: string, subType: 'add' | 'invite', info: string | boolean = true) {
    if (typeof info === 'string') {
      await this.get('set_group_add_request', { flag, subType, approve: false, reason: info })
    } else {
      await this.get('set_group_add_request', { flag, subType, approve: info })
    }
  }

  setGroupAddRequestAsync (flag: string, subType: 'add' | 'invite', approve?: boolean): Promise<void>
  setGroupAddRequestAsync (flag: string, subType: 'add' | 'invite', reason?: string): Promise<void>
  async setGroupAddRequestAsync (flag: string, subType: 'add' | 'invite', info: string | boolean = true) {
    if (typeof info === 'string') {
      return this.getAsync('set_group_add_request', { flag, subType, approve: false, reason: info })
    } else {
      return this.getAsync('set_group_add_request', { flag, subType, approve: info })
    }
  }
}

function defineSync (name: string, ...params: string[]) {
  const prop = camelCase(name.replace(/^_/, ''))
  CQSender.prototype[prop] = function (this: CQSender, ...args: any[]) {
    return this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
  }
}

function defineAsync (name: string, ...params: string[]) {
  const prop = camelCase(name.replace(/^_/, ''))
  CQSender.prototype[prop] = async function (this: CQSender, ...args: any[]) {
    await this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
  }
  CQSender.prototype[prop + 'Async'] = async function (this: CQSender, ...args: any[]) {
    await this.getAsync(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
  }
}

function defineExtract (name: string, key: string, ...params: string[]) {
  const prop = camelCase(name.replace(/^_/, ''))
  CQSender.prototype[prop] = async function (this: CQSender, ...args: any[]) {
    const data = await this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
    return data[key]
  }
}

export type RecordFormat = 'mp3' | 'amr' | 'wma' | 'm4a' | 'spx' | 'ogg' | 'wav' | 'flac'
export type DataDirectory = 'image' | 'record' | 'show' | 'bface'

export interface FriendInfo extends AccountInfo {
  remark: string
}

export interface ListedGroupInfo {
  groupId: number
  groupName: string
}

export interface GroupInfo extends ListedGroupInfo {
  memberCount: number
  maxMemberCount: number
}

export interface GroupMemberInfo extends SenderInfo {
  cardChangeable: boolean
  groupId: number
  joinTime: number
  lastSentTime: number
  titleExpireTime: number
  unfriendly: boolean
}

export interface Credentials {
  cookies: string
  csrfToken: number
}

export interface ImageInfo {
  file: string
}

export interface RecordInfo {
  file: string
}

export interface VersionInfo {
  coolqDirectory: string
  coolqEdition: 'air' | 'pro'
  pluginVersion: string
  pluginBuildNumber: number
  pluginBuildConfiguration: 'debug' | 'release'
}

export interface CQSender {
  deleteMsg (messageId: number): Promise<void>
  deleteMsgAsync (messageId: number): Promise<void>
  sendLike (userId: number, times?: number): Promise<void>
  sendLikeAsync (userId: number, times?: number): Promise<void>
  setGroupKick (groupId: number, userId: number, rejectAddRequest?: boolean): Promise<void>
  setGroupKickAsync (groupId: number, userId: number, rejectAddRequest?: boolean): Promise<void>
  setGroupBan (groupId: number, userId: number, duration?: number): Promise<void>
  setGroupBanAsync (groupId: number, userId: number, duration?: number): Promise<void>
  setGroupWholeBan (groupId: number, enable?: boolean): Promise<void>
  setGroupWholeBanAsync (groupId: number, enable?: boolean): Promise<void>
  setGroupAdmin (groupId: number, userId: number, enable?: boolean): Promise<void>
  setGroupAdminAsync (groupId: number, userId: number, enable?: boolean): Promise<void>
  setGroupAnonymous (groupId: number, enable?: boolean): Promise<void>
  setGroupAnonymousAsync (groupId: number, enable?: boolean): Promise<void>
  setGroupCard (groupId: number, userId: number, card?: string): Promise<void>
  setGroupCardAsync (groupId: number, userId: number, card?: string): Promise<void>
  setGroupLeave (groupId: number, isDismiss?: boolean): Promise<void>
  setGroupLeaveAsync (groupId: number, isDismiss?: boolean): Promise<void>
  setGroupSpecialTitle (groupId: number, userId: number, specialTitle?: string, duration?: number): Promise<void>
  setGroupSpecialTitleAsync (groupId: number, userId: number, specialTitle?: string, duration?: number): Promise<void>
  getLoginInfo (): Promise<AccountInfo>
  getStrangerInfo (userId: number, noCache?: boolean): Promise<StrangerInfo>
  getFriendList (): Promise<FriendInfo[]>
  getGroupList (): Promise<ListedGroupInfo[]>
  getGroupInfo (groupId: number, noCache?: boolean): Promise<GroupInfo>
  getGroupMemberInfo (groupId: number, userId: number, noCache?: boolean): Promise<GroupMemberInfo>
  getGroupMemberList (groupId: number): Promise<GroupMemberInfo[]>
  getCookies (domain?: string): Promise<string>
  getCsrfToken (): Promise<number>
  getCredentials (domain?: string): Promise<Credentials>
  getRecord (file: string, outFormat: RecordFormat, fullPath?: boolean): Promise<RecordInfo>
  getImage (file: string): Promise<ImageInfo>
  canSendImage (): Promise<boolean>
  canSendRecord (): Promise<boolean>
  getStatus (): Promise<StatusInfo>
  getVersionInfo (): Promise<VersionInfo>
  setRestartPlugin (delay?: number): Promise<void>
  cleanDataDir (dataDir: DataDirectory): Promise<void>
  cleanDataDirAsync (dataDir: DataDirectory): Promise<void>
  cleanPluginLog (): Promise<void>
  cleanPluginLogAsync (): Promise<void>
}

defineAsync('delete_msg', 'message_id')
defineAsync('send_like', 'user_id', 'times')
defineAsync('set_group_kick', 'group_id', 'user_id', 'reject_add_request')
defineAsync('set_group_ban', 'group_id', 'user_id', 'duration')
defineAsync('set_group_whole_ban', 'group_id', 'enable')
defineAsync('set_group_admin', 'group_id', 'user_id', 'enable')
defineAsync('set_group_anonymous', 'group_id', 'enable')
defineAsync('set_group_card', 'group_id', 'user_id', 'card')
defineAsync('set_group_leave', 'group_id', 'is_dismiss')
defineAsync('set_group_special_title', 'group_id', 'user_id', 'special_title', 'duration')
defineSync('get_login_info')
defineSync('get_stranger_info', 'user_id', 'no_cache')
defineSync('get_friend_list')
defineSync('get_group_list')
defineSync('get_group_info', 'group_id', 'no_cache')
defineSync('get_group_member_info', 'group_id', 'user_id', 'no_cache')
defineSync('get_group_member_list', 'group_id')
defineExtract('get_cookies', 'cookies', 'domain')
defineExtract('get_csrf_token', 'token')
defineSync('get_credentials', 'domain')
defineSync('get_record', 'file', 'out_format', 'full_path')
defineSync('get_image', 'file')
defineExtract('can_send_image', 'yes')
defineExtract('can_send_record', 'yes')
defineSync('get_status')
defineSync('get_version_info')
defineSync('set_restart_plugin', 'delay')
defineAsync('clean_data_dir', 'data_dir')
defineAsync('clean_plugin_log', 'group_id', 'name')

// experimental api

export interface VipInfo extends AccountInfo {
  level: number
  levelSpeed: number
  vipLevel: number
  vipGrowthSpeed: number
  vipGrowthTotal: string
}

export interface GroupNotice {
  cn: number
  fid: string
  fn: number
  msg: {
    text: string
    textFace: string
    title: string
  }
  pubt: number
  readNum: number
  settings: {
    isShowEditCard: number
    remindTs: number
  }
  u: number
  vn: number
}

export interface CQSender {
  getVipInfo (): Promise<VipInfo>
  getGroupNotice (groupId: number): Promise<GroupNotice[]>
  sendGroupNotice (groupId: number, title: string, content: string): Promise<void>
  sendGroupNoticeAsync (groupId: number, title: string, content: string): Promise<void>
  setRestart (cleanLog?: boolean, cleanCache?: boolean, cleanEvent?: boolean): Promise<void>
}

defineSync('_get_vip_info')
defineSync('_get_group_notice', 'group_id')
defineAsync('_send_group_notice', 'group_id', 'title', 'content')
defineSync('_set_restart', 'clean_log', 'clean_cache', 'clean_event')

// go-cqhttp extension

export interface ImageInfo {
  size?: number
  filename?: string
  url?: string
}

export interface VersionInfo {
  goCqhttp?: boolean
  runtimeVersion?: string
  runtimeOs?: string
}

export interface GroupMessage {
  messageId: number
  realId: number
  sender: AccountInfo
  time: number
  content: string
}

export interface ForwardMessage {
  messages: {
    sender: AccountInfo
    time: number
    content: string
  }[]
}

interface CQNode {
  type: 'node'
  data: {
    id: number
  } | {
    name: string
    uin: number
    content: string
  }
}

export interface CQSender {
  setGroupName (groupId: number, name: string): Promise<void>
  setGroupNameAsync (groupId: number, name: string): Promise<void>
  getGroupMsg (messageId: number): Promise<GroupMessage>
  getForwardMsg (messageId: number): Promise<ForwardMessage>
  sendGroupForwardMsg (groupId: number, messages: CQNode[]): Promise<void>
  sendGroupForwardMsgAsync (groupId: number, messages: CQNode[]): Promise<void>
}

defineAsync('set_group_name', 'group_id', 'name')
