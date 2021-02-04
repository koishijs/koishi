import LruCache from 'lru-cache'
import { distance } from 'fastest-levenshtein'
import { User, Channel, TableType, Tables } from './database'
import { Command } from './command'
import { contain, observe, Logger, defineProperty, Random, template } from 'koishi-utils'
import { Argv } from './parser'
import { Middleware, NextFunction } from './context'
import { App } from './app'
import { Bot, Platform } from './server'

const logger = new Logger('session')

type UnionToIntersection<U> = (U extends any ? (key: U) => void : never) extends (key: infer I) => void ? I : never
type Flatten<T, K extends keyof T = keyof T> = UnionToIntersection<T[K]>
type InnerKeys<T, K extends keyof T = keyof T> = keyof Flatten<T> & keyof Flatten<T, K>

export interface Session<U, G, P, X, Y> extends MessageBase {}

export namespace Session {
  type Genres = 'friend' | 'channel' | 'group' | 'group-member' | 'group-role' | 'group-file' | 'group-emoji'
  type Actions = 'added' | 'deleted' | 'updated'

  type MessageActions = 'message' | 'message-deleted' | 'message-updated' | 'send'

  export interface Events extends Record<`${Genres}-${Actions}`, {}>, Record<MessageActions, MessageType> {
    'friend-request': {}
    'group-request': {}
    'group-member-request': {}
    'group-added': GroupMemberAddedType
    'group-member-added': GroupMemberAddedType
    'group-deleted': GroupMemberDeletedType
    'group-member-deleted': GroupMemberDeletedType
    'group-member': {
      'role': {}
      'ban': {}
    }
    'notice': {
      'poke': {}
      'lucky-king': {}
      'honor': {
        'talkative': {}
        'performer': {}
        'emotion': {}
      }
    }
  }

  interface GroupMemberAddedType {
    'approve': {}
    'invite': {}
  }

  interface GroupMemberDeletedType {
    'leave': {}
    'kick': {}
  }

  interface MessageType {
    'private': {}
    'group': {}
  }

  type ParamX<X> = Extract<keyof Events, X>
  type ParamY<X, Y> = Extract<InnerKeys<Events, ParamX<X>>, Y>

  export type Payload<X, Y = any> = Session<never, never, Platform, ParamX<X>, ParamY<X, Y>>
}

export class Session<
  U extends User.Field = never,
  G extends Channel.Field = never,
  P extends Platform = Platform,
  X extends keyof Session.Events = keyof Session.Events,
  Y extends InnerKeys<Session.Events, X> = InnerKeys<Session.Events, X>,
