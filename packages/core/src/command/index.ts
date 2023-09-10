import { Awaitable, defineProperty } from 'cosmokit'
import { Bot, Context, h, Schema, Session } from '@satorijs/core'
import { Command } from './command'
import { Argv } from './parser'
import validate from './validate'
import { Channel, User } from '../database'
import { Computed } from '../filter'

export * from './command'
export * from './parser'
export * from './validate'

declare module '@satorijs/core' {
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
  static readonly key = '$commander'
  static readonly methods = ['command']

  _commandList: Command[] = []
  _commands = this
  _shortcuts: Command.Shortcut[] = []

  constructor(private ctx: Context, private config: Commander.Config = {}) {
    super()
    defineProperty(this, Context.current, ctx)
    ctx.plugin(validate)

    ctx.before('parse', (content, session) => {
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
    })

    ctx.on('interaction/command', (session) => {
      if (session.data?.argv) {
        const { name, options, arguments: args } = session.data.argv
        session.execute({ name, args, options })
      } else {
        defineProperty(session, 'argv', ctx.bail('before-parse', session.content, session))
        session.argv.root = true
        session.argv.session = session
        session.execute(session.argv)
      }
    })

    ctx.before('attach', (session) => {
      // strip prefix
      let content = session.parsed.content
      for (const prefix of this._resolvePrefixes(session)) {
        if (!content.startsWith(prefix)) continue
        session.parsed.prefix = prefix
        content = content.slice(prefix.length)
        break
      }
      defineProperty(session, 'argv', ctx.bail('before-parse', content, session))
      session.argv.root = true
      session.argv.session = session
    })

    ctx.middleware((session, next) => {
      // execute command
      if (!session.resolveCommand(session.argv)) return next()
      return session.execute(session.argv, next)
    })

    ctx.middleware((session, next) => {
      // use `!prefix` instead of `prefix === null` to prevent from blocking other middlewares
      // we need to make sure that the user truly has the intension to call a command
      const { argv, quote, isDirect, parsed: { prefix, appel } } = session
      if (argv.command || !isDirect && !prefix && !appel) return next()
      const content = session.parsed.content.slice((prefix ?? '').length)
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
        const message = name + content.slice(actual.length) + (quote ? ' ' + quote.content : '')
        return session.execute(message, next)
      })
    })

    ctx.schema.extend('command', Command.Config, 1000)
    ctx.schema.extend('command-option', Schema.object({
      authority: Schema.computed(Schema.natural()).description('选项的权限等级。').default(0).hidden(),
    }), 1000)

    ctx.on('ready', () => {
      const bots = ctx.bots.filter(v => v.status === 'online' && v.updateCommands)
      bots.forEach(bot => this.updateCommands(bot))
    })

    ctx.on('bot-status-updated', async (bot) => {
      if (bot.status !== 'online' || !bot.updateCommands) return
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
    return result.map(source => h.escape(source))
  }

  available(session: Session) {
    return this._commandList
      .filter(cmd => cmd.match(session))
      .flatMap(cmd => cmd._aliases)
  }

  protected get caller(): Context {
    return this[Context.current]
  }

  resolve(key: string) {
    if (!key) return
    const segments = key.toLowerCase().split('.')
    let i = 1, name = segments[0], cmd: Command
    while ((cmd = this.get(name)) && i < segments.length) {
      name = cmd.name + '.' + segments[i++]
    }
    return cmd
  }

  /** @deprecated use `.get()` instead */
  getCommand(name: string) {
    return this.get(name)
  }

  command(def: string, ...args: [Command.Config?] | [string, Command.Config?]) {
    const desc = typeof args[0] === 'string' ? args.shift() as string : ''
    const config = args[0] as Command.Config
    const path = def.split(' ', 1)[0].toLowerCase()
    const decl = def.slice(path.length)
    const segments = path.split(/(?=[./])/g)
    const caller = this.caller

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
      command = new Command(name, index === segments.length - 1 ? decl : '', caller)
      command._disposables.push(caller.i18n.define('', {
        [`commands.${command.name}.$`]: '',
        [`commands.${command.name}.description`]: index === segments.length - 1 ? desc : '',
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
    parent._disposables.push(this.caller.permissions.config(`command.${parent.name}`, parent.config, 1))
    if (root) caller.collect(`command <${root.name}>`, () => root.dispose())
    return parent
  }
}

Context.service(Commander.key, Commander)
