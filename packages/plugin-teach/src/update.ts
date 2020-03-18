import { TeachArgv, checkAuthority, sendDetail, sendResult, deleteDuplicate, idSplit } from './utils'
import { difference, observe } from 'koishi-utils'
import { Context } from 'koishi-core'

export default function apply (ctx: Context) {
  ctx.command('teach')
    .option('-t, --target <ids>', '查看或修改已有问题', { isString: true, hidden: true })
    .option('-r, --remove', '彻底删除问答', { hidden: true })

  ctx.on('dialogue/validate', ({ options, meta }) => {
    if (options.target && !/^\d+(,\d+)*$/.exec(options.target)) {
      return meta.$send('参数 -t, --target 错误，请检查指令语法。')
    }
  })

  ctx.before('dialogue/execute', (argv) => {
    if (!argv.options.target) return
    argv.target = deleteDuplicate(idSplit(argv.options.target))
    delete argv.options.target
    delete argv.options.t
    return update(argv)
  })
}

async function update (argv: TeachArgv) {
  const { ctx, meta, options, target } = argv
  const logger = ctx.logger('teach')

  argv.uneditable = []
  argv.updated = []
  argv.skipped = []
  argv.failed = []
  argv.dialogues = await ctx.database.getDialogues(target)

  const actualIds = argv.dialogues.map(d => '' + d.id)
  argv.unknown = difference(target, actualIds)

  if (!Object.keys(options).length) {
    if (argv.unknown.length) {
      await meta.$send(`没有搜索到编号为 ${argv.unknown.join(', ')} 的问答。`)
    }
    await ctx.serialize('dialogue/before-detail', argv)
    for (const dialogue of argv.dialogues) {
      await sendDetail(ctx, dialogue, argv)
    }
    return
  }

  const targets = checkAuthority(argv, argv.dialogues)

  if (options.remove) {
    const output: string[] = []
    if (argv.unknown.length) {
      output.push(`没有搜索到编号为 ${argv.unknown.join(', ')} 的问答。`)
    }
    if (argv.uneditable.length) {
      output.push(`问答 ${argv.uneditable.join(', ')} 因权限过低无法删除。`)
    }
    if (targets.length) {
      const editable = targets.map(d => d.id)
      await ctx.database.removeDialogues(editable)
      output.unshift(`已删除问答 ${editable.join(', ')}。`)
    }
    await ctx.serialize('dialogue/after-modify', argv)
    return meta.$send(output.join('\n'))
  }

  if (await ctx.app.serialize('dialogue/before-modify', argv)) return

  for (const data of targets) {
    const { id } = data
    const dialogue = observe(data, `dialogue ${id}`)

    ctx.emit('dialogue/modify', argv, dialogue)

    if (Object.keys(dialogue._diff).length) {
      try {
        await ctx.database.setDialogue(id, dialogue._diff)
        argv.updated.push(id)
      } catch (error) {
        logger.warn(error)
        argv.failed.push(id)
      }
    } else {
      argv.skipped.push(id)
    }
  }

  await ctx.serialize('dialogue/after-modify', argv)
  return sendResult(argv)
}
