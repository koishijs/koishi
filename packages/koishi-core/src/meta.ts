import { User, Group, UserField, GroupField, createUser, UserData, GroupData } from './database'
import { ParsedCommandLine, Command } from './command'
import { isInteger, contain, observe, Observed } from 'koishi-utils'
import { App } from './app'

export type PostType = 'message' | 'notice' | 'request' | 'meta_event' | 'send'
export type MessageType = 'private' | 'group' | 'discuss'

export interface MetaTypeMap {
  message: MessageType
  notice: 'group_upload' | 'group_admin' | 'group_increase' | 'group_decrease' | 'group_ban' | 'friend_add'
  request: 'friend' | 'group'
  // eslint-disable-next-line camelcase
  meta_event: 'lifecycle' | 'heartbeat'
}

export interface SubTypeMap {
  message: 'friend' | 'group' | 'discuss' | 'other' | 'normal' | 'anonymous' | 'notice'
  notice: 'set' | 'unset' | 'approve' | 'invite' | 'leave' | 'kick' | 'kick_me' | 'ban' | 'lift_ban'
  request: 'add' | 'invite'
  // eslint-disable-next-line camelcase
  meta_event: 'enable' | 'disable' | 'connect'
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
export interface Meta {
  // basic properties
  postType?: PostType
  messageType?: MetaTypeMap['message']
  noticeType?: MetaTypeMap['notice']
  requestType?: MetaTypeMap['request']
  metaEventType?: MetaTypeMap['meta_event']
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
}

export class Meta <U extends UserField = never, G extends GroupField = never> {
  $user?: User<U>
  $group?: Group<G>
  $ctxId?: number
  $ctxType?: ContextType
  $app?: App
  $argv?: ParsedCommandLine
  $parsed?: ParsedMessage
  $_sleep?: number
  $_hooks?: (() => void)[] = []
  $response?: (payload: ResponsePayload) => void

  constructor (meta: Partial<Meta>) {
    Object.assign(this, meta)
  }

  toJSON () {
    return Object.fromEntries(Object.entries(this).filter(([key]) => {
      return !key.startsWith('_') && !key.startsWith('$')
    }))
  }

  get $username (): string {
    const idString = '' + this.userId
    return this.$user && this.$user['name'] && idString !== this.$user['name']
      ? this.$user['name']
      : this.anonymous
        ? this.anonymous.name
        : this.sender
          ? this.sender.card || this.sender.nickname
          : idString
  }

  $cancelQueued (ms = 0) {
    this.$_hooks.forEach(Reflect.apply)
    this.$_sleep = ms
  }

  async $sendQueued (message: string | void, ms = 0) {
    if (!message) return
    return new Promise<void>(async (resolve) => {
      const hook = () => {
        resolve()
        clearTimeout(timer)
        const index = this.$_hooks.indexOf(hook)
        if (index >= 0) this.$_hooks.splice(index, 1)
      }
      this.$_hooks.push(hook)
      const timer = setTimeout(async () => {
        await this.$send(message)
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

  /** 在元数据上绑定一个可观测群实例 */
  async observeGroup <T extends GroupField = never> (fields: Iterable<T> = []): Promise<Group<T | G>> {
    const fieldSet = new Set<GroupField>(fields)
    const { groupId, $argv, $group } = this
    if ($argv) Command.collectFields($argv, 'group', fieldSet)

    // 对于已经绑定可观测群的，判断字段是否需要自动补充
    if ($group) {
      for (const key in $group) {
        fieldSet.delete(key as any)
      }
      if (fieldSet.size) {
        const data = await this.$app.database.getGroup(groupId, [...fieldSet])
        groupCache[groupId] = $group._merge(data)
        groupCache[groupId]._timestamp = Date.now()
      }
      return $group as any
    }

    // 如果存在满足可用的缓存数据，使用缓存代替数据获取
    const cache = groupCache[groupId]
    const fieldArray = [...fieldSet]
    const timestamp = Date.now()
    const isActiveCache = cache
      && contain(Object.keys(cache), fieldArray)
      && timestamp - cache._timestamp < this.$app.options.groupCacheTimeout
    if (isActiveCache) {
      return this.$group = cache as any
    }

    // 绑定一个新的可观测群实例
    const data = await this.$app.database.getGroup(groupId, fieldArray)
    const group = groupCache[groupId] = observe(data, diff => this.$app.database.setGroup(groupId, diff), `group ${groupId}`)
    groupCache[groupId]._timestamp = timestamp
    return this.$group = group
  }

  /** 在元数据上绑定一个可观测用户实例 */
  async observeUser <T extends UserField = never> (fields: Iterable<T> = []): Promise<User<T | U>> {
    const fieldSet = new Set<UserField>(fields)
    const { userId, $argv, $user } = this
    if ($argv) Command.collectFields($argv, 'user', fieldSet)

    // 对于已经绑定可观测用户的，判断字段是否需要自动补充
    if ($user && !this.anonymous) {
      for (const key in $user) {
        fieldSet.delete(key as any)
      }
      if (fieldSet.size) {
        const data = await this.$app.database.getUser(userId, [...fieldSet])
        userCache[userId] = $user._merge(data)
        userCache[userId]._timestamp = Date.now()
      }
    }

    if ($user) return $user as any

    const defaultAuthority = typeof this.$app.options.defaultAuthority === 'function'
      ? this.$app.options.defaultAuthority(this)
      : this.$app.options.defaultAuthority || 0

    // 确保匿名消息不会写回数据库
    if (this.anonymous) {
      const user = observe(createUser(userId, defaultAuthority))
      return this.$user = user
    }

    // 如果存在满足可用的缓存数据，使用缓存代替数据获取
    const cache = userCache[userId]
    const fieldArray = [...fieldSet]
    const timestamp = Date.now()
    const isActiveCache = cache
      && contain(Object.keys(cache), fieldArray)
      && timestamp - cache._timestamp < this.$app.options.userCacheTimeout
    if (isActiveCache) {
      return this.$user = cache as any
    }

    // 绑定一个新的可观测用户实例
    const data = await this.$app.database.getUser(userId, defaultAuthority, fieldArray)
    const user = userCache[userId] = observe(data, diff => this.$app.database.setUser(userId, diff), `user ${userId}`)
    userCache[userId]._timestamp = timestamp
    return this.$user = user
  }
}

const userCache: Record<number, Observed<Partial<UserData & { _timestamp: number }>>> = {}
const groupCache: Record<number, Observed<Partial<GroupData & { _timestamp: number }>>> = {}

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
