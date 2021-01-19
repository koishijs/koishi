import { noop, Logger, coerce } from 'koishi-utils'
import { Argv, Domain } from './parser'
import { Context, NextFunction } from './context'
import { User, Channel } from './database'
import { FieldCollector, Session } from './session'
import { inspect, format } from 'util'

const logger = new Logger('command')

export type UserType<T, U extends User.Field = User.Field> = T | ((user: Pick<User, U>) => T)

export namespace Command {
  export interface Config {
    /** description */
    description?: string
    /** hide all options by default */
    hideOptions?: boolean
    hidden?: boolean
    /** min authority */
    authority?: number
    /** disallow unknown options */
    checkUnknown?: boolean
    /** check argument count */
    checkArgCount?: boolean
    /** show command warnings */
    showWarning?: boolean
    /** usage identifier */
    usageName?: string
    /** max usage per day */
    maxUsage?: UserType<number>
    /** min interval */
    minInterval?: UserType<number>
  }

  export interface Shortcut {
    name?: string
    command?: Command
    authority?: number
    hidden?: boolean
    prefix?: boolean
    fuzzy?: boolean
    args?: string[]
    oneArg?: boolean
    options?: Record<string, any>
  }

  export type Action<U extends User.Field = never, G extends Channel.Field = never, A extends any[] = any[], O extends {} = {}>
    = (this: Command<U, G, A, O>, argv: Argv<U, G, A, O>, ...args: A) => void | string | Promise<void | string>

  export type Usage<U extends User.Field, G extends Channel.Field>
    = string | ((this: Command<U, G>, session: Session<U, G>) => string | Promise<string>)
}

export class Command<U extends User.Field = never, G extends Channel.Field = never, A extends any[] = any[], O extends {} = {}> extends Domain.CommandBase {
  config: Command.Config
  children: Command[] = []
  parent: Command = null

  _aliases: string[] = []
  _shortcuts: Record<string, Command.Shortcut> = {}
  _usage?: Command.Usage<U, G>
  _examples: string[] = []

  private _userFields: FieldCollector<'user'>[] = []
  private _channelFields: FieldCollector<'channel'>[] = []

  _action?: Command.Action<U, G, A, O>
  _checkers: ((session: Session<U, G>) => void | string | boolean | Promise<void | string | boolean>)[] = []

  static defaultConfig: Command.Config = {}
  static defaultOptionConfig: Domain.OptionConfig = {}

  private static _userFields: FieldCollector<'user'>[] = []
  private static _channelFields: FieldCollector<'channel'>[] = []

  static userFields(fields: FieldCollector<'user'>) {
    this._userFields.push(fields)
    return this
  }

  static channelFields(fields: FieldCollector<'channel'>) {
    this._channelFields.push(fields)
    return this
  }

  constructor(name: string, declaration: string, public context: Context, config: Command.Config = {}) {
    super(name, declaration)
    this.config = { ...Command.defaultConfig, ...config }
    this._registerAlias(this.name)
    context.app._commands.push(this)
    this.option('help', '-h  显示此信息', { hidden: true })
  }

  get app() {
    return this.context.app
  }

  private _registerAlias(name: string) {
    name = name.toLowerCase()
    this._aliases.push(name)
    const previous = this.app._commandMap[name]
    if (!previous) {
      this.app._commandMap[name] = this
    } else if (previous !== this) {
      throw new Error(format('duplicate command names: "%s"', name))
    }
  }

  [inspect.custom]() {
    return `Command <${this.name}>`
  }

  userFields<T extends User.Field = never>(fields: FieldCollector<'user', T, A, O>): Command<U | T, G, A, O> {
    this._userFields.push(fields)
    return this as any
  }

  channelFields<T extends Channel.Field = never>(fields: FieldCollector<'channel', T, A, O>): Command<U, G | T, A, O> {
    this._channelFields.push(fields)
    return this as any
  }

  alias(...names: string[]) {
    for (const name of names) {
      this._registerAlias(name)
    }
    return this
  }

  shortcut(name: string, config?: Command.Shortcut) {
    config = this._shortcuts[name] = {
      name,
      command: this,
      authority: this.config.authority,
      ...config,
    }
    this.app._shortcutMap[name] = this
    this.app._shortcuts.push(config)
    return this
  }

