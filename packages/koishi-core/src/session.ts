import { User, Channel, Platforms, PlatformType } from './database'
import { ExecuteArgv, ParsedArgv, Command } from './command'
import { isInteger, contain, observe, noop, Logger, defineProperty, Random } from 'koishi-utils'
import { NextFunction } from './context'
import { App } from './app'
import { Bot } from './server'
import LruCache from 'lru-cache'

export type EventType = keyof EventTypeMap

export type MessageType = 'private' | 'group'

export interface EventTypeMap {
  'message': MessageType
  'message-updated': MessageType
  'message-deleted': MessageType
  'group-added': null
  'group-deleted': null
  // notice:
  //   | 'set' | 'unset' | 'approve' | 'invite' | 'leave' | 'kick' | 'kick_me'
  //   | 'ban' | 'lift_ban' | 'poke' | 'lucky_king' | 'honor'
  // request: 'add' | 'invite'
  'lifecycle': 'heartbeat' | 'enable' | 'disable' | 'connect'
  'send': MessageType
}

/** CQHTTP Meta Information */
export interface Meta<E extends EventType = EventType> {
  kind?: PlatformType

  // type
  eventType?: E
  subType?: EventTypeMap[E]

  // basic properties
  channelId?: string
  ancestors?: string[]
  selfId?: string
  userId?: string
  groupId?: string
  time?: number

  // message event
  messageId?: string
  content?: string
  rawMessage?: string
  font?: number
  sender?: SenderInfo
  anonymous?: AnonymousInfo

  // notice event
  operatorId?: string
  targetId?: string
  duration?: number
  file?: FileInfo
  honorType?: 'talkative' | 'performer' | 'emotion'

  // request event
  comment?: string
  flag?: string

  // metaEvent event
  status?: StatusInfo
  interval?: number
}

const logger = new Logger('session')

export interface Session<U, G, O, K, E extends EventType = EventType> extends Meta<E> {}

export class Session<U extends User.Field = never, G extends Channel.Field = never, O extends {} = {}, K extends PlatformType = never> {
  $user?: User.Observed<U>
  $channel?: Channel.Observed<G>
  $app?: App
  $argv?: ParsedArgv<U, G, O>
  $appel?: boolean
  $prefix?: string = null
  $parsed?: string
  $reply?: MessageInfo
  $uuid = Random.uuid()

  private _delay?: number
  private _queued: Promise<void>
  private _hooks: (() => void)[]

  constructor(app: App, session: Partial<Session>) {
    defineProperty(this, '$app', app)
    defineProperty(this, '_queued', Promise.resolve())
    defineProperty(this, '_hooks', [])
    Object.assign(this, session)
  }

  toJSON() {
    return Object.fromEntries(Object.entries(this).filter(([key]) => {
      return !key.startsWith('_') && !key.startsWith('$')
    }))
  }

  get $bot(): [K] extends [never] ? Bot : Platforms[K] {
    return this.$app.servers[this.kind].bots[this.selfId] as any
  }

  get $username(): string {
    return this.$user && this.$user['name']
      ? this.$user['name']
      : this.anonymous
        ? this.anonymous.name
        : this.sender
          ? this.sender.card || this.sender.nickname
          : '' + this.userId
  }

  get uid() {
    return `${this.kind}:${this.userId}`
  }

  get cid() {
    return `${this.kind}:${this.channelId}`
  }

