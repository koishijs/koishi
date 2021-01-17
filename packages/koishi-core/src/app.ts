import { simplify, defineProperty, Time, Observed, coerce, escapeRegExp, makeArray, noop } from 'koishi-utils'
import { Command } from './command'
import { Context, Middleware, NextFunction } from './context'
import { Group, User, Database } from './database'
import { BotOptions, Server } from './server'
import { Session } from './session'
import help from './plugins/help'
import shortcut from './plugins/shortcut'
import suggest from './plugins/suggest'
import validate from './plugins/validate'
import LruCache from 'lru-cache'

export interface AppOptions extends BotOptions {
  port?: number
  type?: string
  bots?: BotOptions[]
  prefix?: string | string[]
  nickname?: string | string[]
  maxListeners?: number
  prettyErrors?: boolean
  promptTimeout?: number
  processMessage?: (message: string) => string
  queueDelay?: number | ((message: string, session: Session) => number)
  broadcastDelay?: number
  defaultAuthority?: number | ((session: Session) => number)
  similarityCoefficient?: number
  userCacheLength?: number
  groupCacheLength?: number
  userCacheAge?: number
  groupCacheAge?: number
}

function createLeadingRE(patterns: string[], prefix = '', suffix = '') {
  return patterns.length ? new RegExp(`^${prefix}(${patterns.map(escapeRegExp).join('|')})${suffix}`) : /$^/
}

export enum AppStatus { closed, opening, open, closing }

export class App extends Context {
  app = this
  options: AppOptions
  server: Server
  status = AppStatus.closed

  _database: Database
  _commands: Command[]
  _sessions: Record<string, Session> = {}
  _commandMap: Record<string, Command>
  _hooks: Record<keyof any, [Context, (...args: any[]) => any][]>
  _userCache: LruCache<number, Observed<Partial<User>, Promise<void>>>
  _groupCache: LruCache<number, Observed<Partial<Group>, Promise<void>>>

  private _nameRE: RegExp
  private _prefixRE: RegExp
  private _getSelfIdsPromise: Promise<any>

  static defaultConfig: AppOptions = {
    maxListeners: 64,
    prettyErrors: true,
    queueDelay: 0.1 * Time.second,
    broadcastDelay: 0.5 * Time.second,
    promptTimeout: Time.minute,
    userCacheAge: Time.minute,
    groupCacheAge: 5 * Time.minute,
    similarityCoefficient: 0.4,
    processMessage: message => simplify(message.trim()),
  }

  constructor(options: AppOptions = {}) {
    super({ groups: [], users: [], private: true })
    options = this.options = { ...App.defaultConfig, ...options }
    if (!options.bots) options.bots = [options]

    defineProperty(this, '_hooks', {})
    defineProperty(this, '_commands', [])
    defineProperty(this, '_commandMap', {})
    defineProperty(this, '_userCache', new LruCache({
      max: options.userCacheLength,
      maxAge: options.userCacheAge,
    }))
    defineProperty(this, '_groupCache', new LruCache({
      max: options.groupCacheLength,
      maxAge: options.groupCacheAge,
    }))

    const { type } = this.options
    const server = Server.types[type]
    if (!server) {
      throw new Error(`unsupported type "${type}", you should import the adapter yourself`)
    }
    this.server = Reflect.construct(server, [this])

    this.prepare()

    // bind built-in event listeners
    this.middleware(this._preprocess.bind(this))
    this.on('message', this._receive.bind(this))
    this.on('parse', this._parse.bind(this))

    this.plugin(validate)
    this.plugin(suggest)
    this.plugin(shortcut)
    this.plugin(help)
  }

  prepare() {
    const { nickname, prefix } = this.options
    this.options.nickname = makeArray(nickname)
    this.options.prefix = Array.isArray(prefix) ? prefix : [prefix || '']
    this._nameRE = createLeadingRE(this.options.nickname, '@?', '([,，]\\s*|\\s+)')
    this._prefixRE = createLeadingRE(this.options.prefix)
  }

  async getSelfIds() {
    const bots = this.server.bots.filter(bot => bot.ready)
    if (!this._getSelfIdsPromise) {
      this._getSelfIdsPromise = Promise.all(bots.map(async (bot) => {
        if (bot.selfId || !bot.ready) return
        bot.selfId = await bot.getSelfId()
      }))
    }
    await this._getSelfIdsPromise
    return bots.map(bot => bot.selfId)
  }

  async start() {
    this.status = AppStatus.opening
    await this.parallel('before-connect')
    this.status = AppStatus.open
    this.logger('app').debug('started')
    this.emit('connect')
  }

