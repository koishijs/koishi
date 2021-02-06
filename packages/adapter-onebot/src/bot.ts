import { camelCase, Logger, snakeCase, capitalize, renameProperty } from 'koishi-utils'
import { Bot, AccountInfo, StatusInfo, StrangerInfo, BotStatusCode, Session, MessageInfo, GroupInfo, GroupMemberInfo, UserInfo, AuthorInfo } from 'koishi-core'

declare module 'koishi-core/dist/server' {
  namespace Bot {
    interface Platforms {
      onebot: CQBot
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

export interface CQAuthorInfo extends AuthorInfo, CQUserInfo {
  area?: string
  level?: string
  title?: string
}

export interface CQResponse {
  status: string
  retcode: number
  data: any
  echo?: number
}

interface MessageResponse {
  messageId: string
}

export type RecordFormat = 'mp3' | 'amr' | 'wma' | 'm4a' | 'spx' | 'ogg' | 'wav' | 'flac'
export type DataDirectory = 'image' | 'record' | 'show' | 'bface'

export interface FriendInfo extends AccountInfo {
  remark: string
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

export type HonorType = 'talkative' | 'performer' | 'legend' | 'strong_newbie' | 'emotion'

export interface TalkativeMemberInfo extends AccountInfo {
  avatar: string
  dayCount: number
}

export interface HonoredMemberInfo {
  avatar: string
  description: string
}

export interface HonorInfo {
  currentTalkative: TalkativeMemberInfo
  talkativeList: HonoredMemberInfo[]
  performerList: HonoredMemberInfo[]
  legendList: HonoredMemberInfo[]
  strongNewbieList: HonoredMemberInfo[]
  emotionList: HonoredMemberInfo[]
}

export interface CQBot {
  _request?(action: string, params: Record<string, any>): Promise<CQResponse>
  sendLike(userId: string, times?: number): Promise<void>
  sendLikeAsync(userId: string, times?: number): Promise<void>
  setGroupKick(groupId: string, userId: string, rejectAddRequest?: boolean): Promise<void>
  setGroupKickAsync(groupId: string, userId: string, rejectAddRequest?: boolean): Promise<void>
  setGroupBan(groupId: string, userId: string, duration?: number): Promise<void>
  setGroupBanAsync(groupId: string, userId: string, duration?: number): Promise<void>
  setGroupWholeBan(groupId: string, enable?: boolean): Promise<void>
  setGroupWholeBanAsync(groupId: string, enable?: boolean): Promise<void>
  setGroupAdmin(groupId: string, userId: string, enable?: boolean): Promise<void>
  setGroupAdminAsync(groupId: string, userId: string, enable?: boolean): Promise<void>
  setGroupAnonymous(groupId: string, enable?: boolean): Promise<void>
  setGroupAnonymousAsync(groupId: string, enable?: boolean): Promise<void>
  setGroupCard(groupId: string, userId: string, card?: string): Promise<void>
  setGroupCardAsync(groupId: string, userId: string, card?: string): Promise<void>
  setGroupLeave(groupId: string, isDismiss?: boolean): Promise<void>
  setGroupLeaveAsync(groupId: string, isDismiss?: boolean): Promise<void>
  setGroupSpecialTitle(groupId: string, userId: string, specialTitle?: string, duration?: number): Promise<void>
  setGroupSpecialTitleAsync(groupId: string, userId: string, specialTitle?: string, duration?: number): Promise<void>
  getLoginInfo(): Promise<AccountInfo>
  getStrangerInfo(userId: string, noCache?: boolean): Promise<StrangerInfo>
  getFriendList(): Promise<FriendInfo[]>
  getGroupHonorInfo(groupId: string, type: HonorType): Promise<HonorInfo>
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
  getGroupNotice(groupId: string): Promise<GroupNotice[]>
  sendGroupNotice(groupId: string, title: string, content: string): Promise<void>
  sendGroupNoticeAsync(groupId: string, title: string, content: string): Promise<void>
  setRestart(cleanLog?: boolean, cleanCache?: boolean, cleanEvent?: boolean): Promise<void>
  setGroupName(groupId: string, name: string): Promise<void>
  setGroupNameAsync(groupId: string, name: string): Promise<void>
  setGroupPortrait(groupId: string, file: string, cache?: boolean): Promise<void>
  setGroupPortraitAsync(groupId: string, file: string, cache?: boolean): Promise<void>
  getGroupMsg(messageId: string): Promise<GroupMessage>
  getForwardMsg(messageId: string): Promise<ForwardMessage>
  sendGroupForwardMsg(groupId: string, messages: readonly CQNode[]): Promise<void>
  sendGroupForwardMsgAsync(groupId: string, messages: readonly CQNode[]): Promise<void>
}

export class CQBot extends Bot {
  handleContent(content: string) {
    return content.replace(/\[CQ:at,type=all\]/g, '[CQ:at,qq=all]')
  }

