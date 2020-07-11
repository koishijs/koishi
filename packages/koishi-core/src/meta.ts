import { User, Group, UserField, GroupField } from './database'
import { ParsedCommandLine } from './command'
import { isInteger } from 'koishi-utils'
import { App } from './app'

export type PostType = 'message' | 'notice' | 'request' | 'meta_event' | 'send'
export type MessageType = 'private' | 'group' | 'discuss'

export interface MetaTypeMap {
  message: MessageType
  notice: 'group_upload' | 'group_admin' | 'group_increase' | 'group_decrease' | 'group_ban' | 'friend_add'
  request: 'friend' | 'group'
  // eslint-disable-next-line camelcase
  meta_event: 'lifecycle' | 'heartbeat'
  send: 'private' | 'group' | 'discuss'
}

export interface SubTypeMap {
  message: 'friend' | 'group' | 'discuss' | 'other' | 'normal' | 'anonymous' | 'notice'
  notice: 'set' | 'unset' | 'approve' | 'invite' | 'leave' | 'kick' | 'kick_me' | 'ban' | 'lift_ban'
  request: 'add' | 'invite'
  // eslint-disable-next-line camelcase
  meta_event: 'enable' | 'disable' | 'connect'
  send: never
}

export enum contextTypes {
  user = 0,
  group = 1,
  discuss = 2,
}

export type ContextType = keyof typeof contextTypes

export interface ResponsePayload {
  delete?: boolean
  ban?: boolean
  banDuration?: number
  kick?: boolean
  reply?: string
  autoEscape?: boolean
  atSender?: boolean
  approve?: boolean
  remark?: string
  reason?: string
}

export interface ParsedMessage {
  atMe?: boolean
  nickname?: string
  prefix?: string
  message?: string
}

/** CQHTTP Meta Information */
export class Meta <U extends UserField = never, G extends GroupField = never> {
  // database bindings
  $user?: User<U>
  $group?: Group<G>

  // context identifier
  $ctxId?: number
  $ctxType?: ContextType

  // other properties
  $app?: App
  $argv?: ParsedCommandLine
  $parsed?: ParsedMessage

  // quick operations
  $response?: (payload: ResponsePayload) => void

  // basic properties
  postType?: keyof MetaTypeMap
  messageType?: MetaTypeMap['message']
  noticeType?: MetaTypeMap['notice']
  requestType?: MetaTypeMap['request']
  metaEventType?: MetaTypeMap['meta_event']
  sendType?: MetaTypeMap['send']
  subType?: SubTypeMap[keyof SubTypeMap]
  selfId?: number
  userId?: number
  groupId?: number
  discussId?: number
  time?: number

  // message event
  messageId?: number
  message?: string
  rawMessage?: string
  font?: number
  sender?: SenderInfo
  anonymous?: AnonymousInfo

  // notice event
  operatorId?: number
  duration?: number
  file?: FileInfo

  // request event
  comment?: string
  flag?: string

  // metaEvent event
  status?: StatusInfo
  interval?: number

  /** @deprecated */
  get $nickname () {
    return this.$app.options.getSenderName(this)
  }

  $_sleep?: number
  $_hooks?: (() => void)[]

  $cancelQueued (ms = 0) {
    this.$_hooks?.forEach(Reflect.apply)
    this.$_sleep = ms
  }

  async $sendQueued (message: string | void, ms = 0) {
    if (!message) return
    return new Promise<void>(async (resolve) => {
      const hooks = this.$_hooks || (this.$_hooks = [])
      function hook () {
        resolve()
        clearTimeout(timer)
        const index = hooks.indexOf(hook)
        if (index >= 0) hooks.splice(index, 1)
      }
      hooks.push(hook)
      const timer = setTimeout(async () => {
        await this.$send(message.replace(/\$s/g, this.$nickname))
        this.$_sleep = ms
        hook()
      }, this.$_sleep || 0)
    })
  }

  async $delete () {
    if (this.$response) return this.$response({ delete: true })
    return this.$app.sender.deleteMsgAsync(this.messageId)
  }

  async $ban (duration = 30 * 60) {
    if (this.$response) return this.$response({ ban: true, banDuration: duration })
    return this.anonymous
      ? this.$app.sender.setGroupAnonymousBanAsync(this.groupId, this.anonymous.flag, duration)
      : this.$app.sender.setGroupBanAsync(this.groupId, this.userId, duration)
  }

