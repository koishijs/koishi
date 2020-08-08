import { Context, NextFunction } from './context'
import { User, Group, Tables, TableType } from './database'
import { noop, camelCase } from 'koishi-utils'
import { Session } from './session'
import { inspect, format, types } from 'util'
import escapeRegex from 'escape-string-regexp'

const ANGLED_BRACKET_REGEXP = /<([^>]+)>/g
const SQUARE_BRACKET_REGEXP = /\[([^\]]+)\]/g

export function removeBrackets (source: string) {
  return source.replace(/(<[^<]+>|\[[^[]+\]).*/, '').trim()
}

function parseBracket (name: string, required: boolean): CommandArgument {
  let variadic = false, noSegment = false
  if (name.startsWith('...')) {
    name = name.slice(3)
    variadic = true
  } else if (name.endsWith('...')) {
    name = name.slice(0, -3)
    noSegment = true
  }
  return {
    name,
    required,
    variadic,
    noSegment,
  }
}

export interface CommandArgument {
  required: boolean
  variadic: boolean
  noSegment: boolean
  name: string
}

export function parseArguments (source: string) {
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

export interface OptionConfig {
  default?: any
  authority?: number
  notUsage?: boolean
  isString?: boolean
  noNegated?: boolean
}

export interface CommandOption extends OptionConfig {
  fullName: string
  rawName: string
  longest: string
  shortest: string
  names: string[]
  camels: string[]
  aliases: string[]
  negated: string[]
  required: boolean
  isBoolean: boolean
  noSegment: boolean
  description: string
}

interface ParsedArg {
  rest: string
  content: string
  quoted: boolean
}

const quoteStart = `"'“‘`
const quoteEnd = `"'”’`

export interface ParsedLine {
  source?: string
  rest: string
  args: string[]
  options: Record<string, any>
}

export interface ParsedArgv <U extends User.Field = never, G extends Group.Field = never> extends Partial<ParsedLine> {
  command: Command<U, G>
  session: Session<U, G>
  next?: NextFunction
}

export interface ExecuteArgv extends Partial<ParsedLine> {
  command: string | Command
  next?: NextFunction
}

export interface CommandConfig <U extends User.Field = never, G extends Group.Field = never> {
  /** description */
  description?: string
  /** min authority */
  authority?: number
}

type ArgvInferred <T> = Iterable<T> | ((argv: ParsedArgv, fields: Set<T>) => Iterable<T>)
export type CommandAction <U extends User.Field = never, G extends Group.Field = never> =
  (this: Command<U, G>, config: ParsedArgv<U, G>, ...args: string[]) => void | string | Promise<void | string>

export class Command <U extends User.Field = never, G extends Group.Field = never> {
  config: CommandConfig<U, G>
  children: Command[] = []
  parent: Command = null

  _aliases: string[] = []
  _arguments: CommandArgument[]
  _options: CommandOption[] = []

  private _optionMap: Record<string, CommandOption> = {}
  private _optionAliasMap: Record<string, CommandOption> = {}
  private _userFields: ArgvInferred<User.Field>[] = []
  private _groupFields: ArgvInferred<Group.Field>[] = []

  _action?: CommandAction<U, G>

  static defaultConfig: CommandConfig = {
    authority: 1,
  }

  static defaultOptionConfig: OptionConfig = {
    authority: 0,
  }

  private static _userFields: ArgvInferred<User.Field>[] = []
  private static _groupFields: ArgvInferred<Group.Field>[] = []

  static userFields (fields: ArgvInferred<User.Field>) {
    this._userFields.push(fields)
    return this
  }

  static groupFields (fields: ArgvInferred<Group.Field>) {
    this._groupFields.push(fields)
    return this
  }

  static collect <T extends TableType> (argv: ParsedArgv, key: T, fields = new Set<keyof Tables[T]>()) {
    if (!argv) return
    const values: ArgvInferred<keyof Tables[T]>[] = [
      ...this[`_${key}Fields`],
      ...argv.command[`_${key}Fields`],
    ]
    for (let value of values) {
      if (typeof value === 'function') {
        value = value(argv, fields)
      }
      for (const field of value) {
        fields.add(field)
      }
    }
    return fields
  }

  constructor (public name: string, public declaration: string, public context: Context, config: CommandConfig = {}) {
    if (!name) throw new Error('expect a command name')
    this._arguments = parseArguments(declaration)
    this.config = { ...Command.defaultConfig, ...config }
    this._registerAlias(this.name)
    context.app._commands.push(this)
    context.app.emit('new-command', this)
  }

  get app () {
    return this.context.app
  }

  private _registerAlias (name: string) {
    name = name.toLowerCase()
    this._aliases.push(name)
    const previous = this.app._commandMap[name]
    if (!previous) {
      this.app._commandMap[name] = this
    } else if (previous !== this) {
      throw new Error(format('duplicate command names: "%s"', name))
    }
  }

  [inspect.custom] () {
    return `Command <${this.name}>`
  }

  userFields <T extends User.Field = never> (fields: Iterable<T>): Command<U | T, G>
  userFields <T extends User.Field = never> (fields: (argv: ParsedArgv, fields: Set<User.Field>) => Iterable<T>): Command<U | T, G>
  userFields (fields: ArgvInferred<User.Field>) {
    this._userFields.push(fields)
    return this
  }

  groupFields <T extends Group.Field = never> (fields: Iterable<T>): Command<U, G | T>
  groupFields <T extends Group.Field = never> (fields: (argv: ParsedArgv, fields: Set<Group.Field>) => Iterable<T>): Command<U, G | T>
  groupFields (fields: ArgvInferred<Group.Field>) {
    this._groupFields.push(fields)
    return this
  }

  alias (...names: string[]) {
    for (const name of names) {
      this._registerAlias(name)
    }
    return this
  }

  subcommand (rawName: string, config?: CommandConfig): Command
  subcommand (rawName: string, description: string, config?: CommandConfig): Command
  subcommand (rawName: string, ...args: [CommandConfig?] | [string, CommandConfig?]) {
    rawName = this.name + (rawName.charCodeAt(0) === 46 ? '' : '/') + rawName
    return this.context.command(rawName, ...args as any)
  }

  /**
   * Add a option for this command
   * @param fullName raw option name(s)
   * @param description option description
   * @param config option config
   */
  option (fullName: string, config?: OptionConfig): this
  option (fullName: string, description: string, config?: OptionConfig): this
  option (fullName: string, ...args: [OptionConfig?] | [string, OptionConfig?]) {
    const description = typeof args[0] === 'string' ? args.shift() as string : undefined
    const config = args[0] as OptionConfig || {}
    const negated: string[] = []
    const camels: string[] = []

    let required = false, isBoolean = false, longest = '', shortest = ''
    const names: string[] = [], aliases: string[] = []
    const rawName = removeBrackets(fullName)
    for (let name of rawName.split(',')) {
      name = name.trim()
      if (!shortest || name.length < shortest.length) shortest = name
      if (name && !name.startsWith('-')) {
        aliases.push(name)
        continue
      }

      name = name.replace(/^-{1,2}/, '')
      let camel: string
      if (name.startsWith('no-') && !config.noNegated && !this._optionMap[name.slice(3)]) {
        name = name.slice(3)
        camel = camelCase(name)
        negated.push(camel)
      } else {
        camel = camelCase(name)
      }
      camels.push(camel)
      if (camel.length > longest.length) longest = camel
      names.push(name)
    }

    const brackets = fullName.slice(rawName.length)
    if (brackets.includes('<')) {
      required = true
    } else if (!brackets.includes('[')) {
      isBoolean = true
    }
    const noSegment = brackets.includes('...')

    const option: CommandOption = {
      ...Command.defaultOptionConfig,
      ...config,
      fullName,
      rawName,
      longest,
      shortest,
      names,
      aliases,
      camels,
      negated,
      required,
      noSegment,
      isBoolean,
      description,
    }

    this._options.push(option)
    this._registerOption(option, names, this._optionMap)
    this._registerOption(option, aliases, this._optionAliasMap)
    return this
  }

  private _registerOption (option: CommandOption, names: string[], optionMap: Record<string, CommandOption>) {
    for (const name of names) {
      if (name in optionMap) {
        throw new Error(format('duplicate option names: "%s"', name))
      }
      optionMap[name] = option
    }
  }

  removeOption (name: string) {
    name = name.replace(/^-+/, '')
    const option = this._optionMap[name]
    if (!option) return false
    for (const name of option.names) {
      delete this._optionMap[name]
    }
    const index = this._options.indexOf(option)
    this._options.splice(index, 1)
    return true
  }

  action (callback: CommandAction<U, G>) {
    this._action = callback
    return this
  }

  /**
   * some examples:
   * - `foo bar baz` -> `foo` + `bar baz`
   * - `"foo bar" baz` -> `foo bar` + `baz`
   * - `"foo bar "baz` -> `"foo` + `bar "baz`
   * - `foo" bar" baz` -> `foo"` + `bar" baz`
   * - `foo;bar baz` -> `foo` + `;bar baz`
   * - `"foo;bar";baz` -> `foo;bar` + `;baz`
   */
  private parseArg (source: string, terminator: string): ParsedArg {
    const quoteIndex = quoteStart.indexOf(source[0])
    if (quoteIndex >= 0) {
      const capture = new RegExp(`${quoteEnd[quoteIndex]}(?=[\\s${escapeRegex(terminator)}]|$)`).exec(source.slice(1))
      if (capture) {
        return {
          quoted: true,
          content: source.slice(1, 1 + capture.index),
          rest: source.slice(2 + capture.index).trimLeft(),
        }
      }
    }

    const [content] = source.split(new RegExp(`[\\s${escapeRegex(terminator)}]`), 1)
    return {
      content,
      quoted: false,
      rest: source.slice(content.length).trimLeft(),
    }
  }

  /**
   * some examples:
   * - `foo bar baz` -> `foo bar baz` + ` `
   * - `"foo bar" baz` -> `"foo bar" baz` + ` `
   * - `"foo bar baz"` -> `foo bar baz` + ` `
   * - `foo;bar baz` -> `foo` + `bar baz`
   * - `"foo;bar" baz` -> `"foo` + `bar" baz`
   * - `"foo;bar";baz` -> `foo;bar` + `baz`
   */
  private parseRest (source: string, terminator: string): ParsedArg {
    const quoteIndex = quoteStart.indexOf(source[0])
    if (quoteIndex >= 0) {
      const index = terminator && source.slice(1).indexOf(quoteEnd[quoteIndex] + terminator)
      if (index >= 0) {
        return {
          quoted: true,
          content: source.slice(1, index + 1),
          rest: source.slice(index + 3).trimLeft(),
        }
      } else if (source.endsWith(quoteEnd[quoteIndex])) {
        return {
          quoted: true,
          content: source.slice(1, -1),
          rest: '',
        }
      }
    }

    // TODO multiple terminators
    const [content] = terminator ? source.split(terminator, 1) : [source]
    return {
      content,
      quoted: false,
      rest: source.slice(content.length + 1).trimLeft(),
    }
  }

  private parseValue (source: string | true, quoted: boolean, config = {} as CommandOption) {
    // quoted empty string
    if (source === '' && quoted) return ''
    // no explicit parameter
    if (source === true || source === '') {
      if (config.default !== undefined) return config.default
      if (config.isString) return ''
      return true
    }
    // default behavior
    if (config.isString) return source
    const n = +source
    return n * 0 === 0 ? n : source
  }

  parse (message: string, terminator = ''): ParsedLine {
    let rest = ''
    const source = `${this.name} ${message}`
    const args: string[] = []
    const options: Record<string, any> = {}

    const handleOption = (name: string, knownValue: any, unknownValue: any) => {
      const config = this._optionMap[name]
      if (config) {
        for (const alias of config.camels) {
          options[alias] = !config.negated.includes(alias) && knownValue
        }
      } else {
        options[camelCase(name)] = unknownValue
      }
    }

    while (message) {
      // long argument
      if (message[0] !== '-' && this._arguments[args.length]?.noSegment) {
        const arg0 = this.parseRest(message, terminator)
        args.push(arg0.content)
        rest = arg0.rest
        break
      }

      // parse argv0
      let arg0 = this.parseArg(message, terminator)
      const arg = arg0.content
      message = arg0.rest

      let option = this._optionAliasMap[arg]
      let names: string | string[]
      let param: any
      if (option && !arg0.quoted) {
        names = [option.names[0]]
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
        if (arg.slice(i, i + 3) === 'no-' && !this._optionMap[arg.slice(i)]) {
          name = arg.slice(i + 3)
          handleOption(name, true, false)
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
        option = this._optionMap[names[names.length - 1]]
      }

      // get parameter
      let quoted = false
      if (!param && option && option.noSegment) {
        arg0 = this.parseRest(arg0.rest, terminator)
        param = arg0.content
        rest = arg0.rest
        message = ''
      } else if (!param && message.charCodeAt(0) !== 45 && (!option || !option.isBoolean)) {
        arg0 = this.parseArg(message, terminator)
        param = arg0.content
        quoted = arg0.quoted
        message = arg0.rest
      }

      // handle each name
      for (let j = 0; j < names.length; j++) {
        const name = names[j]
        const config = this._optionMap[name]
        const value = this.parseValue(j + 1 < names.length || param, quoted, config)
        handleOption(name, value, value)
      }
    }

    // assign default values
    for (const name in this._optionMap) {
      if (this._optionMap[name].default !== undefined && !(name in options)) {
        options[name] = this._optionMap[name].default
      }
    }

    return { rest, options, args, source }
  }

  stringify (argv: ParsedArgv) {
    let output = this.name
    const optionSet = new Set<string>()
    for (let key in argv.options) {
      if (key === 'rest') {
        key = '--'
      } else if (key in this._optionMap) {
        key = this._optionMap[key].shortest
      }
      if (optionSet.has(key)) continue
      optionSet.add(key)
      const value = argv.options[key]
      if (value === true) {
        output += ` ${key}`
      } else {
        output += ` ${key} ${value}`
      }
    }
    for (const arg of argv.args) {
      output += arg.includes(' ') ? ` "${arg}"` : ` ${arg}`
    }
    return output
  }

  async execute (argv: ParsedArgv<U, G>) {
    argv.command = this
    if (!argv.options) argv.options = {}
    if (!argv.args) argv.args = []

    let state = 'before'
    const { next = noop } = argv
    argv.next = async (fallback) => {
      const oldState = state
      state = ''
      await next(fallback)
      state = oldState
    }

    const { source = this.stringify(argv) } = argv
    this.context.logger('command').debug(source)
    const lastCall = new Error().stack.split('\n', 4)[3]
    try {
      if (await this.app.serial(argv.session, 'before-command', argv)) return
      state = 'executing'
      const message = await this._action(argv, ...argv.args)
      if (message) argv.session.$send(message)
      state = 'after'
      await this.app.serial(argv.session, 'command', argv)
    } catch (error) {
      if (!state) throw error
      if (!types.isNativeError(error)) {
        error = new Error(error as any)
      }
      const index = error.stack.indexOf(lastCall)
      this.context.logger('command').warn(`${state}: ${source}\n${error.stack.slice(0, index - 1)}`)
    }
  }

  dispose () {
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
