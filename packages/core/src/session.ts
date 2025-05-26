import { observe } from '@koishijs/utils'
import { Awaitable, isNullable, makeArray } from 'cosmokit'
import { Fragment, h, Logger, Universal } from '@satorijs/core'
import { Eval, executeEval, isEvalExpr } from 'minato'
import * as satori from '@satorijs/core'
import { Argv } from './command'
import { Context } from './context'
import { Channel, Tables, User } from './database'
import { Middleware, Next } from './middleware'
import { CompareOptions } from './i18n'

const logger = new Logger('session')

export interface PromptOptions {
  timeout?: number
}

export interface SuggestOptions extends CompareOptions {
  actual?: string
  expect: readonly string[]
  filter?: (name: string) => Awaitable<boolean>
  prefix?: string
  suffix: string
  timeout?: number
}

export interface Stripped {
  content: string
  prefix: string
  appel: boolean
  hasAt: boolean
  atSelf: boolean
}

interface Task {
  delay: number
  content: Fragment
  resolve(ids: string[]): void
  reject(reason: any): void
}

export type FieldCollector<T extends keyof Tables, K = keyof Tables[T], A extends any[] = any[], O extends {} = {}> =
  | Iterable<K>
  | ((argv: Argv<never, never, A, O>, fields: Set<keyof Tables[T]>) => void)

