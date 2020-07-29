import escapeRegex from 'escape-string-regexp'
import { Command, ShortcutConfig } from './command'
import { Context, Middleware, NextFunction, ContextScope } from './context'
import { GroupFlag, UserFlag, GroupField, UserField, Database } from './database'
import { BotOptions, CQServer } from './server'
import { Meta } from './meta'
import { simplify } from 'koishi-utils'
import { emitter, errors } from './shared'
import { types } from 'util'

export interface AppOptions extends BotOptions {
  port?: number
  secret?: string
  path?: string
  type?: CQServer.Type
  bots?: BotOptions[]
  prefix?: string | string[]
  nickname?: string | string[]
  retryTimes?: number
  retryInterval?: number
  maxMiddlewares?: number
  defaultAuthority?: number | ((meta: Meta) => number)
  quickOperationTimeout?: number
  similarityCoefficient?: number
  userCacheTimeout?: number
  groupCacheTimeout?: number
}

export const onApp = (callback: (app: App) => any) => emitter.on('app', callback)

export interface MajorContext extends Context {
  except (...ids: number[]): Context
}

const appScope: ContextScope = [[null, []], [null, []], [null, []]]
const appIdentifier = ContextScope.stringify(appScope)

const nicknameSuffix = '([,，]\\s*|\\s+)'
function createLeadingRE (patterns: string[], prefix = '', suffix = '') {
  return patterns.length ? new RegExp(`^${prefix}(${patterns.map(escapeRegex).join('|')})${suffix}`) : /^/
}

const defaultOptions: AppOptions = {
  maxMiddlewares: 64,
  retryInterval: 5000,
  userCacheTimeout: 60000,
  groupCacheTimeout: 300000,
  quickOperationTimeout: 100,
}

export enum Status { closed, opening, open, closing }

export class App extends Context {
  app = this
  options: AppOptions
  server: CQServer
  atMeRE: RegExp
  prefixRE: RegExp
  nicknameRE: RegExp
  status = Status.closed

  _database: Database
  _commands: Command[] = []
  _commandMap: Record<string, Command> = {}
  _shortcuts: ShortcutConfig[] = []
  _shortcutMap: Record<string, Command> = {}
  _hooks: Record<keyof any, [Context, (...args: any[]) => any][]> = {}

  private _users: MajorContext
  private _groups: MajorContext
  private _discusses: MajorContext
  private _isReady = false
  private _middlewareCounter = 0
  private _middlewareSet = new Set<number>()
  private _contexts: Record<string, Context> = { [appIdentifier]: this }
  private _getSelfIdsPromise: Promise<any>

  constructor (options: AppOptions = {}) {
    super(appIdentifier, appScope)
    options = this.options = { ...defaultOptions, ...options }
    if (!options.bots) options.bots = [options]

    if (!options.type) {
      const { server } = options.bots[0]
      if (server) {
        options.type = server.split(':', 1)[0] as any
      } else if (options.port) {
        // TODO ws reverse support
        options.type = 'ws-reverse' as any
      }
    }

    const Server = CQServer.types[options.type]
    if (!Server) {
      throw new Error(
        `unsupported server type "${options.type}", expect ` +
        Object.keys(CQServer.types).map(type => `"${type}"`).join(', '))
    }
    this.server = new Server(this)

    const { nickname, prefix } = this.options
    const nicknames = Array.isArray(nickname) ? nickname : nickname ? [nickname] : []
    const prefixes = Array.isArray(prefix) ? prefix : [prefix || '']
    this.nicknameRE = createLeadingRE(nicknames, '@?', nicknameSuffix)
    this.prefixRE = createLeadingRE(prefixes)
    this.prepare()

    // bind built-in event listeners
    this.on('message', this._applyMiddlewares)
    this.middleware(this._preprocess)
    emitter.emit('app', this)

    this.on('parse', (message, { $parsed, messageType }, forced) => {
      if (forced && $parsed.prefix === null && !$parsed.nickname && messageType !== 'private') return
      const name = message.split(/\s/, 1)[0]
      const index = name.lastIndexOf('/')
      const command = this.app._commandMap[name.slice(index + 1).toLowerCase()]
      if (!command) return
      const result = command.parse(message.slice(name.length).trimStart())
      return { command, ...result }
    })
  }

  get bots () {
    return this.server.bots
  }

  async getSelfIds () {
    if (!this._getSelfIdsPromise) {
      this._getSelfIdsPromise = Promise.all(this.bots.map(async (bot) => {
        if (bot.selfId) return
        const info = await bot.sender.getLoginInfo()
        bot.selfId = info.userId
        this.prepare()
      }))
    }
    await this._getSelfIdsPromise
    return this.bots.map(bot => bot.selfId)
  }

  get users () {
    if (this._users) return this._users
    const users = this.createContext([[null, []], [[], null], [[], null]]) as MajorContext
    users.except = (...ids) => this.createContext([[null, ids], [[], null], [[], null]])
    return this._users = users
  }

  get groups () {
    if (this._groups) return this._groups
    const groups = this.createContext([[[], null], [null, []], [[], null]]) as MajorContext
    groups.except = (...ids) => this.createContext([[[], null], [null, ids], [[], null]])
    return this._groups = groups
  }

