import { getUsage, getUsageName, ValidationField } from './validate'
import { TableType } from '../database'
import { Command } from '../command'
import { Session, FieldCollector } from '../session'
import { App } from '../app'
import { Message } from './message'

interface HelpConfig {
  showHidden?: boolean
  authority?: boolean
}

export default function apply(app: App) {
  // show help when use `-h, --help` or when there is no action
  app.prependListener('before-command', async ({ command, session, options }) => {
    if (command._actions.length && !options['help']) return
    await session.execute({
      name: 'help',
      args: [command.name],
    })
    return ''
  })

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
        const output = formatCommands('当前可用的指令有', session, commands, options)
        if (Message.GLOBAL_HELP_EPILOG) output.push(Message.GLOBAL_HELP_EPILOG)
        return output.join('\n')
      }

      const command = findCommand(target)
      if (!command?.context.match(session)) {
        const items = getCommands(session, app._commands).flatMap(cmd => cmd._aliases)
        session.suggest({
          target,
          items,
          prefix: Message.HELP_SUGGEST_PREFIX,
          suffix: Message.HELP_SUGGEST_SUFFIX,
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

function formatCommands(prefix: string, session: Session<ValidationField>, source: Command[], options: HelpConfig) {
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
  if (options.authority) {
    output.unshift(`${prefix}（括号内为对应的最低权限等级${hasSubcommand ? '，标有星号的表示含有子指令' : ''}）：`)
  } else {
    output.unshift(`${prefix}：`)
  }
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
    ? ['可用的选项有（括号内为额外要求的权限等级）：']
    : ['可用的选项有：']

  options.forEach((option) => {
    const authority = option.authority && config.authority ? `(${option.authority}) ` : ''
    let line = `    ${authority}${option.description}`
    if (option.notUsage && maxUsage !== Infinity) {
      line += '（不计入总次数）'
    }
    output.push(line)
  })

  return output
}

async function showHelp(command: Command, session: Session<ValidationField>, config: HelpConfig) {
  const output = [command.declaration, command.description]

  if (command.context.database) {
    await session.observeUser(['authority', 'timers', 'usage'])
  }

  if (command._aliases.length > 1) {
    output.push(`别名：${Array.from(command._aliases.slice(1)).join('，')}。`)
  }

  const maxUsage = command.getConfig('maxUsage', session)
  if (session.$user) {
    const name = getUsageName(command)
    const minInterval = command.getConfig('minInterval', session)
    const count = getUsage(name, session.$user)

    if (maxUsage < Infinity) {
      output.push(`已调用次数：${Math.min(count, maxUsage)}/${maxUsage}。`)
    }

    const due = session.$user.timers[name]
    if (minInterval > 0) {
      const nextUsage = due ? (Math.max(0, due - Date.now()) / 1000).toFixed() : 0
      output.push(`距离下次调用还需：${nextUsage}/${minInterval / 1000} 秒。`)
    }

    if (command.config.authority > 1) {
      output.push(`最低权限：${command.config.authority} 级。`)
    }
  }

  const usage = command._usage
  if (usage) {
    output.push(typeof usage === 'string' ? usage : await usage.call(command, session))
  }

  output.push(...getOptions(command, session, maxUsage, config))

  if (command._examples.length) {
    output.push('使用示例：', ...command._examples.map(example => '    ' + example))
  }

  output.push(...formatCommands('可用的子指令有', session, command.children, config))

  return output.join('\n')
}
