import escapeRegex from 'escape-string-regexp'
import { Sender } from './sender'
import { Server, createServer, ServerType } from './server'
import { Command, ShortcutConfig, ParsedCommandLine } from './command'
import { Context, Middleware, NextFunction, ContextScope, Events, EventMap } from './context'
import { GroupFlag, UserFlag, UserField, createDatabase, DatabaseConfig, GroupField } from './database'
import { showSuggestions } from './utils'
import { Meta, MessageMeta } from './meta'
import { simplify, noop } from 'koishi-utils'
import { errors, messages } from './messages'
import { ParsedLine } from './parser'

export interface AppOptions {
  port?: number
  token?: string
  secret?: string
  selfId?: number
  server?: string
  type?: ServerType
  database?: DatabaseConfig
  nickname?: string | string[]
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
}

export enum Status { closed, opening, open, closing }

export class App extends Context {
  app = this
  options: AppOptions
  server: Server
  atMeRE: RegExp
  prefixRE: RegExp
  nicknameRE: RegExp
  users: MajorContext
  groups: MajorContext
  discusses: MajorContext

  _commands: Command[] = []
  _commandMap: Record<string, Command> = {}
  _shortcuts: ShortcutConfig[] = []
  _shortcutMap: Record<string, Command> = {}
  _middlewares: [Context, Middleware][] = []

  private status = Status.closed
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
    this.receiver.on('message', this._applyMiddlewares)
    this.receiver.on('before-user', Command.attachUserFields)
    this.receiver.on('before-group', Command.attachGroupFields)
    this.middleware(this._preprocess)

