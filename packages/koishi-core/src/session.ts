import { User, Group } from './database'
import { ParsedArgv, ParsedCommandLine, Command } from './command'
import { isInteger, contain, observe, Observed, noop } from 'koishi-utils'
import { NextFunction } from './context'
import { App } from './app'

export type PostType = 'message' | 'notice' | 'request' | 'meta_event' | 'send'
export type MessageType = 'private' | 'group'

export interface MetaTypeMap {
  message: MessageType
  notice: 'group_upload' | 'group_admin' | 'group_increase' | 'group_decrease' | 'group_ban' | 'friend_add' | 'group_recall'
  request: 'friend' | 'group'
  // eslint-disable-next-line camelcase
  meta_event: 'lifecycle' | 'heartbeat'
  send: null
}

export interface SubTypeMap {
  message: 'friend' | 'group' | 'other' | 'normal' | 'anonymous' | 'notice'
  notice: 'set' | 'unset' | 'approve' | 'invite' | 'leave' | 'kick' | 'kick_me' | 'ban' | 'lift_ban'
  request: 'add' | 'invite'
  // eslint-disable-next-line camelcase
  meta_event: 'enable' | 'disable' | 'connect'
  send: null
}

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
export interface Meta <P extends PostType = PostType> {
  // type
  postType?: P
  messageType?: MetaTypeMap[P & 'message']
  noticeType?: MetaTypeMap[P & 'notice']
  requestType?: MetaTypeMap[P & 'request']
  metaEventType?: MetaTypeMap[P & 'meta_event']
  sendType?: MetaTypeMap[P & 'send']
  subType?: SubTypeMap[P]

  // basic properties
  selfId?: number
  userId?: number
  groupId?: number
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

export interface Session <U, G, P extends PostType = PostType> extends Meta <P> {}

export class Session <U extends User.Field = never, G extends Group.Field = never> {
  $user?: User.Observed<U>
  $group?: Group.Observed<G>
  $app?: App
  $argv?: ParsedCommandLine
  $parsed?: ParsedMessage
  $response?: (payload: ResponsePayload) => void

  private $_delay?: number
  private $_hooks?: (() => void)[] = []

  constructor (session: Partial<Session>) {
    Object.assign(this, session)
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
    let ctxId: number
    const ctxType = (ctxId = this.groupId) ? 'group' : (ctxId = this.userId) ? 'user' : null
    if (this.$app.options.preferSync) {
      await this.$bot.sendMsg(this.messageType, ctxId, message, autoEscape)
      return
    }
    if (this.$response) {
      const session = this.$bot.createSession(this.messageType, ctxType, ctxId, message)
      if (this.$app.bail(this, 'before-send', session)) return
      return this.$response({ reply: message, autoEscape, atSender: false })
    }
    return this.$bot.sendMsgAsync(this.messageType, ctxId, message, autoEscape)
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
  async $observeGroup <T extends Group.Field = never> (fields: Iterable<T> = []): Promise<Group.Observed<T | G>> {
    const fieldSet = new Set<Group.Field>(fields)
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
  async $observeUser <T extends User.Field = never> (fields: Iterable<T> = []): Promise<User.Observed<T | U>> {
    const fieldSet = new Set<User.Field>(fields)
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
      const user = observe(User.create(userId, defaultAuthority))
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

  $resolve (argv: ParsedArgv, next: NextFunction) {
    if (typeof argv.command === 'string') {
      argv.command = this.$app._commandMap[argv.command]
    }
    if (!argv.command?.context.match(this)) return
    return { session: this, next, ...argv } as ParsedCommandLine
  }

  $parse (message: string, next: NextFunction = noop, forced = false): ParsedCommandLine {
    if (!message) return
    const argv = this.$app.bail(this, 'parse', message, this, forced)
    if (argv) return this.$resolve(argv, next)
  }

  $execute (argv: ParsedArgv): Promise<void>
  $execute (message: string, next?: NextFunction): Promise<void>
  async $execute (...args: [ParsedArgv] | [string, NextFunction?]) {
    let argv: ParsedCommandLine, next: NextFunction
    if (typeof args[0] === 'string') {
      next = args[1] || noop
      argv = this.$parse(args[0], next)
    } else {
      next = args[0].next || noop
      argv = this.$resolve(args[0], next)
    }
    if (!argv) return next()

    if (this.$app.database) {
      if (this.messageType === 'group') {
        await this.$observeGroup()
      }
      await this.$observeUser()
    }

    argv.session = this
    return argv.command.execute(argv)
  }
}

const userCache: Record<number, Observed<Partial<User & { _timestamp: number }>>> = {}
const groupCache: Record<number, Observed<Partial<Group & { _timestamp: number }>>> = {}

export class MessageBuffer {
  private buffer = ''
  private original = false

  public hasData = false
  public send: Session['$send']
  public sendQueued: Session['$sendQueued']

  constructor (private session: Session) {
    this.send = session.$send.bind(session)
    this.sendQueued = session.$sendQueued.bind(session)

    session.$send = async (message: string) => {
      if (!message) return
      this.hasData = true
      if (this.original) {
        return this.send(message)
      }
      this.buffer += message
    }

    session.$sendQueued = async (message, delay) => {
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
    const send = this.session.$send
    const sendQueued = this.session.$sendQueued
    const result = await callback()
    this.session.$sendQueued = sendQueued
    this.session.$send = send
    this.original = true
    return result
  }

  async end (message = '') {
    this.write(message)
    await this.flush()
    this.original = true
    delete this.session.$send
    delete this.session.$sendQueued
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
 * getContextId(session) // user123, group456
 */
export function getContextId (session: Session) {
  const type = session.messageType === 'private' ? 'user' : session.messageType
  return type + session[`${type}Id`]
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
