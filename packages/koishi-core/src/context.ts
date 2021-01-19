import { intersection, difference, Logger, defineProperty } from 'koishi-utils'
import { Command } from './command'
import { EventType, Session } from './session'
import { User, Channel, PlatformType, Database } from './database'
import { Argv, Domain } from './parser'
import { Server } from './server'
import { App } from './app'
import type Router from 'koa-router'

export type NextFunction = (next?: NextFunction) => Promise<void>
export type Middleware = (session: Session, next: NextFunction) => any
export type PluginFunction<T, U = any> = (ctx: T, options: U) => void
export type PluginObject<T, U = any> = { name?: string, apply: PluginFunction<T, U> }
export type Plugin<T, U = any> = PluginFunction<T, U> | PluginObject<T, U>
export type Disposable = () => void

interface ScopeSet extends Array<string> {
  positive?: boolean
}

interface Scope {
  groups: ScopeSet
  users: ScopeSet
  private: boolean
}

function joinScope(base: ScopeSet, ids: readonly string[]) {
  const result: ScopeSet = !ids.length ? [...base]
    : base.positive ? intersection(ids, base) : difference(ids, base)
  result.positive = !ids.length ? base.positive : true
  return result
}

function matchScope(base: ScopeSet, id: string) {
  // @ts-ignore
  return !id || !(base.positive ^ base.includes(id))
}

function isBailed(value: any) {
  return value !== null && value !== false && value !== undefined
}

type RestParameters<T extends (...args: any) => any> = T extends (arg: any, ...args: infer P) => any ? P : never

export class Context {
  static readonly MIDDLEWARE_EVENT = Symbol('mid')

  protected _router: Router
  protected _database: Database
  protected _servers: Record<string, Server>

  private _disposables: Disposable[]

  constructor(public scope: Scope, public app?: App) {
    defineProperty(this, '_disposables', [])
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

  group(...ids: string[]) {
    const scope = { ...this.scope }
    scope.groups = joinScope(scope.groups, ids)
    scope.private = false
    return new Context(scope, this.app)
  }

  user(...ids: string[]) {
    const scope = { ...this.scope }
    scope.users = joinScope(scope.users, ids)
    return new Context(scope, this.app)
  }

  private(...ids: string[]) {
    const scope = { ...this.scope }
    scope.users = joinScope(scope.users, ids)
    scope.groups = []
    scope.groups.positive = true
    return new Context(scope, this.app)
  }

  match(session: Session) {
    if (!session) return true
    return matchScope(this.scope.groups, session.groupId)
      && matchScope(this.scope.users, session.userId)
      && (this.scope.private || session.subType !== 'private')
  }

  plugin<T extends PluginFunction<this>>(plugin: T, options?: T extends PluginFunction<this, infer U> ? U : never): this
  plugin<T extends PluginObject<this>>(plugin: T, options?: T extends PluginObject<this, infer U> ? U : never): this
  plugin<T extends Plugin<this>>(plugin: T, options?: T extends Plugin<this, infer U> ? U : never) {
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

  async parallel<K extends keyof EventMap>(name: K, ...args: Parameters<EventMap[K]>): Promise<void>
  async parallel<K extends keyof EventMap>(session: Session, name: K, ...args: Parameters<EventMap[K]>): Promise<void>
  async parallel(...args: any[]) {
    const tasks: Promise<any>[] = []
    const session = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    this.logger('dispatch').debug(name)
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(session)) continue
      tasks.push(callback.apply(this, args))
    }
    await Promise.all(tasks)
  }

  emit<K extends keyof EventMap>(name: K, ...args: Parameters<EventMap[K]>): void
  emit<K extends keyof EventMap>(session: Session, name: K, ...args: Parameters<EventMap[K]>): void
  emit(...args: [any, ...any[]]) {
    this.parallel(...args)
  }

