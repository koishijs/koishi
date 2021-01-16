import { User, Channel, Platforms, PlatformType, TableType, Tables } from './database'
import { Command } from './command'
import { contain, observe, Logger, defineProperty, Random } from 'koishi-utils'
import { collectFields, Argv } from './parser'
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
export interface Meta<E extends EventType = EventType> extends MessageBase {
  eventType?: E
  kind?: PlatformType
  selfId?: string

  // TODO
  subType?: EventTypeMap[E]
  ancestors?: string[]

  // message event
  messageId?: string
  content?: string
  rawMessage?: string
  font?: number
  author?: AuthorInfo
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
  $argv?: Argv<U, G, O>
  $appel?: boolean
  $prefix?: string
  $parsed?: string
  $reply?: MessageInfo
  $uuid?: string

  private _delay?: number
  private _queued: Promise<void>
  private _hooks: (() => void)[]

  constructor(app: App, session: Partial<Session>) {
    defineProperty(this, '$app', app)
    defineProperty(this, '$uuid', Random.uuid())
    defineProperty(this, '$prefix', null)
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
    const defaultName = this.$user && this.$user['name']
      ? this.$user['name']
      : this.anonymous
        ? this.anonymous.name
        : this.author
          ? this.author.nick || this.author.name
          : '' + this.userId
    return this.$app.chain('appellation', defaultName, this)
  }

  get uid() {
    return `${this.kind}:${this.userId}`
  }

  get cid() {
    return `${this.kind}:${this.channelId}`
  }

  get sid() {
    return `${this.kind}:${this.selfId}`
  }

  async $send(message: string) {
    if (this.$bot[Bot.$send]) {
      return this.$bot[Bot.$send](this, message)
    }
    if (!message) return
    await this.$bot.sendMessage(this.channelId, message)
  }

  $cancelQueued(delay = this.$app.options.delay.cancel) {
    this._hooks.forEach(Reflect.apply)
    this._delay = delay
  }

  async $sendQueued(content: string, delay?: number) {
    if (!content) return
    if (typeof delay === 'undefined') {
      const { message, character } = this.$app.options.delay
      delay = Math.max(message, character * content.length)
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
        await this.$send(content)
        this._delay = delay
        hook()
      }, this._delay || 0)
    }))
  }

  async $getChannel<K extends Channel.Field = never>(id: string = this.channelId, fields: readonly K[] = [], assignee?: string) {
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
    const { kind, channelId, $channel } = this

    // 对于已经绑定可观测频道的，判断字段是否需要自动补充
    if ($channel) {
      for (const key in $channel) {
        fieldSet.delete(key as any)
      }
      if (fieldSet.size) {
        const data = await this.$getChannel(channelId, [...fieldSet])
        this.$app._groupCache.set(this.cid, $channel._merge(data))
      }
      return $channel as any
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
      await this.$app.database.setUser(this.kind, id, fallback, true)
    }
    return fallback
  }

  /** 在元数据上绑定一个可观测用户实例 */
  async $observeUser<T extends User.Field = never>(fields: Iterable<T> = []): Promise<User.Observed<T | U>> {
    const fieldSet = new Set<User.Field>(fields)
    const { userId, $user } = this

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

  collect<T extends TableType>(key: T, argv: Argv, fields = new Set<keyof Tables[T]>()) {
    collectFields(argv, Command[`_${key}Fields`], fields)
    const collect = (argv: Argv) => {
      argv.session = this
      if (argv.tokens) {
        for (const { inters } of argv.tokens) {
          inters.forEach(collect)
        }
        if (!this.resolve(argv)) return
      }
      collectFields(argv, argv.command[`_${key}Fields`], fields)
    }
    collect(argv)
    return fields
  }

  resolve(argv: Argv) {
    if (!argv.command) {
      const name = this.$app.bail('parse', argv, this)
      if (!(argv.command = this.$app._commandMap[name])) return
    }
    if (argv.tokens.every(token => !token.inters.length)) {
      const { options, args } = argv.command.parse(argv)
      argv.options = { ...argv.options, ...options }
      argv.args = [...argv.args || [], ...args]
    }
    return argv.command
  }

  async execute(content: string, next?: NextFunction): Promise<string>
  async execute(argv: Argv, next?: NextFunction): Promise<string>
  async execute(argv: string | Argv, next?: NextFunction): Promise<string> {
    if (typeof argv === 'string') argv = Argv.parse(argv)

    argv.session = this
    if (argv.tokens) {
      for (const arg of argv.tokens) {
        const { inters } = arg
        const output: string[] = []
        for (let i = 0; i < inters.length; ++i) {
          output.push(await this.execute(inters[i]))
        }
        for (let i = inters.length - 1; i >= 0; --i) {
          const { pos } = inters[i]
          arg.content = arg.content.slice(0, pos) + output[i] + arg.content.slice(pos)
        }
        arg.inters = []
      }
      if (!this.resolve(argv)) return ''
    } else {
      argv.command ||= this.$app._commandMap[argv.name]
      if (!argv.command) {
        logger.warn(new Error(`cannot find command ${argv.name}`))
        return ''
      }
    }

    if (this.$app.database) {
      if (this.subType === 'group') {
        await this.$observeChannel(this.collect('channel', argv))
      }
      await this.$observeUser(this.collect('user', argv))
    }

    const result = await argv.command.execute(argv, next)
    if (!argv.parent) await this.$send(result)
    return result
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

export interface StatusInfo {
  appInitialized: boolean
  appEnabled: boolean
  pluginsGood: boolean
  appGood: boolean
  online: boolean
  good: boolean
}

export interface MessageBase {
  messageId?: string
  channelId?: string
  groupId?: string
  userId?: string
  content?: string
  timestamp?: number
  author?: AuthorInfo
}

export interface MessageInfo extends MessageBase {
  subType?: EventTypeMap['message']
}

export interface GroupInfo {
  groupId: string
  name: string
}

export interface UserInfo {
  userId: string
  name: string
}

export interface GroupMemberInfo extends UserInfo {
  nick: string
  roles: string[]
}

export interface AuthorInfo extends GroupMemberInfo {}
