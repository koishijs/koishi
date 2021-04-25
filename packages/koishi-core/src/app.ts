import { simplify, defineProperty, Time, Observed, coerce, escapeRegExp, makeArray, template, trimSlash, merge } from 'koishi-utils'
import { Context, Middleware, NextFunction, Plugin } from './context'
import { Argv } from './parser'
import { BotOptions, Adapter, createBots } from './adapter'
import { Channel, User } from './database'
import validate, { Command } from './command'
import { Session } from './session'
import help, { getCommandNames } from './help'
import LruCache from 'lru-cache'
import { AxiosRequestConfig } from 'axios'
import { Server, createServer } from 'http'
import type Koa from 'koa'

export interface DelayOptions {
  character?: number
  message?: number
  cancel?: number
  broadcast?: number
  prompt?: number
}

export interface AppOptions extends BotOptions {
  port?: number
  bots?: BotOptions[]
  prefix?: string | string[]
  nickname?: string | string[]
  maxListeners?: number
  prettyErrors?: boolean
  processMessage?: (message: string) => string
  delay?: DelayOptions
  autoAssign?: boolean | ((session: Session) => boolean)
  autoAuthorize?: number | ((session: Session) => number)
  userCacheAge?: number
  userCacheLength?: number
  channelCacheLength?: number
  channelCacheAge?: number
  minSimilarity?: number
  selfUrl?: string
  axiosConfig?: AxiosRequestConfig
}

function createLeadingRE(patterns: string[], prefix = '', suffix = '') {
  return patterns.length ? new RegExp(`^${prefix}(${patterns.map(escapeRegExp).join('|')})${suffix}`) : /$^/
}

interface CommandMap extends Map<string, Command> {
  resolve(key: string): Command
}

export class App extends Context {
  public app = this
  public options: AppOptions
  public status = App.Status.closed
  public adapters: Adapter.Instances = {}
  public registry = new Map<Plugin, Plugin.State>()

  _bots = createBots('sid')
  _commandList: Command[] = []
  _commands: CommandMap = new Map<string, Command>() as never
  _shortcuts: Command.Shortcut[] = []
  _hooks: Record<keyof any, [Context, (...args: any[]) => any][]> = {}
  _userCache: Record<string, LruCache<string, Observed<Partial<User>, Promise<void>>>>
  _channelCache: LruCache<string, Observed<Partial<Channel>, Promise<void>>>
  _httpServer?: Server
  _sessions: Record<string, Session> = {}

  private _nameRE: RegExp
  private _prefixRE: RegExp

  static defaultConfig: AppOptions = {
    maxListeners: 64,
    prettyErrors: true,
    userCacheAge: Time.minute,
    channelCacheAge: 5 * Time.minute,
    autoAssign: true,
    autoAuthorize: 1,
    minSimilarity: 0.4,
    processMessage: message => simplify(message.trim()),
    delay: {
      character: 0,
      cancel: 0,
      message: 0.1 * Time.second,
      broadcast: 0.5 * Time.second,
      prompt: Time.minute,
    },
  }

  constructor(options: AppOptions = {}) {
    super(() => true)
    if (!options.bots) options.bots = [options]
    if (options.selfUrl) options.selfUrl = trimSlash(options.selfUrl)
    this.options = merge(options, App.defaultConfig)
    this.registry.set(null, {
      children: [],
      disposables: [],
    })

    defineProperty(this, '_userCache', {})
    defineProperty(this, '_channelCache', new LruCache({
      max: options.channelCacheLength,
      maxAge: options.channelCacheAge,
    }))

    if (options.port) this.createServer()
    for (const bot of options.bots) {
      Adapter.from(this, bot).create(bot)
    }

    this._commands.resolve = (key) => {
      if (!key) return
      const segments = key.split('.')
      let i = 1, name = segments[0], cmd: Command
      while ((cmd = this._commands.get(name)) && i < segments.length) {
        name = cmd.name + '.' + segments[i++]
      }
      return cmd
    }

    this.prepare()

    // bind built-in event listeners
    this.middleware(this._process.bind(this))
    this.middleware(this._suggest.bind(this))
    this.on('message', this._handleMessage.bind(this))
    this.before('parse', this._handleArgv.bind(this))
    this.before('parse', this._handleShortcut.bind(this))
    this.before('connect', this._listen.bind(this))
    this.before('disconnect', this._close.bind(this))

    this.on('parse', (argv: Argv, session: Session) => {
      const { parsed, subtype } = session
      // group message should have prefix or appel to be interpreted as a command call
      if (argv.root && subtype !== 'private' && parsed.prefix === null && !parsed.appel) return
      if (!argv.tokens.length) return
      const cmd = this._commands.resolve(argv.tokens[0].content)
      if (cmd) {
        argv.tokens.shift()
        return cmd.name
      }
    })

    this.before('attach-user', (session, fields) => {
      session.collect('user', session.argv, fields)
    })

    this.before('attach-channel', (session, fields) => {
      session.collect('channel', session.argv, fields)
    })

    this.plugin(validate)
    this.plugin(help)
  }

