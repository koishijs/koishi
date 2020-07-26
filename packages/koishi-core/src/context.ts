import { contain, union, intersection, difference, noop, Logger } from 'koishi-utils'
import { Command, CommandConfig, ParsedCommandLine, ParsedLine } from './command'
import { Meta, contextTypes, getSessionId } from './meta'
import { Sender } from './sender'
import { App } from './app'
import { Database, UserField, GroupField } from './database'
import { errors } from './shared'
import { inspect } from 'util'

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

export class Context {
  public app: App
  public sender: Sender
  public database: Database

  static readonly MIDDLEWARE_EVENT: unique symbol = Symbol('mid')

  constructor (public readonly identifier: string, private readonly _scope: ContextScope) {}

  [inspect.custom] () {
    return `Context <${this.identifier}>`
  }

  logger (name: string) {
    return Logger.create(name)
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
    this.logger('hook').debug(name)
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
    this.logger('hook').debug(name)
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

  execute (argv: ExecuteArgv): Promise<ParsedCommandLine>
  execute (message: string, meta: Meta, next?: NextFunction): Promise<ParsedCommandLine>
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

    await argv.command.execute(argv)
    return argv
  }

  end () {
    return this.app
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
  'ready' (): void
  'before-connect' (): void
  'connect' (): void
  'before-disconnect' (): void
  'disconnect' (): void
}

export type Events = keyof EventMap
