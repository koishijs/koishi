import { noop, Logger, coerce, merge } from 'koishi-utils'
import { Argv, Domain } from './parser'
import { Context, NextFunction } from './context'
import { User, Channel } from './database'
import { FieldCollector, Session } from './session'
import { inspect, format } from 'util'

const logger = new Logger('command')

export type UserType<T, U extends User.Field = User.Field> = T | ((user: Pick<User, U>) => T)

export type Extend<O extends {}, K extends string, T> = {
  [P in K | keyof O]?: (P extends keyof O ? O[P] : unknown) & (P extends K ? T : unknown)
}

export namespace Command {
  export interface Config {
    /** hide all options by default */
    hideOptions?: boolean
    /** hide command */
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
    name?: string | RegExp
    command?: Command
    authority?: number
    prefix?: boolean
    fuzzy?: boolean
    args?: string[]
    greedy?: boolean
    options?: Record<string, any>
  }

  export type Action<U extends User.Field = never, G extends Channel.Field = never, A extends any[] = any[], O extends {} = {}>
    = (this: Command<U, G, A, O>, argv: Argv<U, G, A, O>, ...args: A) => void | string | Promise<void | string>

  export type Usage<U extends User.Field = never, G extends Channel.Field = never>
    = string | ((this: Command<U, G>, session: Session<U, G>) => string | Promise<string>)
}

export class Command<U extends User.Field = never, G extends Channel.Field = never, A extends any[] = any[], O extends {} = {}> extends Domain.CommandBase {
  config: Command.Config
  children: Command[] = []
  parent: Command = null

  _aliases: string[] = []
  _examples: string[] = []
  _usage?: Command.Usage

  private _userFields: FieldCollector<'user'>[] = []
  private _channelFields: FieldCollector<'channel'>[] = []

  _actions: Command.Action<U, G, A, O>[] = []
  _checkers: Command.Action<U, G, A, O>[] = []

  static defaultConfig: Command.Config = {
    authority: 1,
    showWarning: true,
    maxUsage: Infinity,
    minInterval: 0,
  }

  static defaultOptionConfig: Domain.OptionConfig = {
    authority: 0,
  }

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
    this.config = merge(config, Command.defaultConfig)
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

  shortcut(name: string | RegExp, config: Command.Shortcut = {}) {
    config.name = name
    config.command = this
    config.authority ||= this.config.authority
    this.app._shortcuts.push(config)
    return this
  }

  subcommand<D extends string>(def: D, config?: Command.Config): Command<never, never, Domain.ArgumentType<D>>
  subcommand<D extends string>(def: D, decl: string, config?: Command.Config): Command<never, never, Domain.ArgumentType<D>>
  subcommand(def: string, ...args: any[]) {
    def = this.name + (def.charCodeAt(0) === 46 ? '' : '/') + def
    return this.context.command(def, ...args)
  }

  usage(text: Command.Usage<U, G>) {
    this._usage = text
    return this
  }

  example(example: string) {
    this._examples.push(example)
    return this
  }

  option<K extends string, D extends string, T extends Domain.Type>(name: K, desc: D, config: Domain.OptionConfig<T> = {}) {
    this._createOption(name, desc, config)
    return this as Command<U, G, A, Extend<O, K, Domain.OptionType<D, T>>>
  }

  check(callback: Command.Action<U, G, A, O>, prepend = false) {
    if (prepend) {
      this._checkers.unshift(callback)
    } else {
      this._checkers.push(callback)
    }
    return this
  }

  getConfig<K extends keyof Command.Config>(key: K, session: Session): Exclude<Command.Config[K], (user: User) => any> {
    const value = this.config[key] as any
    return typeof value === 'function' ? value(session.$user) : value
  }

  action(callback: Command.Action<U, G, A, O>, append = false) {
    if (append) {
      this._actions.push(callback)
    } else {
      this._actions.unshift(callback)
    }
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

    const { args, options, session, error } = argv
    if (error) return error
    if (logger.level >= 3) logger.debug(argv.source ||= this.stringify(args, options))
    const lastCall = this.app.options.prettyErrors && new Error().stack.split('\n', 4)[3]
    try {
      for (const validator of this._checkers) {
        const result = validator.call(this, argv, ...args)
        if (typeof result === 'string') return result
      }
      const result = await this.app.serial(session, 'before-command', argv)
      if (typeof result === 'string') return result
      for (const action of this._actions) {
        const result = await action.call(this, argv, ...args)
        if (typeof result === 'string') return result
      }
      await this.app.parallel(session, 'command', argv)
      return ''
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
    this.app._shortcuts = this.app._shortcuts.filter(s => s.command !== this)
    this._aliases.forEach(name => delete this.app._commandMap[name])
    const index = this.app._commands.indexOf(this)
    this.app._commands.splice(index, 1)
    if (this.parent) {
      const index = this.parent.children.indexOf(this)
      this.parent.children.splice(index, 1)
    }
  }
}
