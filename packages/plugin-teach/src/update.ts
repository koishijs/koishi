import { Context } from 'koishi-core'
import { difference, deduplicate, sleep, pick, isInteger, Time } from 'koishi-utils'
import { Dialogue, prepareTargets, sendResult, split, RE_DIALOGUES } from './utils'
import { getDetails, formatDetails, formatAnswer, formatQuestionAnswers } from './search'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/before-modify'(argv: Dialogue.Argv): void | string | Promise<void | string>
    'dialogue/modify'(argv: Dialogue.Argv, dialogue: Dialogue): void
    'dialogue/after-modify'(argv: Dialogue.Argv): void | Promise<void>
    'dialogue/before-detail'(argv: Dialogue.Argv): void | Promise<void>
    'dialogue/detail'(dialogue: Dialogue, output: string[], argv: Dialogue.Argv): void | Promise<void>
  }
}

declare module './utils' {
  namespace Dialogue {
    interface Config {
      detailDelay?: number
      maxShownDialogues?: number
    }
  }
}

export default function apply(ctx: Context) {
  ctx.command('teach')
    .option('review', '-v  查看最近的修改')
    .option('revert', '-V  回退最近的修改')
    .option('includeLast', '-l [count]  包含最近的修改数量', { type: 'string', validate: isIntegerOrInterval })
    .option('excludeLast', '-L [count]  排除最近的修改数量', { type: 'string', validate: isIntegerOrInterval })
    .option('target', '<ids>  查看或修改已有问题', { type: 'string', validate: RE_DIALOGUES })
    .option('remove', '-r  彻底删除问答')

  ctx.before('dialogue/execute', (argv) => {
    const { remove, revert, target } = argv.options
    if (!target) return
    argv.target = deduplicate(split(target))
    delete argv.options.target
    try {
      return update(argv)
    } catch (err) {
      ctx.logger('teach').warn(err)
      return argv.session.$send(`${revert ? '回退' : remove ? '删除' : '修改'}问答时出现问题。`)
    }
  })

  ctx.before('dialogue/execute', (argv) => {
    const { options, session } = argv
    const { includeLast, excludeLast } = options
    if (!options.review && !options.revert) return
    const now = Date.now(), includeTime = Time.parseTime(includeLast), excludeTime = Time.parseTime(excludeLast)
    const dialogues = Object.values(Dialogue.history).filter((dialogue) => {
      if (dialogue._operator !== session.userId) return
      const offset = now - dialogue._timestamp
      if (includeTime && offset >= includeTime) return
      if (excludeTime && offset < excludeTime) return
      return true
    }).sort((d1, d2) => d2._timestamp - d1._timestamp).filter((_, index, temp) => {
      if (!includeTime && includeLast && index >= +includeLast) return
      if (!excludeTime && excludeLast && index < temp.length - +excludeLast) return
      return true
    })

    if (!dialogues.length) return session.$send('没有搜索到满足条件的教学操作。')
    return options.review ? review(dialogues, argv) : revert(dialogues, argv)
  })

  ctx.on('dialogue/before-detail', async (argv) => {
    if (argv.options.modify) return
    await argv.ctx.parallel('dialogue/search', argv, {}, argv.dialogues)
  })

  ctx.on('dialogue/detail-short', ({ _type, _timestamp }, output) => {
    if (_type) {
      output.unshift(`${_type}-${Time.formatTimeShort(Date.now() - _timestamp)}`)
    }
  })

  ctx.on('dialogue/detail', ({ original, answer, flag, _type, _timestamp }, output) => {
    if (flag & Dialogue.Flag.regexp) {
      output.push(`正则：${original}`)
    } else {
      output.push(`问题：${original}`)
    }
    output.push(`回答：${answer}`)
    if (_type) {
      output.push(`最后一次${_type}于：${Time.formatTime(Date.now() - _timestamp)}前`)
    }
  })
}

function isIntegerOrInterval(value: string) {
  const n = +value
  return n * 0 === 0 ? !isInteger(n) || n <= 0 : !Time.parseTime(value)
}

function review(dialogues: Dialogue[], argv: Dialogue.Argv) {
  const { session } = argv
  const output = dialogues.map((d) => {
    const details = getDetails(argv, d)
    const { questionType = '问题', answerType = '回答' } = details
    const { original, answer } = d
    return `${formatDetails(d, details)}${questionType}：${original}，${answerType}：${formatAnswer(answer, argv.config)}`
  })
  return session.$send(output.join('\n'))
}

