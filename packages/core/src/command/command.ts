import { Awaitable, camelize, Dict, isNullable, remove } from 'cosmokit'
import { coerce } from '@koishijs/utils'
import { Context, Fragment, Logger, Schema, Session } from '@satorijs/core'
import { Disposable } from 'cordis'
import { Argv } from './parser'
import { Next, SessionError } from '../middleware'
import { Channel, User } from '../database'
import { FieldCollector } from '../session'
import { Computed } from '../filter'

const logger = new Logger('command')

export type Extend<O extends {}, K extends string, T> = {
  [P in K | keyof O]?: (P extends keyof O ? O[P] : unknown) & (P extends K ? T : unknown)
}

export namespace Command {
  export interface Shortcut {
    i18n?: boolean
    name?: string | RegExp
    command?: Command
    prefix?: boolean
    fuzzy?: boolean
    args?: string[]
    options?: Dict
  }

  export type Action<U extends User.Field = never, G extends Channel.Field = never, A extends any[] = any[], O extends {} = {}>
    = (argv: Argv<U, G, A, O>, ...args: A) => Awaitable<void | Fragment>

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
  _disposables2: Disposable[] = []

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
    if (name.startsWith('.')) name = this.parent.name + name

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

  userFields<T extends User.Field>(fields: FieldCollector<'user', T, A, O>): Command<U | T, G, A, O> {
    this._userFields.push(fields)
    return this as any
  }

  channelFields<T extends Channel.Field>(fields: FieldCollector<'channel', T, A, O>): Command<U, G | T, A, O> {
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

  _escape(source: any) {
    if (typeof source !== 'string') return source
    return source
      .replace(/\$\$/g, '@@__PLACEHOLDER__@@')
      .replace(/\$\d/g, s => `{${s[1]}}`)
      .replace(/@@__PLACEHOLDER__@@/g, '$')
  }

  shortcut(pattern: string | RegExp, config?: Command.Shortcut & { i18n?: false }): this
  shortcut(pattern: string, config: Command.Shortcut & { i18n: true }): this
  shortcut(pattern: string | RegExp, config: Command.Shortcut = {}) {
    if (this._disposed) return this
    let content = this.displayName
    for (const key in config.options || {}) {
      content += ` --${camelize(key)}`
      const value = config.options[key]
      if (value !== true) {
        content += ' ' + this._escape(value)
      }
    }
    for (const arg of config.args || []) {
      content += ' ' + this._escape(arg)
    }
    if (config.fuzzy) content += ' {1}'
    const regex = config.i18n
    if (typeof pattern === 'string') {
      if (config.i18n) {
        pattern = `commands.${this.name}.shortcuts.${pattern}`
      } else {
        config.i18n = true
        const key = `commands.${this.name}.shortcuts._${Math.random().toString(36).slice(2)}`
        this.ctx.i18n.define('', key, pattern)
        pattern = key
      }
    }
    const dispose = this.ctx.match(pattern, `<execute>${content}</execute>`, {
      appel: config.prefix,
      fuzzy: config.fuzzy,
      i18n: config.i18n as never,
      regex,
    })
    this._disposables2.push(dispose)
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
    return this.ctx.filter(session) && session.resolve(this.config.authority) <= authority
  }

  /** @deprecated */
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

  async execute(argv: Argv<U, G, A, O>, fallback: Next = Next.compose): Promise<Fragment> {
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
      if (error instanceof SessionError) {
        return argv.session.text(error.path, error.param)
      }
      const stack = coerce(error)
      logger.warn(`${argv.source ||= this.stringify(args, options)}\n${stack}`)
      this.ctx.emit(argv.session, 'command-error', argv, error)
    }

    return ''
  }

  dispose() {
    this._disposed = true
    this._disposables2.forEach(dispose => dispose())
    this.ctx.emit('command-removed', this)
    for (const cmd of this.children.slice()) {
      cmd.dispose()
    }
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
    authority: Schema.computed(Schema.natural()).description('指令的权限等级。').default(1),
    checkUnknown: Schema.boolean().description('是否检查未知选项。').default(false).hidden(),
    checkArgCount: Schema.boolean().description('是否检查参数数量。').default(false).hidden(),
    showWarning: Schema.boolean().description('是否显示警告。').default(true).hidden(),
  })
}
