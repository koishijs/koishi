import { Channel, Tables, User } from './database'
import { Command } from './command'
import { defineProperty, Logger, makeArray, observe, Promisify, Random, segment } from '@koishijs/utils'
import { Argv } from './parser'
import { Middleware, Next } from './context'
import { App } from './app'
import { Bot } from './bot'

type Genres = 'friend' | 'channel' | 'guild' | 'guild-member' | 'guild-role' | 'guild-file' | 'guild-emoji'
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
    'guild-member/role': SessionEventCallback
    'guild-member/ban': SessionEventCallback
    'guild-member/nickname': SessionEventCallback
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
    platform?: string
    selfId: string
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
  scope?: string

  bot: Bot
  app: App

  selfId: string
  operatorId?: string
  targetId?: string
  duration?: number
  file?: FileInfo

  id: string
  platform?: string
  argv?: Argv<U, G>
  user?: User.Observed<U>
  channel?: Channel.Observed<G>
  guild?: Channel.Observed<G>
  parsed?: Parsed

  private _promise: Promise<string>
  private _queued: NodeJS.Timeout
  private _queuedMessages: [string, number][]

  constructor(bot: Bot, session: Partial<Session.Payload>) {
    Object.assign(this, session)
    this.platform = bot.platform
    defineProperty(this, 'app', bot.app)
    defineProperty(this, 'bot', bot)
    defineProperty(this, 'user', null)
    defineProperty(this, 'channel', null)
    defineProperty(this, 'id', Random.id())
    defineProperty(this, '_queuedMessages', [])
    defineProperty(this, '_queued', undefined)
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
    })) as any
  }

  private async _preprocess() {
    let node: segment.Parsed
    let content = this.content.trim()
    // eslint-disable-next-line no-cond-assign
    if (node = segment.from(content, { type: 'quote', caret: true })) {
      content = content.slice(node.capture[0].length).trimStart()
      this.quote = await this.bot.getMessage(node.data.channelId || this.channelId, node.data.id).catch((error) => {
        logger.warn(error)
        return undefined
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
    if (typeof this._queued !== 'undefined') clearTimeout(this._queued)
    this._queuedMessages = []
    this._queued = setTimeout(() => this._next(), delay)
  }

  private _next() {
    const message = this._queuedMessages.shift()
    if (typeof message === 'undefined') {
      this._queued = undefined
      return
    }
    this.send(message[0])
    this._queued = setTimeout(() => this._next(), message[1])
  }

  async sendQueued(content: string, delay?: number) {
    if (!content) return
    if (typeof delay === 'undefined') {
      const { message, character } = this.app.options.delay
      delay = Math.max(message, character * content.length)
    }
    this._queuedMessages.push([content, delay])
    if (typeof this._queued === 'undefined') this._next()
  }

  resolveValue<T>(source: T | ((session: Session) => T)): T {
    return typeof source === 'function' ? Reflect.apply(source, null, [this]) : source
  }

  async getChannel<K extends Channel.Field = never>(id = this.channelId, fields: K[] = []) {
    const { app, platform, guildId } = this
    if (!fields.length) return { platform, id, guildId }
    const channel = await app.database.getChannel(platform, id, fields)
    if (channel) return channel
    const assignee = await this.resolveValue(app.options.autoAssign) ? this.selfId : ''
    if (assignee) {
      return app.database.createChannel(platform, id, { assignee, guildId })
    } else {
      const channel = app.model.tables.channel.create()
      Object.assign(channel, { platform, id, guildId })
      return channel
    }
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
      if (!fieldSet.size) return cache
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
    return cache
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
    const { app, platform } = this
    if (!fields.length) return { [platform]: id }
    const user = await app.database.getUser(platform, id, fields)
    if (user) return user
    const authority = await this.resolveValue(app.options.autoAuthorize)
    if (authority) {
      return app.database.createUser(platform, id, { authority })
    } else {
      const user = app.model.tables.user.create()
      Object.assign(user, { [platform]: id, authority })
      return user
    }
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
      const fallback = this.app.model.tables.user.create()
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

  async withScope<T>(scope: string, callback: () => T) {
    const oldScope = this.scope
    try {
      this.scope = scope
      return await callback() as Promisify<T>
    } finally {
      this.scope = oldScope
    }
  }

  text(path: string | string[], params: object = {}) {
    const locales = [this.app.options.locale]
    locales.unshift(this.user?.['locale'])
    if (this.subtype === 'group') {
      locales.unshift(this.guild?.['locale'])
      locales.unshift(this.channel?.['locale'])
    }
    const paths = makeArray(path).map((path) => {
      if (!path.startsWith('.')) return path
      if (!this.scope) {
        this.app.logger('i18n').warn(new Error('missing scope'))
        return ''
      }
      return this.scope + path
    })
    return this.app.i18n.text(locales, paths, params)
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

    const { command } = argv
    if (!command.context.match(this)) return ''

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

    return this.withScope(`commands.${command.name}.messages`, async () => {
      const result = await command.execute(argv as Argv, next as Next)
      if (!shouldEmit) return result
      await this.send(result)
      return ''
    })
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
}

export function getSessionId(session: Session) {
  return '' + session.userId + session.channelId
}

export type FieldCollector<T extends keyof Tables, K = keyof Tables[T], A extends any[] = any[], O = {}> =
  | Iterable<K>
  | ((argv: Argv<never, never, A, O>, fields: Set<keyof Tables[T]>) => void)

function collectFields<T extends keyof Tables>(argv: Argv, collectors: FieldCollector<T>[], fields: Set<keyof Tables[T]>) {
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
