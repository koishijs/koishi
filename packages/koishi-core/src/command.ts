import { noop, camelCase, paramCase, Logger, coerce } from 'koishi-utils'
import { Argv, Domain } from './parser'
import { Context, NextFunction } from './context'
import { User, Channel } from './database'
import { FieldCollector } from './session'
import { inspect, format } from 'util'

const logger = new Logger('command')

const supportedType = ['string', 'number', 'boolean'] as const

type StringOptionConfig = Domain.OptionConfig & ({ fallback: string } | { type: 'string' })
type NumberOptionConfig = Domain.OptionConfig & ({ fallback: number } | { type: 'number' })
type BooleanOptionConfig = Domain.OptionConfig & ({ fallback: boolean } | { type: 'boolean' })

export interface CommandConfig<U extends User.Field = never, G extends Channel.Field = never> {
  /** description */
  description?: string
}

export type Extend<O extends {}, K extends string, T> = {
  [P in K | keyof O]?: (P extends keyof O ? O[P] : unknown) & (P extends K ? T : unknown)
}

export type CommandAction<U extends User.Field = never, G extends Channel.Field = never, O extends {} = {}> =
  (this: Command<U, G, O>, argv: Argv<U, G, O>, ...args: string[]) => void | string | Promise<void | string>

export class Command<U extends User.Field = never, G extends Channel.Field = never, O extends {} = {}> {
  config: CommandConfig<U, G>
  children: Command[] = []
  parent: Command = null

  _aliases: string[] = []
  _arguments: Domain.ArgumentDecl[]
  _options: Record<string, Domain.OptionDecl> = {}

  private _optionNameMap: Record<string, Domain.OptionDecl> = {}
  private _optionSymbolMap: Record<string, Domain.OptionDecl> = {}
  private _userFields: FieldCollector<'user'>[] = []
  private _channelFields: FieldCollector<'channel'>[] = []

  _action?: CommandAction<U, G, O>

  static defaultConfig: CommandConfig = {}
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

