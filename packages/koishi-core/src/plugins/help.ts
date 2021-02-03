import { getUsage, getUsageName, ValidationField } from './validate'
import { TableType } from '../database'
import { Command } from '../command'
import { Session, FieldCollector } from '../session'
import { App } from '../app'
import { Template } from '../template'

interface HelpConfig {
  showHidden?: boolean
  authority?: boolean
}

export default function apply(app: App) {
  // show help when use `-h, --help` or when there is no action
  app.on('before-command', async ({ command, session, options }) => {
    if (command._actions.length && !options['help']) return
    await session.execute({
      name: 'help',
      args: [command.name],
    })
    return ''
  }, true)

  function findCommand(target: string) {
    if (target in app._commandMap) return app._commandMap[target]
    const shortcut = app._shortcuts.find(({ name }) => {
      return typeof name === 'string' ? name === target : name.test(target)
    })
    if (shortcut) return shortcut.command
  }

  const createCollector = <T extends TableType>(key: T): FieldCollector<T> => (argv, fields) => {
    const { args: [target], session } = argv
    const command = findCommand(target)
    if (!command) return
    session.collect(key, { ...argv, command, args: [], options: { help: true } }, fields)
  }

  app.command('help [command]  显示帮助信息', { authority: 0 })
    .userFields(['authority'])
    .userFields(createCollector('user'))
    .channelFields(createCollector('channel'))
    .shortcut('帮助', { fuzzy: true })
    .option('authority', '-a  显示权限设置')
    .option('showHidden', '-H  查看隐藏的选项和指令')
    .action(async ({ session, options }, target) => {
      if (!target) {
        const commands = session.$app._commands.filter(cmd => cmd.parent === null)
        const output = formatCommands('internal.global-help-prolog', session, commands, options)
        const epilog = Template('internal.global-help-epilog')
        if (epilog) output.push(epilog)
        return output.join('\n')
      }

      const command = findCommand(target)
      if (!command?.context.match(session)) {
        const items = getCommands(session, app._commands).flatMap(cmd => cmd._aliases)
        session.suggest({
          target,
          items,
          prefix: Template('internal.help-suggestion-prefix'),
          suffix: Template('internal.help-suggestion-suffix'),
          async apply(suggestion) {
            await this.observeUser(['authority', 'usage', 'timers'])
            const output = await showHelp(app._commandMap[suggestion], this as any, options)
            return session.send(output)
          },
        })
        return
      }

      return showHelp(command, session, options)
    })
}

export function getCommands(session: Session<'authority'>, commands: Command[], showHidden = false) {
  const { authority } = session.$user || {}
  return commands.filter(cmd => {
    return cmd.context.match(session)
      && (authority === undefined || cmd.config.authority <= authority)
      && (showHidden || !cmd.config.hidden)
  }).sort((a, b) => a.name > b.name ? 1 : -1)
}

function formatCommands(path: string, session: Session<ValidationField>, source: Command[], options: HelpConfig) {
  const commands = getCommands(session, source, options.showHidden)
  if (!commands.length) return []
  let hasSubcommand = false
  const output = commands.map(({ name, config, children, description }) => {
    let output = '    ' + name
    if (options.authority) {
      output += ` (${config.authority}${children.length ? (hasSubcommand = true, '*') : ''})`
    }
    output += '  ' + description
    return output
  })
  const hints: string[] = []
  if (options.authority) hints.push(Template('internal.hint-authority'))
  if (hasSubcommand) hints.push(Template('internal.hint-subcommand'))
  output.unshift(Template(path, [Template.brace(hints)]))
  return output
}

function getOptions(command: Command, session: Session<ValidationField>, maxUsage: number, config: HelpConfig) {
  if (command.config.hideOptions && !config.showHidden) return []
  const options = config.showHidden
    ? Object.values(command._options)
    : Object.values(command._options)
      .filter(option => !option.hidden && (!session.$user || option.authority <= session.$user.authority))
  if (!options.length) return []

  const output = config.authority && options.some(o => o.authority)
    ? [Template('internal.available-options-with-authority')]
    : [Template('internal.available-options')]

  options.forEach((option) => {
    const authority = option.authority && config.authority ? `(${option.authority}) ` : ''
    let line = `    ${authority}${option.description}`
    if (option.notUsage && maxUsage !== Infinity) {
      line += Template('internal.option-not-usage')
    }
    output.push(line)
  })

  return output
}

async function showHelp(command: Command, session: Session<ValidationField>, config: HelpConfig) {
  const output = [command.declaration]

  if (command.description) output.push(command.description)

  if (command.context.database) {
    await session.observeUser(['authority', 'timers', 'usage'])
  }

  if (command._aliases.length > 1) {
    output.push(Template('internal.command-aliases', Array.from(command._aliases.slice(1)).join('，')))
  }

  const maxUsage = command.getConfig('maxUsage', session)
  if (session.$user) {
    const name = getUsageName(command)
    const minInterval = command.getConfig('minInterval', session)
    const count = getUsage(name, session.$user)

    if (maxUsage < Infinity) {
      output.push(Template('internal.command-max-usage', Math.min(count, maxUsage), maxUsage))
    }

    const due = session.$user.timers[name]
    if (minInterval > 0) {
      const nextUsage = due ? (Math.max(0, due - Date.now()) / 1000).toFixed() : 0
      output.push(Template('internal.command-min-interval', nextUsage, minInterval / 1000))
    }

    if (command.config.authority > 1) {
      output.push(Template('internal.command-authority', command.config.authority))
    }
  }

  const usage = command._usage
  if (usage) {
    output.push(typeof usage === 'string' ? usage : await usage.call(command, session))
  }

  output.push(...getOptions(command, session, maxUsage, config))

  if (command._examples.length) {
    output.push(Template('internal.command-examples'), ...command._examples.map(example => '    ' + example))
  }

  output.push(...formatCommands('internal.subcommand-prolog', session, command.children, config))

  return output.join('\n')
}
