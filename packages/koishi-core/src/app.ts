import debug from 'debug'
import escapeRegex from 'escape-string-regexp'
import { Sender } from './sender'
import { Server, createServer, ServerType } from './server'
import { Command, ShortcutConfig, ParsedCommandLine } from './command'
import { Context, Middleware, NextFunction, ContextScope } from './context'
import { GroupFlag, UserFlag, UserField, createDatabase, DatabaseConfig, GroupField } from './database'
import { Meta } from './meta'
import { simplify, noop } from 'koishi-utils'
import { errors, messages } from './messages'
import { ParsedLine } from './parser'
import help from './plugins/help'

export interface AppOptions {
  port?: number
  token?: string
  secret?: string
  selfId?: number
  server?: string
  type?: ServerType
  database?: DatabaseConfig
  nickname?: string | string[]
  retryTimes?: number
  retryInterval?: number
  maxMiddlewares?: number
  commandPrefix?: string | string[]
  quickOperationTimeout?: number
  similarityCoefficient?: number
}

const selfIds = new Set<number>()
export const appMap: Record<number, App> = {}
export const appList: App[] = []

const onStartHooks = new Set<(...app: App[]) => void>()
export function onStart (hook: (...app: App[]) => void) {
  onStartHooks.add(hook)
}

const onStopHooks = new Set<(...app: App[]) => void>()
export function onStop (hook: (...app: App[]) => void) {
  onStopHooks.add(hook)
}

export async function startAll () {
  await Promise.all(appList.map(async app => app.start()))
}

export async function stopAll () {
  await Promise.all(appList.map(async app => app.stop()))
}

let getSelfIdsPromise: Promise<any>
export async function getSelfIds () {
  if (!getSelfIdsPromise) {
    getSelfIdsPromise = Promise.all(appList.map(async (app) => {
      if (app.selfId || !app.options.type) return
      const info = await app.sender.getLoginInfo()
      app.prepare(info.userId)
    }))
  }
  await getSelfIdsPromise
  return Array.from(selfIds)
}

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
}

export enum Status { closed, opening, open, closing }

export class App extends Context {
  app = this
  options: AppOptions
  server: Server
  atMeRE: RegExp
  prefixRE: RegExp
  nicknameRE: RegExp
  status = Status.closed

  _commands: Command[] = []
  _commandMap: Record<string, Command> = {}
  _shortcuts: ShortcutConfig[] = []
  _shortcutMap: Record<string, Command> = {}
  _middlewares: [Context, Middleware][] = []
  _hooks: Record<keyof any, [Context, (...args: any[]) => any][]> = {}

  private _users: MajorContext
  private _groups: MajorContext
  private _discusses: MajorContext
  private _isReady = false
  private _middlewareCounter = 0
  private _middlewareSet = new Set<number>()
  private _contexts: Record<string, Context> = { [appIdentifier]: this }

