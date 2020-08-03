import { intersection, difference, noop, Logger, defineProperty } from 'koishi-utils'
import { Command, CommandConfig, ParsedCommandLine, ParsedLine } from './command'
import { Meta, getSessionId } from './meta'
import { UserField, GroupField, Database } from './database'
import { App } from './app'

export type NextFunction = (next?: NextFunction) => Promise<void>
export type Middleware = (meta: Meta, next: NextFunction) => any
export type PluginFunction <T, U = any> = (ctx: T, options: U) => void
export type PluginObject <T, U = any> = { name?: string, apply: PluginFunction<T, U> }
export type Plugin <T, U = any> = PluginFunction<T, U> | PluginObject<T, U>
export type Disposable = () => void

interface ScopeSet extends Array<number> {
  positive?: boolean
}

interface Scope {
  groups: ScopeSet
  users: ScopeSet
  private: boolean
}

function joinScope (base: ScopeSet, ids: number[]) {
  const result: ScopeSet = !ids.length ? [...base]
    : base.positive ? intersection(ids, base) : difference(ids, base)
  result.positive = !ids.length ? base.positive : true
  return result
}

function matchScope (base: ScopeSet, id: number) {
  // @ts-ignore
  return !id || !(base.positive ^ base.includes(id))
}

export class Context {
  static readonly MIDDLEWARE_EVENT: unique symbol = Symbol('mid')

  private _disposables: Disposable[]

  constructor (public scope: Scope, public app?: App) {
    defineProperty(this, '_disposables', [])
  }

  get database (): Database {
    return this.app._database
  }

  set database (database: Database) {
    if (this.app._database && this.app._database !== database) {
      this.logger('app').warn('ctx.database is overwritten.')
    }
    this.app._database = database
  }

  logger (name: string) {
    return Logger.create(name)
  }

  get bots () {
    return this.app.server.bots
  }

  group (...ids: number[]) {
    const scope = { ...this.scope }
    scope.groups = joinScope(scope.groups, ids)
    scope.private = false
    return new Context(scope, this.app)
  }

  user (...ids: number[]) {
    const scope = { ...this.scope }
    scope.users = joinScope(scope.users, ids)
    return new Context(scope, this.app)
  }

  private (...ids: number[]) {
    const scope = { ...this.scope }
    scope.users = joinScope(scope.users, ids)
    scope.groups.positive = true
    scope.groups = []
    return new Context(scope, this.app)
  }

  match (meta: Meta) {
    if (!meta) return true
    return matchScope(this.scope.groups, meta.groupId)
      && matchScope(this.scope.users, meta.userId)
      && (this.scope.private || meta.messageType !== 'private')
  }

