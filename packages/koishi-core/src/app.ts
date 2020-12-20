import { simplify, defineProperty, Time, Observed, coerce, escapeRegExp, makeArray, noop } from 'koishi-utils'
import { Context, Middleware, NextFunction } from './context'
import { Bot, BotOptions, Server } from './server'
import { Channel, User } from './database'
import { Command } from './command'
import { Session } from './session'
import help from './plugins/help'
import shortcut from './plugins/shortcut'
import suggest from './plugins/suggest'
import validate from './plugins/validate'
import LruCache from 'lru-cache'
import * as http from 'http'
import type Koa from 'koa'

export interface DelayOptions {
  character?: number
  message?: number
  cancel?: number
  broadcast?: number
}

export interface AppOptions extends BotOptions {
  port?: number
  bots?: BotOptions[]
  prefix?: string | string[]
  nickname?: string | string[]
  maxListeners?: number
  prettyErrors?: boolean
  promptTimeout?: number
  processMessage?: (message: string) => string
  delay?: DelayOptions
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
  public app = this
  public options: AppOptions
  public status = AppStatus.closed
  public bots: Bot[] & Record<string, Bot> = [] as any

  _commands: Command[]
  _commandMap: Record<string, Command>
  _hooks: Record<keyof any, [Context, (...args: any[]) => any][]>
  _userCache: Record<string, LruCache<string, Observed<Partial<User>, Promise<void>>>>
  _groupCache: LruCache<string, Observed<Partial<Channel>, Promise<void>>>
  _httpServer?: http.Server

  private _nameRE: RegExp
  private _prefixRE: RegExp

  static defaultConfig: AppOptions = {
    maxListeners: 64,
    prettyErrors: true,
    promptTimeout: Time.minute,
    userCacheAge: Time.minute,
    groupCacheAge: 5 * Time.minute,
    similarityCoefficient: 0.4,
    processMessage: message => simplify(message.trim()),
    delay: {
      character: 0,
      cancel: 0,
      message: 0.1 * Time.second,
      broadcast: 0.5 * Time.second,
    },
  }

  constructor(options: AppOptions = {}) {
    super({ groups: [], users: [], private: true })
    if (!options.bots) options.bots = [options]
    options = this.options = {
      ...App.defaultConfig,
      ...options,
      delay: {
        ...App.defaultConfig.delay,
        ...options.delay,
      },
    }

    defineProperty(this, '_hooks', {})
    defineProperty(this, '_commands', [])
    defineProperty(this, '_commandMap', {})
    defineProperty(this, '_sessions', {})
    defineProperty(this, '_servers', {})
    defineProperty(this, '_userCache', {})
    defineProperty(this, '_groupCache', new LruCache({
      max: options.groupCacheLength,
      maxAge: options.groupCacheAge,
    }))

    if (options.port) this.createServer()
    for (const bot of options.bots) {
      let server = this.servers[bot.type]
      if (!server) {
        const constructor = Server.types[bot.type]
        if (!constructor) {
          throw new Error(`unsupported type "${bot.type}", you should import the adapter yourself`)
        }
        server = this.servers[bot.type] = Reflect.construct(constructor, [this])
      }
      server.create(bot)
    }

    this.prepare()

    // bind built-in event listeners
    this.middleware(this._preprocess.bind(this))
    this.on('message', this._receive.bind(this))
    this.on('parse', this._parse.bind(this))
    this.on('before-connect', this._listen.bind(this))
    this.on('before-disconnect', this._close.bind(this))

    this.plugin(validate)
    this.plugin(suggest)
    this.plugin(shortcut)
    this.plugin(help)
  }

  createServer() {
    const koa: Koa = new (require('koa'))()
    defineProperty(this, '_router', new (require('koa-router'))())
    koa.use(require('koa-bodyparser')())
    koa.use(this._router.routes())
    koa.use(this._router.allowedMethods())
    defineProperty(this, '_httpServer', http.createServer(koa.callback()))
  }

  prepare() {
    const { nickname, prefix } = this.options
    const nicknames = makeArray(nickname)
    const prefixes = Array.isArray(prefix) ? prefix : [prefix || '']
    this._nameRE = createLeadingRE(nicknames, '@?', '([,，]\\s*|\\s+)')
    this._prefixRE = createLeadingRE(prefixes)
  }

  async start() {
    this.status = AppStatus.opening
    await this.parallel('before-connect')
    this.status = AppStatus.open
    this.logger('app').debug('started')
    this.emit('connect')
  }

  private async _listen() {
    try {
      const { port } = this.app.options
      if (port) {
        this._httpServer.listen(port)
        this.logger('server').info('server listening at %c', port)
      }
      await Promise.all(Object.values(this.servers).map(server => server.listen()))
    } catch (error) {
      this._close()
      throw error
    }
  }

  async stop() {
    this.status = AppStatus.closing
    await this.parallel('before-disconnect')
    this.status = AppStatus.closed
    this.logger('app').debug('stopped')
    this.emit('disconnect')
  }

  private _close() {
    Object.values(this.servers).forEach(server => server.close())
    this.logger('server').debug('http server closing')
    this._httpServer.close()
  }

  private async _preprocess(session: Session, next: NextFunction) {
    let message = this.options.processMessage(session.content)

    let capture: RegExpMatchArray, atSelf = false
    // eslint-disable-next-line no-cond-assign
    if (capture = message.match(/^\[CQ:reply,id=(-?\d+)\]\s*/)) {
      session.$reply = await session.$bot.getMessage(session.channelId, capture[1]).catch(noop)
      message = message.slice(capture[0].length)
      if (session.$reply) {
        const prefix = `[CQ:at,qq=${session.$reply.sender.userId}]`
        message = message.slice(prefix.length).trimStart()
      }
    }

    // strip prefix
    const at = `[CQ:at,qq=${session.selfId}]`
    if (session.subType !== 'private' && message.startsWith(at)) {
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
      if (session.subType === 'group') {
        // attach group data
        const groupFields = new Set<Channel.Field>(['flag', 'assignee'])
        this.emit('before-attach-group', session, groupFields)
        const group = await session.$observeChannel(groupFields)

        // emit attach event
        if (await this.serial(session, 'attach-group', session)) return

        // ignore some group calls
        if (group.flag & Channel.Flag.ignore) return
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
        this.logger('middleware').warn(`${session.content}\n${stack}`)
      }
    }
    await next()

    // update session map
    delete this._sessions[session.$uuid]
    this.emit(session, 'middleware', session)

    // flush user & group data
    await session.$user?._update()
    await session.$channel?._update()
  }

  private _parse(message: string, session: Session, builtin: boolean, terminator = '') {
    // group message should have prefix or appel to be interpreted as a command call
    const { $reply, $prefix, $appel, subType } = session
    if (builtin && subType !== 'private' && $prefix === null && !$appel) return
    terminator = escapeRegExp(terminator)
    const name = message.split(new RegExp(`[\\s${terminator}]`), 1)[0]
    const index = name.lastIndexOf('/')
    const command = this.app._commandMap[name.slice(index + 1).toLowerCase()]
    if (!command) return
    message = message.slice(name.length).trim() + ($reply ? ' ' + $reply.content : '')
    const result = command.parse(message, terminator)
    return { command, ...result }
  }
}