  constructor (options: AppOptions = {}) {
    super(appIdentifier, appScope)

    // resolve options
    this.options = { ...defaultOptions, ...options }
    if (options.database && Object.keys(options.database).length) {
      this.database = createDatabase(options.database)
    }
    if (!options.type && typeof options.server === 'string') {
      this.options.type = this.options.server.split(':', 1)[0] as any
    }
    if (this.options.type) {
      this.server = createServer(this)
      this.sender = new Sender(this)
    }

    // register application
    appList.push(this)
    if (this.selfId) this.prepare()

    // bind built-in event listeners
    this.on('message', this._applyMiddlewares)
    this.on('before-attach-user', Command.attachUserFields)
    this.on('before-attach-group', Command.attachGroupFields)
    this.middleware(this._preprocess)

    // apply default logger
    this.on('logger', (scope, message) => debug(scope)(message))

    // apply internal plugins
    this.plugin(help)
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

  get selfId () {
    return this.options.selfId
  }

  get version () {
    return this.server?.version
  }

  prepare (selfId?: number) {
    if (selfId) {
      this.options.selfId = selfId
      if (!this._isReady && this.server.isListening) {
        this.parallelize('ready')
        this._isReady = true
      }
    }
    appMap[this.selfId] = this
    selfIds.add(this.selfId)
    if (this.server) {
      this.server.appMap[this.selfId] = this
    }
    const { nickname, commandPrefix } = this.options
    const nicknames = Array.isArray(nickname) ? nickname : nickname ? [nickname] : []
    const prefixes = Array.isArray(commandPrefix) ? commandPrefix : [commandPrefix || '']
    this.atMeRE = new RegExp(`^\\[CQ:at,qq=${this.selfId}\\]${nicknameSuffix}`)
    this.nicknameRE = createLeadingRE(nicknames, '@?', nicknameSuffix)
    this.prefixRE = createLeadingRE(prefixes)
  }

  destroy () {
    const index = appList.indexOf(this)
    if (index >= 0) appList.splice(index, 1)
    delete appMap[this.selfId]
    selfIds.delete(this.selfId)
    if (this.server) {
      const index = this.server.appList.indexOf(this)
      if (index >= 0) this.server.appList.splice(index, 1)
      delete this.server.appMap[this.selfId]
    }
  }

  createContext (scope: string | ContextScope) {
    if (typeof scope === 'string') scope = ContextScope.parse(scope)
    scope = scope.map(([include, exclude]) => {
      return include ? [include.sort(), exclude] : [include, exclude.sort()]
    })
    const identifier = ContextScope.stringify(scope)
    if (!this._contexts[identifier]) {
      const ctx = this._contexts[identifier] = new Context(identifier, scope)
      ctx.database = this.database
      ctx.sender = this.sender
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

  async start () {
    this.status = Status.opening
    this.parallelize('before-connect')
    const tasks: Promise<any>[] = []
    if (this.database) {
      for (const type in this.options.database) {
        tasks.push(this.database[type]?.start?.())
      }
    }
    if (this.server) {
      tasks.push(this.server.listen())
    }
    await Promise.all(tasks)
    this.status = Status.open
    this.logger('koishi:app').debug('started')
    this.parallelize('connect')
    if (this.selfId && !this._isReady) {
      this.parallelize('ready')
      this._isReady = true
    }
    if (appList.every(app => app.status === Status.open)) {
      onStartHooks.forEach(hook => hook(...appList))
    }
  }

  async stop () {
    this.status = Status.closing
    this.parallelize('before-disconnect')
    const tasks: Promise<any>[] = []
    if (this.database) {
      for (const type in this.options.database) {
        tasks.push(this.database[type]?.stop?.())
      }
    }
    await Promise.all(tasks)
    if (this.server) {
      this.server.close()
    }
    this.status = Status.closed
    this.logger('koishi:app').debug('stopped')
    this.parallelize('disconnect')
    if (appList.every(app => app.status === Status.closed)) {
      onStopHooks.forEach(hook => hook(...appList))
    }
  }

  private _preprocess = async (meta: Meta<'message'>, next: NextFunction) => {
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
    Object.defineProperty(meta, '$parsed', {
      value: { atMe, nickname, prefix, message },
    })

    // parse as command
    if (!meta.$argv && (prefix !== null || nickname || meta.messageType === 'private')) {
      Object.defineProperty(meta, '$argv', {
        configurable: true,
        value: this.parseCommandLine(message, meta),
      })
    }

    // parse as shortcut
    if (!meta.$argv && !prefix) {
      for (const shortcut of this._shortcuts) {
        const { name, fuzzy, command, oneArg, prefix, options, args = [] } = shortcut
        if (prefix && !nickname) continue
        if (!fuzzy && message !== name) continue
        if (message.startsWith(name)) {
          const _message = message.slice(name.length)
          if (fuzzy && !nickname && _message.match(/^\S/)) continue
          const result: ParsedLine = oneArg
            ? { rest: '', options: {}, unknown: [], args: [_message.trim()] }
            : command.parse(_message.trim())
          result.options = { ...options, ...result.options }
          result.args.unshift(...args)
          Object.defineProperty(meta, '$argv', {
            configurable: true,
            value: { meta, command, ...result },
          })
          break
        }
      }
    }

    if (!meta.$argv) {
      Object.defineProperty(meta, '$argv', {
        configurable: true,
        value: { meta },
      })
    }

    const { command } = meta.$argv
    if (this.database) {
      if (meta.messageType === 'group') {
        // attach group data
        const groupFields = new Set<GroupField>(['flag', 'assignee'])
        this.parallelize(meta, 'before-attach-group', meta, groupFields)
        const group = await this.database.observeGroup(meta.groupId, Array.from(groupFields))
        Object.defineProperty(meta, '$group', { value: group, writable: true })

        // emit attach event
        if (this.serialize(meta, 'attach-group', meta)) return

        // ignore some group calls
        const isAssignee = !group.assignee || group.assignee === this.selfId
        const noCommand = group.flag & GroupFlag.noCommand
        const noResponse = group.flag & GroupFlag.noResponse || !isAssignee
        if (noCommand && command) return
        if (noResponse && !atMe) return
        const originalNext = next
        next = (fallback?: NextFunction) => noResponse as never || originalNext(fallback)
      }

      // attach user data
      const userFields = new Set<UserField>(['flag'])
      this.parallelize(meta, 'before-attach-user', meta, userFields)
      const user = await this.database.observeUser(meta.userId, Array.from(userFields))
      Object.defineProperty(meta, '$user', { value: user, writable: true })

      // emit attach event
      if (this.serialize(meta, 'attach-user', meta)) return

      // ignore some user calls
      if (user.flag & UserFlag.ignore) return
    }

    // execute command
    if (command) {
      return command.execute(meta.$argv, next)
    }

    return next()
  }

  parseCommandLine (message: string, meta: Meta<'message'>): ParsedCommandLine {
    const name = message.split(/\s/, 1)[0]
    const command = this._getCommandByRawName(name)
    if (command?.context.match(meta)) {
      const result = command.parse(message.slice(name.length).trimStart())
      return { meta, command, ...result }
    }
  }

  executeCommandLine (message: string, meta: Meta<'message'>, next: NextFunction = noop) {
    if (!('$ctxType' in meta)) this.server.parseMeta(meta)
    const argv = this.parseCommandLine(message, meta)
    if (argv && !argv.command.getConfig('disable', meta)) {
      return argv.command.execute(argv, next)
    }
    return next()
  }

  private _applyMiddlewares = async (meta: Meta<'message'>) => {
    // preparation
    const counter = this._middlewareCounter++
    this._middlewareSet.add(counter)
    const middlewares: Middleware[] = this._middlewares
      .filter(([context]) => context.match(meta))
      .map(([_, middleware]) => middleware)

    // execute middlewares
    let index = 0
    const next = async (fallback?: NextFunction) => {
      if (!this._middlewareSet.has(counter)) {
        return this.logger('koishi').warn(new Error(errors.ISOLATED_NEXT))
      }
      if (fallback) middlewares.push((_, next) => fallback(next))
      try {
        return middlewares[index++]?.(meta, next)
      } catch (error) {
        this.parallelize('error/middleware', error)
        this.parallelize('error', error)
      }
    }
    await next()

    // update middleware set
    this._middlewareSet.delete(counter)
    this.parallelize(meta, 'after-middleware', meta)

    // flush user & group data
    await meta.$user?._update()
    await meta.$group?._update()
  }
}
