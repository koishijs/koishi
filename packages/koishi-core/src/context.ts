import { Logger, defineProperty } from 'koishi-utils'
import { Command } from './command'
import { Session } from './session'
import { User, Channel, Database } from './database'
import { Argv, Domain } from './parser'
import { Server } from './server'
import { App } from './app'
import type Router from 'koa-router'

export type NextFunction = (next?: NextFunction) => Promise<void>
export type Middleware = (session: Session, next: NextFunction) => any
export type PluginFunction<T = any> = (ctx: Context, options: T) => void
export type PluginObject<T = any> = { name?: string, apply: PluginFunction<T> }
export type Plugin<T = any> = PluginFunction<T> | PluginObject<T>
export type Promisify<T> = T extends Promise<unknown> ? T : Promise<T>
export type Await<T> = T extends Promise<infer U> ? U : T
export type Disposable = () => void
export type Bind<F, T> = F extends (...args: infer P) => infer R ? (this: T, ...args: P) => R : never

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

  protected _router: Router
  protected _database: Database
  protected _servers: Server.Instances

  private _disposables: Disposable[]

  public user = this.createSelector('userId')
  public group = this.createSelector('groupId')
  public platform = this.createSelector('platform')

  constructor(public filter: Filter, public app?: App) {
    defineProperty(this, '_disposables', [])
  }

  private createSelector<K extends keyof Session>(key: K) {
    const selector: Selector<Session[K]> = (...args) => this.select(key, ...args)
    selector.except = (...args) => this.unselect(key, ...args)
    return selector
  }

  private() {
    return this.unselect('groupId')
  }

  get router() {
    return this.app._router
  }

  get servers() {
    return this.app._servers
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

  union(arg: Filter | Context) {
    const filter = typeof arg === 'function' ? arg : arg.filter
    return new Context(s => this.filter(s) || filter(s), this.app)
  }

  intersect(arg: Filter | Context) {
    const filter = typeof arg === 'function' ? arg : arg.filter
    return new Context(s => this.filter(s) && filter(s), this.app)
  }

  match(session?: Session) {
    return !session || this.filter(session)
  }

  plugin<T extends Plugin>(plugin: T, options?: PluginConfig<T>) {
    if (options === false) return
    if (options === true) options = undefined
    const ctx: this = Object.create(this)
    defineProperty(ctx, '_disposables', [])
    if (typeof plugin === 'function') {
      (plugin as PluginFunction<this>)(ctx, options)
    } else if (plugin && typeof plugin === 'object' && typeof plugin.apply === 'function') {
      (plugin as PluginObject<this>).apply(ctx, options)
    } else {
      throw new Error('invalid plugin, expect function or object with an "apply" method')
    }
    this._disposables.push(() => ctx.dispose())
    return this
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

  on<K extends EventName>(name: K, listener: Bind<EventMap[K], Session>, prepend = false) {
    if (prepend) {
      this.getHooks(name).unshift([this, listener])
    } else {
      this.getHooks(name).push([this, listener])
    }
    const dispose = () => this.off(name, listener)
    this._disposables.push(name === 'dispose' ? listener as Disposable : dispose)
    return dispose
  }

  before<K extends BeforeEventName>(name: K, listener: Bind<BeforeEventMap[K], Session>, append = false) {
    const seg = name.split('/')
    seg[seg.length - 1] = 'before-' + seg[seg.length - 1]
    return this.on(seg.join('/') as EventName, listener, !append)
  }

  once<K extends EventName>(name: K, listener: Bind<EventMap[K], Session>, prepend = false) {
    const dispose = this.on(name, function (...args: any[]) {
      dispose()
      return listener.apply(this, args)
    } as any, prepend)
    return dispose
  }

  off<K extends EventName>(name: K, listener: Bind<EventMap[K], Session>) {
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
    this._disposables.push(() => parent.dispose())
    return parent
  }

  async broadcast(content: string, forced?: boolean): Promise<string[]>
  async broadcast(channels: readonly string[], content: string, forced?: boolean): Promise<string[]>
  async broadcast(...args: [string, boolean?] | [readonly string[], string, boolean?]) {
    let channels: string[]
    if (Array.isArray(args[0])) channels = args.shift() as any
    const [content, forced] = args as [string, boolean]
    if (!content) return []

    const data = await this.database.getChannelList(['id', 'assignee', 'flag'])
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

  dispose() {
    this._disposables.forEach(dispose => dispose())
    this._disposables = []
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
  'tokenize'(content: string, session: Session): Argv
  'parse'(argv: Argv, session: Session): string
  'before-attach-user'(session: Session, fields: Set<User.Field>): void
  'before-attach-channel'(session: Session, fields: Set<Channel.Field>): void
  'attach-user'(session: Session): void | boolean | Promise<void | boolean>
  'attach-channel'(session: Session): void | boolean | Promise<void | boolean>
  'before-send'(session: Session): void | boolean
  'before-command'(argv: Argv): void | string | Promise<void | string>
  'command'(argv: Argv): void | Promise<void>
  'middleware'(session: Session): void
  'before-connect'(): void | Promise<void>
  'connect'(): void
  'before-disconnect'(): void | Promise<void>
  'disconnect'(): void
  'dispose'(): void
}
