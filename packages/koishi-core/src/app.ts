import debug from 'debug'
import escapeRegex from 'escape-string-regexp'
import { Sender } from './sender'
import { Server, createServer, ServerType } from './server'
import { Command, ShortcutConfig, ParsedCommandLine } from './command'
import { Database, GroupFlag, UserFlag, UserField, createDatabase, DatabaseConfig } from './database'
import { updateActivity, showSuggestions } from './utils'
import { simplify } from 'koishi-utils'
import { EventEmitter } from 'events'
import { Meta, MessageMeta, ContextType } from './meta'
import * as errors from './errors'

import {
  Context,
  UserContext,
  GroupContext,
  DiscussContext,
  Middleware,
  NextFunction,
  Plugin,
  NoticeEvent,
  RequestEvent,
  MetaEventEvent,
  MessageEvent,
  ContextScope,
} from './context'

export interface AppOptions {
  port?: number
  name?: string
  token?: string
  secret?: string
  selfId?: number
  server?: string
  type?: ServerType
  commandPrefix?: string
  database?: DatabaseConfig
  similarityCoefficient?: number
}

const showLog = debug('koishi')
const showReceiverLog = debug('koishi:receiver')

const selfIds: number[] = []
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
  for (const hook of onStartHooks) {
    hook(...appList)
  }
}

export function stopAll () {
  appList.forEach(app => app.stop())
  for (const hook of onStopHooks) {
    hook(...appList)
  }
}

let getSelfIdsPromise: Promise<any>
export async function getSelfIds () {
  if (!getSelfIdsPromise) {
    getSelfIdsPromise = Promise.all(appList.map(async (app) => {
      if (app.selfId) return
      const info = await app.sender.getLoginInfo()
      app.options.selfId = info.userId
      app._registerSelfId()
    }))
  }
  await getSelfIdsPromise
  return selfIds
}

export type MajorContext <T extends Context> = T & {
  except (...ids: number[]): T
}

const appScope: ContextScope = [[null, []], [null, []], [null, []]]
const appIdentifier = ContextScope.stringify(appScope)

function createPrefixRegExp (...patterns: string[]) {
  return new RegExp(`^(${patterns.join('|')})`)
}

export class App extends Context {
  app = this
  server: Server
  database: Database
  receiver: AppReceiver
  prefixRE: RegExp
  userPrefixRE: RegExp
  users: MajorContext<UserContext>
  groups: MajorContext<GroupContext>
  discusses: MajorContext<DiscussContext>

  _commands: Command[] = []
  _commandMap: Record<string, Command> = {}
  _shortcuts: ShortcutConfig[] = []
  _shortcutMap: Record<string, Command> = {}
  _middlewares: [Context, Middleware][] = []

  private _middlewareCounter = 0
  private _middlewareSet = new Set<number>()
  private _contexts: Record<string, Context> = { [appIdentifier]: this }

  constructor (public options: AppOptions = {}) {
    super(appIdentifier, appScope)
    appList.push(this)
    if (options.database && Object.keys(options.database).length) {
      this.database = createDatabase(options.database)
    }
    if (options.selfId) this._registerSelfId()
    if (options.type) {
      this.server = createServer(this)
      this.sender = new Sender(this)
    }
    this.receiver.on('message', this._applyMiddlewares)
    this.middleware(this._preprocess)
    this.users = this._createContext([[null, []], [[], null], [[], null]])
    this.groups = this._createContext([[[], null], [null, []], [[], null]])
    this.discusses = this._createContext([[[], null], [[], null], [null, []]])
    this.users.except = (...ids) => this._createContext([[null, ids], [[], null], [[], null]])
    this.groups.except = (...ids) => this._createContext([[[], null], [null, ids], [[], null]])
    this.discusses.except = (...ids) => this._createContext([[[], null], [[], null], [null, ids]])
  }

  get selfId () {
    return this.options.selfId
  }

  get version () {
    return this.server && this.server.version
  }

