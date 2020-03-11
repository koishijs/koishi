import { Context, NextFunction } from './context'
import { UserData, UserField, GroupField } from './database'
import { errors } from './messages'
import { noop } from 'koishi-utils'
import { Meta } from './meta'

import {
  CommandOption,
  CommandArgument,
  OptionConfig,
  parseArguments,
  parseOption,
  parseLine,
  ParsedLine,
} from './parser'

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
  _argsDef: CommandArgument[]
  _optsDef: Record<string, CommandOption> = {}
  _action?: (this: Command, config: ParsedCommandLine, ...args: string[]) => any

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
    const config = args[0] as CommandConfig || {}
    const option = parseOption(rawName, description, config, this._optsDef)
    this._options.push(option)
    for (const name of option.names) {
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
    return parseLine(source, this._argsDef, this._optsDef)
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
