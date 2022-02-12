import { distance } from 'fastest-levenshtein'
import { User, Channel } from './database'
import { TableType, Tables } from './orm'
import { Command } from './command'
import { Awaitable, contain, observe, Logger, defineProperty, Random, template, remove, segment } from '@koishijs/utils'
import { Argv } from './parser'
import { Middleware, Next } from './context'
import { App } from './app'
import { Bot } from './bot'

type Genres = 'friend' | 'channel' | 'group' | 'group-member' | 'group-role' | 'group-file' | 'group-emoji'
type Actions = 'added' | 'deleted' | 'updated'
type SessionEventCallback = (session: Session) => void

declare module './context' {
  interface EventMap extends Record<`${Genres}-${Actions}`, SessionEventCallback> {
    'message': SessionEventCallback
    'message-deleted': SessionEventCallback
    'message-updated': SessionEventCallback
    'reaction-added': SessionEventCallback
    'reaction-deleted': SessionEventCallback
    'reaction-deleted/one': SessionEventCallback
    'reaction-deleted/all': SessionEventCallback
    'reaction-deleted/emoji': SessionEventCallback
    'send': SessionEventCallback
    'friend-request': SessionEventCallback
    'guild-request': SessionEventCallback
    'guild-member-request': SessionEventCallback
    'group-member/role': SessionEventCallback
    'group-member/ban': SessionEventCallback
    'group-member/nickname': SessionEventCallback
    'notice/poke': SessionEventCallback
    'notice/lucky-king': SessionEventCallback
    'notice/honor': SessionEventCallback
    'notice/honor/talkative': SessionEventCallback
    'notice/honor/performer': SessionEventCallback
    'notice/honor/emotion': SessionEventCallback
  }
}

const logger = new Logger('session')

export interface Session extends Session.Payload {}

export namespace Session {
  export interface Payload {
    id?: string
    platform?: string
    selfId?: string
    type?: string
    subtype?: string
    messageId?: string
    channelId?: string
    guildId?: string
    userId?: string
    content?: string
    timestamp?: number
    author?: Bot.Author
    quote?: Bot.Message
    channelName?: string
    guildName?: string
    operatorId?: string
    targetId?: string
    duration?: number
    file?: FileInfo
  }
}

export interface Parsed {
  content: string
  prefix: string
  appel: boolean
}

export type Computed<T> = T | ((session: Session) => T)

export class Session<U extends User.Field = never, G extends Channel.Field = never> {
  type?: string
  subtype?: string
  subsubtype?: string

  bot: Bot
  app: App

  selfId?: string
  operatorId?: string
  targetId?: string
  duration?: number
  file?: FileInfo

  id?: string
  platform?: string
  argv?: Argv<U, G>
  user?: User.Observed<U>
  channel?: Channel.Observed<G>
  guild?: Channel.Observed<G>
  parsed?: Parsed

  private _delay?: number
  private _queued: Promise<void>
  private _hooks: (() => void)[]
  private _promise: Promise<string>

  constructor(bot: Bot, session: Session.Payload) {
    Object.assign(this, session)
    this.platform = bot.platform
    defineProperty(this, 'app', bot.app)
    defineProperty(this, 'bot', bot)
    defineProperty(this, 'user', null)
    defineProperty(this, 'channel', null)
    defineProperty(this, 'id', Random.id())
    defineProperty(this, '_queued', Promise.resolve())
    defineProperty(this, '_hooks', [])
  }

  get uid() {
    return `${this.platform}:${this.userId}`
  }

  get gid() {
    return `${this.platform}:${this.guildId}`
  }

  get cid() {
    return `${this.platform}:${this.channelId}`
  }

  get sid() {
    return `${this.platform}:${this.selfId}`
  }

  toJSON(): Session.Payload {
    return Object.fromEntries(Object.entries(this).filter(([key]) => {
      return !key.startsWith('_') && !key.startsWith('$')
    }))
  }

  private async _preprocess() {
    let node: segment.Parsed
    let content = this.content.trim()
    // eslint-disable-next-line no-cond-assign
    if (node = segment.from(content, { type: 'quote', caret: true })) {
      content = content.slice(node.capture[0].length).trimStart()
      this.quote = await this.bot.getMessage(node.data.channelId || this.channelId, node.data.id).catch((error) => {
        logger.warn(error)
        return null
      })
    }
    return content
  }

  async preprocess() {
    return this._promise ||= this._preprocess()
  }

  get username(): string {
    const defaultName = this.user && this.user['name']
      ? this.user['name']
      : this.author
        ? this.author.nickname || this.author.username
        : this.userId
    return this.app.chain('appellation', defaultName, this)
  }

