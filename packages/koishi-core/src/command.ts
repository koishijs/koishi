import { Context, NextFunction } from './context'
import { User, Group, Tables, TableType } from './database'
import { noop, camelCase, paramCase, Logger, coerce, escapeRegExp } from 'koishi-utils'
import { Session } from './session'
import { inspect, format } from 'util'

const logger = new Logger('command')

const ANGLED_BRACKET_REGEXP = /<([^>]+)>/g
const SQUARE_BRACKET_REGEXP = /\[([^\]]+)\]/g

function parseBracket(name: string, required: boolean): CommandArgument {
  let variadic = false, greedy = false
  if (name.startsWith('...')) {
    name = name.slice(3)
    variadic = true
  } else if (name.endsWith('...')) {
    name = name.slice(0, -3)
    greedy = true
  }
  return {
    name,
    required,
    variadic,
    greedy,
  }
}

export interface CommandArgument {
  required: boolean
  variadic: boolean
  greedy: boolean
  name: string
}

export function parseArguments(source: string) {
  let capture: RegExpExecArray
  const result: CommandArgument[] = []
  while ((capture = ANGLED_BRACKET_REGEXP.exec(source))) {
    result.push(parseBracket(capture[1], true))
  }
  while ((capture = SQUARE_BRACKET_REGEXP.exec(source))) {
    result.push(parseBracket(capture[1], false))
  }
  return result
}

const supportedType = ['string', 'number', 'boolean'] as const

export type OptionType = typeof supportedType[number]

export interface OptionConfig<T = any> {
  value?: T
  fallback?: T
}

type StringOptionConfig = OptionConfig & ({ fallback: string } | { type: 'string' })
type NumberOptionConfig = OptionConfig & ({ fallback: number } | { type: 'number' })
type BooleanOptionConfig = OptionConfig & ({ fallback: boolean } | { type: 'boolean' })

export interface CommandOption extends OptionConfig {
  name: string
  description: string
  greedy: boolean
  type?: OptionType
  values?: Record<string, any>
}

interface ParsedArg {
  rest: string
  content: string
  quoted: boolean
}

const quoteStart = `"'“‘`
const quoteEnd = `"'”’`

export interface ParsedLine<O extends {} = {}> {
  source?: string
  rest: string
  args: string[]
  options: O
}

export interface ParsedArgv<U extends User.Field = never, G extends Group.Field = never, O extends {} = {}>
extends Partial<ParsedLine<O>> {
  command: Command<U, G, O>
  session: Session<U, G, O>
  next?: NextFunction
}

export interface ExecuteArgv extends Partial<ParsedLine> {
  command: string | Command
  next?: NextFunction
}

export interface CommandConfig<U extends User.Field = never, G extends Group.Field = never> {
  /** description */
  description?: string
}

type Extend<O extends {}, K extends string, T> = {
  [P in K | keyof O]?: (P extends keyof O ? O[P] : unknown) & (P extends K ? T : unknown)
}

export type FieldCollector<T extends TableType, K = keyof Tables[T], O extends {} = {}> =
  | Iterable<K>
  | ((argv: ParsedArgv<never, never, O>, fields: Set<keyof Tables[T]>) => void)

export type CommandAction<U extends User.Field = never, G extends Group.Field = never, O extends {} = {}> =
  (this: Command<U, G, O>, argv: ParsedArgv<U, G, O>, ...args: string[]) => void | string | Promise<void | string>

export class Command<U extends User.Field = never, G extends Group.Field = never, O extends {} = {}> {
  config: CommandConfig<U, G>
  children: Command[] = []
  parent: Command = null

  _aliases: string[] = []
  _arguments: CommandArgument[]
  _options: Record<string, CommandOption> = {}

  private _optionNameMap: Record<string, CommandOption> = {}
  private _optionSymbolMap: Record<string, CommandOption> = {}
  private _userFields: FieldCollector<'user'>[] = []
  private _groupFields: FieldCollector<'group'>[] = []

  _action?: CommandAction<U, G, O>

  static defaultConfig: CommandConfig = {}
  static defaultOptionConfig: OptionConfig = {}

  private static _userFields: FieldCollector<'user'>[] = []
  private static _groupFields: FieldCollector<'group'>[] = []

