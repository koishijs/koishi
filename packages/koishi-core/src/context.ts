import { Logger, defineProperty } from 'koishi-utils'
import { Command } from './command'
import { Session } from './session'
import { User, Channel, Database } from './database'
import { Argv, Domain } from './parser'
import { Platform, Bot } from './adapter'
import { App } from './app'
import { inspect } from 'util'
import Router from '@koa/router'

export type NextFunction = (next?: NextFunction) => Promise<void>
export type Middleware = (session: Session, next: NextFunction) => any
export type PluginFunction<T = any> = (ctx: Context, options: T) => void
export type Plugin<T = any> = PluginFunction<T> | PluginObject<T>
export type Promisify<T> = T extends Promise<unknown> ? T : Promise<T>
export type Awaitable<T> = T extends Promise<unknown> ? T : T | Promise<T>
export type Await<T> = T extends Promise<infer U> ? U : T
export type Disposable = () => void

export interface PluginObject<T = any> {
  name?: string
  disposable?: boolean
  apply: PluginFunction<T>
}

type PluginConfig<T extends Plugin> = T extends PluginFunction<infer U> ? U : T extends PluginObject<infer U> ? U : never

function isBailed(value: any) {
  return value !== null && value !== false && value !== undefined
}

type Filter = (session: Session) => boolean
type PartialSeletor<T> = (...values: T[]) => Context

interface Selector<T> extends PartialSeletor<T> {
  except?: PartialSeletor<T>
}

export class Context {
  static readonly middleware = Symbol('mid')

  protected _bots: Bot[] & Record<string, Bot>
  protected _router: Router
  protected _database: Database

  public user = this.createSelector('userId')
  public self = this.createSelector('selfId')
  public group = this.createSelector('groupId')
  public channel = this.createSelector('channelId')
  public platform = this.createSelector('platform')

  protected constructor(public filter: Filter, public app?: App, private _plugin: Plugin = null) {}

  [inspect.custom]() {
    return `Context {}`
  }

  private createSelector<K extends keyof Session>(key: K) {
    const selector: Selector<Session[K]> = (...args) => this.select(key, ...args)
    selector.except = (...args) => this.unselect(key, ...args)
    return selector
  }

  get private() {
    return this.unselect('groupId').user
  }

  get router(): Router {
    if (!this.app._router) return
    const router = Object.create(this.app._router)
    router._koishiContext = this
    return router
  }

  get bots() {
    return this.app._bots
  }

  get database() {
    return this.app._database
  }

  set database(database) {
    if (this.app._database && this.app._database !== database) {
      this.logger('app').warn('ctx.database is overwritten')
    }
    this.app._database = database
  }

  private get disposables() {
    return this.app._plugins.get(this._plugin)
  }

  logger(name: string) {
    return new Logger(name)
  }

  select<K extends keyof Session>(key: K, ...values: Session[K][]) {
    return this.intersect((session) => {
      return values.length ? values.includes(session[key]) : !!session[key]
    })
  }

  unselect<K extends keyof Session>(key: K, ...values: Session[K][]) {
    return this.intersect((session) => {
      return values.length ? !values.includes(session[key]) : !session[key]
    })
  }

  all() {
    return new Context(() => true, this.app, this._plugin)
  }

  union(arg: Filter | Context) {
    const filter = typeof arg === 'function' ? arg : arg.filter
    return new Context(s => this.filter(s) || filter(s), this.app, this._plugin)
  }

  intersect(arg: Filter | Context) {
    const filter = typeof arg === 'function' ? arg : arg.filter
    return new Context(s => this.filter(s) && filter(s), this.app, this._plugin)
  }

  match(session?: Session) {
    return !session || this.filter(session)
  }

  plugin<T extends Plugin>(plugin: T, options?: PluginConfig<T>) {
    if (options === false) return this
    if (options === true) options = undefined

    if (this.app._plugins.has(plugin)) {
      this.logger('app').warn('duplicate plugin detected')
      return this
    }

    const ctx: this = Object.create(this)
    defineProperty(ctx, '_plugin', plugin)
    this.app._plugins.set(plugin, [])

    if (typeof plugin === 'function') {
      (plugin as PluginFunction<this>)(ctx, options)
    } else if (plugin && typeof plugin === 'object' && typeof plugin.apply === 'function') {
      (plugin as PluginObject<this>).apply(ctx, options)
    } else {
      throw new Error('invalid plugin, expect function or object with an "apply" method')
    }

    this.disposables.push(() => ctx.dispose())
    return this
  }

