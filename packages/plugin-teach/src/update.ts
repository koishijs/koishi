import { Context } from 'koishi-core'
import { difference, deduplicate, sleep, pick } from 'koishi-utils'
import { Dialogue, DialogueFlag, prepareTargets, sendResult, split, isDialogueIdList } from './database'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/before-detail' (argv: Dialogue.Argv): void | Promise<void>
    'dialogue/detail' (dialogue: Dialogue, output: string[], argv: Dialogue.Argv): void | Promise<void>
  }
}

declare module './database' {
  namespace Dialogue {
    interface Config {
      detailInterval?: number
      maxShownDialogues?: number
    }
  }
}

export default function apply (ctx: Context) {
  ctx.command('teach')
    .option('--target <ids>', '查看或修改已有问题', { isString: true, validate: isDialogueIdList })
    .option('-r, --remove', '彻底删除问答')

  ctx.before('dialogue/execute', (argv) => {
    const { remove, revert, target } = argv.options
    if (!target) return
    argv.target = deduplicate(split(target))
    delete argv.options.target
    try {
      return update(argv)
    } catch (err) {
      ctx.logger('teach').warn(err)
      return argv.meta.$send(`${revert ? '回退' : remove ? '删除' : '修改'}问答时出现问题。`)
    }
  })

  ctx.on('dialogue/detail', ({ original, answer, flag }, output) => {
    if (flag & DialogueFlag.regexp) {
      output.push(`正则：${original}`)
    } else {
      output.push(`问题：${original}`)
    }
    output.push(`回答：${answer}`)
  })
}

async function update (argv: Dialogue.Argv) {
  const { ctx, meta, options, target, config } = argv
  const { maxShownDialogues = 10, detailInterval = 500 } = config
  const { revert, review, remove } = options

  const modify = !review && Object.keys(options).length
  if (!modify && target.length > maxShownDialogues) {
    return meta.$send(`一次最多同时预览 ${maxShownDialogues} 个问答。`)
  }

  argv.uneditable = []
  argv.updated = []
  argv.skipped = []
  const dialogues = argv.dialogues = revert || review
    ? Object.values(pick(Dialogue.history, target))
    : await Dialogue.fromIds(target, argv.ctx)
  argv.dialogueMap = Object.fromEntries(dialogues.map(d => [d.id, { ...d }]))

  const actualIds = argv.dialogues.map(d => d.id)
  argv.unknown = difference(target, actualIds)
  await ctx.serialize('dialogue/before-detail', argv)

  if (!modify) {
    if (argv.unknown.length) {
      await meta.$send(`${review ? '最近无人修改过' : '没有搜索到'}编号为 ${argv.unknown.join(', ')} 的问答。`)
    }
    for (let index = 0; index < dialogues.length; index++) {
      const output = [`编号为 ${dialogues[index].id} 的${review ? '历史版本' : '问答信息'}：`]
      await ctx.serialize('dialogue/detail', dialogues[index], output, argv)
      if (index) await sleep(detailInterval)
      await meta.$send(output.join('\n'))
    }
    return
  }

  const targets = prepareTargets(argv)

  if (revert) {
    const message = targets.length ? await Dialogue.revert(targets, argv) : ''
    return sendResult(argv, message)
  }

  if (remove) {
    let message = ''
    if (targets.length) {
      const editable = targets.map(d => d.id)
      await Dialogue.remove(editable, argv)
      message = `问答 ${editable.join(', ')} 已成功删除。`
    }
    await ctx.serialize('dialogue/after-modify', argv)
    return sendResult(argv, message)
  }

  if (await ctx.app.serialize('dialogue/before-modify', argv)) return

  for (const dialogue of targets) {
    ctx.emit('dialogue/modify', argv, dialogue)
  }

  await Dialogue.update(targets, argv)

  await ctx.serialize('dialogue/after-modify', argv)
  return sendResult(argv)
}