  _registerSelfId () {
    appMap[this.options.selfId] = this
    selfIds.push(this.options.selfId)
    const patterns: string[] = []
    if (this.app.options.name) {
      patterns.push(`@?${escapeRegex(this.app.options.name)}([,，]\\s*|\\s+)`)
    }
    if (this.app.options.commandPrefix) {
      patterns.push(escapeRegex(this.app.options.commandPrefix))
    }
    this.prefixRE = createPrefixRegExp(...patterns, `\\[CQ:at,qq=${this.options.selfId}\\] *`)
    this.userPrefixRE = createPrefixRegExp(...patterns)
  }

  _createContext <T extends Context> (scope: string | ContextScope) {
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
    return this._contexts[identifier] as T
  }

  discuss (...ids: number[]) {
    return this._createContext<DiscussContext>([[[], null], [[], null], [ids, null]])
  }

  group (...ids: number[]) {
    return this._createContext<GroupContext>([[[], null], [ids, null], [[], null]])
  }

  user (...ids: number[]) {
    return this._createContext<UserContext>([[ids, null], [[], null], [[], null]])
  }

  async start () {
    this.sender.start()
    await this.server.listen()
    showLog('started')
  }

  stop () {
    this.server.close()
    this.sender.stop()
    showLog('stopped')
  }

  emitWarning (message: string) {
    this.receiver.emit('warning', new Error(message))
  }

  async dispatchMeta (meta: Meta, emitEvents = true) {
    // prepare prefix
    let type: ContextType, subId: number
    if (meta.groupId) {
      type = 'group'
      subId = meta.groupId
    } else if (meta.discussId) {
      type = 'discuss'
      subId = meta.discussId
    } else if (meta.userId) {
      type = 'user'
      subId = meta.userId
    }

    // prepare events
    const events: string[] = []
    if (meta.postType === 'message' || meta.postType === 'send') {
      events.push(meta.postType)
    } else if (meta.postType === 'request') {
      events.push('request')
    } else if (meta.groupId) {
      events.push(meta.noticeType)
    } else if (meta.userId) {
      events.push(meta.noticeType)
    } else {
      events.push('meta_event/' + meta.metaEventType, 'meta_event')
    }
    if (meta.subType) events.unshift(events[0] + '/' + meta.subType)

    // generate path
    const path = (type ? `/${type}/${subId}/` : '/') + events[0]
    Object.defineProperty(meta, '$path', { value: path })
    Object.defineProperty(meta, '$type', { value: type })
    Object.defineProperty(meta, '$subId', { value: subId })
    showReceiverLog('path %s', path)

    // add context properties
    if (meta.postType === 'message') {
      if (meta.messageType === 'group') {
        if (this.database) {
          Object.defineProperty(meta, '$group', {
            value: await this.database.getGroup(meta.groupId),
            writable: true,
          })
        }
        meta.$send = message => this.sender.sendGroupMsg(meta.groupId, message)
      } else if (meta.messageType === 'discuss') {
        meta.$send = message => this.sender.sendDiscussMsg(meta.discussId, message)
      } else {
        meta.$send = message => this.sender.sendPrivateMsg(meta.userId, message)
      }
    }

    // emit events
    if (!emitEvents) return
    for (const path in this._contexts) {
      const context = this._contexts[path]
      if (!context.match(meta)) continue
      showReceiverLog(path, 'emits', events)
      events.forEach((event) => {
        context.receiver.emit(event, meta)
      })
    }
  }