  async send(content: string) {
    if (!content) return
    return this.bot.sendMessage(this.channelId, content, this.guildId).catch<string[]>((error) => {
      logger.warn(error)
      return []
    })
  }

  cancelQueued(delay = this.app.options.delay.cancel) {
    this._hooks.forEach(Reflect.apply)
    this._delay = delay
  }

  async sendQueued(content: string, delay?: number) {
    if (!content) return
    if (typeof delay === 'undefined') {
      const { message, character } = this.app.options.delay
      delay = Math.max(message, character * content.length)
    }
    return this._queued = this._queued.then(() => new Promise<void>((resolve) => {
      const hook = () => {
        resolve()
        clearTimeout(timer)
        remove(this._hooks, hook)
      }
      this._hooks.push(hook)
      const timer = setTimeout(async () => {
        await this.send(content)
        this._delay = delay
        hook()
      }, this._delay || 0)
    }))
  }

  resolveValue<T>(source: T | ((session: Session) => T)): T {
    return typeof source === 'function' ? Reflect.apply(source, null, [this]) : source
  }

  async getChannel<K extends Channel.Field = never>(id = this.channelId, fields: K[] = []) {
    if (!fields.length) return { platform: this.platform, id }
    const channel = await this.app.database.getChannel(this.platform, id, fields)
    if (channel) return channel
    const assignee = await this.resolveValue(this.app.options.autoAssign) ? this.selfId : ''
    return this.app.database.createChannel(this.platform, id, { assignee, guildId: this.guildId })
  }

  /** 在当前会话上绑定一个可观测频道实例 */
  async _observeChannelLike<T extends Channel.Field = never>(channelId: string, fields: Iterable<T> = []) {
    const fieldSet = new Set<Channel.Field>(fields)
    const { platform } = this
    const key = `${platform}:${channelId}`

    // 如果存在满足可用的缓存数据，使用缓存代替数据获取
    let cache = this.app._channelCache.get(this.id, key)
    if (cache) {
      for (const key in cache) {
        fieldSet.delete(key as any)
      }
      if (!fieldSet.size) return this.channel = cache
    }

    // 绑定一个新的可观测频道实例
    const data = await this.getChannel(channelId, [...fieldSet])
    cache = this.app._channelCache.get(this.id, key)
    if (cache) {
      cache.$merge(data)
    } else {
      cache = observe(data, diff => this.app.database.setChannel(platform, channelId, diff), `channel ${key}`)
      this.app._channelCache.set(this.id, key, cache)
    }
    return this.channel = cache
  }

  async observeChannel<T extends Channel.Field = never>(fields: Iterable<T> = []): Promise<Channel.Observed<T | G>> {
    const tasks = [this._observeChannelLike(this.channelId, fields)]
    if (this.channelId !== this.guildId) {
      tasks.push(this._observeChannelLike(this.guildId, fields))
    }
    const [channel, guild = channel] = await Promise.all(tasks)
    this.guild = guild
    this.channel = channel
    return channel
  }

  async getUser<K extends User.Field = never>(id = this.userId, fields: K[] = []) {
    if (!fields.length) return { [this.platform]: id }
    const user = await this.app.database.getUser(this.platform, id, fields)
    if (user) return user
    const authority = await this.resolveValue(this.app.options.autoAuthorize)
    return this.app.database.createUser(this.platform, id, { authority })
  }

  /** 在当前会话上绑定一个可观测用户实例 */
  async observeUser<T extends User.Field = never>(fields: Iterable<T> = []): Promise<User.Observed<T | U>> {
    const fieldSet = new Set<User.Field>(fields)
    const { userId, platform } = this

    // 如果存在满足可用的缓存数据，使用缓存代替数据获取
    let cache = this.app._userCache.get(this.id, this.uid)
    if (cache) {
      for (const key in cache) {
        fieldSet.delete(key as any)
      }
      if (!fieldSet.size) return this.user = cache
    }

    // 匿名消息不会写回数据库
    if (this.author?.anonymous) {
      const fallback = this.app.model.create('user')
      fallback[platform] = userId
      fallback.authority = await this.resolveValue(this.app.options.autoAuthorize)
      const user = observe(fallback, () => Promise.resolve())
      return this.user = user
    }

    // 绑定一个新的可观测用户实例
    const data = await this.getUser(userId, [...fieldSet])
    cache = this.app._userCache.get(this.id, this.uid)
    if (cache) {
      cache.$merge(data)
    } else {
      cache = observe(data, diff => this.app.database.setUser(this.platform, userId, diff), `user ${this.uid}`)
      this.app._userCache.set(this.id, this.uid, cache)
    }
    return this.user = cache
  }

