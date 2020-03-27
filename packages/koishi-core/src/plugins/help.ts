import { Command, Context, UserData, Meta, onApp } from '..'
import { getUsage, getUsageName } from './validate'

export type CommandUsage = string | ((this: Command, meta: Meta) => string | Promise<string>)

declare module '../command' {
  export interface Command {
    _usage?: CommandUsage
    _examples: string[]
    usage (text: CommandUsage): this
    example (example: string): this
  }

  export interface CommandConfig {
    /** hide all options by default */
    hideOptions?: boolean
  }

  export interface OptionConfig {
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
  options: boolean
}

onApp((app) => {
  app.on('new-command', (cmd) => {
    cmd._examples = []
    cmd.option('-h, --help', '显示此信息', { hidden: true })
  })

  app.before('before-command', async (argv) => {
    // show help when use `-h, --help` or when there is no action
    if (!argv.command._action || argv.options.help) {
      await app.runCommand('help', argv.meta, [argv.command.name])
      return true
    }
  })

  app.command('help [command]', '显示帮助信息', { authority: 0 })
    .userFields(['authority', 'usage'])
    .shortcut('帮助', { fuzzy: true })
    .option('-e, --expand', '展开指令列表')
    .option('-o, --options', '查看全部选项（包括隐藏）')
    .action(async ({ meta, options }, name) => {
      if (name) {
        const command = app.getCommand(name, meta) || app.app._shortcutMap[name]
        if (!command) return meta.$send('指令未找到。')
        return showCommandHelp(command, meta, options as HelpConfig)
      } else {
        return showGlobalHelp(app, meta, options as HelpConfig)
      }
    })
})

function getShortcuts (command: Command, user: Pick<UserData, 'authority'>) {
  return Object.keys(command._shortcuts).filter((key) => {
    const shortcut = command._shortcuts[key]
    return !shortcut.hidden && !shortcut.prefix && (!shortcut.authority || !user || shortcut.authority <= user.authority)
  })
}

function getCommands (context: Context, meta: Meta<'message'>, parent?: Command) {
  const commands = parent ? parent.children : context.app._commands
  return commands
    .filter(cmd => cmd.context.match(meta) && (!meta.$user || cmd.config.authority <= meta.$user.authority))
    .sort((a, b) => a.name > b.name ? 1 : -1)
}

function getCommandList (prefix: string, context: Context, meta: Meta<'message'>, parent: Command, expand: boolean) {
  let commands = getCommands(context, meta, parent)
  if (!expand) {
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
    if (children.length) hasSubcommand = true
    return `    ${name} (${config.authority}${children.length ? '*' : ''})  ${config.description}`
  })
  output.unshift(`${prefix}（括号内为对应的最低权限等级${hasSubcommand ? '，标有星号的表示含有子指令' : ''}）：`)
  if (expand) output.push('注：部分指令组已展开，故不再显示。')
  return output
}

function showGlobalHelp (context: Context, meta: Meta<'message'>, config: HelpConfig) {
  return meta.$send([
    ...getCommandList('当前可用的指令有', context, meta, null, config.expand),
    '群聊普通指令可以通过“@我+指令名”的方式进行触发。',
    '私聊或全局指令则不需要添加上述前缀，直接输入指令名即可触发。',
    '输入“全局指令”查看全部可用的全局指令。',
    '输入“帮助+指令名”查看特定指令的语法和使用示例。',
  ].join('\n'))
}

function getOptions (command: Command, maxUsage: number, config: HelpConfig) {
  if (command.config.hideOptions && !config.options) return []
  const options = config.options
    ? command._options
    : command._options.filter(option => !option.hidden)
  if (!options.length) return []

  const output = options.some(o => o.authority)
    ? ['可用的选项有（括号内为额外要求的权限等级）：']
    : ['可用的选项有：']

  options.forEach((option) => {
    const authority = option.authority ? `(${option.authority}) ` : ''
    let line = `    ${authority}${option.fullName}  ${option.description}`
    if (option.notUsage && maxUsage !== Infinity) {
      line += '（不计入总次数）'
    }
    output.push(line)
  })

  return output
}

async function showCommandHelp (command: Command, meta: Meta<'message'>, config: HelpConfig) {
  const output = [command.name + command.declaration, command.config.description]
  if (config.options) {
    const output = getOptions(command, Infinity, config)
    if (!output.length) return meta.$send('该指令没有可用的选项。')
    return meta.$send(output.join('\n'))
  }

  if (command.context.database) {
    meta.$user = await command.context.database.observeUser(meta.userId)
  }

  if (command._aliases.length > 1) {
    output.push(`别名：${Array.from(command._aliases.slice(1)).join('，')}。`)
  }
  const shortcuts = getShortcuts(command, meta.$user)
  if (shortcuts.length) {
    output.push(`相关全局指令：${shortcuts.join('，')}。`)
  }

  const maxUsage = command.getConfig('maxUsage', meta)
  const minInterval = command.getConfig('minInterval', meta)
  if (meta.$user) {
    const usage = getUsage(getUsageName(command), meta.$user)
    if (maxUsage !== Infinity) {
      output.push(`已调用次数：${Math.min(usage.count || 0, maxUsage)}/${maxUsage}。`)
    }

    if (minInterval > 0) {
      const nextUsage = usage.last ? (Math.max(0, minInterval + usage.last - Date.now()) / 1000).toFixed() : 0
      output.push(`距离下次调用还需：${nextUsage}/${minInterval / 1000} 秒。`)
    }

    if (command.config.authority > 1) {
      output.push(`最低权限：${command.config.authority} 级。`)
    }
  }

  const usage = command._usage
  if (usage) {
    output.push(typeof usage === 'string' ? usage : await usage.call(command, meta))
  }

  output.push(...getOptions(command, maxUsage, config))

  if (command._examples.length) {
    output.push('使用示例：', ...command._examples.map(example => '    ' + example))
  }

  if (command.children.length) {
    output.push(...getCommandList('可用的子指令有', command.context, meta, command, config.expand))
  }

  return meta.$send(output.join('\n'))
}
