import { Awaitable, defineProperty, Time } from 'cosmokit'
import { Bot, Fragment, h, Schema, Universal } from '@satorijs/core'
import { Command } from './command'
import { Argv } from './parser'
import validate from './validate'
import { Channel, User } from '../database'
import { Computed } from '../filter'
import { Context } from '../context'
import { Session } from '../session'

export * from './command'
export * from './parser'
export * from './validate'

declare module '../context' {
  interface Context {
    $commander: Commander
    command<D extends string>(def: D, config?: Command.Config): Command<never, never, Argv.ArgumentType<D>>
    command<D extends string>(def: D, desc: string, config?: Command.Config): Command<never, never, Argv.ArgumentType<D>>
  }

  interface Events {
    'before-parse'(content: string, session: Session): Argv
    'command-added'(command: Command): void
    'command-updated'(command: Command): void
    'command-removed'(command: Command): void
    'command-error'(argv: Argv, error: any): void
    'command/before-execute'(argv: Argv): Awaitable<void | Fragment>
    'command/before-attach-channel'(argv: Argv, fields: Set<Channel.Field>): void
    'command/before-attach-user'(argv: Argv, fields: Set<User.Field>): void
  }
}

// https://github.com/microsoft/TypeScript/issues/17002
// it never got fixed so we have to do this
const isArray = Array.isArray as (arg: any) => arg is readonly any[]

const BRACKET_REGEXP = /<[^>]+>|\[[^\]]+\]/g

interface DeclarationList extends Array<Argv.Declaration> {
  stripped: string
}

export namespace Commander {
  export interface Config {
    prefix?: Computed<string | string[]>
    prefixMode?: 'auto' | 'strict'
  }
}

export class Commander {
  _commandList: Command[] = []

  constructor(private ctx: Context, private config: Commander.Config = {}) {
    defineProperty(this, Context.current, ctx)
    ctx.plugin(validate)

    ctx.before('parse', (content, session) => {
      // we need to make sure that the user truly has the intension to call a command
      const { isDirect, stripped: { prefix, appel } } = session
      if (!isDirect && typeof prefix !== 'string' && !appel) return
      return Argv.parse(content)
    })

    ctx.on('interaction/command', (session) => {
      if (session.event?.argv) {
        const { name, options, arguments: args } = session.event.argv
        session.execute({ name, args, options })
      } else {
        session.stripped.hasAt = true
        session.stripped.appel = true
        session.stripped.atSelf = true
        session.stripped.prefix = ''
        defineProperty(session, 'argv', ctx.bail('before-parse', session.content, session))
        if (!session.argv) {
          ctx.logger('command').warn('failed to parse interaction command:', session.content)
          return
        }
        session.argv.root = true
        session.argv.session = session
        session.execute(session.argv)
      }
    })

    ctx.before('attach', (session) => {
      const { hasAt, appel } = session.stripped
      if (!appel && hasAt) return

      // strip prefix
      let content = session.stripped.content
      for (const prefix of this._resolvePrefixes(session)) {
        if (!content.startsWith(prefix)) continue
        session.stripped.prefix = prefix
        content = content.slice(prefix.length)
        break
      }
      defineProperty(session, 'argv', ctx.bail('before-parse', content, session))
      if (!session.argv) return
      session.argv.root = true
      session.argv.session = session
    })

    ctx.middleware((session, next) => {
      // execute command
      if (!this.resolveCommand(session.argv)) return next()
      return session.execute(session.argv, next)
    })

    ctx.middleware((session, next) => {
      // use `!prefix` instead of `prefix === null` to prevent from blocking other middlewares
      // we need to make sure that the user truly has the intension to call a command
      const { argv, quote, isDirect, stripped: { prefix, appel } } = session
      if (argv?.command || !isDirect && !prefix && !appel) return next()
      const content = session.stripped.content.slice((prefix ?? '').length)
      const actual = content.split(/\s/, 1)[0].toLowerCase()
      if (!actual) return next()

      return next(async (next) => {
        const cache = new Map<string, Promise<boolean>>()
        const name = await session.suggest({
          actual,
          expect: this.available(session),
          suffix: session.text('internal.suggest-command'),
          filter: (name) => {
            const command = this.resolve(name, session)
            if (!command) return false
            return ctx.permissions.test(`command:${command.name}`, session, cache)
          },
        })
        if (!name) return next()
        const message = name + content.slice(actual.length) + (quote?.content ? ' ' + quote.content : '')
        return session.execute(message, next)
      })
    })

    ctx.schema.extend('command', Command.Config, 1000)
    ctx.schema.extend('command-option', Schema.object({
      permissions: Schema.array(String).role('perms').default(['authority:0']).description('权限继承。'),
      dependencies: Schema.array(String).role('perms').description('权限依赖。'),
    }), 1000)

    ctx.on('ready', () => {
      const bots = ctx.bots.filter(v => v.status === Universal.Status.ONLINE && v.updateCommands)
      bots.forEach(bot => this.updateCommands(bot))
    })

    ctx.on('bot-status-updated', async (bot) => {
      if (bot.status !== Universal.Status.ONLINE || !bot.updateCommands) return
      this.updateCommands(bot)
    })

    this.domain('el', source => h.parse(source), { greedy: true })
    this.domain('elements', source => h.parse(source), { greedy: true })
    this.domain('string', source => h.unescape(source))
    this.domain('text', source => h.unescape(source), { greedy: true })
    this.domain('rawtext', source => h('', h.parse(source)).toString(true), { greedy: true })
    this.domain('boolean', () => true)

    this.domain('number', (source, session) => {
      // support `,` and `_` as delimiters
      // https://github.com/koishijs/koishi/issues/1386
      const value = +source.replace(/[,_]/g, '')
      if (Number.isFinite(value)) return value
      throw new Error('internal.invalid-number')
    }, { numeric: true })

    this.domain('integer', (source, session) => {
      const value = +source.replace(/[,_]/g, '')
      if (value * 0 === 0 && Math.floor(value) === value) return value
      throw new Error('internal.invalid-integer')
    }, { numeric: true })

    this.domain('posint', (source, session) => {
      const value = +source.replace(/[,_]/g, '')
      if (value * 0 === 0 && Math.floor(value) === value && value > 0) return value
      throw new Error('internal.invalid-posint')
    }, { numeric: true })

    this.domain('natural', (source, session) => {
      const value = +source.replace(/[,_]/g, '')
      if (value * 0 === 0 && Math.floor(value) === value && value >= 0) return value
      throw new Error('internal.invalid-natural')
    }, { numeric: true })

    this.domain('bigint', (source, session) => {
      try {
        return BigInt(source.replace(/[,_]/g, ''))
      } catch {
        throw new Error('internal.invalid-integer')
      }
    }, { numeric: true })

    this.domain('date', (source, session) => {
      const timestamp = Time.parseDate(source)
      if (+timestamp) return timestamp
      throw new Error('internal.invalid-date')
    })

    this.domain('user', (source, session) => {
      if (source.startsWith('@')) {
        source = source.slice(1)
        if (source.includes(':')) return source
        return `${session.platform}:${source}`
      }
      const code = h.from(source)
      if (code && code.type === 'at') {
        return `${session.platform}:${code.attrs.id}`
      }
      throw new Error('internal.invalid-user')
    })

    this.domain('channel', (source, session) => {
      if (source.startsWith('#')) {
        source = source.slice(1)
        if (source.includes(':')) return source
        return `${session.platform}:${source}`
      }
      const code = h.from(source)
      if (code && code.type === 'sharp') {
        return `${session.platform}:${code.attrs.id}`
      }
      throw new Error('internal.invalid-channel')
    })

    this.defineElementDomain('image', 'image', 'img')
    this.defineElementDomain('img', 'image', 'img')
    this.defineElementDomain('audio')
    this.defineElementDomain('video')
    this.defineElementDomain('file')
  }

