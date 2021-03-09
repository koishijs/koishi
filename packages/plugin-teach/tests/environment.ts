import { Database, Context } from 'koishi-core'
import { defineProperty, Observed, clone, intersection } from 'koishi-utils'
import { Dialogue, DialogueTest, equal, Config, apply } from 'koishi-plugin-teach'
import { App } from 'koishi-test-utils'

declare module 'koishi-core' {
  interface EventMap {
    'dialogue/memory'(dialogue: Dialogue, test: DialogueTest): boolean | void
  }
}

Database.extend('koishi-test-utils', {
  async getDialoguesById(ids) {
    if (!ids.length) return []
    const table = this.$table('dialogue')
    const dialogues = table.filter(row => ids.includes(row.id)).map<Dialogue>(clone)
    dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
    return dialogues
  },

  async getDialoguesByTest(test: DialogueTest) {
    const dialogues = this.$table('dialogue').filter((dialogue) => {
      return !this.app.bail('dialogue/memory', dialogue, test)
    }).map<Dialogue>(clone)
    dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
    return dialogues.filter((data) => {
      if (!test.groups || test.partial) return true
      return !(data.flag & Dialogue.Flag.complement) === test.reversed || !equal(test.groups, data.groups)
    })
  },

  async createDialogue(dialogue: Dialogue, argv: Dialogue.Argv, revert = false) {
    this.$create('dialogue', dialogue)
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
    Object.assign(this.app.teachHistory, temp)
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

export function memory(ctx: Context) {
  ctx.database.memory.$store.dialogue = []

  // flag
  ctx.on('dialogue/flag', (flag: string) => {
    ctx.on('dialogue/memory', (data, test) => {
      if (test[flag] !== undefined) {
        return !(data.flag & Dialogue.Flag[flag]) === test[flag]
      }
    })
  })

  // internal
  ctx.on('dialogue/memory', (data, { regexp, answer, question, original }) => {
    if (regexp) {
      if (answer && !new RegExp(answer, 'i').test(data.answer)) return true
      if (question && !new RegExp(question, 'i').test(data.question)) return true
      return
    }

    if (answer && answer !== data.answer) return true
    if (question) {
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

export default function (config: Config) {
  const app = new App({
    userCacheAge: Number.EPSILON,
    nickname: ['koishi', 'satori'],
    mockDatabase: true,
  })

  const u2id = '200', u3id = '300', u4id = '400'
  const g1id = '100', g2id = '200'
  const u2 = app.session(u2id)
  const u3 = app.session(u3id)
  const u4 = app.session(u4id)
  const u2g1 = app.session(u2id, g1id)
  const u2g2 = app.session(u2id, g2id)
  const u3g1 = app.session(u3id, g1id)
  const u3g2 = app.session(u3id, g2id)
  const u4g1 = app.session(u4id, g1id)
  const u4g2 = app.session(u4id, g2id)

  app.plugin(apply, {
    historyAge: 0,
    useContext: false,
    useTime: false,
    useWriter: false,
    successorTimeout: 0,
    ...config,
  })

  app.plugin(memory)

  async function start() {
    await app.start()
    await app.database.initUser(u2id, 2)
    await app.database.initUser(u3id, 3)
    await app.database.initUser(u4id, 4)
    await app.database.initChannel(g1id)
    await app.database.initChannel(g2id)
  }

  before(start)

  return { app, u2, u3, u4, u2g1, u2g2, u3g1, u3g2, u4g1, u4g2, start }
}
