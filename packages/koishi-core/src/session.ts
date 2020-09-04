import { User, Group } from './database'
import { ExecuteArgv, ParsedArgv, Command } from './command'
import { isInteger, contain, observe, noop, Logger, defineProperty, Random } from 'koishi-utils'
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

/** CQHTTP Meta Information */
export interface Meta<P extends PostType = PostType> {
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

const logger = new Logger('session')

export interface Session<U, G, P extends PostType = PostType> extends Meta<P> {}

export class Session<U extends User.Field = never, G extends Group.Field = never> {
  $user?: User.Observed<U>
  $group?: Group.Observed<G>
  $app?: App
  $argv?: ParsedArgv
  $appel?: boolean
  $prefix?: string = null
  $parsed?: string
  $reply?: number
  $uuid = Random.uuid()

  private _delay?: number
  private _queued = Promise.resolve()
  private _hooks?: (() => void)[] = []

  constructor(app: App, session: Partial<Session>) {
    defineProperty(this, '$app', app)
    Object.assign(this, session)
  }

  toJSON() {
    return Object.fromEntries(Object.entries(this).filter(([key]) => {
      return !key.startsWith('_') && !key.startsWith('$')
    }))
  }

  get $bot() {
    return this.$app.bots[this.selfId]
  }

  get $username(): string {
    const idString = '' + this.userId
    return this.$user && this.$user['name'] && idString !== this.$user['name']
      ? this.$user['name']
      : this.anonymous
        ? this.anonymous.name
        : this.sender
          ? this.sender.card || this.sender.nickname
          : idString
  }

  async $send(message: string) {
    if (!message) return
    if (this.groupId) {
      await this.$bot.sendGroupMsg(this.groupId, message)
    } else {
      await this.$bot.sendPrivateMsg(this.userId, message)
    }
  }

  $cancelQueued(delay = 0) {
    this._hooks.forEach(Reflect.apply)
    this._delay = delay
  }

  async $sendQueued(message: string | void, delay?: number) {
    if (!message) return
    if (typeof delay === 'undefined') {
      const { queueDelay = 100 } = this.$app.options
      delay = typeof queueDelay === 'function' ? queueDelay(message, this) : queueDelay
    }
    return this._queued = this._queued.then(() => new Promise<void>((resolve) => {
      const hook = () => {
        resolve()
        clearTimeout(timer)
        const index = this._hooks.indexOf(hook)
        if (index >= 0) this._hooks.splice(index, 1)
      }
      this._hooks.push(hook)
      const timer = setTimeout(async () => {
        await this.$send(message)
        this._delay = delay
        hook()
      }, this._delay || 0)
    }))
  }

  /** 在元数据上绑定一个可观测群实例 */
  async $observeGroup<T extends Group.Field = never>(fields: Iterable<T> = []): Promise<Group.Observed<T | G>> {
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
        this.$app._groupCache.set(groupId, $group._merge(data))
      }
      return $group as any
    }

    // 如果存在满足可用的缓存数据，使用缓存代替数据获取
    const cache = this.$app._groupCache.get(groupId)
    const fieldArray = [...fieldSet]
    const hasActiveCache = cache && contain(Object.keys(cache), fieldArray)
    if (hasActiveCache) return this.$group = cache as any

    // 绑定一个新的可观测群实例
    const data = await this.$app.database.getGroup(groupId, fieldArray)
    const group = observe(data, diff => this.$app.database.setGroup(groupId, diff), `group ${groupId}`)
    this.$app._groupCache.set(groupId, group)
    return this.$group = group
  }

  /** 在元数据上绑定一个可观测用户实例 */
  async $observeUser<T extends User.Field = never>(fields: Iterable<T> = []): Promise<User.Observed<T | U>> {
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
        this.$app._userCache.set(userId, $user._merge(data))
      }
    }

    if ($user) return $user as any

    const defaultAuthority = typeof this.$app.options.defaultAuthority === 'function'
      ? this.$app.options.defaultAuthority(this)
      : this.$app.options.defaultAuthority || 0

    // 确保匿名消息不会写回数据库
    if (this.anonymous) {
      const user = observe(User.create(userId, defaultAuthority), () => Promise.resolve())
      return this.$user = user
    }

    // 如果存在满足可用的缓存数据，使用缓存代替数据获取
    const cache = this.$app._userCache.get(userId)
    const fieldArray = [...fieldSet]
    const hasActiveCache = cache && contain(Object.keys(cache), fieldArray)
    if (hasActiveCache) return this.$user = cache as any

    // 绑定一个新的可观测用户实例
    const data = await this.$app.database.getUser(userId, defaultAuthority, fieldArray)
    const user = observe(data, diff => this.$app.database.setUser(userId, diff), `user ${userId}`)
    this.$app._userCache.set(userId, user)
    return this.$user = user
  }

  $resolve(argv: ExecuteArgv): ParsedArgv {
    if (typeof argv.command === 'string') {
      argv.command = this.$app._commandMap[argv.command]
    }
    if (!argv.command) {
      logger.warn(new Error(`cannot find command ${argv}`))
      return
    }
    if (!argv.command.context.match(this)) return
    return { session: this, ...argv } as ParsedArgv
  }

  $parse(message: string, terminator = '', builtin = false): ParsedArgv {
    if (!message) return
    const argv = this.$app.bail(this, 'parse', message, this, builtin, terminator)
    return argv && this.$resolve(argv)
  }

  $execute(argv: ExecuteArgv): Promise<void>
  $execute(message: string, next?: NextFunction): Promise<void>
  async $execute(...args: [ExecuteArgv] | [string, NextFunction?]) {
    let argv: void | ParsedArgv, next: NextFunction
    if (typeof args[0] === 'string') {
      next = args[1] || noop
      argv = this.$parse(args[0])
    } else {
      next = args[0].next || noop
      argv = this.$resolve(args[0])
    }
    if (!argv) return next()

    argv.next = next
    argv.session = this
    this.$argv = argv
    if (this.$app.database) {
      if (this.messageType === 'group') {
        await this.$observeGroup()
      }
      await this.$observeUser()
    }

    return argv.command.execute(argv)
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
export function getContextId(session: Session) {
  const type = session.messageType === 'private' ? 'user' : session.messageType
  return type + session[`${type}Id`]
}

export function getTargetId(target: string | number) {
  if (typeof target !== 'string' && typeof target !== 'number') return
  let qq = +target
  if (!qq) {
    const capture = /\[CQ:at,qq=(\d+)\]/.exec(target as any)
    if (capture) qq = +capture[1]
  }
  if (!isInteger(qq)) return
  return qq
}