  async [Bot.send](meta: Session, content: string, autoEscape = false) {
    if (!content) return
    content = this.handleContent(content)
    if (this.app.options.onebot?.preferSync) {
      await this.sendMessage(meta.channelId, content)
      return
    }

    let ctxId: string
    // eslint-disable-next-line no-cond-assign
    const ctxType = (ctxId = meta.groupId) ? 'group' : (ctxId = meta.userId) ? 'user' : null
    if (meta._response) {
      const session = this.createSession(meta.subtype as any, ctxType, ctxId, content)
      if (this.app.bail(session, 'before-send', session)) return
      return session._response({ reply: session.content, autoEscape, atSender: false })
    }

    return ctxType === 'group'
      ? this.sendGroupMessageAsync(ctxId, content, autoEscape)
      : this.sendPrivateMessageAsync(ctxId, content, autoEscape)
  }

  async get<T = any>(action: string, params = {}, silent = false): Promise<T> {
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

  async getAsync(action: string, params = {}) {
    await this.get(action + '_async', params)
  }

  sendMessage(channelId: string, content: string) {
    content = this.handleContent(content)
    return channelId.startsWith('private:')
      ? this.sendPrivateMessage(channelId.slice(8), content)
      : this.sendGroupMessage(channelId, content)
  }

  async getMessage(channelId: string, messageId: string) {
    const data = await this.get<CQMessageInfo>('get_msg', { messageId })
    CQBot.adaptMessage(data)
    return data
  }

  async deleteMessage(channelId: string, messageId: string) {
    await this.get('delete_msg', { messageId })
  }

  static adaptGroup(data: CQGroupInfo) {
    renameProperty(data, 'name', 'groupName')
  }

  async getGroup(groupId: string, noCache?: boolean): Promise<CQGroupInfo> {
    const data = await this.get('get_group_info', { groupId, noCache })
    CQBot.adaptGroup(data)
    return data
  }

  async getGroupList(): Promise<CQGroupInfo[]> {
    const data = await this.get('get_group_list')
    data.forEach(CQBot.adaptGroup)
    return data
  }

  static adaptUser(data: UserInfo) {
    renameProperty(data, 'username', 'nickname')
  }

  static adaptGroupMember(data: GroupMemberInfo) {
    CQBot.adaptUser(data)
    renameProperty(data, 'nickname', 'card')
  }

  static adaptAuthor(data: AuthorInfo) {
    CQBot.adaptGroupMember(data)
  }

  static adaptMessage(data: MessageInfo) {
    renameProperty(data, 'timestamp', 'time')
    renameProperty(data, 'content', 'message')
    renameProperty(data, 'author', 'sender')
    CQBot.adaptAuthor(data.author)
  }

  async getUser(userId: string, noCache?: boolean): Promise<CQUserInfo> {
    const data = await this.get('get_strange_info', { userId, noCache })
    CQBot.adaptUser(data)
    return data
  }

  async getGroupMember(groupId: string, userId: string, noCache?: boolean): Promise<GroupMemberInfo> {
    const data = await this.get('get_group_member_info', { groupId, userId, noCache })
    CQBot.adaptGroupMember(data)
    return data
  }

  async getGroupMemberList(groupId: string): Promise<GroupMemberInfo[]> {
    const data = await this.get('get_group_member_list', { groupId })
    data.forEach(CQBot.adaptGroupMember)
    return data
  }

  async sendGroupMessage(groupId: string, content: string, autoEscape = false) {
    if (!content) return
    const session = this.createSession('group', 'group', groupId, content)
    if (this.app.bail(session, 'before-send', session)) return
    const { messageId } = await this.get<MessageResponse>('send_group_msg', { groupId, message: session.content, autoEscape })
    session.messageId = messageId
    this.app.emit(session, 'send', session)
    return messageId
  }

  sendGroupMessageAsync(groupId: string, content: string, autoEscape = false) {
    if (!content) return
    const session = this.createSession('group', 'group', groupId, content)
    if (this.app.bail(session, 'before-send', session)) return
    return this.getAsync('send_group_msg', { groupId, message: session.content, autoEscape })
  }

  async sendPrivateMessage(userId: string, content: string, autoEscape = false) {
    if (!content) return
    const session = this.createSession('private', 'user', userId, content)
    if (this.app.bail(session, 'before-send', session)) return
    const { messageId } = await this.get<MessageResponse>('send_private_msg', { userId, message: session.content, autoEscape })
    session.messageId = messageId
    this.app.emit(session, 'send', session)
    return messageId
  }

  sendPrivateMessageAsync(userId: string, content: string, autoEscape = false) {
    if (!content) return
    const session = this.createSession('private', 'user', userId, content)
    if (this.app.bail(session, 'before-send', session)) return
    return this.getAsync('send_private_msg', { userId, message: session.content, autoEscape })
  }

  async setGroupAnonymousBan(groupId: string, meta: string | object, duration?: number) {
    const args = { groupId, duration } as any
    args[typeof meta === 'string' ? 'flag' : 'anonymous'] = meta
    await this.get('set_group_anonymous_ban', args)
  }

  setGroupAnonymousBanAsync(groupId: string, meta: string | object, duration?: number) {
    const args = { groupId, duration } as any
    args[typeof meta === 'string' ? 'flag' : 'anonymous'] = meta
    return this.getAsync('set_group_anonymous_ban', args)
  }

  setFriendAddRequest(flag: string, approve?: boolean): Promise<void>
  setFriendAddRequest(flag: string, remark?: string): Promise<void>
  async setFriendAddRequest(flag: string, info: string | boolean = true) {
    if (typeof info === 'string') {
      await this.get('set_friend_add_request', { flag, approve: true, remark: info })
    } else {
      await this.get('set_friend_add_request', { flag, approve: info })
    }
  }

  setFriendAddRequestAsync(flag: string, approve?: boolean): Promise<void>
  setFriendAddRequestAsync(flag: string, remark?: string): Promise<void>
  setFriendAddRequestAsync(flag: string, info: string | boolean = true) {
    if (typeof info === 'string') {
      return this.getAsync('set_friend_add_request', { flag, approve: true, remark: info })
    } else {
      return this.getAsync('set_friend_add_request', { flag, approve: info })
    }
  }

  async setGroupAddRequest(flag: string, subtype: 'add' | 'invite', info?: string | boolean) {
    if (typeof info === 'string') {
      await this.get('set_group_add_request', { flag, subtype, approve: false, reason: info })
    } else {
      await this.get('set_group_add_request', { flag, subtype, approve: info })
    }
  }

  setGroupAddRequestAsync(flag: string, subtype: 'add' | 'invite', info?: string | boolean) {
    if (typeof info === 'string') {
      return this.getAsync('set_group_add_request', { flag, subtype, approve: false, reason: info })
    } else {
      return this.getAsync('set_group_add_request', { flag, subtype, approve: info })
    }
  }

  async getSelfId() {
    const { userId } = await this.getLoginInfo()
    return userId
  }

  async getStatusCode() {
    if (!this.ready) return BotStatusCode.BOT_IDLE
    try {
      const data = await this.get<StatusInfo>('get_status')
      return data.good ? BotStatusCode.GOOD : data.online ? BotStatusCode.SERVER_ERROR : BotStatusCode.BOT_OFFLINE
    } catch {
      return BotStatusCode.NET_ERROR
    }
  }
}

function defineSync(name: string, ...params: string[]) {
  const prop = camelCase(name.replace(/^_/, ''))
  CQBot.prototype[prop] = function (this: CQBot, ...args: any[]) {
    return this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
  }
}

function defineAsync(name: string, ...params: string[]) {
  const prop = camelCase(name.replace(/^_/, ''))
  CQBot.prototype[prop] = async function (this: CQBot, ...args: any[]) {
    await this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
  }
  CQBot.prototype[prop + 'Async'] = async function (this: CQBot, ...args: any[]) {
    await this.getAsync(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
  }
}

function defineExtract(name: string, key: string, ...params: string[]) {
  const prop = camelCase(name.replace(/^_/, ''))
  CQBot.prototype[prop] = async function (this: CQBot, ...args: any[]) {
    const data = await this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
    return data[key]
  }
}

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
defineSync('get_friend_list')
defineSync('get_group_list')
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
  version?: string
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

defineAsync('set_group_name', 'group_id', 'group_name')
defineAsync('set_group_portrait', 'group_id', 'file', 'cache')

export function toVersion(data: VersionInfo) {
  const { coolqEdition, pluginVersion, goCqhttp, version } = data
  if (goCqhttp) {
    return `Go-CQHTTP/${version.slice(1)}`
  } else {
    return `CoolQ/${capitalize(coolqEdition)} CQHTTP/${pluginVersion}`
  }
}
