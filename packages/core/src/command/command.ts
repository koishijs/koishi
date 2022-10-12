import { Awaitable, coerce, Dict, isNullable, Logger, remove, Schema } from '@koishijs/utils'
import { segment } from '@satorijs/core'
import { Disposable } from 'cordis'
import { Context } from '../context'
import { Argv } from './parser'
import { Next } from '../internal'
import { Channel, User } from '../database'
import { Computed, FieldCollector, Session } from '../session'

const logger = new Logger('command')

export type Extend<O extends {}, K extends string, T> = {
  [P in K | keyof O]?: (P extends keyof O ? O[P] : unknown) & (P extends K ? T : unknown)
}

export interface CommandService {
}

export namespace Command {
  export interface Shortcut {
    name?: string | RegExp
    command?: Command
    prefix?: boolean
    fuzzy?: boolean
    args?: string[]
    options?: Dict
  }

  export type Action<U extends User.Field = never, G extends Channel.Field = never, A extends any[] = any[], O extends {} = {}>
    = (argv: Argv<U, G, A, O>, ...args: A) => Awaitable<void | string | segment>

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

  private _userFields: FieldCollector<'user'>[] = [['locale']]
  private _channelFields: FieldCollector<'channel'>[] = [['locale']]
  private _actions: Command.Action[] = []
  private _checkers: Command.Action[] = [async (argv) => {
    return this.ctx.serial(argv.session, 'command/before-execute', argv)
  }]

  static defaultConfig: Command.Config = {
    authority: 1,
    showWarning: true,
  }

  static defaultOptionConfig: Argv.OptionConfig = {
    authority: 0,
  }

  private static _userFields: FieldCollector<'user'>[] = []
  private static _channelFields: FieldCollector<'channel'>[] = []

  /** @deprecated use `command-added` event instead */
  static userFields(fields: FieldCollector<'user'>) {
    this._userFields.push(fields)
    return this
  }

  /** @deprecated use `command-added` event instead */
  static channelFields(fields: FieldCollector<'channel'>) {
    this._channelFields.push(fields)
    return this
  }

  constructor(name: string, decl: string, ctx: Context) {
    super(name, decl, ctx)
    this.config = { ...Command.defaultConfig }
    this._registerAlias(name)
    ctx.$commander._commandList.push(this)
  }

  get displayName() {
    return this._aliases[0]
  }

  set displayName(name) {
    this._registerAlias(name, true)
  }

