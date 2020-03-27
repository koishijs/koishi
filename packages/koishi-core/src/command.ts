import { Context, NextFunction } from './context'
import { UserData, UserField, GroupField } from './database'
import { errors } from './shared'
import { noop, camelCase } from 'koishi-utils'
import { Meta } from './meta'
import { inspect, format } from 'util'

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
  names: string[]
  camels: string[]
  aliases: string[]
  negated: string[]
  required: boolean
  isBoolean: boolean
  description: string
}

interface ParsedArg0 {
  rest: string
  content: string
  quoted: boolean
}

function parseArg0 (source: string): ParsedArg0 {
  const char0 = source[0]
  if (char0 === '"' || char0 === "'" || char0 === '“' || char0 === '”' || char0 === '‘' || char0 === '’') {
    const [content] = source.slice(1).split(/["'“”‘’](?=\s|$)/, 1)
    return {
      content,
      quoted: true,
      rest: source.slice(2 + content.length).trimLeft(),
    }
  }

  const [content] = source.split(/\s/, 1)
  return {
    content,
    quoted: false,
    rest: source.slice(content.length).trimLeft(),
  }
}

export function parseValue (source: string | true, quoted: boolean, config = {} as CommandOption) {
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

export interface ParsedLine {
  rest: string
  args: string[]
  unknown: string[]
  options: Record<string, any>
}

export interface ParsedCommandLine extends Partial<ParsedLine> {
  meta: Meta<'message'>
  command?: Command
  next?: NextFunction
}

export type UserType <T> = T | ((user: UserData) => T)

export interface CommandConfig {
  /** description */
  description?: string
  /** min authority */
  authority?: number
  /** whether to disable */
  disable?: UserType<boolean>
}

export interface ShortcutConfig {
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

type ArgvInferred <T> = T | ((argv: ParsedCommandLine) => T)

export class Command {
  config: CommandConfig
  children: Command[] = []
  parent: Command = null

  _aliases: string[] = []
  _arguments: CommandArgument[]
  _options: CommandOption[] = []
  _shortcuts: Record<string, ShortcutConfig> = {}

  private _optionMap: Record<string, CommandOption> = {}
  private _optionAliasMap: Record<string, CommandOption> = {}
  private _userFields: ArgvInferred<Iterable<UserField>>[] = []
  private _groupFields: ArgvInferred<Iterable<GroupField>>[] = []

  _action?: (this: this, config: ParsedCommandLine, ...args: string[]) => any

  static defaultConfig: CommandConfig = {
    authority: 1,
  }

  static defaultOptionConfig: OptionConfig = {
    authority: 0,
  }

  static attachUserFields (meta: Meta<'message'>, fields: Set<UserField>) {
    if (!meta.$argv) return
    for (const item of meta.$argv.command._userFields) {
      for (const field of typeof item === 'function' ? item(meta.$argv) : item) {
        fields.add(field)
      }
    }
  }

  static attachGroupFields (meta: Meta<'message'>, fields: Set<GroupField>) {
    if (!meta.$argv) return
    for (const item of meta.$argv.command._groupFields) {
      for (const field of typeof item === 'function' ? item(meta.$argv) : item) {
        fields.add(field)
      }
    }
  }

  constructor (public name: string, public declaration: string, public context: Context, config: CommandConfig = {}) {
    if (!name) throw new Error(errors.EXPECT_COMMAND_NAME)
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
      throw new Error(format(errors.DUPLICATE_COMMAND, name))
    }
  }

  [inspect.custom] () {
    return `Command <${this.name}>`
  }

  userFields (fields: ArgvInferred<Iterable<UserField>>) {
    this._userFields.push(fields)
    return this
  }

  groupFields (fields: ArgvInferred<Iterable<GroupField>>) {
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

  shortcut (name: string, config: ShortcutConfig = {}) {
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

    let required = false, isBoolean = false, longest = ''
    const names: string[] = [], aliases: string[] = []
    const rawName = removeBrackets(fullName)
    for (let name of rawName.split(',')) {
      name = name.trim()
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
  
    const option: CommandOption = {
      ...Command.defaultOptionConfig,
      ...config,
      fullName,
      rawName,
      longest,
      names,
      aliases,
      camels,
      negated,
      required,
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
        throw new Error(format(errors.DUPLICATE_OPTION, name))
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

  action (callback: (this: this, options: ParsedCommandLine, ...args: string[]) => any) {
    this._action = callback
    return this
  }

  getConfig <K extends keyof CommandConfig> (key: K, meta: Meta<'message'>): Exclude<CommandConfig[K], (user: UserData) => any> {
    const value = this.config[key] as any
    return typeof value === 'function' ? value(meta.$user) : value
  }

  parse (source: string) {
    let rest = ''
    const args: string[] = []
    const unknown: string[] = []
    const options: Record<string, any> = {}

    const handleOption = (name: string, knownValue: any, unknownValue: any) => {
      const config = this._optionMap[name]
      if (config) {
        for (const alias of config.camels) {
          options[alias] = !config.negated.includes(alias) && knownValue
        }
      } else {
        // unknown option name
        options[camelCase(name)] = unknownValue
        if (!unknown.includes(name)) {
          unknown.push(name)
        }
      }
    }

    while (source) {
      // long argument
      if (source[0] !== '-' && this._arguments[args.length]?.noSegment) {
        args.push(source)
        break
      }

      // parse argv0
      let arg0 = parseArg0(source)
      let arg = arg0.content
      source = arg0.rest

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
  
        // rest part
        if (arg === '--') {
          rest = arg0.rest
          break
        }

        // find -
        let i = 0
        let name: string
        for (; i < arg.length; ++i) {
          if (arg.charCodeAt(i) !== 45) break
        }
        if (arg.slice(i, i + 3) === 'no-') {
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
      if (!param && source.charCodeAt(0) !== 45 && (!option || !option.isBoolean)) {
        arg0 = parseArg0(source)
        param = arg0.content
        quoted = arg0.quoted
        source = arg0.rest
      }

      // handle each name
      for (let j = 0; j < names.length; j++) {
        const name = names[j]
        const config = this._optionMap[name]
        const value = parseValue(j + 1 < names.length || param, quoted, config)
        handleOption(name, value, value)
      }
    }

    // assign default values
    for (const name in this._optionMap) {
      if (this._optionMap[name].default !== undefined && !(name in options)) {
        options[name] = this._optionMap[name].default
      }
    }

    return { options, rest, unknown, args } as ParsedLine
  }

  async execute (argv: ParsedCommandLine, next: NextFunction = noop) {
    argv.command = this
    if (!argv.options) argv.options = {}
    if (!argv.args) argv.args = []
    if (!argv.unknown) {
      argv.unknown = Object.keys(argv.options).filter(key => !this._optionMap[key])
    }

    if (await this.app.serialize(argv.meta, 'before-command', argv)) return

    // execute command
    this.context.logger('koishi:command').debug('execute %s', this.name)
    await this.app.parallelize(argv.meta, 'command', argv)

    let skipped = false
    argv.next = async (_next) => {
      skipped = true
      await this.app.parallelize(argv.meta, 'after-command', argv)
      return next(_next)
    }

    try {
      await this._action(argv, ...argv.args)
    } catch (error) {
      this.context.logger('').warn(error)
    }
    if (!skipped) {
      return this.app.parallelize(argv.meta, 'after-command', argv)
    }
  }

  end () {
    return this.context
  }
}