  async $kick () {
    if (this.$response) return this.$response({ kick: true })
    if (this.anonymous) return
    return this.$app.sender.setGroupKickAsync(this.groupId, this.userId)
  }

  async $send (message: string, autoEscape = false) {
    if (this.$response) {
      const _meta = this.$app.sender._createSendMeta(this.messageType, this.$ctxType, this.$ctxId, message)
      if (await this.$app.serialize(this, 'before-send', _meta)) return
      return this.$response({ reply: message, autoEscape, atSender: false })
    }
    return this.$app.sender.sendMsgAsync(this.messageType, this.$ctxId, message, autoEscape)
  }

  async $approve (remark = '') {
    if (this.$response) return this.$response({ approve: true, remark })
    return this.requestType === 'friend'
      ? this.$app.sender.setFriendAddRequestAsync(this.flag, remark)
      : this.$app.sender.setGroupAddRequestAsync(this.flag, this.subType as any, true)
  }

  async $reject (reason = '') {
    if (this.$response) return this.$response({ approve: false, reason })
    return this.requestType === 'friend'
      ? this.$app.sender.setFriendAddRequestAsync(this.flag, false)
      : this.$app.sender.setGroupAddRequestAsync(this.flag, this.subType as any, reason)
  }
}

export interface AnonymousInfo {
  id?: number
  name: string
  flag: string
}

export interface FileInfo {
  id: string
  name: string
  size: number
  busid: number
}

export interface AccountInfo {
  userId: number
  nickname: string
}

export interface FriendInfo extends AccountInfo {
  remark: string
}

export interface StrangerInfo extends AccountInfo {
  sex: 'male' | 'female' | 'unknown'
  age: number
}

export type GroupRole = 'owner' | 'admin' | 'member'

export interface SenderInfo extends StrangerInfo {
  area?: string
  card?: string
  level?: string
  role?: GroupRole
  title?: string
}

export interface GroupMemberInfo extends SenderInfo {
  cardChangeable: boolean
  groupId: number
  joinTime: number
  lastSentTime: number
  titleExpireTime: number
  unfriendly: boolean
}

export interface ListedGroupInfo {
  groupId: number
  groupName: string
}

export interface GroupInfo extends ListedGroupInfo {
  memberCount: number
  maxMemberCount: number
}

export interface Credentials {
  cookies: string
  csrfToken: number
}

export interface StatusInfo {
  appInitialized: boolean
  appEnabled: boolean
  pluginsGood: boolean
  appGood: boolean
  online: boolean
  good: boolean
}

export interface VersionInfo {
  coolqDirectory: string
  coolqEdition: 'air' | 'pro'
  pluginVersion: string
  pluginMajorVersion: number
  pluginMinorVersion: number
  pluginPatchVersion: number
  pluginBuildNumber: number
  pluginBuildConfiguration: 'debug' | 'release'
}

export interface VipInfo extends AccountInfo {
  level: number
  levelSpeed: number
  vipLevel: number
  vipGrowthSpeed: number
  vipGrowthTotal: string
}

export interface GroupNoticeInfo {
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

export function getSenderName (meta: Meta<'name'>) {
  const idString = '' + meta.userId
  return meta.$user && meta.$user.name && idString !== meta.$user.name
    ? meta.$user.name
    : meta.anonymous
      ? meta.anonymous.name
      : meta.sender
        ? meta.sender.card || meta.sender.nickname
        : idString
}

/**
 * get context unique id
 * @example
 * getContextId(meta) // user123, group456, discuss789
 */
export function getContextId (meta: Meta) {
  const type = meta.messageType === 'private' ? 'user' : meta.messageType
  return type + meta[`${type}Id`]
}

/**
 * get session unique id
 * @example
 * getSessionId(meta) // 123user123, 123group456, 123discuss789
 */
export function getSessionId (meta: Meta) {
  return meta.$ctxId + meta.$ctxType + meta.userId
}

export function getTargetId (target: string | number) {
  if (typeof target !== 'string' && typeof target !== 'number') return
  let qq = +target
  if (!qq) {
    const capture = /\[CQ:at,qq=(\d+)\]/.exec(target as any)
    if (capture) qq = +capture[1]
  }
  if (!isInteger(qq)) return
  return qq
}
