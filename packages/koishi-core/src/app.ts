import debug from 'debug'
import escapeRegex from 'escape-string-regexp'
import { Sender } from './sender'
import { Server, createServer, ServerType } from './server'
import { Command, ShortcutConfig, ParsedCommandLine } from './command'
import { Context, Middleware, NextFunction, ContextScope, Receiver } from './context'
import { Database, GroupFlag, UserFlag, UserField, createDatabase, DatabaseConfig } from './database'
import { updateActivity, showSuggestions } from './utils'
import { Meta, MessageMeta, ContextType } from './meta'
import { simplify, capitalize } from 'koishi-utils'
import * as errors from './errors'

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

export async function stopAll () {
  await Promise.all(appList.map(async app => app.stop()))
  for (const hook of onStopHooks) {
    hook(...appList)
  }
}

let getSelfIdsPromise: Promise<any>
export async function getSelfIds () {
  if (!getSelfIdsPromise) {
    getSelfIdsPromise = Promise.all(appList.map(async (app) => {
      if (app.selfId || !app.options.type) return
      const info = await app.sender.getLoginInfo()
      app.options.selfId = info.userId
      app._registerSelfId()
    }))
  }
  await getSelfIdsPromise
  return selfIds
}

export interface MajorContext extends Context {
  except (...ids: number[]): Context
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
  receiver: Receiver
  prefixRE: RegExp
  userPrefixRE: RegExp
  users: MajorContext
  groups: MajorContext
  discusses: MajorContext

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
    if (options.type) {
      this.server = createServer(this)
      this.sender = new Sender(this)
    }
    if (options.selfId) this._registerSelfId()
    this.receiver.on('message', this._applyMiddlewares)
    this.middleware(this._preprocess)
    this.users = this._createContext([[null, []], [[], null], [[], null]]) as MajorContext
    this.groups = this._createContext([[[], null], [null, []], [[], null]]) as MajorContext
    this.discusses = this._createContext([[[], null], [[], null], [null, []]]) as MajorContext
    this.users.except = (...ids) => this._createContext([[null, ids], [[], null], [[], null]])
    this.groups.except = (...ids) => this._createContext([[[], null], [null, ids], [[], null]])
    this.discusses.except = (...ids) => this._createContext([[[], null], [[], null], [null, ids]])
  }

  get selfId () {
    return this.options.selfId
  }

  get version () {
    return this.server?.version
  }

  _registerSelfId () {
    appMap[this.selfId] = this
    selfIds.push(this.selfId)
    if (this.options.type) this.server.appMap[this.selfId] = this
    const patterns: string[] = []
    if (this.app.options.name) {
      patterns.push(`@?${escapeRegex(this.app.options.name)}([,，]\\s*|\\s+)`)
    }
    if (this.app.options.commandPrefix) {
      patterns.push(escapeRegex(this.app.options.commandPrefix))
    }
    this.prefixRE = createPrefixRegExp(...patterns, `\\[CQ:at,qq=${this.selfId}\\] *`)
    this.userPrefixRE = createPrefixRegExp(...patterns)
  }

  _createContext (scope: string | ContextScope) {
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
    return this._createContext([[[], null], [[], null], [ids, null]])
  }

  group (...ids: number[]) {
    return this._createContext([[[], null], [ids, null], [[], null]])
  }

  user (...ids: number[]) {
    return this._createContext([[ids, null], [[], null], [[], null]])
  }

  async start () {
    const tasks: Promise<any>[] = []
    if (this.database) {
      for (const type in this.options.database) {
        tasks.push(this.database[type]?.start?.())
      }
    }
    if (this.options.type) {
      this.sender.start()
      tasks.push(this.server.listen())
    }
    await Promise.all(tasks)
    showLog('started')
  }

  async stop () {
    const tasks: Promise<any>[] = []
    if (this.database) {
      for (const type in this.options.database) {
        tasks.push(this.database[type]?.stop?.())
      }
    }
    await Promise.all(tasks)
    if (this.options.type) {
      this.server.close()
      this.sender.stop()
    }
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

    // polyfill CQHTTP 3.x events
    // https://cqhttp.cc/docs/4.12/#/UpgradeGuide
    /* eslint-disable dot-notation */
    if (typeof meta.anonymous === 'string') {
      meta.anonymous = {
        name: meta.anonymous,
        flag: meta['anonymousFlag'],
      }
      delete meta['anonymousFlag']
    // @ts-ignore
    } else if (meta.postType === 'event') {
      meta.postType = 'notice'
      meta.noticeType = meta['event']
      delete meta['event']
    } else if (meta.postType === 'request') {
      meta.comment = meta.message
      delete meta.message
    }
    /* eslint-enable dot-notation */

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
      }
      meta.$send = async (message) => {
        await this.sender[`send${capitalize(meta.messageType)}Msg`](subId, message)
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
        const isAssignee = meta.$group.assignee === this.selfId
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
    if (command?.context.match(meta)) {
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
