import { Argv, Command, Computed, Context, FieldCollector, h, Schema, Session } from 'koishi'
import zhCN from './locales/zh-CN.yml'
import enUS from './locales/en-US.yml'
import jaJP from './locales/ja-JP.yml'
import frFR from './locales/fr-FR.yml'
import zhTW from './locales/zh-TW.yml'

declare module 'koishi' {
  interface Events {
    'help/command'(output: string[], command: Command, session: Session<never, never>): void
    'help/option'(output: string, option: Argv.OptionVariant, command: Command, session: Session<never, never>): string
  }

  namespace Command {
    interface Config {
      /** hide all options by default */
      hideOptions?: boolean
      /** hide command */
      hidden?: Computed<boolean>
      /** localization params */
      params?: object
    }
  }

  namespace Argv {
    interface OptionConfig {
      /** hide option */
      hidden?: Computed<boolean>
      /** localization params */
      params?: object
    }
  }
}

interface HelpOptions {
  showHidden?: boolean
}

export interface Config {
  shortcut?: boolean
  options?: boolean
}

export const Config: Schema<Config> = Schema.object({
  shortcut: Schema.boolean().default(true).description('是否启用快捷调用。'),
  options: Schema.boolean().default(true).description('是否为每个指令添加 `-h, --help` 选项。'),
})

function executeHelp(session: Session<never, never>, name: string) {
  if (!session.app.$commander.get('help')) return
  return session.execute({
    name: 'help',
    args: [name],
  })
}

export const name = 'help'

export function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh-CN', zhCN)
  ctx.i18n.define('en-US', enUS)
  ctx.i18n.define('ja-JP', jaJP)
  ctx.i18n.define('fr-FR', frFR)
  ctx.i18n.define('zh-TW', zhTW)

  function enableHelp(command: Command) {
    command[Context.current] = ctx
    command.option('help', '-h', {
      hidden: true,
      // @ts-ignore
      notUsage: true,
      descPath: 'commands.help.options.help',
    })
  }

  ctx.schema.extend('command', Schema.object({
    hideOptions: Schema.boolean().description('是否隐藏所有选项。').default(false).hidden(),
    hidden: Schema.computed(Schema.boolean()).description('在帮助菜单中隐藏指令。').default(false),
    params: Schema.any().description('帮助信息的本地化参数。').hidden(),
  }), 900)

  ctx.schema.extend('command-option', Schema.object({
    hidden: Schema.computed(Schema.boolean()).description('在帮助菜单中隐藏选项。').default(false),
    params: Schema.any().description('帮助信息的本地化参数。').hidden(),
  }), 900)

  if (config.options !== false) {
    ctx.$commander._commandList.forEach(enableHelp)
    ctx.on('command-added', enableHelp)
  }

  ctx.before('command/execute', (argv) => {
    const { command, options, session } = argv
    if (options['help'] && command._options.help) {
      return executeHelp(session, command.name)
    }

    if (command['_actions'].length) return
    return executeHelp(session, command.name)
  })

  const $ = ctx.$commander
  function findCommand(target: string, session: Session<never, never>) {
    const command = $.resolve(target)
    if (command?.ctx.filter(session)) return command

    // shortcuts
    const data = ctx.i18n
      .find('commands.(name).shortcuts.(variant)', target)
      .map(item => ({ ...item, command: $.resolve(item.data.name) }))
      .filter(item => item.command?.match(session))
    const perfect = data.filter(item => item.similarity === 1)
    if (!perfect.length) return data
    return perfect[0].command
  }

  const createCollector = <T extends 'user' | 'channel'>(key: T): FieldCollector<T> => (argv, fields) => {
    const { args: [target], session } = argv
    const result = findCommand(target, session)
    if (!Array.isArray(result)) {
      session.collect(key, { ...argv, command: result, args: [], options: { help: true } }, fields)
      return
    }
    for (const { command } of result) {
      session.collect(key, { ...argv, command, args: [], options: { help: true } }, fields)
    }
  }

  async function inferCommand(target: string, session: Session) {
    const result = findCommand(target, session)
    if (!Array.isArray(result)) return result

    const expect = $.available(session).filter((name) => {
      return name && session.app.i18n.compare(name, target)
    })
    for (const item of result) {
      if (expect.includes(item.data.name)) continue
      expect.push(item.data.name)
    }
    const cache = new Map<string, Promise<boolean>>()
    const name = await session.suggest({
      expect,
      prefix: session.text('.not-found'),
      suffix: session.text('internal.suggest-command'),
      filter: (name) => {
        name = $.resolve(name)!.name
        return ctx.permissions.test(`command.${name}`, session, cache)
      },
    })
    return $.resolve(name)
  }

  const cmd = ctx.command('help [command:string]', { authority: 0, ...config })
    .userFields(['authority'])
    .userFields(createCollector('user'))
    .channelFields(createCollector('channel'))
    .option('showHidden', '-H')
    .action(async ({ session, options }, target) => {
      if (!target) {
        const prefix = session.resolve(session.app.config.prefix)[0] ?? ''
        const commands = $._commandList.filter(cmd => cmd.parent === null)
        const output = formatCommands('.global-prolog', session, commands, options)
        const epilog = session.text('.global-epilog', [prefix])
        if (epilog) output.push(epilog)
        return output.filter(Boolean).join('\n')
      }

      const command = await inferCommand(target, session)
      if (!command) return
      const permissions = [`command.${command.name}`]
      if (!await ctx.permissions.test(permissions, session as any)) {
        return session.text('internal.low-authority')
      }
      return showHelp(command, session, options)
    })

  if (config.shortcut !== false) cmd.shortcut('help', { i18n: true, fuzzy: true })
}