  plugin <T extends PluginFunction<this>> (plugin: T, options?: T extends PluginFunction<this, infer U> ? U : never): this
  plugin <T extends PluginObject<this>> (plugin: T, options?: T extends PluginObject<this, infer U> ? U : never): this
  plugin <T extends Plugin<this>> (plugin: T, options?: T extends Plugin<this, infer U> ? U : never) {
    if (options === false) return
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

  async parallelize <K extends keyof EventMap> (name: K, ...args: Parameters<EventMap[K]>): Promise<void>
  async parallelize <K extends keyof EventMap> (meta: Meta, name: K, ...args: Parameters<EventMap[K]>): Promise<void>
  async parallelize (...args: any[]) {
    const tasks: Promise<any>[] = []
    const meta = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    this.logger('dispatch').debug(name)
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(meta)) continue
      tasks.push(callback.apply(meta, args))
    }
    await Promise.all(tasks)
  }

  emit <K extends keyof EventMap> (name: K, ...args: Parameters<EventMap[K]>): void
  emit <K extends keyof EventMap> (meta: Meta, name: K, ...args: Parameters<EventMap[K]>): void
  emit (...args: [any, ...any[]]) {
    this.parallelize(...args)
  }

  async serialize <K extends keyof EventMap> (name: K, ...args: Parameters<EventMap[K]>): Promise<ReturnType<EventMap[K]>>
  async serialize <K extends keyof EventMap> (meta: Meta, name: K, ...args: Parameters<EventMap[K]>): Promise<ReturnType<EventMap[K]>>
  async serialize (...args: any[]) {
    const meta = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    this.logger('dispatch').debug(name)
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(meta)) continue
      const result = await callback.apply(this, args)
      if (result) return result
    }
  }

  bail <K extends keyof EventMap> (name: K, ...args: Parameters<EventMap[K]>): ReturnType<EventMap[K]>
  bail <K extends keyof EventMap> (meta: Meta, name: K, ...args: Parameters<EventMap[K]>): ReturnType<EventMap[K]>
  bail (...args: any[]) {
    const meta = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    this.logger('dispatch').debug(name)
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(meta)) continue
      const result = callback.apply(this, args)
      if (result) return result
    }
  }

  private getHooks <K extends keyof EventMap> (name: K) {
    const hooks = this.app._hooks[name] || (this.app._hooks[name] = [])
    if (hooks.length >= this.app.options.maxListeners) {
      throw new Error('max middleware count (%d) exceeded, which may be caused by a memory leak')
    }
    return hooks
  }

  on <K extends keyof EventMap> (name: K, listener: EventMap[K]) {
    return this.addListener(name, listener)
  }

  addListener <K extends keyof EventMap> (name: K, listener: EventMap[K]) {
    this.getHooks(name).push([this, listener])
    const dispose = () => this.removeListener(name, listener)
    this._disposables.push(name === 'dispose' ? listener as Disposable : dispose)
    return dispose
  }

  before <K extends keyof EventMap> (name: K, listener: EventMap[K]) {
    return this.prependListener(name, listener)
  }

  prependListener <K extends keyof EventMap> (name: K, listener: EventMap[K]) {
    this.getHooks(name).unshift([this, listener])
    const dispose = () => this.removeListener(name, listener)
    this._disposables.push(name === 'dispose' ? listener as Disposable : dispose)
    return dispose
  }

  once <K extends keyof EventMap> (name: K, listener: EventMap[K]) {
    const dispose = this.addListener(name, (...args: any[]) => {
      dispose()
      return listener.apply(this, args)
    })
    return dispose
  }

  off <K extends keyof EventMap> (name: K, listener: EventMap[K]) {
    return this.removeListener(name, listener)
  }

  removeListener <K extends keyof EventMap> (name: K, listener: EventMap[K]) {
    const index = (this.app._hooks[name] || []).findIndex(([context, callback]) => context === this && callback === listener)
    if (index >= 0) {
      this.app._hooks[name].splice(index, 1)
      return true
    }
  }

  middleware (middleware: Middleware) {
    return this.addListener(Context.MIDDLEWARE_EVENT, middleware)
  }

  addMiddleware (middleware: Middleware) {
    return this.addListener(Context.MIDDLEWARE_EVENT, middleware)
  }

  prependMiddleware (middleware: Middleware) {
    return this.prependListener(Context.MIDDLEWARE_EVENT, middleware)
  }

  removeMiddleware (middleware: Middleware) {
    return this.removeListener(Context.MIDDLEWARE_EVENT, middleware)
  }

  onceMiddleware (middleware: Middleware, meta?: Meta) {
    const identifier = meta ? getSessionId(meta) : undefined
    const listener: Middleware = async (meta, next) => {
      if (identifier && getSessionId(meta) !== identifier) return next()
      this.removeMiddleware(listener)
      return middleware(meta, next)
    }
    return this.prependMiddleware(listener)
  }

  command (rawName: string, config?: CommandConfig): Command
  command (rawName: string, description: string, config?: CommandConfig): Command
  command (rawName: string, ...args: [CommandConfig?] | [string, CommandConfig?]) {
    const description = typeof args[0] === 'string' ? args.shift() as string : undefined
    const config = args[0] as CommandConfig || {}
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
              throw new Error('already has subcommand')
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

  private resolve (argv: ParsedArgv, meta: Meta, next: NextFunction) {
    if (typeof argv.command === 'string') {
      argv.command = this.app._commandMap[argv.command]
    }
    if (!argv.command?.context.match(meta)) return
    return { meta, next, ...argv } as ParsedCommandLine
  }

  parse (message: string, meta: Meta, next: NextFunction = noop, forced = false): ParsedCommandLine {
    if (!message) return
    const argv = this.bail(meta, 'parse', message, meta, forced)
    if (argv) return this.resolve(argv, meta, next)
  }

  execute (argv: ExecuteArgv): Promise<void>
  execute (message: string, meta: Meta, next?: NextFunction): Promise<void>
  async execute (...args: [ExecuteArgv] | [string, Meta, NextFunction?]) {
    const meta = typeof args[0] === 'string' ? args[1] : args[0].meta
    if (!('$ctxType' in meta)) this.app.server.parseMeta(meta)

    let argv: ParsedCommandLine, next: NextFunction
    if (typeof args[0] === 'string') {
      next = args[2] || noop
      argv = this.parse(args[0], meta, next)
    } else {
      next = args[0].next || noop
      argv = this.resolve(args[0], meta, next)
    }
    if (!argv) return next()

    if (this.database) {
      if (meta.messageType === 'group') {
        await meta.observeGroup()
      }
      await meta.observeUser()
    }

    return argv.command.execute(argv)
  }

  dispose () {
    this._disposables.forEach(dispose => dispose())
  }
}

