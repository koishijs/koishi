import { Argv } from '../parser'
import { Command } from '../command'
import { Context } from '../context'
import { Channel, Tables, User } from '../database'
import { FieldCollector, Session } from '../session'

interface HelpOptions {
  showHidden?: boolean
  authority?: boolean
}

export interface HelpConfig extends Command.Config {
  shortcut?: boolean
  options?: boolean
}

export function enableHelp<U extends User.Field, G extends Channel.Field, A extends any[], O extends {}>(cmd: Command<U, G, A, O>) {
  return cmd.option('help', '-h', {
    hidden: true,
    descPath: 'commands.help.options.help',
  })
}

export default function help(ctx: Context, config: HelpConfig = {}) {
  if (config.options !== false) {
    ctx.on('command-added', cmd => cmd.use(enableHelp))
  }

  const app = ctx.app
  function findCommand(target: string) {
    const command = app._commands.resolve(target)
    if (command) return command
    const shortcut = app._shortcuts.find(({ name }) => {
      return typeof name === 'string' ? name === target : name.test(target)
    })
    if (shortcut) return shortcut.command
  }

  const createCollector = <T extends keyof Tables>(key: T): FieldCollector<T> => (argv, fields) => {
    const { args: [target], session } = argv
    const command = findCommand(target)
    if (!command) return
    session.collect(key, { ...argv, command, args: [], options: { help: true } }, fields)
  }

  const cmd = ctx.command('help [command:string]', { authority: 0, ...config })
    .userFields(['authority'])
    .userFields(createCollector('user'))
    .channelFields(createCollector('channel'))
    .option('authority', '-a')
    .option('showHidden', '-H')
    .action(async ({ session, options }, target) => {
      if (!target) {
        const commands = app._commandList.filter(cmd => cmd.parent === null)
        const output = formatCommands('.global-prolog', session, commands, options)
        const epilog = session.text('.global-epilog')
        if (epilog) output.push(epilog)
        return output.filter(Boolean).join('\n')
      }

      const command = findCommand(target)
      if (!command?.context.match(session)) {
        return session.suggest({
          target,
          items: getCommandNames(session),
          prefix: session.text('suggest.help-prefix'),
          suffix: session.text('suggest.help-suffix'),
          async apply(suggestion) {
            return showHelp(ctx.getCommand(suggestion), this as any, options)
          },
        })
      }

      return showHelp(command, session, options)
    })

  if (config.shortcut !== false) cmd.shortcut('帮助', { fuzzy: true })
}

export function getCommandNames(session: Session) {
  return session.app._commandList
    .filter(cmd => cmd.match(session) && !cmd.config.hidden)
    .flatMap(cmd => cmd._aliases)
}

function* getCommands(session: Session<'authority'>, commands: Command[], showHidden = false): Generator<Command> {
  for (const command of commands) {
    if (!showHidden && command.config.hidden) continue
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
    .sort((a, b) => a.name > b.name ? 1 : -1)
  if (!commands.length) return []

  let hasSubcommand = false
  const output = commands.map(({ name, config, children }) => {
    let output = '    ' + name
    if (options.authority) {
      output += ` (${config.authority}${children.length ? (hasSubcommand = true, '*') : ''})`
    }
    output += '  ' + session.text([`commands.${name}.description`, ''])
    return output
  })
  const hints: string[] = []
  if (options.authority) hints.push(session.text('.hint-authority'))
  if (hasSubcommand) hints.push(session.text('.hint-subcommand'))
  const hintText = hints.length
    ? session.text('general.paren', [hints.join(session.text('general.comma'))])
    : ''
  output.unshift(session.text(path, [hintText]))
  return output
}

function getOptionVisibility(option: Argv.OptionDeclaration, session: Session<'authority'>) {
  if (session.user && option.authority > session.user.authority) return false
  return !session.resolveValue(option.hidden)
}

function getOptions(command: Command, session: Session<'authority'>, config: HelpOptions) {
  if (command.config.hideOptions && !config.showHidden) return []
  const options = config.showHidden
    ? Object.values(command._options)
    : Object.values(command._options).filter(option => getOptionVisibility(option, session))
  if (!options.length) return []

  const output = config.authority && options.some(o => o.authority)
    ? [session.text('.available-options-with-authority')]
    : [session.text('.available-options')]

  options.forEach((option) => {
    const authority = option.authority && config.authority ? `(${option.authority}) ` : ''
    let line = `${authority}${option.syntax}`
    const description = session.text(option.descPath ?? [`commands.${command.name}.options.${option.name}`, ''])
    if (description) line += '  ' + description
    line = command.app.chain('help/option', line, option, command, session)
    output.push('    ' + line)
  })

  return output
}

async function showHelp(command: Command, session: Session<'authority'>, config: HelpOptions) {
  const output = [command.name + command.declaration]

  const description = session.text([`commands.${command.name}.description`, ''])
  if (description) output.push(description)

  if (session.app.database) {
    const argv: Argv = { command, args: [], options: { help: true } }
    const userFields = session.collect('user', argv)
    await session.observeUser(userFields)
    if (session.subtype === 'group') {
      const channelFields = session.collect('channel', argv)
      await session.observeChannel(channelFields)
    }
  }

  if (command._aliases.length > 1) {
    output.push(session.text('.command-aliases', [Array.from(command._aliases.slice(1)).join('，')]))
  }

  session.app.emit(session, 'help/command', output, command, session)

  if (session.user && command.config.authority > 1) {
    output.push(session.text('.command-authority', [command.config.authority]))
  }

  const usage = command._usage
  if (usage) {
    output.push(typeof usage === 'string' ? usage : await usage.call(command, session))
  }

  output.push(...getOptions(command, session, config))

  if (command._examples.length) {
    output.push(session.text('.command-examples'), ...command._examples.map(example => '    ' + example))
  }

  output.push(...formatCommands('.subcommand-prolog', session, command.children, config))

  return output.filter(Boolean).join('\n')
}