> {
  type?: X
  subtype?: Y
  subsubtype?: InnerKeys<UnionToIntersection<Session.Events[X]>, Y>
  platform?: P

  selfId?: string
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

  // request event
  comment?: string
  flag?: string

  // metaEvent event
  status?: StatusInfo
  interval?: number

  $user?: User.Observed<U>
  $channel?: Channel.Observed<G>
  $app?: App
  $argv?: Argv<U, G>
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

  get $bot(): [P] extends [never] ? Bot : Bot.Platforms[P] {
    return this.$app.bots[this.sid] as any
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

  get database() {
    return this.$app.database
  }

  get uid() {
    return `${this.platform}:${this.userId}`
  }

  get cid() {
    return `${this.platform}:${this.channelId}`
  }

  get sid() {
    return `${this.platform}:${this.selfId}`
  }

  async send(message: string) {
    if (this.$bot[Bot.send]) {
      return this.$bot[Bot.send](this, message)
    }
    if (!message) return
    await this.$bot.sendMessage(this.channelId, message)
  }

  cancelQueued(delay = this.$app.options.delay.cancel) {
    this._hooks.forEach(Reflect.apply)
    this._delay = delay
  }

  async sendQueued(content: string, delay?: number) {
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
        await this.send(content)
        this._delay = delay
        hook()
      }, this._delay || 0)
    }))
  }

  private _getValue<T >(source: T | ((session: Session) => T)): T {
    return typeof source === 'function' ? Reflect.apply(source, null, [this]) : source
  }

  async getChannel<K extends Channel.Field = never>(id: string = this.channelId, assignee = '', fields: readonly K[] = []) {
    const group = await this.database.getChannel(this.platform, id, fields)
    if (group) return group
    const fallback = Channel.create(this.platform, id)
    fallback.assignee = assignee
    if (assignee) {
      await this.database.createChannel(this.platform, id, fallback)
    }
    return fallback
  }

  /** 在当前会话上绑定一个可观测频道实例 */
  async observeChannel<T extends Channel.Field = never>(fields: Iterable<T> = []): Promise<Channel.Observed<T | G>> {
    const fieldSet = new Set<Channel.Field>(fields)
    const { platform, channelId, $channel } = this

    // 对于已经绑定可观测频道的，判断字段是否需要自动补充
    if ($channel) {
      for (const key in $channel) {
        fieldSet.delete(key as any)
      }
      if (fieldSet.size) {
        const data = await this.getChannel(channelId, '', [...fieldSet])
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
    const assignee = this._getValue(this.$app.options.autoAssign) ? this.selfId : ''
    const data = await this.getChannel(channelId, assignee, fieldArray)
    const group = observe(data, diff => this.database.setChannel(platform, channelId, diff), `group ${channelId}`)
    this.$app._groupCache.set(this.cid, group)
    return this.$channel = group
  }

  async getUser<K extends User.Field = never>(id: string = this.userId, authority = 0, fields: readonly K[] = []) {
    const user = await this.database.getUser(this.platform, id, fields)
    if (user) return user
    const fallback = User.create(this.platform, id)
    fallback.authority = authority
    if (authority) {
      await this.database.createUser(this.platform, id as any, fallback)
    }
    return fallback
  }

  /** 在当前会话上绑定一个可观测用户实例 */
  async observeUser<T extends User.Field = never>(fields: Iterable<T> = []): Promise<User.Observed<T | U>> {
    const fieldSet = new Set<User.Field>(fields)
    const { userId, $user } = this

    let userCache = this.$app._userCache[this.platform]
    if (!userCache) {
      userCache = this.$app._userCache[this.platform] = new LruCache({
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
        const data = await this.getUser(userId, 0, [...fieldSet])
        userCache.set(userId, $user._merge(data) as any)
      }
    }

    if ($user) return $user as any

    // 确保匿名消息不会写回数据库
    if (this.anonymous) {
      const fallback = User.create(this.platform, userId)
      fallback.authority = this._getValue(this.$app.options.autoAuthorize)
      const user = observe(fallback, () => Promise.resolve())
      return this.$user = user
    }

    // 如果存在满足可用的缓存数据，使用缓存代替数据获取
    const cache = userCache.get(userId)
    const fieldArray = [...fieldSet]
    const hasActiveCache = cache && contain(Object.keys(cache), fieldArray)
    if (hasActiveCache) return this.$user = cache as any

    // 绑定一个新的可观测用户实例
    const data = await this.getUser(userId, this._getValue(this.$app.options.autoAuthorize), fieldArray)
    const user = observe(data, diff => this.database.setUser(this.platform, userId as any, diff), `user ${userId}`)
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
      }
      if (!this.resolve(argv)) return
      collectFields(argv, argv.command[`_${key}Fields`], fields)
    }
    collect(argv)
    return fields
  }

  resolve(argv: Argv) {
    if (!argv.command) {
      const { name = this.$app.bail('parse', argv, this) } = argv
      if (!(argv.command = this.$app._commandMap[name])) return
    }
    if (argv.tokens?.every(token => !token.inters.length)) {
      const { options, args, error } = argv.command.parse(argv)
      argv.options = { ...argv.options, ...options }
      argv.args = [...argv.args || [], ...args]
      argv.error = error
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

    if (this.database) {
      if (this.subtype === 'group') {
        await this.observeChannel(this.collect('channel', argv))
      }
      await this.observeUser(this.collect('user', argv))
    }

    const result = await argv.command.execute(argv, next)
    if (!argv.parent) await this.send(result)
    return result
  }

  middleware(middleware: Middleware) {
    const identifier = getSessionId(this)
    return this.$app.middleware(async (session, next) => {
      if (identifier && getSessionId(session) !== identifier) return next()
      return middleware(session, next)
    }, true)
  }

  prompt(timeout = this.$app.options.delay.prompt) {
    return new Promise((resolve) => {
      const dispose = this.middleware((session) => {
        clearTimeout(timer)
        dispose()
        resolve(session.content)
      })
      const timer = setTimeout(() => {
        dispose()
        resolve('')
      }, timeout)
    })
  }

  suggest(options: SuggestOptions) {
    const {
      target,
      items,
      prefix = '',
      suffix,
      apply,
      next = callback => callback(),
      coefficient = this.$app.options.similarityCoefficient,
    } = options

    let suggestions: string[], minDistance = Infinity
    for (const name of items) {
      const dist = distance(name, target)
      if (name.length <= 2 || dist > name.length * coefficient) continue
      if (dist === minDistance) {
        suggestions.push(name)
      } else if (dist < minDistance) {
        suggestions = [name]
        minDistance = dist
      }
    }
    if (!suggestions) return next(() => this.send(prefix))

    return next(() => {
      const message = prefix + template('internal.suggestion', suggestions.map(template.quote).join(template.get('basic.or')))
      if (suggestions.length > 1) return this.send(message)

      const dispose = this.middleware((session, next) => {
        dispose()
        const message = session.content.trim()
        if (message && message !== '.' && message !== '。') return next()
        return apply.call(session, suggestions[0], next)
      })

      return this.send(message + suffix)
    })
  }
}

export interface SuggestOptions {
  target: string
  items: string[]
  next?: NextFunction
  prefix?: string
  suffix: string
  coefficient?: number
  apply: (this: Session, suggestion: string, next: NextFunction) => void
}

export function getSessionId(session: Session) {
  return '' + session.userId + session.channelId
}

export type FieldCollector<T extends TableType, K = keyof Tables[T], A extends any[] = any[], O = {}> =
  | Iterable<K>
  | ((argv: Argv<never, never, A, O>, fields: Set<keyof Tables[T]>) => void)

function collectFields<T extends TableType>(argv: Argv, collectors: FieldCollector<T>[], fields: Set<keyof Tables[T]>) {
  for (const collector of collectors) {
    if (typeof collector === 'function') {
      collector(argv, fields)
      continue
    }
    for (const field of collector) {
      fields.add(field)
    }
  }
  return fields
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
  subtype?: keyof Session.Events['message']
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
  nick?: string
  roles?: string[]
}

export interface AuthorInfo extends GroupMemberInfo {}