function collectFields<T extends keyof Tables>(argv: Argv, collectors: FieldCollector<T>[], fields: Set<any>) {
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

export interface Session<U extends User.Field = never, G extends Channel.Field = never, C extends Context = Context> extends satori.Session<C> {
  argv?: Argv<U, G>
  user?: User.Observed<U>
  channel?: Channel.Observed<G>
  guild?: Channel.Observed<G>
  permissions: string[]
  scope?: string
  response?: () => Promise<Fragment>
  resolve<T, R extends any[]>(source: T | Eval.Expr | ((session: this, ...args: R) => T), ...args: R):
    | T extends Eval.Expr ? Eval<T>
    : T extends (...args: any[]) => any ? ReturnType<T>
    : T
  stripped: Stripped
  username: string
  send(fragment: Fragment, options?: Universal.SendOptions): Promise<string[]>
  cancelQueued(delay?: number): void
  sendQueued(content: Fragment, delay?: number): Promise<string[]>
  getChannel<K extends Channel.Field = never>(id?: string, fields?: K[]): Promise<Channel>
  observeChannel<T extends Channel.Field = never>(fields: Iterable<T>): Promise<Channel.Observed<T | G>>
  getUser<K extends User.Field = never>(userId?: string, fields?: K[]): Promise<User>
  observeUser<T extends User.Field = never>(fields: Iterable<T>): Promise<User.Observed<T | U>>
  withScope(scope: string, callback: () => Awaitable<h[]>): Promise<h[]>
  resolveScope(path: string): string
  text(path: string | string[], params?: object): string
  i18n(path: string | string[], params?: object): h[]
  collect<T extends 'user' | 'channel'>(key: T, argv: Argv, fields?: Set<keyof Tables[T]>): Set<keyof Tables[T]>
  execute(content: string | Argv, next?: true | Next): Promise<h[]>
  middleware(middleware: Middleware<this>): () => boolean
  prompt(timeout?: number): Promise<string>
  prompt<T>(callback: (session: this) => Awaitable<T>, options?: PromptOptions): Promise<T>
  suggest(options: SuggestOptions): Promise<string>
}

interface KoishiSession<U extends User.Field, G extends Channel.Field, C extends Context> extends Session<U, G, C> {
  // DO NOT set class properties here,
  // because they will override the actual properties in the instance.
  _stripped: Stripped
  _queuedTasks: Task[]
  _queuedTimeout: NodeJS.Timeout
}

class KoishiSession<U, G, C> {
  constructor(ctx: C) {
    ctx.mixin(this, {
      resolve: 'session.resolve',
      stripped: 'session.stripped',
      username: 'session.username',
      send: 'session.send',
      cancelQueued: 'session.cancelQueued',
      sendQueued: 'session.sendQueued',
      getChannel: 'session.getChannel',
      observeChannel: 'session.observeChannel',
      getUser: 'session.getUser',
      observeUser: 'session.observeUser',
      withScope: 'session.withScope',
      resolveScope: 'session.resolveScope',
      text: 'session.text',
      i18n: 'session.i18n',
      collect: 'session.collect',
      execute: 'session.execute',
      middleware: 'session.middleware',
      prompt: 'session.prompt',
      suggest: 'session.suggest',
    })
  }

  resolve<T, R extends any[]>(source: T | Eval.Expr | ((session: this, ...args: R) => T), ...args: R):
    | T extends Eval.Expr ? Eval<T>
    : T extends (...args: any[]) => any ? ReturnType<T>
    : T

  resolve(source: any, ...params: any[]) {
    if (typeof source === 'function') {
      return Reflect.apply(source, null, [this, ...params])
    }
    if (!isEvalExpr(source)) return source
    return executeEval({ _: this }, source)
  }

  _stripNickname(content: string) {
    if (content.startsWith('@')) content = content.slice(1)
    for (const nickname of this.resolve(this.app.koishi.config.nickname) ?? []) {
      if (!content.startsWith(nickname)) continue
      const rest = content.slice(nickname.length)
      const capture = /^([,，]\s*|\s+)/.exec(rest)
      if (!capture) continue
      return rest.slice(capture[0].length)
    }
  }

  /** @deprecated */
  get parsed() {
    return this.stripped
  }

  get stripped() {
    if (this._stripped) return this._stripped
    if (!this.elements) return {} as Stripped

    // strip mentions
    let atSelf = false, appel = false
    let hasAt = false
    const elements = this.elements.slice()
    while (elements[0]?.type === 'at') {
      const { attrs } = elements.shift()
      if (attrs.id === this.selfId) {
        atSelf = appel = true
      }
      // quote messages may contain mentions
      if (!this.quote?.user?.id || this.quote.user.id !== attrs.id) {
        hasAt = true
      }
      // @ts-ignore
      if (elements[0]?.type === 'text' && !elements[0].attrs.content.trim()) {
        elements.shift()
      }
    }

    let content = elements.join('').trim()
    if (!hasAt) {
      // strip nickname
      const result = this._stripNickname(content)
      if (result) {
        appel = true
        content = result
      }
    }

    return this._stripped = { hasAt, content, appel, atSelf, prefix: null }
  }

  get username(): string {
    return this.user && this.user['name']
      ? this.user['name']
      : this.author.nick || this.author.name || this.userId
  }

  async send(fragment: Fragment, options: Universal.SendOptions = {}) {
    const elements = h.normalize(fragment)
    if (!elements.length) return
    options.session = this
    return this.bot.sendMessage(this.channelId, elements, this.event.referrer, options).catch<string[]>((error) => {
      logger.warn(error)
      return []
    })
  }

  cancelQueued(delay = this.app.koishi.config.delay.cancel) {
    clearTimeout(this._queuedTimeout)
    this._queuedTasks = []
    this._queuedTimeout = setTimeout(() => this._next(), delay)
  }

  _next() {
    const task = this._queuedTasks?.shift()
    if (!task) {
      this._queuedTimeout = null
      return
    }
    this.send(task.content).then(task.resolve, task.reject)
    this._queuedTimeout = setTimeout(() => this._next(), task.delay)
  }

  async sendQueued(content: Fragment, delay?: number) {
    const text = h.normalize(content).join('')
    if (!text) return
    if (isNullable(delay)) {
      const { message, character } = this.app.koishi.config.delay
      delay = Math.max(message, character * text.length)
    }
    return new Promise<string[]>((resolve, reject) => {
      (this._queuedTasks ??= []).push({ content, delay, resolve, reject })
      if (!this._queuedTimeout) this._next()
    })
  }

  async getChannel<K extends Channel.Field = never>(id = this.channelId, fields: K[] = []) {
    const { app, platform, guildId } = this
    if (!fields.length) return { platform, id, guildId } as Channel
    const channel = await app.database.getChannel(platform, id, fields)
    if (channel) return channel
    const assignee = this.resolve(app.koishi.config.autoAssign) ? this.selfId : ''
    if (assignee) {
      return app.database.createChannel(platform, id, { assignee, guildId, createdAt: new Date() })
    } else {
      const channel = app.model.tables.channel.create()
      Object.assign(channel, { platform, id, guildId, $detached: true })
      return channel
    }
  }

  async _observeChannelLike<K extends Channel.Field = never>(channelId: string, fields: Iterable<K> = []) {
    const fieldSet = new Set<Channel.Field>(fields)
    const { platform } = this
    const key = `${platform}:${channelId}`

    const data = await this.getChannel(channelId, [...fieldSet])
    const cache = observe(data, async (diff) => {
      // https://github.com/koishijs/koishi/issues/1267
      if (data['$detached']) return
      await this.app.database.setChannel(platform, channelId, diff as any)
    }, `channel ${key}`)
    return cache
  }

  async observeChannel<T extends Channel.Field = never>(fields: Iterable<T>): Promise<Channel.Observed<T | G>> {
    const tasks = [this._observeChannelLike(this.channelId, fields)]
    if (this.channelId !== this.guildId) {
      tasks.push(this._observeChannelLike(this.guildId, fields))
    }
    const [channel, guild = channel] = await Promise.all(tasks)
    this.guild = guild
    this.channel = channel
    return channel
  }

  async getUser<K extends User.Field = never>(userId = this.userId, fields: K[] = []) {
    const { app, platform } = this
    if (!fields.length) return {} as User
    const user = await app.database.getUser(platform, userId, fields)
    if (user) return user
    const authority = this.resolve(app.koishi.config.autoAuthorize)
    const data = { locales: this.locales, authority, createdAt: new Date() }
    if (authority) {
      return app.database.createUser(platform, userId, data)
    } else {
      const user = app.model.tables.user.create()
      Object.assign(user, { ...data, $detached: true })
      return user
    }
  }

  async observeUser<T extends User.Field = never>(fields: Iterable<T>): Promise<User.Observed<T | U>> {
    const fieldSet = new Set<User.Field>(fields)
    const { userId } = this

    let cache = this.user
    if (cache) {
      for (const key in cache) {
        fieldSet.delete(key as any)
      }
      if (!fieldSet.size) return this.user = cache as any
    }

    if (this.author?.['anonymous']) {
      const fallback = this.app.model.tables.user.create()
      fallback.authority = this.resolve(this.app.koishi.config.autoAuthorize)
      const user = observe(fallback, () => Promise.resolve())
      return this.user = user
    }

    const data = await this.getUser(userId, [...fieldSet])
    cache = this.user
    if (cache) {
      cache.$merge(data)
    } else {
      cache = observe(data, async (diff) => {
        // https://github.com/koishijs/koishi/issues/1267
        if (data['$detached']) return
        await this.app.database.setUser(this.platform, userId, diff as any)
      }, `user ${this.uid}`)
    }
    return this.user = cache as any
  }

  async withScope(scope: string, callback: () => Awaitable<h[]>): Promise<h[]> {
    const oldScope = this.scope
    try {
      this.scope = scope
      const result = await callback()
      return h.transform(result, {
        i18n: (params, children) => h.i18n({
          ...params,
          path: this.resolveScope(params.path),
        }, children),
      }, this)
    } finally {
      this.scope = oldScope
    }
  }

  resolveScope(path: string) {
    if (!path.startsWith('.')) return path
    if (!this.scope) {
      this.app.logger('i18n').warn(new Error(`missing scope for "${path}"`))
      return ''
    }
    return this.scope + path
  }

  text(path: string | string[], params: object = {}) {
    return this.i18n(path, params).join('')
  }

  i18n(path: string | string[], params: object = {}) {
    const locales: string[] = [
      ...(this.channel as Channel.Observed)?.locales || [],
      ...(this.guild as Channel.Observed)?.locales || [],
    ]
    if (this.app.koishi.config.i18n.output === 'prefer-user') {
      locales.unshift(...(this.user as User.Observed)?.locales || [])
    } else {
      locales.push(...(this.user as User.Observed)?.locales || [])
    }
    locales.unshift(...this.locales || [])
    const paths = makeArray(path).map((path) => this.resolveScope(path))
    return this.app.i18n.render(locales, paths, params)
  }

  collect<T extends 'user' | 'channel'>(key: T, argv: Argv, fields = new Set<keyof Tables[T]>()): Set<keyof Tables[T]> {
    const collect = (argv: Argv) => {
      argv.session = this
      if (argv.tokens) {
        for (const { inters } of argv.tokens) {
          inters.forEach(collect)
        }
      }
      if (!this.app.$commander.resolveCommand(argv)) return
      ;(this.app as Context).emit(argv.session, `command/before-attach-${key}` as any, argv, fields)
      collectFields(argv, argv.command[`_${key}Fields` as any], fields)
    }
    if (argv) collect(argv)
    return fields
  }

  async execute(argv: string | Argv, next?: true | Next) {
    if (typeof argv === 'string') argv = Argv.parse(argv)

    argv.session = this
    if (argv.tokens) {
      for (const arg of argv.tokens) {
        const { inters } = arg
        const output: string[] = []
        for (let i = 0; i < inters.length; ++i) {
          const execution = await this.execute(inters[i], true)
          const transformed = await this.transform(execution)
          output.push(transformed.join(''))
        }
        for (let i = inters.length - 1; i >= 0; --i) {
          const { pos } = inters[i]
          arg.content = arg.content.slice(0, pos) + output[i] + arg.content.slice(pos)
        }
        arg.inters = []
      }
      if (!this.app.$commander.resolveCommand(argv)) return []
    } else {
      argv.command ||= this.app.$commander.get(argv.name)
      if (!argv.command) {
        logger.warn(new Error(`cannot find command ${argv.name}`))
        return []
      }
    }

    const { command } = argv
    if (!command.ctx.filter(this)) return []

    if (this.app.database) {
      if (!this.isDirect) {
        await this.observeChannel(this.collect('channel', argv, new Set(['permissions', 'locales'])))
      }
      await this.observeUser(this.collect('user', argv, new Set(['authority', 'permissions', 'locales'])))
    }

    let shouldEmit = true
    if (next === true) {
      shouldEmit = false
      next = undefined as Next
    }

    return this.withScope(`commands.${command.name}.messages`, async () => {
      const result = await command.execute(argv as Argv, next as Next)
      if (!shouldEmit) return h.normalize(result)
      await this.send(result)
      return []
    })
  }

  middleware(middleware: Middleware<this>) {
    const id = this.fid
    return this.app.middleware<this>(async (session, next) => {
      if (id && session.fid !== id) return next()
      return middleware(session, next)
    }, true)
  }

  prompt(timeout?: number): Promise<string>
  prompt<T>(callback: (session: this) => Awaitable<T>, options?: PromptOptions): Promise<T>
  prompt(...args: any[]) {
    const callback: (session: this) => any = typeof args[0] === 'function'
      ? args.shift()
      : (session) => {
        // Trim leading <at> element
        const elements = session.elements.slice()
        if (elements[0]?.type === 'at' && elements[0].attrs.id === session.selfId) {
          elements.shift()
        }
        return elements.join('').trim()
      }
    const options: PromptOptions = typeof args[0] === 'number'
      ? { timeout: args[0] }
      : args[0] ?? {}
    return new Promise<string>((resolve) => {
      const dispose = this.middleware(async (session, next) => {
        clearTimeout(timer)
        dispose()
        const value = await callback(session)
        resolve(value)
        if (isNullable(value)) return next()
      })
      const timer = setTimeout(() => {
        dispose()
        resolve(undefined)
      }, options.timeout ?? this.app.koishi.config.delay.prompt)
    })
  }

  async suggest(options: SuggestOptions) {
    let { expect, filter, prefix = '' } = options
    if (options.actual) {
      expect = expect.filter((name) => {
        return name && this.app.i18n.compare(name, options.actual, options)
      })
      if (filter) {
        expect = (await Promise.all(expect
          .map(async (name) => [name, await filter(name)] as const)))
          .filter(([, result]) => result)
          .map(([name]) => name)
      }
    }
    if (!expect.length) {
      await this.send(prefix)
      return
    }

    prefix += this.text('internal.suggest-hint', [expect.map(text => {
      return this.text('general.quote', [text])
    }).join(this.text('general.or'))])
    if (expect.length > 1) {
      await this.send(prefix)
      return
    }

    await this.send(prefix + options.suffix)
    return this.prompt((session) => {
      const { content, atSelf, hasAt } = session.stripped
      if (!atSelf && hasAt) return
      if (content === '.' || content === '。') {
        return expect[0]
      }
    }, options)
  }
}

export default KoishiSession
