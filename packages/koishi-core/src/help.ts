import { Command, getUsage, getUsageName, ValidationField } from './command'
import { TableType } from './database'
import { Session, FieldCollector } from './session'
import { template } from 'koishi-utils'
import { Context } from './context'

interface HelpConfig {
  showHidden?: boolean
  authority?: boolean
}

export default function apply(ctx: Context) {
  // show help when use `-h, --help` or when there is no action
  ctx.before('command', async ({ command, session, options }) => {
    if (command._actions.length && !options['help']) return
    await session.execute({
      name: 'help',
      args: [command.name],
    })
    return ''
  })

  const app = ctx.app
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

  ctx.command('help [command]', '显示帮助信息', { authority: 0 })
    .userFields(['authority'])
    .userFields(createCollector('user'))
    .channelFields(createCollector('channel'))
    .shortcut('帮助', { fuzzy: true })
    .option('authority', '-a  显示权限设置')
    .option('showHidden', '-H  查看隐藏的选项和指令')
    .action(async ({ session, options }, target) => {
      if (!target) {
        const commands = app._commands.filter(cmd => cmd.parent === null)
        const output = formatCommands('internal.global-help-prolog', session, commands, options)
        const epilog = template('internal.global-help-epilog')
        if (epilog) output.push(epilog)
        return output.join('\n')
      }

      const command = findCommand(target)
      if (!command?.context.match(session)) {
        session.suggest({
          target,
          items: getCommandNames(session),
          prefix: template('internal.help-suggestion-prefix'),
          suffix: template('internal.help-suggestion-suffix'),
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

export function getCommandNames(session: Session) {
  return session.app._commands
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

function formatCommands(path: string, session: Session<ValidationField>, children: Command[], options: HelpConfig) {
  const commands = Array
    .from(getCommands(session, children, options.showHidden))
    .sort((a, b) => a.name > b.name ? 1 : -1)
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
  if (options.authority) hints.push(template('internal.hint-authority'))
  if (hasSubcommand) hints.push(template('internal.hint-subcommand'))
  output.unshift(template(path, [template.brace(hints)]))
  return output
}

function getOptions(command: Command, session: Session<ValidationField>, maxUsage: number, config: HelpConfig) {
  if (command.config.hideOptions && !config.showHidden) return []
  const options = config.showHidden
    ? Object.values(command._options)
    : Object.values(command._options)
      .filter(option => !option.hidden && (!session.user || option.authority <= session.user.authority))
  if (!options.length) return []

  const output = config.authority && options.some(o => o.authority)
    ? [template('internal.available-options-with-authority')]
    : [template('internal.available-options')]

  options.forEach((option) => {
    const authority = option.authority && config.authority ? `(${option.authority}) ` : ''
    let line = `    ${authority}${option.description}`
    if (option.notUsage && maxUsage !== Infinity) {
      line += template('internal.option-not-usage')
    }
    output.push(line)
  })

  return output
}

async function showHelp(command: Command, session: Session<ValidationField>, config: HelpConfig) {
  const output = [command.name + command.declaration]

  if (command.description) output.push(command.description)

  if (command.context.database) {
    await session.observeUser(['authority', 'timers', 'usage'])
  }

  if (command._aliases.length > 1) {
    output.push(template('internal.command-aliases', Array.from(command._aliases.slice(1)).join('，')))
  }

  const maxUsage = command.getConfig('maxUsage', session)
  if (session.user) {
    const name = getUsageName(command)
    const minInterval = command.getConfig('minInterval', session)
    const count = getUsage(name, session.user)

    if (maxUsage < Infinity) {
      output.push(template('internal.command-max-usage', Math.min(count, maxUsage), maxUsage))
    }

    const due = session.user.timers[name]
    if (minInterval > 0) {
      const nextUsage = due ? (Math.max(0, due - Date.now()) / 1000).toFixed() : 0
      output.push(template('internal.command-min-interval', nextUsage, minInterval / 1000))
    }

    if (command.config.authority > 1) {
      output.push(template('internal.command-authority', command.config.authority))
    }
  }

  const usage = command._usage
  if (usage) {
    output.push(typeof usage === 'string' ? usage : await usage.call(command, session))
  }

  output.push(...getOptions(command, session, maxUsage, config))

  if (command._examples.length) {
    output.push(template('internal.command-examples'), ...command._examples.map(example => '    ' + example))
  }

  output.push(...formatCommands('internal.subcommand-prolog', session, command.children, config))

  return output.join('\n')
}

/* eslint-disable quote-props */
template.set('internal', {
  // command
  'low-authority': '权限不足。',
  'usage-exhausted': '调用次数已达上限。',
  'too-frequent': '调用过于频繁，请稍后再试。',
  'insufficient-arguments': '缺少参数，输入帮助以查看用法。',
  'redunant-arguments': '存在多余参数，输入帮助以查看用法。',
  'invalid-argument': '参数 {0} 输入无效，{1}',
  'unknown-option': '存在未知选项 {0}，输入帮助以查看用法。',
  'invalid-option': '选项 {0} 输入无效，{1}',
  'check-syntax': '输入帮助以查看用法。',

  // suggest
  'suggestion': '您要找的是不是{0}？',
  'command-suggestion-prefix': '',
  'command-suggestion-suffix': '发送空行或句号以使用推测的指令。',

  // help
  'help-suggestion-prefix': '指令未找到。',
  'help-suggestion-suffix': '发送空行或句号以使用推测的指令。',
  'subcommand-prolog': '可用的子指令有{0}：',
  'global-help-prolog': '当前可用的指令有{0}：',
  'global-help-epilog': '输入“帮助 指令名”查看特定指令的语法和使用示例。',
  'available-options': '可用的选项有：',
  'available-options-with-authority': '可用的选项有（括号内为额外要求的权限等级）：',
  'option-not-usage': '（不计入总次数）',
  'hint-authority': '括号内为对应的最低权限等级',
  'hint-subcommand': '标有星号的表示含有子指令',
  'command-aliases': '别名：{0}。',
  'command-examples': '使用示例：',
  'command-authority': '最低权限：{0} 级。',
  'command-max-usage': '已调用次数：{0}/{1}。',
  'command-min-interval': '距离下次调用还需：{0}/{1} 秒。',
})
