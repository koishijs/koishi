import { Database } from 'koishi-core'
import { clone, defineProperty, Observed } from 'koishi-utils'
import type { FilterQuery } from 'mongodb'
import {} from 'koishi-plugin-mongo'
import { Dialogue, DialogueTest, equal } from '../utils'

declare module 'koishi-core' {
  interface EventMap {
    'dialogue/mongo'(test: DialogueTest, conditionals?: FilterQuery<Dialogue>[]): void
  }
}

Database.extend('koishi-plugin-mongo', {
  async getDialoguesByTest(test: DialogueTest) {
    const query: FilterQuery<Dialogue> = { $and: [] }
    this.app.emit('dialogue/mongo', test, query.$and)
    const dialogues = await this.db.collection('dialogue').find(query).toArray()
    dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
    return dialogues.filter(value => {
      if (test.groups && !test.partial) {
        return !(value.flag & Dialogue.Flag.complement) === test.reversed || !equal(test.groups, value.groups)
      }
      value.id = value._id
      return true
    })
  },

  async updateDialogues(dialogues: Observed<Dialogue>[], argv: Dialogue.Argv) {
    const data: Partial<Dialogue>[] = []
    for (const dialogue of dialogues) {
      if (!Object.keys(dialogue._diff).length) {
        argv.skipped.push(dialogue.id)
      } else {
        data.push({ id: dialogue.id, ...dialogue._diff })
        dialogue._diff = {}
        argv.updated.push(dialogue.id)
        Dialogue.addHistory(dialogue._backup, '修改', argv, false)
      }
    }
    await this.update('dialogue', data)
  },
})