export interface ParsedArgv extends Partial<ParsedLine> {
  command: string | Command
  meta?: Meta
  next?: NextFunction
}

export interface ExecuteArgv extends ParsedArgv {
  meta: Meta
}

export interface EventMap {
  [Context.MIDDLEWARE_EVENT]: Middleware

  // CQHTTP events
  'message' (meta: Meta): void
  'message/normal' (meta: Meta): void
  'message/notice' (meta: Meta): void
  'message/anonymous' (meta: Meta): void
  'message/friend' (meta: Meta): void
  'message/group' (meta: Meta): void
  'message/discuss' (meta: Meta): void
  'message/other' (meta: Meta): void
  'friend-add' (meta: Meta): void
  'group-increase' (meta: Meta): void
  'group-increase/invite' (meta: Meta): void
  'group-increase/approve' (meta: Meta): void
  'group-decrease' (meta: Meta): void
  'group-decrease/leave' (meta: Meta): void
  'group-decrease/kick' (meta: Meta): void
  'group-decrease/kick-me' (meta: Meta): void
  'group-upload' (meta: Meta): void
  'group-admin' (meta: Meta): void
  'group-admin/set' (meta: Meta): void
  'group-admin/unset' (meta: Meta): void
  'group-ban' (meta: Meta): void
  'group-ban/ban' (meta: Meta): void
  'group-ban/lift-ban' (meta: Meta): void
  'group_recall' (meta: Meta): void
  'request/friend' (meta: Meta): void
  'request/group/add' (meta: Meta): void
  'request/group/invite' (meta: Meta): void
  'heartbeat' (meta: Meta): void
  'lifecycle' (meta: Meta): void
  'lifecycle/enable' (meta: Meta): void
  'lifecycle/disable' (meta: Meta): void
  'lifecycle/connect' (meta: Meta): void

  // Koishi events
  'parse' (message: string, meta: Meta, forced: boolean): undefined | ParsedArgv
  'before-attach-user' (meta: Meta, fields: Set<UserField>): void
  'before-attach-group' (meta: Meta, fields: Set<GroupField>): void
  'attach-user' (meta: Meta): void | boolean | Promise<void | boolean>
  'attach-group' (meta: Meta): void | boolean | Promise<void | boolean>
  'attach' (meta: Meta): void | Promise<void>
  'send' (meta: Meta): void | Promise<void>
  'before-send' (meta: Meta): void | boolean
  'before-command' (argv: ParsedCommandLine): void | boolean | Promise<void | boolean>
  'command' (argv: ParsedCommandLine): void | Promise<void>
  'after-middleware' (meta: Meta): void
  'new-command' (cmd: Command): void
  'remove-command' (cmd: Command): void
  'ready' (): void
  'before-connect' (): void | Promise<void>
  'connect' (): void
  'before-disconnect' (): void | Promise<void>
  'disconnect' (): void
  'dispose' (): void
}

export type Events = keyof EventMap
