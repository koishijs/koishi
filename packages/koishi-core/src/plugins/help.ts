import { getUsage, getUsageName, ValidationField } from './validate'
import { User, Group, TableType, Tables } from '../database'
import { Command, ParsedArgv } from '../command'
import { Session } from '../session'
import { App } from '../app'
import { Message } from './message'

export type CommandUsage<U extends User.Field, G extends Group.Field> = string
  | ((this: Command<U, G>, session: Session<U, G>) => string | Promise<string>)

declare module '../command' {
  interface Command<U, G> {
    _usage?: CommandUsage<U, G>
    _examples: string[]
    usage (text: CommandUsage<U, G>): this
    example (example: string): this
  }

  interface CommandConfig {
    /** hide all options by default */
    hideOptions?: boolean
    hidden?: boolean
  }

  interface OptionConfig {
    /** hide the option by default */
    hidden?: boolean
  }
}

Command.prototype.usage = function (text) {
  this._usage = text
  return this
}

Command.prototype.example = function (example) {
  this._examples.push(example)
  return this
}

interface HelpConfig {
  expand: boolean
  showHidden: boolean
  authority: boolean
}

export default function apply(app: App) {
  app.on('new-command', (cmd) => {
    cmd._examples = []
    cmd.option('help', '-h  显示此信息', { hidden: true })
  })

  // show help when use `-h, --help` or when there is no action
  app.before('before-command', async ({ command, session, options }) => {
    if (command._action && !options['help']) return
    await session.$execute({
      command: 'help',
      args: [command.name],
    })
    return ''
  })

  function createCollector<T extends TableType>(key: T) {
    return function* (argv: ParsedArgv, fields: Set<keyof Tables[T]>) {
      const { args: [name] } = argv
      const command = app._commandMap[name] || app._shortcutMap[name]
      if (!command) return
      yield* Command.collect({ ...argv, args: [], options: { help: true } }, key, fields)
    }
  }

  app.command('help [command]', '显示帮助信息', { authority: 0 })
    .userFields(['authority'])
    .userFields(createCollector('user'))
    .groupFields(createCollector('group'))
    .shortcut('帮助', { fuzzy: true })
    .option('authority', '-a  显示权限设置')
    .option('expand', '-e  展开指令列表')
    .option('showHidden', '-H  查看隐藏的选项和指令')
    .action(async ({ session, options }, target) => {
      if (!target) {
        const output = getCommandList('当前可用的指令有', session, null, options)
        output.push(Message.GLOBAL_HELP_EPILOG)
        return output.join('\n')
      }

      const command = app._commandMap[target] || app._shortcutMap[target]
      if (!command?.context.match(session)) {
        const items = getCommands(session).flatMap(cmd => cmd._aliases)
        return session.$suggest({
          target,
          items,
          prefix: Message.HELP_SUGGEST_PREFIX,
          suffix: Message.HELP_SUGGEST_SUFFIX,
          async apply(suggestion) {
            await this.$observeUser(['authority', 'usage', 'timers'])
            const output = await showHelp(app._commandMap[suggestion], this as any, options)
            return session.$send(output)
          },
        })
      }
      return showHelp(command, session, options)
    })
}

function getShortcuts(command: Command, user: Pick<User, 'authority'>) {
  return Object.keys(command._shortcuts).filter((key) => {
    const shortcut = command._shortcuts[key]
    return !shortcut.hidden && !shortcut.prefix && (!shortcut.authority || !user || shortcut.authority <= user.authority)
  })
}

export function getCommands(session: Session<'authority'>, parent: Command = null, showHidden = false) {
  const { authority } = session.$user || {}
  return (parent ? parent.children : session.$app._commands).filter(cmd => {
    return cmd.context.match(session)
      && (authority === undefined || cmd.config.authority <= authority)
      && (showHidden || !cmd.config.hidden)
  }).sort((a, b) => a.name > b.name ? 1 : -1)
}

function getCommandList(prefix: string, session: Session<ValidationField>, parent: Command, options: HelpConfig) {
  let commands = getCommands(session, parent, options.showHidden)
  if (!options.expand) {
    commands = commands.filter(cmd => cmd.parent === parent)
  } else {
    const startPosition = parent ? parent.name.length + 1 : 0
    commands = commands.filter(cmd => {
      return !cmd.name.includes('.', startPosition)
        && (!cmd.children.length
          || cmd.children.find(cmd => cmd.name.includes('.', startPosition)))
    })
  }
  let hasSubcommand = false
  const output = commands.map(({ name, config, children }) => {
    let output = '    ' + name
    if (options.authority) {
      output += ` (${config.authority}${children.length ? (hasSubcommand = true, '*') : ''})`
    }
    output += '  ' + config.description
    return output
  })
  if (options.authority) {
    output.unshift(`${prefix}（括号内为对应的最低权限等级${hasSubcommand ? '，标有星号的表示含有子指令' : ''}）：`)
  } else {
    output.unshift(`${prefix}：`)
  }
  if (options.expand) output.push('注：部分指令组已展开，故不再显示。')
  return output
}

function getOptions(command: Command, session: Session<ValidationField>, maxUsage: number, config: HelpConfig) {
  if (command.config.hideOptions && !config.showHidden) return []
  const options = config.showHidden
    ? Object.values(command._options)
    : Object.values(command._options).filter(option => !option.hidden && (!session.$user || option.authority <= session.$user.authority))
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
  const output = [command.name + command.declaration, command.config.description]

  if (command.context.database) {
    await session.$observeUser(['authority', 'timers', 'usage'])
  }

  const disabled = command._checkers.some(checker => checker(session))
  if (disabled) output[1] += '（指令已禁用）'

  if (command._aliases.length > 1) {
    output.push(`别名：${Array.from(command._aliases.slice(1)).join('，')}。`)
  }

  const shortcuts = getShortcuts(command, session.$user)
  if (shortcuts.length) {
    output.push(`相关全局指令：${shortcuts.join('，')}。`)
  }

  const maxUsage = command.getConfig('maxUsage', session)
  if (!disabled && session.$user) {
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

  if (command.children.length) {
    output.push(...getCommandList('可用的子指令有', session, command, config))
  }

  return output.join('\n')
}