  async dispose(plugin = this._plugin) {
    if (!plugin) throw new Error('cannot use ctx.dispose() outside a plugin')
    await Promise.all(this.app._plugins.get(plugin)?.map(dispose => dispose()))
    this.app._plugins.delete(plugin)
  }

  async parallel<K extends EventName>(name: K, ...args: Parameters<EventMap[K]>): Promise<Await<ReturnType<EventMap[K]>>[]>
  async parallel<K extends EventName>(session: Session, name: K, ...args: Parameters<EventMap[K]>): Promise<Await<ReturnType<EventMap[K]>>[]>
  async parallel(...args: any[]) {
    const tasks: Promise<any>[] = []
    const session = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(session)) continue
      tasks.push(callback.apply(session, args))
    }
    return Promise.all(tasks)
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

  private getHooks<K extends EventName>(name: K) {
    const hooks = this.app._hooks[name] || (this.app._hooks[name] = [])
    if (hooks.length >= this.app.options.maxListeners) {
      this.logger('app').warn(
        'max listener count (%d) for event "%s" exceeded, which may be caused by a memory leak',
        this.app.options.maxListeners, name,
      )
    }
    return hooks
  }

  on<K extends EventName>(name: K, listener: EventMap[K], prepend = false) {
    if (name === 'connect' && this.app.status === App.Status.open) {
      return (listener as Disposable)(), () => false
    }
    if (prepend) {
      this.getHooks(name).unshift([this, listener])
    } else {
      this.getHooks(name).push([this, listener])
    }
    const dispose = () => this.off(name, listener)
    this.disposables.push(name === 'dispose' ? listener as Disposable : dispose)
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
    } as any, prepend)
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

  command<D extends string>(def: D, config?: Command.Config): Command<never, never, Domain.ArgumentType<D>>
  command<D extends string>(def: D, desc: string, config?: Command.Config): Command<never, never, Domain.ArgumentType<D>>
  command(def: string, ...args: [Command.Config?] | [string, Command.Config?]) {
    if (typeof args[0] === 'string') def += ' ' + args.shift()
    const config = args[0] as Command.Config
    const [path] = def.split(' ', 1)
    const decl = def.slice(path.length)
    const segments = path.toLowerCase().split(/(?=[\\./])/)

    let parent: Command = null
    segments.forEach((segment) => {
      const code = segment.charCodeAt(0)
      const name = code === 46 ? parent.name + segment : code === 47 ? segment.slice(1) : segment
      let command = this.app._commandMap[name]
      if (command) {
        if (parent) {
          if (command === parent) {
            throw new Error('cannot set a command as its own subcommand')
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
      if (parent) {
        command.parent = parent
        parent.children.push(command)
      }
      parent = command
    })

    Object.assign(parent.config, config)
    this.disposables.push(() => parent.dispose())
    return parent
  }

  getBot(platform: Platform, selfId?: string) {
    if (selfId) return this.bots[`${platform}:${selfId}`]
    return this.bots.find(bot => bot.platform === platform)
  }

  getSelfIds(type?: Platform, assignees?: readonly string[]): Record<string, readonly string[]> {
    if (type) {
      assignees ||= this.app.bots.filter(bot => bot.platform === type).map(bot => bot.selfId)
      return { [type]: assignees }
    }
    const platforms: Record<string, string[]> = {}
    for (const bot of this.app.bots) {
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

    const data = await this.database.getAssignedChannels(['id', 'assignee', 'flag'])
    const assignMap: Record<string, Record<string, string[]>> = {}
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
      return this.app.bots.map((bot) => {
        if (bot.platform !== type) return Promise.resolve([])
        return bot.broadcast(map[bot.selfId] || [], content)
      })
    }))).flat(1)
  }
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
type BeforeEventMap = { [E in EventName & string as OmitSubstring<E, 'before-'>]: EventMap[E] }

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
  'before-send'(session: Session<never, never, Platform, 'send'>): Awaitable<void | boolean>
  'before-command'(argv: Argv): Awaitable<void | string>
  'command'(argv: Argv): Awaitable<void>
  'middleware'(session: Session): void
  'before-connect'(): Awaitable<void>
  'connect'(): void
  'before-disconnect'(): Awaitable<void>
  'disconnect'(): void
  'dispose'(): Awaitable<void>
}

// hack into router methods to make sure
// that koa middlewares are disposable
const register = Router.prototype.register
Router.prototype.register = function (this: Router, ...args) {
  const layer = register.apply(this, args)
  const context: Context = this['_koishiContext']
  context['disposables'].push(() => {
    const index = this.stack.indexOf(layer)
    if (index) this.stack.splice(index, 1)
  })
  return layer
}
