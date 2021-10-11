import { Logger, coerce, Time, template, remove, Awaitable, Dict } from '@koishijs/utils'
import { Argv } from './parser'
import { Context, Disposable, NextFunction } from './context'
import { User, Channel } from './database'
import { FieldCollector, Session } from './session'

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
    /** depend on existing commands */
    patch?: boolean
  }

  export interface Shortcut {
    name?: string | RegExp
    command?: Command
    authority?: number
    prefix?: boolean
    fuzzy?: boolean
    args?: string[]
    options?: Dict
  }

  export type Action<U extends User.Field = never, G extends Channel.Field = never, A extends any[] = any[], O extends {} = {}>
    = (argv: Argv<U, G, A, O>, ...args: A) => Awaitable<void | string>

  export type Usage<U extends User.Field = never, G extends Channel.Field = never>
    = string | ((session: Session<U, G>) => Awaitable<string>)
}

export class Command<U extends User.Field = never, G extends Channel.Field = never, A extends any[] = any[], O extends {} = {}> extends Argv.CommandBase {
  config: Command.Config
  children: Command[] = []
  parent: Command = null

  _aliases: string[] = []
  _examples: string[] = []
  _usage?: Command.Usage
  _disposed?: boolean
  _disposables?: Disposable[]

  private _userFields: FieldCollector<'user'>[] = []
  private _channelFields: FieldCollector<'channel'>[] = []
  private _actions: Command.Action<U, G, A, O>[] = []
  private _checkers: Command.Action<U, G, A, O>[] = []

  static defaultConfig: Command.Config = {
    authority: 1,
    showWarning: true,
    maxUsage: Infinity,
    minInterval: 0,
  }

  static defaultOptionConfig: Argv.OptionConfig = {
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

  constructor(name: string, decl: string, desc: string, public context: Context) {
    super(name, decl, desc)
    this.config = { ...Command.defaultConfig }
    this._registerAlias(this.name)
    context.app._commandList.push(this)
    context.app.emit('command-added', this)
  }

  get app() {
    return this.context.app
  }

  private _registerAlias(name: string) {
    name = name.toLowerCase()
    this._aliases.push(name)
    const previous = this.app._commands.get(name)
    if (!previous) {
      this.app._commands.set(name, this)
    } else if (previous !== this) {
      throw new Error(template.format('duplicate command names: "{0}"', name))
    }
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
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
    if (this._disposed) return this
    for (const name of names) {
      this._registerAlias(name)
      this._disposables?.push(() => {
        remove(this._aliases, name)
        this.app._commands.delete(name)
      })
    }
    return this
  }

  shortcut(name: string | RegExp, config: Command.Shortcut = {}) {
    if (this._disposed) return this
    config.name = name
    config.command = this
    config.authority ||= this.config.authority
    this.app._shortcuts.push(config)
    this._disposables?.push(() => remove(this.app._shortcuts, config))
    return this
  }

  subcommand<D extends string>(def: D, config?: Command.Config): Command<never, never, Argv.ArgumentType<D>>
  subcommand<D extends string>(def: D, desc: string, config?: Command.Config): Command<never, never, Argv.ArgumentType<D>>
  subcommand(def: string, ...args: any[]) {
    def = this.name + (def.charCodeAt(0) === 46 ? '' : '/') + def
    const desc = typeof args[0] === 'string' ? args.shift() as string : ''
    const config = args[0] as Command.Config || {}
    if (this._disposed) config.patch = true
    return this.context.command(def, desc, config)
  }

  usage(text: Command.Usage<U, G>) {
    this._usage = text
    return this
  }

  example(example: string) {
    this._examples.push(example)
    return this
  }

  option<K extends string>(name: K, desc: string, config: Argv.TypedOptionConfig<RegExp>): Command<U, G, A, Extend<O, K, string>>
  option<K extends string, R>(name: K, desc: string, config: Argv.TypedOptionConfig<(source: string) => R>): Command<U, G, A, Extend<O, K, R>>
  option<K extends string, R extends string>(name: K, desc: string, config: Argv.TypedOptionConfig<R[]>): Command<U, G, A, Extend<O, K, R>>
  option<K extends string, D extends string>(name: K, desc: D, config?: Argv.OptionConfig): Command<U, G, A, Extend<O, K, Argv.OptionType<D>>>
  option(name: string, desc: string, config: Argv.OptionConfig = {}) {
    this._createOption(name, desc, config)
    this._disposables?.push(() => this.removeOption(name))
    return this
  }

  match(session: Session) {
    const { authority = Infinity } = (session.user || {}) as User
    return this.context.match(session) && this.config.authority <= authority
  }

  getConfig<K extends keyof Command.Config>(key: K, session: Session): Exclude<Command.Config[K], (user: User) => any> {
    const value = this.config[key] as any
    return typeof value === 'function' ? value(session.user) : value
  }

  check(callback: Command.Action<U, G, A, O>, prepend = false) {
    if (prepend) {
      this._checkers.unshift(callback)
    } else {
      this._checkers.push(callback)
    }
    this._disposables?.push(() => remove(this._checkers, callback))
    return this
  }

  action(callback: Command.Action<U, G, A, O>, append = false) {
    if (append) {
      this._actions.push(callback)
    } else {
      this._actions.unshift(callback)
    }
    this._disposables?.push(() => remove(this._actions, callback))
    return this
  }

  async execute(argv0: Argv<U, G, A, O>, next: NextFunction = fallback => fallback?.()): Promise<string> {
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
        const result = await validator.call(this, argv, ...args)
        if (typeof result === 'string') return result
      }
      const result = await this.app.serial(session, 'before-command', argv)
      if (typeof result === 'string') return result
      state = 'executing command'
      for (const action of this._actions) {
        const result = await action.call(this, argv, ...args)
        if (typeof result === 'string') return result
      }
      state = 'after command'
      await this.app.parallel(session, 'command', argv)
      return ''
    } catch (error) {
      if (!state) throw error
      let stack = coerce(error)
      if (lastCall) {
        const index = error.stack.indexOf(lastCall)
        stack = stack.slice(0, index - 1)
      }
      logger.warn(`${state}: ${argv.source ||= this.stringify(args, options)}\n${stack}`)
      return ''
    }
  }

  dispose() {
    this._disposed = true
    this.app.emit('command-removed', this)
    for (const cmd of this.children.slice()) {
      cmd.dispose()
    }
    this.app._shortcuts = this.app._shortcuts.filter(s => s.command !== this)
    this._aliases.forEach(name => this.app._commands.delete(name))
    remove(this.app._commandList, this)
    if (this.parent) {
      remove(this.parent.children, this)
    }
  }
}