  async stop() {
    this.status = AppStatus.closing
    await this.parallel('before-disconnect')
    this.status = AppStatus.closed
    this.logger('app').debug('stopped')
    this.emit('disconnect')
  }

  private async _preprocess(session: Session, next: NextFunction) {
    let message = this.options.processMessage(session.message)

    let capture: RegExpMatchArray, atSelf = false
    // eslint-disable-next-line no-cond-assign
    if (capture = message.match(/^\[CQ:reply,id=(-?\d+)\]\s*/)) {
      session.$reply = await session.$bot.getMsg(+capture[1]).catch(noop)
      message = message.slice(capture[0].length)
      if (session.$reply) {
        const prefix = `[CQ:at,qq=${session.$reply.sender.userId}]`
        message = message.slice(prefix.length).trimStart()
      }
    }

    // strip prefix
    const at = `[CQ:at,qq=${session.selfId}]`
    if (session.messageType !== 'private' && message.startsWith(at)) {
      atSelf = session.$appel = true
      message = message.slice(at.length).trimStart()
      // eslint-disable-next-line no-cond-assign
    } else if (capture = message.match(this._nameRE)) {
      session.$appel = true
      message = message.slice(capture[0].length)
      // eslint-disable-next-line no-cond-assign
    } else if (capture = message.match(this._prefixRE)) {
      session.$prefix = capture[0]
      message = message.slice(capture[0].length)
    }

    // store parsed message
    session.$parsed = message
    session.$argv = session.$parse(message, '', true)

    if (this.database) {
      if (session.messageType === 'group') {
        // attach group data
        const groupFields = new Set<Group.Field>(['flag', 'assignee'])
        this.emit('before-attach-group', session, groupFields)
        const group = await session.$observeGroup(groupFields)

        // emit attach event
        if (await this.serial(session, 'attach-group', session)) return

        // ignore some group calls
        if (group.flag & Group.Flag.ignore) return
        if (group.assignee !== session.selfId && !atSelf) return
      }

      // attach user data
      const userFields = new Set<User.Field>(['flag'])
      this.emit('before-attach-user', session, userFields)
      const user = await session.$observeUser(userFields)

      // emit attach event
      if (await this.serial(session, 'attach-user', session)) return

      // ignore some user calls
      if (user.flag & User.Flag.ignore) return
    }

    await this.parallel(session, 'attach', session)

    // execute command
    if (!session.$argv) return next()
    session.$argv.next = next
    return session.$argv.command.execute(session.$argv)
  }

  private async _receive(session: Session) {
    // preparation
    this._sessions[session.$uuid] = session
    const middlewares: Middleware[] = this._hooks[Context.MIDDLEWARE_EVENT as any]
      .filter(([context]) => context.match(session))
      .map(([, middleware]) => middleware)

    // execute middlewares
    let index = 0, midStack = '', lastCall = ''
    const { prettyErrors } = this.options
    const next = async (fallback?: NextFunction) => {
      if (prettyErrors) {
        lastCall = new Error().stack.split('\n', 3)[2]
        if (index) {
          const capture = lastCall.match(/\((.+)\)/)
          midStack = `\n  - ${capture ? capture[1] : lastCall.slice(7)}${midStack}`
        }
      }

      try {
        if (!this._sessions[session.$uuid]) {
          throw new Error('isolated next function detected')
        }
        if (fallback) middlewares.push((_, next) => fallback(next))
        return middlewares[index++]?.(session, next)
      } catch (error) {
        let stack = coerce(error)
        if (prettyErrors) {
          const index = stack.indexOf(lastCall)
          stack = `${stack.slice(0, index)}Middleware stack:${midStack}`
        }
        this.logger('middleware').warn(`${session.message}\n${stack}`)
      }
    }
    await next()

    // update session map
    delete this._sessions[session.$uuid]
    this.emit(session, 'middleware', session)

    // flush user & group data
    await session.$user?._update()
    await session.$group?._update()
  }

  private _parse(message: string, session: Session, builtin: boolean, terminator = '') {
    // group message should have prefix or appel to be interpreted as a command call
    const { $reply, $prefix, $appel, messageType } = session
    if (builtin && messageType !== 'private' && $prefix === null && !$appel) return
    terminator = escapeRegExp(terminator)
    const name = message.split(new RegExp(`[\\s${terminator}]`), 1)[0]
    const index = name.lastIndexOf('/')
    const command = this.app._commandMap[name.slice(index + 1).toLowerCase()]
    if (!command) return
    message = message.slice(name.length).trim() + ($reply ? ' ' + $reply.message : '')
    const result = command.parse(message, terminator)
    return { command, ...result }
  }
}