  async $send(message: string) {
    if (this.$bot[Bot.$send]) {
      return this.$bot[Bot.$send](this, message)
    }
    if (!message) return
    await this.$bot.sendMessage(this.channelId, message)
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

  async $getChannel<K extends Channel.Field = never>(id: string = this.groupId, fields: readonly K[] = [], assignee?: string) {
    const group = await this.$app.database.getChannel(this.kind, id, fields)
    if (group) return group
    const fallback = Channel.create(this.kind, id, assignee)
    if (assignee) {
      await this.$app.database.setChannel(this.kind, id, fallback)
    }
    return fallback
  }

  /** 在元数据上绑定一个可观测频道实例 */
  async $observeChannel<T extends Channel.Field = never>(fields: Iterable<T> = []): Promise<Channel.Observed<T | G>> {
    const fieldSet = new Set<Channel.Field>(fields)
    const { kind, channelId, $argv, $channel: $group } = this
    if ($argv) Command.collect($argv, 'channel', fieldSet)

    // 对于已经绑定可观测频道的，判断字段是否需要自动补充
    if ($group) {
      for (const key in $group) {
        fieldSet.delete(key as any)
      }
      if (fieldSet.size) {
        const data = await this.$getChannel(channelId, [...fieldSet])
        this.$app._groupCache.set(this.cid, $group._merge(data))
      }
      return $group as any
    }

    // 如果存在满足可用的缓存数据，使用缓存代替数据获取
    const cache = this.$app._groupCache.get(this.cid)
    const fieldArray = [...fieldSet]
    const hasActiveCache = cache && contain(Object.keys(cache), fieldArray)
    if (hasActiveCache) return this.$channel = cache as any

    // 绑定一个新的可观测频道实例
    const data = await this.$getChannel(channelId, fieldArray)
    const group = observe(data, diff => this.$app.database.setChannel(kind, channelId, diff), `group ${channelId}`)
    this.$app._groupCache.set(this.cid, group)
    return this.$channel = group
  }

  async $getUser<K extends User.Field = never>(id: string = this.userId, fields: readonly K[] = [], authority = 0) {
    const user = await this.$app.database.getUser(this.kind, id, fields)
    if (user) return user
    const fallback = User.create(this.kind, id, authority)
    if (authority) {
      await this.$app.database.setUser(this.kind, id, fallback)
    }
    return fallback
  }

  /** 在元数据上绑定一个可观测用户实例 */
  async $observeUser<T extends User.Field = never>(fields: Iterable<T> = []): Promise<User.Observed<T | U>> {
    const fieldSet = new Set<User.Field>(fields)
    const { userId, $argv, $user } = this
    if ($argv) Command.collect($argv, 'user', fieldSet)

    let userCache = this.$app._userCache[this.kind]
    if (!userCache) {
      userCache = this.$app._userCache[this.kind] = new LruCache({
        max: this.$app.options.userCacheLength,
        maxAge: this.$app.options.userCacheAge,
      })
    }

    // 对于已经绑定可观测用户的，判断字段是否需要自动补充
    if ($user && !this.anonymous) {
      for (const key in $user) {
        fieldSet.delete(key as any)
      }
      if (fieldSet.size) {
        const data = await this.$getUser(userId, [...fieldSet])
        userCache.set(userId, $user._merge(data) as any)
      }
    }

    if ($user) return $user as any

    const defaultAuthority = typeof this.$app.options.defaultAuthority === 'function'
      ? this.$app.options.defaultAuthority(this)
      : this.$app.options.defaultAuthority || 0

    // 确保匿名消息不会写回数据库
    if (this.anonymous) {
      const user = observe(User.create(this.kind, userId, defaultAuthority), () => Promise.resolve())
      return this.$user = user
    }

    // 如果存在满足可用的缓存数据，使用缓存代替数据获取
    const cache = userCache.get(userId)
    const fieldArray = [...fieldSet]
    const hasActiveCache = cache && contain(Object.keys(cache), fieldArray)
    if (hasActiveCache) return this.$user = cache as any

    // 绑定一个新的可观测用户实例
    const data = await this.$getUser(userId, fieldArray, defaultAuthority)
    const user = observe(data, diff => this.$app.database.setUser(this.kind, userId, diff), `user ${userId}`)
    userCache.set(userId, user)
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
    let argv: any, next: NextFunction
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
      if (this.subType === 'group') {
        await this.$observeChannel()
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
  userId: string
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

export interface MessageInfo {
  id: string
  type: EventTypeMap['message']
  content: string
  timestamp: number
  sender: SenderInfo
}

export interface GroupInfo {
  id: string
  name: string
}

export interface UserInfo {
  id: string
  name: string
}

export interface GroupMemberInfo extends UserInfo {
  nick: string
  roles: string[]
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
