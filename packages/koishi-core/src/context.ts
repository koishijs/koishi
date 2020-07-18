import { contain, union, intersection, difference, noop } from 'koishi-utils'
import { Command, CommandConfig, ParsedCommandLine, InputArgv } from './command'
import { Meta, contextTypes, getSessionId } from './meta'
import { Sender } from './sender'
import { App } from './app'
import { Database, UserField, GroupField } from './database'
import { errors } from './shared'
import { format, inspect } from 'util'

export type NextFunction = (next?: NextFunction) => Promise<void>
export type Middleware = (meta: Meta, next: NextFunction) => any
export type PluginFunction <T, U = any> = (ctx: T, options: U) => void
export type PluginObject <T, U = any> = { name?: string, apply: PluginFunction<T, U> }
export type Plugin <T, U = any> = PluginFunction<T, U> | PluginObject<T, U>

type Subscope = [number[], number[]]
export type ContextScope = Subscope[]

export namespace ContextScope {
  export function stringify (scope: ContextScope) {
    return scope.map(([include, exclude], index) => {
      const type = contextTypes[index]
      const sign = include ? '+' : '-'
      const idList = include || exclude
      return `${type}${sign}${idList.join(',')}`
    }).filter(a => a).join(';')
  }

  export function parse (identifier: string) {
    const scope = noopScope.slice()
    identifier.split(';').forEach((segment) => {
      const capture = /^(user|group|discuss)(?:([+-])(\d+(?:,\d+)*))?$/.exec(segment)
      if (!capture) throw new Error(errors.INVALID_IDENTIFIER)
      const [_, type, sign = '-', list] = capture
      const idList = list ? list.split(',').map(n => +n) : []
      scope[contextTypes[type]] = sign === '+' ? [idList, null] : [null, idList]
    })
    return scope
  }
}

const noopScope: ContextScope = [[[], null], [[], null], [[], null]]
const noopIdentifier = ContextScope.stringify(noopScope)

export interface Logger {
  warn (format: any, ...param: any): void
  info (format: any, ...param: any): void
  debug (format: any, ...param: any): void
  success (format: any, ...param: any): void
  error (format: any, ...param: any): void
}

export const logTypes: (keyof Logger)[] = ['warn', 'info', 'debug', 'success', 'error']

export type LogEvents = 'logger/warn' | 'logger/info' | 'logger/debug' | 'logger/success' | 'logger/error'

export class Context {
  public app: App
  public sender: Sender
  public database: Database
  public logger: (scope?: string) => Logger

  static readonly MIDDLEWARE_EVENT: unique symbol = Symbol('mid')

  constructor (public readonly identifier: string, private readonly _scope: ContextScope) {
    this.logger = (scope = '') => {
      const logger = {} as Logger
      for (const type of logTypes) {
        logger[type] = (...args) => {
          this.app.emit('logger', scope, format(...args), type)
          this.app.emit(`logger/${type}` as LogEvents, scope, format(...args))
        }
      }
      return logger
    }
  }

  [inspect.custom] () {
    return `Context <${this.identifier}>`
  }

  inverse () {
    return this.app.createContext(this._scope.map(([include, exclude]) => {
      return include ? [null, include.slice()] : [exclude.slice(), []]
    }))
  }

  plus (ctx: Context) {
    return this.app.createContext(this._scope.map(([include1, exclude1], index) => {
      const [include2, exclude2] = ctx._scope[index]
      return include1
        ? include2 ? [union(include1, include2), null] : [null, difference(exclude2, include1)]
        : [null, include2 ? difference(exclude1, include2) : intersection(exclude1, exclude2)]
    }))
  }

  minus (ctx: Context) {
    return this.app.createContext(this._scope.map(([include1, exclude1], index) => {
      const [include2, exclude2] = ctx._scope[index]
      return include1
        ? [include2 ? difference(include1, include2) : intersection(include1, exclude2), null]
        : include2 ? [null, union(include2, exclude1)] : [difference(exclude2, exclude1), null]
    }))
  }

  intersect (ctx: Context) {
    return this.app.createContext(this._scope.map(([include1, exclude1], index) => {
      const [include2, exclude2] = ctx._scope[index]
      return include1
        ? [include2 ? intersection(include1, include2) : difference(include1, exclude2), null]
        : include2 ? [difference(include2, exclude1), null] : [null, union(exclude1, exclude2)]
    }))
  }