async function revert(dialogues: Dialogue[], argv: Dialogue.Argv) {
  try {
    return argv.session.$send(await argv.ctx.database.revertDialogues(dialogues, argv))
  } catch (err) {
    argv.ctx.logger('teach').warn(err)
    return argv.session.$send('回退问答中出现问题。')
  }
}

export async function update(argv: Dialogue.Argv) {
  const { ctx, session, options, target, config } = argv
  const { maxShownDialogues = 10, detailDelay: detailInterval = 500 } = config
  const { revert, review, remove, search } = options

  options.modify = !review && !search && Object.keys(options).length
  if (!options.modify && !search && target.length > maxShownDialogues) {
    return session.$send(`一次最多同时预览 ${maxShownDialogues} 个问答。`)
  }

  argv.uneditable = []
  argv.updated = []
  argv.skipped = []
  const dialogues = argv.dialogues = revert || review
    ? Object.values(pick(Dialogue.history, target)).filter(Boolean)
    : await ctx.database.getDialoguesById(target)
  argv.dialogueMap = Object.fromEntries(dialogues.map(d => [d.id, { ...d }]))

  if (search) {
    return session.$send(formatQuestionAnswers(argv, dialogues).join('\n'))
  }

  const actualIds = argv.dialogues.map(d => d.id)
  argv.unknown = difference(target, actualIds)
  await ctx.serial('dialogue/before-detail', argv)

  if (!options.modify) {
    if (argv.unknown.length) {
      await session.$send(`${review ? '最近无人修改过' : '没有搜索到'}编号为 ${argv.unknown.join(', ')} 的问答。`)
    }
    for (let index = 0; index < dialogues.length; index++) {
      const output = [`编号为 ${dialogues[index].id} 的${review ? '历史版本' : '问答信息'}：`]
      await ctx.serial('dialogue/detail', dialogues[index], output, argv)
      if (index) await sleep(detailInterval)
      await session.$send(output.join('\n'))
    }
    return
  }

  const targets = prepareTargets(argv)

  if (revert) {
    const message = targets.length ? await ctx.database.revertDialogues(targets, argv) : ''
    return sendResult(argv, message)
  }

  if (remove) {
    let message = ''
    if (targets.length) {
      const editable = targets.map(d => d.id)
      await ctx.database.removeDialogues(editable, argv)
      message = `问答 ${editable.join(', ')} 已成功删除。`
    }
    await ctx.serial('dialogue/after-modify', argv)
    return sendResult(argv, message)
  }

  if (targets.length) {
    const result = await ctx.app.serial('dialogue/before-modify', argv)
    if (typeof result === 'string') return result
    for (const dialogue of targets) {
      ctx.emit('dialogue/modify', argv, dialogue)
    }
    await ctx.database.updateDialogues(targets, argv)
    await ctx.serial('dialogue/after-modify', argv)
  }

  return sendResult(argv)
}

export async function create(argv: Dialogue.Argv) {
  const { ctx, options } = argv
  options.create = options.modify = true
  const { question, answer } = options

  argv.unknown = []
  argv.uneditable = []
  argv.updated = []
  argv.skipped = []
  argv.dialogues = await ctx.database.getDialoguesByTest({ question, answer, regexp: false })
  await ctx.serial('dialogue/before-detail', argv)
  const result = await ctx.app.serial('dialogue/before-modify', argv)
  if (typeof result === 'string') return result

  if (argv.dialogues.length) {
    argv.target = argv.dialogues.map(d => d.id)
    const targets = prepareTargets(argv)
    for (const dialogue of targets) {
      ctx.emit('dialogue/modify', argv, dialogue)
    }
    await ctx.database.updateDialogues(targets, argv)
    await ctx.serial('dialogue/after-modify', argv)
    return sendResult(argv)
  }

  const dialogue = { flag: 0 } as Dialogue
  if (ctx.bail('dialogue/permit', argv, dialogue)) {
    return argv.session.$send('该问答因权限过低无法添加。')
  }

  try {
    ctx.emit('dialogue/modify', argv, dialogue)
    argv.dialogues = [await ctx.database.createDialogue(dialogue, argv)]

    await ctx.serial('dialogue/after-modify', argv)
    return sendResult(argv, `问答已添加，编号为 ${argv.dialogues[0].id}。`)
  } catch (err) {
    await argv.session.$send('添加问答时遇到错误。')
    throw err
  }
}