  private defineElementDomain(name: keyof Argv.Domain, key = name, type = name) {
    this.domain(name, (source, session) => {
      const code = h.from(source, { type })
      if (code && code.type === type) {
        return code.attrs
      }
      throw new Error(`internal.invalid-${key}`)
    })
  }

  get(name: string, session?: Session) {
    return this._commandList.find((cmd) => {
      if (!Object.hasOwn(cmd._aliases, name)) return false
      const alias = cmd._aliases[name]
      return session?.resolve(alias.filter) ?? true
    })
  }

  updateCommands(bot: Bot) {
    return bot.updateCommands(this._commandList
      .filter(cmd => !cmd.name.includes('.') && cmd.config.slash)
      .map(cmd => cmd.toJSON()))
  }

  private _resolvePrefixes(session: Session) {
    const value = session.resolve(this.config.prefix)
    const result = Array.isArray(value) ? value : [value || '']
    return result.map(source => h.escape(source)).sort().reverse()
  }

  available(session: Session) {
    return this._commandList
      .filter(cmd => cmd.match(session))
      .flatMap(cmd => Object.keys(cmd._aliases))
  }

  resolve(key: string, session?: Session) {
    return this._resolve(key, session).command
  }

  _resolve(key: string, session?: Session) {
    if (!key) return {}
    const segments = Command.normalize(key).split('.')
    let i = 1, name = segments[0], command: Command
    while ((command = this.get(name, session)) && i < segments.length) {
      name = command.name + '.' + segments[i++]
    }
    return { command, name }
  }

  inferCommand(argv: Argv) {
    if (!argv) return
    if (argv.command) return argv.command
    if (argv.name) return argv.command = this.resolve(argv.name, argv.session)

    const { stripped, isDirect, quote } = argv.session
    // guild message should have prefix or appel to be interpreted as a command call
    const isStrict = this.config.prefixMode === 'strict' || !isDirect && !stripped.appel
    if (argv.root && stripped.prefix === null && isStrict) return
    const segments: string[] = []
    while (argv.tokens.length) {
      const { content } = argv.tokens[0]
      segments.push(content)
      const { name, command } = this._resolve(segments.join('.'), argv.session)
      if (!command) break
      argv.tokens.shift()
      argv.command = command
      argv.args = command._aliases[name].args
      argv.options = command._aliases[name].options
      if (command._arguments.length) break
    }
    // https://github.com/koishijs/koishi/issues/1432
    // https://github.com/koishijs/koishi/issues/1441
    if (argv.root && argv.command?.config.captureQuote !== false && quote?.content) {
      argv.tokens.push({
        content: quote.content,
        quoted: true,
        inters: [],
        terminator: '',
      })
    }
    return argv.command
  }