  match (meta: Meta) {
    if (!meta || !meta.$ctxType) return true
    const [include, exclude] = this._scope[contextTypes[meta.$ctxType]]
    return include ? include.includes(meta.$ctxId) : !exclude.includes(meta.$ctxId)
  }

  contain (ctx: Context) {
    return this._scope.every(([include1, exclude1], index) => {
      const [include2, exclude2] = ctx._scope[index]
      return include1
        ? include2 && contain(include1, include2)
        : include2 ? !intersection(include2, exclude1).length : contain(exclude2, exclude1)
    })
  }

  plugin <T extends PluginFunction<this>> (plugin: T, options?: T extends PluginFunction<this, infer U> ? U : never): this
  plugin <T extends PluginObject<this>> (plugin: T, options?: T extends PluginObject<this, infer U> ? U : never): this
  plugin <T extends Plugin<this>> (plugin: T, options?: T extends Plugin<this, infer U> ? U : never) {
    if (options === false) return
    const ctx = Object.create(this)
    if (typeof plugin === 'function') {
      (plugin as PluginFunction<this>)(ctx, options)
    } else if (plugin && typeof plugin === 'object' && typeof plugin.apply === 'function') {
      (plugin as PluginObject<this>).apply(ctx, options)
    } else {
      throw new Error(errors.INVALID_PLUGIN)
    }
    return this
  }

  async parallelize <K extends keyof EventMap> (name: K, ...args: Parameters<EventMap[K]>): Promise<void>
  async parallelize <K extends keyof EventMap> (meta: Meta, name: K, ...args: Parameters<EventMap[K]>): Promise<void>
  async parallelize (...args: any[]) {
    const tasks: Promise<any>[] = []
    const meta = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
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
    for (const [context, callback] of this.app._hooks[name] || []) {
      if (!context.match(meta)) continue
      const result = callback.apply(this, args)
      if (result) return result
    }
  }

  on <K extends keyof EventMap> (name: K, listener: EventMap[K]) {
    return this.addListener(name, listener)
  }

  addListener <K extends keyof EventMap> (name: K, listener: EventMap[K]) {
    this.app._hooks[name] = this.app._hooks[name] || []
    this.app._hooks[name].push([this, listener])
    return () => this.off(name, listener)
  }

  before <K extends keyof EventMap> (name: K, listener: EventMap[K]) {
    return this.prependListener(name, listener)
  }

  prependListener <K extends keyof EventMap> (name: K, listener: EventMap[K]) {
    this.app._hooks[name] = this.app._hooks[name] || []
    this.app._hooks[name].unshift([this, listener])
    return () => this.off(name, listener)
  }

  once <K extends keyof EventMap> (name: K, listener: EventMap[K]) {
    const unsubscribe = this.on(name, (...args: any[]) => {
      unsubscribe()
      return listener.apply(this, args)
    })
    return unsubscribe
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
            throw new Error(errors.INVALID_SUBCOMMAND)
          }
          if (command.parent) {
            if (command.parent !== parent) {
              throw new Error(errors.INVALID_SUBCOMMAND)
            }
          } else if (parent.context.contain(command.context)) {
            command.parent = parent
            parent.children.push(command)
          } else {
            throw new Error(errors.INVALID_CONTEXT)
          }
        }
        return parent = command
      }
      const context = parent ? this.intersect(parent.context) : this
      if (context.identifier === noopIdentifier) {
        throw new Error(errors.INVALID_CONTEXT)
      }
      command = new Command(name, declaration, context)
      if (parent) {
        command.parent = parent
        parent.children.push(command)
      }
      parent = command
    })

    Object.assign(parent.config, config)
    return parent
  }

  private _getCommandByRawName <U extends UserField = never, G extends GroupField = never> (name: string) {
    const index = name.lastIndexOf('/')
    return this.app._commandMap[name.slice(index + 1).toLowerCase()] as Command<U, G>
  }

  parse <U extends UserField, G extends GroupField> (message: string, meta: Meta<U, G>, next: NextFunction = noop): ParsedCommandLine<U, G> {
    if (!message) return
    const name = message.split(/\s/, 1)[0]
    const command = this._getCommandByRawName<U, G>(name)
    if (command?.context.match(meta)) {
      const result = command.parse(message.slice(name.length).trimStart())
      return { meta, command, next, ...result }
    }
  }

  execute (argv: InputArgv): Promise<void>
  execute (message: string, meta: Meta, next?: NextFunction): Promise<void>
  async execute (...args: [InputArgv] | [string, Meta, NextFunction?]) {
    const meta = typeof args[0] === 'string' ? args[1] : args[0].meta
    if (!('$ctxType' in meta)) this.app.server.parseMeta(meta)
    let argv: ParsedCommandLine, next: NextFunction = noop
    if (typeof args[0] === 'string') {
      const name = args[0].split(/\s/, 1)[0]
      const command = this._getCommandByRawName(name)
      next = args[2] || noop
      if (!command?.context.match(meta)) return next()
      const result = command.parse(args[0].slice(name.length).trimStart())
      argv = { meta, command, ...result }
    } else {
      argv = args[0] as any
      next = argv.next || noop
      if (typeof argv.command === 'string') {
        argv.command = this.command(argv.command)
      }
      if (!argv.command?.context.match(meta)) return next()
    }

    meta.$argv = argv

    if (this.database) {
      if (meta.messageType === 'group') {
        await meta.observeGroup()
      }
      await meta.observeUser()
    }

    return argv.command.execute(argv, next)
  }

  end () {
    return this.app
  }
}