export function getUsageName(command: Command) {
  return command.config.usageName || command.name
}

export type ValidationField = 'authority' | 'usage' | 'timers'

Command.userFields(({ tokens, command, options = {} }, fields) => {
  if (!command) return
  const { maxUsage, minInterval, authority } = command.config
  let shouldFetchAuthority = authority > 0
  let shouldFetchUsage = !!(maxUsage || minInterval)
  for (const { name, authority, notUsage } of Object.values(command._options)) {
    if (name in options) {
      if (authority > 0) shouldFetchAuthority = true
      if (notUsage) shouldFetchUsage = false
    } else if (tokens) {
      if (authority > 0) shouldFetchAuthority = true
    }
  }
  if (shouldFetchAuthority) fields.add('authority')
  if (shouldFetchUsage) {
    if (maxUsage) fields.add('usage')
    if (minInterval) fields.add('timers')
  }
})

export default function apply(ctx: Context) {
  // check user
  ctx.before('command', (argv: Argv<ValidationField>) => {
    const { session, options, command } = argv
    if (!session.user) return

    function sendHint(message: string, ...param: any[]) {
      return command.config.showWarning ? template(message, param) : ''
    }

    let isUsage = true

    // check authority
    if (command.config.authority > session.user.authority) {
      return sendHint('internal.low-authority')
    }
    for (const option of Object.values(command._options)) {
      if (option.name in options) {
        if (option.authority > session.user.authority) {
          return sendHint('internal.low-authority')
        }
        if (option.notUsage) isUsage = false
      }
    }

    // check usage
    if (isUsage) {
      const name = getUsageName(command)
      const minInterval = command.getConfig('minInterval', session)
      const maxUsage = command.getConfig('maxUsage', session)

      if (maxUsage < Infinity && checkUsage(name, session.user, maxUsage)) {
        return sendHint('internal.usage-exhausted')
      }

      if (minInterval > 0 && checkTimer(name, session.user, minInterval)) {
        return sendHint('internal.too-frequent')
      }
    }
  })

  // check argv
  ctx.before('command', (argv: Argv) => {
    const { args, options, command } = argv
    function sendHint(message: string, ...param: any[]) {
      return command.config.showWarning ? template(message, param) : ''
    }

    // check argument count
    if (command.config.checkArgCount) {
      const nextArg = command._arguments[args.length] || {}
      if (nextArg.required) {
        return sendHint('internal.insufficient-arguments')
      }
      const finalArg = command._arguments[command._arguments.length - 1] || {}
      if (args.length > command._arguments.length && finalArg.type !== 'text' && !finalArg.variadic) {
        return sendHint('internal.redunant-arguments')
      }
    }

    // check unknown options
    if (command.config.checkUnknown) {
      const unknown = Object.keys(options).filter(key => !command._options[key])
      if (unknown.length) {
        return sendHint('internal.unknown-option', unknown.join(', '))
      }
    }
  })
}

export function getUsage(name: string, user: Pick<User, 'usage'>) {
  const $date = Time.getDateNumber()
  if (user.usage.$date !== $date) {
    user.usage = { $date }
  }
  return user.usage[name] || 0
}

export function checkUsage(name: string, user: Pick<User, 'usage'>, maxUsage?: number) {
  if (!user.usage) return
  const count = getUsage(name, user)
  if (count >= maxUsage) return true
  if (maxUsage) {
    user.usage[name] = count + 1
  }
}

export function checkTimer(name: string, { timers }: Pick<User, 'timers'>, offset?: number) {
  const now = Date.now()
  if (!(now <= timers.$date)) {
    for (const key in timers) {
      if (now > timers[key]) delete timers[key]
    }
    timers.$date = now + Time.day
  }
  if (now <= timers[name]) return true
  if (offset !== undefined) {
    timers[name] = now + offset
  }
}
