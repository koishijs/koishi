import { User, Group, UserField, GroupField, createUser, UserData, GroupData } from './database'
import { ParsedCommandLine, Command } from './command'
import { isInteger, contain, observe, Observed } from 'koishi-utils'
import { App } from './app'

export type PostType = 'message' | 'notice' | 'request' | 'meta_event' | 'send'
export type MessageType = 'private' | 'group' | 'discuss'

export interface MetaTypeMap {
  message: MessageType
  notice: 'group_upload' | 'group_admin' | 'group_increase' | 'group_decrease' | 'group_ban' | 'friend_add' | 'group_recall'
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
  $response?: (payload: ResponsePayload) => void

  private $_delay?: number
  private $_hooks?: (() => void)[] = []

  constructor (meta: Partial<Meta>) {
    Object.assign(this, meta)
  }

  toJSON () {
    return Object.fromEntries(Object.entries(this).filter(([key]) => {
      return !key.startsWith('_') && !key.startsWith('$')
    }))
  }

  get $bot () {
    return this.$app.bots[this.selfId]
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

  async $send (message: string, autoEscape = false) {
    if (this.$app.options.preferSync) {
      await this.$bot.sendMsg(this.messageType, this.$ctxId, message, autoEscape)
      return
    }
    if (this.$response) {
      const _meta = this.$bot._createSendMeta(this.messageType, this.$ctxType, this.$ctxId, message)
      if (this.$app.bail(this, 'before-send', _meta)) return
      return this.$response({ reply: message, autoEscape, atSender: false })
    }
    return this.$bot.sendMsgAsync(this.messageType, this.$ctxId, message, autoEscape)
  }

  $cancelQueued (delay = 0) {
    this.$_hooks.forEach(Reflect.apply)
    this.$_delay = delay
  }

  async $sendQueued (message: string | void, delay?: number) {
    if (!message) return
    if (typeof delay === 'undefined') {
      const { queueDelay = 100 } = this.$app.options
      delay = typeof queueDelay === 'function' ? queueDelay(message, this) : queueDelay
    }
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
        this.$_delay = delay
        hook()
      }, this.$_delay || 0)
    })
  }

  /** 在元数据上绑定一个可观测群实例 */
  async observeGroup <T extends GroupField = never> (fields: Iterable<T> = []): Promise<Group<T | G>> {
    const fieldSet = new Set<GroupField>(fields)
    const { groupId, $argv, $group } = this
    if ($argv) Command.collect($argv, 'group', fieldSet)

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
    if ($argv) Command.collect($argv, 'user', fieldSet)

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

export class MessageBuffer {
  private buffer = ''
  private original = false

  public hasData = false
  public send: Meta['$send']
  public sendQueued: Meta['$sendQueued']

  constructor (private meta: Meta) {
    this.send = meta.$send.bind(meta)
    this.sendQueued = meta.$sendQueued.bind(meta)

    meta.$send = async (message: string) => {
      if (!message) return
      this.hasData = true
      if (this.original) {
        return this.send(message)
      }
      this.buffer += message
    }

    meta.$sendQueued = async (message, delay) => {
      if (!message) return
      this.hasData = true
      if (this.original) {
        return this.sendQueued(message, delay)
      }
      return this._flush(this.buffer + message, delay)
    }
  }

  write (message: string) {
    if (!message) return
    this.hasData = true
    this.buffer += message
  }

  private async _flush (message: string, delay?: number) {
    this.original = true
    message = message.trim()
    await this.sendQueued(message, delay)
    this.buffer = ''
    this.original = false
  }

  flush () {
    return this._flush(this.buffer)
  }

  async run <T> (callback: () => T | Promise<T>) {
    this.original = false
    const send = this.meta.$send
    const sendQueued = this.meta.$sendQueued
    const result = await callback()
    this.meta.$sendQueued = sendQueued
    this.meta.$send = send
    this.original = true
    return result
  }

  async end (message = '') {
    this.write(message)
    await this.flush()
    this.original = true
    delete this.meta.$send
    delete this.meta.$sendQueued
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

export interface StatusInfo {
  appInitialized: boolean
  appEnabled: boolean
  pluginsGood: boolean
  appGood: boolean
  online: boolean
  good: boolean
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