    // create built-in contexts
    this.users = this.createContext([[null, []], [[], null], [[], null]]) as MajorContext
    this.groups = this.createContext([[[], null], [null, []], [[], null]]) as MajorContext
    this.discusses = this.createContext([[[], null], [[], null], [null, []]]) as MajorContext
    this.users.except = (...ids) => this.createContext([[null, ids], [[], null], [[], null]])
    this.groups.except = (...ids) => this.createContext([[[], null], [null, ids], [[], null]])
    this.discusses.except = (...ids) => this.createContext([[[], null], [[], null], [null, ids]])
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
        this.receiver.emit('ready')
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
    this.receiver.emit('before-connect')
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
    this.logger('app').debug('started')
    this.receiver.emit('connect')
    if (this.selfId && !this._isReady) {
      this.receiver.emit('ready')
      this._isReady = true
    }
    if (appList.every(app => app.status === Status.open)) {
      onStartHooks.forEach(hook => hook(...appList))
    }
  }

  async stop () {
    this.status = Status.closing
    this.receiver.emit('before-disconnect')
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
    this.logger('app').debug('stopped')
    this.receiver.emit('disconnect')
    if (appList.every(app => app.status === Status.closed)) {
      onStopHooks.forEach(hook => hook(...appList))
    }
  }

  emitEvent <K extends Events> (meta: Meta, event: K, ...payload: Parameters<EventMap[K]>) {
    for (const path in this._contexts) {
      const context = this._contexts[path]
      if (!context.match(meta)) continue
      this.logger('receiver').debug(path, 'emits', event)
      context.receiver.emit(event, ...payload)
    }
  }

  private _preprocess = async (meta: MessageMeta, next: NextFunction) => {
    // strip prefix
    let capture: RegExpMatchArray
    let atMe = false, nickname = false, prefix: string = null
    let message = simplify(meta.message.trim())
    let parsedArgv: ParsedCommandLine

    if (meta.messageType !== 'private' && (capture = message.match(this.atMeRE))) {
      atMe = true
      nickname = true
      message = message.slice(capture[0].length)
    }

    if ((capture = message.match(this.nicknameRE))?.[0].length) {
      nickname = true
      message = message.slice(capture[0].length)
    }

    // eslint-disable-next-line no-cond-assign
    if (capture = message.match(this.prefixRE)) {
      prefix = capture[0]
      message = message.slice(capture[0].length)
    }

    // parse as command
    if (prefix !== null || nickname || meta.messageType === 'private') {
      parsedArgv = this.parseCommandLine(message, meta)
    }

    // parse as shortcut
    if (!parsedArgv && !prefix) {
      for (const shortcut of this._shortcuts) {
        const { name, fuzzy, command, oneArg, prefix, options, args = [] } = shortcut
        if (prefix && !nickname) continue
        if (!fuzzy && message !== name) continue
        if (message.startsWith(name)) {
          const _message = message.slice(name.length)
          if (fuzzy && !nickname && _message.match(/^\S/)) continue
          const result: ParsedLine = oneArg
            ? { rest: '', options: {}, unknown: [], args: [_message.trim()] }
            : command.parse(_message)
          result.options = { ...options, ...result.options }
          result.args.unshift(...args)
          parsedArgv = { meta, command, ...result }
          break
        }
      }
    }

    if (this.database) {
      if (meta.messageType === 'group') {
        // attach group data
        const groupFields = new Set<GroupField>(['flag', 'assignee'])
        this.receiver.emit('before-group', groupFields, parsedArgv || { meta })
        const group = await this.database.observeGroup(meta.groupId, Array.from(groupFields))
        Object.defineProperty(meta, '$group', { value: group, writable: true })

        // ignore some group calls
        const isAssignee = !group.assignee || group.assignee === this.selfId
        const noCommand = group.flag & GroupFlag.noCommand
        const noResponse = group.flag & GroupFlag.noResponse || !isAssignee
        if (noCommand && parsedArgv) return
        if (noResponse && !atMe) return
        const originalNext = next
        next = (fallback?: NextFunction) => noResponse as never || originalNext(fallback)
      }

      // attach user data
      const userFields = new Set<UserField>(['flag'])
      this.receiver.emit('before-user', userFields, parsedArgv || { meta })
      const user = await this.database.observeUser(meta.userId, Array.from(userFields))
      Object.defineProperty(meta, '$user', { value: user, writable: true })

      // ignore some user calls
      if (user.flag & UserFlag.ignore) return

      // emit attach event
      this.receiver.emit('attach', meta)
    }

    // execute command
    if (parsedArgv) return parsedArgv.command.execute(parsedArgv, next)

    // show suggestions
    const target = message.split(/\s/, 1)[0].toLowerCase()
    if (!target || !capture) return next()

    return showSuggestions({
      target,
      meta,
      next,
      prefix: messages.COMMAND_SUGGESTION_PREFIX,
      suffix: messages.COMMAND_SUGGESTION_SUFFIX,
      items: Object.keys(this._commandMap),
      coefficient: this.options.similarityCoefficient,
      command: suggestion => this._commandMap[suggestion],
      execute: async (suggestion, meta, next) => {
        const newMessage = suggestion + message.slice(target.length)
        const parsedArgv = this.parseCommandLine(newMessage, meta)
        return parsedArgv.command.execute(parsedArgv, next)
      },
    })
  }

  parseCommandLine (message: string, meta: MessageMeta): ParsedCommandLine {
    const name = message.split(/\s/, 1)[0].toLowerCase()
    const command = this._commandMap[name]
    if (command?.context.match(meta)) {
      const result = command.parse(message.slice(name.length).trimStart())
      return { meta, command, ...result }
    }
  }

  executeCommandLine (message: string, meta: MessageMeta, next: NextFunction = noop) {
    if (!('$ctxType' in meta)) this.server.parseMeta(meta)
    const argv = this.parseCommandLine(message, meta)
    if (argv) return argv.command.execute(argv, next)
    return next()
  }

  private _applyMiddlewares = async (meta: MessageMeta) => {
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
        return this.receiver.emit('error', new Error(errors.ISOLATED_NEXT))
      }
      if (fallback) middlewares.push((_, next) => fallback(next))
      try {
        return middlewares[index++]?.(meta, next)
      } catch (error) {
        this.receiver.emit('error/middleware', error)
        this.receiver.emit('error', error)
      }
    }
    await next()

    // update middleware set
    this._middlewareSet.delete(counter)

    // flush user & group data
    await meta.$user?._update()
    await meta.$group?._update()
  }
}