  chain<K extends keyof EventMap>(name: K, ...args: Parameters<EventMap[K]>): ReturnType<EventMap[K]>
  chain<K extends keyof EventMap>(session: Session, name: K, ...args: Parameters<EventMap[K]>): ReturnType<EventMap[K]>
  chain(...args: [any, ...any[]]) {
    const session = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    this.logger('dispatch').debug(name)
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(session)) continue
      const result = callback.apply(this, args)
      args[0] = result
    }
    return args[0]
  }

  async serial<K extends keyof EventMap>(name: K, ...args: Parameters<EventMap[K]>): Promise<ReturnType<EventMap[K]>>
  async serial<K extends keyof EventMap>(session: Session, name: K, ...args: Parameters<EventMap[K]>): Promise<ReturnType<EventMap[K]>>
  async serial(...args: any[]) {
    const session = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    this.logger('dispatch').debug(name)
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(session)) continue
      const result = await callback.apply(this, args)
      if (isBailed(result)) return result
    }
  }

  bail<K extends keyof EventMap>(name: K, ...args: Parameters<EventMap[K]>): ReturnType<EventMap[K]>
  bail<K extends keyof EventMap>(session: Session, name: K, ...args: Parameters<EventMap[K]>): ReturnType<EventMap[K]>
  bail(...args: any[]) {
    const session = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    this.logger('dispatch').debug(name)
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(session)) continue
      const result = callback.apply(this, args)
      if (isBailed(result)) return result
    }
  }

  private getHooks<K extends keyof EventMap>(name: K) {
    const hooks = this.app._hooks[name] || (this.app._hooks[name] = [])
    if (hooks.length >= this.app.options.maxListeners) {
      this.logger('app').warn(
        'max listener count (%d) for event "%s" exceeded, which may be caused by a memory leak',
        this.app.options.maxListeners, name,
      )
    }
    return hooks
  }

  on<K extends keyof EventMap>(name: K, listener: EventMap[K]) {
    return this.addListener(name, listener)
  }

  addListener<K extends keyof EventMap>(name: K, listener: EventMap[K]) {
    this.getHooks(name).push([this, listener])
    const dispose = () => this.removeListener(name, listener)
    this._disposables.push(name === 'dispose' ? listener as Disposable : dispose)
    return dispose
  }

  prependListener<K extends keyof EventMap>(name: K, listener: EventMap[K]) {
    this.getHooks(name).unshift([this, listener])
    const dispose = () => this.removeListener(name, listener)
    this._disposables.push(name === 'dispose' ? listener as Disposable : dispose)
    return dispose
  }

  once<K extends keyof EventMap>(name: K, listener: EventMap[K]) {
    const dispose = this.addListener(name, (...args: any[]) => {
      dispose()
      return listener.apply(this, args)
    })
    return dispose
  }

  off<K extends keyof EventMap>(name: K, listener: EventMap[K]) {
    return this.removeListener(name, listener)
  }

  removeListener<K extends keyof EventMap>(name: K, listener: EventMap[K]) {
    const index = (this.app._hooks[name] || [])
      .findIndex(([context, callback]) => context === this && callback === listener)
    if (index >= 0) {
      this.app._hooks[name].splice(index, 1)
      return true
    }
  }

  middleware(middleware: Middleware) {
    return this.addListener(Context.MIDDLEWARE_EVENT, middleware)
  }

  addMiddleware(middleware: Middleware) {
    return this.addListener(Context.MIDDLEWARE_EVENT, middleware)
  }

  prependMiddleware(middleware: Middleware) {
    return this.prependListener(Context.MIDDLEWARE_EVENT, middleware)
  }

  removeMiddleware(middleware: Middleware) {
    return this.removeListener(Context.MIDDLEWARE_EVENT, middleware)
  }

  command<D extends string>(rawName: D, config?: Command.Config): Command<never, never, Domain.ArgumentType<D>>
  command<D extends string>(rawName: D, description: string, config?: Command.Config): Command<never, never, Domain.ArgumentType<D>>
  command(rawName: string, ...args: [Command.Config?] | [string, Command.Config?]) {
    const description = typeof args[0] === 'string' ? args.shift() as string : undefined
    const config = args[0] as Command.Config || {}
    if (description !== undefined) config.description = description
    const [path] = rawName.split(' ', 1)
    const declaration = rawName.slice(path.length)
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
              throw new Error(`cannot create subcommand ${rawName}, ${command.parent.name}/${command.name} already exists`)
            }
          } else {
            command.parent = parent
            parent.children.push(command)
          }
        }
        return parent = command
      }
      command = new Command(name, declaration, this)
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

  async broadcast(message: string, forced?: boolean): Promise<string[]>
  async broadcast(groups: readonly string[], message: string, forced?: boolean): Promise<string[]>
  async broadcast(...args: [string, boolean?] | [readonly string[], string, boolean?]) {
    let groups: string[]
    if (Array.isArray(args[0])) groups = args.shift() as any
    const [message, forced] = args as [string, boolean]
    if (!message) return []

    const data = await this.database.getChannelList(['id', 'assignee', 'flag'])
    const assignMap: Record<string, Record<string, string[]>> = {}
    for (const { id, assignee, flag } of data) {
      if (groups && !groups.includes(id)) continue
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
      return this.servers[type].bots.map((bot) => {
        return bot.broadcast(map[bot.selfId] || [], message)
      })
    }))).flat(1)
  }

  dispose() {
    this._disposables.forEach(dispose => dispose())
    this._disposables = []
  }
}

