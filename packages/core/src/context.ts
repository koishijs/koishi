import { Awaitable, defineProperty, Dict, Logger, makeArray, MaybeArray, Promisify, Random, remove, sleep } from '@koishijs/utils'
import { Command } from './command'
import { Session } from './session'
import { Channel, Database, Modules, User } from './database'
import { Argv } from './parser'
import { App } from './app'
import { Bot } from './bot'
import { Adapter } from './adapter'
import { Model, Tables } from './orm'
import { Template } from './i18n'
import Schema from 'schemastery'

export type Next = (next?: Next.Callback) => Promise<void | string>
export type Middleware = (session: Session, next: Next) => Awaitable<void | string>
export type Disposable = () => void

export namespace Next {
  export const MAX_DEPTH = 64

  export type Queue = ((next?: Next) => Promise<void | string>)[]
  export type Callback = void | string | ((next?: Next) => Awaitable<void | string>)

  export async function compose(callback: Callback, next?: Next) {
    return typeof callback === 'function' ? callback(next) : callback
  }
}

export type Plugin = Plugin.Function | Plugin.Object

export namespace Plugin {
  export type Function<T = any> = (ctx: Context, options: T) => void
  export type Constructor<T = any> = new (ctx: Context, options: T) => void

  export interface Object<T = any> {
    name?: string
    apply: Function<T>
    Config?: Schema
    using?: readonly (keyof Context.Services)[]
  }

  export interface ObjectWithSchema<T = any> {
    name?: string
    apply: Function
    schema?: Schema<T, any>
    using?: readonly (keyof Context.Services)[]
  }

  export type Config<T extends Plugin> =
    | T extends Constructor<infer U> ? U
    : T extends Function<infer U> ? U
    : T extends ObjectWithSchema<infer U> ? U
    : T extends Object<infer U> ? U
    : never

  export interface State {
    id?: string
    parent?: State
    context?: Context
    config?: any
    using?: readonly (keyof Context.Services)[]
    schema?: Schema
    plugin?: Plugin
    children: Plugin[]
    disposables: Disposable[]
  }

  export class Registry extends Map<Plugin, State> {
    private resolve(plugin: Plugin) {
      return plugin && (typeof plugin === 'function' ? plugin : plugin.apply)
    }

    get(plugin: Plugin) {
      return super.get(this.resolve(plugin))
    }

    set(plugin: Plugin, state: State) {
      return super.set(this.resolve(plugin), state)
    }

    has(plugin: Plugin) {
      return super.has(this.resolve(plugin))
    }

    delete(plugin: Plugin) {
      return super.delete(this.resolve(plugin))
    }
  }
}

function isBailed(value: any) {
  return value !== null && value !== false && value !== undefined
}

function isConstructor(func: Function) {
  // async function or arrow function
  if (!func.prototype) return false
  // generator function or malformed definition
  if (func.prototype.constructor !== func) return false
  return true
}

function isApplicable(object: Plugin) {
  return object && typeof object === 'object' && typeof object.apply === 'function'
}

const selectors = ['user', 'guild', 'channel', 'self', 'private', 'platform'] as const

export type Filter = (session: Session) => boolean
export type SelectorType = typeof selectors[number]
export type SelectorValue = boolean | MaybeArray<string | number>
export type BaseSelection = { [K in SelectorType as `$${K}`]?: SelectorValue }

export interface Selection extends BaseSelection {
  $and?: Selection[]
  $or?: Selection[]
  $not?: Selection
}

export interface Context extends Context.Services {}

export class Context {
  static readonly middleware = Symbol('middleware')
  static readonly current = Symbol('source')

