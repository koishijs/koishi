import { intersection, difference, noop, Logger, defineProperty } from 'koishi-utils'
import { Command, CommandConfig, ParsedCommandLine, ParsedLine } from './command'
import { Session, getSessionId } from './session'
import { User, Group, Database } from './database'
import { App } from './app'

export type NextFunction = (next?: NextFunction) => Promise<void>
export type Middleware = (session: Session, next: NextFunction) => any
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

  match (session: Session) {
    if (!session) return true
    return matchScope(this.scope.groups, session.groupId)
      && matchScope(this.scope.users, session.userId)
      && (this.scope.private || session.messageType !== 'private')
  }

  plugin <T extends PluginFunction<this>> (plugin: T, options?: T extends PluginFunction<this, infer U> ? U : never): this
  plugin <T extends PluginObject<this>> (plugin: T, options?: T extends PluginObject<this, infer U> ? U : never): this
  plugin <T extends Plugin<this>> (plugin: T, options?: T extends Plugin<this, infer U> ? U : never) {
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

  async parallel <K extends keyof EventMap> (name: K, ...args: Parameters<EventMap[K]>): Promise<void>
  async parallel <K extends keyof EventMap> (session: Session, name: K, ...args: Parameters<EventMap[K]>): Promise<void>
  async parallel (...args: any[]) {
    const tasks: Promise<any>[] = []
    const session = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    this.logger('dispatch').debug(name)
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(session)) continue
      tasks.push(callback.apply(session, args))
    }
    await Promise.all(tasks)
  }

  emit <K extends keyof EventMap> (name: K, ...args: Parameters<EventMap[K]>): void
  emit <K extends keyof EventMap> (session: Session, name: K, ...args: Parameters<EventMap[K]>): void
  emit (...args: [any, ...any[]]) {
    this.parallel(...args)
  }

  async serial <K extends keyof EventMap> (name: K, ...args: Parameters<EventMap[K]>): Promise<ReturnType<EventMap[K]>>
  async serial <K extends keyof EventMap> (session: Session, name: K, ...args: Parameters<EventMap[K]>): Promise<ReturnType<EventMap[K]>>
  async serial (...args: any[]) {
    const session = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    this.logger('dispatch').debug(name)
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(session)) continue
      const result = await callback.apply(this, args)
      if (result) return result
    }
  }

  bail <K extends keyof EventMap> (name: K, ...args: Parameters<EventMap[K]>): ReturnType<EventMap[K]>
  bail <K extends keyof EventMap> (session: Session, name: K, ...args: Parameters<EventMap[K]>): ReturnType<EventMap[K]>
  bail (...args: any[]) {
    const session = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    this.logger('dispatch').debug(name)
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(session)) continue
      const result = callback.apply(this, args)
      if (result) return result
    }
  }

  private getHooks <K extends keyof EventMap> (name: K) {
    const hooks = this.app._hooks[name] || (this.app._hooks[name] = [])
    if (hooks.length >= this.app.options.maxListeners) {
      throw new Error('max listener count (%d) exceeded, which may be caused by a memory leak')
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

  private resolve (argv: ParsedArgv, session: Session, next: NextFunction) {
    if (typeof argv.command === 'string') {
      argv.command = this.app._commandMap[argv.command]
    }
    if (!argv.command?.context.match(session)) return
    return { session, next, ...argv } as ParsedCommandLine
  }

  parse (message: string, session: Session, next: NextFunction = noop, forced = false): ParsedCommandLine {
    if (!message) return
    const argv = this.bail(session, 'parse', message, session, forced)
    if (argv) return this.resolve(argv, session, next)
  }

  execute (argv: ExecuteArgv): Promise<void>
  execute (message: string, session: Session, next?: NextFunction): Promise<void>
  async execute (...args: [ExecuteArgv] | [string, Session, NextFunction?]) {
    const session = typeof args[0] === 'string' ? args[1] : args[0].session
    if (!('$ctxType' in session)) this.app.server.parseMeta(session)

    let argv: ParsedCommandLine, next: NextFunction
    if (typeof args[0] === 'string') {
      next = args[2] || noop
      argv = this.parse(args[0], session, next)
    } else {
      next = args[0].next || noop
      argv = this.resolve(args[0], session, next)
    }
    if (!argv) return next()

    if (this.database) {
      if (session.messageType === 'group') {
        await session.$observeGroup()
      }
      await session.$observeUser()
    }

    return argv.command.execute(argv)
  }

  dispose () {
    this._disposables.forEach(dispose => dispose())
  }
}

export interface ParsedArgv extends Partial<ParsedLine> {
  command: string | Command
  session?: Session
  next?: NextFunction
}

export interface ExecuteArgv extends ParsedArgv {
  session: Session
}

export interface EventMap {
  [Context.MIDDLEWARE_EVENT]: Middleware

  // CQHTTP events
  'message' (session: Session): void
  'message/normal' (session: Session): void
  'message/notice' (session: Session): void
  'message/anonymous' (session: Session): void
  'message/friend' (session: Session): void
  'message/group' (session: Session): void
  'message/discuss' (session: Session): void
  'message/other' (session: Session): void
  'friend-add' (session: Session): void
  'group-increase' (session: Session): void
  'group-increase/invite' (session: Session): void
  'group-increase/approve' (session: Session): void
  'group-decrease' (session: Session): void
  'group-decrease/leave' (session: Session): void
  'group-decrease/kick' (session: Session): void
  'group-decrease/kick-me' (session: Session): void
  'group-upload' (session: Session): void
  'group-admin' (session: Session): void
  'group-admin/set' (session: Session): void
  'group-admin/unset' (session: Session): void
  'group-ban' (session: Session): void
  'group-ban/ban' (session: Session): void
  'group-ban/lift-ban' (session: Session): void
  'group_recall' (session: Session): void
  'request/friend' (session: Session): void
  'request/group/add' (session: Session): void
  'request/group/invite' (session: Session): void
  'heartbeat' (session: Session): void
  'lifecycle' (session: Session): void
  'lifecycle/enable' (session: Session): void
  'lifecycle/disable' (session: Session): void
  'lifecycle/connect' (session: Session): void

  // Koishi events
  'parse' (message: string, session: Session, forced: boolean): undefined | ParsedArgv
  'before-attach-user' (session: Session, fields: Set<User.Field>): void
  'before-attach-group' (session: Session, fields: Set<Group.Field>): void
  'attach-user' (session: Session): void | boolean | Promise<void | boolean>
  'attach-group' (session: Session): void | boolean | Promise<void | boolean>
  'attach' (session: Session): void | Promise<void>
  'send' (session: Session): void | Promise<void>
  'before-send' (session: Session): void | boolean
  'before-command' (argv: ParsedCommandLine): void | boolean | Promise<void | boolean>
  'command' (argv: ParsedCommandLine): void | Promise<void>
  'after-middleware' (session: Session): void
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