export type RawSession<E extends EventType = EventType> = Session<never, never, PlatformType, E>

export interface EventMap {
  [Context.MIDDLEWARE_EVENT]: Middleware

  // message
  'message'(session: RawSession<'message'>): void
  'message/friend'(session: RawSession<'message'>): void
  'message/group'(session: RawSession<'message'>): void
  'message-updated'(session: RawSession<'message'>): void
  'message-updated/friend'(session: RawSession<'message'>): void
  'message-updated/group'(session: RawSession<'message'>): void
  'message-deleted'(session: RawSession<'message'>): void
  'message-deleted/friend'(session: RawSession<'message'>): void
  'message-deleted/group'(session: RawSession<'message'>): void

  // friend
  'friend-added'(session: Session): void
  'friend-deleted'(session: Session): void

  'group'(session: Session): void
  'group-added'(session: Session): void
  'group-deleted'(session: Session): void

  'group-member'(session: Session): void
  'group-member-added'(session: Session): void
  'group-member-deleted'(session: Session): void

  // notice
  'group-upload'(session: Session): void
  'group-admin'(session: Session): void
  'group-admin/set'(session: Session): void
  'group-admin/unset'(session: Session): void
  'group-ban'(session: Session): void
  'group-ban/ban'(session: Session): void
  'group-ban/lift-ban'(session: Session): void
  'notify'(session: Session): void
  'notify/poke'(session: Session): void
  'notify/lucky_king'(session: Session): void
  'notify/honor'(session: Session): void

  // request
  'request/friend'(session: Session): void
  'request/group/add'(session: Session): void
  'request/group/invite'(session: Session): void

  // lifecycle
  'lifecycle/enable'(session: RawSession<'lifecycle'>): void
  'lifecycle/disable'(session: RawSession<'lifecycle'>): void
  'lifecycle/connect'(session: RawSession<'lifecycle'>): void
  'lifecycle/heartbeat'(session: RawSession<'lifecycle'>): void

  // Koishi events
  'appellation'(name: string, session: Session): string
  'tokenize'(content: string, session: Session): Argv
  'parse'(argv: Argv, session: Session): string
  'before-attach-user'(session: Session, fields: Set<User.Field>): void
  'before-attach-group'(session: Session, fields: Set<Channel.Field>): void
  'attach-user'(session: Session): void | boolean | Promise<void | boolean>
  'attach-group'(session: Session): void | boolean | Promise<void | boolean>
  'send'(session: Session): void | Promise<void>
  'before-send'(session: Session): void | boolean
  'before-command'(argv: Argv): void | string | Promise<void | string>
  'middleware'(session: Session): void
  'before-connect'(): void | Promise<void>
  'connect'(): void
  'before-disconnect'(): void | Promise<void>
  'disconnect'(): void
  'dispose'(): void
}

export type Events = keyof EventMap