function* getCommands(session: Session<'authority'>, commands: Command[], showHidden = false): Generator<Command> {
  for (const command of commands) {
    if (!showHidden && session.resolve(command.config.hidden)) continue
    if (command.match(session)) {
      yield command
    } else {
      yield* getCommands(session, command.children, showHidden)
    }
  }
}

function formatCommands(path: string, session: Session<'authority'>, children: Command[], options: HelpOptions) {
  const commands = Array
    .from(getCommands(session, children, options.showHidden))
    .sort((a, b) => a.displayName > b.displayName ? 1 : -1)
  if (!commands.length) return []

  const prefix = session.resolve(session.app.config.prefix)[0] ?? ''
  const output = commands.map(({ name, displayName, config }) => {
    let output = '    ' + prefix + displayName
    output += '  ' + session.text([`commands.${name}.description`, ''], config.params)
    return output
  })
  const hints: string[] = []
  const hintText = hints.length
    ? session.text('general.paren', [hints.join(session.text('general.comma'))])
    : ''
  output.unshift(session.text(path, [hintText]))
  return output
}

function getOptionVisibility(option: Argv.OptionConfig, session: Session<'authority'>) {
  if (session.user && option.authority > session.user.authority) return false
  return !session.resolve(option.hidden)
}

function getOptions(command: Command, session: Session<'authority'>, config: HelpOptions) {
  if (command.config.hideOptions && !config.showHidden) return []
  const options = config.showHidden
    ? Object.values(command._options)
    : Object.values(command._options).filter(option => getOptionVisibility(option, session))
  if (!options.length) return []

  const output: string[] = []
  Object.values(command._options).forEach((option) => {
    function pushOption(option: Argv.OptionVariant, name: string) {
      if (!config.showHidden && !getOptionVisibility(option, session)) return
      let line = `${h.escape(option.syntax)}`
      const description = session.text(option.descPath ?? [`commands.${command.name}.options.${name}`, ''], option.params)
      if (description) line += '  ' + description
      line = command.ctx.chain('help/option', line, option, command, session)
      output.push('    ' + line)
    }

    if (!('value' in option)) pushOption(option, option.name)
    for (const value in option.variants) {
      pushOption(option.variants[value], `${option.name}.${value}`)
    }
  })

  if (!output.length) return []
  output.unshift(session.text('.available-options'))
  return output
}

async function showHelp(command: Command, session: Session<'authority'>, config: HelpOptions) {
  const output = [session.text('.command-title', [command.displayName + command.declaration])]

  const description = session.text([`commands.${command.name}.description`, ''], command.config.params)
  if (description) output.push(description)

  if (session.app.database) {
    const argv: Argv = { command, args: [], options: { help: true } }
    const userFields = session.collect('user', argv)
    await session.observeUser(userFields)
    if (!session.isDirect) {
      const channelFields = session.collect('channel', argv)
      await session.observeChannel(channelFields)
    }
  }

  if (Object.keys(command._aliases).length > 1) {
    output.push(session.text('.command-aliases', [Array.from(Object.keys(command._aliases).slice(1)).join('，')]))
  }

  session.app.emit(session, 'help/command', output, command, session)

  if (command._usage) {
    output.push(typeof command._usage === 'string' ? command._usage : await command._usage(session))
  } else {
    const text = session.text([`commands.${command.name}.usage`, ''], command.config.params)
    if (text) output.push(text)
  }

  output.push(...getOptions(command, session, config))

  if (command._examples.length) {
    output.push(session.text('.command-examples'), ...command._examples.map(example => '    ' + example))
  } else {
    const text = session.text([`commands.${command.name}.examples`, ''], command.config.params)
    if (text) output.push(...text.split('\n').map(line => '    ' + line))
  }

  output.push(...formatCommands('.subcommand-prolog', session, command.children, config))

  return output.filter(Boolean).join('\n')
}
