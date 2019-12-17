import { Dialogue, DialogueFlag } from './database'
import { splitIds, TeachOptions } from './utils'

export default async function (parsedOptions: TeachOptions) {
  const { ctx, meta, argc, options } = parsedOptions
  if (argc) return meta.$send('存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。')
  if (!/^\d+(,\d+)*$/.exec(options.update)) return meta.$send('参数 -u, --update 错误，请检查指令语法。')
  const ids: number[] = splitIds(options.update)
  const dialogues = await ctx.database.getDialogues(ids)
  const actualIds = dialogues.map(d => d.id)
  const restIds = ids.filter(id => !actualIds.includes(id))
  const output: string[] = []
  if (restIds.length) {
    output.push(`没有搜索到编号为 ${restIds.join(', ')} 问答。`)
  }

  if (options.delete) {
    const predicate: (dialogue: Dialogue) => boolean =
      meta.$user.authority > 3 ? () => false :
        meta.$user.authority > 2 ? d => !!(d.flag & DialogueFlag.frozen) :
          d => !!(d.flag & DialogueFlag.frozen) || d.writer !== meta.userId
    const removable = dialogues.filter(d => !predicate(d)).map(d => d.id)
    const unremovable = dialogues.filter(predicate).map(d => d.id)

    await ctx.database.removeDialogues(removable)
    if (removable.length) output.push(`已删除编号为 ${removable.join(', ')} 的问题。`)
    if (unremovable.length) output.push(`编号为 ${unremovable.join(', ')} 的问题因权限过低无法删除。`)
    return meta.$send(output.join('\n'))
  }

  if (options.disable) {
    parsedOptions.envMode = -1
    parsedOptions.groups = [meta.groupId]
  }

  const hasUpdates = Object.keys(parsedOptions).length - 5
    || options.answer
    || options.question
    || options.frozen
    || options.noFrozen
    || options.chance

  if (hasUpdates) {
    const updateSet = new Set<number>()
    const skipSet = new Set<number>()

    for (const dialogue of dialogues) {
      const updates = {} as Dialogue

      if (dialogue.writer !== meta.userId && meta.$user.authority < 3 && typeof parsedOptions.writer === 'number') {
        skipSet.add(dialogue.id)
        continue
      }

      function updateValue <K extends keyof Dialogue> (key: K, type: 'string' | 'number', value: Dialogue[K]) {
        // eslint-disable-next-line valid-typeof
        if (typeof value === type && value !== dialogue[key]) {
          updates[key] = value
        }
      }

      updateValue('answer', 'string', options.answer)
      updateValue('question', 'string', options.question)
      updateValue('writer', 'number', parsedOptions.writer)
      updateValue('probability', 'number', options.chance)

      let newFlag = dialogue.flag
      if (options.frozen) {
        newFlag = newFlag - (newFlag & DialogueFlag.frozen) + DialogueFlag.frozen
      } else if (options.noFrozen) {
        newFlag = newFlag - (newFlag & DialogueFlag.frozen)
      }

      if (parsedOptions.envMode) {
        const oldGroups = splitIds(dialogue.groups.replace(/^\*/, ''))
        let { groups, envMode } = parsedOptions
        if (Math.abs(parsedOptions.envMode) === 1) {
          envMode = dialogue.groups.startsWith('*') ? -2 : 2
          if (parsedOptions.envMode * envMode > 0) {
            groups = Array.from(new Set([...oldGroups, ...parsedOptions.groups])).sort()
          } else {
            if (meta.$user.authority < 3 && dialogue.id !== meta.userId) {
              skipSet.add(dialogue.id)
              continue
            }
            groups = oldGroups.filter(id => !parsedOptions.groups.includes(id))
          }
        }
        const newGroups = (envMode === -2 ? '*' : '') + groups.join(',')
        if (newGroups !== dialogue.groups) {
          if (dialogue.writer !== meta.userId && meta.$user.authority < 3) {
            skipSet.add(dialogue.id)
            continue
          }
          updates.groups = newGroups
        }
      }

      if (Object.keys(updates).length) {
        try {
          await ctx.database.setDialogue(dialogue.id, updates)
          updateSet.add(dialogue.id)
        } catch (error) {
          skipSet.add(dialogue.id)
        }
      }
    }

    if (skipSet.size) output.push(`问答 ${Array.from(skipSet).sort((a, b) => a > b ? 1 : -1).join(', ')} 修改时发生错误或权限不足。`)
    if (updateSet.size) {
      output.push(`问答 ${Array.from(updateSet).sort((a, b) => a > b ? 1 : -1).join(', ')} 已修改。`)
    } else {
      output.push('没有问题被修改。')
    }
    return meta.$send(output.join('\n'))
  }

  for (const dialogue of dialogues) {
    const groups = splitIds(dialogue.groups.replace(/^\*/, ''))
    const output = [
      `编号为 ${dialogue.id} 的问答信息：`,
      `问题：${dialogue.question}`,
      `回答：${dialogue.answer}`,
    ]
    if (dialogue.writer) {
      const user = await ctx.database.getUser(dialogue.writer, 0, ['id', 'name'])
      output.push(`来源：${user.name}`)
    }
    output.push(`生效环境：${dialogue.groups.startsWith('*')
      ? groups.includes(meta.groupId)
        ? groups.length - 1 ? `除本群等 ${groups.length} 个群外的所有群` : '除本群'
        : groups.length ? `除 ${groups.length} 个群外的所有群` : '全局'
      : groups.includes(meta.groupId)
        ? groups.length - 1 ? `本群等 ${groups.length} 个群` : '本群'
        : groups.length ? `${groups.length} 个群` : '全局禁止'}`)
    if (dialogue.probability < 1) output.push(`触发概率：${dialogue.probability}`)
    if (dialogue.flag & DialogueFlag.frozen) output.push('此问题已锁定')
    await meta.$send(output.join('\n'))
  }
}
