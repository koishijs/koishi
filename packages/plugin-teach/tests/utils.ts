import { extendDatabase, Context } from 'koishi-core'
import { defineProperty, Observed, clone, intersection } from 'koishi-utils'
import { Dialogue, DialogueTest } from '../src'
import { MemoryDatabase, memory } from 'koishi-test-utils'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/memory'(dialogue: Dialogue, test: DialogueTest): boolean | void
  }
}

extendDatabase(MemoryDatabase, {
  async getDialoguesById(ids) {
    if (!ids.length) return []
    const table = this.$table('dialogue')
    const dialogues = Object.keys(table)
      .filter(id => ids.includes(+id))
      .map(id => clone(table[id]))
    dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
    return dialogues
  },

  async getDialoguesByTest(test: DialogueTest) {
    const dialogues = Object.values(this.$table('dialogue')).filter((dialogue) => {
      return !this.app.bail('dialogue/memory', dialogue, test)
        && !this.app.bail('dialogue/fetch', dialogue, test)
    }).map(clone)
    dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
    return dialogues
  },

  async createDialogue(dialogue: Dialogue, argv: Dialogue.Argv, revert = false) {
    dialogue = this.$create('dialogue', dialogue)
    Dialogue.addHistory(dialogue, '添加', argv, revert)
    return dialogue
  },

  async removeDialogues(ids: number[], argv: Dialogue.Argv, revert = false) {
    for (const id of ids) {
      this.$remove('dialogue', id)
      Dialogue.addHistory(argv.dialogueMap[id], '删除', argv, revert)
    }
  },

  async updateDialogues(dialogues: Observed<Dialogue>[], argv: Dialogue.Argv) {
    const fields = new Set<Dialogue.Field>(['id'])
    for (const { _diff } of dialogues) {
      for (const key in _diff) {
        fields.add(key as Dialogue.Field)
      }
    }
    const temp: Record<number, Dialogue> = {}
    for (const dialogue of dialogues) {
      if (!Object.keys(dialogue._diff).length) {
        argv.skipped.push(dialogue.id)
      } else {
        dialogue._diff = {}
        argv.updated.push(dialogue.id)
        this.$update('dialogue', dialogue.id, dialogue)
        Dialogue.addHistory(dialogue._backup, '修改', argv, false, temp)
      }
    }
    Object.assign(this.dialogueHistory, temp)
  },

  async revertDialogues(dialogues: Dialogue[], argv: Dialogue.Argv) {
    const created = dialogues.filter(d => d._type === '添加')
    const edited = dialogues.filter(d => d._type !== '添加')
    await this.removeDialogues(created.map(d => d.id), argv, true)
    await this.recoverDialogues(edited, argv)
    return `问答 ${dialogues.map(d => d.id).sort((a, b) => a - b)} 已回退完成。`
  },

  async recoverDialogues(dialogues: Dialogue[], argv: Dialogue.Argv) {
    for (const dialogue of dialogues) {
      this.$update('dialogue', dialogue.id, dialogue)
      Dialogue.addHistory(dialogue, '修改', argv, true)
    }
  },

  async getDialogueStats() {
    const dialogues = this.$count('dialogue')
    const questions = this.$count('dialogue', 'question')
    return { questions, dialogues }
  },
})

export function apply(ctx: Context) {
  ctx.plugin(memory)

  // flag
  ctx.on('dialogue/flag', (flag) => {
    ctx.on('dialogue/memory', (data, test) => {
      if (test[flag] !== undefined) {
        return !(data.flag & Dialogue.Flag[flag]) === test[flag]
      }
    })
  })

  // internal
  ctx.on('dialogue/memory', (data, { regexp, answer, question, original }) => {
    if (regexp) {
      if (answer !== undefined && !new RegExp(answer, 'i').test(data.answer)) return true
      if (question !== undefined && !new RegExp(question, 'i').test(data.question)) return true
      return
    }

    if (answer !== undefined && answer !== data.answer) return true
    if (question !== undefined) {
      if (regexp === false || !(data.flag & Dialogue.Flag.regexp)) return question !== data.question
      const questionRegExp = new RegExp(data.question, 'i')
      return !questionRegExp.test(question) && !questionRegExp.test(original)
    }
  })

  // writer
  ctx.on('dialogue/memory', (data, { writer }) => {
    if (writer !== undefined && data.writer !== writer) return true
  })

  // time
  ctx.on('dialogue/memory', (data, { matchTime, mismatchTime }) => {
    if (matchTime !== undefined && getProduct(data, matchTime) < 0) return true
    if (mismatchTime !== undefined && getProduct(data, mismatchTime) >= 0) return true
  })

  // successor
  ctx.on('dialogue/memory', (data, { predecessors, stateful, noRecursive }) => {
    if (noRecursive) return !!data.predecessors.length
    if (!predecessors) return
    const hasMatched = !!intersection(data.predecessors, predecessors).length
    if (stateful) return hasMatched
    return hasMatched || !data.predecessors.length
  })

  // context
  ctx.on('dialogue/memory', (data, test) => {
    if (!test.groups || !test.groups.length) return
    if (!(data.flag & Dialogue.Flag.complement) === test.reversed) {
      return test.groups.some(id => data.groups.includes(id))
    } else {
      return test.groups.some(id => !data.groups.includes(id))
    }
  })
}

function getProduct({ startTime, endTime }: Dialogue, time: number) {
  return (startTime - time) * (time - endTime) * (endTime - startTime)
}