  constructor(public name: string, public declaration: string, public context: Context, config: CommandConfig = {}) {
    if (!name) throw new Error('expect a command name')
    this._arguments = Domain.parseArgDecl(declaration)
    this.config = { ...Command.defaultConfig, ...config }
    this._registerAlias(this.name)
    context.app._commands.push(this)
    context.app.emit('new-command', this)
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

  userFields<T extends User.Field = never>(fields: FieldCollector<'user', T, O>): Command<U | T, G, O> {
    this._userFields.push(fields)
    return this as any
  }

  channelFields<T extends Channel.Field = never>(fields: FieldCollector<'channel', T, O>): Command<U, G | T, O> {
    this._channelFields.push(fields)
    return this as any
  }

  alias(...names: string[]) {
    for (const name of names) {
      this._registerAlias(name)
    }
    return this
  }

  subcommand(rawName: string, config?: CommandConfig): Command
  subcommand(rawName: string, description: string, config?: CommandConfig): Command
  subcommand(rawName: string, ...args: [CommandConfig?] | [string, CommandConfig?]) {
    rawName = this.name + (rawName.charCodeAt(0) === 46 ? '' : '/') + rawName
    return this.context.command(rawName, ...args as any)
  }

  private _registerOption(name: string, def: string, config?: Partial<Domain.OptionDecl>) {
    const param = paramCase(name)
    const decl = def.replace(/(?<=^|\s)[\w\x80-\uffff].*/, '')
    const desc = def.slice(decl.length)
    let syntax = decl.replace(/(?<=^|\s)(<[^<]+>|\[[^[]+\]).*/, '')
    const bracket = decl.slice(syntax.length)
    syntax = syntax.trim() || '--' + param

    const names: string[] = []
    const symbols: string[] = []
    for (let param of syntax.trim().split(',')) {
      param = param.trimStart()
      const name = param.replace(/^-+/, '')
      if (!name || !param.startsWith('-')) {
        symbols.push(param)
      } else {
        names.push(name)
      }
    }

    if (!config.value && !names.includes(param)) {
      syntax += ', --' + param
    }

    const option = this._options[name] ||= {
      ...Command.defaultOptionConfig,
      ...config,
      name,
      values: {},
      description: syntax + '  ' + bracket + desc,
      greedy: bracket.includes('...'),
    }

    if ('value' in config) {
      names.forEach(name => option.values[name] = config.value)
    } else if (!bracket.trim()) {
      option.type = 'boolean'
    }

    this._assignOption(option, names, this._optionNameMap)
    this._assignOption(option, symbols, this._optionSymbolMap)
    if (!this._optionNameMap[param]) {
      this._optionNameMap[param] = option
    }

    return this
  }

  private _assignOption(option: Domain.OptionDecl, names: readonly string[], optionMap: Record<string, Domain.OptionDecl>) {
    for (const name of names) {
      if (name in optionMap) {
        throw new Error(format('duplicate option names: "%s"', name))
      }
      optionMap[name] = option
    }
  }

  /* eslint-disable max-len */
  option<K extends string>(name: K, desc: string, config: StringOptionConfig, action?: CommandAction<U, G, Extend<O, K, string>>): Command<U, G, Extend<O, K, string>>
  option<K extends string>(name: K, desc: string, config: NumberOptionConfig, action?: CommandAction<U, G, Extend<O, K, number>>): Command<U, G, Extend<O, K, number>>
  option<K extends string>(name: K, desc: string, config: BooleanOptionConfig, action?: CommandAction<U, G, Extend<O, K, boolean>>): Command<U, G, Extend<O, K, boolean>>
  option<K extends string>(name: K, desc: string, config?: Domain.OptionConfig, action?: CommandAction<U, G, Extend<O, K, any>>): Command<U, G, Extend<O, K, any>>
  option<K extends string>(name: K, desc: string, config: Domain.OptionConfig = {}, action?: CommandAction<U, G, Extend<O, K, any>>) {
    const fallbackType = typeof config.fallback as never
    const type = config['type'] || supportedType.includes(fallbackType) && fallbackType
    if (action) {
      this.before(async (session) => {
        const { options, args } = session.$argv
        if (options[name as any]) return action.call(this as any, { ...session.$argv, command: this as any }, ...args)
      })
    }
    return this._registerOption(name, desc, { ...config, type }) as any
  }
  /* eslint-enable max-len */

  removeOption<K extends string & keyof O>(name: K) {
    if (!this._options[name]) return false
    const option = this._options[name]
    delete this._options[name]
    for (const key in this._optionNameMap) {
      if (this._optionNameMap[key] === option) {
        delete this._optionNameMap[key]
      }
    }
    for (const key in this._optionSymbolMap) {
      if (this._optionSymbolMap[key] === option) {
        delete this._optionSymbolMap[key]
      }
    }
    return true
  }

  action(callback: CommandAction<U, G, O>) {
    this._action = callback
    return this
  }

  parse(argv: Argv): Argv {
    const args: string[] = []
    const options: Record<string, any> = {}
    const source = this.name + ' ' + Argv.stringify(argv)

    const handleOption = (name: string, value: any) => {
      const config = this._optionNameMap[name]
      if (config) {
        options[config.name] = name in config.values ? config.values[name] : value
      } else {
        options[camelCase(name)] = value
      }
    }

    while (argv.tokens.length) {
      const token = argv.tokens[0]
      let { content, quoted } = token

      // greedy argument
      if (content[0] !== '-' && this._arguments[args.length]?.greedy) {
        args.push(Argv.stringify(argv))
        break
      }

      // parse token
      argv.tokens.shift()
      let option: Domain.OptionDecl
      let names: string | string[]
      let param: string
      // symbolic option
      if (!quoted && (option = this._optionSymbolMap[content])) {
        names = [paramCase(option.name)]
      } else {
        // normal argument
        if (content[0] !== '-' || quoted) {
          args.push(content)
          continue
        }

        // find -
        let i = 0
        let name: string
        for (; i < content.length; ++i) {
          if (content.charCodeAt(i) !== 45) break
        }
        if (content.slice(i, i + 3) === 'no-' && !this._optionNameMap[content.slice(i)]) {
          name = content.slice(i + 3)
          handleOption(name, false)
          continue
        }

        // find =
        let j = i + 1
        for (; j < content.length; j++) {
          if (content.charCodeAt(j) === 61) break
        }
        name = content.slice(i, j)
        names = i > 1 ? [name] : name
        param = content.slice(++j)
        option = this._optionNameMap[names[names.length - 1]]
      }

      // get parameter from next token
      quoted = false
      if (!param) {
        const { greedy, type } = option || {}
        if (greedy) {
          param = Argv.stringify(argv)
          quoted = true
          argv.tokens = []
        } else if (type !== 'boolean' && (type || argv.tokens[0]?.content !== '-')) {
          const token = argv.tokens.shift()
          param = token.content
          quoted = token.quoted
        }
      }

      // handle each name
      for (let j = 0; j < names.length; j++) {
        const name = names[j]
        const config = this._optionNameMap[name]
        const value = Domain.parseValue(j + 1 < names.length ? '' : param, quoted, config)
        handleOption(name, value)
      }
    }

    // assign default values
    for (const { name, fallback } of Object.values(this._options)) {
      if (fallback !== undefined && !(name in options)) {
        options[name] = fallback
      }
    }

    delete argv.tokens
    return { options, args, source }
  }

  private stringifyArg(value: any) {
    value = '' + value
    return value.includes(' ') ? `"${value}"` : value
  }

  stringify(args: readonly string[], options: any) {
    let output = this.name
    for (const key in options) {
      const value = options[key]
      if (value === true) {
        output += ` --${key}`
      } else if (value === false) {
        output += ` --no-${key}`
      } else {
        output += ` --${key} ${this.stringifyArg(value)}`
      }
    }
    for (const arg of args) {
      output += ' ' + this.stringifyArg(arg)
    }
    return output
  }

  async execute(argv0: Argv<U, G, O>, next: NextFunction = noop): Promise<string> {
    const argv = argv0 as Argv<U, G, O>
    if (!argv.args) argv.args = []
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
    this.context.emit('remove-command', this)
    this._aliases.forEach(name => delete this.app._commandMap[name])
    const index = this.app._commands.indexOf(this)
    this.app._commands.splice(index, 1)
    if (this.parent) {
      const index = this.parent.children.indexOf(this)
      this.parent.children.splice(index, 1)
    }
  }
}
