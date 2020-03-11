import { DialogueFlag, Dialogue } from './database'
import { TeachArgv, modifyDialogue, deleteDuplicate, checkAuthority } from './utils'
import { difference, observe, Meta } from 'koishi'

// TODO: 支持 pred
// TODO: 删问题时删 pred

export async function sendDetail (dialogue: Dialogue, meta: Meta, name?: string) {
  const groups = dialogue.groups
  const output = [
    `编号为 ${dialogue.id} 的问答信息：`,
    `问题：${dialogue.original}`,
    `回答：${dialogue.answer}`,
  ]

  if (dialogue.writer) {
    output.push(name ? `来源：${name} (${dialogue.writer})` : `来源：${dialogue.writer}`)
  }

  output.push(`生效环境：${dialogue.flag & DialogueFlag.reversed
    ? groups.includes('' + meta.groupId)
      ? groups.length - 1 ? `除本群等 ${groups.length} 个群外的所有群` : '除本群'
      : groups.length ? `除 ${groups.length} 个群外的所有群` : '全局'
    : groups.includes('' + meta.groupId)
      ? groups.length - 1 ? `本群等 ${groups.length} 个群` : '本群'
      : groups.length ? `${groups.length} 个群` : '全局禁止'}`)

  if (dialogue.probability < 1) output.push(`触发权重：${dialogue.probability}`)
  if (dialogue.minAffinity > 0) output.push(`最低好感度：${dialogue.minAffinity}`)
  if (dialogue.maxAffinity < 32768) output.push(`最高好感度：${dialogue.maxAffinity}`)
  if (dialogue.successors.length) output.push(`后继问题：${dialogue.successors.join(', ')}`)
  if (dialogue.flag & DialogueFlag.frozen) output.push('此问题已锁定。')

  await meta.$send(output.join('\n'))
}

export default async function (argv: TeachArgv) {
  const { ctx, meta, options, target } = argv
  const logger = ctx.logger('teach')

  const dialogues = await ctx.database.getDialogues([...target])
  const actualIds = dialogues.map(d => '' + d.id)
  const restIds = difference(target, actualIds)
  const output: string[] = []
  if (restIds.length) {
    output.push(`没有搜索到编号为 ${restIds.join(', ')} 的问答。`)
  }

  if (!Object.keys(options).length) {
    await meta.$send(output.join('\n'))

    let hasUnnamed = false
    const writers = deleteDuplicate(dialogues.map(d => d.writer).filter(Boolean))
    const users = await ctx.database.getUsers(writers, ['id', 'name'])
    const userMap: Record<number, string> = {}
    for (const user of users) {
      if (user.id === +user.name) {
        if (user.id === meta.userId) {
          user.name = meta.sender.card || meta.sender.nickname
        } else {
          hasUnnamed = true
        }
      } else {
        userMap[user.id] = user.name
      }
    }

    if (hasUnnamed && meta.messageType === 'group') {
      try {
        const members = await ctx.sender.getGroupMemberList(meta.groupId)
        for (const { userId, nickname, card } of members) {
          if (!userMap[userId]) {
            userMap[userId] = card || nickname
          }
        }
      } catch {}
    }

    for (const dialogue of dialogues) {
      await sendDetail(dialogue, meta, userMap[dialogue.writer])
    }
    return
  }

  const [uneditable, targets] = checkAuthority(meta, dialogues)

  if (options.remove) {
    if (uneditable.length) {
      output.push(`问答 ${uneditable.join(', ')} 因权限过低无法删除。`)
    }
    if (targets.length) {
      const editable = targets.map(d => d.id)
      await ctx.database.removeDialogues(editable)
      output.push(`已删除问答 ${editable.join(', ')}。`)
    }

    return meta.$send(output.join('\n'))
  }

  if (uneditable.length) {
    output.push(`问答 ${uneditable.join(', ')} 因权限过低无法修改。`)
  }

  const updated: number[] = []
  const skipped: number[] = []
  const failed: number[] = []

  if (await ctx.app.serialize('dialogue/modify', argv)) return

  for (const data of targets) {
    const { id } = data
    const dialogue = observe(data, `dialogue ${id}`)

    modifyDialogue(dialogue, argv)

    if (Object.keys(dialogue._diff).length) {
      try {
        await ctx.database.setDialogue(id, dialogue._diff)
        updated.push(id)
      } catch (error) {
        logger.warn(error)
        failed.push(id)
      }
    } else {
      skipped.push(id)
    }
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
