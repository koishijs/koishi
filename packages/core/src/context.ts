import { Logger, makeArray, remove, Random, Promisify, Awaitable, Dict, MaybeArray, defineProperty } from '@koishijs/utils'
import { Command } from './command'
import { Session } from './session'
import { User, Channel, Modules } from './database'
import { Argv } from './parser'
import { App } from './app'
import { Bot } from './bot'
import { Database } from './database'
import { Adapter } from './adapter'
import { Model, Tables } from './orm'
import Schema from 'schemastery'

export type NextFunction = (next?: NextFunction) => Promise<void>
export type Middleware = (session: Session, next: NextFunction) => any
export type Disposable = () => void

export type Plugin<T = any> = Plugin.Function<T> | Plugin.Object<T>

export namespace Plugin {
  export type Function<T = any> = (ctx: Context, options: T) => void
  export type Constructor<T = any> = new (ctx: Context, options: T) => void

  export interface Object<T = any> {
    name?: string
    apply: Function<T>
    Config?: Schema
    using?: readonly (keyof Context.Services)[]
  }

  export type Config<T extends Plugin> =
    | T extends Constructor<infer U> ? U
    : T extends Function<infer U> ? U
    : T extends Object<infer U> ? U
    : never

  export type ModuleConfig<T> = 'default' extends keyof T
    ? Config<Extract<T['default'], Plugin>>
    : Config<Extract<T, Plugin>>

  export interface State<T = any> {
    id?: string
    parent?: State
    context?: Context
    config?: T
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

type Filter = (session: Session) => boolean

const selectors = ['user', 'guild', 'channel', 'self', 'private', 'platform'] as const

type SelectorType = typeof selectors[number]
type SelectorValue = boolean | MaybeArray<string | number>
type BaseSelection = { [K in SelectorType as `$${K}`]?: SelectorValue }

interface Selection extends BaseSelection {
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

  user(...values: string[]) {
    return this.select('userId', ...values)
  }

  self(...values: string[]) {
    return this.select('selfId', ...values)
  }

  guild(...values: string[]) {
    return this.select('guildId', ...values)
  }

  channel(...values: string[]) {
    return this.select('channelId', ...values)
  }

  platform(...values: string[]) {
    return this.select('platform', ...values)
  }

  private(...values: string[]) {
    return this.except(this.select('guildId')).select('userId', ...values)
  }

