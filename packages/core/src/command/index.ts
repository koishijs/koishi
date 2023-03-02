import { Awaitable, defineProperty } from 'cosmokit'
import { Context, h, Schema, Session } from '@satorijs/core'
import { Command } from './command'
import { Argv } from './parser'
import validate from './validate'
import { Channel, User } from '../database'
import { Computed } from '../filter'

export * from './command'
export * from './parser'
export * from './validate'

interface CommandMap extends Map<string, Command> {
  resolve(key: string): Command
}

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

export class Commander {
  static readonly key = '$commander'
  static readonly methods = ['command']

  _commandList: Command[] = []
  _commands = new Map<string, Command>() as CommandMap
  _shortcuts: Command.Shortcut[] = []

  constructor(private ctx: Context, private config: Commander.Config = {}) {
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
      const { argv, quote, subtype, parsed: { prefix, appel } } = session
      if (argv.command || subtype !== 'private' && !prefix && !appel) return next()
      const content = session.parsed.content.slice((prefix ?? '').length)
      const actual = content.split(/\s/, 1)[0].toLowerCase()
      if (!actual) return next()

      return next(async (next) => {
        const name = await session.suggest({
          actual,
          expect: this.available(session),
          suffix: session.text('internal.suggest-command'),
        })
        if (!name) return next()
        const message = name + content.slice(actual.length) + (quote ? ' ' + quote.content : '')
        return session.execute(message, next)
      })
    })

    ctx.schema.extend('command', Command.Config, 1000)
    ctx.schema.extend('command-option', Schema.object({
      authority: Schema.computed(Schema.natural()).description('选项的权限等级。').default(0),
    }), 1000)
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

  protected get caller() {
    return this[Context.current]
  }

  resolve(key: string) {
    if (!key) return
    const segments = key.split('.')
    let i = 1, name = segments[0], cmd: Command
    while ((cmd = this.getCommand(name)) && i < segments.length) {
      name = cmd.name + '.' + segments[i++]
    }
    return cmd
  }

  getCommand(name: string) {
    return this._commands.get(name)
  }

  command(def: string, ...args: [Command.Config?] | [string, Command.Config?]) {
    const desc = typeof args[0] === 'string' ? args.shift() as string : ''
    const config = args[0] as Command.Config
    const path = def.split(' ', 1)[0].toLowerCase()
    const decl = def.slice(path.length)
    const segments = path.split(/(?=[./])/g)
    const caller = this.caller

    let parent: Command, root: Command
    const extra: Command[] = []
    segments.forEach((segment, index) => {
      const code = segment.charCodeAt(0)
      const name = code === 46 ? parent.name + segment : code === 47 ? segment.slice(1) : segment
      let command = this.getCommand(name)
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
            parent.children.push(command)
          }
        }
        return parent = command
      }
      command = new Command(name, index === segments.length - 1 ? decl : '', caller)
      extra.push(command)
      if (!root) root = command
      if (parent) {
        command.parent = parent
        command.config.authority = parent.config.authority
        parent.children.push(command)
      }
      parent = command
    })

    if (desc) caller.i18n.define('', `commands.${parent.name}.description`, desc)
    Object.assign(parent.config, config)
    extra.forEach(command => caller.emit('command-added', command))
    if (!config?.patch) {
      if (root) caller.state.disposables.unshift(() => root.dispose())
      return parent
    }

    if (root) root.dispose()
    const command = Object.create(parent)
    command._disposables = caller.state.disposables
    return command
  }
}

Context.service(Commander.key, Commander)
