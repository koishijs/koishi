import { injectMethods } from 'koishi-core'
import { DialogueFlag } from '../src'
import { testGroups } from '../src/utils'
import 'koishi-database-memory'

injectMethods('memory', 'dialogue', {
  _testDialogue (test, data) {
    // match question and answer
    if (test.keyword) {
      if (test.question && !data.question.includes(test.question)) return
      if (test.answer && !data.answer.includes(test.answer)) return
    } else if (data.flag & DialogueFlag.keyword) {
      if (test.question && !test.question.includes(data.question)) return
      if (test.answer && !test.answer.includes(data.answer)) return
    } else {
      if (test.question && data.question !== test.question) return
      if (test.answer && data.answer !== test.answer) return
    }

    // match environment
    if (!testGroups(data, test)) return

    if (test.frozen !== undefined && test.frozen === !(data.flag & DialogueFlag.frozen)) return
    if (test.writer && data.writer !== test.writer) return

    return true
  },

  createDialogue (options) {
    return this.create('dialogue', options)
  },

  async getDialogues (test) {
    if (Array.isArray(test)) {
      if (!test.length) return []
      return test.map(id => this.store.dialogue[id]).filter(d => d)
    }

    return Object.keys(this.store.dialogue)
      .map(id => this.store.dialogue[id])
      .filter(data => this._testDialogue(test, data))
  },

  async setDialogue (id, data) {
    return this.update('dialogue', id, data)
  },

  async removeDialogues (ids) {
    return ids.map(id => this.remove('dialogue', id))
  },

  async getDialogueCount (test) {
    const questionSet = new Set<string>()
    let answers = 0
    for (const id in this.store.dialogue) {
      const data = this.store.dialogue[id]
      if (!this._testDialogue(test, data)) return
      questionSet.add(data.question)
      answers++
    }
    return { questions: questionSet.size, answers }
  },
})
