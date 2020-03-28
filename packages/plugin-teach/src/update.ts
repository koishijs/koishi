import { TeachArgv, prepareTargets, sendDetail, sendResult, split } from './utils'
import { difference, deduplicate } from 'koishi-utils'
import { Context } from 'koishi-core'

export default function apply (ctx: Context) {
  ctx.command('teach')
    .option('-t, --target <ids>', '查看或修改已有问题', { isString: true, validate: val => !/^\d+(,\d+)*$/.test(val) })
    .option('-r, --remove', '彻底删除问答')

  ctx.before('dialogue/execute', (argv) => {
    if (!argv.options.target) return
    argv.target = deduplicate(split(argv.options.target))
    delete argv.options.target
    delete argv.options.t
    try {
      return update(argv)
    } catch (err) {
      ctx.logger('teach').warn(err)
      return argv.meta.$send('修改问答时出现问题。')
    }
  })
}

async function update (argv: TeachArgv) {
  const { ctx, meta, options, target } = argv

  argv.uneditable = []
  argv.updated = []
  argv.skipped = []
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

  const targets = prepareTargets(argv, argv.dialogues)

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

  for (const dialogue of targets) {
    ctx.emit('dialogue/modify', argv, dialogue)
  }

  await ctx.database.setDialogues(targets, argv)

  await ctx.serialize('dialogue/after-modify', argv)
  return sendResult(argv)
}