  private _registerAlias(name: string, prepend = false) {
    name = name.toLowerCase()

    // add to list
    const done = this._aliases.includes(name)
    if (done) {
      if (prepend) {
        remove(this._aliases, name)
        this._aliases.unshift(name)
      }
      return
    } else if (prepend) {
      this._aliases.unshift(name)
    } else {
      this._aliases.push(name)
    }

    // register global
    const previous = this.ctx.$commander.getCommand(name)
    if (!previous) {
      this.ctx.$commander._commands.set(name, this)
    } else if (previous !== this) {
      throw new Error(`duplicate command names: "${name}"`)
    }

    // add disposable
    this._disposables?.push(() => {
      remove(this._aliases, name)
      this.ctx.$commander._commands.delete(name)
    })
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
    }
    return this
  }

  shortcut(name: string | RegExp, config: Command.Shortcut = {}) {
    if (this._disposed) return this
    config.name = name
    config.command = this
    this.ctx.$commander._shortcuts.push(config)
    this._disposables?.push(() => remove(this.ctx.$commander._shortcuts, config))
    return this
  }

  subcommand<D extends string>(def: D, config?: Command.Config): Command<never, never, Argv.ArgumentType<D>>
  subcommand<D extends string>(def: D, desc: string, config?: Command.Config): Command<never, never, Argv.ArgumentType<D>>
  subcommand(def: string, ...args: any[]) {
    def = this.name + (def.charCodeAt(0) === 46 ? '' : '/') + def
    const desc = typeof args[0] === 'string' ? args.shift() as string : ''
    const config = args[0] as Command.Config || {}
    if (this._disposed) config.patch = true
    return this.ctx.command(def, desc, config)
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
  option(name: string, ...args: [Argv.OptionConfig?] | [string, Argv.OptionConfig?]) {
    let desc = ''
    if (typeof args[0] === 'string') {
      desc = args.shift() as string
    }
    const config = args[0] as Argv.OptionConfig
    this._createOption(name, desc, config || {})
    this._disposables?.push(() => this.removeOption(name))
    return this
  }

  match(session: Session) {
    const { authority = Infinity } = (session.user || {}) as User
    return this.ctx.filter(session) && this.config.authority <= authority
  }

  getConfig<K extends keyof Command.Config>(key: K, session: Session): Exclude<Command.Config[K], (session: Session) => any> {
    const value = this.config[key] as any
    return typeof value === 'function' ? value(session) : value
  }

  check(callback: Command.Action<U, G, A, O>, append = false) {
    return this.before(callback, append)
  }

  before(callback: Command.Action<U, G, A, O>, append = false) {
    if (append) {
      this._checkers.push(callback)
    } else {
      this._checkers.unshift(callback)
    }
    this._disposables?.push(() => remove(this._checkers, callback))
    return this
  }

  action(callback: Command.Action<U, G, A, O>, prepend = false) {
    if (prepend) {
      this._actions.unshift(callback)
    } else {
      this._actions.push(callback)
    }
    this._disposables?.push(() => remove(this._actions, callback))
    return this
  }

  use<T extends Command, R extends any[]>(callback: (command: this, ...args: R) => T, ...args: R): T {
    return callback(this, ...args)
  }

  async execute(argv: Argv<U, G, A, O>, fallback = Next.compose): Promise<string | segment> {
    argv.command ??= this
    argv.args ??= [] as any
    argv.options ??= {} as any

    const { args, options, error } = argv
    if (error) return error
    if (logger.level >= 3) logger.debug(argv.source ||= this.stringify(args, options))

    // before hooks
    for (const validator of this._checkers) {
      const result = await validator.call(this, argv, ...args)
      if (typeof result === 'string') return result
    }

    // FIXME empty actions will cause infinite loop
    if (!this._actions.length) return ''

    let index = 0
    const queue: Next.Queue = this._actions.map(action => async () => {
      return await action.call(this, argv, ...args)
    })

    queue.push(fallback)
    const length = queue.length
    argv.next = async (callback) => {
      if (callback !== undefined) {
        queue.push(next => Next.compose(callback, next))
        if (queue.length > Next.MAX_DEPTH) {
          throw new Error(`middleware stack exceeded ${Next.MAX_DEPTH}`)
        }
      }
      return queue[index++]?.(argv.next)
    }

    try {
      const result = await argv.next()
      if (!isNullable(result)) return result
    } catch (error) {
      if (index === length) throw error
      const stack = coerce(error)
      logger.warn(`${argv.source ||= this.stringify(args, options)}\n${stack}`)
      this.ctx.emit(argv.session, 'command-error', argv, error)
    }

    return ''
  }

  dispose() {
    this._disposed = true
    this.ctx.emit('command-removed', this)
    for (const cmd of this.children.slice()) {
      cmd.dispose()
    }
    this.ctx.$commander._shortcuts = this.ctx.$commander._shortcuts.filter(s => s.command !== this)
    this._aliases.forEach(name => this.ctx.$commander._commands.delete(name))
    remove(this.ctx.$commander._commandList, this)
    if (this.parent) {
      remove(this.parent.children, this)
    }
  }
}

export namespace Command {
  export interface Config {
    /** min authority */
    authority?: Computed<number>
    /** disallow unknown options */
    checkUnknown?: boolean
    /** check argument count */
    checkArgCount?: boolean
    /** show command warnings */
    showWarning?: boolean
    /** depend on existing commands */
    patch?: boolean
  }

  export const Config: Schema<Config> = Schema.object({
    authority: Schema.union([
      Schema.natural(),
      Schema.function(),
    ]).default(1),
    hidden: Schema.boolean().default(false),
    checkArgCount: Schema.boolean().default(false),
    checkUnknown: Schema.boolean().default(false),
  })
}