  createServer() {
    const koa: Koa = new (require('koa'))()
    this.router = new (require('@koa/router'))()
    koa.use(require('koa-bodyparser')())
    koa.use(this.router.routes())
    koa.use(this.router.allowedMethods())
    defineProperty(this, '_httpServer', createServer(koa.callback()))
  }

  prepare() {
    const { nickname, prefix } = this.options
    this.options.nickname = makeArray(nickname)
    this.options.prefix = Array.isArray(prefix) ? prefix : [prefix || '']
    this._nameRE = createLeadingRE(this.options.nickname, '@?', '([,，]\\s*|\\s+)')
    this._prefixRE = createLeadingRE(this.options.prefix)
  }

  async start() {
    this.status = App.Status.opening
    await this.parallel('before-connect')
    this.status = App.Status.open
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
      await Promise.all(Object.values(this.adapters).map(adapter => adapter.start()))
    } catch (error) {
      this._close()
      throw error
    }
  }

  async stop() {
    this.status = App.Status.closing
    // `before-disconnect` event is handled by ctx.disposables
    await Promise.all(this.state.disposables.map(dispose => dispose()))
    this.status = App.Status.closed
    this.logger('app').debug('stopped')
    this.emit('disconnect')
  }

  private _close() {
    Object.values(this.adapters).forEach(adapter => adapter.stop?.())
    this.logger('server').debug('http server closing')
    this._httpServer?.close()
  }

  private async _process(session: Session, next: NextFunction) {
    let capture: RegExpMatchArray
    let atSelf = false, appel = false, prefix: string = null
    const pattern = /^\[CQ:(\w+)((,\w+=[^,\]]*)*)\]/
    let content = await session.preprocess()

    // strip prefix
    if (session.subtype !== 'private' && (capture = content.match(pattern)) && capture[1] === 'at' && capture[2].includes('id=' + session.selfId)) {
      atSelf = appel = true
      content = content.slice(capture[0].length).trimStart()
      // eslint-disable-next-line no-cond-assign
    } else if (capture = content.match(this._nameRE)) {
      appel = true
      content = content.slice(capture[0].length)
    }

    // eslint-disable-next-line no-cond-assign
    if (capture = content.match(this._prefixRE)) {
      prefix = capture[0]
      content = content.slice(capture[0].length)
    }

    // store parsed message
    defineProperty(session, 'parsed', { content, appel, prefix })
    this.emit(session, 'before-attach', session)

    defineProperty(session, 'argv', this.bail('before-parse', content, session))
    session.argv.root = true
    session.argv.session = session

    if (this.database) {
      if (session.subtype === 'group') {
        // attach group data
        const channelFields = new Set<Channel.Field>(['flag', 'assignee'])
        this.emit('before-attach-channel', session, channelFields)
        const channel = await session.observeChannel(channelFields)

        // emit attach event
        if (await this.serial(session, 'attach-channel', session)) return

        // ignore some group calls
        if (channel.flag & Channel.Flag.ignore) return
        if (channel.assignee !== session.selfId && !atSelf) return
      }

      // attach user data
      // authority is for suggestion
      const userFields = new Set<User.Field>(['flag', 'authority'])
      this.emit('before-attach-user', session, userFields)
      const user = await session.observeUser(userFields)

      // emit attach event
      if (await this.serial(session, 'attach-user', session)) return

      // ignore some user calls
      if (user.flag & User.Flag.ignore) return
    }

    // execute command
    this.emit(session, 'attach', session)
    if (!session.resolve(session.argv)) return next()
    return session.execute(session.argv, next)
  }

  private _suggest(session: Session, next: NextFunction) {
    // use `!prefix` instead of `prefix === null` to prevent from blocking other middlewares
    // we need to make sure that the user truly has the intension to call a command
    const { argv, quote, subtype, parsed: { content, prefix, appel } } = session
    if (argv.command || subtype !== 'private' && !prefix && !appel) return next()
    const target = content.split(/\s/, 1)[0].toLowerCase()
    if (!target) return next()

    return session.suggest({
      target,
      next,
      items: getCommandNames(session),
      prefix: template('internal.command-suggestion-prefix'),
      suffix: template('internal.command-suggestion-suffix'),
      async apply(suggestion, next) {
        const newMessage = suggestion + content.slice(target.length) + (quote ? ' ' + quote.content : '')
        return this.execute(newMessage, next)
      },
    })
  }

  private async _handleMessage(session: Session) {
    // preparation
    this._sessions[session.id] = session
    const middlewares: Middleware[] = this._hooks[Context.middleware as any]
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
        if (!this._sessions[session.id]) {
          throw new Error('isolated next function detected')
        }
        if (fallback) middlewares.push((_, next) => fallback(next))
        return await middlewares[index++]?.(session, next)
      } catch (error) {
        let stack = coerce(error)
        if (prettyErrors) {
          const index = stack.indexOf(lastCall)
          if (index >= 0) stack = stack.slice(0, index)
          stack += `Middleware stack:${midStack}`
        }
        this.logger('session').warn(`${session.content}\n${stack}`)
      }
    }
    await next()

    // update session map
    delete this._sessions[session.id]
    this.emit(session, 'middleware', session)

    // flush user & group data
    await session.user?._update()
    await session.channel?._update()
  }

  private _handleArgv(content: string, session: Session) {
    const argv = Argv.parse(content)
    if (session.quote) {
      argv.tokens.push({
        content: session.quote.content,
        quoted: true,
        inters: [],
        terminator: '',
      })
    }
    return argv
  }

  private _handleShortcut(content: string, session: Session) {
    const { parsed, quote } = session
    if (parsed.prefix || quote) return
    for (const shortcut of this._shortcuts) {
      const { name, fuzzy, command, greedy, prefix, options = {}, args = [] } = shortcut
      if (prefix && !parsed.appel || !command.context.match(session)) continue
      if (typeof name === 'string') {
        if (!fuzzy && content !== name || !content.startsWith(name)) continue
        const message = content.slice(name.length)
        if (fuzzy && !parsed.appel && message.match(/^\S/)) continue
        const argv: Argv = greedy
          ? { options: {}, args: [message.trim()] }
          : command.parse(Argv.parse(message.trim()))
        argv.command = command
        argv.options = { ...options, ...argv.options }
        argv.args = [...args, ...argv.args]
        return argv
      } else {
        const capture = name.exec(content)
        if (!capture) continue
        function escape(source: any) {
          if (typeof source !== 'string') return source
          source = source.replace(/\$\$/g, '@@__PLACEHOLDER__@@')
          capture.map((segment, index) => {
            if (!index || index > 9) return
            source = source.replace(new RegExp(`\\$${index}`, 'g'), (segment || '').replace(/\$/g, '@@__PLACEHOLDER__@@'))
          })
          return source.replace(/@@__PLACEHOLDER__@@/g, '$')
        }
        return {
          command,
          args: args.map(escape),
          options: Object.fromEntries(Object.entries(options).map(([k, v]) => [k, escape(v)])),
        }
      }
    }
  }
}

export namespace App {
  export enum Status { closed, opening, open, closing }
}
