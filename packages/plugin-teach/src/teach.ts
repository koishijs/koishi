import { DialogueFlag } from './database'
import { TeachArgv, modifyDialogue, checkAuthority } from './utils'
import { observe, difference } from 'koishi'

export default async function (argv: TeachArgv) {
  const { meta, ctx, groups, options, successors = [], predecessors = [], predOverwrite } = argv

  if (await ctx.app.serialize('dialogue/modify', argv)) return

  const {
    answer,
    question,
    original,
    probability = 1,
    minAffinity = 0,
    maxAffinity = 32768,
    writer = meta.userId,
  } = options

  if (!question || !answer) return meta.$send('缺少问题或回答，请检查指令语法。')

  const output: string[] = []
  const uneditable: number[] = []
  const updated: number[] = []
  const skipped: number[] = []
  const failed: number[] = []

  const dialogues = await ctx.database.getDialogues(predecessors)
  if (dialogues.length < predecessors.length) {
    const diff = difference(predecessors, dialogues.map(d => '' + d.id))
    output.push(`无法添加前置问题：没有搜索到编号为 ${diff.join(', ')} 的问答。`)
  }

  async function addPredecessors (id: number) {
    const successor = '' + id
    const [_uneditable, targets] = checkAuthority(meta, dialogues)
    uneditable.push(..._uneditable)

    for (const { id, successors } of targets) {
      if (successors.includes(successor)) {
        skipped.push(id)
        continue
      }

      try {
        successors.push(successor)
        await ctx.database.setDialogue(id, { successors })
        updated.push(id)
      } catch (error) {
        failed.push(id)
      }
    }
  }

  async function removeNonpredecessors (id: number) {
    const successor = '' + id
    const dialogues = await ctx.database.getDialogues({ successors: [successor] })
    const [_uneditable, targets] = checkAuthority(meta, dialogues.filter(d => !predecessors.includes('' + d.id)))
    uneditable.push(..._uneditable)

    for (const { id, successors } of targets) {
      const index = successors.indexOf(successor)
      if (index === -1) {
        skipped.push(id)
        continue
      }

      try {
        successors.splice(index, 1)
        await ctx.database.setDialogue(id, { successors })
        updated.push(id)
      } catch (error) {
        failed.push(id)
      }
    }
  }

  async function sendResult (message: string) {
    output.unshift(message)
    if (uneditable.length) {
      output.push(`问答 ${uneditable.join(', ')} 因权限过低无法修改。`)
    }
    if (failed.length) {
      output.push(`问答 ${failed.join(', ')} 修改时发生错误。`)
    }
    if (skipped.length) {
      output.push(`问答 ${skipped.join(', ')} 没有发生改动。`)
    }
    if (updated.length) {
      output.push(`问答 ${updated.join(', ')} 已成功修改。`)
    }
    return meta.$send(output.join('\n'))
  }

  const [data] = await ctx.database.getDialogues({ question, answer })
  if (data) {
    if (predOverwrite) await removeNonpredecessors(data.id)
    await addPredecessors(data.id)

    const dialogue = observe(data, diff => ctx.database.setDialogue(data.id, diff), `dialogue ${data.id}`)
    modifyDialogue(dialogue, argv)
    if (Object.keys(dialogue._diff).length) {
      if (checkAuthority(meta, [data])[0].length) {
        return sendResult(`问答已存在，编号为 ${data.id}，且因权限过低无法修改。`)
      }
      await dialogue._update()
      return sendResult(`修改了已存在的问答，编号为 ${data.id}。`)
    } else {
      return sendResult(`问答已存在，编号为 ${data.id}，如要修改请尝试使用 #${data.id} 指令。`)
    }
  }

  const flag = ~~options.frozen * DialogueFlag.frozen
    + ~~options.keyword * DialogueFlag.keyword
    + ~~argv.reversed * DialogueFlag.reversed

  const { id } = await ctx.database.createDialogue({
    question,
    answer,
    writer,
    flag,
    probability,
    groups,
    minAffinity,
    maxAffinity,
    original,
    successors,
  })

  await addPredecessors(id)
  return sendResult(`问答已添加，编号为 ${id}。`)
}