export interface EventMap {
  [Context.MIDDLEWARE_EVENT]: Middleware

  // CQHTTP events
  'message' (meta: Meta): any
  'message/normal' (meta: Meta): any
  'message/notice' (meta: Meta): any
  'message/anonymous' (meta: Meta): any
  'message/friend' (meta: Meta): any
  'message/group' (meta: Meta): any
  'message/discuss' (meta: Meta): any
  'message/other' (meta: Meta): any
  'friend-add' (meta: Meta): any
  'group-increase' (meta: Meta): any
  'group-increase/invite' (meta: Meta): any
  'group-increase/approve' (meta: Meta): any
  'group-decrease' (meta: Meta): any
  'group-decrease/leave' (meta: Meta): any
  'group-decrease/kick' (meta: Meta): any
  'group-decrease/kick-me' (meta: Meta): any
  'group-upload' (meta: Meta): any
  'group-admin' (meta: Meta): any
  'group-admin/set' (meta: Meta): any
  'group-admin/unset' (meta: Meta): any
  'group-ban' (meta: Meta): any
  'group-ban/ban' (meta: Meta): any
  'group-ban/lift-ban' (meta: Meta): any
  'request/friend' (meta: Meta): any
  'request/group/add' (meta: Meta): any
  'request/group/invite' (meta: Meta): any
  'heartbeat' (meta: Meta): any
  'lifecycle' (meta: Meta): any
  'lifecycle/enable' (meta: Meta): any
  'lifecycle/disable' (meta: Meta): any
  'lifecycle/connect' (meta: Meta): any

  // Koishi events
  'session' (meta: Meta): any
  'before-attach' (meta: Meta): any
  'before-attach-user' (meta: Meta, fields: Set<UserField>): any
  'before-attach-group' (meta: Meta, fields: Set<GroupField>): any
  'attach-user' (meta: Meta): any
  'attach-group' (meta: Meta): any
  'attach' (meta: Meta): any
  'send' (meta: Meta): any
  'before-send' (meta: Meta): any
  'before-command' (argv: ParsedCommandLine): any
  'command' (argv: ParsedCommandLine): any
  'after-middleware' (meta: Meta): any
  'error' (error: Error): any
  'error/command' (error: Error): any
  'error/middleware' (error: Error): any
  'logger' (scope: string, message: string, type: keyof Logger): any
  'logger/debug' (scope: string, message: string): any
  'logger/info' (scope: string, message: string): any
  'logger/error' (scope: string, message: string): any
  'logger/warn' (scope: string, message: string): any
  'logger/success' (scope: string, message: string): any
  'new-command' (cmd: Command): any
  'ready' (): any
  'before-connect' (): any
  'connect' (): any
  'before-disconnect' (): any
  'disconnect' (): any
}

export type Events = keyof EventMap