  resolveCommand(argv: Argv) {
    if (!this.inferCommand(argv)) return
    if (argv.tokens?.every(token => !token.inters.length)) {
      const { options, args, error } = argv.command.parse(argv)
      argv.options = options
      argv.args = args
      argv.error = error
    }
    return argv.command
  }

  command(def: string, ...args: [Command.Config?] | [string, Command.Config?]) {
    const desc = typeof args[0] === 'string' ? args.shift() as string : ''
    const config = args[0] as Command.Config
    const path = Command.normalize(def.split(' ', 1)[0])
    const decl = def.slice(path.length)
    const segments = path.split(/(?=[./])/g)

    /** parent command in the chain */
    let parent: Command
    /** the first created command */
    let root: Command
    const created: Command[] = []
    segments.forEach((segment, index) => {
      const code = segment.charCodeAt(0)
      const name = code === 46 ? parent.name + segment : code === 47 ? segment.slice(1) : segment
      let command = this.get(name)
      if (command) {
        if (parent) {
          if (command === parent) {
            throw new Error(`cannot set a command (${command.name}) as its own subcommand`)
          }
          if (command.parent) {
            if (command.parent !== parent) {
              throw new Error(`cannot create subcommand ${path}: ${command.parent.name}/${command.name} already exists`)
            }
          } else {
            command.parent = parent
          }
        }
        return parent = command
      }
      const isLast = index === segments.length - 1
      command = new Command(name, isLast ? decl : '', this.ctx, isLast ? config : {})
      command._disposables.push(this.ctx.i18n.define('', {
        [`commands.${command.name}.$`]: '',
        [`commands.${command.name}.description`]: isLast ? desc : '',
      }))
      created.push(command)
      root ||= command
      if (parent) {
        command.parent = parent
      }
      parent = command
    })

    Object.assign(parent.config, config)
    // Make sure `command.config` is set before emitting any events
    created.forEach(command => this.ctx.emit('command-added', command))
    parent[Context.current] = this.ctx
    if (root) this.ctx.collect(`command <${root.name}>`, () => root.dispose())
    return parent
  }

  domain<K extends keyof Argv.Domain>(name: K): Argv.DomainConfig<Argv.Domain[K]>
  domain<K extends keyof Argv.Domain>(name: K, transform: Argv.Transform<Argv.Domain[K]>, options?: Argv.DomainConfig<Argv.Domain[K]>): () => void
  domain<K extends keyof Argv.Domain>(name: K, transform?: Argv.Transform<Argv.Domain[K]>, options?: Argv.DomainConfig<Argv.Domain[K]>) {
    const service = 'domain:' + name
    if (!transform) return this.ctx.get(service)
    return this.ctx.set(service, { transform, ...options })
  }

  resolveDomain(type: Argv.Type) {
    if (typeof type === 'function') {
      return { transform: type }
    } else if (type instanceof RegExp) {
      const transform = (source: string) => {
        if (type.test(source)) return source
        throw new Error()
      }
      return { transform }
    } else if (isArray(type)) {
      const transform = (source: string) => {
        if (type.includes(source)) return source
        throw new Error()
      }
      return { transform }
    } else if (typeof type === 'object') {
      return type ?? {}
    }
    return this.ctx.get(`domain:${type}`) ?? {}
  }

  parseValue(source: string, kind: string, argv: Argv, decl: Argv.Declaration = {}) {
    const { name, type = 'string' } = decl

    // apply domain callback
    const domain = this.resolveDomain(type)
    try {
      return domain.transform(source, argv.session)
    } catch (err) {
      if (!argv.session) {
        argv.error = `internal.invalid-${kind}`
      } else {
        const message = argv.session.text(err['message'] || 'internal.check-syntax')
        argv.error = argv.session.text(`internal.invalid-${kind}`, [name, message])
      }
    }
  }

  parseDecl(source: string) {
    let cap: RegExpExecArray
    const result = [] as DeclarationList
    // eslint-disable-next-line no-cond-assign
    while (cap = BRACKET_REGEXP.exec(source)) {
      let rawName = cap[0].slice(1, -1)
      let variadic = false
      if (rawName.startsWith('...')) {
        rawName = rawName.slice(3)
        variadic = true
      }
      const [name, rawType] = rawName.split(':')
      const type = rawType ? rawType.trim() as Argv.DomainType : undefined
      result.push({
        name,
        variadic,
        type,
        required: cap[0][0] === '<',
      })
    }
    result.stripped = source.replace(/:[\w-]+(?=[>\]])/g, str => {
      const domain = this.ctx.get(`domain:${str.slice(1)}`)
      return domain?.greedy ? '...' : ''
    }).trimEnd()
    return result
  }
}
