import { camelCase, Logger, snakeCase, capitalize } from 'koishi-utils'
import { Bot, AccountInfo, SenderInfo, StatusInfo, StrangerInfo, BotStatus } from 'koishi-core'

const logger = Logger.create('bot')

export class SenderError extends Error {
  constructor(args: Record<string, any>, url: string, retcode: number, selfId: number) {
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

declare module 'koishi-core/dist/server' {
  interface Bot {
    _request?(action: string, params: Record<string, any>): Promise<CQResponse>
    get<T = any>(action: string, params?: Record<string, any>, silent?: boolean): Promise<T>
    getAsync(action: string, params?: Record<string, any>): Promise<void>
    sendGroupMsgAsync(groupId: number, message: string, autoEscape?: boolean): Promise<void>
    sendPrivateMsgAsync(userId: number, message: string, autoEscape?: boolean): Promise<void>
    setGroupAnonymousBan(groupId: number, anonymous: object, duration?: number): Promise<void>
    setGroupAnonymousBan(groupId: number, flag: string, duration?: number): Promise<void>
    setGroupAnonymousBanAsync(groupId: number, anonymous: object, duration?: number): Promise<void>
    setGroupAnonymousBanAsync(groupId: number, flag: string, duration?: number): Promise<void>
    setFriendAddRequest(flag: string, approve?: boolean): Promise<void>
    setFriendAddRequest(flag: string, remark?: string): Promise<void>
    setFriendAddRequestAsync(flag: string, approve?: boolean): Promise<void>
    setFriendAddRequestAsync(flag: string, remark?: string): Promise<void>
    setGroupAddRequest(flag: string, subType: 'add' | 'invite', approve?: boolean): Promise<void>
    setGroupAddRequest(flag: string, subType: 'add' | 'invite', reason?: string): Promise<void>
    setGroupAddRequestAsync(flag: string, subType: 'add' | 'invite', approve?: boolean): Promise<void>
    setGroupAddRequestAsync(flag: string, subType: 'add' | 'invite', reason?: string): Promise<void>
    deleteMsg(messageId: number): Promise<void>
    deleteMsgAsync(messageId: number): Promise<void>
    sendLike(userId: number, times?: number): Promise<void>
    sendLikeAsync(userId: number, times?: number): Promise<void>
    setGroupKick(groupId: number, userId: number, rejectAddRequest?: boolean): Promise<void>
    setGroupKickAsync(groupId: number, userId: number, rejectAddRequest?: boolean): Promise<void>
    setGroupBan(groupId: number, userId: number, duration?: number): Promise<void>
    setGroupBanAsync(groupId: number, userId: number, duration?: number): Promise<void>
    setGroupWholeBan(groupId: number, enable?: boolean): Promise<void>
    setGroupWholeBanAsync(groupId: number, enable?: boolean): Promise<void>
    setGroupAdmin(groupId: number, userId: number, enable?: boolean): Promise<void>
    setGroupAdminAsync(groupId: number, userId: number, enable?: boolean): Promise<void>
    setGroupAnonymous(groupId: number, enable?: boolean): Promise<void>
    setGroupAnonymousAsync(groupId: number, enable?: boolean): Promise<void>
    setGroupCard(groupId: number, userId: number, card?: string): Promise<void>
    setGroupCardAsync(groupId: number, userId: number, card?: string): Promise<void>
    setGroupLeave(groupId: number, isDismiss?: boolean): Promise<void>
    setGroupLeaveAsync(groupId: number, isDismiss?: boolean): Promise<void>
    setGroupSpecialTitle(groupId: number, userId: number, specialTitle?: string, duration?: number): Promise<void>
    setGroupSpecialTitleAsync(groupId: number, userId: number, specialTitle?: string, duration?: number): Promise<void>
    getLoginInfo(): Promise<AccountInfo>
    getStrangerInfo(userId: number, noCache?: boolean): Promise<StrangerInfo>
    getFriendList(): Promise<FriendInfo[]>
    getGroupList(): Promise<ListedGroupInfo[]>
    getGroupInfo(groupId: number, noCache?: boolean): Promise<GroupInfo>
    getGroupMemberInfo(groupId: number, userId: number, noCache?: boolean): Promise<GroupMemberInfo>
    getGroupMemberList(groupId: number): Promise<GroupMemberInfo[]>
    getCookies(domain?: string): Promise<string>
    getCsrfToken(): Promise<number>
    getCredentials(domain?: string): Promise<Credentials>
    getRecord(file: string, outFormat: RecordFormat, fullPath?: boolean): Promise<RecordInfo>
    getImage(file: string): Promise<ImageInfo>
    canSendImage(): Promise<boolean>
    canSendRecord(): Promise<boolean>
    getVersionInfo(): Promise<VersionInfo>
    setRestartPlugin(delay?: number): Promise<void>
    cleanDataDir(dataDir: DataDirectory): Promise<void>
    cleanDataDirAsync(dataDir: DataDirectory): Promise<void>
    cleanPluginLog(): Promise<void>
    cleanPluginLogAsync(): Promise<void>
    getVipInfo(): Promise<VipInfo>
    getGroupNotice(groupId: number): Promise<GroupNotice[]>
    sendGroupNotice(groupId: number, title: string, content: string): Promise<void>
    sendGroupNoticeAsync(groupId: number, title: string, content: string): Promise<void>
    setRestart(cleanLog?: boolean, cleanCache?: boolean, cleanEvent?: boolean): Promise<void>
    setGroupName(groupId: number, name: string): Promise<void>
    setGroupNameAsync(groupId: number, name: string): Promise<void>
    getGroupMsg(messageId: number): Promise<GroupMessage>
    getForwardMsg(messageId: number): Promise<ForwardMessage>
    sendGroupForwardMsg(groupId: number, messages: readonly CQNode[]): Promise<void>
    sendGroupForwardMsgAsync(groupId: number, messages: readonly CQNode[]): Promise<void>
  }
}

Bot.prototype.get = async function (this: Bot, action, params = {}, silent = false) {
  logger.debug('[request] %s %o', action, params)
  const response = await this._request(action, snakeCase(params))
  logger.debug('[response] %o', response)
  const { data, retcode } = response
  if (retcode === 0 && !silent) {
    return camelCase(data)
  } else if (retcode < 0 && !silent) {
    throw new SenderError(params, action, retcode, this.selfId)
  } else if (retcode > 1) {
    throw new SenderError(params, action, retcode, this.selfId)
  }
}

Bot.prototype.getAsync = async function (this: Bot, action, params = {}) {
  await this.get(action + '_async', params)
}

Bot.prototype.sendGroupMsg = async function (this: Bot, groupId, message, autoEscape = false) {
  if (!message) return
  const session = this.createSession('group', 'group', groupId, message)
  if (this.app.bail(session, 'before-send', session)) return
  const { messageId } = await this.get<MessageResponse>('send_group_msg', { groupId, message, autoEscape })
  session.messageId = messageId
  this.app.emit(session, 'send', session)
  return messageId
}

Bot.prototype.sendGroupMsgAsync = function (this: Bot, groupId, message, autoEscape = false) {
  if (!message) return
  const session = this.createSession('group', 'group', groupId, message)
  if (this.app.bail(session, 'before-send', session)) return
  return this.getAsync('send_group_msg', { groupId, message, autoEscape })
}

Bot.prototype.sendPrivateMsg = async function (this: Bot, userId, message, autoEscape = false) {
  if (!message) return
  const session = this.createSession('private', 'user', userId, message)
  if (this.app.bail(session, 'before-send', session)) return
  const { messageId } = await this.get<MessageResponse>('send_private_msg', { userId, message, autoEscape })
  session.messageId = messageId
  this.app.emit(session, 'send', session)
  return messageId
}

Bot.prototype.sendPrivateMsgAsync = function (this: Bot, userId, message, autoEscape = false) {
  if (!message) return
  const session = this.createSession('private', 'user', userId, message)
  if (this.app.bail(session, 'before-send', session)) return
  return this.getAsync('send_private_msg', { userId, message, autoEscape })
}

Bot.prototype.setGroupAnonymousBan = async function (this: Bot, groupId: number, meta: object | string, duration?: number) {
  const args = { groupId, duration } as any
  args[typeof meta === 'string' ? 'flag' : 'anonymous'] = meta
  await this.get('set_group_anonymous_ban', args)
}

Bot.prototype.setGroupAnonymousBanAsync = function (this: Bot, groupId: number, meta: object | string, duration?: number) {
  const args = { groupId, duration } as any
  args[typeof meta === 'string' ? 'flag' : 'anonymous'] = meta
  return this.getAsync('set_group_anonymous_ban', args)
}

Bot.prototype.setFriendAddRequest = async function (this: Bot, flag: string, info: string | boolean = true) {
  if (typeof info === 'string') {
    await this.get('set_friend_add_request', { flag, approve: true, remark: info })
  } else {
    await this.get('set_friend_add_request', { flag, approve: info })
  }
}

Bot.prototype.setFriendAddRequestAsync = function (this: Bot, flag: string, info: string | boolean = true) {
  if (typeof info === 'string') {
    return this.getAsync('set_friend_add_request', { flag, approve: true, remark: info })
  } else {
    return this.getAsync('set_friend_add_request', { flag, approve: info })
  }
}

Bot.prototype.setGroupAddRequest = async function (this: Bot, flag: string, subType: 'add' | 'invite', info: string | boolean = true) {
  if (typeof info === 'string') {
    await this.get('set_group_add_request', { flag, subType, approve: false, reason: info })
  } else {
    await this.get('set_group_add_request', { flag, subType, approve: info })
  }
}

Bot.prototype.setGroupAddRequestAsync = function (this: Bot, flag: string, subType: 'add' | 'invite', info: string | boolean = true) {
  if (typeof info === 'string') {
    return this.getAsync('set_group_add_request', { flag, subType, approve: false, reason: info })
  } else {
    return this.getAsync('set_group_add_request', { flag, subType, approve: info })
  }
}

Bot.prototype.getSelfId = async function getSelfId(this: Bot) {
  const { userId } = await this.getLoginInfo()
  return userId
}

Bot.prototype.getStatus = async function getStatus(this: Bot) {
  if (!this.ready) return BotStatus.BOT_IDLE
  try {
    const data = await this.get<StatusInfo>('get_status')
    return data.good ? BotStatus.GOOD : data.online ? BotStatus.SERVER_ERROR : BotStatus.BOT_OFFLINE
  } catch {
    return BotStatus.NET_ERROR
  }
}

Bot.prototype.getMemberMap = async function (this: Bot, groupId: number) {
  const list = await this.getGroupMemberList(groupId)
  return Object.fromEntries(list.map(info => [info.userId, info.card || info.nickname]))
}

function defineSync(name: string, ...params: string[]) {
  const prop = camelCase(name.replace(/^_/, ''))
  Bot.prototype[prop] = function (this: Bot, ...args: any[]) {
    return this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
  }
}

function defineAsync(name: string, ...params: string[]) {
  const prop = camelCase(name.replace(/^_/, ''))
  Bot.prototype[prop] = async function (this: Bot, ...args: any[]) {
    await this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
  }
  Bot.prototype[prop + 'Async'] = async function (this: Bot, ...args: any[]) {
    await this.getAsync(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
  }
}

function defineExtract(name: string, key: string, ...params: string[]) {
  const prop = camelCase(name.replace(/^_/, ''))
  Bot.prototype[prop] = async function (this: Bot, ...args: any[]) {
    const data = await this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
    return data[key]
  }
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

defineAsync('set_group_name', 'group_id', 'name')

export function toVersion(data: VersionInfo) {
  const { coolqEdition, pluginVersion, goCqhttp } = data
  if (goCqhttp) {
    return `Go-CQHTTP`
  } else {
    return `CoolQ/${capitalize(coolqEdition)} CQHTTP/${pluginVersion}`
  }
}
