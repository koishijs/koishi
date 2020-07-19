import { Context } from 'koishi-core'
import { difference, deduplicate, sleep, pick, isInteger, parseTime, formatTime } from 'koishi-utils'
import { Dialogue, DialogueFlag, prepareTargets, sendResult, split, isDialogueIdList } from './database'
import { getDetails, formatDetails, formatAnswer } from './search'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/before-modify' (argv: Dialogue.Argv): void | boolean | Promise<void | boolean>
    'dialogue/modify' (argv: Dialogue.Argv, dialogue: Dialogue): void
    'dialogue/after-modify' (argv: Dialogue.Argv): void | Promise<void>
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
    .option('-v, --review', '查看最近的修改')
    .option('-V, --revert', '回退最近的修改')
    .option('-l, --include-last [count]', { isString: true, validate: isIntegerOrInterval })
    .option('-L, --exclude-last [count]', { isString: true, validate: isIntegerOrInterval })
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

  ctx.before('dialogue/execute', (argv) => {
    const { options, meta } = argv
    const { includeLast, excludeLast } = options
    if (!options.review && !options.revert) return
    const now = Date.now(), includeTime = parseTime(includeLast), excludeTime = parseTime(excludeLast)
    const dialogues = Object.values(Dialogue.history).filter((dialogue) => {
      if (dialogue._operator !== meta.userId) return
      const offset = now - dialogue._timestamp
      if (includeTime && offset >= includeTime) return
      if (excludeTime && offset < excludeTime) return
      return true
    }).sort((d1, d2) => d2._timestamp - d1._timestamp).filter((_, index, temp) => {
      if (!includeTime && includeLast && index >= +includeLast) return
      if (!excludeTime && excludeLast && index < temp.length - +excludeLast) return
      return true
    })

    if (!dialogues.length) return meta.$send('没有搜索到满足条件的教学操作。')
    return options.review ? review(dialogues, argv) : revert(dialogues, argv)
  })

  ctx.on('dialogue/detail-short', ({ _type, _timestamp }, output) => {
    if (_type) {
      output.unshift(`${_type}-${formatTimeShort(Date.now() - _timestamp)}`)
    }
  })

  ctx.on('dialogue/detail', ({ original, answer, flag, _type, _timestamp }, output, argv) => {
    if (flag & DialogueFlag.regexp) {
      output.push(`正则：${original}`)
    } else {
      output.push(`问题：${original}`)
    }
    output.push(`回答：${answer}`)
    if (_type) {
      output.push(`最后一次${_type}于：${formatTime(Date.now() - _timestamp)}前`)
    }
  })
}

function isIntegerOrInterval (value: string) {
  const n = +value
  return n * 0 === 0 ? !isInteger(n) || n <= 0 : !parseTime(value)
}

const second = 1000
const minute = second * 60

function formatTimeShort (ms: number) {
  let result: string
  if (ms >= minute - second / 2) {
    ms += second / 2
    result = Math.floor(ms / minute) + 'm'
    if (ms % minute > second) {
      result += Math.floor(ms % minute / second) + 's'
    }
  } else {
    result = Math.round(ms / second) + 's'
  }
  return result
}

function review (dialogues: Dialogue[], argv: Dialogue.Argv) {
  const { meta } = argv
  const output = dialogues.map((d) => {
    const details = getDetails(argv, d)
    const { questionType = '问题', answerType = '回答' } = details
    const { original, answer } = d
    return `${formatDetails(d, details)}${questionType}：${original}，${answerType}：${formatAnswer(answer, argv.config)}`
  })
  return meta.$send(output.join('\n'))
}

async function revert (dialogues: Dialogue[], argv: Dialogue.Argv) {
  try {
    return argv.meta.$send(await Dialogue.revert(dialogues, argv))
  } catch (err) {
    argv.ctx.logger('teach').warn(err)
    return argv.meta.$send('回退问答中出现问题。')
  }
}

export async function update (argv: Dialogue.Argv) {
  const { ctx, meta, options, target, config } = argv
  const { maxShownDialogues = 10, detailInterval = 500 } = config
  const { revert, review, remove } = options

  options.modify = !review && Object.keys(options).length
  if (!options.modify && target.length > maxShownDialogues) {
    return meta.$send(`一次最多同时预览 ${maxShownDialogues} 个问答。`)
  }

  argv.uneditable = []
  argv.updated = []
  argv.skipped = []
  const dialogues = argv.dialogues = revert || review
    ? Object.values(pick(Dialogue.history, target)).filter(Boolean)
    : await Dialogue.fromIds(target, argv.ctx)
  argv.dialogueMap = Object.fromEntries(dialogues.map(d => [d.id, { ...d }]))

  const actualIds = argv.dialogues.map(d => d.id)
  argv.unknown = difference(target, actualIds)
  await ctx.serialize('dialogue/before-detail', argv)

  if (!options.modify) {
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

export async function create (argv: Dialogue.Argv) {
  const { ctx, options } = argv
  options.create = true
  const { question, answer } = options
  if (await ctx.app.serialize('dialogue/before-modify', argv)) return

  argv.unknown = []
  argv.uneditable = []
  argv.updated = []
  argv.skipped = []
  argv.dialogues = await Dialogue.fromTest(ctx, { question, answer, regexp: false })

  if (argv.dialogues.length) {
    argv.target = argv.dialogues.map(d => d.id)
    const targets = prepareTargets(argv)
    for (const dialogue of targets) {
      ctx.emit('dialogue/modify', argv, dialogue)
    }
    await Dialogue.update(targets, argv)
    await ctx.serialize('dialogue/after-modify', argv)
    return sendResult(argv)
  }

  const dialogue = { flag: 0 } as Dialogue
  if (ctx.bail('dialogue/permit', argv, dialogue)) {
    return argv.meta.$send('权限不足。')
  }

  try {
    ctx.emit('dialogue/modify', argv, dialogue)
    argv.dialogues = [await Dialogue.create(dialogue, argv)]

    await ctx.serialize('dialogue/after-modify', argv)
    return sendResult(argv, `问答已添加，编号为 ${argv.dialogues[0].id}。`)
  } catch (err) {
    await argv.meta.$send('添加问答时遇到错误。')
    throw err
  }
}