  static userFields(fields: FieldCollector<'user'>) {
    this._userFields.push(fields)
    return this
  }

  static groupFields(fields: FieldCollector<'group'>) {
    this._groupFields.push(fields)
    return this
  }

  static collect<T extends TableType>(argv: ParsedArgv, key: T, fields = new Set<keyof Tables[T]>()) {
    if (!argv) return
    const values: FieldCollector<T>[] = [
      ...this[`_${key}Fields`],
      ...argv.command[`_${key}Fields`],
    ]
    for (const value of values) {
      if (typeof value === 'function') {
        value(argv, fields)
        continue
      }
      for (const field of value) {
        fields.add(field)
      }
    }
    return fields
  }

  constructor(public name: string, public declaration: string, public context: Context, config: CommandConfig = {}) {
    if (!name) throw new Error('expect a command name')
    this._arguments = parseArguments(declaration)
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

  groupFields<T extends Group.Field = never>(fields: FieldCollector<'group', T, O>): Command<U, G | T, O> {
    this._groupFields.push(fields)
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

  private _registerOption(name: string, def: string, config?: Partial<CommandOption>) {
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

    const option = this._options[name] || (this._options[name] = {
      ...Command.defaultOptionConfig,
      ...config,
      name,
      values: {},
      description: syntax + '  ' + bracket + desc,
      greedy: bracket.includes('...'),
    })

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

  private _assignOption(option: CommandOption, names: readonly string[], optionMap: Record<string, CommandOption>) {
    for (const name of names) {
      if (name in optionMap) {
        throw new Error(format('duplicate option names: "%s"', name))
      }
      optionMap[name] = option
    }
  }

  option<K extends string>(name: K, desc: string, config: StringOptionConfig): Command<U, G, Extend<O, K, string>>
  option<K extends string>(name: K, desc: string, config: NumberOptionConfig): Command<U, G, Extend<O, K, number>>
  option<K extends string>(name: K, desc: string, config: BooleanOptionConfig): Command<U, G, Extend<O, K, boolean>>
  option<K extends string>(name: K, desc: string, config?: OptionConfig): Command<U, G, Extend<O, K, any>>
  option<K extends string>(name: K, desc: string, config: OptionConfig = {}) {
    const fallbackType = typeof config.fallback as never
    const type = config['type'] || supportedType.includes(fallbackType) && fallbackType
    return this._registerOption(name, desc, { ...config, type }) as any
  }

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

  private parseArg(source: string, terminator: string): ParsedArg {
    const index = quoteStart.indexOf(source[0])
    if (index >= 0) {
      const capture = new RegExp(`${quoteEnd[index]}(?=[\\s${terminator}]|$)`).exec(source.slice(1))
      if (capture) {
        return {
          quoted: true,
          content: source.slice(1, 1 + capture.index),
          rest: source.slice(2 + capture.index).trimLeft(),
        }
      }
    }

    const [content] = source.split(new RegExp(`[\\s${terminator}]`), 1)
    return {
      content,
      quoted: false,
      rest: source.slice(content.length).trimLeft(),
    }
  }

  private parseRest(source: string, terminator: string): ParsedArg {
    const index = quoteStart.indexOf(source[0])
    if (index >= 0) {
      const capture = terminator
        ? new RegExp(`${quoteEnd[index]}(?=[${terminator}]|$)`).exec(source.slice(1))
        : new RegExp(`${quoteEnd[index]}(?=$)`).exec(source.slice(1))
      if (capture) {
        return {
          quoted: true,
          content: source.slice(1, 1 + capture.index),
          rest: source.slice(2 + capture.index).trimLeft(),
        }
      }
    }

    const [content] = terminator ? source.split(new RegExp(`[${terminator}]`), 1) : [source]
    return {
      content,
      quoted: false,
      rest: source.slice(content.length).trimLeft(),
    }
  }

  private parseValue(source: string | true, quoted: boolean, { type, fallback } = {} as CommandOption) {
    // quoted empty string
    if (source === '' && quoted) return ''
    // no explicit parameter
    if (source === true || source === '') {
      if (fallback !== undefined) return fallback
      if (type === 'string') return ''
      return true
    }
    // default behavior
    if (type === 'number') return +source
    if (type === 'string') return source
    const n = +source
    return n * 0 === 0 ? n : source
  }

  parse(message: string, terminator = ''): ParsedLine {
    let rest = ''
    terminator = escapeRegExp(terminator)
    const source = `${this.name} ${message}`
    const args: string[] = []
    const options: Record<string, any> = {}

    const handleOption = (name: string, value: any) => {
      const config = this._optionNameMap[name]
      if (config) {
        options[config.name] = name in config.values ? config.values[name] : value
      } else {
        options[camelCase(name)] = value
      }
    }

    while (message) {
      if (terminator.includes(message[0])) {
        rest = message
        break
      }

      // greedy argument
      if (message[0] !== '-' && this._arguments[args.length]?.greedy) {
        const arg0 = this.parseRest(message, terminator)
        args.push(arg0.content)
        rest = arg0.rest
        break
      }

      // parse arg0
      let arg0 = this.parseArg(message, terminator)
      const arg = arg0.content
      message = arg0.rest

      let option: CommandOption
      let names: string | string[]
      let param: string
      if (!arg0.quoted && (option = this._optionSymbolMap[arg])) {
        names = [option.name]
      } else {
        // normal argument
        if (arg[0] !== '-' || arg0.quoted) {
          args.push(arg)
          continue
        }

        // find -
        let i = 0
        let name: string
        for (; i < arg.length; ++i) {
          if (arg.charCodeAt(i) !== 45) break
        }
        if (arg.slice(i, i + 3) === 'no-' && !this._optionNameMap[arg.slice(i)]) {
          name = arg.slice(i + 3)
          handleOption(name, false)
          continue
        }

        // find =
        let j = i + 1
        for (; j < arg.length; j++) {
          if (arg.charCodeAt(j) === 61) break
        }
        name = arg.slice(i, j)
        names = i > 1 ? [name] : name
        param = arg.slice(++j)
        option = this._optionNameMap[names[names.length - 1]]
      }

      // get parameter
      let quoted = false
      if (!param) {
        const { greedy, type } = option || {}
        if (greedy) {
          arg0 = this.parseRest(arg0.rest, terminator)
          param = arg0.content
          quoted = arg0.quoted
          rest = arg0.rest
          message = ''
        } else if (type !== 'boolean' && (type || message[0] !== '-')) {
          arg0 = this.parseArg(message, terminator)
          param = arg0.content
          quoted = arg0.quoted
          message = arg0.rest
        }
      }

      // handle each name
      for (let j = 0; j < names.length; j++) {
        const name = names[j]
        const config = this._optionNameMap[name]
        const value = this.parseValue(j + 1 < names.length || param, quoted, config)
        handleOption(name, value)
      }
    }

    // assign default values
    for (const { name, fallback } of Object.values(this._options)) {
      if (fallback !== undefined && !(name in options)) {
        options[name] = fallback
      }
    }

    return { rest, options, args, source }
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

  async execute(argv: ParsedArgv<U, G, O>) {
    argv.command = this
    if (!argv.options) argv.options = {} as any
    if (!argv.args) argv.args = []
    if (!argv.rest) argv.rest = ''

    let state = 'before command'
    const { next = noop } = argv
    argv.next = async (fallback) => {
      const oldState = state
      state = ''
      await next(fallback)
      state = oldState
    }

    let { args, options, session, source } = argv
    const getSource = () => source || (source = this.stringify(args, options))
    if (logger.level >= 3) logger.debug(getSource())
    const lastCall = this.app.options.prettyErrors && new Error().stack.split('\n', 4)[3]
    try {
      const result = await this.app.serial(session, 'before-command', argv)
      if (typeof result === 'string') return session.$send(result)
      state = 'executing command'
      const message = await this._action(argv, ...args)
      if (message) await session.$send(message)
      state = 'after command'
      await this.app.serial(session, 'command', argv)
    } catch (error) {
      if (!state) throw error
      let stack = coerce(error)
      if (lastCall) {
        const index = error.stack.indexOf(lastCall)
        stack = stack.slice(0, index - 1)
      }
      logger.warn(`${state}: ${getSource()}\n${stack}`)
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
