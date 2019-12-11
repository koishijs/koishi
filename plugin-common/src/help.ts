import { Context, Command, UserData, CommandConfig, MessageMeta } from 'koishi-core'

export default function apply (ctx: Context, options: CommandConfig) {
  ctx.command('help [command]', '显示帮助信息', { authority: 0, ...options })
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

function getCommands (context: Context, meta: MessageMeta, parent?: Command) {
  const commands = parent
    ? parent.children
    : context.app._commands.filter(cmd => cmd.context.match(meta))
  return commands
    .filter(cmd => !meta.$user || cmd.config.authority <= meta.$user.authority)
    .sort((a, b) => a.name > b.name ? 1 : a.name < b.name ? -1 : 0)
}

function showGlobalShortcut (context: Context, meta: MessageMeta) {
  const commands = getCommands(context, meta)
  const shortcuts = [].concat(...commands.map(command => getShortcuts(command, meta.$user)))
  return meta.$send(`当前可用的全局指令有：${shortcuts.join('，')}。`)
}

function getCommandList (context: Context, meta: MessageMeta, parent: Command, expand: boolean) {
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

function showGlobalHelp (context: Context, meta: MessageMeta, options: any) {
  return meta.$send([
    '当前可用的指令有（括号内为对应的最低权限等级，标有星号的表示含有子指令）：',
    ...getCommandList(context, meta, null, options.expand),
    `普通指令可以通过“${context.app.options.name}，<指令名>”的方式进行触发。`,
    '全局指令则不需要添加上述前缀，直接输入“<指令名>”即可触发。',
    '输入“全局指令”查看全部可用的全局指令。',
    '输入“帮助 <指令名>”查看特定指令的语法和使用示例。',
    '私聊发送“资助方式”以查看资助方式（需要 1 级权限）。',
  ].join('\n'))
}

async function showCommandHelp (command: Command, meta: MessageMeta, options: any) {
  const output = [command.name + command.declaration, command.config.description]
  if (command.context.database) {
    meta.$user = await command.context.database.observeUser(meta.userId)
  }

  if (command._aliases.length) {
    output.push(`中文别名：${Array.from(command._aliases).join('，')}。`)
  }
  const shortcuts = getShortcuts(command, meta.$user)
  if (shortcuts.length) {
    output.push(`相关全局指令：${shortcuts.join('，')}。`)
  }

  const maxUsage = command.getConfig('maxUsage', meta)
  const minInterval = command.getConfig('minInterval', meta)
  if (meta.$user) {
    const { authority, maxUsageText, authorityHint } = command.config
    const usage = command.updateUsage(meta.$user)
    if (maxUsage !== Infinity) {
      output.push(`已调用次数：${Math.min(usage.count, maxUsage)}/${maxUsageText || maxUsage}。`)
    }
    if (minInterval > 0) {
      const nextUsage = usage.last ? (Math.max(0, minInterval + usage.last - Date.now()) / 1000).toFixed() : 0
      output.push(`距离下次调用还需：${nextUsage}/${minInterval / 1000} 秒。`)
    }

    if (authorityHint) {
      output.push(authorityHint)
    } else if (authority > 1) {
      output.push(`最低权限：${authority} 级。`)
    }
  }

  if (command._usage) {
    output.push(command._usage)
  }

  if (command._options.length) {
    const options = command._options.filter(option => !option.hidden)
    if (options.some(o => o.authority)) {
      output.push('可用的选项有（括号内为额外要求的权限等级）：')
    } else {
      output.push('可用的选项有：')
    }

    command._options.filter(option => !option.hidden).forEach((option) => {
      const authority = option.authority ? `(${option.authority}) ` : ''
      let line = `    ${authority}${option.rawName}  ${option.description}`
      if (option.notUsage && maxUsage !== Infinity) {
        line += '（不计入总次数）'
      }
      output.push(line)
    })
  } else if (command._options.length) {
    output.push(`输入“help ${command.name} -o”查看完整的选项列表。`)
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