  protected constructor(public filter: Filter, public app?: App, private _plugin: Plugin = null) {}

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Context <${this._plugin ? this._plugin.name : 'root'}>`
  }

  private _property<K extends keyof Session>(key: K, ...values: Session[K][]) {
    return this.intersect((session) => {
      return values.length ? values.includes(session[key]) : !!session[key]
    })
  }

  user(...values: string[]) {
    return this._property('userId', ...values)
  }

  self(...values: string[]) {
    return this._property('selfId', ...values)
  }

  guild(...values: string[]) {
    return this._property('guildId', ...values)
  }

  channel(...values: string[]) {
    return this._property('channelId', ...values)
  }

  platform(...values: string[]) {
    return this._property('platform', ...values)
  }

  private(...values: string[]) {
    return this.exclude(this._property('guildId'))._property('userId', ...values)
  }

  select(options: Selection) {
    let ctx: Context = this

    // basic selectors
    for (const type of selectors) {
      const value = options[`$${type}`] as SelectorValue
      if (value === true) {
        ctx = ctx[type]()
      } else if (value === false) {
        ctx = ctx.exclude(ctx[type]())
      } else if (value !== undefined) {
        // we turn everything into string
        ctx = ctx[type](...makeArray(value).map(item => '' + item))
      }
    }

    // intersect
    if (options.$and) {
      for (const selection of options.$and) {
        ctx = ctx.intersect(this.select(selection))
      }
    }

    // union
    if (options.$or) {
      let ctx2: Context = this.app
      for (const selection of options.$or) {
        ctx2 = ctx2.union(this.select(selection))
      }
      ctx = ctx.intersect(ctx2)
    }

    // exclude
    if (options.$not) {
      ctx = ctx.exclude(this.select(options.$not))
    }

    return ctx
  }

  logger(name: string) {
    return new Logger(name)
  }

  any() {
    return new Context(() => true, this.app, this._plugin)
  }

  never() {
    return new Context(() => false, this.app, this._plugin)
  }

  union(arg: Filter | Context) {
    const filter = typeof arg === 'function' ? arg : arg.filter
    return new Context(s => this.filter(s) || filter(s), this.app, this._plugin)
  }

  intersect(arg: Filter | Context) {
    const filter = typeof arg === 'function' ? arg : arg.filter
    return new Context(s => this.filter(s) && filter(s), this.app, this._plugin)
  }

  exclude(arg: Filter | Context) {
    const filter = typeof arg === 'function' ? arg : arg.filter
    return new Context(s => this.filter(s) && !filter(s), this.app, this._plugin)
  }

  /** @deprecated use `ctx.exclude()` instead */
  except(arg: Filter | Context) {
    return this.exclude(arg)
  }

  match(session?: Session) {
    return !session || this.filter(session)
  }

  get state() {
    return this.app.registry.get(this._plugin)
  }

  using(using: readonly (keyof Context.Services)[], callback: Plugin.Function<void>) {
    return this.plugin({ using, apply: callback, name: callback.name })
  }

  validate<T extends Plugin>(plugin: T, config: any) {
    if (config === false) return
    if (config === true) config = undefined
    config ??= {}

    const schema = plugin['Config'] || plugin['schema']
    if (schema) config = schema(config)
    return config
  }

  plugin(name: string, config?: any): this
  plugin<T extends Plugin>(plugin: T, config?: boolean | Plugin.Config<T>): this
  plugin(entry: string | Plugin, config?: any) {
    // load plugin by name
    const plugin: Plugin = typeof entry === 'string' ? Modules.require(entry, true) : entry

    // check duplication
    if (this.app.registry.has(plugin)) {
      this.logger('app').warn(new Error('duplicate plugin detected'))
      return this
    }

    // check if it's a valid plugin
    if (typeof plugin !== 'function' && !isApplicable(plugin)) {
      throw new Error('invalid plugin, expect function or object with an "apply" method')
    }

    // validate plugin config
    config = this.validate(plugin, config)
    if (!config) return this

    const ctx = new Context(this.filter, this.app, plugin).select(config)
    const schema = plugin['Config'] || plugin['schema']
    const using = plugin['using'] || []

    this.app.registry.set(plugin, {
      plugin,
      schema,
      using,
      id: Random.id(),
      context: this,
      config: config,
      parent: this.state,
      children: [],
      disposables: [],
    })

    this.state.children.push(plugin)
    this.emit('plugin-added', plugin)

    if (using.length) {
      ctx.on('service', async (name) => {
        if (!using.includes(name)) return
        await Promise.allSettled(ctx.state.disposables.slice(1).map(dispose => dispose()))
        callback()
      })
    }

    const callback = () => {
      if (using.some(name => !this[name])) return
      if (typeof plugin !== 'function') {
        plugin.apply(ctx, config)
      } else if (isConstructor(plugin)) {
        // eslint-disable-next-line no-new, new-cap
        new plugin(ctx, config)
      } else {
        plugin(ctx, config)
      }
    }

    callback()
    return this
  }

  dispose(plugin = this._plugin) {
    if (!plugin) throw new Error('root level context cannot be disposed')
    const state = this.app.registry.get(plugin)
    if (!state) return
    state.children.slice().map(plugin => this.dispose(plugin))
    state.disposables.slice().map(dispose => dispose())
    this.app.registry.delete(plugin)
    remove(state.parent.children, plugin)
    this.emit('plugin-removed', plugin)
    return state
  }

  * getHooks(name: EventName, session?: Session) {
    const hooks = this.app._hooks[name] || []
    for (const [context, callback] of hooks.slice()) {
      if (!context.match(session)) continue
      yield callback
    }
  }

  async parallel<K extends EventName>(name: K, ...args: Parameters<EventMap[K]>): Promise<void>
  async parallel<K extends EventName>(session: Session, name: K, ...args: Parameters<EventMap[K]>): Promise<void>
  async parallel(...args: any[]) {
    const tasks: Promise<any>[] = []
    const session = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    for (const callback of this.getHooks(name, session)) {
      tasks.push(Promise.resolve(callback.apply(session, args)).catch((error) => {
        this.logger('app').warn(error)
      }))
    }
    await Promise.all(tasks)
  }

  emit<K extends EventName>(name: K, ...args: Parameters<EventMap[K]>): void
  emit<K extends EventName>(session: Session, name: K, ...args: Parameters<EventMap[K]>): void
  emit(...args: [any, ...any[]]) {
    this.parallel(...args)
  }

  waterfall<K extends EventName>(name: K, ...args: Parameters<EventMap[K]>): Promisify<ReturnType<EventMap[K]>>
  waterfall<K extends EventName>(session: Session, name: K, ...args: Parameters<EventMap[K]>): Promisify<ReturnType<EventMap[K]>>
  async waterfall(...args: [any, ...any[]]) {
    const session = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    for (const callback of this.getHooks(name, session)) {
      const result = await callback.apply(session, args)
      args[0] = result
    }
    return args[0]
  }

  chain<K extends EventName>(name: K, ...args: Parameters<EventMap[K]>): ReturnType<EventMap[K]>
  chain<K extends EventName>(session: Session, name: K, ...args: Parameters<EventMap[K]>): ReturnType<EventMap[K]>
  chain(...args: [any, ...any[]]) {
    const session = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    for (const callback of this.getHooks(name, session)) {
      const result = callback.apply(session, args)
      args[0] = result
    }
    return args[0]
  }

  serial<K extends EventName>(name: K, ...args: Parameters<EventMap[K]>): Promisify<ReturnType<EventMap[K]>>
  serial<K extends EventName>(session: Session, name: K, ...args: Parameters<EventMap[K]>): Promisify<ReturnType<EventMap[K]>>
  async serial(...args: any[]) {
    const session = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    for (const callback of this.getHooks(name, session)) {
      const result = await callback.apply(session, args)
      if (isBailed(result)) return result
    }
  }

  bail<K extends EventName>(name: K, ...args: Parameters<EventMap[K]>): ReturnType<EventMap[K]>
  bail<K extends EventName>(session: Session, name: K, ...args: Parameters<EventMap[K]>): ReturnType<EventMap[K]>
  bail(...args: any[]) {
    const session = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    for (const callback of this.getHooks(name, session)) {
      const result = callback.apply(session, args)
      if (isBailed(result)) return result
    }
  }

  on<K extends EventName>(name: K, listener: EventMap[K], prepend?: boolean): () => boolean
  on(name: EventName, listener: Disposable, prepend = false) {
    const method = prepend ? 'unshift' : 'push'

    if (typeof name === 'string' && name in Context.deprecatedEvents) {
      const alternative = Context.deprecatedEvents[name]
      this.logger('app').warn(`event "${name}" is deprecated, use "${alternative}" instead`)
      name = alternative
    }

    // handle special events
    if (name === 'ready' && this.app.isActive) {
      this.app._tasks.queue(sleep(0).then(() => listener()))
      return () => false
    } else if (name === 'dispose') {
      this.state.disposables[method](listener)
      return () => remove(this.state.disposables, listener)
    }

    const hooks = this.app._hooks[name] ||= []
    if (hooks.length >= this.app.options.maxListeners) {
      this.logger('app').warn(
        'max listener count (%d) for event "%s" exceeded, which may be caused by a memory leak',
        this.app.options.maxListeners, name,
      )
    }

    hooks[method]([this, listener])
    const dispose = () => {
      remove(this.state.disposables, dispose)
      return this.off(name, listener)
    }
    this.state.disposables.push(dispose)
    return dispose
  }

  before<K extends BeforeEventName>(name: K, listener: BeforeEventMap[K], append = false) {
    const seg = name.split('/')
    seg[seg.length - 1] = 'before-' + seg[seg.length - 1]
    return this.on(seg.join('/') as EventName, listener, !append)
  }

  once<K extends EventName>(name: K, listener: EventMap[K], prepend?: boolean): () => boolean
  once(name: EventName, listener: Disposable, prepend = false) {
    const dispose = this.on(name, function (...args: any[]) {
      dispose()
      return listener.apply(this, args)
    }, prepend)
    return dispose
  }

  off<K extends EventName>(name: K, listener: EventMap[K]) {
    const index = (this.app._hooks[name] || [])
      .findIndex(([context, callback]) => context === this && callback === listener)
    if (index >= 0) {
      this.app._hooks[name].splice(index, 1)
      return true
    }
  }

  middleware(middleware: Middleware, prepend = false) {
    return this.on(Context.middleware, middleware, prepend)
  }

  private createTimerDispose(timer: NodeJS.Timeout) {
    const dispose = () => {
      clearTimeout(timer)
      if (!this.state) return
      return remove(this.state.disposables, dispose)
    }
    this.state.disposables.push(dispose)
    return dispose
  }

  setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]) {
    const dispose = this.createTimerDispose(setTimeout(() => {
      dispose()
      callback()
    }, ms, ...args))
    return dispose
  }

  setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]) {
    return this.createTimerDispose(setInterval(callback, ms, ...args))
  }

  getCommand(name: string) {
    return this.app._commands.get(name)
  }

  command<D extends string>(def: D, config?: Command.Config): Command<never, never, Argv.ArgumentType<D>>
  command<D extends string>(def: D, desc: string, config?: Command.Config): Command<never, never, Argv.ArgumentType<D>>
  command(def: string, ...args: [Command.Config?] | [string, Command.Config?]) {
    const desc = typeof args[0] === 'string' ? args.shift() as string : ''
    const config = args[0] as Command.Config
    const path = def.split(' ', 1)[0].toLowerCase()
    const decl = def.slice(path.length)
    const segments = path.split(/(?=[./])/g)

    let parent: Command, root: Command
    const list: Command[] = []
    segments.forEach((segment, index) => {
      const code = segment.charCodeAt(0)
      const name = code === 46 ? parent.name + segment : code === 47 ? segment.slice(1) : segment
      let command = this.getCommand(name)
      if (command) {
        if (parent) {
          if (command === parent) {
            throw new Error(`cannot set a command (${command.name}) as its own subcommand`)
          }
          if (command.parent) {
            if (command.parent !== parent) {
              throw new Error(`cannot create subcommand ${path}: ${command.parent.name}/${command.name} already exists`)
            }
          } else {
            command.parent = parent
            parent.children.push(command)
          }
        }
        return parent = command
      }
      command = new Command(name, decl, this)
      list.push(command)
      this.i18n.define(`command.${name}.description`, {
        '': index === segments.length - 1 ? desc : '',
      })
      if (!root) root = command
      if (parent) {
        command.parent = parent
        command.config.authority = parent.config.authority
        parent.children.push(command)
      }
      parent = command
    })

    if (desc) {
      this.i18n.define(`command.${parent.name}.description`, { '': desc })
    }
    Object.assign(parent.config, config)
    list.forEach(command => this.emit('command-added', command))
    if (!config?.patch) {
      if (root) this.state.disposables.unshift(() => root.dispose())
      return parent
    }

    if (root) root.dispose()
    const command = Object.create(parent)
    command._disposables = this.state.disposables
    return command
  }

  getSelfIds(type?: string, assignees?: string[]): Dict<string[]> {
    if (type) {
      assignees ||= this.bots.filter(bot => bot.platform === type).map(bot => bot.selfId)
      return { [type]: assignees }
    }
    const platforms: Dict<string[]> = {}
    for (const bot of this.bots) {
      (platforms[bot.platform] ||= []).push(bot.selfId)
    }
    return platforms
  }

  async broadcast(content: string, forced?: boolean): Promise<string[]>
  async broadcast(channels: readonly string[], content: string, forced?: boolean): Promise<string[]>
  async broadcast(...args: [string, boolean?] | [readonly string[], string, boolean?]) {
    let channels: string[]
    if (Array.isArray(args[0])) channels = args.shift() as any
    const [content, forced] = args as [string, boolean]
    if (!content) return []

    const data = await this.database.getAssignedChannels(['id', 'assignee', 'flag', 'platform', 'guildId'])
    const assignMap: Dict<Dict<[string, string][]>> = {}
    for (const { id, assignee, flag, platform, guildId } of data) {
      if (channels && !channels.includes(`${platform}:${id}`)) continue
      if (!forced && (flag & Channel.Flag.silent)) continue
      ((assignMap[platform] ||= {})[assignee] ||= []).push([id, guildId])
    }

    return (await Promise.all(Object.entries(assignMap).flatMap(([platform, map]) => {
      return this.bots.map((bot) => {
        if (bot.platform !== platform) return Promise.resolve([])
        return bot.broadcast(map[bot.selfId] || [], content)
      })
    }))).flat(1)
  }
}

export namespace Context {
  export interface Services {
    bots: Adapter.BotList
    database: Database
    model: Model
    i18n: Template
  }

  export const Services: (keyof Services)[] = []

  export function service(key: keyof Services) {
    if (Object.prototype.hasOwnProperty.call(Context.prototype, key)) return
    Services.push(key)
    const privateKey = Symbol(key)
    Object.defineProperty(Context.prototype, key, {
      get(this: Context) {
        const value = this.app[privateKey]
        if (!value) return
        defineProperty(value, Context.current, this)
        return value
      },
      set(this: Context, value) {
        const oldValue = this.app[privateKey]
        if (oldValue === value) return
        this.app[privateKey] = value
        this.emit('service', key)
        const action = value ? oldValue ? 'changed' : 'enabled' : 'disabled'
        this.logger('service').debug(key, action)
      },
    })
  }

  service('bots')
  service('i18n')
  service('model')

  export const deprecatedEvents: Dict<EventName & string> = {
    'connect': 'ready',
    'disconnect': 'dispose',
    'before-command': 'command/before-execute',
  }
}

type EventName = keyof EventMap
type OmitSubstring<S extends string, T extends string> = S extends `${infer L}${T}${infer R}` ? `${L}${R}` : never
type BeforeEventName = OmitSubstring<EventName & string, 'before-'>

export type BeforeEventMap = { [E in EventName & string as OmitSubstring<E, 'before-'>]: EventMap[E] }

export interface EventMap {
  [Context.middleware]: Middleware

  // internal events
  'appellation'(name: string, session: Session): string
  'before-parse'(content: string, session: Session): Argv
  'before-attach-channel'(session: Session, fields: Set<Channel.Field>): void
  'attach-channel'(session: Session): Awaitable<void | boolean>
  'before-attach-user'(session: Session, fields: Set<User.Field>): void
  'attach-user'(session: Session): Awaitable<void | boolean>
  'before-attach'(session: Session): void
  'attach'(session: Session): void
  'before-send'(session: Session): Awaitable<void | boolean>
  'command-added'(command: Command): void
  'command-removed'(command: Command): void
  'command-error'(argv: Argv, error: any): void
  'command/before-execute'(argv: Argv): Awaitable<void | string>
  'command/before-attach-channel'(argv: Argv, fields: Set<Channel.Field>): void
  'command/before-attach-user'(argv: Argv, fields: Set<User.Field>): void
  'middleware'(session: Session): void
  'help/command'(output: string[], command: Command, session: Session): void
  'help/option'(output: string, option: Argv.OptionDeclaration, command: Command, session: Session): string
  'plugin-added'(plugin: Plugin): void
  'plugin-removed'(plugin: Plugin): void
  'ready'(): Awaitable<void>
  'dispose'(): Awaitable<void>
  'model'(name: keyof Tables): void
  'service'(name: keyof Context.Services): void
  'adapter'(name: string): void
  'bot-added'(bot: Bot): void
  'bot-removed'(bot: Bot): void
  'bot-status-updated'(bot: Bot): void
  'bot-connect'(bot: Bot): Awaitable<void>
  'bot-disconnect'(bot: Bot): Awaitable<void>

  // deprecated events
  'connect'(): Awaitable<void>
  'disconnect'(): Awaitable<void>
  'before-command'(argv: Argv): Awaitable<void | string>
}
