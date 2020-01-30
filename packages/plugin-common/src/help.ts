import { Context, Command, UserData, Meta, getUsage } from 'koishi-core'

export default function apply (ctx: Context) {
  ctx.command('help [command]', '显示帮助信息', { authority: 0 })
    .userFields(['authority', 'usage'])
    .shortcut('帮助', { fuzzy: true })
    .shortcut('全局指令', { options: { shortcut: true } })
    .option('-e, --expand', '展开指令列表')
    .option('-s, --shortcut', '查看全局指令列表')
    .action(async ({ meta, options }, name: string) => {
      if (name) {
        const command = ctx.getCommand(name, meta) || ctx.app._shortcutMap[name]
        if (!command) return meta.$send('指令未找到。')
        return showCommandHelp(command, meta, options)
      } else if (options.shortcut) {
        return showGlobalShortcut(ctx, meta)
      } else {
        return showGlobalHelp(ctx, meta, options)
      }
    })
}

function getShortcuts (command: Command, user: UserData) {
  return Object.keys(command._shortcuts).filter((key) => {
    const shortcut = command._shortcuts[key]
    return !shortcut.hidden && !shortcut.prefix && (!shortcut.authority || !user || shortcut.authority <= user.authority)
  })
}

function getCommands (context: Context, meta: Meta<'message'>, parent?: Command) {
  const commands = parent
    ? parent.children
    : context.app._commands.filter(cmd => cmd.context.match(meta))
  return commands
    .filter(cmd => !meta.$user || cmd.config.authority <= meta.$user.authority)
    .sort((a, b) => a.name > b.name ? 1 : -1)
}

function showGlobalShortcut (context: Context, meta: Meta<'message'>) {
  const commands = getCommands(context, meta)
  const shortcuts = [].concat(...commands.map(command => getShortcuts(command, meta.$user)))
  return meta.$send(`当前可用的全局指令有：${shortcuts.join('，')}。`)
}

function getCommandList (context: Context, meta: Meta<'message'>, parent: Command, expand: boolean) {
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
  const output = commands.map(({ name, config, children }) => {
    return `    ${name} (${config.authority}${children.length ? '*' : ''})  ${config.description}`
  })
  if (expand) output.push('注：部分指令组已展开，故不再显示。')
  return output
}

export const GLOBAL_HELP_PROLOGUE = '当前可用的指令有（括号内为对应的最低权限等级，标有星号的表示含有子指令）：'
export const GLOBAL_HELP_EPILOGUE = [
  '群聊普通指令可以通过“@我+指令名”的方式进行触发。',
  '私聊或全局指令则不需要添加上述前缀，直接输入指令名即可触发。',
  '输入“全局指令”查看全部可用的全局指令。',
  '输入“帮助+指令名”查看特定指令的语法和使用示例。',
].join('\n')

function showGlobalHelp (context: Context, meta: Meta<'message'>, options: any) {
  return meta.$send([
    GLOBAL_HELP_PROLOGUE,
    ...getCommandList(context, meta, null, options.expand),
    GLOBAL_HELP_EPILOGUE,
  ].join('\n'))
}

async function showCommandHelp (command: Command, meta: Meta<'message'>, options: any) {
  const output = [command.name + command.declaration, command.config.description]
  if (command.context.database) {
    meta.$user = await command.context.database.observeUser(meta.userId)
  }

  if (command._aliases.length > 1) {
    output.push(`中文别名：${Array.from(command._aliases.slice(1)).join('，')}。`)
  }
  const shortcuts = getShortcuts(command, meta.$user)
  if (shortcuts.length) {
    output.push(`相关全局指令：${shortcuts.join('，')}。`)
  }

  const maxUsage = command.getConfig('maxUsage', meta)
  const minInterval = command.getConfig('minInterval', meta)
  if (meta.$user) {
    const { authority, maxUsageText } = command.config
    const usage = getUsage(command.usageName, meta.$user)
    if (maxUsage !== Infinity) {
      output.push(`已调用次数：${Math.min(usage.count, maxUsage)}/${maxUsageText || maxUsage}。`)
    }
    if (minInterval > 0) {
      const nextUsage = usage.last ? (Math.max(0, minInterval + usage.last - Date.now()) / 1000).toFixed() : 0
      output.push(`距离下次调用还需：${nextUsage}/${minInterval / 1000} 秒。`)
    }

    if (authority > 1) {
      output.push(`最低权限：${authority} 级。`)
    }
  }

  if (command._usage) {
    output.push(command._usage)
  }

  const _options = command._options.filter(option => !option.hidden)
  if (_options.length) {
    if (_options.some(o => o.authority)) {
      output.push('可用的选项有（括号内为额外要求的权限等级）：')
    } else {
      output.push('可用的选项有：')
    }

    _options.forEach((option) => {
      const authority = option.authority ? `(${option.authority}) ` : ''
      let line = `    ${authority}${option.rawName}  ${option.description}`
      if (option.notUsage && maxUsage !== Infinity) {
        line += '（不计入总次数）'
      }
      output.push(line)
    })
  }

  if (command._examples.length) {
    output.push('使用示例：', ...command._examples.map(example => '    ' + example))
  }

  if (command.children.length) {
    output.push(
      '可用的子指令有（括号内为对应的最低权限等级，标有星号的表示含有子指令）：',
      ...getCommandList(command.context, meta, command, options.expand),
    )
  }

  return meta.$send(output.join('\n'))
}