  subcommand(rawName: string, config?: Command.Config): Command
  subcommand(rawName: string, description: string, config?: Command.Config): Command
  subcommand(rawName: string, ...args: [Command.Config?] | [string, Command.Config?]) {
    rawName = this.name + (rawName.charCodeAt(0) === 46 ? '' : '/') + rawName
    return this.context.command(rawName, ...args as any)
  }

  usage(text: Command.Usage<U, G>) {
    this._usage = text
    return this
  }

  example(example: string) {
    this._examples.push(example)
    return this
  }

  // eslint-disable-next-line max-len
  option<K extends string, D extends string>(
    name: K, desc: D,
    config: Domain.OptionConfig = {},
    action?: Command.Action<U, G, A, O & { [P in K]: Domain.OptionType<D> }>,
  ): Command<U, G, A, O & { [P in K]: Domain.OptionType<D> }> {
    if (action) {
      this.before(async (session) => {
        const { options, args, command } = session.$argv
        if (name in options && command === this) {
          return action.call(this as any, session.$argv, ...args)
        }
      })
    }
    return this._registerOption(name, desc, config) as any
  }

  before(checker: (session: Session<U, G>) => void | string | boolean | Promise<void | string | boolean>) {
    this._checkers.push(checker)
    return this
  }

  getConfig<K extends keyof Command.Config>(key: K, session: Session): Exclude<Command.Config[K], (user: User) => any> {
    const value = this.config[key] as any
    return typeof value === 'function' ? value(session.$user) : value
  }

  action(callback: Command.Action<U, G, A, O>) {
    this._action = callback
    return this
  }

  async execute(argv0: Argv<U, G, A, O>, next: NextFunction = noop): Promise<string> {
    const argv = argv0 as Argv<U, G, A, O>
    if (!argv.args) argv.args = [] as any
    if (!argv.options) argv.options = {} as any

    // bypass next function
    let state = 'before command'
    argv.next = async (fallback) => {
      const oldState = state
      state = ''
      await next(fallback)
      state = oldState
    }

    const { args, options, session } = argv
    if (logger.level >= 3) logger.debug(argv.source ||= this.stringify(args, options))
    const lastCall = this.app.options.prettyErrors && new Error().stack.split('\n', 4)[3]
    try {
      const result = await this.app.serial(session, 'before-command', argv)
      if (typeof result === 'string') return result
      return await this._action(argv, ...args) || ''
    } catch (error) {
      if (!state) throw error
      let stack = coerce(error)
      if (lastCall) {
        const index = error.stack.indexOf(lastCall)
        stack = stack.slice(0, index - 1)
      }
      logger.warn(`${argv.source ||= this.stringify(args, options)}\n${stack}`)
    }
  }

  dispose() {
    for (const cmd of this.children) {
      cmd.dispose()
    }
    for (const name in this._shortcuts) {
      delete this.app._shortcutMap[name]
      const index = this.app._shortcuts.indexOf(this._shortcuts[name])
      this.app._shortcuts.splice(index, 1)
    }
    this._aliases.forEach(name => delete this.app._commandMap[name])
    const index = this.app._commands.indexOf(this)
    this.app._commands.splice(index, 1)
    if (this.parent) {
      const index = this.parent.children.indexOf(this)
      this.parent.children.splice(index, 1)
    }
  }

  static apply(ctx: Context) {
    // show help when use `-h, --help` or when there is no action
    ctx.prependListener('before-command', async ({ command, session, options }) => {
      if (command._action && !options['help']) return
      await session.execute({
        name: 'help',
        args: [command.name],
      })
      return ''
    })

    // shortcut
    ctx.on('tokenize', (content, { $reply, $prefix, $appel }) => {
      if ($prefix || $reply) return
      for (const shortcut of ctx.app._shortcuts) {
        const { name, fuzzy, command, oneArg, prefix, options, args = [] } = shortcut
        if (prefix && !$appel) continue
        if (!fuzzy && content !== name) continue
        if (content.startsWith(name)) {
          const message = content.slice(name.length)
          if (fuzzy && !$appel && message.match(/^\S/)) continue
          const argv: Argv = oneArg
            ? { options: {}, args: [message.trim()] }
            : command.parse(Argv.parse(message.trim()))
          argv.command = command
          argv.options = { ...options, ...argv.options }
          argv.args = [...args, ...argv.args]
          return argv
        }
      }
    })
  }
}
