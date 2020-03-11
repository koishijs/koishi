import { Context, NextFunction } from './context'
import { UserData, UserField, GroupField } from './database'
import { errors } from './messages'
import { noop, camelCase } from 'koishi-utils'
import { Meta } from './meta'

const ANGLED_BRACKET_REGEXP = /<([^>]+)>/g
const SQUARE_BRACKET_REGEXP = /\[([^\]]+)\]/g

export function removeBrackets (source: string) {
  return source.replace(/[<[].+/, '').trim()
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
  hidden?: boolean
  authority?: number
  notUsage?: boolean
  isString?: boolean
  noNegated?: boolean
}

export interface CommandOption extends OptionConfig {
  rawName: string
  longest: string
  names: string[]
  camels: string[]
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
  if (char0 === '"' || char0 === "'" || char0 === '“' || char0 === '”') {
    const [content] = source.slice(1).split(/["'“”](?=\s|$)/, 1)
    return {
      quoted: true,
      content,
      rest: source.slice(2 + content.length).trimLeft(),
    }
  }

  const [content] = source.split(/\s/, 1)
  return { content, quoted: false, rest: source.slice(content.length).trimLeft() }
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
  /** usage identifier */
  usageName?: string
  /** description */
  description?: string
  /** min authority */
  authority?: number
  disable?: UserType<boolean>
  maxUsage?: UserType<number>
  minInterval?: UserType<number>
}

export const defaultConfig: CommandConfig = {
  authority: 1,
  maxUsage: Infinity,
  minInterval: 0,
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

export enum CommandHint {
  USAGE_EXHAUSTED = 1,
  TOO_FREQUENT = 2,
  LOW_AUTHORITY = 4,
  INSUFFICIENT_ARGUMENTS = 8,
  REDUNANT_ARGUMENTS = 16,
  UNKNOWN_OPTIONS = 32,
  REQUIRED_OPTIONS = 64,
}

export class Command {
  config: CommandConfig
  children: Command[] = []
  parent: Command = null

  _aliases: string[] = []
  _options: CommandOption[] = []
  _shortcuts: Record<string, ShortcutConfig> = {}
  _userFields = new Set<UserField>()
  _groupFields = new Set<GroupField>()

  private _argsDef: CommandArgument[]
  private _optsDef: Record<string, CommandOption> = {}
  private _action?: (this: Command, config: ParsedCommandLine, ...args: string[]) => any

  static attachUserFields (meta: Meta<'message'>, userFields: Set<UserField>) {
    const { command, options = {} } = meta.$argv
    if (!command) return
    for (const field of command._userFields) {
      userFields.add(field)
    }

    const { maxUsage, minInterval, authority } = command.config
    let shouldFetchAuthority = !userFields.has('authority') && authority > 0
    let shouldFetchUsage = !userFields.has('usage') && (
      typeof maxUsage === 'number' && maxUsage < Infinity ||
      typeof minInterval === 'number' && minInterval > 0)
    for (const option of command._options) {
      if (option.camels[0] in options) {
        if (option.authority > 0) shouldFetchAuthority = true
        if (option.notUsage) shouldFetchUsage = false
      }
    }
    if (shouldFetchAuthority) userFields.add('authority')
    if (shouldFetchUsage) userFields.add('usage')
  }

  static attachGroupFields (meta: Meta<'message'>, groupFields: Set<GroupField>) {
    if (!meta.$argv.command) return
    for (const field of meta.$argv.command._groupFields) {
      groupFields.add(field)
    }
  }

  constructor (public name: string, public declaration: string, public context: Context, config: CommandConfig = {}) {
    if (!name) throw new Error(errors.EXPECT_COMMAND_NAME)
    this._argsDef = parseArguments(declaration)
    this.config = { ...defaultConfig, ...config }
    this._registerAlias(this.name)
    context.app._commands.push(this)
    context.app.parallelize('new-command', this)
  }

  get app () {
    return this.context.app
  }

  get usageName () {
    return this.config.usageName || this.name
  }

  private _registerAlias (name: string) {
    name = name.toLowerCase()
    this._aliases.push(name)
    const previous = this.app._commandMap[name]
    if (!previous) {
      this.app._commandMap[name] = this
    } else if (previous !== this) {
      throw new Error(errors.DUPLICATE_COMMAND)
    }
  }

  userFields (fields: Iterable<UserField>) {
    for (const field of fields) {
      this._userFields.add(field)
    }
    return this
  }

  groupFields (fields: Iterable<GroupField>) {
    for (const field of fields) {
      this._groupFields.add(field)
    }
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
   * @param rawName raw option name(s)
   * @param description option description
   * @param config option config
   */
  option (rawName: string, config?: OptionConfig): this
  option (rawName: string, description: string, config?: OptionConfig): this
  option (rawName: string, ...args: [OptionConfig?] | [string, OptionConfig?]) {
    const description = typeof args[0] === 'string' ? args.shift() as string : undefined
    const config = args[0] as OptionConfig || {}
    const negated: string[] = []
    const camels: string[] = []

    let required = false, isBoolean = false, longest = ''
    const names = removeBrackets(rawName).split(',').map((name: string) => {
      name = name.trim().replace(/^-{1,2}/, '')
      let camel: string
      if (name.startsWith('no-') && !config.noNegated && !this._optsDef[name.slice(3)]) {
        name = name.slice(3)
        camel = camelCase(name)
        negated.push(camel)
      } else {
        camel = camelCase(name)
      }
      camels.push(camel)
      if (camel.length > longest.length) longest = camel
      return name
    })
  
    if (rawName.includes('<')) {
      required = true
    } else if (!rawName.includes('[')) {
      isBoolean = true
    }
  
    const option: CommandOption = {
      authority: 0,
      ...config,
      rawName,
      longest,
      names,
      camels,
      negated,
      required,
      isBoolean,
      description,
    }

    this._options.push(option)
    for (const name of names) {
      if (name in this._optsDef) {
        throw new Error(errors.DUPLICATE_OPTION)
      }
      this._optsDef[name] = option
    }
    return this
  }

  removeOption (name: string) {
    name = name.replace(/^-+/, '')
    const option = this._optsDef[name]
    if (!option) return false
    for (const name of option.names) {
      delete this._optsDef[name]
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
    let arg: string, name: string, arg0: ParsedArg0, rest = ''
    const args: string[] = []
    const unknown: string[] = []
    const options: Record<string, any> = {}
  
    function handleOption (name: string, knownValue: any, unknownValue: any) {
      const config = this._optsDef[name]
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
      if (source[0] !== '-' && this._argsDef[args.length] && this._argsDef[args.length].noSegment) {
        args.push(source)
        break
      }
  
      // parse argv0
      arg0 = parseArg0(source)
      arg = arg0.content
      source = arg0.rest
      if (arg[0] !== '-' || arg0.quoted) {
        // normal argument
        args.push(arg)
        continue
      } else if (arg === '--') {
        // rest part
        rest = arg0.rest
        break
      }
  
      // find -
      let i = 0
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
      const names = i === 2 ? [name] : name
  
      // get parameter
      let quoted = false
      let param: any = arg.slice(++j)
      const lastConfig = this._optsDef[names[names.length - 1]]
      if (!param && source.charCodeAt(0) !== 45 && (!lastConfig || !lastConfig.isBoolean)) {
        arg0 = parseArg0(source)
        param = arg0.content
        quoted = arg0.quoted
        source = arg0.rest
      }
  
      // handle each name
      for (j = 0; j < names.length; j++) {
        name = names[j]
        const config = this._optsDef[name]
        const value = parseValue((j + 1 < names.length) || param, quoted, config)
        handleOption(name, value, value)
      }
    }
  
    // assign default values
    for (const name in this._optsDef) {
      if (this._optsDef[name].default !== undefined && !(name in options)) {
        options[name] = this._optsDef[name].default
      }
    }
  
    return { options, rest, unknown, args } as ParsedLine
  }

  async execute (argv: ParsedCommandLine, next: NextFunction = noop) {
    if (!argv.options) argv.options = {}
    if (!argv.unknown) argv.unknown = []
    if (!argv.args) argv.args = []

    if (await this.app.serialize(argv.meta, 'before-command', argv)) return

    // execute command
    this.context.logger('koishi:command').debug('execute %s', this.name)
    await this.app.parallelize(argv.meta, 'command', argv)

    let skipped = false
    argv.next = (_next) => {
      skipped = true
      return next(_next)
    }

    await this._action(argv, ...argv.args)
    if (!skipped) {
      return this.app.parallelize(argv.meta, 'after-command', argv)
    }
  }

  end () {
    return this.context
  }
}