  select<K extends keyof Session>(key: K, ...values: Session[K][]): Context
  select(options?: Selection): Context
  select(...args: [Selection?] | [string, ...any[]]) {
    if (typeof args[0] === 'string') {
      const key = args.shift()
      return this.intersect((session) => {
        return args.length ? args.includes(session[key]) : !!session[key]
      })
    }

    let ctx: Context = this
    const options = args[0] ?? {}

    // basic selectors
    for (const type of selectors) {
      const value = options[`$${type}`] as SelectorValue
      if (value === true) {
        ctx = ctx[type]()
      } else if (value === false) {
        ctx = ctx.except(ctx[type]())
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

    // except
    if (options.$not) {
      ctx = ctx.except(this.select(options.$not))
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

  except(arg: Filter | Context) {
    const filter = typeof arg === 'function' ? arg : arg.filter
    return new Context(s => this.filter(s) && !filter(s), this.app, this._plugin)
  }

  match(session?: Session) {
    return !session || this.filter(session)
  }

  get state() {
    return this.app.registry.get(this._plugin)
  }

  using(using: readonly (keyof Context.Services)[], callback: Plugin.Function<void>) {
    return this.plugin({ using, apply: callback })
  }

  plugin<T extends keyof Modules>(plugin: T, options?: boolean | Plugin.ModuleConfig<Modules[T]>): this
  plugin<T extends Plugin>(plugin: T, options?: boolean | Plugin.Config<T>): this
  plugin(plugin: Plugin, options?: any) {
    if (options === false) return this
    if (options === true) options = undefined
    options ??= {}

    if (typeof plugin === 'string') {
      plugin = Modules.require(plugin, true)
    }

    if (this.app.registry.has(plugin)) {
      this.logger('app').warn(new Error('duplicate plugin detected'))
      return this
    }

    if (typeof plugin !== 'function' && !isApplicable(plugin)) {
      throw new Error('invalid plugin, expect function or object with an "apply" method')
    }

    const ctx = new Context(this.filter, this.app, plugin).select(options)
    const schema = plugin['Config'] || plugin['schema']
    const using = plugin['using'] || []
    if (schema) options = schema(options)

    this.app.registry.set(plugin, {
      plugin,
      schema,
      using,
      id: Random.id(),
      context: this,
      config: options,
      parent: this.state,
      children: [],
      disposables: [],
    })

    const dispose = this.on('service', async (name) => {
      if (!using.includes(name)) return
      await Promise.allSettled(ctx.state.disposables.slice(1).map(dispose => dispose()))
      callback()
    })

    this.state.children.push(plugin)
    this.emit('plugin-added', plugin)
    ctx.state.disposables.push(dispose)

    const callback = () => {
      if (using.some(name => !this[name])) return
      if (typeof plugin !== 'function') {
        plugin.apply(ctx, options)
      } else if (isConstructor(plugin)) {
        new plugin(ctx, options)
      } else {
        plugin(ctx, options)
      }
    }

    callback()
    return this
  }

  async dispose(plugin = this._plugin) {
    if (!plugin) throw new Error('root level context cannot be disposed')
    const state = this.app.registry.get(plugin)
    if (!state) return
    await Promise.allSettled([
      ...state.children.slice().map(plugin => this.dispose(plugin)),
      ...state.disposables.slice().map(dispose => dispose()),
    ]).finally(() => {
      this.app.registry.delete(plugin)
      remove(state.parent.children, plugin)
      this.emit('plugin-removed', plugin)
    })
  }

  async parallel<K extends EventName>(name: K, ...args: Parameters<EventMap[K]>): Promise<void>
  async parallel<K extends EventName>(session: Session, name: K, ...args: Parameters<EventMap[K]>): Promise<void>
  async parallel(...args: any[]) {
    const tasks: Promise<any>[] = []
    const session = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(session)) continue
      tasks.push((async () => {
        return callback.apply(session, args)
      })().catch(((error) => {
        this.logger('app').warn(error)
      })))
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
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(session)) continue
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
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(session)) continue
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
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(session)) continue
      const result = await callback.apply(session, args)
      if (isBailed(result)) return result
    }
  }