  private _preprocess = async (meta: MessageMeta, next: NextFunction) => {
    // strip prefix
    let message = meta.message.trim()
    let prefix = ''
    if (meta.messageType === 'group') {
      const capture = message.match(this.prefixRE)
      if (capture) {
        prefix = capture[0]
        message = message.slice(prefix.length)
      }
    } else {
      message = message.replace(this.userPrefixRE, '')
    }

    message = simplify(message)
    const fields: UserField[] = []
    let parsedArgv: ParsedCommandLine
    const canBeCommand = meta.messageType === 'private' || prefix
    const canBeShortcut = prefix !== '.'
    // parse as command
    if (canBeCommand && (parsedArgv = this.parseCommandLine(message, meta))) {
      fields.push(...parsedArgv.command._userFields)
    } else if (canBeShortcut) {
      // parse as shortcut
      for (const shortcut of this._shortcuts) {
        const { name, fuzzy, command, oneArg } = shortcut
        if (shortcut.prefix && !canBeCommand) continue
        if (!fuzzy && message !== name) continue
        if (message.startsWith(name)) {
          let _message = message.slice(name.length)
          if (fuzzy && !shortcut.prefix && _message.match(/^\S/)) continue
          if (oneArg) _message = `'${_message.trim()}'`
          const result = command.parse(_message)
          Object.assign(result.options, shortcut.options)
          fields.push(...command._userFields)
          parsedArgv = { meta, command, ...result }
          break
        }
      }
    }

    // generate fields
    if (!fields.includes('name')) fields.push('name')
    if (!fields.includes('flag')) fields.push('flag')
    if (!fields.includes('ignoreEnd')) fields.push('ignoreEnd')
    if (parsedArgv) {
      if (!fields.includes('usage')) fields.push('usage')
      if (!fields.includes('authority')) fields.push('authority')
    } else if (meta.messageType === 'group' && !fields.includes('talkativeness')) {
      fields.push('talkativeness')
    }

    if (this.database) {
      // attach user data
      const user = await this.app.database.observeUser(meta.userId, 0, fields)
      Object.defineProperty(meta, '$user', {
        value: user,
        writable: true,
      })

      // update talkativeness
      // ignore some group calls
      if (meta.messageType === 'group') {
        const isAssignee = meta.$group.assignee === this.options.selfId
        if (isAssignee && !parsedArgv) updateActivity(user.talkativeness, meta.groupId)
        const noCommand = meta.$group.flag & GroupFlag.noCommand
        const noResponse = meta.$group.flag & GroupFlag.noResponse || !isAssignee
        const originalNext = next
        next = (fallback?: NextFunction) => noResponse as never || originalNext(fallback)
        if (noCommand && parsedArgv) return
        if (noResponse && !prefix.includes(`[CQ:at,qq=${this.app.options.selfId}]`)) return
      }

      // ignore some user calls
      if (user.flag & UserFlag.ignore) return
      if (user.ignoreEnd) {
        const time = Date.now() / 1000
        if (user.ignoreEnd >= time) return
        user.ignoreEnd = 0
      }
    }

    // execute command
    if (parsedArgv) return parsedArgv.command.execute(parsedArgv, next)

    // show suggestions
    const target = message.split(/\s/, 1)[0].toLowerCase()
    if (!target || !canBeCommand) return next()

    return showSuggestions({
      target,
      meta,
      next,
      prefix: '没有此命令。',
      suffix: '发送空行以调用推测的指令。',
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
    if (command && command.context.match(meta)) {
      const result = command.parse(message.slice(name.length).trimStart())
      return { meta, command, ...result }
    }
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
        return this.emitWarning(errors.ISOLATED_NEXT)
      }
      if (fallback) middlewares.push((_, next) => fallback(next))
      const middleware = middlewares[index++]
      if (middleware) return middleware(meta, next)
    }
    await next()

    // update middleware set
    this._middlewareSet.delete(counter)

    // flush user data
    if (meta.$user) await meta.$user._update()
  }
}

export interface AppReceiver extends EventEmitter {
  on (event: NoticeEvent, listener: (meta: Meta<'notice'>) => any): this
  on (event: MessageEvent, listener: (meta: Meta<'message'>) => any): this
  on (event: RequestEvent, listener: (meta: Meta<'request'>) => any): this
  on (event: MetaEventEvent, listener: (meta: Meta<'meta_event'>) => any): this
  on (event: 'send', listener: (meta: Meta<'send'>) => any): this
  on (event: 'plugin', listener: (plugin: Plugin) => any): this
  on (event: 'warning', listener: (error: Error) => any): this
  on (event: 'connected', listener: (app: App) => any): this
  once (event: NoticeEvent, listener: (meta: Meta<'notice'>) => any): this
  once (event: MessageEvent, listener: (meta: Meta<'message'>) => any): this
  once (event: RequestEvent, listener: (meta: Meta<'request'>) => any): this
  once (event: MetaEventEvent, listener: (meta: Meta<'meta_event'>) => any): this
  once (event: 'send', listener: (meta: Meta<'send'>) => any): this
  once (event: 'plugin', listener: (plugin: Plugin) => any): this
  once (event: 'warning', listener: (error: Error) => any): this
  once (event: 'connected', listener: (app: App) => any): this
}