  collect<T extends 'user' | 'channel'>(key: T, argv: Argv, fields = new Set<keyof Tables[T]>()) {
    const collect = (argv: Argv) => {
      argv.session = this
      if (argv.tokens) {
        for (const { inters } of argv.tokens) {
          inters.forEach(collect)
        }
      }
      if (!this.resolve(argv)) return
      this.app.emit(argv.session, `command/before-attach-${key}` as any, argv, fields)
      collectFields(argv, Command[`_${key}Fields`] as any, fields)
      collectFields(argv, argv.command[`_${key}Fields`] as any, fields)
    }
    collect(argv)
    return fields
  }

  private inferCommand(argv: Argv) {
    if (argv.command) return argv.command
    if (argv.name) return argv.command = this.app._commands.resolve(argv.name)

    const { parsed, subtype } = this
    // guild message should have prefix or appel to be interpreted as a command call
    if (argv.root && subtype !== 'private' && parsed.prefix === null && !parsed.appel) return
    if (!argv.tokens.length) return
    const cmd = this.app._commands.resolve(argv.tokens[0].content)
    if (cmd) {
      argv.tokens.shift()
      return argv.command = cmd
    }
  }

  resolve(argv: Argv) {
    if (!this.inferCommand(argv)) return
    if (argv.tokens?.every(token => !token.inters.length)) {
      const { options, args, error } = argv.command.parse(argv)
      argv.options = { ...argv.options, ...options }
      argv.args = [...argv.args || [], ...args]
      argv.error = error
    }
    return argv.command
  }

  async execute(content: string, next?: true | Next): Promise<string>
  async execute(argv: Argv, next?: true | Next): Promise<string>
  async execute(argv: string | Argv, next?: true | Next): Promise<string> {
    if (typeof argv === 'string') argv = Argv.parse(argv)

    argv.session = this
    if (argv.tokens) {
      for (const arg of argv.tokens) {
        const { inters } = arg
        const output: string[] = []
        for (let i = 0; i < inters.length; ++i) {
          output.push(await this.execute(inters[i], true))
        }
        for (let i = inters.length - 1; i >= 0; --i) {
          const { pos } = inters[i]
          arg.content = arg.content.slice(0, pos) + output[i] + arg.content.slice(pos)
        }
        arg.inters = []
      }
      if (!this.resolve(argv)) return ''
    } else {
      argv.command ||= this.app.getCommand(argv.name)
      if (!argv.command) {
        logger.warn(new Error(`cannot find command ${argv.name}`))
        return ''
      }
    }

    if (!argv.command.context.match(this)) return ''

    if (this.app.database) {
      if (this.subtype === 'group') {
        await this.observeChannel(this.collect('channel', argv))
      }
      await this.observeUser(this.collect('user', argv))
    }

    let shouldEmit = true
    if (next === true) {
      shouldEmit = false
      next = undefined as Next
    }

    const result = await argv.command.execute(argv, next)
    if (!shouldEmit) return result
    await this.send(result)
    return ''
  }

  middleware(middleware: Middleware) {
    const identifier = getSessionId(this)
    return this.app.middleware(async (session, next) => {
      if (identifier && getSessionId(session) !== identifier) return next()
      return middleware(session, next)
    }, true)
  }

  prompt(timeout = this.app.options.delay.prompt) {
    return new Promise<string>((resolve) => {
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
      next = Next.compose,
      minSimilarity = this.app.options.minSimilarity,
    } = options

    const sendNext = async (callback: Next) => {
      const result = await next(callback)
      if (result) await this.send(result)
    }

    let suggestions: string[], minDistance = Infinity
    for (const name of items) {
      const dist = distance(name, target)
      if (name.length <= 2 || dist > name.length * minSimilarity) continue
      if (dist === minDistance) {
        suggestions.push(name)
      } else if (dist < minDistance) {
        suggestions = [name]
        minDistance = dist
      }
    }
    if (!suggestions) return sendNext(async () => prefix)

    return sendNext(async () => {
      const message = prefix + template('internal.suggestion', suggestions.map(template.quote).join(template.get('basic.or')))
      if (suggestions.length > 1) return message

      const dispose = this.middleware((session, next) => {
        dispose()
        const message = session.content.trim()
        if (message && message !== '.' && message !== '。') return next()
        return apply.call(session, suggestions[0], next)
      })

      return message + suffix
    })
  }
}

export interface SuggestOptions {
  target: string
  items: string[]
  next?: Next
  prefix?: string
  suffix: string
  minSimilarity?: number
  apply: (this: Session, suggestion: string, next: Next) => Awaitable<void | string>
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

export interface FileInfo {
  id: string
  name: string
  size: number
  busid: number
}