  bail<K extends EventName>(name: K, ...args: Parameters<EventMap[K]>): ReturnType<EventMap[K]>
  bail<K extends EventName>(session: Session, name: K, ...args: Parameters<EventMap[K]>): ReturnType<EventMap[K]>
  bail(...args: any[]) {
    const session = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(session)) continue
      const result = callback.apply(session, args)
      if (isBailed(result)) return result
    }
  }

  on<K extends EventName>(name: K, listener: EventMap[K], prepend?: boolean): () => boolean
  on(name: string & EventName, listener: Disposable, prepend = false) {
    const method = prepend ? 'unshift' : 'push'

    if (name === 'connect') {
      name = 'ready'
      this.logger('context').warn('event "connect" is deprecated, use "ready" instead')
    } else if (name === 'disconnect') {
      name = 'dispose'
      this.logger('context').warn('event "disconnect" is deprecated, use "dispose" instead')
    }

    // handle special events
    if (name === 'ready' && this.app.isActive) {
      return listener(), () => false
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

  once<K extends EventName>(name: K, listener: EventMap[K], prepend = false) {
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

  command<D extends string>(def: D, config?: Command.Config): Command<never, never, Argv.ArgumentType<D>>
  command<D extends string>(def: D, desc: string, config?: Command.Config): Command<never, never, Argv.ArgumentType<D>>
  command(def: string, ...args: [Command.Config?] | [string, Command.Config?]) {
    const desc = typeof args[0] === 'string' ? args.shift() as string : ''
    const config = args[0] as Command.Config
    const path = def.split(' ', 1)[0].toLowerCase()
    const decl = def.slice(path.length)
    const segments = path.split(/(?=[./])/g)

    let parent: Command, root: Command
    segments.forEach((segment, index) => {
      const code = segment.charCodeAt(0)
      const name = code === 46 ? parent.name + segment : code === 47 ? segment.slice(1) : segment
      let command = this.app._commands.get(name)
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
      command = new Command(name, decl, index === segments.length - 1 ? desc : '', this)
      if (!root) root = command
      if (parent) {
        command.parent = parent
        command.config.authority = parent.config.authority
        parent.children.push(command)
      }
      parent = command
    })

    if (desc) parent.description = desc
    Object.assign(parent.config, config)
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

    const data = this.database
      ? await this.database.getAssignedChannels(['id', 'assignee', 'flag'])
      : channels.map((id) => {
        const [platform] = id.split(':')
        const bot = this.bots.find(bot => bot.platform === platform)
        return bot && { id, assignee: bot.selfId, flag: 0 }
      }).filter(Boolean)

    const assignMap: Dict<Dict<string[]>> = {}
    for (const { id, assignee, flag } of data) {
      if (channels && !channels.includes(id)) continue
      if (!forced && (flag & Channel.Flag.silent)) continue
      const [type] = id.split(':')
      const cid = id.slice(type.length + 1)
      const map = assignMap[type] ||= {}
      if (map[assignee]) {
        map[assignee].push(cid)
      } else {
        map[assignee] = [cid]
      }
    }

    return (await Promise.all(Object.entries(assignMap).flatMap(([type, map]) => {
      return this.bots.map((bot) => {
        if (bot.platform !== type) return Promise.resolve([])
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
  }

  export function service(key: keyof Services) {
    if (Object.prototype.hasOwnProperty.call(Context.prototype, key)) return
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
        if (value) {
          this.app._services[key] = this.state.id
          const dispose = () => {
            if (this.app[privateKey] !== value) return
            this[key] = null
            delete this.app._services[key]
          }
          this.state.disposables.push(dispose)
          this.on('service', (name) => {
            if (name !== key) return
            dispose()
            remove(this.state.disposables, dispose)
          })
        }
      },
    })
  }

  service('bots')
  service('database')
  service('model')
}

type FlattenEvents<T> = {
  [K in keyof T & string]: K | `${K}/${FlattenEvents<T[K]>}`
}[keyof T & string]

type SessionEventMap = {
  [K in FlattenEvents<Session.Events>]: K extends `${infer X}/${infer R}`
    ? R extends `${infer Y}/${any}`
      ? (session: Session.Payload<X, Y>) => void
      : (session: Session.Payload<X, R>) => void
    : (session: Session.Payload<K>) => void
}

type EventName = keyof EventMap
type OmitSubstring<S extends string, T extends string> = S extends `${infer L}${T}${infer R}` ? `${L}${R}` : never
type BeforeEventName = OmitSubstring<EventName & string, 'before-'>

export type BeforeEventMap = { [E in EventName & string as OmitSubstring<E, 'before-'>]: EventMap[E] }

export interface EventMap extends SessionEventMap {
  [Context.middleware]: Middleware

  // Koishi events
  'appellation'(name: string, session: Session): string
  'before-parse'(content: string, session: Session): Argv
  'parse'(argv: Argv, session: Session): string
  'before-attach-channel'(session: Session, fields: Set<Channel.Field>): void
  'attach-channel'(session: Session): Awaitable<void | boolean>
  'before-attach-user'(session: Session, fields: Set<User.Field>): void
  'attach-user'(session: Session): Awaitable<void | boolean>
  'before-attach'(session: Session): void
  'attach'(session: Session): void
  'before-send'(session: Session<never, never, 'send'>): Awaitable<void | boolean>
  'before-command'(argv: Argv): Awaitable<void | string>
  'command'(argv: Argv): Awaitable<void>
  'command-added'(command: Command): void
  'command-removed'(command: Command): void
  'middleware'(session: Session): void
  'plugin-added'(plugin: Plugin): void
  'plugin-removed'(plugin: Plugin): void
  'connect'(): Awaitable<void>
  'disconnect'(): Awaitable<void>
  'ready'(): Awaitable<void>
  'dispose'(): Awaitable<void>
  'model'(name: keyof Tables): void
  'service'(name: keyof Context.Services): void
  'adapter'(): void
  'bot-added'(bot: Bot): void
  'bot-removed'(bot: Bot): void
  'bot-updated'(bot: Bot): void
  'bot-connect'(bot: Bot): Awaitable<void>
  'bot-dispose'(bot: Bot): Awaitable<void>
}
