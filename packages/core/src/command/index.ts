import { Awaitable, defineProperty } from 'cosmokit'
import { Bot, h, Schema, Universal } from '@satorijs/core'
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
    'command-removed'(command: Command): void
    'command-error'(argv: Argv, error: any): void
    'command/before-execute'(argv: Argv): Awaitable<void | string>
    'command/before-attach-channel'(argv: Argv, fields: Set<Channel.Field>): void
    'command/before-attach-user'(argv: Argv, fields: Set<User.Field>): void
  }
}

export namespace Commander {
  export interface Config {
    prefix?: Computed<string | string[]>
  }
}

export class Commander extends Map<string, Command> {
  _commandList: Command[] = []
  _commands = this

  constructor(private ctx: Context, private config: Commander.Config = {}) {
    super()
    defineProperty(this, Context.current, ctx)
    ctx.plugin(validate)

    ctx.before('parse', (content, session) => {
      // we need to make sure that the user truly has the intension to call a command
      const { quote, isDirect, stripped: { prefix, appel } } = session
      if (!isDirect && typeof prefix !== 'string' && !appel) return
      const argv = Argv.parse(content)
      if (quote?.content) {
        argv.tokens.push({
          content: quote.content,
          quoted: true,
          inters: [],
          terminator: '',
        })
      }
      return argv
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
            name = this.resolve(name)!.name
            return ctx.permissions.test(`command.${name}`, session, cache)
          },
        })
        if (!name) return next()
        const message = name + content.slice(actual.length) + (quote?.content ? ' ' + quote.content : '')
        return session.execute(message, next)
      })
    })

    ctx.schema.extend('command', Command.Config, 1000)
    ctx.schema.extend('command-option', Schema.object({
      inherits: Schema.array(String).role('table').default(['authority.0']).description('权限继承。'),
      depends: Schema.array(String).role('table').description('权限依赖。'),
    }), 1000)

    ctx.on('ready', () => {
      const bots = ctx.bots.filter(v => v.status === Universal.Status.ONLINE && v.updateCommands)
      bots.forEach(bot => this.updateCommands(bot))
    })

    ctx.on('bot-status-updated', async (bot) => {
      if (bot.status !== Universal.Status.ONLINE || !bot.updateCommands) return
      this.updateCommands(bot)
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

  resolve(key: string) {
    return this._resolve(key).command
  }

  _resolve(key: string) {
    if (!key) return {}
    const segments = key.toLowerCase().split('.')
    let i = 1, name = segments[0], command: Command
    while ((command = this.get(name)) && i < segments.length) {
      name = command.name + '.' + segments[i++]
    }
    return { command, name }
  }

  inferCommand(argv: Argv) {
    if (!argv) return
    if (argv.command) return argv.command
    if (argv.name) return argv.command = this.resolve(argv.name)

    const { stripped, isDirect } = argv.session
    // guild message should have prefix or appel to be interpreted as a command call
    if (argv.root && !isDirect && stripped.prefix === null && !stripped.appel) return
    const segments: string[] = []
    while (argv.tokens.length) {
      const { content } = argv.tokens[0]
      segments.push(content)
      const { name, command } = this._resolve(segments.join('.'))
      if (!command) break
      argv.tokens.shift()
      argv.command = command
      argv.args = command._aliases[name].args
      argv.options = command._aliases[name].options
      if (command._arguments.length) break
    }
    return argv.command
  }

  resolveCommand(argv: Argv) {
    if (!this.inferCommand(argv)) return
    if (argv.tokens?.every(token => !token.inters.length)) {
      const { options, args, error } = argv.command.parse(argv)
      argv.options = { ...argv.options, ...options }
      argv.args = [...argv.args || [], ...args]
      argv.error = error
    }
    return argv.command
  }

  command(def: string, ...args: [Command.Config?] | [string, Command.Config?]) {
    const desc = typeof args[0] === 'string' ? args.shift() as string : ''
    const config = args[0] as Command.Config
    const path = def.split(' ', 1)[0].toLowerCase()
    const decl = def.slice(path.length)
    const segments = path.split(/(?=[./])/g)
    const caller: Context = this[Context.current]

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
      command = new Command(name, isLast ? decl : '', caller, isLast ? config : {})
      command._disposables.push(caller.i18n.define('', {
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
    created.forEach(command => caller.emit('command-added', command))
    parent[Context.current] = caller
    if (root) caller.collect(`command <${root.name}>`, () => root.dispose())
    return parent
  }
}
