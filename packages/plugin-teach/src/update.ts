import { TeachArgv, prepareTargets, sendResult, split, isDialogueIdList } from './utils'
import { difference, deduplicate } from 'koishi-utils'
import { Context } from 'koishi-core'
import { Dialogue } from './database'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/before-detail' (argv: TeachArgv): void | Promise<void>
    'dialogue/detail' (dialogue: Dialogue, output: string[], argv: TeachArgv): void | Promise<void>
  }
}

declare module './utils' {
  interface TeachConfig {
    detailInterval?: number
    maxShownDialogues?: number
  }
}

export default function apply (ctx: Context) {
  ctx.command('teach')
    .option('--target <ids>', '查看或修改已有问题', { isString: true, validate: isDialogueIdList })
    .option('--remove', '彻底删除问答')

  ctx.before('dialogue/execute', (argv) => {
    if (!argv.options.target) return
    argv.target = deduplicate(split(argv.options.target))
    delete argv.options.target
    try {
      return update(argv)
    } catch (err) {
      ctx.logger('teach').warn(err)
      return argv.meta.$send('修改问答时出现问题。')
    }
  })
}

async function update (argv: TeachArgv) {
  const { ctx, meta, options, target, config } = argv
  const { maxShownDialogues = 10, detailInterval = 500 } = config

  if (!Object.keys(options).length && target.length > maxShownDialogues) {
    return meta.$send(`一次最多同时预览 ${maxShownDialogues} 个问答。`)
  }

  argv.uneditable = []
  argv.updated = []
  argv.skipped = []
  argv.dialogues = await ctx.database.getDialoguesById(target)

  const actualIds = argv.dialogues.map(d => d.id)
  argv.unknown = difference(target, actualIds)

  if (!Object.keys(options).length) {
    if (argv.unknown.length) {
      await meta.$send(`没有搜索到编号为 ${argv.unknown.join(', ')} 的问答。`)
    }
    await ctx.serialize('dialogue/before-detail', argv)
    for (const dialogue of argv.dialogues) {
      const output = [`编号为 ${dialogue.id} 的问答信息：`]
      await ctx.serialize('dialogue/detail', dialogue, output, argv)
      await meta.$sendQueued(output.join('\n'), detailInterval)
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