  get discusses () {
    if (this._discusses) return this._discusses
    const discusses = this.createContext([[[], null], [[], null], [null, []]]) as MajorContext
    discusses.except = (...ids) => this.createContext([[[], null], [[], null], [null, ids]])
    return this._discusses = discusses
  }

  prepare () {
    const selfIds = this.bots.filter(bot => bot.selfId).map(bot => `[CQ:at,qq=${bot.selfId}]`)
    this.atMeRE = createLeadingRE(selfIds)
  }

  createContext (scope: string | ContextScope) {
    if (typeof scope === 'string') scope = ContextScope.parse(scope)
    scope = scope.map(([include, exclude]) => {
      return include ? [include.sort(), exclude] : [include, exclude.sort()]
    })
    const identifier = ContextScope.stringify(scope)
    if (!this._contexts[identifier]) {
      const ctx = this._contexts[identifier] = new Context(identifier, scope)
      ctx.app = this
    }
    return this._contexts[identifier]
  }

  discuss (...ids: number[]) {
    return this.createContext([[[], null], [[], null], [ids, null]])
  }

  group (...ids: number[]) {
    return this.createContext([[[], null], [ids, null], [[], null]])
  }

  user (...ids: number[]) {
    return this.createContext([[ids, null], [[], null], [[], null]])
  }

  _ready () {
    if (this._isReady || !this.bots.every(bot => bot.selfId)) return
    this._isReady = true
    this.emit('ready')
  }

  async start () {
    this.status = Status.opening
    await this.parallelize('before-connect')
    this.status = Status.open
    this.logger('app').debug('started')
    this.emit('connect')
    this._ready()
  }

  async stop () {
    this.status = Status.closing
    await this.parallelize('before-disconnect')
    this.status = Status.closed
    this.logger('app').debug('stopped')
    this.emit('disconnect')
  }

  private _preprocess = async (meta: Meta, next: NextFunction) => {
    // strip prefix
    let capture: RegExpMatchArray
    let atMe = false
    let nickname = ''
    let prefix: string = null
    let message = simplify(meta.message.trim())

    if (meta.messageType !== 'private' && (capture = message.match(this.atMeRE))) {
      atMe = true
      nickname = capture[0]
      message = message.slice(capture[0].length)
    }

    if ((capture = message.match(this.nicknameRE))?.[0].length) {
      nickname = capture[0]
      message = message.slice(capture[0].length)
    }

    // eslint-disable-next-line no-cond-assign
    if (capture = message.match(this.prefixRE)) {
      prefix = capture[0]
      message = message.slice(capture[0].length)
    }

    // store parsed message
    meta.$parsed = { atMe, nickname, prefix, message }
    meta.$argv = this.parse(message, meta, next, true)

    if (this.database) {
      if (meta.messageType === 'group') {
        // attach group data
        const groupFields = new Set<GroupField>(['flag', 'assignee'])
        this.emit('before-attach-group', meta, groupFields)
        const group = await meta.observeGroup(groupFields)

        // emit attach event
        if (await this.serialize(meta, 'attach-group', meta)) return

        // ignore some group calls
        if (group.flag & GroupFlag.ignore) return
        if (group.assignee !== meta.selfId && !atMe) return
      }

      // attach user data
      const userFields = new Set<UserField>(['flag'])
      this.emit('before-attach-user', meta, userFields)
      const user = await meta.observeUser(userFields)

      // emit attach event
      if (await this.serialize(meta, 'attach-user', meta)) return

      // ignore some user calls
      if (user.flag & UserFlag.ignore) return
    }

    await this.parallelize(meta, 'attach', meta)

    // execute command
    if (!meta.$argv) return next()
    return meta.$argv.command.execute(meta.$argv)
  }

  private _applyMiddlewares = async (meta: Meta) => {
    // preparation
    const counter = this._middlewareCounter++
    this._middlewareSet.add(counter)
    const middlewares: Middleware[] = this._hooks[Context.MIDDLEWARE_EVENT as any]
      .filter(([context]) => context.match(meta))
      .map(([_, middleware]) => middleware)

    // execute middlewares
    let index = 0, stack = ''
    const next = async (fallback?: NextFunction) => {
      const lastCall = new Error().stack.split('\n', 3)[2]
      if (index) {
        const capture = lastCall.match(/\((.+)\)/)
        stack = '\n  - ' + (capture ? capture[1] : lastCall.slice(7)) + stack
      }

      try {
        if (!this._middlewareSet.has(counter)) {
          throw new Error(errors.ISOLATED_NEXT)
        }
        if (fallback) middlewares.push((_, next) => fallback(next))
        return middlewares[index++]?.(meta, next)
      } catch (error) {
        if (!types.isNativeError(error)) {
          error = new Error(error as any)
        }
        const index = error.stack.indexOf(lastCall)
        this.logger('middleware').warn(`${meta.message}\n${error.stack.slice(0, index)}Middleware stack:${stack}`)
      }
    }
    await next()

    // update middleware set
    this._middlewareSet.delete(counter)
    this.emit(meta, 'after-middleware', meta)

    // flush user & group data
    await meta.$user?._update()
    await meta.$group?._update()
  }
}
